import { Plus, Trash2, Copy, MapPin } from 'lucide-react'
import { zoneAppearance, zoneTitle, type Zone, type ZoneSettings } from '../domain/zones'
import { FontSettings } from './FontSettings'
import { useMapFont } from './useMapFont'

export function ZoneSidebar({ settings, selectedId, onSelect, onAdd, adding, onChange, fontUrls, fontNames, onFontUpload, maxZoomScale = 4, locale = 'de', defaultLocale = 'de' }: {
  locale?: string
  defaultLocale?: string
  maxZoomScale?: number
  settings: ZoneSettings; selectedId: string | null; onSelect: (zone: Zone) => void; onAdd: () => void; adding: boolean
  onChange: (settings: ZoneSettings) => void; fontUrls: Record<string, string>; fontNames: Record<string, string>; onFontUpload: (file: File) => Promise<string>
}) {
  const family = useMapFont(settings.typography, fontUrls)
  const appearance = zoneAppearance(settings)
  const sliders = [
    ['fontSize', 'Schriftgröße', 10, 72, 1, 'px'], ['fontWeight', 'Schriftstärke', 100, 900, 100, ''],
    ['maxWidth', 'Maximale Schildbreite', 80, 500, 5, 'px'], ['borderWidth', 'Konturstärke', 0, 8, 0.5, 'px'],
    ['borderRadius', 'Eckenradius', 0, 32, 1, 'px'], ['paddingX', 'Innenabstand horizontal', 2, 40, 1, 'px'], ['paddingY', 'Innenabstand vertikal', 2, 30, 1, 'px'],
  ] as const
  return <aside className="sidebar zone-sidebar" aria-label="Zonen">
    <div className="sidebar-heading"><div><span className="eyebrow">KARTENEBENE</span><h2>Zonen</h2></div><span>{settings.labels.length}</span></div>
    <p className="zone-help">Zonen auf der Karte platzieren und per Ziehen verschieben. Im Editor bleibt diese Ebene sichtbar; im Handy-Simulator entscheidet der Zoom.</p>
    <section className="map-global-settings__section" aria-label="Zonen und Zoom">
      <strong>Zonen &amp; Zoom</strong>
      <label className="switch-row"><span>Automatisch nach Zoom wechseln</span><input type="checkbox" checked={settings.enabled} onChange={event => onChange({ ...settings, enabled: event.target.checked })}/><i/></label>
      <label className="field zone-slider"><span>Umschaltpunkt<strong>{Math.round(settings.threshold * 100)} %</strong></span><input aria-label="Umschaltpunkt" type="range" min={10} max={400} step={5} value={Math.round(settings.threshold * 100)} onChange={event => onChange({ ...settings, threshold: Number(event.target.value) / 100 })}/></label>
      <p>Bis {Math.round(settings.threshold * 100)} %: Zonen. Darüber: Kartenpunkte. 100 % entspricht der Gesamtansicht. Im Handy-Simulator prüfen.</p>
      {settings.threshold >= maxZoomScale && <p role="status">Der Umschaltpunkt muss unter der maximalen Vergrößerung liegen, damit Kartenpunkte erreichbar bleiben.</p>}
    </section>
    <button className="button zone-add" onClick={onAdd}><Plus size={16}/>{adding ? 'Auf die Karte klicken …' : 'Zone hinzufügen'}</button>
    <div className="zone-list">{settings.labels.map(zone => <button key={zone.id} className={zone.id === selectedId ? 'is-active' : ''} onClick={() => onSelect(zone)}><MapPin size={16}/><span>{zoneTitle(zone, locale, defaultLocale)}</span>{!zone.visible && <small>Ausgeblendet</small>}</button>)}</div>
    {!settings.labels.length && <p className="zone-help">Noch keine Zonen. „Zone hinzufügen“ wählen und auf die gewünschte Position klicken.</p>}
    <section className="map-global-settings__section" aria-label="Gemeinsames Zonenbild">
      <strong>Darstellung aller Zonen</strong>
      <p>Einheitliche Farben und Größen für alle Zonenschilder.</p>
      <label className="switch-row"><span>Alles in Großbuchstaben</span><input type="checkbox" checked={appearance.uppercase ?? false} onChange={event => onChange({ ...settings, appearance: { ...appearance, uppercase: event.target.checked } })}/><i/></label>
      {(['textColor', 'backgroundColor', 'borderColor'] as const).map((key, index) => <label className="zone-color" key={key}><span>{['Textfarbe', 'Hintergrundfarbe', 'Konturfarbe'][index]}</span><input type="color" value={appearance[key]} onChange={event => onChange({ ...settings, appearance: { ...appearance, [key]: event.target.value } })}/></label>)}
      {sliders.map(([key, label, min, max, step, unit]) => <label className="field zone-slider" key={key}><span>{label}<strong>{appearance[key]}{unit}</strong></span><input aria-label={label} type="range" min={min} max={max} step={step} value={appearance[key]} onChange={event => onChange({ ...settings, appearance: { ...appearance, [key]: Number(event.target.value) } })}/></label>)}
    </section>
    <FontSettings title="Schrift für Zonennamen" description="Gilt nur für die Zonenschilder. Besuchertexte behalten ihre eigene Schrift." value={settings.typography} fontFamily={family} names={fontNames} onUpload={onFontUpload} onChange={typography => onChange({ ...settings, typography })}/>
  </aside>
}

export function ZoneInspector({ zone, locale, defaultLocale, onChange, onDelete, onDuplicate }: {
  zone?: Zone; locale: string; defaultLocale: string; onChange: (patch: Partial<Zone>) => void; onDelete: () => void; onDuplicate: () => void
}) {
  return <aside className="sidebar zone-inspector" aria-label="Zoneninspektor">
    <div className="sidebar-heading"><div><span className="eyebrow">INSPEKTOR</span><h2>{zone ? zoneTitle(zone, locale, defaultLocale) : 'Zone bearbeiten'}</h2></div></div>
    {!zone ? <div className="zone-inspector-empty">
      <div className="zone-inspector-empty__icon"><MapPin size={26} strokeWidth={1.6} aria-hidden="true"/></div>
      <h3>Welche Zone möchtest du bearbeiten?</h3>
      <p>Wähle eine Zone in der Liste oder direkt auf der Karte aus.</p>
      <div className="zone-inspector-empty__hint"><Plus size={16} strokeWidth={1.8} aria-hidden="true"/><span>Neue Zone? Links auf <strong>„Zone hinzufügen“</strong> klicken und auf der Karte platzieren.</span></div>
    </div> : <div className="panel-section">
      <label className="field"><span>Zonenname · {locale.toUpperCase()}</span><input maxLength={160} value={locale === defaultLocale ? zone.title : zone.translations[locale] ?? ''} placeholder={zone.title} onChange={event => onChange(locale === defaultLocale ? { title: event.target.value } : { translations: { ...zone.translations, [locale]: event.target.value } })}/></label>
      <label className="switch-row"><span>Für Besucher sichtbar</span><input type="checkbox" checked={zone.visible} onChange={event => onChange({ visible: event.target.checked })}/><i/></label>
      <p className="zone-help">Position durch Ziehen auf der Karte ändern. Gemeinsame Darstellung, Schrift und Zoomwechsel links unter „Zonen“ einstellen.</p>
      <div className="zone-actions"><button className="button" onClick={onDuplicate}><Copy size={15}/>Duplizieren</button><button className="button" onClick={onDelete}><Trash2 size={15}/>Löschen</button></div>
    </div>}
  </aside>
}
