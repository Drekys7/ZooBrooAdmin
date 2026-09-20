import {groups} from './exhibit-species.mjs'
import {mkdirSync,existsSync,readFileSync,writeFileSync} from 'node:fs'
const dir='prepared-assets/exhibit-animals';mkdirSync(dir,{recursive:true})
const path=`${dir}/candidates.json`
const result=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{}
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()
for(const [id,species] of Object.values(groups).flat()){
 if(result[id]?.length)continue
 const params=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:`intitle:"${species}" filetype:bitmap`,gsrnamespace:'6',gsrlimit:'25',prop:'imageinfo',iiprop:'url|size|extmetadata',iiurlwidth:'960'})
 const r=await fetch(`https://commons.wikimedia.org/w/api.php?${params}`,{headers:{'User-Agent':'ZooBrooDemo/1.0 educational animal photo collection'}})
 if(!r.ok)throw Error(`${id}: ${r.status}, retry-after ${r.headers.get('retry-after')}`)
 const data=await r.json()
 result[id]=Object.values(data.query?.pages||{}).sort((a,b)=>a.index-b.index).flatMap(p=>{
  const i=p.imageinfo?.[0],m=i?.extmetadata||{},license=clean(m.LicenseShortName?.value)
  if(!i||i.width<500||i.height<500||!/\.jpe?g(?:\?|$)/i.test(i.url)||!/CC BY|CC0|Public domain/i.test(license)||/drawing|map|distribution|skull|dead|stamp/i.test(p.title))return []
  return [{title:p.title,url:i.thumburl||i.url,source:i.descriptionurl,author:clean(m.Artist?.value),license,licenseUrl:m.LicenseUrl?.value||'https://creativecommons.org/publicdomain/mark/1.0/',width:i.width,height:i.height,description:clean(m.ImageDescription?.value)}]
 })
 writeFileSync(path,JSON.stringify(result,null,2));console.log(id,result[id].length)
 await new Promise(r=>setTimeout(r,1700))
}
