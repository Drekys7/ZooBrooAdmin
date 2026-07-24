# Veröffentlichungsarchitektur für ZooBroo

## Entscheidung

ZooBroo verwendet für die erste produktive Version:

- Firebase Authentication für Administratoren;
- Cloud Firestore für Entwürfe, Metadaten, Revisionen und den Zeiger auf die aktive Veröffentlichung;
- Cloud Storage for Firebase für Kartenbilder, Tierbilder, Symbole und veröffentlichte JSON-Verträge;
- eine Callable Cloud Function für den vertrauenswürdigen Veröffentlichungsvorgang;
- optional einen Firestore-Listener, wenn eine bereits geöffnete Karte sofort aktualisiert werden muss.

Ein separates Ereignis ist **nicht** die Quelle der Wahrheit. Der öffentliche Client ermittelt die aktive Version immer über ein dauerhaft gespeichertes Manifest. Eine Realtime-Benachrichtigung ist nur ein Hinweis, dieses Manifest erneut zu prüfen.

## Grundprinzipien

1. Entwurf und Veröffentlichung sind getrennt. Automatisches Speichern verändert ausschließlich den Entwurf.
2. Veröffentlichungen sind unveränderlich. Jede Veröffentlichung erhält eine neue Versionsnummer und eigene Dateien.
3. Der Wechsel der aktiven Version ist atomar. JSON und Assets verschiedener Versionen dürfen niemals kombiniert werden.
4. Der öffentliche Client liest keine Entwurfsdaten.
5. Ältere Versionen bleiben für Rollback und Diagnose erhalten.
6. Daten werden an jeder Systemgrenze validiert.

## Zielbild

```text
Admin-Oberfläche
  ├─ Firestore: bearbeitbarer Entwurf
  ├─ Storage: private Entwurfsmedien
  └─ Callable Function: Veröffentlichen
          ├─ Entwurf und Berechtigungen prüfen
          ├─ neue Version berechnen
          ├─ verwendete Medien versionieren
          ├─ PublishedZooMap erzeugen und validieren
          ├─ veröffentlichten JSON-Vertrag speichern
          └─ currentVersion atomar aktualisieren

Öffentliche ZooWeb-Karte
  ├─ aktives Manifest/currentVersion laden
  ├─ bei neuer Version PublishedZooMap laden
  ├─ Vertrag mit validatePublishedZooMap prüfen
  ├─ neue Version erst nach vollständigem Laden aktivieren
  └─ bei Fehlern die letzte gültige Version weiterverwenden
```

## Datenstruktur

### Firestore

```text
projects/{projectId}
  title
  schemaVersion
  draftRevision
  currentVersion
  currentSnapshotId
  currentContractUrl
  currentChecksum
  publishedAt

projects/{projectId}/categories/{categoryId}
projects/{projectId}/items/{itemId}
projects/{projectId}/assets/{assetId}
projects/{projectId}/publications/{version}
```

Das Projektdokument enthält den aktuellen Zeiger und Projektmetadaten. Kategorien und Objekte werden separat gespeichert, damit beim Verschieben eines Markers nicht das gesamte Projekt neu geschrieben werden muss.

`draftRevision` wird bei gespeicherten Änderungen erhöht. Der Veröffentlichungsvorgang erhält die erwartete Revision und bricht ab, wenn während der Veröffentlichung eine neuere Änderung gespeichert wurde.

### Storage

```text
draft-assets/{projectId}/{assetId}/{fileName}

published/{projectId}/{version}/published-map.json
published/{projectId}/{version}/assets/{assetId}/{fileName}
```

Entwurfsmedien sind privat. Veröffentlichte Dateien sind unveränderlich. Eine neue Version verwendet einen neuen Pfad; vorhandene Dateien werden nicht überschrieben.

## Speichern im Editor

- Textänderungen werden mit Debounce gespeichert.
- Markerpositionen werden nicht bei jedem `mousemove` geschrieben.
- Während des Ziehens bleibt die Position im lokalen Zustand.
- Die persistente Speicherung erfolgt nach `dragend`.
- Normalisierte Koordinaten `x` und `y` im Bereich `0…1` bleiben der öffentliche Vertrag.
- Vor dem Speichern wird die aktuelle `draftRevision` geprüft.
- Konflikte zwischen mehreren Administratoren werden angezeigt, statt fremde Änderungen still zu überschreiben.

## Veröffentlichungsvorgang

Die Schaltfläche „Veröffentlichen“ ruft eine Callable Cloud Function auf:

```ts
type PublishRequest = {
  projectId: string
  expectedDraftRevision: number
}
```

Die Funktion:

1. prüft Firebase Authentication, App Check und die Administratorrolle;
2. liest einen konsistenten Entwurf;
3. prüft `expectedDraftRevision`;
4. validiert Projekt, Kategorien, Objekte, Koordinaten und Asset-Verweise;
5. bestimmt die nächste Versionsnummer;
6. kopiert nur verwendete Medien in den versionierten öffentlichen Pfad;
7. erzeugt `PublishedZooMap` über dieselben Regeln wie `buildPublishedSnapshot`;
8. validiert das Ergebnis mit `PublishedZooMapSchema`;
9. speichert `published-map.json` mit Prüfsumme;
10. legt den Publication-Datensatz an;
11. aktualisiert `currentVersion`, URL und Prüfsumme atomar;
12. gibt Version und Veröffentlichungszeitpunkt an die Admin-Oberfläche zurück.

Die Admin-Oberfläche darf veröffentlichte Dokumente nicht direkt zusammensetzen oder den aktiven Zeiger selbst verändern. Service-Account-Schlüssel befinden sich ausschließlich in der serverseitigen Umgebung.

## Manifest

Der öffentliche Client benötigt nur ein kleines Manifest:

```json
{
  "projectId": "zoo-osnabrueck",
  "schemaVersion": 1,
  "version": 42,
  "publishedAt": "2026-07-24T18:30:00.000Z",
  "contractUrl": "https://…/published/zoo-osnabrueck/42/published-map.json",
  "sha256": "…"
}
```

Das Manifest kann das Firestore-Projektdokument selbst sein oder von einer kleinen öffentlichen API geliefert werden. Der veröffentlichte Vertrag und seine Assets liegen in Storage.

## Verhalten des öffentlichen Clients

### Normale Website

Beim Öffnen der Karte:

1. Manifest laden;
2. Version mit der lokal aktiven Version vergleichen;
3. nur bei Änderung den neuen Vertrag laden;
4. JSON mit `validatePublishedZooMap` validieren;
5. notwendige Karte und Symbole vorladen;
6. neue Version erst anschließend sichtbar aktivieren;
7. letzte gültige Version in Cache beziehungsweise IndexedDB behalten.

Damit sehen Besucher beim Laden der Website immer die aktuelle veröffentlichte Version. Ein zusätzliches Event ist nicht erforderlich.

### Lange geöffnete Website oder Kiosk

Der Client kann `onSnapshot()` auf den kleinen `currentVersion`-Datensatz verwenden. Der Listener liefert zunächst den aktuellen Zustand und danach Änderungen. Nach einer neuen Version läuft derselbe normale Aktualisierungspfad.

Wenn Realtime nicht benötigt wird, genügt eine Prüfung bei Seitenaufruf, Navigation oder in einem sparsamen Intervall.

## Caching

- Manifest beziehungsweise `currentVersion`: nicht oder nur sehr kurz cachen.
- Versionierter JSON-Vertrag: langfristig cachen.
- Versionierte Kartenbilder und Symbole: `Cache-Control: public, max-age=31536000, immutable`.
- URLs enthalten die Versionsnummer oder einen Content-Hash.
- Eine veröffentlichte Datei darf unter derselben URL niemals verändert werden.

## Fehlerbehandlung

- Scheitert die Vorbereitung einer Version, bleibt `currentVersion` unverändert.
- Der Client aktiviert eine neue Version erst, wenn Vertrag und notwendige Assets gültig geladen wurden.
- Bei Netzwerk- oder Validierungsfehlern bleibt die letzte funktionierende Version sichtbar.
- Publikationsfehler werden mit Projekt, Revision, Benutzer, Phase und Fehlercode protokolliert.
- Wiederholte Publish-Aufrufe müssen idempotent behandelt werden.

## Rollback

Ein Rollback verändert keine alten Dateien. Eine vertrauenswürdige Serverfunktion setzt den aktiven Zeiger atomar auf eine frühere gültige Version zurück. Der Vorgang wird als Audit-Eintrag gespeichert.

## Sicherheit

- Firestore und Storage beginnen mit „deny by default“.
- Nur Administratoren dürfen Entwürfe und Entwurfsmedien lesen oder verändern.
- Nur die serverseitige Publish-Funktion darf öffentliche Versionen und den aktiven Zeiger anlegen.
- Öffentliche Nutzer dürfen ausschließlich veröffentlichte Daten lesen.
- Upload-Regeln prüfen Dateigröße, MIME-Typ und Pfad.
- Administratorrechte werden über serverseitig gesetzte Custom Claims vergeben.
- App Check wird zunächst beobachtet und anschließend erzwungen.
- Firestore-, Storage-, Auth- und Functions-Regeln werden mit der Emulator Suite getestet.

## Versionierung des Vertrags

- `schemaVersion` beschreibt das Datenformat.
- `version` beschreibt die inhaltliche Veröffentlichung.
- Der Client unterstützt bekannte `schemaVersion`-Werte explizit.
- Eine unbekannte Schema-Version wird nicht aktiviert.
- Vertragsänderungen erhalten Migrationen und Kompatibilitätstests zwischen Admin und ZooWeb.

Der bestehende Vertrag unter `src/public-contract` bleibt die gemeinsame Quelle für Schema und Typen. Später kann er in ein separates npm-Paket ausgelagert werden, das beide Anwendungen verwenden.

## Monitoring und Betrieb

- Erfolgreiche und fehlgeschlagene Veröffentlichungen messen.
- Größe des JSON-Vertrags und der verwendeten Assets überwachen.
- Budgets und Kostenwarnungen im Google-Cloud-Projekt aktivieren.
- Regelmäßige Firestore-Backups beziehungsweise Exporte einrichten.
- Alte Versionen erst nach definierter Aufbewahrungsfrist entfernen.
- Vor dem Löschen prüfen, ob eine Version aktiv oder als Rollback-Ziel geschützt ist.

## Implementierungsreihenfolge

1. Firebase-Projekt für Entwicklung anlegen und Emulator Suite konfigurieren.
2. Firebase Authentication und Administratorrollen implementieren.
3. Firestore- und Storage-Regeln samt automatisierten Tests hinzufügen.
4. `FirebaseContentRepository` und `FirebaseAssetRepository` implementieren.
5. Umschaltung über den Composition Root einführen; lokales Backend zunächst behalten.
6. Migration beziehungsweise Import des lokalen Entwurfs implementieren.
7. Callable Publish Function und versionierte Storage-Pfade implementieren.
8. `FirebasePublishRepository` an die Serverfunktion anbinden.
9. Loader für Manifest und `PublishedZooMap` im öffentlichen ZooWeb implementieren.
10. Cache, Fallback auf letzte gültige Version und optionalen Realtime-Listener ergänzen.
11. Rollback, Audit-Log und Monitoring hinzufügen.
12. Erst nach Abnahme das lokale Backend als Standard ablösen.

## Wann Firebase neu bewertet werden sollte

Firebase ist für die erste produktive Version die bevorzugte Lösung. PostgreSQL/Supabase oder ein eigener API-Dienst sollte neu bewertet werden, wenn mehrere Mandanten, komplexe Rollen, Abrechnung, umfangreiche Berichte, relationale Geschäftsprozesse oder sehr große Inhaltsmengen hinzukommen.

## Offizielle Referenzen

- [Firestore Realtime Listener](https://firebase.google.com/docs/firestore/query-data/listen)
- [Firestore Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore Limits](https://firebase.google.com/docs/firestore/quotas)
- [Callable Cloud Functions](https://firebase.google.com/docs/functions/callable)
- [Cloud Storage Metadata und Cache-Control](https://firebase.google.com/docs/storage/web/file-metadata)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Firebase App Check](https://firebase.google.com/docs/app-check/enable-enforcement)
- [Firebase Local Emulator Suite](https://firebase.google.com/docs/rules/emulator-setup)
