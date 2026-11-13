import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStateWriter, readJson, writeJsonAtomic } from '../server/state-writer.mjs';

test('changes during an in-flight save are written afterward without overlapping writes', async () => {
  let value = 1, inFlight = 0, peak = 0, release;
  const saved = [];
  const writer = createStateWriter({ snapshot: () => ({ value }), delay: 10000,
    write: async snapshot => { peak = Math.max(peak, ++inFlight); if (!saved.length) await new Promise(resolve => { release = resolve; }); saved.push(snapshot.value); inFlight--; },
  });
  writer.mark(); const flushing = writer.flush();
  while (!release) await Promise.resolve();
  value = 2; writer.mark(); release(); await flushing;
  assert.deepEqual(saved, [1, 2]); assert.equal(peak, 1); assert.equal(writer.pending, false);
});
test('a failed save remains dirty and can be retried explicitly', async () => {
  let fail = true; const saved = [];
  const writer = createStateWriter({ snapshot: () => ({ durable: true }), delay: 10000, write: async value => { if (fail) throw new Error('disk unavailable'); saved.push(value); } });
  writer.mark(); await assert.rejects(writer.flush(), /disk unavailable/);
  assert.equal(writer.pending, true); fail = false; await writer.flush();
  assert.deepEqual(saved, [{ durable: true }]); assert.equal(writer.pending, false);
});
test('atomic JSON replacement is readable, leaves no temporary file, and distinguishes corruption from absence', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'co-ty-phi-writer-test-'));
  t.after(async () => { assert(directory.startsWith(join(tmpdir(), 'co-ty-phi-writer-test-'))); await rm(directory, { recursive: true, force: true }); });
  const file = join(directory, 'state.json');
  assert.deepEqual(await readJson(file, { empty: true }), { empty: true });
  await writeJsonAtomic(file, { receipts: ['old'] }); await writeJsonAtomic(file, { receipts: ['new'] });
  assert.deepEqual(await readJson(file), { receipts: ['new'] });
  assert.deepEqual(await readdir(directory), ['state.json']);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).receipts[0], 'new');
  await writeFile(file, '{broken', 'utf8');
  await assert.rejects(readJson(file), SyntaxError);
});
