# ZooWeb Map Admin

Desktop-Admin-Oberfläche zur Vorbereitung einer interaktiven Zoo-Karte. Die Anwendung ist für Desktop-Browser ausgelegt: Administratoren laden eine Hintergrundkarte hoch, platzieren und verschieben Punkte, bearbeiten deren Inhalte, verwalten Medien und veröffentlichen unveränderliche Versionen der Karte.

Das aktuelle Backend arbeitet lokal: Projekte, Veröffentlichungen und Blob-Medien werden in IndexedDB gespeichert. Die Architektur trennt Benutzeroberfläche und Geschäftslogik vom Speicher. Dadurch lassen sich die lokalen Repository-Implementierungen später über den Composition Root durch Firebase-Implementierungen ersetzen.

## Start

Node.js 20 oder neuer wird benötigt.

```bash
npm install
npm run dev
```

Vite zeigt die lokale Adresse im Terminal an; standardmäßig ist dies `http://127.0.0.1:5173`.

```bash
npm test          # Vitest-Tests
npm run test:watch
npm run build     # TypeScript + Production-Bundle
npm run preview   # lokale Vorschau des Production-Bundles
```

## Funktionen

- Hochladen einer Hintergrundkarte und Arbeiten damit, ohne Punkte an die Bildauflösung zu binden;
- Zoomen mit dem Mausrad, Verschieben der Karte, Schaltflächen zum Zoomen und Zurücksetzen sowie verschiebbare Marker;
- Hinzufügen eines Punkts per Kartenklick sowie Bearbeiten, Duplizieren und Löschen mit Bestätigung;
- Suche, Kategorien, Zähler, Sichtbarkeitsfilter und Punktauswahl aus der Liste;
- Editor für Name, Kategorie, Untertitel, Beschreibung, Bild, Symbol, optionale eigene Farbe, Fakten und Sichtbarkeit;
- Kategorie-Editor für Standardsymbol, Farbe, Symbolgröße und Markierungsstil (`Nur Bild`, `Bild im Kreis`, `Pin`) inklusive gemeinsamer Bearbeitung aller Kategorien;
- Medienverwaltung für PNG-, WebP- und SVG-Dateien mit Vorschau und Wiederverwendung;
- Rückgängig/Wiederholen und Vorgangsprotokoll; das Verschieben eines Markers wird nach Abschluss des Ziehvorgangs als ein Vorgang gespeichert;
- automatisches Speichern mit Verzögerung und Statusanzeigen für gespeicherte bzw. ungespeicherte Änderungen;
- JSON-Import mit Zod-Validierung und Export des aktuellen Projekts;
- Veröffentlichung eines separaten unveränderlichen Snapshots, der sich nicht zusammen mit dem Entwurf ändert;
- Zustände für den ersten Start, das Laden und Fehler.

Punktkoordinaten werden als `x`/`y` im Bereich `0…1` gespeichert. Dadurch verschiebt eine Änderung der Fenstergröße oder der Größe des Ausgangsbilds die Marker nicht relativ zur Karte.

## Tastenkombinationen

| Tastenkombination | Aktion |
| --- | --- |
| `Delete` | Ausgewählten Punkt nach Bestätigung löschen |
| `Ctrl+Z` | Letzte Änderung rückgängig machen |
| `Ctrl+Shift+Z` | Rückgängig gemachte Änderung wiederholen |
| `Escape` | Hinzufügemodus verlassen, Dialog schließen oder Auswahl aufheben |

Tastenkombinationen, die Daten ändern, werden beim Schreiben in `input`- oder `textarea`-Feldern nicht abgefangen.

## Architektur

```text
src/
  domain/           Modelle, Zod-Schemas, Koordinaten und reine Factory-Funktionen
  application/      typisierte Befehle, Verlauf, automatisches Speichern, Import/Export, Veröffentlichung
  infrastructure/   Dexie und Local*Repository, Composition Root
  public-contract/  eigenständiger PublishedZooMap-Vertrag für Admin-Oberfläche und öffentliche Website
  store/            Zustand-State und Orchestrierung der Benutzeroberfläche
  components/       Arbeitsbereiche, Karte, Editor und Dialoge
  test/             Unit-, Repository- und UI-Tests
```

Die Abhängigkeiten sind nach innen gerichtet: React-Komponenten rufen Anwendungsvorgänge auf; die Anwendungsschicht arbeitet mit den Schnittstellen `ContentRepository`, `AssetRepository` und `PublishRepository`; die Infrastruktur implementiert diese Schnittstellen. `src/infrastructure/composition-root.ts` ist die einzige Stelle, an der konkrete Repository-Implementierungen zusammengestellt werden.

Änderungen an komplexen Strukturen erfolgen über die Funktionen `createItem`, `updateItem`, `moveItem`, `duplicateItem`, `deleteItem`, `createCategory`, `updateCategory`, `deleteCategory` und `setBackground`. Ihre Eingaben werden durch Zod-Schemas geprüft. `publishProject` erstellt einen versionierten Snapshot und speichert ihn über das `PublishRepository`.

### Entwurf und Veröffentlichung

Der Entwurf ist das aktuell bearbeitete `MapProject`. Das automatische Speichern aktualisiert nur diesen Entwurf. Eine Veröffentlichung ist eine separate Version vom Typ `PublishedZooMap`; die öffentliche Website soll künftig ausschließlich diesen Vertrag lesen. Änderungen am Entwurf werden erst durch den Befehl „Veröffentlichen“ öffentlich.

Das öffentliche Modul wird aus `src/public-contract/index.ts` exportiert und hängt nur von Zod ab. Es enthält `PublishedZooMapSchema`, TypeScript-Typen und `validatePublishedZooMap`. Ein gültiges Beispiel steht unter `public/published-map.example.json` bereit. Die gewählte Karten-Hintergrundfarbe wird als `background.color`, Kategorien-Stil, -Größe und innere Bildgröße als `categories[].markerStyle`, `categories[].iconScale` und `categories[].iconContentScale`, die Kontur als `categories[].outlineEnabled`, `categories[].outlineWidth` und `categories[].outlineColor` sowie eine optionale Punktfarbe als `items[].colorOverride` übertragen. Das Modul importiert weder React noch Dexie oder Firebase und kann in ein gemeinsames npm-Paket ausgelagert werden.

### Lokaler Speicher

Dexie verwaltet drei unabhängige IndexedDB-Tabellen:

- `projects` – bearbeitbare Projekte;
- `assets` – Metadaten und Blob-Dateien;
- `published` – unveränderliche veröffentlichte Versionen.

Ein Medium darf nur gelöscht werden, wenn es weder von der Karte noch von einer Kategorie, einem Punkt oder einem Fakt verwendet wird. Der JSON-Export des Projekts enthält strukturierte Daten; binäre Medien verbleiben in der lokalen Datenbank.

## Migration zu Firebase

Der Plan für Firestore-Sammlungen, Storage-Pfade, Authentication, Security Rules und die Umschaltung der Repository-Implementierungen ist in [FIREBASE_MIGRATION.md](./FIREBASE_MIGRATION.md) beschrieben. Firebase ist bewusst nicht im aktuellen Bundle enthalten.

Die verbindliche Zielarchitektur für Speichern, atomare Veröffentlichung, Versionierung, Client-Aktualisierung, Caching und Rollback steht in [docs/PUBLISHING_ARCHITECTURE.md](./docs/PUBLISHING_ARCHITECTURE.md).
