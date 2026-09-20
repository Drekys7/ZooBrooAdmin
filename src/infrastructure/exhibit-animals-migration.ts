import { StartupTemplateSchema } from '../application/startup-template'
import { MapProjectSchema } from '../domain'
import type { ZooMapLocalDatabase } from './local-database'

export async function migrateExhibitAnimals(database: ZooMapLocalDatabase): Promise<void> {
  const id = 'zooweb-main-exhibit-animals-v3'
  if (await database.projectMigrations.get(id) || !await database.projects.get('zooweb-main')) return
  const response = await fetch('/startup-template.json', {cache: 'no-store'})
  if (!response.ok) throw new Error('Ausstellungstiere konnten nicht geladen werden.')
  const template = StartupTemplateSchema.parse(await response.json())
  const groupIds = ['map128-aquarium', 'map128-terrarium', 'map128-spider-house']
  for (const groupId of groupIds) {
    if (template.project.items.find(item => item.id === groupId)?.members?.length !== 5) throw new Error('Unvollständige Tiergruppe.')
  }
  const rows = template.assets.filter(entry => entry.asset.id.startsWith('exhibit-')).map(({asset, base64}) => {
    const data = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer
    if (data.byteLength !== asset.size) throw new Error(`Unvollständiges Bild: ${asset.name}`)
    return {...asset, data}
  })
  if (rows.length !== 35) throw new Error('Unvollständige Ausstellungsbilder.')
  await database.transaction('rw', database.projects, database.assets, database.projectMigrations, async () => {
    if (await database.projectMigrations.get(id)) return
    const project = await database.projects.get('zooweb-main')
    if (!project) return
    await database.projectMigrations.add({id, project, assets: await database.assets.toArray(), createdAt: new Date().toISOString()})
    await database.assets.bulkPut(rows)
    const items = project.items.map(item => {
      const source = template.project.items.find(entry => entry.id === item.id)
      if (!source) return item
      if (item.id === 'map128-lion') return {...item, imageAssetId: source.imageAssetId, imageAssetIds: source.imageAssetIds, imageCredits: source.imageCredits}
      if (!groupIds.includes(item.id)) return item
      // Preserve the edited location, category and visual settings of each existing building.
      return {...item, title: source.title, subtitle: source.subtitle, description: source.description,
        translations: source.translations, facts: source.facts, members: source.members,
        imageAssetId: source.imageAssetId, imageAssetIds: source.imageAssetIds, imageCredits: source.imageCredits}
    })
    await database.projects.put(MapProjectSchema.parse({...project, items, updatedAt: new Date().toISOString()}))
  })
}
