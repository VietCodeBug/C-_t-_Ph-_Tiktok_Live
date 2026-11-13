import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export async function prepareGiftIcons({root=projectRoot}={}){
  const source=path.join(root,'assets/ui/tiktok-gifts'),out=path.join(root,'web/public/runtime/gifts');
  const manifest=JSON.parse(await fs.readFile(path.join(source,'manifest.json'),'utf8'));
  await fs.mkdir(out,{recursive:true});let bytes=0;
  for(const gift of manifest.gifts){
    if(!/^[a-z-]+\.webp$/.test(gift.file))throw new Error('Invalid local gift icon path');
    const data=await fs.readFile(path.join(source,gift.file));
    if(createHash('sha256').update(data).digest('hex')!==gift.sha256)throw new Error(`Gift icon checksum mismatch: ${gift.key}`);
    await fs.copyFile(path.join(source,gift.file),path.join(out,gift.file));bytes+=data.length;
  }
  await fs.copyFile(path.join(source,'unknown.svg'),path.join(out,'unknown.svg'));
  const catalog={...manifest,gifts:manifest.gifts.map(gift=>({...gift,icon:`gifts/${gift.file}`})),fallback:'gifts/unknown.svg'};
  await fs.writeFile(path.join(out,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
  return {icons:manifest.gifts.length,bytes,catalog:'runtime/gifts/catalog.json'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await prepareGiftIcons()));
