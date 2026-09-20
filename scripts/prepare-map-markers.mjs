import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs'

// Coordinates measured from the 1254px corrected-animals-v48 reference.
const positions = {
  wolf: [426, 138], 'brown-bear': [313, 206], moose: [393, 249],
  lynx: [198, 292], 'mountain-goat': [266, 366], 'red-fox': [432, 375],
  ostrich: [636, 189], camel: [735, 263], fennec: [610, 336], meerkat: [787, 378],
  seal: [955, 294], penguin: [1036, 347], pelican: [1156, 439], otter: [1132, 522],
  orangutan: [550, 521], tiger: [657, 575], leopard: [550, 645],
  tapir: [709, 647], gorilla: [631, 694], hippopotamus: [198, 800],
  flamingo: [310, 879], crocodile: [192, 946], capybara: [365, 981],
  lion: [850, 886], rhinoceros: [941, 891], hyena: [1027, 926],
  zebra: [872, 974], giraffe: [942, 1018], elephant: [1070, 1002],
  restaurant: [562, 406], cafe: [1030, 432], restroom: [834, 546],
  'first-aid': [472, 619], aquarium: [864, 619], terrarium: [960, 511],
  'spider-house': [748, 763], entrance: [628, 997], information: [528, 1047],
  souvenir: [731, 1048],
}
const manifest = JSON.parse(readFileSync('public/map-icons/icons-manifest.json', 'utf8'))
const templatePath = 'public/startup-template.json'
mkdirSync('backups', { recursive: true })
const backup = 'backups/startup-template-before-markers-128.json'
if (!existsSync(backup)) copyFileSync(templatePath, backup)
const template = JSON.parse(readFileSync(templatePath, 'utf8'))
const project = template.project
const now = new Date().toISOString()
const background = template.assets.find(entry => entry.asset.id === project.backgroundAssetId)
if (!background) throw new Error('Missing background')
template.assets = template.assets.filter(entry => entry === background || entry.asset.kind === 'font')
const categoryDefs = [
  ['animals', 'Животные', 'animal', '#4f8f64', false],
  ['exhibits', 'Аквариум и террариумы', 'custom', '#328d8d', false],
  ['restaurants', 'Рестораны и кафе', 'restaurant', '#73513b', true],
  ['restrooms', 'Туалеты', 'restroom', '#246eac', true],
  ['first-aid', 'Медпункт', 'custom', '#d23c45', true],
  ['information', 'Информация', 'custom', '#246eac', true],
  ['entrances', 'Вход', 'entrance', '#45545e', true],
  ['souvenirs', 'Сувениры', 'souvenir', '#d23c45', true],
]
project.categories = categoryDefs.map(([id, name, type, color, colorizeIcon], sortOrder) => ({
  id, name, type, color, colorizeIcon, sortOrder, visible: true,
  markerStyle: 'circle', iconScale: 0.75, iconContentScale: 0.95,
  iconBackgroundColor: '#ffffff', imageMaskRadius: 100,
  outlineEnabled: false, shadowEnabled: true, shadowBlur: 6,
  shadowOpacity: 25, shadowColor: '#000000',
}))
project.items = []
for (const [folder, icons] of [['animals', manifest.animals], ['facilities', manifest.facilities]]) {
  for (const icon of icons) {
    const file = `public/map-icons/optimized-128/${folder}/${icon.id}.png`
    const bytes = readFileSync(file)
    if (bytes.readUInt32BE(16) !== 128 || bytes.readUInt32BE(20) !== 128) throw new Error(`Not 128px: ${file}`)
    const assetId = `map128-${icon.id}`
    template.assets.push({ asset: { id: assetId, name: `${icon.name}.png`, mimeType: 'image/png',
      size: bytes.length, kind: 'icon', width: 128, height: 128, createdAt: now }, base64: bytes.toString('base64') })
    const categoryId = folder === 'animals' ? 'animals'
      : manifest.themedFacilityIds.includes(icon.id) ? 'exhibits'
      : ['restaurant', 'cafe'].includes(icon.id) ? 'restaurants'
      : icon.id === 'restroom' ? 'restrooms' : icon.id === 'entrance' ? 'entrances'
      : icon.id === 'souvenir' ? 'souvenirs' : icon.id === 'first-aid' ? 'first-aid' : 'information'
    const category = project.categories.find(entry => entry.id === categoryId)
    category.defaultIconAssetId ??= assetId
    const [x, y] = positions[icon.id]
    project.items.push({ id: `map128-${icon.id}`, categoryId, type: category.type,
      title: icon.name, subtitle: '', description: '', iconAssetId: assetId,
      imageAssetId: null, imageAssetIds: [], position: { x: x / 1254, y: y / 1254 },
      facts: [], visible: true, createdAt: now, updatedAt: now,
      ...(icon.id === 'first-aid' ? { markerOverrides: { color: '#d23c45' } } : {}),
    })
  }
}
const restaurant = project.items.find(item => item.id === 'map128-restaurant')
project.items.push({ ...restaurant, id: 'map128-restaurant-south', title: 'Ресторан у водоёмов', position: { x: 475 / 1254, y: 878 / 1254 } })
project.events = project.events.map(event => ({ ...event, relatedItemId: null }))
project.mapSettings.factIcons = []
project.updatedAt = now
writeFileSync(templatePath, JSON.stringify(template))
console.log(`Prepared ${project.items.length} markers, ${template.assets.length} assets; backup: ${backup}`)
