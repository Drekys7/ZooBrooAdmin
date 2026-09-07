import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapCategory, MapItem } from '../domain/models'
import { PhoneMapSearch, searchScore } from './PhoneMapSearch'

const categories: MapCategory[] = [
  { id: 'animals', name: 'Tiere', type: 'animal', color: '#4F8F64', defaultIconAssetId: null, visible: true, sortOrder: 0 },
  { id: 'food', name: 'Essen', type: 'restaurant', color: '#CA7B42', defaultIconAssetId: null, visible: true, sortOrder: 1 },
]

const items: MapItem[] = [
  { id: 'bear', categoryId: 'animals', type: 'animal', title: 'Bär', position: { x: 0.2, y: 0.3 }, subtitle: '', description: '', iconAssetId: null, imageAssetId: null, colorOverride: null, markerOverrides: null, facts: [], visible: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'bistro', categoryId: 'food', type: 'restaurant', title: 'Bären-Bistro', position: { x: 0.7, y: 0.8 }, subtitle: '', description: '', iconAssetId: null, imageAssetId: null, colorOverride: null, markerOverrides: null, facts: [], visible: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
]

afterEach(cleanup)

describe('PhoneMapSearch', () => {
  it('ranks localized title prefixes and ignores accents', () => {
    expect(searchScore(items[0], categories[0], 'bar', 'de')).toBeGreaterThan(
      searchScore(items[1], categories[1], 'bar', 'de'),
    )
  })

  it('selects a suggestion and closes the results menu', () => {
    const onChooseItem = vi.fn()
    const { container } = render(
      <PhoneMapSearch
        items={items}
        categories={categories}
        locale="de"
        hiddenCategoryIds={new Set()}
        getItemIconUrl={(_item, category) => `/category-${category?.id}.png`}
        onToggleCategory={() => {}}
        onChooseItem={onChooseItem}
      />,
    )

    fireEvent.change(screen.getByRole('searchbox', { name: 'Karte durchsuchen' }), { target: { value: 'bär' } })
    expect(screen.getByRole('listbox', { name: 'Suchergebnisse' })).toBeInTheDocument()
    const fallbackIcon = container.querySelector('.map-client-search__result-default-icon')
    expect(fallbackIcon).toHaveStyle({ backgroundColor: '#4F8F64' })
    expect(fallbackIcon).toHaveStyle({ maskImage: 'url("/category-animals.png")' })
    fireEvent.click(screen.getByRole('option', { name: 'Bär Tiere' }))

    expect(onChooseItem).toHaveBeenCalledWith('bear')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('excludes disabled categories from suggestions and exposes category toggles', () => {
    const onToggleCategory = vi.fn()
    render(
      <PhoneMapSearch
        items={items}
        categories={categories}
        locale="en"
        hiddenCategoryIds={new Set(['animals'])}
        getItemIconUrl={(item) => `/${item.id}.png`}
        onToggleCategory={onToggleCategory}
        onChooseItem={() => {}}
      />,
    )

    const animalToggle = screen.getByRole('button', { name: 'Tiere' })
    expect(animalToggle).toHaveAttribute('aria-pressed', 'false')
    expect(animalToggle.querySelector('.map-client-categories__icon')).toHaveStyle({ backgroundColor: '#4F8F64' })
    const categoryScroller = screen.getByRole('group', { name: 'Categories' })
    fireEvent.wheel(categoryScroller, { deltaY: 80, deltaX: 0 })
    expect(categoryScroller.scrollLeft).toBe(80)
    fireEvent.click(animalToggle)
    expect(onToggleCategory).toHaveBeenCalledWith('animals')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the map' }), { target: { value: 'Bär' } })
    expect(screen.queryByRole('option', { name: 'Bär Tiere' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bären-Bistro Essen' })).toBeInTheDocument()
  })

  it('uses the marker color for a non-animal icon even without the colorize flag', () => {
    const restroomCategory: MapCategory = {
      id: 'restrooms', name: 'Toiletten', type: 'restroom', color: '#2F79A8', defaultIconAssetId: null,
      colorizeIcon: false, iconContentScale: 0.7, visible: true, sortOrder: 0,
    }
    const restroom: MapItem = {
      ...items[0], id: 'wc-1', categoryId: restroomCategory.id, type: 'restroom', title: 'WC 1', iconAssetId: 'restroom-icon',
    }
    const { container } = render(
      <PhoneMapSearch
        items={[restroom]}
        categories={[restroomCategory]}
        locale="de"
        hiddenCategoryIds={new Set()}
        getItemIconUrl={() => '/restroom.svg'}
        onToggleCategory={() => {}}
        onChooseItem={() => {}}
      />,
    )

    fireEvent.change(screen.getByRole('searchbox', { name: 'Karte durchsuchen' }), { target: { value: 'WC' } })
    expect(container.querySelector('.map-client-search__result-icon img')).not.toBeInTheDocument()
    expect(container.querySelector('.map-client-search__result-default-icon')).toHaveStyle({ backgroundColor: '#2F79A8' })
    expect(container.querySelector('.map-client-search__result-icon')).toHaveStyle({ '--search-result-icon-scale': '0.7' })
  })
})
