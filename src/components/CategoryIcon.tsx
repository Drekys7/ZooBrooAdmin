import { Shapes } from 'lucide-react'
import type { CSSProperties } from 'react'

const categoryIcons: Record<string, string> = {
  animal: '/zooweb/icons/paw.png',
  restaurant: '/zooweb/icons/restaurant.png',
  restroom: '/zooweb/icons/restroom.png',
  souvenir: '/zooweb/icons/souvenir.png',
  entrance: '/zooweb/icons/entrance.png',
}

export function CategoryIcon({ type, size = 16, className }: { type: string; size?: number | string; className?: string }) {
  const icon = categoryIcons[type]
  if (!icon) return <Shapes size={size} className={className} />
  return <span
    className={`zooweb-category-glyph ${className ?? ''}`}
    aria-hidden="true"
    style={{
      width: size,
      height: size,
      WebkitMaskImage: `url(${icon})`,
      maskImage: `url(${icon})`,
    } as CSSProperties}
  />
}
