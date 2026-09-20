# Bilingual example zoo content

The 40 map cards describe the fictional Naturwelten Zoo. German is the default language; English is complete. Facility services, suggested visit durations, menus and event descriptions are illustrative content, not operational commitments by Zoo Osnabrück. Existing event dates and recurrence settings were retained.

Every card has an original description and exactly three translated facts. Generic animal icons have representative species assigned for this example collection. The camel is a one-humped dromedary; the white mountain goat is a mountain goat (Schneeziege); the penguin is a king penguin. Numerical conservation assessments are omitted.

Reference material consulted for natural-history checks:

- https://animals.sandiegozoo.org/animals/camel
- https://animals.sandiegozoo.org/animals/fennec-fox
- https://animals.sandiegozoo.org/animals/tapir
- https://animals.sandiegozoo.org/animals/capybara
- https://animals.sandiegozoo.org/animals/otter
- https://animals.sandiegozoo.org/animals/spotted-hyena
- https://animals.sandiegozoo.org/animals/giraffe
- https://animaldiversity.org/accounts/Oreamnos_americanus/

The canonical bilingual content is `src/domain/demo-map-copy.json`. The one-time local database update saves a recovery snapshot in `projectMigrations` before applying text. Subsequent visitor-content edits are preserved across reloads.
# Compact previews

Animal facts are Region, Lifespan and Weight. Their existing region, hourglass and weight icons appear only in the expanded view and editor, not the quick preview. Extra facts have been removed; descriptions remain unchanged. Facility cards also have three short DE/EN facts. The card can grow and wrap on narrow screens instead of clipping content. The one-time `migrateThreeFacts` update preserves the first three facts as edited by the user and saves a recovery snapshot before removing the rest.

`src/domain/compact-map-facts.json` is the compact-fact overlay; `scripts/prepare-compact-facts.mjs` applies it to the startup template. Run it after regenerating bilingual copy. The one-time `compact-facts-migration.ts` updates existing local projects and restores the four bundled fact icons without changing marker artwork or positions.

The demo weights are rounded adult ranges and ages are approximate possible lifespans, not median survival or the ages of particular zoo animals. Sex, population, subspecies and care conditions can change these values. Verify species-specific values with the institution before publishing a real zoo guide.

Additional reference examples: [Eurasian lynx (Animal Diversity Web)](https://animaldiversity.org/accounts/Lynx_lynx/), [Meerkat (Twycross Zoo)](https://twycrosszoo.org/explore/animals/meerkat/), [Camel (San Diego Zoo)](https://animals.sandiegozoo.org/animals/camel), [Capybara (San Diego Zoo)](https://animals.sandiegozoo.org/animals/capybara).
