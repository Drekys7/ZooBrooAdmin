import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MapCategory, MapItem } from '../domain/models'
import { LeftSidebar, type VisibilityFilter } from './LeftSidebar'

const hiddenCategory: MapCategory = {
  id: 'animals',
  name: 'Tiere',
  type: 'animal',
  color: '#4F8F64',
  defaultIconAssetId: null,
  visible: false,
  sortOrder: 0,
}

const visibleItem: MapItem = {
  id: 'bear',
  categoryId: hiddenCategory.id,
  type: 'animal',
  title: 'Bär',
  subtitle: 'Kraftvoller Allesfresser',
  description: '',
  iconAssetId: null,
  imageAssetId: null,
  colorOverride: null,
  markerOverrides: null,
  position: { x: 0.5, y: 0.5 },
  facts: [],
  visible: true,
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
}

function renderSidebar(visibility: VisibilityFilter) {
  return render(
    <LeftSidebar
      categories={[hiddenCategory]}
      items={[visibleItem]}
      selectedItemId={null}
      selectedCategoryId={null}
      inspectedCategoryId={null}
      search=""
      visibility={visibility}
      activeTool="select"
      onSearch={vi.fn()}
      onVisibility={vi.fn()}
      onCategory={vi.fn()}
      onToggleCategory={vi.fn()}
      onToggleAllCategories={vi.fn()}
      onCreateCategory={vi.fn()}
      onSelectItem={vi.fn()}
      onFocusItem={vi.fn()}
      onAddItem={vi.fn()}
    />,
  )
}

describe('LeftSidebar visibility filter', () => {
  it('treats an item in a hidden category as hidden', () => {
    const { rerender } = renderSidebar('visible')

    expect(screen.queryByText('Bär')).not.toBeInTheDocument()
    expect(screen.getByText('Keine Punkte gefunden')).toBeInTheDocument()

    rerender(
      <LeftSidebar
        categories={[hiddenCategory]}
        items={[visibleItem]}
        selectedItemId={null}
        selectedCategoryId={null}
        inspectedCategoryId={null}
        search=""
        visibility="hidden"
        activeTool="select"
        onSearch={vi.fn()}
        onVisibility={vi.fn()}
        onCategory={vi.fn()}
        onToggleCategory={vi.fn()}
        onToggleAllCategories={vi.fn()}
        onCreateCategory={vi.fn()}
        onSelectItem={vi.fn()}
        onFocusItem={vi.fn()}
        onAddItem={vi.fn()}
      />,
    )

    expect(screen.getByText('Bär')).toBeInTheDocument()
  })
})
