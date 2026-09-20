import {StartupTemplateSchema} from '../application/startup-template'
import {MapProjectSchema, type MapItem} from '../domain'
import type {ZooMapLocalDatabase} from './local-database'
type MapGroupMember=NonNullable<MapItem['members']>[number]

/** Refresh only the requested photo bytes/credits, never the user's edited animal data. */
export async function migrateExhibitCloseups(database: ZooMapLocalDatabase): Promise<void> {
  const id='zooweb-main-exhibit-closeups-v3'
  if(await database.projectMigrations.get(id)||!await database.projects.get('zooweb-main'))return
  const response=await fetch('/startup-template.json',{cache:'no-store'})
  if(!response.ok)throw new Error('Neue Tierfotos konnten nicht geladen werden.')
  const template=StartupTemplateSchema.parse(await response.json())
  const photos=template.assets.filter(a=>a.asset.id.startsWith('exhibit-photo-'))
  if(photos.length!==20)throw new Error('Unvollständige Tierfotos.')
  const rows=photos.map(({asset,base64})=>{
    const data=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)).buffer
    if(data.byteLength!==asset.size||!asset.width||!asset.height||asset.width/asset.height>1.01||asset.width/asset.height<.55)throw new Error(`Ungültiges Tierfoto: ${asset.name}`)
    return {...asset,data}
  })
  const credits=Object.assign({},...template.project.items.flatMap(item=>[item,...item.members??[]]).map(item=>item.imageCredits??{}))
  const photoIds=new Set(rows.map(row=>row.id))
  const refresh=<T extends MapItem|MapGroupMember>(item:T):T=>{
    const ids=item.imageAssetIds??(item.imageAssetId?[item.imageAssetId]:[])
    const updates=Object.fromEntries(ids.filter(id=>photoIds.has(id)&&credits[id]).map(id=>[id,credits[id]]))
    return Object.keys(updates).length?{...item,imageCredits:{...item.imageCredits,...updates}}:item
  }
  await database.transaction('rw',database.projects,database.assets,database.projectMigrations,async()=>{
    if(await database.projectMigrations.get(id))return
    const project=await database.projects.get('zooweb-main');if(!project)return
    await database.projectMigrations.add({id,project,assets:await database.assets.toArray(),createdAt:new Date().toISOString()})
    await database.assets.bulkPut(rows)
    await database.projects.put(MapProjectSchema.parse({...project,items:project.items.map(item=>({...refresh(item),...(item.members?{members:item.members.map(refresh)}:{})})),updatedAt:new Date().toISOString()}))
  })
}
