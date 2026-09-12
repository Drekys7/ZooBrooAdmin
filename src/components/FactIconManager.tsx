import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { factIconChoices } from './FactIconPicker'

export function FactIconManager({ icons, assetUrls, onAdd, onRename, onDelete, onClose }: {
  icons: Array<{ id: string; label: string }>
  assetUrls: Record<string, string>
  onAdd: (file: File, name: string) => Promise<void>
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="modal fact-icon-manager" role="dialog" aria-modal="true" aria-labelledby="fact-icons-title" onKeyDown={event => { if (event.key === 'Escape' && !busy) onClose() }}>
      <header className="asset-header"><div><span className="eyebrow">Informationen</span><h2 id="fact-icons-title">Symbole verwalten</h2></div><button className="icon-button" aria-label="Schließen" disabled={busy} onClick={onClose}><X size={18}/></button></header>
      <div className="fact-icon-manager__content">
        <p>Diese Symbole stehen für alle Informationen zur Auswahl. Der Name erscheint im Auswahlmenü.</p>
        <div className="fact-icon-manager__list">
          {factIconChoices.map(({ id, label, Icon, file: builtinFile }) => <div className="fact-icon-manager__row" key={id}>
            {builtinFile ? <span className="fact-icon-picker__image" style={{ maskImage: `url("/zooweb/facts/${builtinFile}.png")` }}/> : <Icon size={19} strokeWidth={2}/>}<strong>{label}</strong><small>Standard</small>
          </div>)}
          {icons.map(icon => <div className="fact-icon-manager__row" key={icon.id}>
            <span className="fact-icon-picker__image" style={{ maskImage: `url(${JSON.stringify(assetUrls[icon.id])})` }}/>
            <input aria-label={`Name für ${icon.label}`} defaultValue={icon.label} key={icon.label} onBlur={event => { const label = event.target.value.trim(); if (label && label !== icon.label) onRename(icon.id, label); else event.target.value = icon.label }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}/>
            <button type="button" className="icon-button danger-ghost" aria-label={`${icon.label} löschen`} title="Symbol löschen · verwendete Informationen erhalten das Standardsymbol" disabled={busy} onClick={() => onDelete(icon.id)}><Trash2 size={16}/></button>
          </div>)}
        </div>
        <form onSubmit={async event => { event.preventDefault(); const form = event.currentTarget; if (!file || !name.trim() || busy) return; setBusy(true); setError(''); try { await onAdd(file, name.trim()); setName(''); setFile(null); form.reset(); } catch (error) { setError(error instanceof Error ? error.message : 'Symbol konnte nicht gespeichert werden.'); } finally { setBusy(false) } }}>
          <h3>Neues Symbol</h3>
          <label className="field"><span>Name</span><input required value={name} onChange={event => setName(event.target.value)} placeholder="Zum Beispiel Schutzstatus" disabled={busy}/></label>
          <label className="field"><span>Bild · PNG, WebP oder SVG</span><input required type="file" accept="image/png,image/webp,image/svg+xml" disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)}/></label>
          {error && <p role="alert">{error}</p>}
          <button className="button primary" disabled={busy || !name.trim() || !file}>{busy ? 'Wird gespeichert…' : 'Symbol hinzufügen'}</button>
        </form>
      </div>
    </section>
  </div>
}
