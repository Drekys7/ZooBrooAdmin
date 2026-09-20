import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'

// Rounded educational ranges for adults; longevity is an approximate possible age,
// not a survival average or a claim about the individual animals in this demo zoo.
const animals = [
  ['wolf','Nordhalbkugel','Northern hemisphere',16,'20–60'],
  ['brown-bear','Nordhalbkugel','Northern hemisphere',30,'100–600'],
  ['moose','Eurasien','Eurasia',20,'200–600'],
  ['lynx','Eurasien','Eurasia',24,'18–30'],
  ['mountain-goat','Nordamerika','North America',18,'45–140'],
  ['red-fox','Nordhalbkugel','Northern hemisphere',14,'3–14'],
  ['ostrich','Afrika','Africa',40,'90–150'],
  ['camel','Afrika & Asien','Africa & Asia',40,'400–600'],
  ['fennec','Nordafrika','North Africa',14,'0.8–1.5'],
  ['meerkat','Südafrika','Southern Africa',15,'0.6–1'],
  ['seal','Nördliche Meere','Northern seas',35,'50–170'],
  ['penguin','Subantarktis','Subantarctic',30,'9–18'],
  ['pelican','Afrika & Eurasien','Africa & Eurasia',30,'5–15'],
  ['otter','Eurasien','Eurasia',20,'5–12'],
  ['orangutan','Borneo','Borneo',60,'30–100'],
  ['tiger','Asien','Asia',25,'75–300'],
  ['leopard','Afrika & Asien','Africa & Asia',23,'30–90'],
  ['tapir','Südamerika','South America',35,'150–250'],
  ['gorilla','Zentralafrika','Central Africa',50,'70–200'],
  ['hippopotamus','Afrika','Africa',50,'1400–4500'],
  ['flamingo','Afrika & Eurasien','Africa & Eurasia',50,'2–4'],
  ['crocodile','Afrika','Africa',70,'150–750'],
  ['capybara','Südamerika','South America',12,'27–79'],
  ['lion','Afrika','Africa',25,'120–250'],
  ['rhinoceros','Afrika','Africa',50,'1400–2300'],
  ['hyena','Afrika','Africa',25,'45–80'],
  ['zebra','Afrika','Africa',25,'175–385'],
  ['giraffe','Afrika','Africa',25,'700–1900'],
  ['elephant','Afrika','Africa',70,'2700–6000'],
]
const services = {
  restaurant: [['Küche','Food','Warme Speisen','Hot meals'],['Auswahl','Options','Vegetarisch','Vegetarian'],['Kinder','Children','Kleine Portionen','Small portions']],
  'restaurant-south': [['Küche','Food','Speisen & Snacks','Meals & snacks'],['Getränke','Drinks','Saft & Wasser','Juice & water'],['Kinder','Children','Kleine Portionen','Small portions']],
  cafe: [['Angebot','Menu','Kaffee & Kuchen','Coffee & cake'],['Extras','Extras','Tee & Eis','Tea & ice cream'],['Lage','Area','Am Wasser','Waterside']],
  restroom: [['WC','WC','Damen & Herren','Women & men'],['Zugang','Access','Barrierefrei','Accessible'],['Baby','Baby','Wickeltisch','Changing table']],
  'first-aid': [['Hilfe','Help','Erste Hilfe','First aid'],['Kontakt','Contact','Zooteam','Zoo staff'],['Notruf','Emergency','112','112']],
  aquarium: [['Tiere','Animals','Fische','Fish'],['Bereich','Area','Wasser & Küste','Water & Coast'],['Besuch','Visit','20–30 Min.','20–30 min']],
  terrarium: [['Tiere','Animals','Reptilien','Reptiles'],['Ort','Place','Glashaus','Glasshouse'],['Besuch','Visit','15–20 Min.','15–20 min']],
  'spider-house': [['Tiere','Animals','Spinnen','Spiders'],['Beine','Legs','8','8'],['Besuch','Visit','10–15 Min.','10–15 min']],
  entrance: [['Zugang','Access','Ein- & Ausgang','Entry & exit'],['Einlass','Entry','Ticket zeigen','Show ticket'],['Start','Start','Rundweg','Zoo trail']],
  information: [['Service','Service','Auskunft','Visitor help'],['Fundbüro','Lost items','Hier melden','Ask here'],['Sprachen','Languages','DE / EN','DE / EN']],
  souvenir: [['Shop','Shop','Geschenke','Gifts'],['Auswahl','Range','Bücher & Plüsch','Books & toys'],['Lage','Area','Am Ausgang','By the exit']],
}
const path = 'public/startup-template.json'
const backup = 'backups/startup-template-before-three-facts.json'
if (!existsSync(backup)) copyFileSync(path, backup)
const template = JSON.parse(readFileSync(path, 'utf8'))
const items = {}
const fact = (key, labelDe, labelEn, de, en, iconAssetId = null) => ({ key, iconAssetId, de: {label: labelDe, value:de}, en: {label:labelEn, value:en} })
for (const [slug, de, en, age, weight] of animals) {
  const id = `map128-${slug}`
  items[id] = { facts: [
    fact('region','Region','Region',de,en,'zooweb-fact-region'),
    fact('lifespan','Lebensdauer','Lifespan',`bis ${age} Jahre`,`up to ${age} years`,'zooweb-fact-lifespan'),
    fact('weight','Gewicht','Weight',`${weight.replaceAll('.', ',')} kg`,`${weight} kg`,'zooweb-fact-weight'),
  ] }
}
for (const [slug, values] of Object.entries(services)) {
  const id = `map128-${slug}`
  items[id] = {facts: values.map((v,i) => fact(`short-${i}`,...v))}
}
writeFileSync('src/domain/compact-map-facts.json', JSON.stringify(items,null,2)+'\n')
for (const item of template.project.items) {
  if (!items[item.id]) continue
  item.facts = items[item.id].facts.map(f => ({id:`${item.id}-${f.key}`, ...f.de,iconAssetId:f.iconAssetId,translations:{de:f.de,en:f.en}}))
}
const originals = JSON.parse(readFileSync('backups/startup-template-before-markers-128.json','utf8'))
for (const entry of originals.assets.filter(a => /^zooweb-fact-/.test(a.asset.id))) {
  if (!template.assets.some(a=>a.asset.id === entry.asset.id)) template.assets.push(entry)
}
writeFileSync(path, JSON.stringify(template))
console.log(`Updated ${Object.keys(items).length} compact cards and restored ready-made fact icons.`)
