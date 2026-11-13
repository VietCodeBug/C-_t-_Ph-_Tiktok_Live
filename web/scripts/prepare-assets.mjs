import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'web/public/runtime');
const v2 = 'assets/co-ty-phi-tiktok-live-v2';
const v1 = 'assets/co-ty-phi-tiktok-live-v1';
const files = [];
async function copy(from, to) {
  const bytes = await readFile(path.join(root, from));
  const dest = path.join(out, to);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(path.join(root, from), dest);
  files.push({ from, to, sourceCommit: from.startsWith('assets/co-ty-phi-tiktok-live-') ? 'fb996c6c23433f14b465849510ba797ab6818bbe' : from.startsWith('assets/map/') ? 'abb5a1cf040e79bb98efe74a45050853e1e0e6cd' : null, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const actors = [];
for (const [id, gesture] of [['npc02', 'police_stop'], ['pet_dog', 'bark']]) {
  const source = `${v2}/assets/characters/npc/${id}`;
  const metadata = JSON.parse(await readFile(path.join(root, source, 'animations.json'), 'utf8'));
  await copy(`${source}/animations.json`, `cameos/${id}/animations.json`);
  for (const clip of ['idle', gesture]) {
    const image = metadata.animations[clip].image;
    await copy(`${source}/${image}`, `cameos/${id}/${image}`);
  }
}
for (let i = 1; i <= 20; i++) {
  const id = `ch${String(i).padStart(2, '0')}`;
  const source = `${v2}/assets/characters/${id}`;
  const raw = JSON.parse(await readFile(path.join(root, source, 'animations.json'), 'utf8'));
  const animations = {};
  for (const clip of ['idle', 'walk', 'run', 'roll_dice', 'happy']) {
    const a = raw.animations[clip];
    if (!a) throw new Error(`${id} missing ${clip}`);
    await copy(`${source}/${a.image}`, `characters/${id}/${a.image}`);
    animations[clip] = {
      image: `characters/${id}/${a.image}`, fps: a.fps, loop: a.loop, frameCount: a.frameCount,
      cues: a.cues, directions: a.directions,
      idlePose: a.idlePose, locomotion: a.locomotion
    };
  }
  let frontIdle;
  if (id === 'ch07') {
    const upgrade = JSON.parse(await readFile(path.join(root, 'assets/visual-upgrades/v5/ch07-front-idle.json'), 'utf8'));
    await copy('assets/visual-upgrades/v5/ch07-front-idle.png', 'upgrades/ch07-front-idle.png');
    frontIdle = { image: 'upgrades/ch07-front-idle.png', sourceRect: upgrade.sourceRect, renderedHeight: upgrade.renderedHeight || 202, pivot: raw.pivot };
  }
  actors.push({ id, name: raw.name, cell: raw.cell, pivot: raw.pivot, worldHeight: raw.worldHeight, animations, frontIdle });
}
await copy('assets/map/board_layouts.json', 'board_layouts.json');
await copy('assets/map/cho_via_he.glb', 'maps/cho_via_he.glb');
await copy('assets/map/pho_giao_hang.glb', 'maps/pho_giao_hang.glb');
const modelPaths = {
  house_mint: 'cho_via_he/house_mint', house_blue: 'cho_via_he/house_blue',
  market_tent: 'cho_via_he/market_tent', street_stall: 'cho_via_he/street_stall',
  street_tree: 'common_env/street_tree', bush_ball: 'common_env/bush_ball',
  flower_cart: 'cho_via_he/flower_cart', street_umbrella: 'cho_via_he/street_umbrella',
  bench: 'cho_via_he/bench', lamp_street: 'cho_via_he/lamp_street',
  plant_pot: 'cho_via_he/plant_pot', market_banner: 'cho_via_he/market_banner',
  stool_plastic: 'cho_via_he/stool_plastic', trash_can: 'cho_via_he/trash_can', grass_patch: 'common_env/grass_patch',
  warehouse_a: 'pho_giao_hang/warehouse_a', warehouse_b: 'pho_giao_hang/warehouse_b',
  loading_dock: 'pho_giao_hang/loading_dock', stack_boxes: 'pho_giao_hang/stack_boxes',
  delivery_gate: 'pho_giao_hang/delivery_gate', toy_bridge: 'pho_giao_hang/bridge_toy',
  traffic_cone: 'pho_giao_hang/traffic_cone', gate_start: 'common_env/gate_start',
  podium_1: 'common_env/podium_1', trophy_gold: 'common_env/trophy_gold'
};
for (const [name, rel] of Object.entries(modelPaths)) {
  await copy(`${v1}/assets/map/kit/${rel}.glb`, `models/${name}.glb`);
}
await copy(`${v2}/README_V2_3.md`, 'SOURCE_V2_3.md');
for (const name of await readdir(path.join(root, v1, 'assets/audio/sfx'))) {
  if (name.endsWith('.ogg')) await copy(`${v1}/assets/audio/sfx/${name}`, `audio/${name}`);
}
await mkdir(out, { recursive: true });
await mkdir(path.join(out, 'licenses'), { recursive: true });
await copyFile(path.join(root, 'web/node_modules/@fontsource-variable/nunito/LICENSE'), path.join(out, 'licenses/nunito-OFL.txt'));
await copyFile(path.join(root, 'web/node_modules/three/LICENSE'), path.join(out, 'licenses/three-MIT.txt'));
await writeFile(path.join(out, 'actors.json'), JSON.stringify({ version: '2.3', sourceCommit: 'fb996c6c23433f14b465849510ba797ab6818bbe', actors }));
await writeFile(path.join(out, 'provenance.json'), JSON.stringify({ spriteVersion: '2.3', environmentVersion: '1', sourceCommit: 'fb996c6c23433f14b465849510ba797ab6818bbe', mapSourceCommit: 'abb5a1cf040e79bb98efe74a45050853e1e0e6cd', thirdPartyLicenses: ['licenses/nunito-OFL.txt', 'licenses/three-MIT.txt'], files }, null, 2));
console.log(`Prepared ${actors.length} v2.3 characters, two maps, ${Object.keys(modelPaths).length} environment models; ${(files.reduce((s,f)=>s+f.bytes,0)/1048576).toFixed(1)} MB.`);
