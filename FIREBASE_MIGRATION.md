# Migration von IndexedDB zu Firebase

## Ziel

Die erste Version arbeitet lokal mit Dexie. Die Benutzeroberfläche und die Anwendungsbefehle kennen jedoch nur die Schnittstellen `ContentRepository`, `AssetRepository` und `PublishRepository`. Bei der Migration zu Firebase werden die Implementierungen dieser Schnittstellen und der Composition Root ausgetauscht, nicht aber die Komponenten, der Zustand-Store oder die Domänenbefehle.

Firebase ist im aktuellen Build nicht eingebunden. Dieses Dokument beschreibt die Zielstruktur und eine sichere Migrationsreihenfolge.

Die Zielarchitektur ist ein gemeinsames Multi-Tenant-SaaS. Development, Staging und Production erhalten getrennte Firebase-Projekte; Zoos innerhalb einer Umgebung werden über `zooId` isoliert und erhalten standardmäßig kein eigenes Firebase-Projekt. Die verbindlichen Entscheidungen zu Hosting, Abonnements, Rollen und Veröffentlichung stehen in [docs/PUBLISHING_ARCHITECTURE.md](./docs/PUBLISHING_ARCHITECTURE.md).

## Firestore

Empfohlene Struktur auf oberster Ebene:

| Pfad | Zweck | Änderbarkeit |
| --- | --- | --- |
| `zoos/{zooId}` | Mandanten-, Entwurfs-, Veröffentlichungs- und Abrechnungsmetadaten | Rollenabhängig änderbar |
| `zoos/{zooId}/members/{userId}` | Mitgliedschaft und Rolle `owner`, `admin`, `editor` oder `viewer` | Nur durch vertrauenswürdige Einladungs- und Rollenlogik |
| `zoos/{zooId}/categories/{categoryId}` | Kategorie des bearbeitbaren Entwurfs | Änderbar durch `owner`, `admin` und `editor` |
| `zoos/{zooId}/items/{itemId}` | Kartenpunkt mit normalisierter Position und übrigen Feldern | Änderbar durch `owner`, `admin` und `editor` |
| `zoos/{zooId}/assets/{assetId}` | Dateimetadaten: storagePath, contentType, width, height, size, checksum, createdAt | Änderbar durch `owner`, `admin` und `editor` |
| `zoos/{zooId}/publications/{version}` | Unveränderliches Manifest einer veröffentlichten Version | Nur Erstellung durch die Publish-Funktion, öffentlich lesbar |
| `domains/{hostname}` | Öffentliche Zuordnung einer Domain oder Subdomain zu `zooId` | Nur durch vertrauenswürdigen Backend-Code |
| `publicMaps/{zooId}` | Kleines aktives Manifest ohne private Zoo- oder Abrechnungsdaten | Nur durch Publish- oder Rollback-Funktion änderbar, öffentlich lesbar |

Für ein schnelles Öffnen des Entwurfs werden die Unterkollektionen eines ausgewählten `zooId` nach `sortOrder` oder `updatedAt` sortiert. Mandantenübergreifende Abfragen sind für normale Zoo-Benutzer nicht vorgesehen. Notwendige Indizes werden als `firestore.indexes.json` versioniert.

In `zoos/{zooId}` werden `currentVersion`, `currentSnapshotId`, `currentContractUrl` und `draftRevision` gespeichert. Die Aktualisierung dieses internen Veröffentlichungszeigers, die Erstellung der unveränderlichen Veröffentlichung und die Aktualisierung von `publicMaps/{zooId}` erfolgen serverseitig und atomar. Das öffentliche Manifest enthält ausschließlich `zooId`, `slug`, `schemaVersion`, `version`, `publishedAt`, `contractUrl` und `sha256`. Nach der Erstellung darf eine Veröffentlichung über das Client-SDK weder aktualisiert noch gelöscht werden.

Ein Firestore-Dokument ist auf 1 MiB begrenzt. Solange die Karte sicher unter diesem Limit bleibt, bietet ein vollständiges `PublishedZooMap` in einem einzelnen Dokument einen atomaren und einfachen schreibgeschützten Vertrag. Nähert sich die Größe dem Limit, sollte das `FirebasePublishRepository` versioniertes JSON in Storage speichern und unter `zoos/{zooId}/publications/{version}` ein Manifest (`schemaVersion`, `zooId`, `projectId`, `version`, `publishedAt`, `contractUrl`, `sha256`) ablegen. Die öffentliche API gibt weiterhin den Typ `PublishedZooMap` zurück und validiert das JSON mit `validatePublishedZooMap`.

Innerhalb des veröffentlichten Vertrags darf kein Firestore-`Timestamp` verwendet werden: `publishedAt`, `createdAt` und `updatedAt` sind dort ISO-8601-Zeichenketten. Im Entwurf sind Timestamps auf Ebene des Firebase-Adapters zulässig, müssen aber an der Repository-Grenze umgewandelt werden.

## Firebase Storage

Binärdaten werden nicht in Firestore gespeichert. Vorgeschlagene Pfade:

```text
zoos/{zooId}/draft-assets/{assetId}/{fileName}
zoos/{zooId}/published/{version}/assets/{assetId}/{fileName}
zoos/{zooId}/published/{version}/published-map.json
```

Auf `draft-assets` dürfen nur Mitglieder des jeweiligen Zoos entsprechend ihrer Rolle zugreifen: `viewer` liest, `owner`, `admin` und `editor` dürfen außerdem schreiben. Bei der Veröffentlichung werden verwendete Medien in den versionierten öffentlichen Pfad kopiert; diese Kopien sind öffentlich lesbar und unveränderlich. Dadurch kann eine Entwurfsdatei nach der Veröffentlichung nicht versehentlich ersetzt werden, und die öffentliche Website erhält niemals Zugriff auf die gesamte Arbeitsmediathek.

`assets/{assetId}` speichert Metadaten und den Pfad, aber weder Blob noch base64. Ein Medium des Entwurfs darf erst gelöscht werden, nachdem Verweise aus background, categories, items sowie aus einem aktiven Veröffentlichungsvorgang geprüft wurden. Veröffentlichte Versionen und ihre Dateien werden ausschließlich durch eine separate vertrauenswürdige Aufbewahrungsaufgabe bereinigt.

## Authentifizierung und Rollen

Für die gemeinsame Admin-Oberfläche wird Firebase Authentication aktiviert. In der ersten Phase genügt E-Mail/Passwort oder Google-Anmeldung. Zoo-Zugriff und Rollen werden über `zoos/{zooId}/members/{userId}` bestimmt. Eine kleine globale Custom Claim wie `platformAdmin: true` ist ausschließlich für ZooBroo-interne Plattformadministratoren vorgesehen und wird nur über das Admin SDK gesetzt. Eine Prüfung der E-Mail-Adresse oder der sichtbaren UI im Client stellt keine Autorisierung dar.

Die öffentliche Website kann ohne Anmeldung funktionieren: Anonyme Nutzer dürfen ausschließlich aktive veröffentlichte Manifeste und versionierte öffentliche Dateien lesen. `owner`, `admin` und `editor` bearbeiten Entwurfsdaten; `viewer` erhält nur Lesezugriff. Die eigentliche Veröffentlichung läuft über eine Callable Function, die zusätzlich Rolle und Abonnementstatus prüft.

Entwurf für die Firestore Rules:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function roleFor(zooId) {
      return get(
        /databases/$(database)/documents/zoos/$(zooId)/members/$(request.auth.uid)
      ).data.role;
    }

    function canReadDraft(zooId) {
      return request.auth != null
        && roleFor(zooId) in ['owner', 'admin', 'editor', 'viewer'];
    }

    function canEditDraft(zooId) {
      return request.auth != null
        && roleFor(zooId) in ['owner', 'admin', 'editor'];
    }

    match /zoos/{zooId} {
      allow read: if canReadDraft(zooId);
      allow update: if canEditDraft(zooId)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'name',
          'schemaVersion',
          'draftRevision',
          'backgroundAssetId',
          'backgroundColor',
          'width',
          'height',
          'updatedAt'
        ]);
      allow create, delete: if false;

      match /members/{userId} {
        allow read: if canReadDraft(zooId);
        allow write: if false;
      }

      match /{collectionName}/{documentId} {
        allow read: if collectionName in ['categories', 'items', 'assets']
          && canReadDraft(zooId);
        allow write: if collectionName in ['categories', 'items', 'assets']
          && canEditDraft(zooId);
      }

      match /publications/{version} {
        allow read: if true;
        allow write: if false;
      }
    }

    match /domains/{hostname} {
      allow read: if true;
      allow write: if false;
    }

    match /publicMaps/{zooId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

Entwurf für die Storage Rules:

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function roleFor(zooId) {
      return firestore.get(
        /databases/(default)/documents/zoos/$(zooId)/members/$(request.auth.uid)
      ).data.role;
    }

    function canReadDraft(zooId) {
      return request.auth != null
        && roleFor(zooId) in ['owner', 'admin', 'editor', 'viewer'];
    }

    function canEditDraft(zooId) {
      return request.auth != null
        && roleFor(zooId) in ['owner', 'admin', 'editor'];
    }

    match /zoos/{zooId}/draft-assets/{path=**} {
      allow read: if canReadDraft(zooId);
      allow write: if canEditDraft(zooId);
    }

    match /zoos/{zooId}/published/{path=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

Vor dem Produktivbetrieb müssen die Regeln in der Firebase Emulator Suite mit mindestens zwei Zoos geprüft werden: Ein Benutzer von Zoo A darf keine Entwürfe oder Medien von Zoo B lesen; `viewer` kann nicht schreiben; `editor` kann weder Rollen noch Abonnementfelder ändern; nicht authentifizierte Nutzer sehen keine Entwurfsdaten; eine veröffentlichte Version kann von keiner Clientrolle geändert werden. Die Veröffentlichung läuft in einer Callable Cloud Function, die Mitgliedschaft, Rolle und aktives Abonnement prüft, den Entwurf validiert, die nächste Version und Prüfsumme berechnet, nur verwendete Assets kopiert und Manifest beziehungsweise Snapshot atomar erstellt.

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

1. Getrennte Firebase-Projekte für Development, Staging und Production definieren; zunächst Emulator Suite und Development einrichten.
2. Firebase SDK, Emulator-Konfiguration und separate Firebase-Adapter hinzufügen; lokale Adapter bleiben zunächst Standard.
3. Repository-Schnittstellen um einen verpflichtenden `zooId`-Kontext ergänzen und beide Adaptergruppen mit derselben Vertragstestsuite abdecken.
4. Multi-Tenant-Struktur `zoos/{zooId}`, Mitgliedschaften, Rollen und Domain-Zuordnung bereitstellen.
5. Authentication und standardmäßig verweigernde Firestore- und Storage-Regeln implementieren. Custom Claims bleiben auf globale Plattformrollen beschränkt.
6. Rules in der Emulator Suite mit mindestens zwei Test-Zoos prüfen, insbesondere unerlaubte Zugriffe von Zoo A auf Zoo B.
7. IndexedDB einmalig als JSON plus Blobs exportieren, mit Zod-Schemas prüfen und über ein administratives Migrationsskript in einen ausdrücklich ausgewählten Zoo hochladen.
8. Anzahl der Kategorien, Objekte und Assets, Dateigrößen und Prüfsummen abgleichen und anschließend eine Testveröffentlichung durchführen.
9. Callable Publish Function mit Rollen-, Revisions- und Abonnementprüfung sowie unveränderlichen versionierten Ausgaben aktivieren.
10. Das Firebase-Backend per Schalter zunächst für Testadministratoren in Staging aktivieren. Der lokale Export bleibt bis zum Abschluss der Abnahme als Ausweichweg verfügbar.
11. Gemeinsamen öffentlichen Client, Zoo-Auflösung, Hosting und Cache-Verhalten mit zwei Test-Zoos abnehmen.
12. Zahlungsanbieter-Webhooks, Monitoring, Audit-Log, Backups und Rollback ergänzen.
13. Erst nach erfolgreicher Abnahme Firebase als Standard setzen und keine neuen Daten mehr in IndexedDB schreiben.

Anmeldedaten eines Service Accounts dürfen niemals in das Vite-Bundle gelangen. Die Firebase-Clientkonfiguration gilt nicht als Geheimnis; der Zugriff muss dennoch durch Rules, App Check und gegebenenfalls eine serverseitige Funktion eingeschränkt werden.
