import { mkdir, rename, writeFile, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function readJson(file, fallback = {}) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function writeJsonAtomic(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = file + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
  await rename(temporary, file);
}

/** Serialize writes and retry dirty state on the next mark/flush after an error. */
export function createStateWriter({ snapshot, write, delay = 350, onError = () => {} }) {
  let dirty = false, pending = null, timer = null;
  async function flush() {
    clearTimeout(timer); timer = null;
    if (pending) { await pending; return flush(); }
    if (!dirty) return;
    dirty = false;
    const job = Promise.resolve().then(() => write(snapshot())).catch(error => { dirty = true; throw error; });
    pending = job;
    try { await job; } finally { if (pending === job) pending = null; }
    if (dirty) await flush();
  }
  return {
    mark() {
      dirty = true;
      if (!pending && !timer) timer = setTimeout(() => { timer = null; void flush().catch(onError); }, delay).unref();
    },
    flush,
    get pending() { return !!pending || dirty; },
  };
}
