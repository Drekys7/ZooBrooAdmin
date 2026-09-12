# Global interface accent

`mapSettings.accentColor` is an optional #RRGGBB color. Legacy projects fall back to #2F7D59.
Global settings → Darstellung → Akzentfarbe changes it through the existing settings command,
with undo/redo, autosave, JSON transfer and inclusion in the published map settings.

The map interface derives solid, RGB, readable text and on-accent text tokens. Group counts,
add-to-group badges, button hovers, language controls and translucent selection backgrounds,
category button text, event badges and panels, and visitor card interface accents use these tokens.
Category/item marker artwork colors and separately configured zone labels remain content styling.

The per-group count color control is removed. Legacy `groupBadgeColor` values remain readable in
draft/import data but have no visual effect and are not emitted in new published snapshots.
The public consumer must use the shared accent for these controls and ignore old badge overrides.
This repository updates the admin map/phone preview and published contract; public deployment
and consumer integration are separate.
