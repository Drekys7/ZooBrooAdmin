import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
const file = 'public/startup-template.json'
const backup = 'backups/startup-template-before-habitat-zones.json'
if (!existsSync(backup)) copyFileSync(file, backup)
const template = JSON.parse(readFileSync(file, 'utf8'))
const layout = JSON.parse(readFileSync('src/domain/habitat-zone-layout.json', 'utf8'))
template.project.mapSettings.minZoomScale = 1
template.project.mapSettings.zones = {
  enabled: true, threshold: 2.7,
  typography: { preset: 'manrope', regularAssetId: null, boldAssetId: null, variable: false },
  appearance: layout.appearance,
  labels: layout.labels.map(label => ({ ...layout.appearance, ...label })),
}
writeFileSync(file, JSON.stringify(template))
console.log('Updated six habitat labels and their appearance')
