import {readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {createServer} from 'vite'

const source = process.argv[2]
if (!source) throw new Error('Supply the exported project JSON path')
const baseline = process.argv[3] || 'chrome-2026-09-20'
if (!/^[a-z0-9-]+$/.test(baseline)) throw new Error('Invalid baseline name')
const server = await createServer({server: {middlewareMode: true}, appType: 'custom', optimizeDeps: {noDiscovery: true, include: []}})
try {
  const {StartupTemplateSchema} = await server.ssrLoadModule('/src/application/startup-template.ts')
  const exported = JSON.parse(readFileSync(source, 'utf8'), (key, value) => key === 'imageMaskRadius' ? undefined : value)
  const {fontFiles = [], ...project} = exported
  if (fontFiles.length) throw new Error('Import embedded fonts before installing this baseline')
  const path = 'public/startup-template.json'
  const previous = JSON.parse(readFileSync(path, 'utf8'))
  const next = {...previous, project}
  const parsed = StartupTemplateSchema.parse(next)
  if (!isDeepStrictEqual(parsed.project, project)) throw new Error('Schema would change exported data')
  const ids = new Set(next.assets.map(entry => entry.asset.id))
  function check(value, key = '') {
    if (key.endsWith('AssetId') && value && !ids.has(value)) throw new Error(`Missing asset: ${value}`)
    if (key.endsWith('AssetIds') && Array.isArray(value)) value.forEach(id => check(id, 'AssetId'))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => check(v, k))
  }
  check(project)
  for (const {asset, base64} of next.assets) {
    if (Buffer.from(base64, 'base64').length !== asset.size) throw new Error(`Corrupt asset: ${asset.id}`)
  }
  mkdirSync('backups', {recursive: true})
  const backup = `backups/startup-template-before-${baseline}.json`
  if (!existsSync(backup)) copyFileSync(path, backup)
  mkdirSync('prepared-assets/baselines', {recursive: true})
  copyFileSync(source, `prepared-assets/baselines/${baseline}.json`)
  writeFileSync(path, JSON.stringify(next))
  console.log(`Installed exact exported project: ${project.items.length} markers; ${next.assets.length} assets retained.`)
} finally {
  await server.close()
}
