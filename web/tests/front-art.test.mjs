import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { frontIdlePlacement } from '../src/front-art.js';

test('clean front idle keeps canonical feet and fits within the 256px sprite cell', async () => {
  const spec = JSON.parse(await readFile(new URL('../../assets/visual-upgrades/v5/ch07-front-idle.json', import.meta.url), 'utf8'));
  const png = await readFile(new URL('../../assets/visual-upgrades/v5/ch07-front-idle.png', import.meta.url));
  const [sx,sy,sw,sh,x,y,w,h] = frontIdlePlacement(spec);
  assert.ok(sx >= 0 && sy >= 0 && sx+sw <= png.readUInt32BE(16) && sy+sh <= png.readUInt32BE(20));
  assert.equal(x+w/2, 128); assert.equal(y+h, 218);
  assert.ok(x >= 0 && y >= 0 && x+w <= 256 && y+h <= 256);
});
