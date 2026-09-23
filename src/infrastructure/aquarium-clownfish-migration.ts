import { MapProjectSchema, type MapItem } from '../domain'
import type { ZooMapLocalDatabase } from './local-database'

const revision = 'zooweb-main-aquarium-clownfish-v1'
const clownfishId = 'exhibit-animal-clownfish'

/** Keep the aquarium's identity/location while replacing its main animal. */
export function promoteAquariumClownfish(item: MapItem): MapItem {
  if (item.id !== 'map128-aquarium') return item
  const clownfish = item.members?.find(member => member.id === clownfishId)
  if (!clownfish) return item
  return {
    ...item, ...clownfish, id: item.id,
    iconAssetId: clownfish.iconAssetId ?? null,
    colorOverride: clownfish.colorOverride ?? null,
    markerOverrides: clownfish.markerOverrides ?? null,
    imageAssetId: clownfish.imageAssetId ?? null,
    imageAssetIds: clownfish.imageAssetIds,
    imageCredits: clownfish.imageCredits,
    translations: clownfish.translations,
    members: item.members!.filter(member => member.id !== clownfishId),
  }
}

export async function migrateAquariumClownfish(database: ZooMapLocalDatabase): Promise<void> {
  await database.transaction('rw', database.projects, database.projectMigrations, async () => {
    if (await database.projectMigrations.get(revision)) return
    const project = await database.projects.get('zooweb-main')
    if (!project) return
    const now = new Date().toISOString()
    const items = project.items.map(item => {
      const next = promoteAquariumClownfish(item)
      return next === item ? item : { ...next, updatedAt: now }
    })
    // Preserve recovery data and do not reset positions, other animals or custom content.
    await database.projectMigrations.add({ id: revision, project, assets: [], createdAt: now })
    if (items.some((item, index) => item !== project.items[index])) {
      await database.projects.put(MapProjectSchema.parse({ ...project, items, updatedAt: now }))
    }
  })
}
