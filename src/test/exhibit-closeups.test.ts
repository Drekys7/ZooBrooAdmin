import {readFileSync} from 'node:fs'
import {afterEach,expect,it,vi} from 'vitest'
import {StartupTemplateSchema} from '../application/startup-template'
import {ZooMapLocalDatabase} from '../infrastructure/local-database'
import {migrateExhibitCloseups} from '../infrastructure/exhibit-closeups-migration'
const raw=readFileSync('public/startup-template.json','utf8')
const template=StartupTemplateSchema.parse(JSON.parse(raw))
const databases:ZooMapLocalDatabase[]=[]
afterEach(()=>{databases.forEach(db=>db.close());vi.unstubAllGlobals()})
it('uses square or portrait JPEGs with cropping instead of synthetic padding',()=>{
 const photos=template.assets.filter(a=>a.asset.id.startsWith('exhibit-photo-'))
 expect(photos).toHaveLength(20)
 const lion=photos.find(p=>p.asset.id==='exhibit-photo-lion-2-v1')!
 expect(lion.asset.width).toBe(960)
 expect(lion.asset.height).toBe(960)
 for(const {asset,base64} of photos){
  expect(asset.mimeType).toBe('image/jpeg')
  expect(asset.width!/asset.height!).toBeGreaterThanOrEqual(.55)
  expect(asset.width!/asset.height!).toBeLessThanOrEqual(1.01)
  expect(Buffer.from(base64,'base64').length).toBe(asset.size)
 }
 for(const item of template.project.items.flatMap(i=>[i,...i.members??[]])){
  for(const [id,credit]of Object.entries(item.imageCredits??{}))if(id.startsWith('exhibit-photo-')){
   expect(credit.changes).toBe('crop-resize-compress')
   expect(credit.author).toBeTruthy()
  }
 }
})
it('refreshes only photo bytes/credits and preserves edited content, gallery order and icons',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>JSON.parse(raw)}))
 const db=new ZooMapLocalDatabase(`closeups-${crypto.randomUUID()}`);databases.push(db)
 const before=structuredClone(template.project)
 const root=before.items.find(i=>i.id==='map128-aquarium')!
 root.title='User title';root.position={x:.3,y:.4}
 root.members![0].description='User description';root.members![0].iconAssetId='user-icon'
 root.imageAssetIds=['user-photo',root.imageAssetId!]
 root.imageCredits![root.imageAssetId!].author='Old author'
 const expected=structuredClone(before)
 expected.items.find(i=>i.id===root.id)!.imageCredits=template.project.items.find(i=>i.id===root.id)!.imageCredits
 await db.projects.put(before)
 await migrateExhibitCloseups(db)
 const result=(await db.projects.get(before.id))!
 expect(result.items).toEqual(expected.items)
 expect(await db.assets.count()).toBe(20)
 expect((await db.projectMigrations.toArray())[0].project).toEqual(before)
 await migrateExhibitCloseups(db)
 expect(fetch).toHaveBeenCalledTimes(1)
})
