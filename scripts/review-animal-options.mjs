import {readFileSync,writeFileSync} from 'node:fs'
const dir='prepared-assets/animal-photos'
const candidates=JSON.parse(readFileSync(`${dir}/candidates.json`,'utf8'))
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
writeFileSync(`${dir}/alternatives.html`,`<!doctype html><meta charset="utf-8"><style>body{font:14px system-ui}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}img{width:100%;height:230px;object-fit:contain}</style><main>${process.argv.slice(2).flatMap(id=>candidates[id].options.map((p,i)=>`<article><img src="${esc(p.preview)}"><p>${id} ${i}: ${esc(p.title)}</p></article>`)).join('')}</main>`)
