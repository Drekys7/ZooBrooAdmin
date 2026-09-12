import { afterEach, expect, it, vi } from 'vitest'
import { createLocalApplication } from '../infrastructure'
import { createEmptyProject } from '../domain'
import { exportStartupTemplate, loadStartupTemplate, StartupTemplateSchema } from '../application/startup-template'

const containers: ReturnType<typeof createLocalApplication>[] = []
function database() {
  const container = createLocalApplication(`template-${crypto.randomUUID()}`)
  containers.push(container)
  return container
}
afterEach(() => { containers.forEach(container => container.close()); containers.length = 0; vi.unstubAllGlobals() })

it('restores the Chrome project and all binary media into a new browser database', async () => {
  const source = database()
  const target = database()
  const project = createEmptyProject()
  project.mapSettings.factIcons = [{ id: 'custom', label: 'Eigene Ikone' }]
  for (const kind of ['icon', 'background', 'font'] as const) {
    await source.assetRepository.put({ id: kind === 'icon' ? 'custom' : kind, name: `${kind}.bin`, kind, blob: new Blob([new Uint8Array([0, 128, 255])]) })
  }
  const body = await exportStartupTemplate(project, source.assetRepository)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => JSON.parse(body) }))
  expect(await loadStartupTemplate(target.assetRepository)).toEqual(project)
  for (const asset of await source.assetRepository.list()) {
    const restored = await target.assetRepository.get(asset.id)
    expect(restored?.asset).toMatchObject({ id: asset.id, size: 3, kind: asset.kind })
    expect(restored?.blob.size).toBe(3)
  }
  expect(await exportStartupTemplate(project, target.assetRepository).then(text => JSON.parse(text).assets.map((entry: { base64: string }) => entry.base64))).toEqual(['AID/', 'AID/', 'AID/'])
})

it('uses the old demo only when no startup template has been saved', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => null }))
  expect(await loadStartupTemplate(database().assetRepository)).toBeNull()
})

it('exports and restores an 8 MB image without overflowing the validation stack', async () => {
  const source = database()
  const target = database()
  const project = createEmptyProject()
  const bytes = new Uint8Array(8 * 1024 * 1024).fill(173)
  await source.assetRepository.put({ id: 'large-map', name: 'map.png', kind: 'background', blob: new Blob([bytes], { type: 'image/png' }) })
  const body = await exportStartupTemplate(project, source.assetRepository)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => JSON.parse(body) }))
  expect(await loadStartupTemplate(target.assetRepository)).toEqual(project)
  const restored = JSON.parse(await exportStartupTemplate(project, target.assetRepository))
  expect(restored.assets[0].base64).toBe(JSON.parse(body).assets[0].base64)
  expect(restored.assets[0].asset.size).toBe(bytes.length)
})

it.each(['A', 'AAA', 'A===', 'AA=A', '!!!!', 'AAAA\n', '===='])('rejects malformed base64 %j', base64 => {
  const schema = StartupTemplateSchema.shape.assets.element.shape.base64
  expect(schema.safeParse(base64).success).toBe(false)
})

it('reports a damaged template instead of silently loading the old demo', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ broken: true }) }))
  await expect(loadStartupTemplate(database().assetRepository)).rejects.toThrow()
})
