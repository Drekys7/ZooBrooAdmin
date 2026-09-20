import {readFileSync} from 'node:fs'
import {afterEach, expect, it, vi} from 'vitest'
import {StartupTemplateSchema} from '../application/startup-template'
import {groupEntries} from '../domain/groups'
import {localizeItem, translationCompletion} from '../domain/localization'
import {ZooMapLocalDatabase} from '../infrastructure/local-database'
import {migrateExhibitAnimals} from '../infrastructure/exhibit-animals-migration'
const raw = readFileSync('public/startup-template.json','utf8')
const template = StartupTemplateSchema.parse(JSON.parse(raw))
const ids = ['map128-aquarium','map128-terrarium','map128-spider-house']
const databases: ZooMapLocalDatabase[] = []
afterEach(()=>{databases.forEach(db=>db.close());vi.unstubAllGlobals()})
it('contains three six-animal groups with individual icons, JPEG photos and bilingual copy',()=>{
  for(const id of ids){
    const root = template.project.items.find(i=>i.id===id)!
    expect(root.iconAssetId).toBe(id)
    expect(root.members).toHaveLength(5)
    const entries=groupEntries(root)
    expect(new Set(entries.map(i=>i.iconAssetId)).size).toBe(6)
    for(const item of entries){
      expect(item.facts).toHaveLength(3)
      for(const locale of ['de','en']){
        const localized=localizeItem(item,locale,'de')
        expect(localized.description.length).toBeGreaterThan(100)
        expect(localized.title).not.toBe('')
      }
      const photo=template.assets.find(a=>a.asset.id===item.imageAssetId)!
      expect(photo.asset.mimeType).toBe('image/jpeg')
      expect(Buffer.from(photo.base64,'base64').length).toBe(photo.asset.size)
      expect(item.imageCredits?.[item.imageAssetId!].author).toBeTruthy()
      const icon=template.assets.find(a=>a.asset.id===item.iconAssetId)!
      expect(icon.asset.width).toBe(128)
      expect(icon.asset.height).toBe(128)
    }
  }
  expect(translationCompletion('en','de',template.project.categories,template.project.items,[])).toBe(100)
  const lion=template.project.items.find(i=>i.id==='map128-lion')!
  expect(new Set(lion.imageAssetIds).size).toBe(3)
  for(const id of lion.imageAssetIds!) expect(template.assets.some(a=>a.asset.id===id)).toBe(true)
})
it('migrates once with a recovery snapshot and preserves locations, unrelated content and later edits',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>JSON.parse(raw)}))
  const db=new ZooMapLocalDatabase(`exhibits-${crypto.randomUUID()}`);databases.push(db)
  const before=structuredClone(template.project)
  const root=before.items.find(i=>i.id===ids[0])!
  root.position={x:.2,y:.3};root.title='Old';root.members=[]
  before.items[0].description='Keep user copy'
  await db.projects.put(before)
  await migrateExhibitAnimals(db)
  const after=(await db.projects.get(before.id))!
  expect(after.items.find(i=>i.id===ids[0])!.position).toEqual(root.position)
  expect(after.items.find(i=>i.id===ids[0])!.members).toHaveLength(5)
  expect(after.items[0]).toEqual(before.items[0])
  expect(await db.assets.count()).toBe(35)
  expect((await db.projectMigrations.toArray())[0].project).toEqual(before)
  after.items.find(i=>i.id===ids[0])!.title='Later edit';await db.projects.put(after)
  await migrateExhibitAnimals(db)
  expect((await db.projects.get(before.id))!.items.find(i=>i.id===ids[0])!.title).toBe('Later edit')
  expect(fetch).toHaveBeenCalledTimes(1)
})
