import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MapCategory, MapItem } from '../domain/models'
import { PhoneClientPreview } from './PhoneClientPreview'

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
  subtitle: 'Kraftvoller Allesfresser',
  description: 'Bären passen ihre Nahrungssuche an die Jahreszeit an.',
  iconAssetId: null,
  imageAssetId: null,
  colorOverride: null,
  markerOverrides: null,
  position: { x: 0.4, y: 0.5 },
  facts: [
    { id: 'region', label: 'Region', value: 'Europa und Asien' },
    { id: 'weight', label: 'Gewicht', value: '80–300 kg' },
  ],
  visible: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('PhoneClientPreview', () => {
  it('opens the detailed ZooBrooWeb-style view from the quick preview', () => {
    const onExpand = vi.fn()
    const onClose = vi.fn()
    const props = {
      item,
      category,
      imageUrl: '/bear.jpg',
      iconUrl: '/bear-icon.png',
      getFactIconUrl: () => null,
      onExpand,
      onClose,
    }
    const { rerender } = render(<PhoneClientPreview {...props} expanded={false} />)

    expect(screen.getByLabelText('Bär Vorschau')).toBeInTheDocument()
    expect(screen.getByText('Region: Europa und Asien')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Bär'))
    expect(onExpand).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Vorschau schließen' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onExpand).toHaveBeenCalledOnce()

    rerender(<PhoneClientPreview {...props} expanded />)
    expect(screen.getByRole('dialog', { name: 'Bär' })).toBeInTheDocument()
    expect(screen.getByText('80–300 kg')).toBeInTheDocument()
    expect(screen.getByText(item.description)).toBeInTheDocument()
  })
})
