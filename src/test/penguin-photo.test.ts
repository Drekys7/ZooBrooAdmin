import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { StartupTemplateSchema } from '../application/startup-template'
import { ZooMapLocalDatabase } from '../infrastructure/local-database'
import { migratePenguinPhoto } from '../infrastructure/penguin-photo-migration'

const raw = JSON.parse(readFileSync('public/startup-template.json', 'utf8'))
const template = StartupTemplateSchema.parse(raw)
const photoId = 'animal-photo-penguin-v2'
const oldId = 'animal-photo-penguin-v1'
const databases: ZooMapLocalDatabase[] = []
afterEach(() => { databases.forEach(db => db.close()); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function setup(custom = false) {
  const db = new ZooMapLocalDatabase(`penguin-${crypto.randomUUID()}`)
  databases.push(db)
  const project = structuredClone(template.project)
  const item = project.items.find(item => item.id === 'map128-penguin')!
  item.title = 'Edited penguin'
  item.position = { x: 0.2, y: 0.4 }
  item.imageAssetId = custom ? 'custom-photo' : oldId
  item.imageAssetIds = custom ? ['custom-photo'] : [oldId, 'custom-photo']
  item.imageCredits = { [oldId]: { author: 'Samuel Blanc', source: 'https://example.com/old', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', changes: 'resize-compress' } }
  await db.projects.put(project)
  const asset = template.assets.find(entry => entry.asset.id === photoId)!.asset
  await db.assets.put({ ...asset, id: oldId, size: 3, data: new Uint8Array([1, 2, 3]).buffer })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => raw }))
  return { db, project }
}

it('replaces only the old penguin photo, preserves edits and gallery, and runs once with recovery data', async () => {
  const { db, project } = await setup()
  await migratePenguinPhoto(db)
  const next = (await db.projects.get(project.id))!
  const penguin = next.items.find(item => item.id === 'map128-penguin')!
  expect(penguin.title).toBe('Edited penguin')
  expect(penguin.position).toEqual({ x: 0.2, y: 0.4 })
  expect(penguin.imageAssetIds).toEqual([photoId, 'custom-photo'])
  expect(penguin.imageAssetId).toBe(photoId)
  expect(penguin.imageCredits?.[photoId].author).toBe('dfaulder')
  expect(next.items.filter(item => item.id !== penguin.id)).toEqual(project.items.filter(item => item.id !== penguin.id))
  const asset = (await db.assets.get(photoId))!
  expect([asset.width, asset.height, asset.data.byteLength]).toEqual([853, 1280, 58722])
  expect((await db.projectMigrations.toArray())[0].project).toEqual(project)
  expect(new Uint8Array((await db.projectMigrations.toArray())[0].assets[0].data)).toEqual(new Uint8Array([1, 2, 3]))
  await migratePenguinPhoto(db)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('preserves a custom replacement photo', async () => {
  const { db, project } = await setup(true)
  await migratePenguinPhoto(db)
  expect(await db.projects.get(project.id)).toEqual(project)
  expect(await db.assets.get(photoId)).toBeUndefined()
})

it('keeps saved data unchanged on corrupt input or failed storage', async () => {
  const { db, project } = await setup()
  const corrupt = structuredClone(raw)
  corrupt.assets.find((entry: { asset: { id: string } }) => entry.asset.id === photoId).asset.size++
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => corrupt } as Response)
  await expect(migratePenguinPhoto(db)).rejects.toThrow('beschädigt')
  expect(await db.projects.get(project.id)).toEqual(project)
  expect(await db.projectMigrations.count()).toBe(0)
  vi.spyOn(db.projects, 'put').mockRejectedValueOnce(new Error('Storage full'))
  await expect(migratePenguinPhoto(db)).rejects.toThrow('Storage full')
  expect(await db.projects.get(project.id)).toEqual(project)
  expect(await db.assets.get(photoId)).toBeUndefined()
  expect(await db.projectMigrations.count()).toBe(0)
})
