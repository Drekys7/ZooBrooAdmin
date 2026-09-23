import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { MapProjectSchema } from '../domain'
import { StartupTemplateSchema } from '../application/startup-template'
import { ZooMapLocalDatabase } from '../infrastructure/local-database'
import { migrateExhibitFacts, standardizeExhibitFacts } from '../infrastructure/exhibit-facts-migration'
import { promoteAquariumClownfish } from '../infrastructure/aquarium-clownfish-migration'
import copy from '../domain/exhibit-facts.json'

const template = StartupTemplateSchema.parse(JSON.parse(readFileSync('public/startup-template.json', 'utf8')))
const original = MapProjectSchema.parse(JSON.parse(readFileSync('prepared-assets/baselines/chrome-2026-09-20.json', 'utf8')))
original.items = original.items.map(promoteAquariumClownfish)
const databases: ZooMapLocalDatabase[] = []
afterEach(() => { databases.forEach(db => db.close()); vi.restoreAllMocks() })

it('ships all 17 animals with bilingual region, lifespan and weight and the ordinary animal icons', () => {
  const entries = template.project.items.flatMap(item => [item, ...(item.members ?? [])]).filter(item => item.id in copy)
  expect(entries).toHaveLength(17)
  for (const entry of entries) {
    expect(entry.facts.map(fact => fact.label)).toEqual(['Region', 'Lebensdauer', 'Gewicht'])
    expect(entry.facts.map(fact => fact.translations?.en.label)).toEqual(['Region', 'Lifespan', 'Weight'])
    expect(entry.facts.map(fact => fact.iconAssetId)).toEqual(['zooweb-fact-region', 'zooweb-fact-lifespan', 'zooweb-fact-weight'])
    for (const fact of entry.facts) {
      expect(template.assets.some(asset => asset.asset.id === fact.iconAssetId)).toBe(true)
      expect(fact.translations?.de.value).toBeTruthy()
      expect(fact.translations?.en.value).toBeTruthy()
    }
  }
})

it('migrates saved groups once, preserving edited regions, layout, media, other animals and a recovery copy', async () => {
  const db = new ZooMapLocalDatabase(`facts-${crypto.randomUUID()}`); databases.push(db)
  const before = structuredClone(original)
  const root = before.items.find(item => item.id === 'map128-aquarium')!
  root.description = 'Edited description'
  root.position = { x: 0.2, y: 0.3 }
  root.members![0].facts[0].value = 'Edited region'
  await db.projects.put(before)
  await migrateExhibitFacts(db)
  const after = (await db.projects.get(before.id))!
  for (const [index, item] of after.items.entries()) {
    expect({ ...item, updatedAt: before.items[index].updatedAt }).toEqual(standardizeExhibitFacts(before.items[index]))
  }
  expect(after.items.find(item => item.id === root.id)!.members![0].facts[0].value).toBe('Edited region')
  expect((await db.projectMigrations.toArray())[0].project).toEqual(before)
  after.items.find(item => item.id === root.id)!.facts[1].value = 'Later edit'
  await db.projects.put(after)
  await migrateExhibitFacts(db)
  expect(await db.projects.get(before.id)).toEqual(after)
  expect(await db.projectMigrations.count()).toBe(1)
})

it('does not rewrite current templates and rolls back the backup if saving fails', async () => {
  const db = new ZooMapLocalDatabase(`facts-${crypto.randomUUID()}`); databases.push(db)
  await db.projects.put(original)
  vi.spyOn(db.projects, 'put').mockRejectedValueOnce(new Error('Storage full'))
  await expect(migrateExhibitFacts(db)).rejects.toThrow('Storage full')
  expect(await db.projects.get(original.id)).toEqual(original)
  expect(await db.projectMigrations.count()).toBe(0)
  await db.projects.put(template.project)
  await migrateExhibitFacts(db)
  expect(await db.projects.get(template.project.id)).toEqual(template.project)
})
