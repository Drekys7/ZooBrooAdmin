import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { MapProjectSchema } from '../domain'
import { StartupTemplateSchema } from '../application/startup-template'
import { ZooMapLocalDatabase } from '../infrastructure/local-database'
import { migrateAquariumClownfish } from '../infrastructure/aquarium-clownfish-migration'

const template = StartupTemplateSchema.parse(JSON.parse(readFileSync('public/startup-template.json', 'utf8')))
const original = MapProjectSchema.parse(JSON.parse(readFileSync('prepared-assets/baselines/chrome-2026-09-20.json', 'utf8')))
const databases: ZooMapLocalDatabase[] = []
afterEach(() => { databases.forEach(db => db.close()); vi.restoreAllMocks() })

it('ships a clownfish-led aquarium without the blue damselfish or a duplicate clownfish', () => {
  const aquarium = template.project.items.find(item => item.id === 'map128-aquarium')!
  expect(aquarium.title).toBe('Falscher Clownfisch')
  expect(aquarium.translations?.en.title).toBe('Ocellaris Clownfish')
  expect(aquarium.iconAssetId).toBe('exhibit-icon-clownfish-v1')
  expect(aquarium.imageAssetIds).toEqual(['exhibit-photo-clownfish-v1'])
  expect(aquarium.members?.map(member => member.id)).toEqual([
    'exhibit-animal-yellow-tang', 'exhibit-animal-lionfish', 'exhibit-animal-seahorse', 'exhibit-animal-cardinalfish',
  ])
  expect(JSON.stringify(template.project.items)).not.toMatch(/Blauer Riffbarsch|Blue Damselfish|blue-damselfish/)
})

it('promotes the saved member with its edits and preserves location, remaining animals and other content', async () => {
  const db = new ZooMapLocalDatabase(`aquarium-${crypto.randomUUID()}`); databases.push(db)
  const before = structuredClone(original)
  const root = before.items.find(item => item.id === 'map128-aquarium')!
  root.position = { x: 0.25, y: 0.35 }
  root.groupBadgeColor = '#123456'
  root.members![0].description = 'Edited clownfish description'
  const clownfish = root.members![0]
  await db.projects.put(before)
  await migrateAquariumClownfish(db)
  const after = (await db.projects.get(before.id))!
  const updated = after.items.find(item => item.id === root.id)!
  expect(updated).toMatchObject({ ...clownfish, id: root.id, position: root.position, groupBadgeColor: root.groupBadgeColor })
  expect(updated.members).toEqual(root.members!.slice(1))
  expect(updated.imageCredits).toEqual(clownfish.imageCredits)
  expect(after.items.filter(item => item.id !== root.id)).toEqual(before.items.filter(item => item.id !== root.id))
  expect(after.categories).toEqual(before.categories)
  expect(after.events).toEqual(before.events)
  expect((await db.projectMigrations.toArray())[0].project).toEqual(before)
  await db.projects.put({ ...after, title: 'Later edit' })
  await migrateAquariumClownfish(db)
  expect((await db.projects.get(before.id))!.title).toBe('Later edit')
  expect(await db.projectMigrations.count()).toBe(1)
})

it('leaves an already updated map intact and rolls back when saving fails', async () => {
  const db = new ZooMapLocalDatabase(`aquarium-${crypto.randomUUID()}`); databases.push(db)
  await db.projects.put(original)
  vi.spyOn(db.projects, 'put').mockRejectedValueOnce(new Error('Storage full'))
  await expect(migrateAquariumClownfish(db)).rejects.toThrow('Storage full')
  expect(await db.projects.get(original.id)).toEqual(original)
  expect(await db.projectMigrations.count()).toBe(0)
  await db.projects.put(template.project)
  await migrateAquariumClownfish(db)
  expect(await db.projects.get(template.project.id)).toEqual(template.project)
})
