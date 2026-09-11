import { Copy, ImagePlus, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { hasTranslationValue } from '../domain/localization'
import { itemIconAssetId, itemIconColor } from '../domain/groups'
import type { MapCategory, MapFact, MapItem } from '../domain/models'
import { CategoryIcon, getCategoryIconUrl } from './CategoryIcon'
import { ItemMarkerOverrides } from './ItemMarkerOverrides'

export interface InspectorPanelProps {
  item: MapItem | null
  categories: MapCategory[]
  assetUrls: Record<string, string>
  onUpdate: (id: string, patch: Partial<MapItem>) => void
  onDuplicate: () => void
  onDelete: () => void
  onUpload: (files: File[], field: 'imageGallery' | 'iconAssetId', itemId?: string) => void
  onChooseAsset: (field: 'imageGallery' | 'iconAssetId', itemId?: string) => void
  embedded?: boolean
  member?: boolean
  onDeselect: () => void
  contentLocale?: string
  defaultLocale?: string
}

function TextField({ label, value, placeholder, fallback, missing = false, multiline, onCommit }: { label: string; value: string; placeholder?: string; fallback?: string; missing?: boolean; multiline?: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => draft !== value && onCommit(draft)
  const inputPlaceholder = missing ? fallback : placeholder
  return <div className={`field localized-field${missing ? ' is-missing' : ''}`}><span><span>{label}</span>{missing && <><em>Übersetzung fehlt</em>{fallback && <button type="button" onClick={() => { setDraft(fallback); onCommit(fallback) }}>Hauptsprache übernehmen</button>}</>}</span>{multiline
    ? <textarea aria-label={label} value={draft} placeholder={inputPlaceholder} onChange={(event) => setDraft(event.target.value)} onBlur={commit} rows={4} />
    : <input aria-label={label} value={draft} placeholder={inputPlaceholder} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} />}</div>
}

export function InspectorPanel({ item, categories, assetUrls, onUpdate, onDuplicate, onDelete, onUpload, onChooseAsset, onDeselect, embedded = false, member = false, contentLocale = 'de', defaultLocale = 'de' }: InspectorPanelProps) {
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null)
  if (!item) {
    return <aside className="sidebar inspector empty-inspector" aria-label="Inspektor"><div className="inspector-placeholder"><span className="placeholder-marker"><span /></span><h2>Kategorie oder Punkt auswählen</h2><p>Klicken Sie auf eine Kategorie oder einen Punkt, um die Einstellungen anzuzeigen.</p></div></aside>
  }
  const category = categories.find((entry) => entry.id === item.categoryId)
  const imageAssetIds = item.imageAssetIds?.length ? item.imageAssetIds : item.imageAssetId ? [item.imageAssetId] : []
  const resolvedIconId = itemIconAssetId(item, category)
  const iconUrl = resolvedIconId ? assetUrls[resolvedIconId] : undefined
  const translation = item.translations?.[contentLocale]
  const localizedKeys: Array<'title' | 'subtitle' | 'description'> = item.type === 'animal' ? ['title', 'description'] : ['title', 'subtitle', 'description']
  const translatedFieldCount = contentLocale === defaultLocale ? localizedKeys.length : localizedKeys.filter((key) => hasTranslationValue(translation, key)).length
  const translatedValue = (key: typeof localizedKeys[number]) => contentLocale === defaultLocale ? item[key] : hasTranslationValue(translation, key) ? translation?.[key] ?? '' : ''
  const isMissing = (key: typeof localizedKeys[number]) => contentLocale !== defaultLocale && !hasTranslationValue(translation, key)

  const updateFact = (factId: string, patch: Partial<MapFact>) => onUpdate(item.id, { facts: item.facts.map((fact) => fact.id === factId ? { ...fact, ...patch } : fact) })
  const removeFact = (factId: string) => onUpdate(item.id, { facts: item.facts.filter((fact) => fact.id !== factId) })
  const addFact = () => onUpdate(item.id, { facts: [...item.facts, { id: crypto.randomUUID(), label: 'Neue Information', value: '' }] })
  const setImages = (ids: string[]) => onUpdate(item.id, { imageAssetId: ids[0] ?? null, imageAssetIds: ids })
  const removeImage = (index: number) => setImages(imageAssetIds.filter((_, candidate) => candidate !== index))
  const moveImage = (index: number, target: number) => {
    if (index === target || index < 0 || target < 0 || index >= imageAssetIds.length || target >= imageAssetIds.length) return
    const ids = [...imageAssetIds]
    const [moved] = ids.splice(index, 1)
    ids.splice(target, 0, moved)
    setImages(ids)
  }

  return (
    <aside className={embedded ? 'inspector-embedded' : 'sidebar inspector'} aria-label="Objektinspektor">
      {!embedded && <div className="inspector-titlebar">
        <div className="inspector-avatar" style={{ color: category?.color, background: `${category?.color ?? '#50796a'}18` }}>
          {iconUrl ? <img src={iconUrl} alt="" /> : <CategoryIcon type={item.type} size={19} />}
        </div>
        <div><span className="eyebrow">Inspektor</span><h2>{item.title || 'Ohne Namen'}</h2></div>
        <button className="icon-button" title="Auswahl aufheben" aria-label="Auswahl aufheben" onClick={onDeselect}><X size={17} /></button>
      </div>}
      <div className="inspector-scroll">
        <section className="inspector-section">
          <h3>Allgemein</h3>
          <div className={`translation-status${contentLocale === defaultLocale || translatedFieldCount === localizedKeys.length ? ' is-complete' : ''}`}><strong>{contentLocale.toUpperCase()}</strong><span>{contentLocale === defaultLocale ? 'Hauptsprache' : translatedFieldCount === localizedKeys.length ? 'Übersetzung vollständig' : `${translatedFieldCount} von ${localizedKeys.length} Textfeldern übersetzt`}</span></div>
          <TextField label="Name" value={translatedValue('title')} fallback={item.title} missing={isMissing('title')} onCommit={(title) => onUpdate(item.id, { title })} />
          {!member && <label className="field"><span>Kategorie</span><select value={item.categoryId} onChange={(event) => onUpdate(item.id, { categoryId: event.target.value, type: categories.find((entry) => entry.id === event.target.value)?.type ?? item.type })}>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}
          {item.type !== 'animal' && <TextField label="Untertitel" value={translatedValue('subtitle')} fallback={item.subtitle} missing={isMissing('subtitle')} placeholder="Kurze Erläuterung" onCommit={(subtitle) => onUpdate(item.id, { subtitle })} />}
          <TextField label="Beschreibung" value={translatedValue('description')} fallback={item.description} missing={isMissing('description')} placeholder="Beschreibung des Objekts für Besucher" multiline onCommit={(description) => onUpdate(item.id, { description })} />
        </section>

        <section className="inspector-section">
          <h3>Medien</h3>
          <div className="photo-gallery-editor">
            <div className="photo-gallery-heading"><strong>Fotos</strong><span>{imageAssetIds.length ? `${imageAssetIds.length} hinzugefügt · das erste ist das Titelbild` : 'Das erste Foto wird in der kleinen Karte gezeigt'}</span></div>
            {imageAssetIds.length > 0 && <div className="photo-gallery-list">
              {imageAssetIds.map((assetId, index) => <div
                className={`photo-gallery-item${draggedImageIndex === index ? ' is-dragging' : ''}`}
                draggable
                onDragStart={(event) => { setDraggedImageIndex(index); event.dataTransfer.effectAllowed = 'move' }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
                onDrop={(event) => { event.preventDefault(); if (draggedImageIndex !== null) moveImage(draggedImageIndex, index); setDraggedImageIndex(null) }}
                onDragEnd={() => setDraggedImageIndex(null)}
                aria-label={`Foto ${index + 1} verschieben`}
                key={`${assetId}-${index}`}
              >
                <div className="photo-gallery-thumb">{assetUrls[assetId] ? <img src={assetUrls[assetId]} alt={`Foto ${index + 1}`} /> : <ImagePlus size={20} />}{index === 0 && <span>Titelbild</span>}<button type="button" className="photo-gallery-remove" onClick={() => removeImage(index)} aria-label="Foto entfernen"><X size={14}/></button></div>
              </div>)}
            </div>}
            <div className={`photo-dropzone compact ${imageAssetIds.length ? 'has-gallery' : ''}`}>
              {!imageAssetIds.length && <><ImagePlus size={23} /><strong>Fotos hinzufügen</strong><span>PNG, JPG oder WebP · Mehrfachauswahl möglich</span></>}
              <div className="media-actions"><label className="mini-button"><Upload size={14} />Hochladen<input hidden multiple type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) onUpload(files, 'imageGallery', item.id); event.currentTarget.value = '' }} /></label><button className="mini-button" onClick={() => onChooseAsset('imageGallery', item.id)}>Auswählen</button></div>
            </div>
          </div>
          <div className="icon-picker-row" role="group" aria-label="Markierungssymbol">
            <div className="icon-preview" style={{ color: itemIconColor(item, category) }}>{item.iconAssetId && iconUrl ? <img src={iconUrl} alt="Markierungssymbol" /> : <span role="img" aria-label="Markierungssymbol" className="icon-preview-default" style={{ backgroundColor: 'currentColor', maskImage: `url("${iconUrl ?? getCategoryIconUrl(item.type)}")`, WebkitMaskImage: `url("${iconUrl ?? getCategoryIconUrl(item.type)}")` }} />}</div>
            <div><strong>Markierungssymbol</strong><span>{item.iconAssetId ? 'Benutzerdefiniert' : 'Aus der Kategorie'}</span></div>
            <div className="icon-picker-actions">
            <label className="mini-button icon-upload" title="Symbol hochladen"><Upload size={14}/>Hochladen<input hidden type="file" aria-label="Symbol hochladen" accept="image/png,image/webp,image/svg+xml" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload([file], 'iconAssetId', item.id); event.currentTarget.value = '' }} /></label>
            <button className="mini-button" onClick={() => onChooseAsset('iconAssetId', item.id)}>Auswählen</button>
            {item.iconAssetId && <button className="icon-button" aria-label="Standardsymbol verwenden" title="Standardsymbol verwenden" onClick={() => onUpdate(item.id, { iconAssetId: null })}><X size={14}/></button>}
            </div>
          </div>
          {category && <ItemMarkerOverrides item={item} category={category} onUpdate={(patch) => onUpdate(item.id, patch)} />}
        </section>

        <section className="inspector-section facts-section">
          <div className="section-heading-inline"><h3>Informationen</h3><button className="text-button" onClick={addFact}><Plus size={14} />Hinzufügen</button></div>
          <div className="facts-list">
            {item.facts.map((fact) => {
              const factTranslation = fact.translations?.[contentLocale]
              const missingLabel = contentLocale !== defaultLocale && !hasTranslationValue(factTranslation, 'label')
              const missingValue = contentLocale !== defaultLocale && !hasTranslationValue(factTranslation, 'value')
              return <div className={`fact-row${missingLabel || missingValue ? ' has-missing-translation' : ''}`} key={fact.id}><div><input aria-label="Bezeichnung der Information" value={missingLabel ? '' : contentLocale === defaultLocale ? fact.label : factTranslation?.label ?? ''} onChange={(event) => updateFact(fact.id, { label: event.target.value })} placeholder={missingLabel ? fact.label : 'Zum Beispiel Gewicht'}/><input aria-label="Wert der Information" value={missingValue ? '' : contentLocale === defaultLocale ? fact.value : factTranslation?.value ?? ''} onChange={(event) => updateFact(fact.id, { value: event.target.value })} placeholder={missingValue ? fact.value : 'Wert'}/></div><button className="icon-button subtle" onClick={() => removeFact(fact.id)} aria-label="Information löschen"><X size={14}/></button></div>
            })}
            {item.facts.length === 0 && <p className="inline-empty">Fügen Sie Kurzinformationen für die Objektkarte hinzu.</p>}
          </div>
        </section>

        {!member && <section className="inspector-section visibility-section">
          <label className="switch-row"><span><strong>Auf der Karte anzeigen</strong><small>Das Objekt ist nach der Veröffentlichung für Besucher sichtbar</small></span><input type="checkbox" checked={item.visible} onChange={(event) => onUpdate(item.id, { visible: event.target.checked })}/><i /></label>
          <div className="position-readout"><span>Position</span><code>x {item.position.x.toFixed(3)}</code><code>y {item.position.y.toFixed(3)}</code></div>
        </section>}
      </div>
      {!embedded && <div className="inspector-actions"><button className="button ghost" onClick={onDuplicate}><Copy size={15}/>Duplizieren</button><button className="button danger-ghost" onClick={onDelete}><Trash2 size={15}/>Löschen</button></div>}
    </aside>
  )
}
