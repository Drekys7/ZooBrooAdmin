import {readFileSync} from 'node:fs'
import {afterEach,expect,it,vi} from 'vitest'
import {StartupTemplateSchema} from '../application/startup-template'
import {ZooMapLocalDatabase} from '../infrastructure/local-database'
import {migrateAnimalPhotos} from '../infrastructure/animal-photos-migration'
const raw=readFileSync('public/startup-template.json','utf8')
const template=StartupTemplateSchema.parse(JSON.parse(raw))
const databases:ZooMapLocalDatabase[]=[]
afterEach(()=>{databases.forEach(db=>db.close());vi.unstubAllGlobals()})
it('has 29 optimized JPEG photos with credits and keeps the marker icons',()=>{
  const animals=template.project.items.filter(i=>i.type==='animal')
  expect(animals).toHaveLength(29)
  for(const item of animals){
    const asset=template.assets.find(a=>a.asset.id===item.imageAssetId)!
    expect(asset.asset.mimeType).toBe('image/jpeg')
    expect(asset.asset.size).toBeLessThan(320000)
    expect(item.iconAssetId).toBe(item.id)
    expect(item.facts).toHaveLength(3)
    expect(item.imageCredits?.[item.imageAssetId!].source).toContain('commons.wikimedia.org')
    expect(Buffer.from(asset.base64,'base64').length).toBe(asset.asset.size)
  }
  expect(template.project.items.find(i=>i.id==='map128-crocodile')!.imageCredits?.['animal-photo-crocodile-v1'].author).toBe('Leigh Bedford')
})
it('installs photos once, preserves existing galleries and creates a recovery snapshot',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>JSON.parse(raw)}))
  const db=new ZooMapLocalDatabase(`photos-${crypto.randomUUID()}`);databases.push(db)
  const old=structuredClone(template.project)
  old.items[0].imageAssetId='user-photo';old.items[0].imageAssetIds=['user-photo']
  await db.projects.put(old)
  await migrateAnimalPhotos(db)
  const next=(await db.projects.get(old.id))!
  expect(next.items[0].imageAssetIds).toEqual(['animal-photo-wolf-v1','user-photo'])
  expect(next.items[0].position).toEqual(old.items[0].position)
  expect(await db.assets.count()).toBe(29)
  next.items[0].imageAssetIds=['user-photo'];await db.projects.put(next)
  await migrateAnimalPhotos(db)
  expect((await db.projects.get(old.id))!.items[0].imageAssetIds).toEqual(['user-photo'])
  expect(await db.projectMigrations.count()).toBe(1)
})
