import {StartupTemplateSchema} from '../application/startup-template'
import type {ZooMapLocalDatabase} from './local-database'

// TEST PHASE ONLY: increment deliberately to discard every browser's local edits again.
export const TEST_RELEASE_REVISION = '2026-09-24-approved-baseline-v1'
export const TEST_RELEASE_RESET_ID = `test-release-reset:${TEST_RELEASE_REVISION}`

export async function resetTestRelease(database: ZooMapLocalDatabase): Promise<void> {
  if (await database.projectMigrations.get(TEST_RELEASE_RESET_ID)) return
  // Fetch, parse and validate everything before touching the old data. A failed load is retryable.
  const response = await fetch(`${import.meta.env.BASE_URL}startup-template.json`, {cache: 'no-store'})
  if (!response.ok) throw new Error('Die neue Testkarte konnte nicht geladen werden. Bitte neu laden.')
  const template = StartupTemplateSchema.parse(await response.json())
  const assetIds = new Set(template.assets.map(entry => entry.asset.id))
  if (assetIds.size !== template.assets.length) throw new Error('Doppelte Ressourcen in der Testkarte.')
  const references = [template.project.backgroundAssetId,
    ...template.project.categories.map(category => category.defaultIconAssetId),
    ...template.project.items.flatMap(item => [item, ...(item.members ?? [])]).flatMap(item => [
      item.iconAssetId, item.imageAssetId, ...(item.imageAssetIds ?? []), ...item.facts.map(fact => fact.iconAssetId),
    ]),
  ]
  if (references.some(id => id && !assetIds.has(id))) throw new Error('Eine Ressource der Testkarte fehlt.')
  const rows = template.assets.map(({asset, base64}) => {
    const data = Uint8Array.from(atob(base64), char => char.charCodeAt(0)).buffer
    if (data.byteLength !== asset.size) throw new Error(`Unvollständige Ressource: ${asset.name}`)
    return {...asset, data}
  })
  await database.transaction('rw', database.projects, database.assets, database.published, database.projectMigrations, async () => {
    if (await database.projectMigrations.get(TEST_RELEASE_RESET_ID)) return
    // Explicitly approved test-data reset. All four tables belong only to this admin app.
    await database.projects.clear()
    await database.assets.clear()
    await database.published.clear()
    await database.projectMigrations.clear()
    await database.assets.bulkPut(rows)
    await database.projects.put(template.project)
    // This is a completion marker, not a backup of deleted data.
    await database.projectMigrations.put({id: TEST_RELEASE_RESET_ID, project: template.project, assets: [], createdAt: new Date().toISOString()})
  })
}
