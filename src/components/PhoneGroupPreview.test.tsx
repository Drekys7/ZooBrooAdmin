import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MapItem } from '../domain'
import { PhoneGroupPreview } from './PhoneGroupPreview'

const entries: MapItem[] = Array.from({ length: 5 }, (_, index) => ({
  id: `item-${index}`, title: `Punkt ${index + 1}`, categoryId: 'animals', type: 'animal',
  subtitle: '', description: '', position: { x: 0.5, y: 0.5 }, facts: [], visible: true,
  createdAt: '2026-09-11T00:00:00.000Z', updatedAt: '2026-09-11T00:00:00.000Z',
}))

describe('group preview scrolling', () => {
  it.each([2, 3, 4, 5])('enables the half-card layout only for four or more entries (%s)', (count) => {
    const { container } = render(<PhoneGroupPreview entries={entries.slice(0, count)} getImageUrl={() => null} onChoose={vi.fn()} onClose={vi.fn()} />)
    expect(container.querySelector('.map-client-group__list')?.classList.contains('has-more')).toBe(count >= 4)
  })

  it('scrolls with vertical and horizontal wheels, handles units, clamps edges and resets for a different group', () => {
    const props = { getImageUrl: () => null, onChoose: vi.fn(), onClose: vi.fn() }
    const { container, rerender } = render(<PhoneGroupPreview {...props} entries={entries} />)
    const list = container.querySelector<HTMLDivElement>('.map-client-group__list')!
    Object.defineProperties(list, { clientWidth: { value: 300 }, scrollWidth: { value: 600 } })
    const wheel = new WheelEvent('wheel', { deltaY: 60, bubbles: true, cancelable: true })
    fireEvent(list, wheel)
    expect(wheel.defaultPrevented).toBe(true)
    expect(list.scrollLeft).toBe(12)
    fireEvent.wheel(list, { deltaY: -20 })
    expect(list.scrollLeft).toBe(8)
    fireEvent.wheel(list, { deltaX: 30, deltaY: 2 })
    expect(list.scrollLeft).toBe(14)
    fireEvent.wheel(list, { deltaY: 2, deltaMode: 1 })
    expect(list.scrollLeft).toBeCloseTo(20.4)
    fireEvent.wheel(list, { deltaY: 1, deltaMode: 2 })
    expect(list.scrollLeft).toBeCloseTo(80.4)
    fireEvent.wheel(list, { deltaY: 2000 })
    expect(list.scrollLeft).toBe(300)
    fireEvent.wheel(list, { deltaY: -2000 })
    expect(list.scrollLeft).toBe(0)
    fireEvent.wheel(list, { deltaY: 60, ctrlKey: true })
    expect(list.scrollLeft).toBe(0)
    fireEvent.wheel(list, { deltaY: 60 })
    rerender(<PhoneGroupPreview {...props} entries={entries.slice(1)} />)
    expect(list.scrollLeft).toBe(0)
  })

  it('leaves wheel events untouched when every card fits', () => {
    const { container } = render(<PhoneGroupPreview entries={entries.slice(0, 3)} getImageUrl={() => null} onChoose={vi.fn()} onClose={vi.fn()} />)
    const list = container.querySelector('.map-client-group__list')!
    const wheel = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true })
    fireEvent(list, wheel)
    expect(wheel.defaultPrevented).toBe(false)
  })
})
