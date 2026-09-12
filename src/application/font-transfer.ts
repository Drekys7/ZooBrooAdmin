import { z } from 'zod'
import type { MapProject } from '../domain'
import type { AssetRepository } from './repositories'
import { exportProjectToJson, importProjectFromJson } from './serialization'
import { fontMimeType, validateFont } from '../domain/typography'

const FontFilesSchema = z.array(z.object({
  id: z.string().min(1), name: z.string().min(1),
  data: z.string().max(2796300).regex(/^data:font\/(?:woff2|ttf);base64,[A-Za-z0-9+/]+={0,2}$/),
})).max(4)

export async function exportWithFonts(project: MapProject, repository: AssetRepository): Promise<string> {
  const fonts = [project.mapSettings.typography, project.mapSettings.zones?.typography]
  const ids = [...new Set(fonts.flatMap(font => [font?.regularAssetId, font?.boldAssetId]).filter((id): id is string => Boolean(id)))]
  const fontFiles = await Promise.all(ids.map(async id => {
    const stored = await repository.get(id)
    if (!stored || stored.asset.kind !== 'font') throw new Error('Eine verwendete Schriftdatei fehlt.')
    const mimeType = fontMimeType(stored.asset.name)
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(`data:${mimeType};base64,${String(reader.result).split(',')[1]}`)
      reader.onerror = () => reject(new Error('Schrift konnte nicht exportiert werden.'))
      reader.readAsDataURL(stored.blob)
    })
    return { id, name: stored.asset.name, data }
  }))
  return JSON.stringify({ ...JSON.parse(exportProjectToJson(project)), fontFiles }, null, 2)
}

export async function importWithFonts(json: string, repository: AssetRepository): Promise<MapProject> {
  const project = importProjectFromJson(json)
  const files = FontFilesSchema.parse(JSON.parse(json).fontFiles ?? [])
  const fonts = [project.mapSettings.typography, project.mapSettings.zones?.typography].filter(font => font !== undefined)
  if (!fonts.length) return project
  const prepared = new Map<string, File>()
  for (const entry of files) {
    const bytes = Uint8Array.from(atob(entry.data.split(',')[1]), character => character.charCodeAt(0))
    const mimeType = fontMimeType(entry.name)
    if (!entry.data.startsWith(`data:${mimeType};`)) throw new Error('Schriftformat und Dateiname stimmen nicht überein.')
    const file = new File([bytes], entry.name, { type: mimeType })
    await validateFont(file)
    prepared.set(entry.id, file)
  }
  const ids = [...new Set(fonts.flatMap(font => [font.regularAssetId, font.boldAssetId]).filter((id): id is string => Boolean(id)))]
  for (const id of ids) {
    if (!prepared.has(id) && (await repository.get(id))?.asset.kind !== 'font') throw new Error('Schriftdatei fehlt. Bitte das Projekt inklusive Schriften erneut exportieren.')
  }
  for (const id of ids) {
    const file = prepared.get(id)
    if (!file) continue
    const asset = await repository.put({ blob: file, name: file.name, mimeType: file.type, kind: 'font' })
    for (const font of fonts) {
      if (font.regularAssetId === id) font.regularAssetId = asset.id
      if (font.boldAssetId === id) font.boldAssetId = asset.id
    }
  }
  return project
}
