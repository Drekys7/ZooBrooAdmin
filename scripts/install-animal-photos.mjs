import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync,statSync} from 'node:fs'
import sharp from 'file:///C:/Users/ssbor/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs'
const root='prepared-assets/animal-photos'
const photos=JSON.parse(readFileSync(`${root}/manifest.json`,'utf8'))
const path='public/startup-template.json'
const backup='backups/startup-template-before-animal-photos.json'
if(!existsSync(backup))copyFileSync(path,backup)
const template=JSON.parse(readFileSync(path,'utf8'))
mkdirSync('public/animal-photos',{recursive:true})
const result=[]
let before=0,after=0
for(const p of photos){
  before+=statSync(`${root}/${p.file}`).size
  const isCroc=p.id==='crocodile'
  const source=isCroc?`${root}/crocodile-head.jpg`:`${root}/${p.file}`
  let pipeline=sharp(source).rotate()
  if(isCroc){
    pipeline=pipeline.extract({left:32,top:0,width:640,height:640})
    const info=JSON.parse(readFileSync(`${root}/crocodile-head.json`,'utf8'))
    Object.assign(p,{source:info.descriptionurl,author:'Leigh Bedford',license:'CC BY 2.0',licenseUrl:'https://creativecommons.org/licenses/by/2.0/',changes:'Square crop; resized and JPEG compressed'})
  }
  const {data,info}=await pipeline.resize({width:960,height:1280,fit:'inside',withoutEnlargement:true}).jpeg({quality:78,mozjpeg:true}).toBuffer({resolveWithObject:true})
  const file=`${p.id}.jpg`
  writeFileSync(`public/animal-photos/${file}`,data)
  const id=`animal-photo-${p.id}-v1`
  const asset={id,name:`${p.de}.jpg`,mimeType:'image/jpeg',kind:'image',size:data.length,width:info.width,height:info.height,createdAt:new Date().toISOString()}
  const credit={author:p.author,source:p.source,license:p.license,licenseUrl:(p.licenseUrl||p.source).replace(/^http:/,'https:'),changes:isCroc?'crop-resize-compress':'resize-compress'}
  const entry={...p,width:info.width,height:info.height,bytes:data.length,file:`/animal-photos/${file}`,asset,credit}
  result.push(entry)
  after+=data.length
  template.assets=template.assets.filter(a=>a.asset.id!==id)
  template.assets.push({asset,base64:data.toString('base64')})
  const item=template.project.items.find(i=>i.id===`map128-${p.id}`)
  if(!item)throw new Error(`Missing animal ${p.id}`)
  item.imageAssetId=id
  item.imageAssetIds=[id]
  item.imageCredits={...(item.imageCredits||{}),[id]:credit}
}
writeFileSync(path,JSON.stringify(template))
writeFileSync('public/animal-photos/manifest.json',JSON.stringify(result,null,2))
writeFileSync('public/animal-photos/CREDITS.md',result.map(p=>`## ${p.en}\n\n${p.author} — [${p.license}](${p.credit.licenseUrl}) — [Source](${p.source}). ${p.credit.changes}.\n`).join('\n'))
// Keep the preparation gallery in sync with the installed images; originals remain untouched.
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
writeFileSync(`${root}/gallery.html`,`<!doctype html><meta charset="utf-8"><title>Optimized animal photos</title><style>body{font:15px system-ui;background:#eef2e8;padding:24px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}article{background:white;padding:12px;border-radius:12px}img{width:100%;height:240px;object-fit:contain}p{font-size:12px}</style><h1>29 optimized animal photos</h1><main>${result.map(p=>`<article><img src="../../public${p.file}"><h3>${esc(p.en)}</h3><p>${p.width}×${p.height} · ${Math.round(p.bytes/1024)} KB</p><p>${esc(p.author)} · <a href="${esc(p.credit.licenseUrl)}">${esc(p.license)}</a> · <a href="${esc(p.source)}">Source</a></p></article>`).join('')}</main>`)
console.log(JSON.stringify({count:result.length,before,after,reduction:Math.round(100*(1-after/before)),largest:Math.max(...result.map(p=>p.bytes))}))
