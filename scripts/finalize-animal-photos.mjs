import {readFileSync,writeFileSync,statSync} from 'node:fs'
const dir='prepared-assets/animal-photos'
const entries=JSON.parse(readFileSync(`${dir}/manifest.json`,'utf8'))
if(entries.length!==29||new Set(entries.map(p=>p.id)).size!==29)throw new Error('Incomplete collection')
let bytes=0
for(const p of entries){
  bytes+=statSync(`${dir}/${p.file}`).size
  if(p.width<700||p.height<700||p.width/p.height<0.5||p.width/p.height>1.08)throw new Error(`Unexpected dimensions ${p.id}`)
  if(!p.author||!p.license||!p.source)throw new Error(`Missing attribution ${p.id}`)
}
writeFileSync(`${dir}/selected-photos.json`,JSON.stringify(entries,null,2))
writeFileSync(`${dir}/README.md`,`# Prepared animal photographs\n\nAll 29 selected JPEG files are saved in photos/. Open gallery.html for a visual overview. Nothing has been added to the map, the startup template or the admin resource library.\n\nSquare, near-square and portrait compositions. Most files are 960 pixels wide; three are larger originals and the penguin is 800×780. The images have not been cropped or AI-generated; some are resized Wikimedia thumbnails. Original-source links remain available for higher-resolution downloads. These are representative species photos, not photographs of specific animals at the fictional zoo.\n\nFor future public use, include the photographer, source and license link with each image. Attribution and share-alike requirements depend on the license. See manifest.json for dimensions, credits and resize notes.\n\n`+entries.map(p=>`## ${p.en} / ${p.de}\n\n- File: ${p.file} (${p.width}×${p.height})\n- Species: ${p.species}\n- Photographer: ${p.author}\n- License: [${p.license}](${p.licenseUrl||p.source})\n- [Source](${p.source})\n- Changes: ${p.changes}\n`).join('\n'))
const gallery=readFileSync(`${dir}/gallery.html`,'utf8').replace('Original square / portrait photos.','Square / portrait photographs; some resized by Wikimedia.')
writeFileSync(`${dir}/gallery.html`,gallery)
console.log(`Verified: ${entries.length} JPEGs, ${(bytes/1024/1024).toFixed(1)} MB, all source and license records present.`)
