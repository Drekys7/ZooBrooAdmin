import { fireEvent, render, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MapCanvas } from './MapCanvas'
import { GroupInspector } from './GroupInspector'
import { type MapItem, type MapCategory } from '../domain'

const category: MapCategory = { id: 'restaurants', name: 'Gastronomie', type: 'restaurant', color: '#226644', visible: true, sortOrder: 0 }
const item: MapItem = {
  id: 'root', categoryId: category.id, type: 'restaurant', title: 'Restaurant', subtitle: '', description: 'Hauptrestaurant',
  position: { x: 0.5, y: 0.5 }, facts: [], visible: true, createdAt: '2026-09-11T10:00:00.000Z', updatedAt: '2026-09-11T10:00:00.000Z',
  imageAssetId: 'restaurant', imageAssetIds: ['restaurant'],
  members: [{ id: 'cafe', title: 'Café', subtitle: 'Kaffee', description: 'Kaffee und Kuchen', imageAssetIds: ['cafe-front', 'cafe-inside'], facts: [] }],
}

describe('group interface', () => {
  it('finds a group member in simulator search, opens its card and details, and keeps the root map marker', async () => {
    const select = vi.fn()
    const { container } = render(<MapCanvas backgroundUrl="/map.png" backgroundWidth={1000} backgroundHeight={600}
      items={[item]} categories={[category]} onSelect={select}
      getItemImageUrls={(entry) => entry.imageAssetIds?.map((id) => `/${id}.jpg`) ?? []} />)
    const ui = within(container)
    fireEvent.click(ui.getByRole('button', { name: 'Handy-Vorschau anzeigen' }))
    fireEvent.change(ui.getByRole('searchbox'), { target: { value: 'cafe' } })
    fireEvent.click(await ui.findByRole('option', { name: 'Café Gastronomie' }))
    expect(select).toHaveBeenLastCalledWith('root')
    expect(container.querySelectorAll('.map-canvas__marker-icon')).toHaveLength(1)
    expect(ui.queryByLabelText('Gruppe auswählen')).not.toBeInTheDocument()
    const quick = ui.getByLabelText('Café Vorschau')
    expect(quick.querySelector('img')).toHaveAttribute('src', '/cafe-front.jpg')
    fireEvent.click(within(quick).getByText('Café'))
    expect(ui.getByRole('dialog', { name: 'Café' })).toHaveTextContent('Kaffee und Kuchen')
    fireEvent.click(ui.getByRole('button', { name: 'Detailansicht schließen' }))
    fireEvent.change(ui.getByRole('searchbox'), { target: { value: 'Restaurant' } })
    fireEvent.click(ui.getByRole('option', { name: 'Restaurant Gastronomie' }))
    expect(ui.getByLabelText('Restaurant Vorschau')).toBeInTheDocument()
    expect(ui.queryByLabelText('Gruppe auswählen')).not.toBeInTheDocument()
  })

  it('opens the member requested from search and can reopen it after the user collapses it', () => {
    const props = { item, categories: [category], assetUrls: {}, onUpdate: vi.fn(), onChooseAsset: vi.fn(),
      onUpload: vi.fn(), onAddMember: vi.fn(), onRemoveMember: vi.fn(), onDeselect: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn() }
    const { container, rerender } = render(<GroupInspector {...props} focusEntry={{ entryId: 'root' }} />)
    const ui = within(container)
    expect(ui.getByLabelText('Name')).toHaveValue('Restaurant')
    rerender(<GroupInspector {...props} focusEntry={{ entryId: 'cafe' }} />)
    expect(ui.getByLabelText('Name')).toHaveValue('Café')
    fireEvent.click(ui.getByRole('button', { name: 'Café' }))
    expect(ui.queryByLabelText('Name')).not.toBeInTheDocument()
    rerender(<GroupInspector {...props} focusEntry={{ entryId: 'cafe' }} />)
    expect(ui.getByLabelText('Name')).toHaveValue('Café')
  })

  it('offers creation only for selected single markers, shows non-adding group counts in both modes, and opens member details', async () => {
    const add = vi.fn()
    const props = { backgroundUrl: '/map.png', backgroundWidth: 1000, backgroundHeight: 600, items: [item], categories: [category], onAddGroupMember: add,
      getItemImageUrls: (entry: MapItem) => entry.imageAssetIds?.map((id) => `/${id}.jpg`) ?? [] }
    const singleItem = { ...item, members: [] }
    const { container, rerender } = render(<MapCanvas {...props} items={[singleItem]} />)
    const ui = within(container)
    expect(ui.queryByLabelText('Punkt zur Gruppe hinzufügen')).not.toBeInTheDocument()
    rerender(<MapCanvas {...props} items={[singleItem]} selectedItemId="root" />)
    const addButton = await ui.findByLabelText('Punkt zur Gruppe hinzufügen')
    expect(addButton.querySelector('svg')).toHaveAttribute('viewBox', '0 0 19 19')
    expect(addButton.querySelector('path')).toHaveAttribute('stroke-width', '1.5')
    expect(addButton.querySelector('path')).toHaveAttribute('d', 'M9.5 4.5V14.5M4.5 9.5H14.5')
    fireEvent.click(addButton)
    expect(add).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledWith('root')
    rerender(<MapCanvas {...props} selectedItemId="root" />)
    expect(ui.queryByLabelText('Punkt zur Gruppe hinzufügen')).not.toBeInTheDocument()
    expect(container.querySelector('.map-marker-group__count')).toHaveTextContent('+1')
    fireEvent.click(container.querySelector('.map-marker-group__count')!)
    expect(add).toHaveBeenCalledTimes(1)
    rerender(<MapCanvas {...props} selectedItemId={null} />)
    expect(ui.queryByLabelText('Punkt zur Gruppe hinzufügen')).not.toBeInTheDocument()
    expect(container.querySelector('.map-marker-group__count')).toHaveTextContent('+1')
    fireEvent.click(container.querySelector('.map-marker-group__count')!)
    expect(add).toHaveBeenCalledTimes(1)
    fireEvent.click(ui.getByRole('button', { name: 'Handy-Vorschau anzeigen' }))
    expect(ui.queryByLabelText('Punkt zur Gruppe hinzufügen')).not.toBeInTheDocument()
    expect(container.querySelector('.map-marker-group__count')).toHaveTextContent('+1')
    expect(container.querySelectorAll('.map-canvas__marker-icon')).toHaveLength(1)
    fireEvent.click(ui.getByRole('button', { name: 'Restaurant' }))
    const picker = ui.getByLabelText('Gruppe auswählen')
    expect(within(picker).getAllByRole('button')).toHaveLength(3)
    expect(within(picker).getByRole('button', { name: 'Café' }).querySelector('img')).toHaveAttribute('src', '/cafe-front.jpg')
    fireEvent.click(within(picker).getByRole('button', { name: 'Café' }))
    expect(ui.queryByLabelText('Gruppe auswählen')).not.toBeInTheDocument()
    const quick = ui.getByLabelText('Café Vorschau')
    expect(quick.querySelector('img')).toHaveAttribute('src', '/cafe-front.jpg')
    fireEvent.click(within(quick).getByText('Café'))
    expect(ui.getByRole('dialog', { name: 'Café' })).toHaveTextContent('Kaffee und Kuchen')
    fireEvent.click(ui.getByRole('button', { name: 'Foto 2 von 2' }))
    expect(ui.getByRole('button', { name: 'Foto 2 von 2' })).toHaveAttribute('aria-current', 'true')
  })

  it('routes content, icon and styling edits to the member and allows collapsing, adding and removing', () => {
    const update = vi.fn(), choose = vi.fn(), add = vi.fn(), remove = vi.fn(), upload = vi.fn()
    const { container } = render(<GroupInspector item={item} categories={[category]} assetUrls={{}}
      onUpdate={update} onChooseAsset={choose} onUpload={upload} onAddMember={add} onRemoveMember={remove}
      onDeselect={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} />)
    const ui = within(container)
    expect(ui.getByRole('button', { name: 'Café' })).toHaveAttribute('aria-expanded', 'true')
    expect(ui.getByText('Markierungssymbol')).toBeInTheDocument()
    expect(ui.queryByLabelText('Kategorie')).not.toBeInTheDocument()
    fireEvent.change(ui.getByLabelText('Name'), { target: { value: 'Bistro' } })
    fireEvent.blur(ui.getByLabelText('Name'))
    expect(update).toHaveBeenCalledWith('cafe', { title: 'Bistro' })
    fireEvent.click(within(container.querySelector('.photo-gallery-editor')! as HTMLElement).getByRole('button', { name: 'Auswählen' }))
    expect(choose).toHaveBeenCalledWith('imageGallery', 'cafe')
    fireEvent.click(within(ui.getByRole('group', { name: 'Markierungssymbol' })).getByRole('button', { name: 'Auswählen' }))
    expect(choose).toHaveBeenCalledWith('iconAssetId', 'cafe')
    const icon = new File(['icon'], 'cafe.png', { type: 'image/png' })
    fireEvent.change(ui.getByLabelText('Symbol hochladen'), { target: { files: [icon] } })
    expect(upload).toHaveBeenCalledWith([icon], 'iconAssetId', 'cafe')
    fireEvent.click(ui.getByText('Individuelle Einstellungen'))
    fireEvent.click(ui.getByLabelText('Symbolgröße überschreiben'))
    expect(update).toHaveBeenCalledWith('cafe', { markerOverrides: { iconScale: 1 } })
    fireEvent.click(ui.getByRole('button', { name: 'Café' }))
    expect(ui.queryByLabelText('Name')).not.toBeInTheDocument()
    fireEvent.click(ui.getByRole('button', { name: 'Restaurant Hauptpunkt' }))
    expect(ui.getByText('Markierungssymbol')).toBeInTheDocument()
    expect(ui.queryByLabelText('Restaurant aus Gruppe entfernen')).not.toBeInTheDocument()
    fireEvent.click(ui.getByRole('button', { name: 'Neuer Punkt' }))
    expect(add).toHaveBeenCalledWith('root')
    fireEvent.click(ui.getByRole('button', { name: 'Café aus Gruppe entfernen' }))
    expect(remove).toHaveBeenCalledWith('root', 'cafe')
  })

  it('previews a member icon and falls back to the category icon after resetting it', () => {
    const update = vi.fn()
    const grouped = { ...item, iconAssetId: 'root-icon', members: [{ ...item.members![0], iconAssetId: 'cafe-icon' }] }
    const props = { item: grouped, categories: [{ ...category, defaultIconAssetId: 'category-icon' }], assetUrls: { 'root-icon': '/root.svg', 'cafe-icon': '/cafe.svg', 'category-icon': '/category.svg' },
      onUpdate: update, onChooseAsset: vi.fn(), onUpload: vi.fn(), onAddMember: vi.fn(), onRemoveMember: vi.fn(), onDeselect: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn() }
    const { container, rerender } = render(<GroupInspector {...props} />)
    const ui = within(container)
    expect(ui.getByAltText('Markierungssymbol')).toHaveAttribute('src', '/cafe.svg')
    fireEvent.click(ui.getByRole('button', { name: 'Standardsymbol verwenden' }))
    expect(update).toHaveBeenCalledWith('cafe', { iconAssetId: null })
    rerender(<GroupInspector {...props} item={{ ...grouped, members: [{ ...grouped.members[0], iconAssetId: null }] }} />)
    expect(ui.getByRole('img', { name: 'Markierungssymbol' })).toHaveStyle({ maskImage: 'url("/category.svg")' })
    expect(container.querySelector('.icon-preview')).toHaveStyle({ color: category.color })
    expect(ui.getByText('Aus der Kategorie')).toBeInTheDocument()
  })
})
