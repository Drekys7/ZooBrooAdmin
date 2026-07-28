# Veröffentlichungsarchitektur für ZooBroo

## Entscheidung

ZooBroo verwendet für die erste produktive Version:

- ein gemeinsames Multi-Tenant-SaaS für mehrere Zoos;
- Firebase Authentication für Administratoren;
- Cloud Firestore für Entwürfe, Metadaten, Revisionen und den Zeiger auf die aktive Veröffentlichung;
- Cloud Storage for Firebase für Kartenbilder, Tierbilder, Symbole und veröffentlichte JSON-Verträge;
- eine Callable Cloud Function für den vertrauenswürdigen Veröffentlichungsvorgang;
- Firebase Hosting für eine gemeinsame Admin-Anwendung und einen gemeinsamen öffentlichen Karten-Client;
- Stripe oder Paddle für wiederkehrende Abonnements; der bestätigte Status wird serverseitig pro Zoo gespeichert;
- optional einen Firestore-Listener, wenn eine bereits geöffnete Karte sofort aktualisiert werden muss.

Für Entwicklung, Staging und Produktion werden getrennte Firebase-Projekte verwendet. Standardmäßig wird **kein Firebase-Projekt pro Zoo** angelegt. Ein kundeneigenes Projekt ist nur eine optionale Enterprise-Ausnahme für vertraglich geforderte Infrastruktur- oder Datenisolation.

Ein separates Ereignis ist **nicht** die Quelle der Wahrheit. Der öffentliche Client ermittelt die aktive Version immer über ein dauerhaft gespeichertes Manifest. Eine Realtime-Benachrichtigung ist nur ein Hinweis, dieses Manifest erneut zu prüfen.

## Grundprinzipien

1. Entwurf und Veröffentlichung sind getrennt. Automatisches Speichern verändert ausschließlich den Entwurf.
2. Veröffentlichungen sind unveränderlich. Jede Veröffentlichung erhält eine neue Versionsnummer und eigene Dateien.
3. Der Wechsel der aktiven Version ist atomar. JSON und Assets verschiedener Versionen dürfen niemals kombiniert werden.
4. Der öffentliche Client liest keine Entwurfsdaten.
5. Ältere Versionen bleiben für Rollback und Diagnose erhalten.
6. Daten werden an jeder Systemgrenze validiert.
7. Jeder gespeicherte Datensatz und jeder Storage-Pfad ist eindeutig einem `zooId` zugeordnet.
8. Mandantenzugriff wird in Security Rules und Serverfunktionen geprüft, niemals nur in der Benutzeroberfläche.
9. Admin und öffentliche Karte werden zentral von ZooBroo betrieben und für alle Kunden gemeinsam aktualisiert.
10. Der Zahlungsanbieter ist die Quelle der Wahrheit für die Abrechnung; Firebase speichert den daraus abgeleiteten Berechtigungsstatus.

## Zielbild

```text
Gemeinsame Admin-Oberfläche (admin.zoobroo.com)
  ├─ Authentication: Benutzer anmelden
  ├─ Firestore: Mitgliedschaften und bearbeitbare Entwürfe pro zooId
  ├─ Storage: private Entwurfsmedien pro zooId
  └─ Callable Function: Veröffentlichen
          ├─ Zoo-Mitgliedschaft, Rolle und Abonnement prüfen
          ├─ Entwurf und Berechtigungen prüfen
          ├─ neue Version berechnen
          ├─ verwendete Medien versionieren
          ├─ PublishedZooMap erzeugen und validieren
          ├─ veröffentlichten JSON-Vertrag speichern
          └─ currentVersion atomar aktualisieren

Gemeinsamer öffentlicher Karten-Client
  ├─ Zoo über Pfad, Subdomain oder kundeneigene Domain bestimmen
  ├─ aktives Manifest/currentVersion laden
  ├─ bei neuer Version PublishedZooMap laden
  ├─ Vertrag mit validatePublishedZooMap prüfen
  ├─ neue Version erst nach vollständigem Laden aktivieren
  └─ bei Fehlern die letzte gültige Version weiterverwenden
```

## Datenstruktur

### Firestore

```text
zoos/{zooId}
  name
  slug
  subscriptionStatus
  subscriptionProvider
  subscriptionCustomerId
  customDomain
  schemaVersion
  draftRevision
  backgroundColor
  currentVersion
  currentSnapshotId
  currentContractUrl
  currentChecksum
  publishedAt

zoos/{zooId}/members/{userId}
  role: owner | admin | editor | viewer

zoos/{zooId}/categories/{categoryId}
zoos/{zooId}/items/{itemId}
zoos/{zooId}/assets/{assetId}
zoos/{zooId}/publications/{version}
zoos/{zooId}/audit/{eventId}

domains/{hostname}
  zooId

publicMaps/{zooId}
  zooId
  slug
  currentVersion
  contractUrl
  sha256
  publishedAt
  schemaVersion
```

Das Zoo-Dokument ist die Mandantengrenze und enthält den aktuellen Veröffentlichungszeiger, Vertrags- und Abrechnungsmetadaten. Kategorien und Objekte werden separat gespeichert, damit beim Verschieben eines Markers nicht das gesamte Projekt neu geschrieben werden muss.

`publicMaps/{zooId}` ist ein bewusst kleines, öffentlich lesbares Manifest ohne Mitglieder-, Entwurfs- oder Abrechnungsdaten. Die Publish- beziehungsweise Rollback-Funktion aktualisiert diesen Datensatz gemeinsam mit dem internen Veröffentlichungszeiger. So muss der öffentliche Client weder auf das private Zoo-Dokument zugreifen noch aus einer Liste von Versionen erraten, welche Version aktiv ist.

Mitgliedschaften und Zoo-Rollen liegen in `members/{userId}`. Custom Claims werden nur für kleine globale Berechtigungen wie `platformAdmin` verwendet, nicht als vollständige Liste aller Zoo-Mitgliedschaften.

`draftRevision` wird bei gespeicherten Änderungen erhöht. Der Veröffentlichungsvorgang erhält die erwartete Revision und bricht ab, wenn während der Veröffentlichung eine neuere Änderung gespeichert wurde.

### Storage

```text
zoos/{zooId}/draft-assets/{assetId}/{fileName}

zoos/{zooId}/published/{version}/published-map.json
zoos/{zooId}/published/{version}/assets/{assetId}/{fileName}
```

Entwurfsmedien sind privat. Veröffentlichte Dateien sind unveränderlich. Eine neue Version verwendet einen neuen Pfad; vorhandene Dateien werden nicht überschrieben.

## Speichern im Editor

- Textänderungen werden mit Debounce gespeichert.
- Markerpositionen werden nicht bei jedem `mousemove` geschrieben.
- Während des Ziehens bleibt die Position im lokalen Zustand.
- Die persistente Speicherung erfolgt nach `dragend`.
- Normalisierte Koordinaten `x` und `y` im Bereich `0…1` bleiben der öffentliche Vertrag.
- Die frei wählbare Karten-Hintergrundfarbe wird im Entwurf gespeichert und als `background.color` an ZooWeb veröffentlicht.
- Jede Kategorie veröffentlicht ihren Markierungsstil über `markerStyle` (`image`, `circle` oder `pin`), ihre relative Symbolgröße über `iconScale` (0,5 bis 2,0), die Bildgröße innerhalb des Symbols über `iconContentScale` (0,5 bis 1,5), den zentrierten Bildmaskenradius über `imageMaskRadius` (0 bis 100 Prozent), den Symbolhintergrund über `iconBackgroundColor`, die vollständige Einfärbung mit der Kategorienfarbe über `colorizeIcon`, ihre optionale Kontur über `outlineEnabled`, `outlineWidth` und `outlineColor` sowie den Schatten über `shadowEnabled`, `shadowBlur`, `shadowOpacity` und `shadowColor`; ein Punkt kann die Kategorienfarbe optional über `colorOverride` überschreiben.
- Seltene Abweichungen eines einzelnen Punkts werden als partielles Objekt `markerOverrides` veröffentlicht. Nur durch ein Override-Kontrollkästchen aktivierte Felder werden übertragen; alle fehlenden Felder erbt ZooWeb weiterhin aus der Kategorie.
- Vor dem Speichern wird die aktuelle `draftRevision` geprüft.
- Konflikte zwischen mehreren Administratoren werden angezeigt, statt fremde Änderungen still zu überschreiben.

## Veröffentlichungsvorgang

Die Schaltfläche „Veröffentlichen“ ruft eine Callable Cloud Function auf:

```ts
type PublishRequest = {
  zooId: string
  expectedDraftRevision: number
}
```

Die Funktion:

1. prüft Firebase Authentication, App Check, Zoo-Mitgliedschaft, Rolle und aktives Abonnement;
2. liest einen konsistenten Entwurf;
3. prüft `expectedDraftRevision`;
4. validiert Projekt, Kategorien, Objekte, Koordinaten und Asset-Verweise;
5. bestimmt die nächste Versionsnummer;
6. kopiert nur verwendete Medien in den versionierten öffentlichen Pfad;
7. erzeugt `PublishedZooMap` über dieselben Regeln wie `buildPublishedSnapshot`;
8. validiert das Ergebnis mit `PublishedZooMapSchema`;
9. speichert `published-map.json` mit Prüfsumme;
10. legt den Publication-Datensatz an;
11. aktualisiert den internen Veröffentlichungszeiger und `publicMaps/{zooId}` atomar;
12. gibt Version und Veröffentlichungszeitpunkt an die Admin-Oberfläche zurück.

Die Admin-Oberfläche darf veröffentlichte Dokumente nicht direkt zusammensetzen oder den aktiven Zeiger selbst verändern. Service-Account-Schlüssel befinden sich ausschließlich in der serverseitigen Umgebung.

## Manifest

Der öffentliche Client benötigt nur ein kleines Manifest:

```json
{
  "zooId": "zoo-osnabrueck",
  "projectId": "zoo-osnabrueck",
  "schemaVersion": 1,
  "version": 42,
  "publishedAt": "2026-07-24T18:30:00.000Z",
  "contractUrl": "https://…/published/zoo-osnabrueck/42/published-map.json",
  "sha256": "…"
}
```

Das Manifest liegt in `publicMaps/{zooId}` oder wird in gleicher Form von einer kleinen öffentlichen API ausgeliefert. Das interne Zoo-Dokument mit Mitgliedschafts- und Abrechnungsbezug bleibt privat. Der veröffentlichte Vertrag und seine Assets liegen in Storage.

`projectId` bleibt aus Kompatibilitätsgründen Bestandteil von `PublishedZooMap` und entspricht zunächst dem `zooId`. Bei einer späteren Unterstützung mehrerer Karten pro Zoo wird die Struktur zu `zoos/{zooId}/maps/{mapId}` erweitert.

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

## Hosting und Domains

ZooBroo betreibt beide Anwendungen standardmäßig selbst:

```text
admin.zoobroo.com
maps.zoobroo.com/{zooSlug}
```

Die Admin-Anwendung ist eine gemeinsame Anwendung. Nach der Anmeldung sieht ein Benutzer ausschließlich Zoos, für die unter `zoos/{zooId}/members/{userId}` eine Mitgliedschaft besteht.

Auch der öffentliche Karten-Client wird nur einmal bereitgestellt. Der aktive Mandant wird über einen stabilen Pfad, eine ZooBroo-Subdomain oder `domains/{hostname}` ermittelt:

```text
maps.zoobroo.com/osnabrueck
osnabrueck.maps.zoobroo.com
map.zoo-osnabrueck.de
```

Ein Zoo kann die Karte verlinken, per `iframe` einbetten oder eine eigene Domain auf den zentralen Client zeigen lassen. Der Zoo muss Admin und Karten-Client nicht selbst hosten. Dadurch erhalten alle Kunden Fehlerkorrekturen, Sicherheitsupdates und neue Funktionen aus derselben Deployment-Pipeline.

Ein eigenes Firebase-Projekt oder ein vollständig kundeneigenes Deployment wird nur als Enterprise-Option angeboten, wenn rechtliche, organisatorische oder vertragliche Anforderungen eine separate Infrastruktur verlangen.

Firebase Hosting Multisites wird für getrennte Anwendungen wie Admin und öffentliche Karte verwendet, nicht als ein Hosting-Site pro Zoo. Für eine große Zahl kundeneigener Domains muss vor der Skalierung geprüft werden, ob Firebase Hosting operativ ausreicht oder ob Domain-Routing über Cloud Run und einen vorgeschalteten Load Balancer beziehungsweise spezialisierten Domain-Dienst sinnvoller ist.

## Firebase-Projekte und Umgebungen

Empfohlene Projektgrenzen:

```text
zoobroo-dev
zoobroo-staging
zoobroo-production
```

Produktionsdaten werden niemals für Entwicklung oder automatisierte Tests verwendet. Regeln, Indizes, Functions, Storage-Konfiguration und Hosting werden aus demselben Repository in die jeweilige Umgebung deployt.

Ein Firebase-Projekt pro Zoo ist im Standardtarif ausdrücklich nicht vorgesehen, weil dies Deployments, Indizes, Security Rules, Migrationen, Monitoring, Backups, Kostenkontrolle und Support für jeden Kunden vervielfachen würde.

## Abonnements und Berechtigungen

Stripe oder Paddle verwaltet Kunden, Tarife, Rechnungen und wiederkehrende Zahlungen. Firebase speichert nur den serverseitig bestätigten Produktstatus:

```text
zoos/{zooId}
  subscriptionStatus: trialing | active | past_due | suspended | canceled
  plan: starter | professional | enterprise
  subscriptionProvider
  subscriptionCustomerId
  subscriptionCurrentPeriodEnd
```

Ein HTTPS-Webhook in Cloud Functions oder Cloud Run:

1. prüft die Signatur des Zahlungsanbieters;
2. ordnet das Kundenkonto dem `zooId` zu;
3. verarbeitet wiederholte Events idempotent;
4. aktualisiert den Abonnementstatus;
5. schreibt einen Audit-Eintrag.

Der Browser darf `subscriptionStatus`, `plan` oder Provider-IDs niemals selbst verändern. Bei `past_due`, `suspended` oder `canceled` bleibt die zuletzt veröffentlichte Karte zunächst verfügbar, während Bearbeitung oder neue Veröffentlichungen je nach Tarif eingeschränkt werden. Das konkrete Verhalten und eine Kulanzfrist werden als Produktregeln konfiguriert, nicht in der UI fest codiert.

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
- Jeder Zugriff auf Entwürfe und Entwurfsmedien prüft `zooId`, Mitgliedschaft und Rolle.
- `owner` und `admin` verwalten Mitglieder und Einstellungen, `editor` bearbeitet Inhalte, `viewer` liest den Entwurf.
- `platformAdmin` ist eine globale, ausschließlich serverseitig gesetzte Custom Claim.
- Zoo-Mitgliedschaften werden in Firestore gespeichert und nicht vollständig in Custom Claims dupliziert.
- Nur die serverseitige Publish-Funktion darf öffentliche Versionen und den aktiven Zeiger anlegen.
- Öffentliche Nutzer dürfen ausschließlich `publicMaps`, Domain-Zuordnungen und unveränderliche veröffentlichte Daten lesen.
- Upload-Regeln prüfen Dateigröße, MIME-Typ und Pfad.
- Storage Rules prüfen dieselbe Mandantenzugehörigkeit wie Firestore Rules.
- Zahlungsstatus und Rollenänderungen aus externen Systemen werden nur von vertrauenswürdigem Backend-Code geschrieben.
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

1. Firebase-Projekte für Development, Staging und Production definieren; zunächst Development und Emulator Suite einrichten.
2. Multi-Tenant-Datenmodell mit `zoos/{zooId}`, Mitgliedschaften, Rollen und Domain-Zuordnung implementieren.
3. Firebase Authentication, Einladungen und Zoo-Auswahl in der gemeinsamen Admin-Anwendung implementieren.
4. Firestore- und Storage-Regeln für Mandantenisolation samt automatisierten Emulator-Tests hinzufügen.
5. `FirebaseContentRepository` und `FirebaseAssetRepository` mit verpflichtendem `zooId` implementieren.
6. Umschaltung über den Composition Root einführen; lokales Backend zunächst behalten.
7. Migration beziehungsweise Import des lokalen Entwurfs in einen ausgewählten Zoo implementieren.
8. Callable Publish Function, Abonnementprüfung und versionierte Storage-Pfade implementieren.
9. `FirebasePublishRepository` an die Serverfunktion anbinden.
10. Gemeinsamen öffentlichen Loader für Zoo-Auflösung, Manifest und `PublishedZooMap` implementieren.
11. Zentrales Hosting für Admin und öffentliche Karte sowie Pfad- und Domain-Routing einrichten.
12. Cache, Fallback auf letzte gültige Version und optionalen Realtime-Listener ergänzen.
13. Stripe- oder Paddle-Webhooks, Tarifstatus und serverseitige Berechtigungsprüfung implementieren.
14. Rollback, Audit-Log, Backups, Monitoring und Kostenwarnungen hinzufügen.
15. Staging-Abnahme mit mindestens zwei Test-Zoos durchführen.
16. Erst nach Abnahme das lokale Backend als Standard ablösen.

## Wann Firebase neu bewertet werden sollte

Firebase ist für die erste produktive Multi-Tenant-Version die bevorzugte Lösung. Mehrere Mandanten und Abrechnung sind bereits Bestandteil der Zielarchitektur und allein kein Grund für getrennte Firebase-Projekte.

PostgreSQL, ein eigener API-Dienst oder zusätzliche Google-Cloud-Komponenten sollten neu bewertet werden, wenn komplexe mandantenübergreifende Berichte, stark relationale Geschäftsprozesse, sehr große Inhaltsmengen, hunderte kundeneigene Domains, besondere Datenresidenz oder Enterprise-Anforderungen an kundeneigene Infrastruktur hinzukommen.

Ein separates Firebase-Projekt pro Zoo bleibt eine Enterprise-Ausnahme. Es ist keine Voraussetzung für sichere Mandantenisolation im Standard-SaaS.

## Offizielle Referenzen

- [Firestore Realtime Listener](https://firebase.google.com/docs/firestore/query-data/listen)
- [Firestore Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore Limits](https://firebase.google.com/docs/firestore/quotas)
- [Callable Cloud Functions](https://firebase.google.com/docs/functions/callable)
- [Cloud Storage Metadata und Cache-Control](https://firebase.google.com/docs/storage/web/file-metadata)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Firestore Security Rules Conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Firestore-Datenstruktur](https://firebase.google.com/docs/firestore/manage-data/structure-data)
- [Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase App Check](https://firebase.google.com/docs/app-check/enable-enforcement)
- [Firebase Local Emulator Suite](https://firebase.google.com/docs/rules/emulator-setup)
- [Firebase Hosting Multisites](https://firebase.google.com/docs/hosting/multisites)
- [Firebase Hosting Custom Domains](https://firebase.google.com/docs/hosting/custom-domain)
- [Firebase Hosting Cache-Verhalten](https://firebase.google.com/docs/hosting/manage-cache)
- [Firebase Extensions und Stripe](https://firebase.google.com/products/extensions)
