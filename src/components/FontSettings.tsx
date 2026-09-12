import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { DEFAULT_TYPOGRAPHY, FONT_PRESETS, type Typography } from '../domain/typography'

export function FontSettings({ value = DEFAULT_TYPOGRAPHY, onChange, onUpload, names = {}, fontFamily, title = 'Schriftart', description = 'Für alle Texte der Besucheransicht. Beschriftungen im Kartenbild bleiben unverändert.' }: {
  title?: string
  description?: string
  fontFamily?: string
  value?: Typography
  onChange: (value: Typography) => void
  onUpload?: (file: File) => Promise<string>
  names?: Record<string, string>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <div className="map-global-settings__section">
    <strong>{title}</strong>
    <p>{description}</p>
    <label className="field"><span>Schriftfamilie</span><select disabled={busy} value={value.preset} onChange={event => onChange({ ...value, preset: event.target.value as Typography['preset'] })}>
      {Object.entries(FONT_PRESETS).map(([id, font]) => <option key={id} value={id}>{font.label}</option>)}
    </select></label>
    {value.preset === 'custom' && <>
      <p>WOFF2 oder TTF · maximal 2 MB pro Datei. Bitte eine für die Webnutzung lizenzierte Schrift verwenden.</p>
      {(['regularAssetId', 'boldAssetId'] as const).filter(slot => slot === 'regularAssetId' || !value.variable).map(slot => <label className="field" key={slot}>
        <span>{slot === 'regularAssetId' ? 'Normal / Variable Schrift' : 'Fett (optional)'}</span>
        {value[slot] && <small>{names[value[slot]] ?? 'Gespeicherte Schrift'}</small>}
        <input type="file" accept=".woff2,.ttf,font/woff2,font/ttf" disabled={busy || !onUpload} onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file || !onUpload) return
          setBusy(true); setError('')
          try { const id = await onUpload(file); onChange({ ...value, [slot]: id }) }
          catch (cause) { setError(cause instanceof Error ? cause.message : 'Schrift konnte nicht geladen werden.') }
          finally { setBusy(false) }
        }} />
        {value[slot] && <button type="button" disabled={busy} onClick={() => onChange({ ...value, [slot]: null })}>Entfernen</button>}
      </label>)}
      <label><input type="checkbox" checked={value.variable} disabled={busy} onChange={event => onChange({ ...value, variable: event.target.checked })} /> Variable Schrift (mehrere Schriftstärken)</label>
      {!value.regularAssetId && <p>Bis zum Upload wird die Standardschrift verwendet.</p>}
    </>}
    {busy && <p role="status">Schrift wird geprüft und gespeichert …</p>}
    {error && <p role="alert">{error}</p>}
    <div className="font-settings__sample" style={{ fontFamily }}>Äpfel, Löwen &amp; große Abenteuer<br /><strong>Zoo entdecken · 0123456789</strong></div>
    <button className="font-settings__reset" type="button" disabled={busy} onClick={() => onChange(DEFAULT_TYPOGRAPHY)}>
      <RotateCcw size={15} strokeWidth={1.8} aria-hidden="true" />
      <span>Standardschrift wiederherstellen</span>
    </button>
  </div>
}
