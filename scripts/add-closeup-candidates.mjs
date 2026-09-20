import {readFileSync,writeFileSync} from 'node:fs'
const path='prepared-assets/exhibit-animals/candidates.json',c=JSON.parse(readFileSync(path,'utf8'))
const files={lionfish:'File:Red Lionfish Pterois volitans Face 1527px.jpg',redknee:'File:ParcPhoenixVivarium.jpg'}
const params=new URLSearchParams({action:'query',format:'json',titles:Object.values(files).join('|'),prop:'imageinfo',iiprop:'url|size|extmetadata',iiurlwidth:'960'})
const r=await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);if(!r.ok)throw Error(r.status)
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()
for(const p of Object.values((await r.json()).query.pages)){
 const id=Object.keys(files).find(id=>files[id]===p.title),i=p.imageinfo[0],m=i.extmetadata
 if(!id||c[id].some(e=>e.title===p.title))continue
 c[id].push({title:p.title,url:i.thumburl,source:i.descriptionurl,author:clean(m.Artist?.value),license:clean(m.LicenseShortName?.value),licenseUrl:m.LicenseUrl?.value,width:i.width,height:i.height,description:clean(m.ImageDescription?.value)})
 console.log(id,c[id].length-1)
}
writeFileSync(path,JSON.stringify(c,null,2))
