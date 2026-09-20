import {readFileSync} from 'node:fs'
import {afterEach, expect, it, vi} from 'vitest'
import {StartupTemplateSchema} from '../application/startup-template'
import {ZooMapLocalDatabase} from '../infrastructure/local-database'
import {resetTestRelease, TEST_RELEASE_RESET_ID} from '../infrastructure/test-release-reset'
const raw=JSON.parse(readFileSync('public/startup-template.json','utf8'))
const template=StartupTemplateSchema.parse(raw)
const databases:ZooMapLocalDatabase[]=[]
afterEach(()=>{databases.forEach(db=>db.close());vi.restoreAllMocks();vi.unstubAllGlobals()})
async function setup(){
 const db=new ZooMapLocalDatabase(`reset-${crypto.randomUUID()}`);databases.push(db)
 const old={...structuredClone(template.project),id:'imported-project',title:'User edits',updatedAt:'2099-01-01T00:00:00.000Z'}
 await db.projects.put(old)
 await db.table('published').put({id:'old-publication',projectId:old.id})
 const asset={...template.assets[0].asset,id:'old-asset',data:new ArrayBuffer(1)}
 await db.assets.put(asset)
 await db.projectMigrations.put({id:'old-backup',project:old,assets:[asset],createdAt:old.createdAt})
 return {db,old}
}
function mockFetch(value:unknown=raw){vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>value}))}
it('replaces every project and all old assets/publications/backups once, including imported project IDs',async()=>{
 const {db}=await setup();mockFetch()
 await resetTestRelease(db)
 expect(await db.projects.toArray()).toEqual([template.project])
 expect(await db.assets.count()).toBe(template.assets.length)
 expect(await db.assets.get('old-asset')).toBeUndefined()
 expect(await db.published.count()).toBe(0)
 expect((await db.projectMigrations.toArray()).map(m=>m.id)).toEqual([TEST_RELEASE_RESET_ID])
 await db.projects.update(template.project.id,{title:'Edits after reset'})
 await resetTestRelease(db)
 expect((await db.projects.get(template.project.id))!.title).toBe('Edits after reset')
 expect(fetch).toHaveBeenCalledTimes(1)
})
it('does not delete anything if the template download fails',async()=>{
 const {db,old}=await setup()
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}))
 await expect(resetTestRelease(db)).rejects.toThrow()
 expect(await db.projects.toArray()).toEqual([old])
 expect(await db.assets.get('old-asset')).toBeDefined()
 expect(await db.published.count()).toBe(1)
 expect(await db.projectMigrations.get(TEST_RELEASE_RESET_ID)).toBeUndefined()
})
it('rejects missing/corrupt media before deleting existing data',async()=>{
 const {db,old}=await setup()
 const corrupt=structuredClone(raw);corrupt.assets[0].asset.size++
 mockFetch(corrupt)
 await expect(resetTestRelease(db)).rejects.toThrow('Unvollständige Ressource')
 expect(await db.projects.toArray()).toEqual([old])
 mockFetch({...raw,assets:[]})
 await expect(resetTestRelease(db)).rejects.toThrow('Ressource der Testkarte fehlt')
 expect(await db.assets.get('old-asset')).toBeDefined()
})
it('rolls back deletion if storage fails during installation',async()=>{
 const {db,old}=await setup();mockFetch()
 vi.spyOn(db.assets,'bulkPut').mockRejectedValueOnce(new Error('Storage full'))
 await expect(resetTestRelease(db)).rejects.toThrow('Storage full')
 expect(await db.projects.toArray()).toEqual([old])
 expect(await db.assets.get('old-asset')).toBeDefined()
 expect(await db.published.count()).toBe(1)
 expect(await db.projectMigrations.get('old-backup')).toBeDefined()
 expect(await db.projectMigrations.get(TEST_RELEASE_RESET_ID)).toBeUndefined()
})
it('installs the same release into an empty browser',async()=>{
 const db=new ZooMapLocalDatabase(`fresh-${crypto.randomUUID()}`);databases.push(db);mockFetch()
 await resetTestRelease(db)
 expect(await db.projects.toArray()).toEqual([template.project])
 expect(await db.projectMigrations.get(TEST_RELEASE_RESET_ID)).toBeDefined()
})
