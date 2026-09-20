import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
const file = 'public/startup-template.json'
const backup = 'backups/startup-template-before-roadside-positions.json'
if (!existsSync(backup)) copyFileSync(file, backup)
const template = JSON.parse(readFileSync(file, 'utf8'))
const positions = JSON.parse(readFileSync('src/domain/roadside-marker-positions.json', 'utf8'))
for (const item of template.project.items) {
  const point = positions[item.id.replace(/^map128-/, '')]
  if (point) item.position = { x: point[0] / 1254, y: point[1] / 1254 }
}
writeFileSync(file, JSON.stringify(template))
console.log(`Updated positions for ${template.project.items.length} markers`)
