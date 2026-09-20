import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs'
import sharp from 'file:///C:/Users/ssbor/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs'
const path='public/startup-template.json',backup='backups/startup-template-before-exhibit-closeups.json'
if(!existsSync(backup))copyFileSync(path,backup)
const template=JSON.parse(readFileSync(path,'utf8'))
const photos=JSON.parse(readFileSync('prepared-assets/exhibit-animals/manifest.json','utf8'))
const credits={}
for(const p of photos){
 const file=`public/exhibit-animals/${p.id}.jpg`;copyFileSync(p.file,file)
 const data=readFileSync(file),info=await sharp(data).metadata(),id=`exhibit-photo-${p.id}-v1`
 if(info.width/info.height>1.01||info.width/info.height<.55)throw Error(`Invalid aspect ratio: ${p.id}`)
 const entry=template.assets.find(a=>a.asset.id===id);if(!entry)throw Error(`Missing asset ${id}`)
 Object.assign(entry.asset,{width:info.width,height:info.height,size:data.length})
 entry.base64=data.toString('base64')
 credits[id]={author:p.author,source:p.source,license:p.license,licenseUrl:p.licenseUrl.replace(/^http:/,'https:'),changes:'crop-resize-compress'}
}
for(const root of template.project.items)for(const item of [root,...root.members??[]]){
 for(const id of item.imageAssetIds??[])if(credits[id])item.imageCredits={...item.imageCredits,[id]:credits[id]}
}
writeFileSync(path,JSON.stringify(template))
writeFileSync('public/exhibit-animals/CREDITS.md',photos.map(p=>`## ${p.id}\n\n${p.author} — [${p.license}](${p.licenseUrl}) — [Source](${p.source}). Cropped, resized and JPEG compressed; no added borders.\n`).join('\n'))
console.log({updated:photos.length,bytes:photos.reduce((sum,p)=>sum+readFileSync(p.file).length,0)})
