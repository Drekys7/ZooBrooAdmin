import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import sharp from 'file:///C:/Users/ssbor/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs'
const dir='prepared-assets/exhibit-animals';mkdirSync(`${dir}/photos`,{recursive:true})
mkdirSync(`${dir}/originals`,{recursive:true})
const framing=existsSync(`${dir}/framing.json`)?JSON.parse(readFileSync(`${dir}/framing.json`,'utf8')):{}
const candidates=JSON.parse(readFileSync(`${dir}/candidates.json`,'utf8'))
const choices=existsSync(`${dir}/selection.json`)?JSON.parse(readFileSync(`${dir}/selection.json`,'utf8')):{}
const lion=JSON.parse(readFileSync('prepared-assets/animal-photos/candidates.json','utf8')).lion.options
candidates['lion-2']=[{...lion[1],url:lion[1].preview,source:lion[1].page}]
candidates['lion-3']=[{...lion[2],url:lion[2].preview,source:lion[2].page}]
const manifest=[]
for(const [id,options] of Object.entries(candidates)){
 const p=options[choices[id]??0];if(!p)throw Error(`No photo: ${id}`)
 // This legacy Commons page has no machine-readable Artist field; its caption credits Viki.
 if(p.title==='File:Grammostola rosea adult weiblich.jpg')p.author='Viki'
 const path=`${dir}/photos/${id}.jpg`
 if(!existsSync(path)||process.argv.includes(id)||process.argv.includes('--all')){
  const original=`${dir}/originals/${id}-${choices[id]??0}.jpg`,review=`${dir}/review/${id}-${choices[id]??0}.jpg`
  let data
  if(existsSync(original))data=readFileSync(original)
  else if(existsSync(review))data=readFileSync(review)
  else{
   const r=await fetch(p.url);if(!r.ok)throw Error(`${id}: HTTP ${r.status}`)
   data=Buffer.from(await r.arrayBuffer());await new Promise(r=>setTimeout(r,1200))
  }
  writeFileSync(original,data)
  const info=await sharp(data).metadata(),plan=framing[id]
  let pipeline=sharp(data).rotate()
  if(plan){
   const [x,y,w,h]=plan
   pipeline=pipeline.extract({left:Math.round(x*info.width),top:Math.round(y*info.height),width:Math.floor(w*info.width),height:Math.floor(h*info.height)})
  }else if(info.width>info.height){
   pipeline=pipeline.extract({left:Math.floor((info.width-info.height)/2),top:0,width:info.height,height:info.height})
  }
  await pipeline.resize({width:960,height:1200,fit:'inside',withoutEnlargement:true}).jpeg({quality:82,mozjpeg:true}).toFile(path)
  console.log(id)
 }
 const actual=await sharp(path).metadata()
 if(actual.width/actual.height>1.01||actual.width/actual.height<0.55)throw Error(`Invalid photo ratio: ${id}`)
 manifest.push({id,...p,file:path,outputWidth:actual.width,outputHeight:actual.height,changes:'crop-resize-compress'})
}
writeFileSync(`${dir}/manifest.json`,JSON.stringify(manifest,null,2))
const tiles=await Promise.all(manifest.map(async(p,index)=>({input:await sharp(p.file).resize(180,180).png().toBuffer(),left:index%5*180,top:Math.floor(index/5)*180})))
await sharp({create:{width:900,height:Math.ceil(tiles.length/5)*180,channels:3,background:'white'}}).composite(tiles).jpeg().toFile(`${dir}/photo-contact.jpg`)
console.log(manifest.map((p,i)=>`${i+1} ${p.id}: ${p.title}`).join('\n'))
