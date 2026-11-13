import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeCameoAnimations } from '../src/event-cameos.js';

for (const [id, gesture] of [['npc02','police_stop'],['pet_dog','bark']]) {
  test(`${id}: original NPC array frames adapt to Player rectangles and stay within each atlas`, async () => {
    const folder = new URL(`../../assets/co-ty-phi-tiktok-live-v2/assets/characters/npc/${id}/`,import.meta.url);
    const raw = JSON.parse(await readFile(new URL('animations.json', folder),'utf8'));
    const original = JSON.stringify(raw);
    const animations = normalizeCameoAnimations(raw,id,gesture);
    for (const clip of ['idle',gesture]) {
      const png = await readFile(new URL(raw.animations[clip].image,folder));
      const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
      assert.ok(animations[clip].directions.S.length > 0);
      for (const frames of Object.values(animations[clip].directions)) for (const frame of frames) {
        const [x,y,w,h] = frame.rect;
        assert.ok(x >= 0 && y >= 0 && x+w <= width && y+h <= height);
      }
      assert.equal(animations[clip].directions.S.length, animations[clip].frameCount);
    }
    assert.equal(JSON.stringify(raw),original,'adapting a cameo does not modify its source manifest');
  });
}
