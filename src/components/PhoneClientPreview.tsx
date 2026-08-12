import { Info, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { MapCategory, MapFact, MapItem } from '../domain/models'

interface PhoneClientPreviewProps {
  item: MapItem
  category: MapCategory | undefined
  imageUrl?: string | null
  iconUrl: string
  expanded: boolean
  getFactIconUrl?: (fact: MapFact, item: MapItem) => string | null | undefined
  onExpand: () => void
  onClose: () => void
}

function previewColor(item: MapItem, category: MapCategory | undefined): string {
  return item.markerOverrides?.color ?? item.colorOverride ?? category?.color ?? '#2F7D59'
}

function PreviewVisual({ imageUrl, iconUrl, large = false }: { imageUrl?: string | null; iconUrl: string; large?: boolean }) {
  if (imageUrl) {
    return <img className={large ? 'map-client-preview__hero-image' : 'map-client-preview__image'} src={imageUrl} alt="" />
  }

  return (
    <div className={large ? 'map-client-preview__hero-icon' : 'map-client-preview__icon-visual'} aria-hidden="true">
      <span
        className="map-client-preview__icon"
        style={{ WebkitMaskImage: `url("${iconUrl}")`, maskImage: `url("${iconUrl}")` } as CSSProperties}
      />
    </div>
  )
}

function FactIcon({ fact, item, getFactIconUrl }: { fact: MapFact; item: MapItem; getFactIconUrl?: PhoneClientPreviewProps['getFactIconUrl'] }) {
  const iconUrl = getFactIconUrl?.(fact, item)
  return iconUrl
    ? <img className="map-client-preview__fact-icon-image" src={iconUrl} alt="" aria-hidden="true" />
    : <Info className="map-client-preview__fact-icon" size={14} strokeWidth={1.9} aria-hidden="true" />
}

export function PhoneClientPreview({
  item,
  category,
  imageUrl,
  iconUrl,
  expanded,
  getFactIconUrl,
  onExpand,
  onClose,
}: PhoneClientPreviewProps) {
  const style = { '--client-preview-accent': previewColor(item, category) } as CSSProperties

  if (!expanded) {
    return (
      <aside className="map-client-preview__quick" aria-label={`${item.title} Vorschau`} style={style} onClick={onExpand}>
        <button
          type="button"
          className="map-client-preview__close"
          aria-label="Vorschau schließen"
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
        >
          <X size={13} strokeWidth={2} aria-hidden="true" />
        </button>
        <PreviewVisual imageUrl={imageUrl} iconUrl={iconUrl} />
        <div className="map-client-preview__quick-content">
          <h2>{item.title}</h2>
          {item.facts.length > 0 ? (
            <div className="map-client-preview__quick-facts">
              {item.facts.slice(0, 3).map((fact) => (
                <span key={fact.id}>{fact.label}: {fact.value}</span>
              ))}
            </div>
          ) : (
            <>
              <strong className="map-client-preview__subtitle">{item.subtitle}</strong>
              <p className="map-client-preview__quick-description">{item.description}</p>
            </>
          )}
          <button
            type="button"
            className="map-client-preview__more"
            onClick={(event) => {
              event.stopPropagation()
              onExpand()
            }}
          >
            Weitere Informationen →
          </button>
        </div>
      </aside>
    )
  }

  return (
    <div className="map-client-preview__overlay is-open" onClick={onClose}>
      <article
        className="map-client-preview__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-client-preview-title"
        style={style}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="map-client-preview__sheet-close" aria-label="Detailansicht schließen" onClick={onClose}>
          <X size={15} strokeWidth={2} aria-hidden="true" />
        </button>
        <div className="map-client-preview__scroll">
          <PreviewVisual imageUrl={imageUrl} iconUrl={iconUrl} large />
          <div className="map-client-preview__content">
            <h2 id="map-client-preview-title">{item.title}</h2>
            {item.subtitle ? <p className="map-client-preview__sheet-subtitle">{item.subtitle}</p> : null}
            {item.facts.length > 0 ? (
              <div className="map-client-preview__facts">
                {item.facts.map((fact) => (
                  <div className="map-client-preview__fact" key={fact.id}>
                    <FactIcon fact={fact} item={item} getFactIconUrl={getFactIconUrl} />
                    <div>
                      <span>{fact.label}</span>
                      <strong>{fact.value}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="map-client-preview__description">{item.description || 'Keine Beschreibung vorhanden.'}</p>
          </div>
        </div>
      </article>
    </div>
  )
}
