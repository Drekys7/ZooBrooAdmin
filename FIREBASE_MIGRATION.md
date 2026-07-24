# Migration von IndexedDB zu Firebase

## Ziel

Die erste Version arbeitet lokal mit Dexie. Die Benutzeroberfläche und die Anwendungsbefehle kennen jedoch nur die Schnittstellen `ContentRepository`, `AssetRepository` und `PublishRepository`. Bei der Migration zu Firebase werden die Implementierungen dieser Schnittstellen und der Composition Root ausgetauscht, nicht aber die Komponenten, der Zustand-Store oder die Domänenbefehle.

Firebase ist im aktuellen Build nicht eingebunden. Dieses Dokument beschreibt die Zielstruktur und eine sichere Migrationsreihenfolge.

## Firestore

Empfohlene Struktur auf oberster Ebene:

| Pfad | Zweck | Änderbarkeit |
| --- | --- | --- |
| `drafts/{projectId}` | Metadaten des bearbeitbaren Projekts: title, schemaVersion, backgroundAssetId, Abmessungen, Zeitangaben und revision | Änderbar, nur für Administratoren |
| `categories/{categoryId}` | Kategorie des Entwurfs; enthält `projectId` für Abfragen und die Prüfung der Projektzugehörigkeit | Änderbar, nur für Administratoren |
| `items/{itemId}` | Punkt des Entwurfs; enthält `projectId`, die normalisierte position und die übrigen Felder | Änderbar, nur für Administratoren |
| `assets/{assetId}` | Nur Dateimetadaten: projectId, storagePath, contentType, width, height, size, checksum, createdAt | Änderbar, nur für Administratoren |
| `published/{snapshotId}` | Unveränderliches `PublishedZooMap`; `snapshotId = {projectId}--{version}` | Nur Erstellung durch Administratoren, öffentlich lesbar |

Für ein schnelles Öffnen des Entwurfs werden Abfragen auf `categories` und `items` nach `projectId` gefiltert und nach `sortOrder` oder `updatedAt` sortiert. Die entsprechenden zusammengesetzten Indizes sollten im Repository als `firestore.indexes.json` abgelegt werden.

In `drafts/{projectId}` können zusätzlich `publishedVersion` und `publishedSnapshotId` gespeichert werden. Diese Felder verweisen auf die letzte Veröffentlichung, enthalten aber nicht die Veröffentlichung selbst. Die Aktualisierung dieses Verweises und die Erstellung des Snapshots erfolgen in einer Transaktion. Nach der Erstellung darf der Snapshot über das Client-SDK weder aktualisiert noch gelöscht werden.

Ein Firestore-Dokument ist auf 1 MiB begrenzt. Solange die Karte sicher unter diesem Limit bleibt, bietet ein vollständiges `PublishedZooMap` in einem einzelnen Dokument einen atomaren und einfachen schreibgeschützten Vertrag. Nähert sich die Größe dem Limit, sollte das `FirebasePublishRepository` versioniertes JSON in Storage speichern und unter `published/{snapshotId}` ein Manifest (`schemaVersion`, `projectId`, `version`, `publishedAt`, `contractUrl`, `sha256`) ablegen. Die öffentliche API gibt weiterhin den Typ `PublishedZooMap` zurück und validiert das JSON mit `validatePublishedZooMap`.

Innerhalb des veröffentlichten Vertrags darf kein Firestore-`Timestamp` verwendet werden: `publishedAt`, `createdAt` und `updatedAt` sind dort ISO-8601-Zeichenketten. Im Entwurf sind Timestamps auf Ebene des Firebase-Adapters zulässig, müssen aber an der Repository-Grenze umgewandelt werden.

## Firebase Storage

Binärdaten werden nicht in Firestore gespeichert. Vorgeschlagene Pfade:

```text
draft-assets/{projectId}/{assetId}/{fileName}
published-assets/{projectId}/{version}/{assetId}/{fileName}
published-contracts/{projectId}/{version}/published-map.json
```

Auf `draft-assets` dürfen nur Administratoren zugreifen. Bei der Veröffentlichung werden verwendete Medien in versionierte `published-assets` kopiert; diese Kopien sind öffentlich lesbar und unveränderlich. Dadurch kann eine Entwurfsdatei nach der Veröffentlichung nicht versehentlich ersetzt werden, und die öffentliche Website erhält niemals Zugriff auf die gesamte Arbeitsmediathek.

`assets/{assetId}` speichert Metadaten und den Pfad, aber weder Blob noch base64. Ein Medium des Entwurfs darf erst gelöscht werden, nachdem Verweise aus background, categories, items sowie aus einem aktiven Veröffentlichungsvorgang geprüft wurden. Veröffentlichte Versionen und ihre Dateien werden ausschließlich durch eine separate vertrauenswürdige Aufbewahrungsaufgabe bereinigt.

## Authentifizierung und Rollen

Für die Admin-Oberfläche wird Firebase Authentication aktiviert. In der ersten Phase genügt E-Mail/Passwort oder Google-Anmeldung mit einer Positivliste. Die Schreibberechtigung wird durch den Custom Claim `admin: true` bestimmt, der ausschließlich über das Admin SDK gesetzt wird. Eine Prüfung der E-Mail-Adresse im Client stellt keine Autorisierung dar.

Die öffentliche Website kann ohne Anmeldung funktionieren: Anonyme Nutzer dürfen ausschließlich `published` lesen. Administratoren lesen und ändern Entwurfsdaten, laden Dateien hoch und erstellen Veröffentlichungen.

Entwurf für die Firestore Rules:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && request.auth.token.admin == true;
    }

    match /published/{snapshotId} {
      allow read: if true;
      allow create: if isAdmin();
      allow update, delete: if false;
    }

    match /drafts/{document=**} {
      allow read, write: if isAdmin();
    }
    match /categories/{document=**} {
      allow read, write: if isAdmin();
    }
    match /items/{document=**} {
      allow read, write: if isAdmin();
    }
    match /assets/{document=**} {
      allow read, write: if isAdmin();
    }
  }
}
```

Entwurf für die Storage Rules:

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAdmin() {
      return request.auth != null && request.auth.token.admin == true;
    }

    match /draft-assets/{path=**} {
      allow read, write: if isAdmin();
    }
    match /published-assets/{path=**} {
      allow read: if true;
      allow create: if isAdmin();
      allow update, delete: if false;
    }
    match /published-contracts/{path=**} {
      allow read: if true;
      allow create: if isAdmin();
      allow update, delete: if false;
    }
  }
}
```

Vor dem Produktivbetrieb müssen die Regeln in der Firebase Emulator Suite geprüft werden: Nicht authentifizierte Nutzer sehen weder drafts/categories/items/assets noch `draft-assets`; Administratoren können CRUD-Vorgänge am Entwurf ausführen; ein veröffentlichter Snapshot kann von keiner Clientrolle geändert werden. Die Veröffentlichung sollte in eine aufrufbare Cloud Function verlagert werden: Sie validiert den Entwurf, berechnet die nächste version und checksum, kopiert nur verwendete assets und erstellt Manifest bzw. Snapshot atomar.

## Composition Root

Eine einzige Stelle zur Auswahl der Infrastruktur erstellt die Abhängigkeiten der Anwendung:

```ts
type Repositories = {
  content: ContentRepository
  assets: AssetRepository
  publish: PublishRepository
}

export function createRepositories(backend: 'local' | 'firebase'): Repositories {
  if (backend === 'firebase') {
    return {
      content: new FirebaseContentRepository(),
      assets: new FirebaseAssetRepository(),
      publish: new FirebasePublishRepository(),
    }
  }

  return {
    content: new LocalContentRepository(),
    assets: new LocalAssetRepository(),
    publish: new LocalPublishRepository(),
  }
}
```

Der Composition Root liest beispielsweise `VITE_DATA_BACKEND`, erstellt die Repository-Implementierungen einmalig und übergibt sie an die Anwendungsschicht. Das Firebase SDK wird ausschließlich von Firebase-Adaptern importiert. Befehle wie `createItem`, `moveItem` und `publishProject`, der öffentliche Vertrag sowie React-Komponenten importieren weder Dexie noch Firebase.

## Migrationsreihenfolge

1. Firebase SDK, Emulator-Konfiguration und separate Firebase-Adapter hinzufügen; lokale Adapter bleiben zunächst Standard.
2. Beide Adaptergruppen mit derselben Vertragstestsuite für die Repository-Schnittstellen abdecken.
3. Authentication, Custom Claims und standardmäßig verweigernde Regeln bereitstellen; die Regeln in der Emulator Suite prüfen.
4. IndexedDB einmalig als JSON plus Blobs exportieren, das JSON mit Zod-Schemas prüfen und Entwurf sowie Medien über ein administratives Migrationsskript hochladen.
5. Anzahl der categories/items/assets, Dateigrößen und Prüfsummen abgleichen und anschließend eine Testveröffentlichung durchführen.
6. Das Firebase-Backend per Schalter zunächst für Testadministratoren aktivieren. Der lokale Export bleibt bis zum Abschluss der Abnahme als Ausweichweg verfügbar.
7. Nach der Stabilisierung die serverseitige Veröffentlichung und Fehlerüberwachung aktivieren; erst danach keine Daten mehr in IndexedDB schreiben.

Anmeldedaten eines Service Accounts dürfen niemals in das Vite-Bundle gelangen. Die Firebase-Clientkonfiguration gilt nicht als Geheimnis; der Zugriff muss dennoch durch Rules, App Check und gegebenenfalls eine serverseitige Funktion eingeschränkt werden.
