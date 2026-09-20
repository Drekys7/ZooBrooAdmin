import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs'
import sharp from 'file:///C:/Users/ssbor/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs'
import {groups} from './exhibit-species.mjs'
const out='public/exhibit-animals';mkdirSync(out,{recursive:true})
const path='public/startup-template.json',backup='backups/startup-template-before-exhibit-animals.json'
if(!existsSync(backup))copyFileSync(path,backup)
const t=JSON.parse(readFileSync(path,'utf8')),now=new Date().toISOString()
const photos=JSON.parse(readFileSync('prepared-assets/exhibit-animals/manifest.json','utf8'))
const icons=JSON.parse(readFileSync('scripts/exhibit-icon-paths.json','utf8'))
const assets=[]
async function asset(id,name,file,kind){
 const data=readFileSync(file),info=await sharp(data).metadata()
 const a={id,name,mimeType:kind==='icon'?'image/png':'image/jpeg',kind,size:data.length,width:info.width,height:info.height,createdAt:now}
 assets.push({asset:a,base64:data.toString('base64')});return id
}
const credits={}
for(const p of photos){
 const file=`${out}/${p.id}.jpg`;copyFileSync(p.file,file)
 const id=await asset(`exhibit-photo-${p.id}-v1`,`${p.id}.jpg`,file,'image')
 credits[id]={author:p.author,source:p.source,license:p.license,licenseUrl:p.licenseUrl.replace(/^http:/,'https:'),changes:p.changes||'crop-resize-compress'}
}
const iconFiles=[]
for(const [id,source] of Object.entries(icons)){
 const file=`${out}/${id}-128.png`
 await sharp(source).resize(128,128,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png({compressionLevel:9}).toFile(file)
 await asset(`exhibit-icon-${id}-v1`,`${id}-128.png`,file,'icon');iconFiles.push(file)
}
const locations={aquarium:['Aquarium','Aquarium','Fische','Fish'],'terrarium':['Terrarienhaus','Reptile House','Reptilien','Reptiles'],'spider-house':['Spinnenhaus','Spider House','Spinnen','Spiders']}
for(const [group,rows] of Object.entries(groups)){
 const root=t.project.items.find(i=>i.id===`map128-${group}`),[placeDE,placeEN,kindDE,kindEN]=locations[group]
 const animals=rows.map(([id,species,de,en,regionDE,regionEN,dietDE,dietEN,bodyDE,bodyEN],index)=>{
  const image=`exhibit-photo-${id}-v1`
  const description=`${bodyDE}\n\nWissenschaftlicher Name: ${species}. Sie finden dieses Tier im ${placeDE}. Die Tiere dieser Beispielausstellung werden in passenden, getrennten Lebensräumen gezeigt.`
  const english=`${bodyEN}\n\nScientific name: ${species}. Find this animal in the ${placeEN}. Animals in this example exhibition are shown in suitable, separate habitats.`
  const facts=[['Region',regionDE,'Region',regionEN,'zooweb-fact-region'],['Nahrung',dietDE,'Diet',dietEN,null],['Gruppe',kindDE,'Group',kindEN,null]].map(([label,value,enLabel,enValue,icon],i)=>({id:`exhibit-${id}-fact-${i}`,label,value,iconAssetId:icon,translations:{de:{label,value},en:{label:enLabel,value:enValue}}}))
  return {id:index===0?root.id:`exhibit-animal-${id}`,title:de,subtitle:placeDE,description,facts,iconAssetId:index===0?root.iconAssetId:`exhibit-icon-${id}-v1`,imageAssetId:image,imageAssetIds:[image],imageCredits:{[image]:credits[image]},markerOverrides:index===0?root.markerOverrides:{colorizeIcon:false},translations:{de:{title:de,subtitle:placeDE,description},en:{title:en,subtitle:placeEN,description:english}}}
 })
 Object.assign(root,animals[0],{members:animals.slice(1),updatedAt:now})
}
const lion=t.project.items.find(i=>i.id==='map128-lion')
lion.imageAssetIds=['animal-photo-lion-v1','exhibit-photo-lion-2-v1','exhibit-photo-lion-3-v1']
lion.imageAssetId=lion.imageAssetIds[0]
lion.imageCredits={...lion.imageCredits,...Object.fromEntries(lion.imageAssetIds.slice(1).map(id=>[id,credits[id]]))}
t.assets=t.assets.filter(a=>!a.asset.id.startsWith('exhibit-')).concat(assets)
writeFileSync(path,JSON.stringify(t))
writeFileSync(`${out}/CREDITS.md`,photos.map(p=>`## ${p.id}\n\n${p.author} — [${p.license}](${p.licenseUrl}) — [Source](${p.source}). Cropped, resized and JPEG compressed; no added borders.\n`).join('\n'))
writeFileSync(`${out}/generation-prompts.md`,'# Icons — built-in imagegen\n\n15 separate transparent PNGs, optimised to 128×128. Original fish, lizard and spider icons retained.\n\nPrompt template: Use case: stylized-concept. ONE zoo map animal icon, transparent PNG square. Full body centered, all fins/feet/tail visible, 10% margins. Friendly dimensional layered paper/clay cutout miniature, matte paper texture, soft studio light, recognizable species colors, clean silhouette at 128px. Natural anatomy. No circle, text, props or external shadow.\n\nSubjects:\n'+Object.values(groups).flat().filter(r=>icons[r[0]]).map(r=>`- ${r[1]} (${r[3]})`).join('\n'))
const tiles=await Promise.all(iconFiles.map(async(file,i)=>({input:await sharp(file).flatten({background:'#e9f0e4'}).png().toBuffer(),left:i%5*128,top:Math.floor(i/5)*128})))
await sharp({create:{width:640,height:Math.ceil(tiles.length/5)*128,channels:3,background:'white'}}).composite(tiles).png().toFile('prepared-assets/exhibit-animals/icon-contact.png')
console.log({groups:Object.keys(groups).length,animals:Object.values(groups).flat().length,assets:assets.length,lionPhotos:lion.imageAssetIds.length,bytes:assets.reduce((n,a)=>n+a.asset.size,0)})
