import copy from '../domain/exhibit-facts.json'
import { MapProjectSchema, type MapFact, type MapItem } from '../domain'
import type { ZooMapLocalDatabase } from './local-database'

const revision = 'zooweb-main-exhibit-facts-v1'
const values: Record<string, { lifespan: string[]; weight: string[] }> = copy
const groupIds = new Set(['map128-aquarium', 'map128-terrarium', 'map128-spider-house'])

function updateFacts<T extends Pick<MapItem, 'id' | 'facts'>>(entry: T): T {
  const data = values[entry.id]
  if (!data) return entry
  const region = entry.facts.find(fact => fact.iconAssetId === 'zooweb-fact-region'
    || fact.label === 'Region')
  // Never replace an edited region with a hard-coded default.
  if (!region) return entry
  const facts: MapFact[] = [{ ...region, iconAssetId: 'zooweb-fact-region' }]
  for (const [key, deLabel, enLabel] of [
    ['lifespan', 'Lebensdauer', 'Lifespan'], ['weight', 'Gewicht', 'Weight'],
  ] as const) {
    const de = { label: deLabel, value: data[key][0] }
    const en = { label: enLabel, value: data[key][1] }
    facts.push({ id: `${entry.id}-${key}`, ...de, iconAssetId: `zooweb-fact-${key}`, translations: { de, en } })
  }
  return JSON.stringify(facts) === JSON.stringify(entry.facts) ? entry : { ...entry, facts }
}

/** Update only facts in the three requested groups, retaining all other content. */
export function standardizeExhibitFacts(item: MapItem): MapItem {
  if (!groupIds.has(item.id)) return item
  const next = updateFacts(item)
  const members = item.members?.map(updateFacts)
  return members?.some((member, index) => member !== item.members![index]) ? { ...next, members } : next
}

export async function migrateExhibitFacts(database: ZooMapLocalDatabase): Promise<void> {
  await database.transaction('rw', database.projects, database.projectMigrations, async () => {
    if (await database.projectMigrations.get(revision)) return
    const project = await database.projects.get('zooweb-main')
    if (!project) return
    const now = new Date().toISOString()
    const items = project.items.map(item => {
      const next = standardizeExhibitFacts(item)
      return next === item ? item : { ...next, updatedAt: now }
    })
    await database.projectMigrations.add({ id: revision, project, assets: [], createdAt: now })
    if (items.some((item, index) => item !== project.items[index])) {
      await database.projects.put(MapProjectSchema.parse({ ...project, items, updatedAt: now }))
    }
  })
}
