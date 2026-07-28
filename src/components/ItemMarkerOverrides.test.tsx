import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapCategory, MapItem } from '../domain/models'
import { ItemMarkerOverrides } from './ItemMarkerOverrides'

afterEach(cleanup)

const category: MapCategory = {
  id: 'animals',
  name: 'Tiere',
  type: 'animal',
  color: '#4F8F64',
  defaultIconAssetId: null,
  visible: true,
  sortOrder: 0,
}

const item: MapItem = {
  id: 'bear',
  categoryId: 'animals',
  type: 'animal',
  title: 'Bär',
  subtitle: '',
  description: '',
  iconAssetId: null,
  imageAssetId: null,
  colorOverride: null,
  markerOverrides: null,
  position: { x: 0.5, y: 0.5 },
  facts: [],
  visible: true,
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
}

describe('ItemMarkerOverrides', () => {
  it('stores only explicitly enabled values', () => {
    const onUpdate = vi.fn()
    render(<ItemMarkerOverrides item={item} category={category} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByText('Individuelle Einstellungen'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Farbe überschreiben' }))

    expect(onUpdate).toHaveBeenCalledWith({
      markerOverrides: { color: '#4F8F64' },
      colorOverride: null,
    })
  })
})
