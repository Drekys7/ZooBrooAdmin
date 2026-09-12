import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import L from 'leaflet'
import { MapCanvas } from './MapCanvas'
import { DEFAULT_MAP_SETTINGS, type MapItem } from '../domain'
import { DEFAULT_ZONES, ZoneSchema } from '../domain/zones'
import { ZoneSidebar, ZoneInspector } from './ZoneEditor'

it('shows the selected content translation on the map, list and inspector and falls back when absent', async () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
  let zone = ZoneSchema.parse({ id: 'zone', title: 'Deutsche Zone', translations: { en: 'English zone' }, position: { x: .5, y: .5 } })
  let settings = { ...DEFAULT_ZONES, labels: [zone] }
  const view = (locale: string) => <>
    <MapCanvas backgroundUrl="/map.png" backgroundWidth={1000} backgroundHeight={600} items={[]} categories={[]} defaultLocale="de" contentLocale={locale} zoneEditMode mapSettings={{ ...DEFAULT_MAP_SETTINGS, zones: settings }}/>
    <ZoneSidebar locale={locale} defaultLocale="de" settings={settings} selectedId={null} onSelect={vi.fn()} onAdd={vi.fn()} adding={false} onChange={vi.fn()} fontUrls={{}} fontNames={{}} onFontUpload={vi.fn()}/>
    <ZoneInspector zone={zone} locale={locale} defaultLocale="de" onChange={vi.fn()} onDelete={vi.fn()} onDuplicate={vi.fn()}/>
  </>
  const ui = render(view('en'))
  await waitFor(() => expect(ui.container.querySelector('.map-zone-label')).toHaveTextContent('English zone'))
  expect(ui.container.querySelector('.zone-list')).toHaveTextContent('English zone')
  expect(ui.getByRole('heading', { name: 'English zone' })).toBeInTheDocument()
  zone = { ...zone, translations: { en: 'Updated English name' } }
  settings = { ...settings, labels: [zone] }
  ui.rerender(view('en'))
  expect(ui.container.querySelector('.map-zone-label')).toHaveTextContent('Updated English name')
  for (const locale of ['de', 'fr']) {
    ui.rerender(view(locale))
    expect(ui.container.querySelector('.map-zone-label')).toHaveTextContent('Deutsche Zone')
    expect(ui.container.querySelector('.zone-list')).toHaveTextContent('Deutsche Zone')
    expect(ui.getByRole('heading', { name: 'Deutsche Zone' })).toBeInTheDocument()
  }
})

it('updates the visitor zoom threshold from the left sidebar', () => {
  const change = vi.fn()
  const ui = render(<ZoneSidebar settings={DEFAULT_ZONES} selectedId={null} onSelect={vi.fn()} onAdd={vi.fn()} adding={false} onChange={change} fontUrls={{}} fontNames={{}} onFontUpload={vi.fn()}/>)
  fireEvent.change(ui.getByRole('slider', { name: 'Umschaltpunkt' }), { target: { value: '150' } })
  expect(change).toHaveBeenLastCalledWith({ ...DEFAULT_ZONES, threshold: 1.5 })
  fireEvent.change(ui.getByRole('slider', { name: 'Schriftgröße' }), { target: { value: '32' } })
  expect(change.mock.lastCall?.[0].appearance.fontSize).toBe(32)
})

afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('uses the selected editor layer at every zoom and automatic switching only in phone preview', async () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
  const zoomSpy = vi.spyOn(L.Map.prototype, 'zoomOut')
  const zone = ZoneSchema.parse({ id: 'zone', title: '<Kajanaland>', position: { x: .5, y: .5 } })
  const item: MapItem = { id: 'animal', categoryId: 'animals', type: 'animal', title: 'Löwe', subtitle: '', description: '', facts: [], visible: true, position: { x: .5, y: .5 }, createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-12T00:00:00.000Z' }
  const props = { backgroundUrl: '/map.png', backgroundWidth: 1000, backgroundHeight: 600, items: [item], categories: [], getItemIconUrl: () => '/lion.png', mapSettings: { ...DEFAULT_MAP_SETTINGS, zones: { ...DEFAULT_ZONES, enabled: false, labels: [zone] } } }
  const select = vi.fn()
  const { container, rerender } = render(<MapCanvas {...props} zoneEditMode onSelectZone={select}/>)
  await waitFor(() => expect(container.querySelector('.map-zone-label')).not.toBeNull())
  const label = container.querySelector('.map-zone-label')!
  expect(label).toHaveTextContent('<Kajanaland>')
  expect(label.querySelector('kajanaland')).toBeNull()
  expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1)
  fireEvent.click(label)
  expect(select).toHaveBeenCalledWith('zone')
  rerender(<MapCanvas {...props} zoneEditMode={false}/>)
  expect(container.querySelector('.map-zone-label')).toBeNull()
  expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1)
  rerender(<MapCanvas {...props} mapSettings={{ ...props.mapSettings, zones: { ...props.mapSettings.zones, enabled: true, threshold: 1 } }}/>)
  expect(container.querySelector('.map-zone-label')).toBeNull()
  expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1)
  fireEvent.click(container.querySelector('[aria-label="Verkleinern"]')!)
  const editorMap = zoomSpy.mock.instances[0]
  act(() => { editorMap.setZoom(editorMap.getMinZoom(), { animate: false }) })
  expect(container.querySelector('.map-zone-label')).toBeNull()
  rerender(<MapCanvas {...props} zoneEditMode mapSettings={{ ...props.mapSettings, zones: { ...props.mapSettings.zones, enabled: true, threshold: 1 } }}/>)
  act(() => { editorMap.setZoom(editorMap.getMaxZoom(), { animate: false }) })
  expect(container.querySelector('.map-zone-label')).not.toBeNull()
  expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1)
  act(() => { editorMap.setZoom(editorMap.getMinZoom(), { animate: false }) })
  fireEvent.click(container.querySelector('[aria-label="Handy-Vorschau anzeigen"]')!)
  await waitFor(() => expect(container.querySelector('.map-zone-label')).not.toBeNull())
  for (let step = 0; step < 4; step++) fireEvent.click(container.querySelector('[aria-label="Vergrößern"]')!)
  await waitFor(() => expect(container.querySelector('.map-zone-label')).toBeNull())
  expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1)
  for (let step = 0; step < 6; step++) fireEvent.click(container.querySelector('[aria-label="Verkleinern"]')!)
  // jsdom disables 3D transforms, so Leaflet rounds half-step zooms to whole steps.
  const map = zoomSpy.mock.instances[0]
  act(() => { map.setZoom(map.getMinZoom(), { animate: false }) })
  await waitFor(() => expect(container.querySelector('.map-zone-label')).not.toBeNull())
  expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1)
  fireEvent.click(container.querySelector('[aria-label="Desktopansicht anzeigen"]')!)
  expect(container.querySelector('.map-zone-label')).not.toBeNull()
})



