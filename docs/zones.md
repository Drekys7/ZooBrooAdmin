# Zone labels

The left sidebar separates Kartenpunkte and Zonen. In zone editing mode the map shows only
zone labels, irrespective of zoom or visitor visibility, and selected labels can be dragged.
In Kartenpunkte editing mode only point icons are shown at every zoom. Automatic layer
switching applies only to the visitor/phone preview, never the desktop editor.
Create by clicking Zone hinzufügen then a position inside the map. Duplicate, delete and
edit the selected name and visibility in the right inspector. Appearance is shared by all zones
and edited on the left. These changes use the existing settings command,
autosave and undo/redo history. Deleted labels can be restored with Undo.

All rectangular labels share text/background/border colors, font size and weight,
maximum width, border thickness, corner radius and horizontal/vertical padding. Border and
padding have nonzero minima. Dimensions are screen pixels, independent of zoom. Labels wrap
within their maximum width. The content language selector edits translated names; empty
translations fall back to the original title. Existing lettering embedded in the map image is
not hidden or modified.

The left Zonen sidebar → Zonen & Zoom slider controls the visitor layer switch. At or below the threshold, all
point markers are removed and visible zone labels appear. Above it, zones are removed and
point markers return. 100% means the map fitted to the current viewport; desktop and phone
use their existing fit padding. Empty, disabled or entirely hidden zone sets leave points visible.
The phone preview always uses zoom switching, including while editing a zone. Open point
cards close on entering the overview layer. Search zooms beyond the threshold where the
configured maximum permits it. A warning identifies thresholds at/above maximum zoom.

Zone typography is separate from visitor typography, shared by all zone names, and supports
the same presets, WOFF2 and TTF upload. `mapSettings.zones` contains enabled, threshold,
labels, optional shared appearance and optional typography. Legacy label style fields remain
readable; when shared appearance is absent, the first label's style is used for every label.
The next settings edit persists that common style so deleting the first label does not change it.
Publication always includes resolved shared appearance. This optional field preserves legacy project compatibility.
Font export/import, deletion reference checks and publication include both typography slots.

Published `mapSettings.zones` uses the same label data, but typography resolves regular/bold
asset IDs to `{ assetId, url }`, matching published visitor typography. During public ZooWeb
integration, implement this layer switch in the consumer, transfer referenced font assets and
retain versioned URLs. Local admin publication stores snapshots only; this change does not
deploy or modify the separate public website.
