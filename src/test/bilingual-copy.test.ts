import { readFileSync } from 'node:fs'
import { afterEach, expect, it } from 'vitest'
import { StartupTemplateSchema } from '../application/startup-template'
import { localizeItem, translationCompletion } from '../domain/localization'
import { ZooMapLocalDatabase } from '../infrastructure/local-database'
import { migrateBilingualCopy } from '../infrastructure/bilingual-copy-migration'

const template = StartupTemplateSchema.parse(JSON.parse(readFileSync('public/startup-template.json', 'utf8')))
const databases: ZooMapLocalDatabase[] = []
afterEach(() => databases.forEach(database => database.close()))

it('has complete German and English text and facts for all 41 cards, without Russian', () => {
  const p = template.project
  expect(p.enabledLocales).toEqual(['de', 'en'])
  expect(p.items).toHaveLength(41)
  expect(translationCompletion('en', 'de', p.categories, p.items, p.events)).toBe(100)
  expect(JSON.stringify(p)).not.toMatch(/[\u0400-\u04ff]/)
  for (const item of p.items) {
    expect(item.facts).toHaveLength(3)
    for (const locale of ['de', 'en']) {
      const localized = localizeItem(item, locale, 'de')
      expect(localized.title.length).toBeGreaterThan(2)
      expect(localized.description.length).toBeGreaterThan(100)
      expect(localized.facts.every(fact => fact.label.trim() && fact.value.trim())).toBe(true)
    }
  }
})

it('updates text once and keeps positions, visual settings and later edits', async () => {
  const db = new ZooMapLocalDatabase(`copy-${crypto.randomUUID()}`)
  databases.push(db)
  const old = structuredClone(template.project)
  old.items[0].title = 'Old title'
  old.items[0].position = { x: 0.2, y: 0.3 }
  await db.projects.put(old)
  await migrateBilingualCopy(db)
  const next = (await db.projects.get(old.id))!
  expect(next.items[0].title).toBe('Wolf')
  expect(next.items[0].position).toEqual(old.items[0].position)
  expect(next.categories[0].iconScale).toBe(old.categories[0].iconScale)
  next.items[0].description = 'User edited this'
  await db.projects.put(next)
  await migrateBilingualCopy(db)
  expect((await db.projects.get(old.id))!.items[0].description).toBe('User edited this')
})
