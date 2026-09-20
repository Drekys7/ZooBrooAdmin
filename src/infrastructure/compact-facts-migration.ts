import copy from '../domain/compact-map-facts.json'
import { MapProjectSchema, type MapFact } from '../domain'
import { StartupTemplateSchema } from '../application/startup-template'
import type { ZooMapLocalDatabase, AssetRow } from './local-database'

type FactText = Pick<MapFact, 'label' | 'value'>
const items: Record<string, { facts: Array<{ key: string; iconAssetId: string | null; de: FactText; en: FactText }> }> = copy

export async function migrateThreeFacts(database: ZooMapLocalDatabase): Promise<void> {
  const id = 'zooweb-main-three-facts-v1'
  await database.transaction('rw', database.projects, database.projectMigrations, async () => {
    if (await database.projectMigrations.get(id)) return
    const project = await database.projects.get('zooweb-main')
    if (!project) return
    await database.projectMigrations.add({ id, project, assets: [], createdAt: new Date().toISOString() })
    await database.projects.put(MapProjectSchema.parse({ ...project,
      items: project.items.map(item => ({ ...item, facts: item.facts.slice(0, 3),
        members: item.members?.map(member => ({ ...member, facts: member.facts.slice(0, 3) })),
      })), updatedAt: new Date().toISOString(),
    }))
  })
}

export async function migrateCompactFacts(database: ZooMapLocalDatabase): Promise<void> {
  const id = 'zooweb-main-compact-facts-v1'
  if (await database.projectMigrations.get(id) || !await database.projects.get('zooweb-main')) return
  // Restore only the existing reusable fact icons, never replace marker artwork.
  const response = await fetch('/startup-template.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('Faktensymbole konnten nicht geladen werden.')
  const template = StartupTemplateSchema.parse(await response.json())
  const icons: AssetRow[] = template.assets.filter(entry => entry.asset.id.startsWith('zooweb-fact-')).map(({asset, base64}) => ({
    ...asset, data: Uint8Array.from(atob(base64), char => char.charCodeAt(0)).buffer,
  }))
  await database.transaction('rw', database.projects, database.assets, database.projectMigrations, async () => {
    if (await database.projectMigrations.get(id)) return
    const project = await database.projects.get('zooweb-main')
    if (!project) return
    await database.projectMigrations.add({ id, project, assets: await database.assets.toArray(), createdAt: new Date().toISOString() })
    for (const icon of icons) if (!await database.assets.get(icon.id)) await database.assets.put(icon)
    await database.projects.put(MapProjectSchema.parse({ ...project,
      items: project.items.map(item => items[item.id] ? { ...item,
        facts: items[item.id].facts.map(fact => ({ id: `${item.id}-${fact.key}`, ...fact.de,
          iconAssetId: fact.iconAssetId, translations: {de: fact.de, en: fact.en},
        })),
      } : item), updatedAt: new Date().toISOString(),
    }))
  })
}
