import { Copy, ImagePlus, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { MapCategory, MapFact, MapItem } from '../domain/models'
import { CategoryIcon } from './CategoryIcon'
import { ItemMarkerOverrides } from './ItemMarkerOverrides'

interface InspectorPanelProps {
  item: MapItem | null
  categories: MapCategory[]
  assetUrls: Record<string, string>
  onUpdate: (id: string, patch: Partial<MapItem>) => void
  onDuplicate: () => void
  onDelete: () => void
  onUpload: (file: File, field: 'imageAssetId' | 'iconAssetId') => void
  onChooseAsset: (field: 'imageAssetId' | 'iconAssetId') => void
  onDeselect: () => void
}

function TextField({ label, value, placeholder, multiline, onCommit }: { label: string; value: string; placeholder?: string; multiline?: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => draft !== value && onCommit(draft)
  return <label className="field"><span>{label}</span>{multiline
    ? <textarea value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} onBlur={commit} rows={4} />
    : <input value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} />}</label>
}

export function InspectorPanel({ item, categories, assetUrls, onUpdate, onDuplicate, onDelete, onUpload, onChooseAsset, onDeselect }: InspectorPanelProps) {
  if (!item) {
    return <aside className="sidebar inspector empty-inspector" aria-label="Inspektor"><div className="inspector-placeholder"><span className="placeholder-marker"><span /></span><h2>Kategorie oder Punkt auswählen</h2><p>Klicken Sie auf eine Kategorie oder einen Punkt, um die Einstellungen anzuzeigen.</p></div></aside>
  }
  const category = categories.find((entry) => entry.id === item.categoryId)
  const imageUrl = item.imageAssetId ? assetUrls[item.imageAssetId] : undefined
  const iconUrl = item.iconAssetId ? assetUrls[item.iconAssetId] : undefined

  const updateFact = (factId: string, patch: Partial<MapFact>) => onUpdate(item.id, { facts: item.facts.map((fact) => fact.id === factId ? { ...fact, ...patch } : fact) })
  const removeFact = (factId: string) => onUpdate(item.id, { facts: item.facts.filter((fact) => fact.id !== factId) })
  const addFact = () => onUpdate(item.id, { facts: [...item.facts, { id: crypto.randomUUID(), label: 'Neue Information', value: '' }] })

  return (
    <aside className="sidebar inspector" aria-label="Objektinspektor">
      <div className="inspector-titlebar">
        <div className="inspector-avatar" style={{ color: category?.color, background: `${category?.color ?? '#50796a'}18` }}>
          {iconUrl ? <img src={iconUrl} alt="" /> : <CategoryIcon type={item.type} size={19} />}
        </div>
        <div><span className="eyebrow">Inspektor</span><h2>{item.title || 'Ohne Namen'}</h2></div>
        <button className="icon-button" title="Auswahl aufheben" aria-label="Auswahl aufheben" onClick={onDeselect}><X size={17} /></button>
      </div>
      <div className="inspector-scroll">
        <section className="inspector-section">
          <h3>Allgemein</h3>
          <TextField label="Name" value={item.title} onCommit={(title) => onUpdate(item.id, { title })} />
          <label className="field"><span>Kategorie</span><select value={item.categoryId} onChange={(event) => onUpdate(item.id, { categoryId: event.target.value, type: categories.find((entry) => entry.id === event.target.value)?.type ?? item.type })}>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
          <TextField label="Untertitel" value={item.subtitle} placeholder="Kurze Erläuterung" onCommit={(subtitle) => onUpdate(item.id, { subtitle })} />
          <TextField label="Beschreibung" value={item.description} placeholder="Beschreibung des Objekts für Besucher" multiline onCommit={(description) => onUpdate(item.id, { description })} />
        </section>

        <section className="inspector-section">
          <h3>Medien</h3>
          <div className={`photo-dropzone ${imageUrl ? 'has-image' : ''}`} style={imageUrl ? { backgroundImage: `linear-gradient(180deg, transparent 35%, rgba(12,24,20,.68)), url(${imageUrl})` } : undefined}>
            {!imageUrl && <><ImagePlus size={23} /><strong>Titelbild</strong><span>PNG, JPG oder WebP</span></>}
            <div className="media-actions"><label className="mini-button"><Upload size={14} />{imageUrl ? 'Ersetzen' : 'Hochladen'}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], 'imageAssetId')} /></label><button className="mini-button" onClick={() => onChooseAsset('imageAssetId')}>Auswählen</button></div>
          </div>
          <div className="icon-picker-row"><div className="icon-preview">{iconUrl ? <img src={iconUrl} alt="" /> : <CategoryIcon type={item.type} size={19} />}</div><div><strong>Markierungssymbol</strong><span>{iconUrl ? 'Benutzerdefiniert' : 'Aus der Kategorie'}</span></div><button className="mini-button" onClick={() => onChooseAsset('iconAssetId')}>Auswählen</button></div>
          {category && <ItemMarkerOverrides item={item} category={category} onUpdate={(patch) => onUpdate(item.id, patch)} />}
        </section>

        <section className="inspector-section facts-section">
          <div className="section-heading-inline"><h3>Informationen</h3><button className="text-button" onClick={addFact}><Plus size={14} />Hinzufügen</button></div>
          <div className="facts-list">
            {item.facts.map((fact) => <div className="fact-row" key={fact.id}><div><input aria-label="Bezeichnung der Information" value={fact.label} onChange={(event) => updateFact(fact.id, { label: event.target.value })} placeholder="Zum Beispiel Gewicht"/><input aria-label="Wert der Information" value={fact.value} onChange={(event) => updateFact(fact.id, { value: event.target.value })} placeholder="Wert"/></div><button className="icon-button subtle" onClick={() => removeFact(fact.id)} aria-label="Information löschen"><X size={14}/></button></div>)}
            {item.facts.length === 0 && <p className="inline-empty">Fügen Sie Kurzinformationen für die Objektkarte hinzu.</p>}
          </div>
        </section>

        <section className="inspector-section visibility-section">
          <label className="switch-row"><span><strong>Auf der Karte anzeigen</strong><small>Das Objekt ist nach der Veröffentlichung für Besucher sichtbar</small></span><input type="checkbox" checked={item.visible} onChange={(event) => onUpdate(item.id, { visible: event.target.checked })}/><i /></label>
          <div className="position-readout"><span>Position</span><code>x {item.position.x.toFixed(3)}</code><code>y {item.position.y.toFixed(3)}</code></div>
        </section>
      </div>
      <div className="inspector-actions"><button className="button ghost" onClick={onDuplicate}><Copy size={15}/>Duplizieren</button><button className="button danger-ghost" onClick={onDelete}><Trash2 size={15}/>Löschen</button></div>
    </aside>
  )
}
