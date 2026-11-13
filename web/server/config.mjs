import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: 1,
  username: '',
  autoJoinOnEnter: true,
  audio: { enabled: true, voice: 'vi-VN-HoaiMyNeural', rate: 1.05, volume: .85 },
  gameplay: { maxPlayers: 20, startingMoney: 1000, inactivitySeconds: 300, autoRollSeconds: 10 },
  gifts: { roseIds: ['5655'] },
});

const bounded = (value, fallback, min, max) => Number.isFinite(Number(value))
  ? Math.min(max, Math.max(min, Number(value))) : fallback;
export function cleanUsername(value) {
  const username = String(value ?? '').trim().replace(/^@/, '');
  if (username && !/^[A-Za-z0-9_.]{1,40}$/.test(username)) {
    throw Object.assign(new Error('Nhập username TikTok hợp lệ, không dùng đường dẫn.'), { status: 400 });
  }
  return username;
}

/** Public settings deliberately contain no credentials. SIGN_API_KEY stays in the environment. */
export function validateSettings(input = {}, previous = DEFAULT_SETTINGS) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Cấu hình phải là một đối tượng JSON.'), { status: 400 });
  }
  const audio = input.audio ?? {}, gameplay = input.gameplay ?? {}, gifts = input.gifts ?? {};
  const roseIds = Array.isArray(gifts.roseIds) ? [...new Set(gifts.roseIds.map(String).filter(id => /^[1-9]\d{0,19}$/.test(id)))].slice(0, 20) : previous.gifts.roseIds;
  return {
    schemaVersion: 1,
    username: Object.hasOwn(input, 'username') ? cleanUsername(input.username) : previous.username,
    autoJoinOnEnter: Object.hasOwn(input, 'autoJoinOnEnter') ? input.autoJoinOnEnter === true : previous.autoJoinOnEnter,
    audio: {
      enabled: typeof audio.enabled === 'boolean' ? audio.enabled : previous.audio.enabled,
      voice: ['female', 'male', 'vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural'].includes(audio.voice) ? audio.voice : previous.audio.voice,
      rate: bounded(audio.rate, previous.audio.rate, .8, 1.25),
      volume: bounded(audio.volume, previous.audio.volume, 0, 1),
    },
    gameplay: {
      maxPlayers: Math.round(bounded(gameplay.maxPlayers ?? gameplay.seats, previous.gameplay.maxPlayers, 1, 20)),
      startingMoney: Math.round(bounded(gameplay.startingMoney, previous.gameplay.startingMoney, 100, 100000)),
      inactivitySeconds: Math.round(bounded(gameplay.inactivitySeconds, previous.gameplay.inactivitySeconds, 30, 3600)),
      autoRollSeconds: bounded(gameplay.autoRollSeconds, previous.gameplay.autoRollSeconds, 3, 60),
    },
    gifts: { roseIds },
  };
}

export function serverConfig(env = process.env) {
  const port = Number(env.COTYPHI_PORT || 5182);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('COTYPHI_PORT không hợp lệ.');
  return {
    host: '127.0.0.1', port,
    dataDir: resolve(env.COTYPHI_DATA_DIR || resolve(WEB_ROOT, 'runtime')),
    distDir: resolve(WEB_ROOT, 'dist'),
    adminFile: resolve(WEB_ROOT, 'server', 'admin.html'),
  };
}
