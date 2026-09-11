import { Image as ImageIcon, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { MapItem } from '../domain/models'

const WHEEL_SCROLL_FACTOR = 0.2

export function PhoneGroupPreview({ entries, getImageUrl, onChoose, onClose }: {
  entries: MapItem[]
  getImageUrl: (item: MapItem) => string | null | undefined
  onChoose: (id: string) => void
  onClose: () => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const groupId = entries[0]?.id
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollLeft = 0
    const onWheel = (event: WheelEvent) => {
      const maxScroll = list.scrollWidth - list.clientWidth
      if (event.ctrlKey || maxScroll <= 0) return
      // A non-passive listener lets the wheel move the strip without scrolling/zooming the map.
      event.preventDefault()
      event.stopPropagation()
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? list.clientWidth : 1
      list.scrollLeft = Math.max(0, Math.min(maxScroll, list.scrollLeft + delta * unit * WHEEL_SCROLL_FACTOR))
    }
    list.addEventListener('wheel', onWheel, { passive: false })
    return () => list.removeEventListener('wheel', onWheel)
  }, [groupId])

  return <aside className="map-client-group" aria-label="Gruppe auswählen">
    <div ref={listRef} className={`map-client-group__list${entries.length >= 4 ? ' has-more' : ''}`}>
      {entries.map((entry) => {
        const image = getImageUrl(entry)
        return <button className="map-client-group__entry" key={entry.id} onClick={() => onChoose(entry.id)} aria-label={entry.title} title={entry.title}>
          {image ? <img src={image} alt="" draggable={false}/> : <ImageIcon size={28} aria-hidden="true"/>}
          <span>{entry.title}</span>
        </button>
      })}
    </div>
    <button className="map-client-preview__close" aria-label="Gruppe schließen" onClick={onClose}><X size={13}/></button>
  </aside>
}
