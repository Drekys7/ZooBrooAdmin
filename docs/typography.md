# Visitor typography

Global settings include Manrope, system, Arial, Georgia and custom WOFF2 or TTF fonts.
System/Arial/Georgia use browser font stacks and can differ between operating systems.
Custom files are validated with the browser font decoder before storage (2 MiB maximum per file).
Regular plus optional bold files, or a variable regular file with weights 100–900, are supported.
When no bold face exists, the preview permits synthesized bold. Font loading failure falls back to Manrope.

Draft `mapSettings.typography` stores `preset`, `regularAssetId`, `boldAssetId`, `variable`.
Files use the existing immutable asset repository with kind `font`. Selected files cannot be deleted.
JSON exports additionally include a `fontFiles` array containing the referenced font bytes as data URLs with the matching MIME type.
Import validates these files and assigns fresh asset IDs to avoid collisions. Older projects without
typography remain readable and use Manrope. The existing image-export behavior is unchanged.

Published snapshots contain optional `mapSettings.typography`:

```json
{
  "preset": "custom",
  "regular": { "assetId": "font-regular-id", "url": "assets/font-regular-id" },
  "bold": null,
  "variable": true
}
```

The existing publication resolver also resolves the font URLs. Local publication still stores a
snapshot; it does not upload any files to a web server. During Firebase integration, include
`typography.regular` and `typography.bold` when collecting snapshot assets and upload fonts before
activating a published version. Use immutable URLs and preserve files referenced by older versions.
Do not put base64 font data into Firestore project documents; `fontFiles` belongs only to file export.

The separate public ZooWeb consumer must accept this optional field, load its regular/bold URLs
using FontFace or @font-face and apply the selected family to visitor text, including Leaflet overlays.
Use MIME type `font/woff2` for WOFF2 or `font/ttf` for TTF, allow font loading in CSP, and configure CORS if hosted on another origin.
Missing settings or failed downloads must retain a readable fallback. Embedded labels in map images
are not affected. This repository implements the admin, preview and published contract; it does not
deploy or modify the separate public consumer.
