import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { StartupTemplateSchema } from '../application/startup-template'
import { localizeItem } from '../domain/localization'
import { ZooMapLocalDatabase } from '../infrastructure/local-database'
import { migrateCompactFacts, migrateThreeFacts } from '../infrastructure/compact-facts-migration'

const raw = readFileSync('public/startup-template.json','utf8')
const template = StartupTemplateSchema.parse(JSON.parse(raw))
const databases: ZooMapLocalDatabase[] = []
afterEach(() => { databases.forEach(db=>db.close()); vi.unstubAllGlobals() })

it('has compact translated facts and the ready-made icons for every animal', () => {
  for (const item of template.project.items) {
    expect(item.facts).toHaveLength(3)
    for (const locale of ['de','en']) {
      const facts = localizeItem(item,locale,'de').facts.slice(0,3)
      for (const fact of facts) expect(`${fact.label}: ${fact.value}`.length).toBeLessThanOrEqual(29)
    }
    if (item.type === 'animal') {
      expect(item.facts.slice(0,3).map(f=>f.iconAssetId)).toEqual(['zooweb-fact-region','zooweb-fact-lifespan','zooweb-fact-weight'])
      for (const fact of item.facts.filter(f=>f.iconAssetId)) expect(template.assets.some(a=>a.asset.id === fact.iconAssetId)).toBe(true)
      expect(item.facts.some(f=>f.label === 'Wissenschaftlicher Name')).toBe(false)
    }
  }
})

it('trims existing facts to three without resetting edited text and keeps a recovery snapshot', async () => {
  const db = new ZooMapLocalDatabase(`three-${crypto.randomUUID()}`)
  databases.push(db)
  const old = structuredClone(template.project)
  for (const item of old.items) item.facts.push({id:`${item.id}-extra`,label:'Extra',value:'Remove'})
  old.items[0].facts[0].value = 'Custom region'
  await db.projects.put(old)
  await migrateThreeFacts(db)
  const next = (await db.projects.get(old.id))!
  expect(next.items.every(item=>item.facts.length === 3)).toBe(true)
  expect(next.items[0]).toEqual({...old.items[0],facts:old.items[0].facts.slice(0,3)})
  expect((await db.projectMigrations.get('zooweb-main-three-facts-v1'))!.project.items[0].facts).toHaveLength(4)
  await migrateThreeFacts(db)
  expect(await db.projectMigrations.count()).toBe(1)
})

it('migrates once, restores fact icons, and preserves descriptions, coordinates and later edits', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async()=>JSON.parse(raw)}))
  const db = new ZooMapLocalDatabase(`compact-${crypto.randomUUID()}`)
  databases.push(db)
  const old = structuredClone(template.project)
  old.items[0].facts = []
  old.items[0].description = 'My description'
  await db.projects.put(old)
  await migrateCompactFacts(db)
  const next = (await db.projects.get(old.id))!
  expect(next.items[0].facts[0].label).toBe('Region')
  expect(next.items[0].position).toEqual(old.items[0].position)
  expect(next.items[0].description).toBe('My description')
  expect(await db.assets.get('zooweb-fact-weight')).toBeDefined()
  next.items[0].facts[0].value = 'Edited later'
  await db.projects.put(next)
  await migrateCompactFacts(db)
  expect((await db.projects.get(old.id))!.items[0].facts[0].value).toBe('Edited later')
  expect(fetch).toHaveBeenCalledTimes(1)
})
