import { StartupTemplateSchema } from '../application/startup-template'
import type { ZooMapLocalDatabase } from './local-database'

const revision = 'zooweb-main-fennec-photo-v2'
const oldId = 'animal-photo-fennec-v1'
const photoId = 'animal-photo-fennec-v2'

/** Replace the built-in fennec photograph without resetting saved map edits. */
export async function migrateFennecPhoto(database: ZooMapLocalDatabase): Promise<void> {
  if (await database.projectMigrations.get(revision)) return
  const current = await database.projects.get('zooweb-main')
  if (!current) return
  const response = await fetch(`${import.meta.env.BASE_URL}startup-template.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Das neue Fennekfoto konnte nicht geladen werden.')
  const template = StartupTemplateSchema.parse(await response.json())
  const photo = template.assets.find(entry => entry.asset.id === photoId)
  const credit = template.project.items.find(item => item.id === 'map128-fennec')?.imageCredits?.[photoId]
  if (!photo || !credit) throw new Error('Das neue Fennekfoto ist unvollständig.')
  const data = Uint8Array.from(atob(photo.base64), char => char.charCodeAt(0)).buffer
  if (data.byteLength !== photo.asset.size) throw new Error('Das neue Fennekfoto ist beschädigt.')

  await database.transaction('rw', database.projects, database.assets, database.projectMigrations, async () => {
    if (await database.projectMigrations.get(revision)) return
    const project = await database.projects.get(current.id)
    if (!project) return
    const previous = await database.assets.get(oldId)
    const now = new Date().toISOString()
    await database.projectMigrations.add({ id: revision, project, assets: previous ? [previous] : [], createdAt: now })
    let changed = false
    const items = project.items.map(item => {
      if (item.id !== 'map128-fennec' || (item.imageAssetId !== oldId && !item.imageAssetIds?.includes(oldId))) return item
      changed = true
      const imageCredits: NonNullable<typeof item.imageCredits> = { ...item.imageCredits, [photoId]: credit }
      delete imageCredits[oldId]
      return { ...item, imageAssetId: item.imageAssetId === oldId ? photoId : item.imageAssetId,
        imageAssetIds: item.imageAssetIds?.map(id => id === oldId ? photoId : id), imageCredits, updatedAt: now }
    })
    if (changed) {
      await database.assets.put({ ...photo.asset, data })
      await database.projects.put({ ...project, items, updatedAt: now })
    }
  })
}
