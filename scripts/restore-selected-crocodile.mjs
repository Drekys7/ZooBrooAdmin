import {readFileSync,writeFileSync} from 'node:fs'
const dir='prepared-assets/animal-photos'
const candidates=JSON.parse(readFileSync(`${dir}/candidates.json`,'utf8'))
const saved=JSON.parse(readFileSync(`${dir}/selected-photos.json`,'utf8')).find(p=>p.id==='crocodile')
if(!saved?.page.includes('Laika'))throw new Error('Expected reviewed original crocodile photograph')
candidates.crocodile.options=[saved]
writeFileSync(`${dir}/candidates.json`,JSON.stringify(candidates,null,2))
