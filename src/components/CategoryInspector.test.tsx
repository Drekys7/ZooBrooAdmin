import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapCategory } from '../domain/models'
import { CategoryInspector } from './CategoryInspector'

const category: MapCategory = {
  id: 'animals',
  name: 'Tiere',
  type: 'animal',
  color: '#4F8F64',
  defaultIconAssetId: null,
  markerStyle: 'image',
  iconScale: 1,
  iconContentScale: 1,
  outlineEnabled: true,
  outlineWidth: 2,
  outlineColor: '#FF0000',
  visible: true,
  sortOrder: 0,
}

afterEach(cleanup)

describe('CategoryInspector', () => {
  it('commits the selected category icon size', () => {
    const onUpdateCategory = vi.fn()
    render(
      <CategoryInspector
        categories={[category]}
        category={category}
        editAll={false}
        assetUrls={{}}
        onUpdateCategory={onUpdateCategory}
        onUpdateAll={vi.fn()}
        onChooseIcon={vi.fn()}
        onDelete={vi.fn()}
        onDeselect={vi.fn()}
      />,
    )

    const slider = screen.getByRole('slider', { name: 'Symbolgröße' })
    fireEvent.change(slider, { target: { value: '1.55' } })
    expect(screen.getByText('155%')).toBeInTheDocument()

    expect(onUpdateCategory).toHaveBeenCalledWith('animals', { iconScale: 1.55 })
  })

  it('updates the category outline visibility, width and color', () => {
    const onUpdateCategory = vi.fn()
    const { container } = render(
      <CategoryInspector
        categories={[category]}
        category={category}
        editAll={false}
        assetUrls={{}}
        onUpdateCategory={onUpdateCategory}
        onUpdateAll={vi.fn()}
        onChooseIcon={vi.fn()}
        onDelete={vi.fn()}
        onDeselect={vi.fn()}
      />,
    )

    fireEvent.click(container.querySelector('input[type="checkbox"]')!)
    expect(onUpdateCategory).toHaveBeenCalledWith('animals', { outlineEnabled: false })

    const widthSlider = container.querySelector('input[aria-label="Konturstärke"]')!
    fireEvent.change(widthSlider, { target: { value: '4.5' } })
    expect(onUpdateCategory).toHaveBeenCalledWith('animals', { outlineWidth: 4.5 })

    const colorInput = container.querySelector('input[aria-label="Konturfarbe"]')
    fireEvent.change(colorInput!, { target: { value: '#123456' } })
    expect(onUpdateCategory).toHaveBeenCalledWith('animals', { outlineColor: '#123456' })
  })

  it('updates the image size inside the marker immediately', () => {
    const onUpdateCategory = vi.fn()
    render(
      <CategoryInspector
        categories={[category]}
        category={category}
        editAll={false}
        assetUrls={{}}
        onUpdateCategory={onUpdateCategory}
        onUpdateAll={vi.fn()}
        onChooseIcon={vi.fn()}
        onDelete={vi.fn()}
        onDeselect={vi.fn()}
      />,
    )

    const slider = screen.getByRole('slider', { name: 'Bildgröße im Symbol' })
    fireEvent.change(slider, { target: { value: '1.25' } })

    expect(screen.getByText('125%')).toBeInTheDocument()
    expect(onUpdateCategory).toHaveBeenCalledWith('animals', { iconContentScale: 1.25 })
  })
})
