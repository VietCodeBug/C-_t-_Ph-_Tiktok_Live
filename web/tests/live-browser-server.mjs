// Isolated browser-test fixture. Never used by npm run live/start-live.cmd.
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { createLiveServer } from '../server/index.mjs';

if (!process.env.LIVE_QA_TOKEN) throw new Error('Set a temporary LIVE_QA_TOKEN to run this test fixture');
const port = Number(process.env.LIVE_QA_PORT || 5180);
const origin = `http://127.0.0.1:${port}`;
const token = process.env.LIVE_QA_TOKEN;
function silence() {
  const data = Buffer.alloc(44 + 8000); data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(8000, 24); data.writeUInt32LE(16000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(8000, 40); return data;
}
const app = await createLiveServer({ config: { port }, dataDir: resolve('artifacts/live-studio/qa-runtime'),
  synthesizeTTS: async () => ({ buffer: silence(), contentType: 'audio/wav', provider: 'test-silence' }) });
await app.listen(port);
const helper = createServer(async (request, response) => {
  const json = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
  if (request.headers['x-test-token'] !== token || request.method !== 'POST') return json(403, { error: 'Test fixture only' });
  try {
    let raw = ''; for await (const chunk of request) { raw += chunk; if (raw.length > 30000) throw Error('Too large'); }
    const input = JSON.parse(raw), room = app.rooms[input.mode === 'demo' ? 'demo' : 'live'];
    if (request.url === '/source') {
      room.setConnection({ status: 'mock', host: 'qa-simulated-source' });
      for (const event of input.events || []) await room.handleSourceEvent(event);
    } else if (request.url === '/advance') {
      const seconds = Number(input.seconds);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3000) throw Error('Invalid test duration');
      room.stop();
      for (let t = 0; t < seconds; t += .1) { await room.operations; room.tick(Math.min(.1, seconds - t)); }
      await room.operations;
      room.start();
    } else if (request.url === '/disconnect') room.setConnection({ status: 'disconnected' });
    else if (request.url === '/reconnect') room.setConnection({ status: 'mock' });
    else return json(404, { error: 'No fixture route' });
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
    json(200, room.getSnapshot());
  } catch (error) { json(400, { error: error.message }); }
});
await new Promise(resolveListen => helper.listen(port + 1, '127.0.0.1', resolveListen));
console.log(JSON.stringify({ ready: true, origin, helper: port + 1 }));
const close = async () => { await app.close(); await new Promise(resolveClose => helper.close(resolveClose)); };
process.on('SIGINT', () => void close()); process.on('SIGTERM', () => void close());
