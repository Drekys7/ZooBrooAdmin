import {
  categoryColorizeIcon,
  categoryIconBackgroundColor,
  categoryIconContentScale,
  categoryIconScale,
  categoryImageMaskRadius,
  categoryMarkerStyle,
  categoryOutlineColor,
  categoryOutlineEnabled,
  categoryOutlineWidth,
  categoryShadowBlur,
  categoryShadowColor,
  categoryShadowEnabled,
  categoryShadowOpacity,
  type MapCategory,
  type MapItem,
  type MarkerOverrides,
  type MarkerStyle,
} from '../domain/models'
import type { ReactNode } from 'react'

interface Props {
  item: MapItem
  category: MapCategory
  onUpdate: (patch: Partial<MapItem>) => void
}

const styleLabels: Record<MarkerStyle, string> = {
  image: 'Nur Bild',
  circle: 'Bild im Kreis',
  pin: 'Pin',
}

export function ItemMarkerOverrides({ item, category, onUpdate }: Props) {
  const overrides = item.markerOverrides ?? {}
  const defaults: Required<MarkerOverrides> = {
    color: category.color,
    markerStyle: categoryMarkerStyle(category),
    iconScale: categoryIconScale(category),
    iconContentScale: categoryIconContentScale(category),
    imageMaskRadius: categoryImageMaskRadius(category),
    iconBackgroundColor: categoryIconBackgroundColor(category),
    colorizeIcon: categoryColorizeIcon(category),
    outlineEnabled: categoryOutlineEnabled(category),
    outlineWidth: categoryOutlineWidth(category),
    outlineColor: categoryOutlineColor(category),
    shadowEnabled: categoryShadowEnabled(category),
    shadowBlur: categoryShadowBlur(category),
    shadowOpacity: categoryShadowOpacity(category),
    shadowColor: categoryShadowColor(category),
  }

  const hasOverride = (key: keyof MarkerOverrides) =>
    Object.prototype.hasOwnProperty.call(overrides, key) || (key === 'color' && Boolean(item.colorOverride))

  const valueFor = <K extends keyof MarkerOverrides>(key: K): Required<MarkerOverrides>[K] =>
    (key === 'color' && item.colorOverride ? item.colorOverride : overrides[key] ?? defaults[key]) as Required<MarkerOverrides>[K]

  const setOverride = <K extends keyof MarkerOverrides>(key: K, value: MarkerOverrides[K] | undefined) => {
    const next: MarkerOverrides = { ...overrides }
    if (value === undefined) delete next[key]
    else next[key] = value
    onUpdate({
      markerOverrides: Object.keys(next).length > 0 ? next : null,
      ...(key === 'color' ? { colorOverride: null } : {}),
    })
  }

  const row = (key: keyof MarkerOverrides, label: string, control: ReactNode) => {
    const enabled = hasOverride(key)
    return (
      <div className={`override-row${enabled ? ' is-enabled' : ''}`} key={key}>
        <input
          type="checkbox"
          aria-label={`${label} überschreiben`}
          checked={enabled}
          onChange={(event) => setOverride(key, event.target.checked ? defaults[key] : undefined)}
        />
        <span>{label}</span>
        <div className="override-control" aria-disabled={!enabled}>{control}</div>
      </div>
    )
  }

  const range = (key: keyof MarkerOverrides, min: number, max: number, step: number, suffix: string) => {
    const value = Number(valueFor(key))
    return (
      <div className="override-range">
        <input disabled={!hasOverride(key)} type="range" min={min} max={max} step={step} value={value} onChange={(event) => setOverride(key, Number(event.target.value))} />
        <code>{Math.round(value * (suffix === '%' && max <= 2 ? 100 : 1))}{suffix}</code>
      </div>
    )
  }

  const color = (key: keyof MarkerOverrides) => {
    const value = String(valueFor(key))
    return <input disabled={!hasOverride(key)} aria-label={`${key} Wert`} type="color" value={value} onChange={(event) => setOverride(key, event.target.value)} />
  }

  const bool = (key: keyof MarkerOverrides) =>
    <input disabled={!hasOverride(key)} aria-label={`${key} Wert`} type="checkbox" checked={Boolean(valueFor(key))} onChange={(event) => setOverride(key, event.target.checked)} />

  return (
    <details className="marker-overrides">
      <summary>
        <span><strong>Individuelle Einstellungen</strong><small>Seltene Abweichungen von der Kategorie</small></span>
        <em>{Object.keys(overrides).length + (item.colorOverride && !overrides.color ? 1 : 0)}</em>
      </summary>
      <div className="marker-overrides-list">
        {row('color', 'Farbe', color('color'))}
        {row('markerStyle', 'Stil', <select disabled={!hasOverride('markerStyle')} value={valueFor('markerStyle')} onChange={(event) => setOverride('markerStyle', event.target.value as MarkerStyle)}>{(Object.keys(styleLabels) as MarkerStyle[]).map((style) => <option key={style} value={style}>{styleLabels[style]}</option>)}</select>)}
        {row('iconScale', 'Symbolgröße', range('iconScale', .5, 2, .05, '%'))}
        {row('iconContentScale', 'Bildgröße', range('iconContentScale', .5, 1.5, .05, '%'))}
        {row('imageMaskRadius', 'Maskenradius', range('imageMaskRadius', 0, 100, 5, '%'))}
        {row('iconBackgroundColor', 'Symbolhintergrund', color('iconBackgroundColor'))}
        {row('colorizeIcon', 'Bild einfärben', bool('colorizeIcon'))}
        {row('outlineEnabled', 'Kontur anzeigen', bool('outlineEnabled'))}
        {row('outlineWidth', 'Konturstärke', range('outlineWidth', .5, 10, .5, 'px'))}
        {row('outlineColor', 'Konturfarbe', color('outlineColor'))}
        {row('shadowEnabled', 'Schatten anzeigen', bool('shadowEnabled'))}
        {row('shadowBlur', 'Schattenweichheit', range('shadowBlur', 0, 30, 1, 'px'))}
        {row('shadowOpacity', 'Schattendeckkraft', range('shadowOpacity', 0, 100, 5, '%'))}
        {row('shadowColor', 'Schattenfarbe', color('shadowColor'))}
      </div>
    </details>
  )
}
