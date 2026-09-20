import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs'
const out='prepared-assets/animal-photos'
mkdirSync(`${out}/photos`,{recursive:true})
const copy=JSON.parse(readFileSync('src/domain/demo-map-copy.json','utf8')).items
const template=JSON.parse(readFileSync('public/startup-template.json','utf8')).project
const animals=template.items.filter(i=>i.type==='animal').map(i=>({id:i.id.replace('map128-',''),de:i.title,en:copy[i.id].en.title,species:copy[i.id].de.subtitle}))
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()
const candidates=existsSync(`${out}/candidates.json`)?JSON.parse(readFileSync(`${out}/candidates.json`,'utf8')):{}
const overrides={'mountain-goat':'intitle:"Oreamnos americanus"','tapir':'intitle:"Tapirus terrestris"','otter':'"Eurasian otter"','crocodile':'"Crocodylus niloticus"','capybara':'capybara','hippopotamus':'hippopotamus'}
for(const animal of animals){
  if(candidates[animal.id]?.options.length&&!process.argv.slice(2).includes(animal.id))continue
  const query=overrides[animal.id]||`"${animal.species==='Giraffa spp.'?'Giraffa':animal.species}"`
  const params=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:`${query} filetype:bitmap`,gsrnamespace:'6',gsrlimit:candidates[animal.id]?'100':'40',prop:'imageinfo',iiprop:'url|size|extmetadata',iiurlwidth:'800'})
  let r
  for(let attempt=0;attempt<6;attempt++){
    r=await fetch(`https://commons.wikimedia.org/w/api.php?${params}`,{headers:{'User-Agent':'ZooBrooPhotoPreparation/1.0 (educational zoo demo)'}})
    if(r.status!==429)break
    console.log('Rate limited; waiting before retry',animal.id)
    await new Promise(resolve=>setTimeout(resolve,15000))
  }
  if(!r.ok) throw new Error(`${animal.id}: HTTP ${r.status}`)
  const data=await r.json()
  candidates[animal.id]={...animal,options:Object.values(data.query?.pages||{}).sort((a,b)=>a.index-b.index).flatMap(p=>{
    const i=p.imageinfo?.[0];if(!i)return []
    const ratio=i.width/i.height,m=i.extmetadata||{},license=clean(m.LicenseShortName?.value)
    if(ratio<0.5||ratio>1.08||i.width<700||i.height<700||!/\.jpe?g(?:\?|$)/i.test(i.url)||!/CC BY|CC0|Public domain/i.test(license))return []
    if(/skull|skeleton|map|distribution|drawing|illustration|museum specimen|dead|taxiderm/i.test(p.title))return []
    return [{title:p.title,url:i.url,preview:i.thumburl||i.url,page:i.descriptionurl,width:i.width,height:i.height,license,licenseUrl:m.LicenseUrl?.value||'',author:clean(m.Artist?.value),description:clean(m.ImageDescription?.value)}]
  })}
  console.log(animal.id,candidates[animal.id].options.length)
  writeFileSync(`${out}/candidates.json`,JSON.stringify(candidates,null,2))
  await new Promise(resolve=>setTimeout(resolve,1500))
}
writeFileSync(`${out}/candidates.json`,JSON.stringify(candidates,null,2))
console.log('Candidate search complete. No map data changed.')
