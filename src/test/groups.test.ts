import { describe, expect, it } from 'vitest'
import { createCategory, createItem, updateItem, duplicateItem, exportProjectToJson, importProjectFromJson, setBackground, buildPublishedSnapshot, updateProjectLanguages } from '../application'
import { createEmptyProject, groupEntries, itemIconAssetId, itemIconColor, localizeItem, MapProjectSchema, type CategoryType } from '../domain'
import { createLocalApplication } from '../infrastructure'
import { CommandHistory } from '../application/history'

const now = '2026-09-11T10:00:00.000Z'
function groupedProject(type: CategoryType = 'animal') {
  const project = createCategory(createEmptyProject({ id: 'groups-test', now }), {
    id: 'category', name: 'Kategorie', type, color: '#226644', visible: true, now,
  })
  return createItem(project, {
    id: 'primary', categoryId: 'category', title: 'Hauptpunkt', position: { x: 0.5, y: 0.5 },
    imageAssetId: 'primary-photo', iconAssetId: 'primary-icon',
    members: [{ id: 'member', title: 'Zweiter Punkt', subtitle: '', description: 'Eigener Text',
      imageAssetIds: ['photo-a', 'photo-b'], facts: [{ id: 'fact', label: 'Region', value: 'Europa' }] }], now,
  })
}

describe('map groups', () => {
  it('ignores the removed group picker setting when loading an existing project', () => {
    const original = groupedProject()
    const saved = { ...original, mapSettings: { ...original.mapSettings, groupSelectionStyle: 'fan' } }
    const loaded = importProjectFromJson(JSON.stringify(saved))
    expect(loaded.mapSettings).toEqual(original.mapSettings)
    expect(loaded.items).toEqual(original.items)
    expect(loaded.mapSettings).not.toHaveProperty('groupSelectionStyle')
  })
  it('persists, duplicates and publishes a separate group badge color and supports undo', async () => {
    const original = setBackground(groupedProject(), { assetId: 'map', width: 1000, height: 600, now })
    const history = new CommandHistory()
    const project = history.execute(original, { type: 'updateItem', affectedEntityType: 'item', affectedEntityId: 'primary' },
      (current) => updateItem(current, { itemId: 'primary', patch: { groupBadgeColor: '#AA3366' }, now }))
    expect(project.items[0].groupBadgeColor).toBe('#AA3366')
    expect(project.categories).toEqual(original.categories)
    expect(project.items[0].members).toEqual(original.items[0].members)
    expect(importProjectFromJson(exportProjectToJson(project))).toEqual(project)
    expect(duplicateItem(project, { itemId: 'primary', id: 'copy', now }).items[1].groupBadgeColor).toBe('#AA3366')
    expect(buildPublishedSnapshot(project, 1, now, (id) => `/assets/${id}`).items[0].groupBadgeColor).toBe('#AA3366')
    expect(history.undo(project)?.project.items[0].groupBadgeColor).toBeUndefined()
    expect(history.redo(original)?.project.items[0].groupBadgeColor).toBe('#AA3366')
    expect(updateItem(project, { itemId: 'primary', patch: { groupBadgeColor: null }, now }).items[0].groupBadgeColor).toBeNull()
    expect(() => updateItem(project, { itemId: 'primary', patch: { groupBadgeColor: 'red' }, now })).toThrow()
    const app = createLocalApplication(`badge-${crypto.randomUUID()}`)
    try {
      await app.contentRepository.save(project)
      expect((await app.contentRepository.get(project.id))?.items[0].groupBadgeColor).toBe('#AA3366')
    } finally { app.close() }
  })

  it.each(['primary', 'member'])('resets new icon colors to white and restores category inheritance on removal (%s)', (itemId) => {
    let project = updateItem(groupedProject(), { itemId, patch: { markerOverrides: { color: '#FF0000', iconScale: 1.5 }, colorOverride: '#0000FF' }, now })
    project = updateItem(project, { itemId, patch: { iconAssetId: 'new-icon' }, now })
    let entry = groupEntries(project.items[0]).find((entry) => entry.id === itemId)!
    expect(entry.markerOverrides).toEqual({ color: '#FFFFFF', iconScale: 1.5 })
    expect(entry.colorOverride).toBeNull()
    expect(itemIconColor(entry, project.categories[0])).toBe('#FFFFFF')
    project = updateItem(project, { itemId, patch: { title: 'Unchanged color' }, now })
    expect(groupEntries(project.items[0]).find((entry) => entry.id === itemId)?.markerOverrides?.color).toBe('#FFFFFF')
    project = updateItem(project, { itemId, patch: { iconAssetId: null }, now })
    entry = groupEntries(project.items[0]).find((entry) => entry.id === itemId)!
    expect(entry.markerOverrides).toEqual({ iconScale: 1.5 })
    expect(itemIconColor(entry, project.categories[0])).toBe(project.categories[0].color)
    expect(itemIconColor({ ...entry, markerOverrides: { color: '#FFFFFF' } }, { color: '#123456' })).toBe('#123456')
  })

  it.each(['animal', 'restaurant', 'restroom', 'souvenir', 'entrance', 'custom'] as CategoryType[])('edits member content without changing the primary marker (%s)', (type) => {
    const original = groupedProject(type)
    const updated = updateItem(original, { itemId: 'member', patch: { title: 'Neuer Titel', iconAssetId: 'member-icon', markerOverrides: { iconScale: 1.5 }, position: { x: 0, y: 0 } }, now })
    expect(updated.items).toHaveLength(1)
    expect(updated.items[0]).toMatchObject({ title: 'Hauptpunkt', iconAssetId: 'primary-icon', position: { x: 0.5, y: 0.5 } })
    expect(updated.items[0].members?.[0].title).toBe('Neuer Titel')
    expect(updated.items[0].members?.[0]).toMatchObject({ iconAssetId: 'member-icon', markerOverrides: { iconScale: 1.5 } })
    expect(updated.items[0].members?.[0]).not.toHaveProperty('position')
    expect(groupEntries(updated.items[0])[1]).toMatchObject({ iconAssetId: 'member-icon', markerOverrides: { iconScale: 1.5 } })
    expect(original.items[0].members?.[0].title).toBe('Zweiter Punkt')
    expect(groupEntries(updated.items[0])[1].type).toBe(type)
  })

  it('does not inherit the primary photo or translations for a blank member', () => {
    const item = groupedProject().items[0]
    item.members![0].imageAssetIds = undefined
    const member = groupEntries(item)[1]
    expect(member.imageAssetId).toBeNull()
    expect(member.translations).toBeUndefined()
    expect(member.iconAssetId).toBeNull()
  })

  it('persists and round-trips every member and its ordered photos', async () => {
    const project = updateItem(groupedProject(), { itemId: 'member', patch: { iconAssetId: 'member-icon', markerOverrides: { markerStyle: 'pin', iconScale: 1.5 } }, now })
    expect(importProjectFromJson(exportProjectToJson(project))).toEqual(project)
    const app = createLocalApplication(`groups-${crypto.randomUUID()}`)
    try {
      await app.contentRepository.save(project)
      expect(await app.contentRepository.get(project.id)).toEqual(project)
    } finally { app.close() }
  })

  it('duplicates member and fact IDs and rejects colliding IDs', () => {
    const project = groupedProject()
    const duplicate = duplicateItem(project, { itemId: 'primary', id: 'copy', now })
    expect(duplicate.items[1].members?.[0].id).not.toBe('member')
    expect(duplicate.items[1].members?.[0].facts[0].id).not.toBe('fact')
    expect(duplicate.items[1].members?.[0].imageAssetIds).toEqual(['photo-a', 'photo-b'])
    project.items[0].members![0].id = 'primary'
    expect(MapProjectSchema.safeParse(project).success).toBe(false)
  })

  it('publishes member content and galleries without extra markers', () => {
    const project = setBackground(groupedProject(), { assetId: 'map', width: 1000, height: 600, now })
    const snapshot = buildPublishedSnapshot(project, 1, now, (id) => `/assets/${id}`)
    expect(snapshot.items).toHaveLength(1)
    expect(snapshot.items[0].members?.[0]).toMatchObject({ id: 'member', image: { assetId: 'photo-a' }, images: [{ assetId: 'photo-a' }, { assetId: 'photo-b' }] })
    expect(snapshot.items[0].members?.[0].icon).toBeNull()
    expect(snapshot.items[0].members?.[0]).not.toHaveProperty('position')
  })

  it('publishes a member icon and styling independently of the map marker', () => {
    const project = setBackground(updateItem(groupedProject(), { itemId: 'member', patch: { iconAssetId: 'member-icon', markerOverrides: { iconScale: 1.5 } }, now }), { assetId: 'map', width: 1000, height: 600, now })
    const snapshot = buildPublishedSnapshot(project, 1, now, (id) => `/assets/${id}`)
    expect(snapshot.items[0].icon?.assetId).toBe('primary-icon')
    expect(snapshot.items[0].members?.[0]).toMatchObject({ icon: { assetId: 'member-icon', url: '/assets/member-icon' }, markerOverrides: { iconScale: 1.5 } })
  })

  it('resolves own and category icons without inheriting the primary member icon', () => {
    const root = groupedProject().items[0]
    const member = groupEntries(root)[1]
    const category = { defaultIconAssetId: 'category-icon' }
    expect(itemIconAssetId({ iconAssetId: 'own' }, category)).toBe('own')
    expect(itemIconAssetId(member, category)).toBe('category-icon')
    expect(itemIconAssetId(member, { defaultIconAssetId: null })).toBeNull()
    expect(itemIconAssetId(member)).toBeNull()
    expect(member.iconAssetId).toBeNull()
  })

  it('preserves member texts across language changes and returns to a single marker after removal', () => {
    let project = groupedProject()
    project = updateItem(project, { itemId: 'member', patch: { translations: { en: { title: 'Second point' } } }, now })
    project = updateProjectLanguages(project, { defaultLocale: 'en', enabledLocales: ['de', 'en'], now })
    expect(localizeItem(project.items[0], 'de', 'en').members?.[0].title).toBe('Zweiter Punkt')
    expect(localizeItem(project.items[0], 'en', 'en').members?.[0].title).toBe('Second point')
    project = updateItem(project, { itemId: 'primary', patch: { members: [] }, now })
    expect(groupEntries(project.items[0])).toHaveLength(1)
  })
})
