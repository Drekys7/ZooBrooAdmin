const { readFileSync, writeFileSync } = require('node:fs')
const sharp = require('sharp')

async function main() {
  const svg = readFileSync('public/map-icons/facilities/minimal/source/restroom.svg')
  for (const [path, size] of [
    ['public/map-icons/facilities/restroom.png', 512],
    ['public/map-icons/facilities/minimal/restroom.png', 512],
    ['public/map-icons/optimized-128/facilities/restroom.png', 128],
  ]) {
    await sharp(svg, { density: 288 }).resize(size, size).png().toFile(path)
  }
  const path = 'public/startup-template.json'
  const template = JSON.parse(readFileSync(path, 'utf8'))
  const entry = template.assets.find(entry => entry.asset.id === 'map128-restroom')
  if (!entry) throw new Error('Restroom asset missing')
  const png = readFileSync('public/map-icons/optimized-128/facilities/restroom.png')
  entry.asset.name = 'Туалет-v2.png'
  entry.asset.size = png.length
  entry.base64 = png.toString('base64')
  writeFileSync(path, JSON.stringify(template))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
