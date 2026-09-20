import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { StartupTemplateSchema } from '../application/startup-template'
import { createEmptyProject } from '../domain'
import { ZooMapLocalDatabase } from '../infrastructure/local-database'
import { migrateMapMarkers } from '../infrastructure/map-markers-migration'

const template = JSON.parse(readFileSync('public/startup-template.json', 'utf8'))
const databases: ZooMapLocalDatabase[] = []
afterEach(() => { databases.forEach(db => db.close()); vi.unstubAllGlobals() })

it('ships 40 placed markers with 39 distinct 128px icons and configurable circles', () => {
  const data = StartupTemplateSchema.parse(template)
  expect(data.project.items).toHaveLength(40)
  const markerIconIds = new Set(data.project.items.map(item => item.iconAssetId))
  const icons = data.assets.filter(entry => entry.asset.kind === 'icon' && markerIconIds.has(entry.asset.id))
  expect(icons).toHaveLength(39)
  for (const { asset, base64 } of icons) {
    const bytes = Buffer.from(base64, 'base64')
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([128, 128])
    expect(bytes.length).toBe(asset.size)
  }
  expect(data.project.categories.every(category => category.markerStyle === 'circle')).toBe(true)
  expect(data.project.items.every(item => icons.some(entry => entry.asset.id === item.iconAssetId))).toBe(true)
})

it('backs up and replaces old media once, preserving subsequent edits and fonts', async () => {
  const db = new ZooMapLocalDatabase(`markers-${crypto.randomUUID()}`)
  databases.push(db)
  const old = createEmptyProject({ id: 'zooweb-main' })
  await db.projects.put(old)
  const metadata = { name: 'old', mimeType: 'image/png', size: 1, width: 1, height: 1, createdAt: new Date().toISOString(), data: new Uint8Array([1]).buffer }
  await db.assets.bulkPut([{ ...metadata, id: 'old-image', kind: 'image' }, { ...metadata, id: 'font', kind: 'font' }])
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => template }))
  await migrateMapMarkers(db)
  expect((await db.projects.get(old.id))?.items).toHaveLength(40)
  expect(await db.assets.get('old-image')).toBeUndefined()
  expect(await db.assets.get('font')).toBeDefined()
  expect((await db.projectMigrations.toArray())[0].assets).toHaveLength(2)
  await db.projects.update(old.id, { items: [] })
  await migrateMapMarkers(db)
  expect((await db.projects.get(old.id))?.items).toHaveLength(0)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('keeps existing data if the replacement resource is incomplete', async () => {
  const db = new ZooMapLocalDatabase(`markers-${crypto.randomUUID()}`)
  databases.push(db)
  const old = createEmptyProject({ id: 'zooweb-main' })
  await db.projects.put(old)
  const damaged = structuredClone(template)
  damaged.assets[0].asset.size += 1
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => damaged }))
  await expect(migrateMapMarkers(db)).rejects.toThrow('Unvollständige Ressource')
  expect(await db.projects.get(old.id)).toEqual(old)
  expect(await db.projectMigrations.count()).toBe(0)
})
