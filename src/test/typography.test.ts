import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPublishedSnapshot, setBackground, updateMapSettings, exportProjectToJson, importProjectFromJson } from '../application'
import { exportWithFonts, importWithFonts } from '../application/font-transfer'
import { createEmptyProject } from '../domain'
import { DEFAULT_TYPOGRAPHY, validateFont } from '../domain/typography'
import { createLocalApplication } from '../infrastructure'
import { DEFAULT_ZONES } from '../domain/zones'

afterEach(() => vi.unstubAllGlobals())

describe('project typography', () => {
  it('keeps legacy projects readable and publishes resolved font URLs', () => {
    const original = setBackground(createEmptyProject(), { assetId: 'map', width: 100, height: 100 })
    expect(importProjectFromJson(exportProjectToJson(original)).mapSettings.typography).toBeUndefined()
    const project = updateMapSettings(original, { patch: { typography: { ...DEFAULT_TYPOGRAPHY, preset: 'custom', regularAssetId: 'regular', boldAssetId: 'bold' } } })
    expect(importProjectFromJson(exportProjectToJson(project)).mapSettings.typography).toEqual(project.mapSettings.typography)
    const published = buildPublishedSnapshot(project, 1, undefined, id => `https://example.org/assets/${id}`)
    expect(published.mapSettings.typography).toEqual({ preset: 'custom', variable: false, regular: { assetId: 'regular', url: 'https://example.org/assets/regular' }, bold: { assetId: 'bold', url: 'https://example.org/assets/bold' } })
  })

  it('rejects incorrect, oversized and undecodable font files', async () => {
    await expect(validateFont(new File(['bad'], 'font.ttf'))).rejects.toThrow('WOFF2')
    await expect(validateFont(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'font.woff2'))).rejects.toThrow('2 MB')
    await expect(validateFont(new File([new Uint8Array(48)], 'font.woff2'))).rejects.toThrow('gültige')
    vi.stubGlobal('FontFace', class { load() { return Promise.reject(new Error('invalid')) } })
    await expect(validateFont(new File(['wOF2', new Uint8Array(44)], 'font.woff2'))).rejects.toThrow('gelesen')
  })

  it.each([
    { name: 'zoo.woff2', mimeType: 'font/woff2', signature: [0x77, 0x4f, 0x46, 0x32], zoneOnly: false },
    { name: 'HennyPenny-Regular.ttf', mimeType: 'font/ttf', signature: [0, 1, 0, 0], zoneOnly: false },
    { name: 'zones.ttf', mimeType: 'font/ttf', signature: [0, 1, 0, 0], zoneOnly: true },
  ])('transfers $name to another database and remaps asset IDs', async ({ name, mimeType, signature, zoneOnly }) => {
    // Browser decoding is tested in validateFont; this isolates transfer and persistence.
    vi.stubGlobal('FontFace', class { load() { return Promise.resolve(this) } })
    const source = createLocalApplication(`font-source-${crypto.randomUUID()}`)
    const target = createLocalApplication(`font-target-${crypto.randomUUID()}`)
    try {
      const blob = new Blob([new Uint8Array(signature), new Uint8Array(44)], { type: mimeType })
      const asset = await source.assetRepository.put({ blob, name, kind: 'font' })
      const typography = { ...DEFAULT_TYPOGRAPHY, preset: 'custom' as const, regularAssetId: asset.id, variable: true }
      const project = updateMapSettings(createEmptyProject(), { patch: zoneOnly ? { zones: { ...DEFAULT_ZONES, typography } } : { typography } })
      const json = await exportWithFonts(project, source.assetRepository)
      expect(JSON.parse(json).fontFiles[0].data).toMatch(`data:${mimeType};base64,`)
      const imported = await importWithFonts(json, target.assetRepository)
      const importedFont = zoneOnly ? imported.mapSettings.zones!.typography! : imported.mapSettings.typography!
      const newId = importedFont.regularAssetId!
      expect(newId).not.toBe(asset.id)
      expect((await target.assetRepository.get(newId))?.blob.size).toBe(blob.size)
      expect((await target.assetRepository.get(newId))?.asset.mimeType).toBe(mimeType)
      expect(importedFont.variable).toBe(true)
      await expect(importWithFonts(exportProjectToJson(project), target.assetRepository)).rejects.toThrow('fehlt')
    } finally { source.close(); target.close() }
  })
})
