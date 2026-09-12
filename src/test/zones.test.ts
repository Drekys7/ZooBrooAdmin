import { describe, expect, it } from 'vitest'
import { DEFAULT_ZONES, ZoneSchema, ZoneSettingsSchema, showZones, zoneAppearance } from '../domain/zones'
import { createEmptyProject } from '../domain'
import { buildPublishedSnapshot, exportProjectToJson, importProjectFromJson, setBackground, updateMapSettings } from '../application'
import { DEFAULT_TYPOGRAPHY } from '../domain/typography'

const zone = ZoneSchema.parse({ id: 'kajanaland', title: 'KAJANALAND', position: { x: .4, y: .6 } })
describe('zone layer', () => {
  it('preserves shared legacy appearance when deleting the first zone', () => {
    const labels = [{ ...zone, backgroundColor: '#FFDD00' }, { ...zone, id: 'second', backgroundColor: '#000000' }]
    const project = createEmptyProject()
    project.mapSettings.zones = { ...DEFAULT_ZONES, labels }
    expect(zoneAppearance(project.mapSettings.zones).backgroundColor).toBe('#FFDD00')
    const updated = updateMapSettings(project, { patch: { zones: { ...DEFAULT_ZONES, labels: [labels[1]] } } })
    expect(zoneAppearance(updated.mapSettings.zones).backgroundColor).toBe('#FFDD00')
    const edited = updateMapSettings(updated, { patch: { zones: { ...updated.mapSettings.zones!, appearance: { ...zoneAppearance(updated.mapSettings.zones), fontSize: 36 } } } })
    expect(importProjectFromJson(exportProjectToJson(edited)).mapSettings.zones?.appearance?.fontSize).toBe(36)
  })
  it('switches at the configured boundary and keeps icons when no visible zones exist', () => {
    const settings = { ...DEFAULT_ZONES, labels: [zone], threshold: .8 }
    expect(showZones(settings, .8)).toBe(true)
    expect(showZones(settings, .81)).toBe(false)
    expect(showZones({ ...settings, enabled: false }, .5)).toBe(false)
    expect(showZones({ ...settings, labels: [] }, .5)).toBe(false)
    expect(showZones({ ...settings, labels: [{ ...zone, visible: false }] }, .5)).toBe(false)
  })
  it('validates rectangles, coordinates and unique IDs', () => {
    expect(ZoneSchema.safeParse({ ...zone, borderWidth: 0 }).success).toBe(false)
    expect(ZoneSchema.safeParse({ ...zone, position: { x: 2, y: .5 } }).success).toBe(false)
    expect(ZoneSettingsSchema.safeParse({ labels: [zone, zone] }).success).toBe(false)
  })
  it('round-trips labels, translations and an independent published font', () => {
    const project = updateMapSettings(setBackground(createEmptyProject(), { assetId: 'map', width: 1000, height: 600 }), { patch: { zones: {
      ...DEFAULT_ZONES, labels: [{ ...zone, translations: { en: 'Kajanaland' }, backgroundColor: '#FFFFEE' }],
      typography: { ...DEFAULT_TYPOGRAPHY, preset: 'custom', regularAssetId: 'zone-font' },
    } } })
    expect(importProjectFromJson(exportProjectToJson(project))).toEqual(project)
    const published = buildPublishedSnapshot(project, 1, undefined, id => `https://example.org/${id}`)
    expect(published.mapSettings.zones?.labels).toEqual(project.mapSettings.zones?.labels)
    expect(published.mapSettings.zones?.typography?.regular?.url).toBe('https://example.org/zone-font')
    expect(published.mapSettings.typography).toBeUndefined()
  })
})
