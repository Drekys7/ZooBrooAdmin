import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { StartupTemplateSchema } from '../application/startup-template'
import { ZooMapLocalDatabase } from '../infrastructure/local-database'
import { migrateFennecPhoto } from '../infrastructure/fennec-photo-migration'

const raw = JSON.parse(readFileSync('public/startup-template.json', 'utf8'))
const template = StartupTemplateSchema.parse(raw)
const photoId = 'animal-photo-fennec-v2'
const oldId = 'animal-photo-fennec-v1'
const databases: ZooMapLocalDatabase[] = []
afterEach(() => { databases.forEach(db => db.close()); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function setup(custom = false) {
  const db = new ZooMapLocalDatabase(`fennec-${crypto.randomUUID()}`)
  databases.push(db)
  const project = structuredClone(template.project)
  const item = project.items.find(item => item.id === 'map128-fennec')!
  item.title = 'Edited fennec'
  item.position = { x: 0.2, y: 0.4 }
  item.imageAssetId = custom ? 'custom-photo' : oldId
  item.imageAssetIds = custom ? ['custom-photo'] : [oldId, 'custom-photo']
  item.imageCredits = { [oldId]: { author: 'Bachounda', source: 'https://example.com/old', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', changes: 'resize-compress' } }
  await db.projects.put(project)
  const asset = template.assets.find(entry => entry.asset.id === photoId)!.asset
  await db.assets.put({ ...asset, id: oldId, size: 3, data: new Uint8Array([1, 2, 3]).buffer })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => raw }))
  return { db, project }
}

it('replaces only the old fennec photo, preserves edits and gallery, and runs once with recovery data', async () => {
  const { db, project } = await setup()
  await migrateFennecPhoto(db)
  const next = (await db.projects.get(project.id))!
  const fennec = next.items.find(item => item.id === 'map128-fennec')!
  expect(fennec.title).toBe('Edited fennec')
  expect(fennec.position).toEqual({ x: 0.2, y: 0.4 })
  expect(fennec.imageAssetIds).toEqual([photoId, 'custom-photo'])
  expect(fennec.imageAssetId).toBe(photoId)
  expect(fennec.imageCredits?.[photoId].author).toBe('Sergey Galyonkin')
  expect(next.items.filter(item => item.id !== fennec.id)).toEqual(project.items.filter(item => item.id !== fennec.id))
  const asset = (await db.assets.get(photoId))!
  expect([asset.width, asset.height, asset.data.byteLength]).toEqual([947, 1280, 100373])
  expect((await db.projectMigrations.toArray())[0].project).toEqual(project)
  expect(new Uint8Array((await db.projectMigrations.toArray())[0].assets[0].data)).toEqual(new Uint8Array([1, 2, 3]))
  await migrateFennecPhoto(db)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('preserves a custom replacement photo', async () => {
  const { db, project } = await setup(true)
  await migrateFennecPhoto(db)
  expect(await db.projects.get(project.id)).toEqual(project)
  expect(await db.assets.get(photoId)).toBeUndefined()
})

it('keeps saved data unchanged on corrupt input or failed storage', async () => {
  const { db, project } = await setup()
  const corrupt = structuredClone(raw)
  corrupt.assets.find((entry: { asset: { id: string } }) => entry.asset.id === photoId).asset.size++
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => corrupt } as Response)
  await expect(migrateFennecPhoto(db)).rejects.toThrow('beschädigt')
  expect(await db.projects.get(project.id)).toEqual(project)
  expect(await db.projectMigrations.count()).toBe(0)
  vi.spyOn(db.projects, 'put').mockRejectedValueOnce(new Error('Storage full'))
  await expect(migrateFennecPhoto(db)).rejects.toThrow('Storage full')
  expect(await db.projects.get(project.id)).toEqual(project)
  expect(await db.assets.get(photoId)).toBeUndefined()
  expect(await db.projectMigrations.count()).toBe(0)
})
