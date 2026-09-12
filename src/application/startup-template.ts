import { z } from 'zod'
import { AssetSchema, MapProjectSchema, type MapProject } from '../domain'
import type { AssetRepository } from './repositories'

export const StartupTemplateSchema = z.object({
  format: z.literal('zooweb-startup-v1'),
  project: MapProjectSchema,
  assets: z.array(z.object({
    asset: AssetSchema,
    // Repeated capture groups can exhaust the regexp stack on multi-megabyte images.
    base64: z.string().refine(value => value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value), 'Ungültige Base64-Daten'),
  })),
})

export async function exportStartupTemplate(project: MapProject, repository: AssetRepository): Promise<string> {
  const assets = []
  for (const asset of await repository.list()) {
    const stored = await repository.get(asset.id)
    if (!stored) throw new Error(`Ressource fehlt: ${asset.name}`)
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1])
      reader.onerror = () => reject(new Error(`Ressource konnte nicht gelesen werden: ${asset.name}`))
      reader.readAsDataURL(stored.blob)
    })
    assets.push({ asset, base64 })
  }
  return JSON.stringify(StartupTemplateSchema.parse({ format: 'zooweb-startup-v1', project, assets }))
}

// Called only for an empty project database. Save the project after all media are restored.
export async function loadStartupTemplate(repository: AssetRepository): Promise<MapProject | null> {
  const response = await fetch('/startup-template.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('Startvorlage konnte nicht geladen werden.')
  const data: unknown = await response.json()
  if (data === null) return null
  const template = StartupTemplateSchema.parse(data)
  for (const { asset, base64 } of template.assets) {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
    if (bytes.byteLength !== asset.size) throw new Error(`Unvollständige Ressource: ${asset.name}`)
    // Assets may remain after an interrupted first load; refresh them before retrying.
    await repository.delete(asset.id)
    await repository.put({ ...asset, blob: new Blob([bytes], { type: asset.mimeType }) })
  }
  return template.project
}
