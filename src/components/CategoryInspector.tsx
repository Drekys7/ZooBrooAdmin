import { Shapes, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  categoryIconScale,
  categoryIconContentScale,
  categoryIconBackgroundColor,
  categoryImageMaskRadius,
  categoryColorizeIcon,
  categoryMarkerStyle,
  categoryOutlineColor,
  categoryOutlineEnabled,
  categoryOutlineWidth,
  categoryShadowBlur,
  categoryShadowColor,
  categoryShadowEnabled,
  categoryShadowOpacity,
  type MapCategory,
  type MarkerStyle,
} from '../domain/models'

interface CategoryInspectorProps {
  categories: MapCategory[]
  category: MapCategory | null
  editAll: boolean
  assetUrls: Record<string, string>
  onUpdateCategory: (id: string, patch: Partial<MapCategory>) => void
  onUpdateAll: (patch: Partial<MapCategory>) => void
  onChooseIcon: () => void
  onDelete: () => void
  onDeselect: () => void
}

const styleLabels: Record<MarkerStyle, string> = {
  image: 'Nur Bild',
  circle: 'Bild im Kreis',
  pin: 'Pin',
}

function CategoryNameField({
  value,
  placeholder,
  onCommit,
}: {
  value: string
  placeholder?: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    const next = draft.trim()
    if (next && next !== value) onCommit(next)
  }
  return <label className="field"><span>Name</span><input value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} /></label>
}

function IconScaleField({
  value,
  mixed,
  onChange,
}: {
  value: number
  mixed: boolean
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    setDraft(value)
  }, [value])
  return (
    <label className="field category-scale-field">
      <span><span>Symbolgröße</span><strong>{mixed && draft === value ? 'Gemischt' : `${Math.round(draft * 100)}%`}</strong></span>
      <input
        type="range"
        min="0.5"
        max="2"
        step="0.05"
        value={draft}
        onChange={(event) => {
          const next = Number(event.target.value)
          setDraft(next)
          onChange(next)
        }}
        aria-label="Symbolgröße"
      />
      <small><span>50%</span><span>200%</span></small>
    </label>
  )
}

function OutlineWidthField({
  value,
  mixed,
  disabled,
  onChange,
}: {
  value: number
  mixed: boolean
  disabled: boolean
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    setDraft(value)
  }, [value])
  return (
    <label className={`field category-scale-field${disabled ? ' is-disabled' : ''}`}>
      <span><span>Konturstärke</span><strong>{mixed && draft === value ? 'Gemischt' : `${draft}px`}</strong></span>
      <input
        type="range"
        min="0.5"
        max="10"
        step="0.5"
        value={draft}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value)
          setDraft(next)
          onChange(next)
        }}
        aria-label="Konturstärke"
      />
      <small><span>0,5px</span><span>10px</span></small>
    </label>
  )
}

function IconContentScaleField({
  value,
  mixed,
  onChange,
}: {
  value: number
  mixed: boolean
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <label className="field category-scale-field">
      <span><span>Bildgröße im Symbol</span><strong>{mixed && draft === value ? 'Gemischt' : `${Math.round(draft * 100)}%`}</strong></span>
      <input
        type="range"
        min="0.5"
        max="1.5"
        step="0.05"
        value={draft}
        onChange={(event) => {
          const next = Number(event.target.value)
          setDraft(next)
          onChange(next)
        }}
        aria-label="Bildgröße im Symbol"
      />
      <small><span>50%</span><span>150%</span></small>
    </label>
  )
}

function ImageMaskRadiusField({
  value,
  mixed,
  onChange,
}: {
  value: number
  mixed: boolean
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <label className="field category-scale-field">
      <span><span>Maskenradius</span><strong>{mixed && draft === value ? 'Gemischt' : `${Math.round(draft)}%`}</strong></span>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={draft}
        onChange={(event) => {
          const next = Number(event.target.value)
          setDraft(next)
          onChange(next)
        }}
        aria-label="Maskenradius"
      />
      <small><span>0%</span><span>100%</span></small>
    </label>
  )
}

function ShadowRangeField({
  label,
  value,
  max,
  suffix,
  mixed,
  disabled,
  onChange,
}: {
  label: string
  value: number
  max: number
  suffix: string
  mixed: boolean
  disabled: boolean
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <label className={`field category-scale-field${disabled ? ' is-disabled' : ''}`}>
      <span><span>{label}</span><strong>{mixed && draft === value ? 'Gemischt' : `${Math.round(draft)}${suffix}`}</strong></span>
      <input
        type="range"
        min="0"
        max={max}
        step={suffix === '%' ? 5 : 1}
        value={draft}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value)
          setDraft(next)
          onChange(next)
        }}
        aria-label={label}
      />
      <small><span>0{suffix}</span><span>{max}{suffix}</span></small>
    </label>
  )
}

export function CategoryInspector({
  categories,
  category,
  editAll,
  assetUrls,
  onUpdateCategory,
  onUpdateAll,
  onChooseIcon,
  onDelete,
  onDeselect,
}: CategoryInspectorProps) {
  const selectedCategories = editAll ? categories : category ? [category] : []
  const commonName = selectedCategories.every((entry) => entry.name === selectedCategories[0]?.name) ? selectedCategories[0]?.name ?? '' : ''
  const commonColor = selectedCategories.every((entry) => entry.color === selectedCategories[0]?.color) ? selectedCategories[0]?.color ?? '#4F8F64' : null
  const iconsMatch = selectedCategories.every((entry) => entry.defaultIconAssetId === selectedCategories[0]?.defaultIconAssetId)
  const commonIconId = iconsMatch ? selectedCategories[0]?.defaultIconAssetId ?? null : null
  const commonStyle = selectedCategories.length > 0 && selectedCategories.every((entry) => categoryMarkerStyle(entry) === categoryMarkerStyle(selectedCategories[0]!))
    ? categoryMarkerStyle(selectedCategories[0]!)
    : ''
  const scalesMatch = selectedCategories.every((entry) => categoryIconScale(entry) === categoryIconScale(selectedCategories[0]!))
  const commonScale = scalesMatch && selectedCategories[0] ? categoryIconScale(selectedCategories[0]) : 1
  const contentScalesMatch = selectedCategories.every((entry) => categoryIconContentScale(entry) === categoryIconContentScale(selectedCategories[0]!))
  const commonContentScale = contentScalesMatch && selectedCategories[0] ? categoryIconContentScale(selectedCategories[0]) : 1
  const maskRadiiMatch = selectedCategories.every((entry) => categoryImageMaskRadius(entry) === categoryImageMaskRadius(selectedCategories[0]!))
  const commonMaskRadius = maskRadiiMatch && selectedCategories[0] ? categoryImageMaskRadius(selectedCategories[0]) : 100
  const backgroundColorsMatch = selectedCategories.every((entry) => categoryIconBackgroundColor(entry) === categoryIconBackgroundColor(selectedCategories[0]!))
  const commonBackgroundColor = backgroundColorsMatch && selectedCategories[0] ? categoryIconBackgroundColor(selectedCategories[0]) : '#FFFFFF'
  const colorizeIconsMatch = selectedCategories.every((entry) => categoryColorizeIcon(entry) === categoryColorizeIcon(selectedCategories[0]!))
  const commonColorizeIcon = colorizeIconsMatch && selectedCategories[0] ? categoryColorizeIcon(selectedCategories[0]) : null
  const outlinesMatch = selectedCategories.every((entry) => categoryOutlineEnabled(entry) === categoryOutlineEnabled(selectedCategories[0]!))
  const commonOutlineEnabled = outlinesMatch && selectedCategories[0] ? categoryOutlineEnabled(selectedCategories[0]) : null
  const outlineWidthsMatch = selectedCategories.every((entry) => categoryOutlineWidth(entry) === categoryOutlineWidth(selectedCategories[0]!))
  const commonOutlineWidth = outlineWidthsMatch && selectedCategories[0] ? categoryOutlineWidth(selectedCategories[0]) : 2
  const outlineColorsMatch = selectedCategories.every((entry) => categoryOutlineColor(entry) === categoryOutlineColor(selectedCategories[0]!))
  const commonOutlineColor = outlineColorsMatch && selectedCategories[0] ? categoryOutlineColor(selectedCategories[0]) : '#FF0000'
  const shadowsMatch = selectedCategories.every((entry) => categoryShadowEnabled(entry) === categoryShadowEnabled(selectedCategories[0]!))
  const commonShadowEnabled = shadowsMatch && selectedCategories[0] ? categoryShadowEnabled(selectedCategories[0]) : null
  const shadowBlursMatch = selectedCategories.every((entry) => categoryShadowBlur(entry) === categoryShadowBlur(selectedCategories[0]!))
  const commonShadowBlur = shadowBlursMatch && selectedCategories[0] ? categoryShadowBlur(selectedCategories[0]) : 10
  const shadowOpacitiesMatch = selectedCategories.every((entry) => categoryShadowOpacity(entry) === categoryShadowOpacity(selectedCategories[0]!))
  const commonShadowOpacity = shadowOpacitiesMatch && selectedCategories[0] ? categoryShadowOpacity(selectedCategories[0]) : 22
  const shadowColorsMatch = selectedCategories.every((entry) => categoryShadowColor(entry) === categoryShadowColor(selectedCategories[0]!))
  const commonShadowColor = shadowColorsMatch && selectedCategories[0] ? categoryShadowColor(selectedCategories[0]) : '#000000'
  const iconUrl = commonIconId ? assetUrls[commonIconId] : undefined
  const update = (patch: Partial<MapCategory>) => editAll ? onUpdateAll(patch) : category && onUpdateCategory(category.id, patch)
  const title = editAll ? 'Alle Kategorien' : category?.name ?? 'Kategorie'
  const subtitle = editAll ? `${categories.length} Kategorien ausgewählt` : 'Kategorie'
  const previewStyle = useMemo(() => iconUrl ? {
    backgroundColor: commonColor ?? '#4F8F64',
    WebkitMaskImage: `url(${iconUrl})`,
    maskImage: `url(${iconUrl})`,
  } : undefined, [commonColor, iconUrl])

  return (
    <aside className="sidebar inspector category-inspector" aria-label="Kategorieinspektor">
      <div className="inspector-titlebar">
        <div className="inspector-avatar category-avatar"><Shapes size={18} /></div>
        <div><span className="eyebrow">{subtitle}</span><h2>{title}</h2></div>
        <button className="icon-button" title="Auswahl aufheben" aria-label="Auswahl aufheben" onClick={onDeselect}><X size={17} /></button>
      </div>
      <div className="inspector-scroll">
        <section className="inspector-section">
          <h3>{editAll ? 'Gemeinsame Einstellungen' : 'Allgemein'}</h3>
          <CategoryNameField value={commonName} placeholder={editAll ? 'Mehrere Namen' : undefined} onCommit={(name) => update({ name })} />
          {editAll && <p className="category-bulk-hint">Änderungen in diesem Bereich werden auf alle Kategorien angewendet.</p>}
        </section>

        <section className="inspector-section">
          <h3>Markierung</h3>
          <div className="category-icon-picker">
            <div className="category-icon-preview">
              {previewStyle ? <span style={previewStyle} /> : <Shapes size={21} />}
            </div>
            <div><strong>Standard-Symbol</strong><span>{commonIconId ? 'Weiße, frei färbbare Maske' : !iconsMatch ? 'Mehrere Symbole' : 'Nicht ausgewählt'}</span></div>
            <button className="mini-button" onClick={onChooseIcon}>Auswählen</button>
          </div>

          <label className="field">
            <span>Stil</span>
            <select value={commonStyle} onChange={(event) => event.target.value && update({ markerStyle: event.target.value as MarkerStyle })}>
              {!commonStyle && <option value="">Verschiedene Stile</option>}
              {(Object.keys(styleLabels) as MarkerStyle[]).map((style) => <option key={style} value={style}>{styleLabels[style]}</option>)}
            </select>
          </label>

          <IconScaleField value={commonScale} mixed={!scalesMatch} onChange={(iconScale) => update({ iconScale })} />
          <IconContentScaleField
            value={commonContentScale}
            mixed={!contentScalesMatch}
            onChange={(iconContentScale) => update({ iconContentScale })}
          />
          <ImageMaskRadiusField
            value={commonMaskRadius}
            mixed={!maskRadiiMatch}
            onChange={(imageMaskRadius) => update({ imageMaskRadius })}
          />

          <label className="field color-field">
            <span>Symbolhintergrund</span>
            <div>
              <input
                type="color"
                aria-label="Symbolhintergrund"
                value={commonBackgroundColor}
                onChange={(event) => update({ iconBackgroundColor: event.target.value })}
              />
              <code>{backgroundColorsMatch ? commonBackgroundColor.toUpperCase() : 'GEMISCHT'}</code>
            </div>
          </label>

          <label className="field color-field">
            <span>Farbe</span>
            <div>
              <input type="color" value={commonColor ?? '#4F8F64'} onChange={(event) => update({ color: event.target.value })} />
              <code>{commonColor?.toUpperCase() ?? 'GEMISCHT'}</code>
            </div>
          </label>

          <label className="switch-row marker-color-switch">
            <span>
              <strong>Bild einfärben</strong>
              <small>{commonColorizeIcon === null ? 'Unterschiedliche Einstellungen' : 'Färbt das gesamte Bild mit der Kategorienfarbe'}</small>
            </span>
            <input
              type="checkbox"
              checked={commonColorizeIcon === true}
              onChange={(event) => update({ colorizeIcon: event.target.checked })}
            />
            <i />
          </label>

          <div className="category-outline-settings">
            <label className="switch-row">
              <span>
                <strong>Kontur anzeigen</strong>
                <small>{commonOutlineEnabled === null ? 'Unterschiedliche Einstellungen' : 'Fügt dem Symbol eine farbige Außenlinie hinzu'}</small>
              </span>
              <input
                type="checkbox"
                checked={commonOutlineEnabled === true}
                onChange={(event) => update({ outlineEnabled: event.target.checked })}
              />
              <i />
            </label>

            <OutlineWidthField
              value={commonOutlineWidth}
              mixed={!outlineWidthsMatch}
              disabled={commonOutlineEnabled !== true}
              onChange={(outlineWidth) => update({ outlineWidth })}
            />

            <label className={`field color-field${commonOutlineEnabled !== true ? ' is-disabled' : ''}`}>
              <span>Konturfarbe</span>
              <div>
                <input
                  type="color"
                  aria-label="Konturfarbe"
                  value={commonOutlineColor}
                  disabled={commonOutlineEnabled !== true}
                  onChange={(event) => update({ outlineColor: event.target.value })}
                />
                <code>{outlineColorsMatch ? commonOutlineColor.toUpperCase() : 'GEMISCHT'}</code>
              </div>
            </label>
          </div>

          <div className="category-outline-settings">
            <label className="switch-row">
              <span>
                <strong>Schatten anzeigen</strong>
                <small>{commonShadowEnabled === null ? 'Unterschiedliche Einstellungen' : 'Fügt dem Symbol einen weichen Schatten hinzu'}</small>
              </span>
              <input
                type="checkbox"
                checked={commonShadowEnabled === true}
                onChange={(event) => update({ shadowEnabled: event.target.checked })}
              />
              <i />
            </label>

            <ShadowRangeField
              label="Schattenweichheit"
              value={commonShadowBlur}
              max={30}
              suffix="px"
              mixed={!shadowBlursMatch}
              disabled={commonShadowEnabled !== true}
              onChange={(shadowBlur) => update({ shadowBlur })}
            />

            <ShadowRangeField
              label="Schattendeckkraft"
              value={commonShadowOpacity}
              max={100}
              suffix="%"
              mixed={!shadowOpacitiesMatch}
              disabled={commonShadowEnabled !== true}
              onChange={(shadowOpacity) => update({ shadowOpacity })}
            />

            <label className={`field color-field${commonShadowEnabled !== true ? ' is-disabled' : ''}`}>
              <span>Schattenfarbe</span>
              <div>
                <input
                  type="color"
                  aria-label="Schattenfarbe"
                  value={commonShadowColor}
                  disabled={commonShadowEnabled !== true}
                  onChange={(event) => update({ shadowColor: event.target.value })}
                />
                <code>{shadowColorsMatch ? commonShadowColor.toUpperCase() : 'GEMISCHT'}</code>
              </div>
            </label>
          </div>
        </section>
      </div>
      {!editAll && <div className="inspector-actions category-inspector-actions"><button className="button danger-ghost" onClick={onDelete}><Trash2 size={15}/>Kategorie löschen</button></div>}
    </aside>
  )
}
