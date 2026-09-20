import { readFileSync, writeFileSync } from 'node:fs'
const path = 'public/startup-template.json'
const template = JSON.parse(readFileSync(path, 'utf8'))
const project = template.project
const services = project.categories.find(category => category.id === 'services')
if (services) {
  const definitions = [
    { id: 'first-aid', name: 'Медпункт', color: '#d23c45', defaultIconAssetId: 'map128-first-aid', en: 'First aid' },
    { id: 'information', name: 'Информация', color: '#246eac', defaultIconAssetId: 'map128-information', en: 'Information' },
  ]
  project.categories = project.categories.flatMap(category => category.id === 'services'
    ? definitions.map(({ en, ...definition }) => ({ ...services, ...definition, colorizeIcon: true,
      translations: { [project.defaultLocale]: { name: definition.name }, en: { name: en } } }))
    : [category]).map((category, sortOrder) => ({ ...category, sortOrder }))
  for (const item of project.items) {
    if (item.categoryId === 'services') item.categoryId = item.iconAssetId === 'map128-first-aid' ? 'first-aid' : 'information'
  }
  writeFileSync(path, JSON.stringify(template))
}
console.log(project.categories.map(category => category.name).join(', '))
