import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import sharp from 'file:///C:/Users/ssbor/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs'
const dir='prepared-assets/exhibit-animals/review';mkdirSync(dir,{recursive:true})
const c=JSON.parse(readFileSync('prepared-assets/exhibit-animals/candidates.json','utf8'))
const choices={clownfish:[1,5,7], 'yellow-tang':[1,8,10],lionfish:[5,6,7],seahorse:[2,3,4],cardinalfish:[10,11,13],'jeweled-lizard':[2,3,9],'leopard-gecko':[5,9,13],'bearded-dragon':[3,6,14],chameleon:[5,10,12],curlyhair:[1,2,3],greenbottle:[4,9,14],pinktoe:[3,4,5]}
for(const [id,indices] of Object.entries(choices)){
 const tiles=[]
 for(const [column,index]of indices.entries()){
  const p=c[id][index],path=`${dir}/${id}-${index}.jpg`
  if(!existsSync(path)){
   const r=await fetch(p.url);if(!r.ok){console.log('Skipped',id,index,r.status);continue}
   writeFileSync(path,Buffer.from(await r.arrayBuffer()));await new Promise(r=>setTimeout(r,800))
  }
  tiles.push({input:await sharp(path).resize(300,300,{fit:'contain',background:'white'}).png().toBuffer(),left:column*300,top:0})
 }
 await sharp({create:{width:900,height:300,channels:3,background:'white'}}).composite(tiles).jpeg().toFile(`${dir}/${id}-choices.jpg`)
 console.log(id,indices)
}
