import {writeFileSync} from 'node:fs'
const titles=['File:Nile crocodile head.jpg','File:Nile Crocodile, 18th October, 2024.jpg']
const query=new URLSearchParams({action:'query',format:'json',titles:titles.join('|'),prop:'imageinfo',iiprop:'url|size|extmetadata',iiurlwidth:'960'})
const r=await fetch(`https://commons.wikimedia.org/w/api.php?${query}`)
if(!r.ok)throw new Error(`HTTP ${r.status}`)
const pages=Object.values((await r.json()).query.pages)
for(const p of pages){
 const i=p.imageinfo[0],name=p.title===titles[0]?'crocodile-head':'crocodile-portrait'
 const file=await fetch(i.thumburl)
 if(!file.ok)throw new Error(`HTTP ${file.status}`)
 writeFileSync(`prepared-assets/animal-photos/${name}.jpg`,Buffer.from(await file.arrayBuffer()))
 writeFileSync(`prepared-assets/animal-photos/${name}.json`,JSON.stringify(i,null,2))
 console.log(name,i.width,i.height)
}
