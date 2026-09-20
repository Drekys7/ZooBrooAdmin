import {readFileSync,writeFileSync,existsSync} from 'node:fs'
const dir='prepared-assets/animal-photos'
const candidates=JSON.parse(readFileSync(`${dir}/candidates.json`,'utf8'))
const selection=existsSync(`${dir}/selection.json`)?JSON.parse(readFileSync(`${dir}/selection.json`,'utf8')):{}
const existing=existsSync(`${dir}/manifest.json`)?JSON.parse(readFileSync(`${dir}/manifest.json`,'utf8')):[]
const manifest=[]
for(const [id,animal] of Object.entries(candidates)){
  const photo=animal.options[selection[id]??0]
  if(!photo){console.log('MISSING',id);continue}
  const path=`photos/${id}.jpg`
  const previous=existing.find(a=>a.id===id)
  if(!existsSync(`${dir}/${path}`)||previous?.source!==photo.page){
    let response
    for(let attempt=0;attempt<6;attempt++){
      try {
        response=await fetch(photo.preview,{headers:{'User-Agent':'ZooBrooPhotoPreparation/1.0'},signal:AbortSignal.timeout(30000)})
      } catch(error) { console.log('Retry download',id,error.message); continue }
      if(response.ok)break
      if(response.status!==429&&response.status!==503)break
      await new Promise(resolve=>setTimeout(resolve,15000))
    }
    if(!response?.ok){console.log('DOWNLOAD FAILED',id,response?.status);continue}
    const bytes=Buffer.from(await response.arrayBuffer())
    if(bytes[0]!==255||bytes[1]!==216)throw new Error(`Not JPEG: ${id}`)
    writeFileSync(`${dir}/${path}`,bytes)
    await new Promise(resolve=>setTimeout(resolve,1500))
  }
  const jpeg=readFileSync(`${dir}/${path}`)
  let width=0,height=0
  for(let n=2;n<jpeg.length;){
    if(jpeg[n]!==255){n++;continue}
    const marker=jpeg[n+1];n+=2
    if(marker===216||marker===217)continue
    const len=jpeg.readUInt16BE(n)
    if([192,193,194].includes(marker)){height=jpeg.readUInt16BE(n+3);width=jpeg.readUInt16BE(n+5);break}
    n+=len
  }
  if(!width||!height)throw new Error(`Cannot read JPEG dimensions: ${id}`)
  manifest.push({id,de:animal.de,en:animal.en,species:animal.species,file:path,width,height,source:photo.page,author:photo.author,license:photo.license,licenseUrl:photo.licenseUrl,changes:width===photo.width?'None; original photograph':'Wikimedia thumbnail; resized, not cropped',description:photo.description})
  writeFileSync(`${dir}/manifest.json`,JSON.stringify(manifest,null,2))
  console.log('Saved',id,photo.width,photo.height)
}
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
writeFileSync(`${dir}/gallery.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><title>Animal photo candidates</title><style>body{font:16px system-ui;background:#eef2e8;padding:20px;color:#213e30}main{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}article{background:white;padding:12px;border-radius:12px}img{width:100%;height:250px;object-fit:contain;background:#edf0ed}h2{font-size:16px;margin:8px 0}p{font-size:12px;margin:5px 0}a{color:#266346}</style><h1>29 animal photos — prepared, not added to map</h1><p>Original square / portrait photos. License and author links below each photo.</p><main>${manifest.map(p=>`<article><img src="${p.file}"><h2>${esc(p.id)} · ${esc(p.en)}</h2><p>${esc(p.species)} · ${p.width}×${p.height}</p><p>${esc(p.author)}</p><p><a href="${esc(p.source)}">Source</a> · <a href="${esc(p.licenseUrl||p.source)}">${esc(p.license)}</a></p></article>`).join('')}</main></html>`)
writeFileSync(`${dir}/README.md`,`# Animal photographs\n\nPrepared separately: no project, map or admin resources were modified.\n\n${manifest.length} original JPEG photographs with square or portrait framing (width/height 0.5–1.08), at least 700 pixels on each side. Open gallery.html to review.\n\nThese are example photographs of the species, not photographs of individual animals at the fictional zoo. No cropping or AI editing was applied. Attribution and license links must accompany future public use. See manifest.json for machine-readable metadata.\n\n`+manifest.map(p=>`## ${p.en}\n\n- File: ${p.file}\n- Species: ${p.species}\n- Author: ${p.author}\n- License: [${p.license}](${p.licenseUrl||p.source})\n- Source: ${p.source}\n- Changes: none\n`).join('\n'))
console.log('Prepared photos:',manifest.length)
