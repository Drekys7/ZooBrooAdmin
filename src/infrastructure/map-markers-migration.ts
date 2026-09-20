import { MapProjectSchema, type MapProject } from '../domain'
import { StartupTemplateSchema } from '../application/startup-template'
import { ZooMapLocalDatabase, type AssetRow } from './local-database'
import roadsidePositions from '../domain/roadside-marker-positions.json'
import habitatLayout from '../domain/habitat-zone-layout.json'
import { ZoneSettingsSchema } from '../domain/zones'

const revision = 'zooweb-main-markers-128-v1'

export async function migrateServiceCategories(database: ZooMapLocalDatabase): Promise<void> {
  const id = 'zooweb-main-separate-service-categories-v1'
  await database.transaction('rw', database.projects, database.projectMigrations, async () => {
    if (await database.projectMigrations.get(id)) return
    const project = await database.projects.get('zooweb-main')
    if (!project) return
    const services = project.categories.find(category => category.id === 'services')
    if (!services) return
    await database.projectMigrations.add({ id, project, assets: [], createdAt: new Date().toISOString() })
    const definitions = [
      { id: 'first-aid', name: 'Медпункт', color: '#d23c45', defaultIconAssetId: 'map128-first-aid', en: 'First aid' },
      { id: 'information', name: 'Информация', color: '#246eac', defaultIconAssetId: 'map128-information', en: 'Information' },
    ]
    const categories = project.categories.flatMap(category => category.id === services.id
      ? definitions.map(({ en, ...definition }) => ({ ...services, ...definition, colorizeIcon: true,
        translations: { [project.defaultLocale]: { name: definition.name }, en: { name: en } },
      }))
      : [category]).map((category, sortOrder) => ({ ...category, sortOrder }))
    const items = project.items.map(item => {
      if (item.categoryId !== services.id) return item
      const categoryId = item.iconAssetId === 'map128-first-aid' || item.id === 'map128-first-aid' ? 'first-aid' : 'information'
      return { ...item, categoryId }
    })
    await database.projects.put(MapProjectSchema.parse({ ...project, categories, items, updatedAt: new Date().toISOString() }))
  })
}

export async function migrateHabitatZones(database: ZooMapLocalDatabase): Promise<void> {
  const id = 'zooweb-main-habitat-zones-v2'
  await database.transaction('rw', database.projects, database.projectMigrations, async () => {
    if (await database.projectMigrations.get(id)) return
    const project = await database.projects.get('zooweb-main')
    if (!project) return
    const zones = ZoneSettingsSchema.parse({
      enabled: true, threshold: 2.7,
      typography: { preset: 'manrope', regularAssetId: null, boldAssetId: null, variable: false },
      appearance: habitatLayout.appearance,
      labels: habitatLayout.labels.map(label => ({ ...habitatLayout.appearance, ...label })),
    })
    await database.projectMigrations.add({ id, project, assets: [], createdAt: new Date().toISOString() })
    await database.projects.put({ ...project, mapSettings: { ...project.mapSettings, minZoomScale: 1, zones }, updatedAt: new Date().toISOString() })
  })
}

export async function migrateRoadsidePositions(database: ZooMapLocalDatabase): Promise<void> {
  const id = 'zooweb-main-roadside-positions-v2'
  await database.transaction('rw', database.projects, database.projectMigrations, async () => {
    if (await database.projectMigrations.get(id)) return
    const project = await database.projects.get('zooweb-main')
    if (!project || !project.items.some(item => item.id.startsWith('map128-'))) return
    await database.projectMigrations.add({ id, project, assets: [], createdAt: new Date().toISOString() })
    const positions: Record<string, number[]> = roadsidePositions
    const items = project.items.map(item => {
      const point = positions[item.id.replace(/^map128-/, '')]
      return point && item.id.startsWith('map128-')
        ? { ...item, position: { x: point[0] / 1254, y: point[1] / 1254 } }
        : item
    })
    await database.projects.put({ ...project, items, updatedAt: new Date().toISOString() })
  })
}

export async function migrateRestroomIcon(database: ZooMapLocalDatabase): Promise<void> {
  const current = await database.assets.get('map128-restroom')
  if (!current || current.name !== 'Туалет.png') return
  const response = await fetch('/map-icons/optimized-128/facilities/restroom.png?v=2', { cache: 'no-store' })
  if (!response.ok) throw new Error('Das aktualisierte Toilettensymbol konnte nicht geladen werden.')
  const data = await response.arrayBuffer()
  await database.transaction('rw', database.assets, async () => {
    const asset = await database.assets.get(current.id)
    if (asset?.name !== 'Туалет.png') return
    await database.assets.put({ ...asset, name: 'Туалет-v2.png', size: data.byteLength, data })
  })
}

// One-time replacement requested by the editor owner. The transaction retains a
// complete local backup and ensures a failed import cannot leave a partial map.
export async function migrateMapMarkers(database: ZooMapLocalDatabase): Promise<void> {
  if (await database.projectMigrations.get(revision)) return
  const current = await database.projects.get('zooweb-main')
  if (!current) return
  const response = await fetch('/startup-template.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('Die neuen Kartensymbole konnten nicht geladen werden.')
  const template = StartupTemplateSchema.parse(await response.json())
  if (template.project.id !== current.id || !template.project.items.some(item => item.id === 'map128-wolf')) {
    throw new Error('Die neue Kartenvorlage ist unvollständig.')
  }
  const rows: AssetRow[] = template.assets.map(({ asset, base64 }) => {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
    if (bytes.byteLength !== asset.size) throw new Error(`Unvollständige Ressource: ${asset.name}`)
    return { ...asset, data: bytes.buffer }
  })
  await database.transaction('rw', database.projects, database.assets, database.projectMigrations, async () => {
    if (await database.projectMigrations.get(revision)) return
    const project = await database.projects.get(current.id)
    if (!project) return
    const assets = await database.assets.toArray()
    await database.projectMigrations.add({ id: revision, project, assets, createdAt: new Date().toISOString() })
    const next: MapProject = MapProjectSchema.parse({
      ...project,
      backgroundAssetId: template.project.backgroundAssetId,
      backgroundWidth: template.project.backgroundWidth,
      backgroundHeight: template.project.backgroundHeight,
      categories: template.project.categories,
      items: template.project.items,
      mapSettings: { ...project.mapSettings, factIcons: [] },
      events: project.events.map(event => ({ ...event, relatedItemId: null })),
      updatedAt: new Date().toISOString(),
    })
    // Assets belonging to other projects and custom fonts are not this map's media.
    const otherProjects = (await database.projects.toArray()).filter(entry => entry.id !== project.id)
    const otherProjectData = JSON.stringify(otherProjects)
    const removed = assets.filter(asset => asset.kind !== 'font' && !otherProjectData.includes(JSON.stringify(asset.id)))
    await database.assets.bulkDelete(removed.map(asset => asset.id))
    await database.assets.bulkPut(rows.filter(row => row.kind !== 'font'))
    await database.projects.put(next)
  })
}
