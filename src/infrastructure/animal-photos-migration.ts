import { StartupTemplateSchema } from '../application/startup-template'
import { MapProjectSchema } from '../domain'
import type { ZooMapLocalDatabase } from './local-database'

export async function migrateAnimalPhotos(database: ZooMapLocalDatabase): Promise<void> {
  const id = 'zooweb-main-animal-photos-v1'
  if (await database.projectMigrations.get(id) || !await database.projects.get('zooweb-main')) return
  const response = await fetch('/startup-template.json', {cache:'no-store'})
  if (!response.ok) throw new Error('Tierfotos konnten nicht geladen werden.')
  const template = StartupTemplateSchema.parse(await response.json())
  const photos = template.assets.filter(entry=>entry.asset.id.startsWith('animal-photo-'))
  if (photos.length !== 29) throw new Error('Unvollständige Tierfotos.')
  const rows = photos.map(({asset,base64})=>{
    const data = Uint8Array.from(atob(base64),c=>c.charCodeAt(0)).buffer
    if (data.byteLength !== asset.size) throw new Error(`Unvollständiges Foto: ${asset.name}`)
    return {...asset,data}
  })
  await database.transaction('rw',database.projects,database.assets,database.projectMigrations,async()=>{
    if (await database.projectMigrations.get(id)) return
    const project=await database.projects.get('zooweb-main')
    if (!project) return
    await database.projectMigrations.add({id,project,assets:await database.assets.toArray(),createdAt:new Date().toISOString()})
    await database.assets.bulkPut(rows)
    await database.projects.put(MapProjectSchema.parse({...project,
      items:project.items.map(item=>{
        const source=template.project.items.find(entry=>entry.id===item.id && entry.type==='animal')
        if(!source?.imageAssetId?.startsWith('animal-photo-')) return item
        // Use the requested photo first; retain any previously added gallery images.
        const previous=item.imageAssetIds?.length?item.imageAssetIds:item.imageAssetId?[item.imageAssetId]:[]
        return {...item,imageAssetId:source.imageAssetId,
          imageAssetIds:[source.imageAssetId,...previous.filter(assetId=>assetId!==source.imageAssetId)],
          imageCredits:{...item.imageCredits,...source.imageCredits},
        }
      }),updatedAt:new Date().toISOString(),
    }))
  })
}
