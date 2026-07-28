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
  imageMaskRadius: 100,
  iconBackgroundColor: '#FFFFFF',
  colorizeIcon: false,
  outlineEnabled: true,
  outlineWidth: 2,
  outlineColor: '#FF0000',
  shadowEnabled: true,
  shadowBlur: 10,
  shadowOpacity: 22,
  shadowColor: '#000000',
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

    fireEvent.click(screen.getByRole('checkbox', { name: /Kontur anzeigen/ }))
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

  it('updates the marker background color', () => {
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

    const colorInput = container.querySelector('input[aria-label="Symbolhintergrund"]')!
    fireEvent.change(colorInput, { target: { value: '#abcdef' } })

    expect(onUpdateCategory).toHaveBeenCalledWith('animals', { iconBackgroundColor: '#abcdef' })
  })

  it('updates the animal image mask radius immediately in five-percent steps', () => {
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

    const slider = screen.getByRole('slider', { name: 'Maskenradius' })
    expect(slider).toHaveAttribute('step', '5')
    fireEvent.change(slider, { target: { value: '65' } })

    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(onUpdateCategory).toHaveBeenCalledWith('animals', { imageMaskRadius: 65 })
  })

  it('updates category shadow settings immediately', () => {
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

    fireEvent.change(screen.getByRole('slider', { name: 'Schattenweichheit' }), { target: { value: '18' } })
    fireEvent.change(screen.getByRole('slider', { name: 'Schattendeckkraft' }), { target: { value: '40' } })
    fireEvent.change(container.querySelector('input[aria-label="Schattenfarbe"]')!, { target: { value: '#123456' } })

    expect(onUpdateCategory).toHaveBeenCalledWith('animals', { shadowBlur: 18 })
    expect(onUpdateCategory).toHaveBeenCalledWith('animals', { shadowOpacity: 40 })
    expect(onUpdateCategory).toHaveBeenCalledWith('animals', { shadowColor: '#123456' })
  })

  it('toggles coloring the complete image with the category color', () => {
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

    fireEvent.click(screen.getByRole('checkbox', { name: /Bild einfärben/ }))
    expect(onUpdateCategory).toHaveBeenCalledWith('animals', { colorizeIcon: true })
  })
})
