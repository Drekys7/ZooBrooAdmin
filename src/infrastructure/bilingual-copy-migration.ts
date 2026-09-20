import copy from '../domain/demo-map-copy.json'
import { MapProjectSchema, type MapItem, type MapCategory, type MapEvent, type MapFact } from '../domain'
import type { ZooMapLocalDatabase } from './local-database'

type ItemText = Pick<MapItem, 'title' | 'subtitle' | 'description'>
type FactText = Pick<MapFact, 'label' | 'value'>
const items: Record<string, { de: ItemText; en: ItemText; facts: Array<{ de: FactText; en: FactText }> }> = copy.items
const categories: Record<string, { de: Pick<MapCategory, 'name'>; en: Pick<MapCategory, 'name'> }> = copy.categories
const events: Record<string, { de: Pick<MapEvent, 'title' | 'description' | 'location'>; en: Pick<MapEvent, 'title' | 'description' | 'location'> }> = copy.events

export async function migrateBilingualCopy(database: ZooMapLocalDatabase): Promise<void> {
  const id = 'zooweb-main-bilingual-demo-copy-v1'
  await database.transaction('rw', database.projects, database.assets, database.projectMigrations, async () => {
    if (await database.projectMigrations.get(id)) return
    const project = await database.projects.get('zooweb-main')
    if (!project) return
    const assets = await database.assets.toArray()
    await database.projectMigrations.add({ id, project, assets, createdAt: new Date().toISOString() })
    const next = MapProjectSchema.parse({
      ...project, title: copy.title, defaultLocale: 'de', enabledLocales: ['de', 'en'],
      categories: project.categories.map(category => categories[category.id]
        ? { ...category, ...categories[category.id].de, translations: categories[category.id] } : category),
      items: project.items.map(item => {
        const content = items[item.id]
        if (!content) return item
        return { ...item, ...content.de, translations: { de: content.de, en: content.en },
          facts: content.facts.map((fact, index) => ({ id: `${item.id}-fact-${index}`, ...fact.de, iconAssetId: null, translations: fact })),
        }
      }),
      events: project.events.map(event => events[event.id] ? { ...event, ...events[event.id].de, translations: events[event.id] } : event),
      mapSettings: { ...project.mapSettings, zones: project.mapSettings.zones && {
        ...project.mapSettings.zones,
        labels: project.mapSettings.zones.labels.map(zone => ({ ...zone, translations: {
          de: zone.title, en: zone.translations.en || zone.title,
        } })),
      } },
      updatedAt: new Date().toISOString(),
    })
    for (const asset of assets) {
      const content = items[asset.id]
      if (content) await database.assets.update(asset.id, { name: `${content.de.title}.png` })
    }
    await database.projects.put(next)
  })
}
