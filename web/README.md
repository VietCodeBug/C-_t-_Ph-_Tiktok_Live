# Phố Đồ Chơi — web camera demo

**Bản local V5:** xem [LOCAL_PREVIEW.md](LOCAL_PREVIEW.md) — mặc định **20 quân / 100 tài khoản, 80 khách chờ**, ba vòng đường và top 3 chốt ván. Bục 8 giây → sảnh giữ ghế 15 giây: tối đa 12 người cũ đầu tiên đủ 30 tim mới giữ ghế, tối thiểu tám khách chờ lâu nhất lên nếu đủ hàng; suất giữ ghế dư cũng lấy FIFO. Khách chờ đặt/hủy đơn SHOP01 miễn phí, góp vốn và nhận lì xì mà không tạo sprite trên map. Mỗi ván mới reset toàn bộ ví về 1.000; MC bàn giao text/JSON cho repo riêng. Mở [bản mặc định](http://localhost:4173/?players=20&accounts=100); 100/200 quân chỉ bật qua `stress=1`. Đây là mô phỏng local, chưa có adapter TikTok. Nội dung dưới đây mô tả bản camera gốc và các bằng chứng cũ.

Interactive portrait preview with ten real characters from the user's Sprite V2.3 pack, the prepared two map layouts, and environment models from the user's V1 pack.

## Run

Requires Node 22.12+ (local upgrade tested: 22.20.0; original preview: 24.22.1).

```bash
cd web
npm ci
npm run dev
```

`npm run build` prepares only the assets needed by the demo and builds a standalone static site in `web/dist`. `npm run preview` serves that build on port 4173. The site makes no external font/CDN requests and does not need a TikTok connection.

## Controls

- **Tự chuyển**: overview → spinning die + character gesture → revealed result → third-person chase → arrival → next seat.
- **Lắc**: roll early during the overview. A fair random result from 1–6 is revealed after 1.8 seconds of spinning; it stays visible for 0.95 seconds before movement starts. The character then traverses exactly that many tile edges, including through forks. Repeated clicks cannot reroll an active turn.
- **Toàn bàn**: keep the aerial camera while characters take turns.
- **Bám nhân vật**: third-person camera behind the character; the body remains visible.
- Select A–J to change the active character; **Lượt tiếp** advances the seat.
- Pause/resume with the button or Space; this freezes the die, result settling, movement and animation together. V switches aerial/chase; Right Arrow advances a seat.
- Scroll over the map to adjust camera distance.
- Switch Chợ Vỉa Hè / Phố Giao Hàng, change demo speed, enter fullscreen, or export a 1080×1920 map capture.

## Assets and animation

The source commit is `fb996c6c23433f14b465849510ba797ab6818bbe` on `assets/co-ty-phu-prototype`.

- Sprites: `assets/co-ty-phi-tiktok-live-v2`, including Idle revision 2.3 and locomotion revisions in the actual manifests.
- Environment: `assets/co-ty-phi-tiktok-live-v1/assets/map/kit`.
- Dice sound: the user's V1 `assets/audio/sfx/sfx_dice_roll.ogg`; enabled after the first pointer interaction, subject to browser autoplay rules.
- Maps/graph: `assets/map` from the portrait-map work.

Original asset files are not edited. The preparation script copies selected files and writes hashes to `runtime/provenance.json`. Each player uses a 256×256 canvas texture, a fixed foot pivot (128,218), metadata-defined crop rectangles, and S/E/N plus mirrored W art. Run frame progression follows traveled distance using `cycleTravelArtPx`; idle uses elapsed time with no root movement. The chase camera projects movement into camera-relative facing so its rear view uses the supplied back art.

The renderer batches static geometry and fades buildings between the camera and the active character. It keeps the active character's name in the HUD rather than duplicating a large tag above the head. Ten seats remain visible/selectable.

Three.js is pinned to **0.180.0**. In 0.187.0, GLTFLoader interprets the pack's descriptive `extras.pivot: 'bottom-center'` as a numeric pivot container, producing nonfinite transforms. The compatible version loads the source metadata without modifying the GLBs. Recheck this when upgrading Three.js.

This is a **visual/camera demo**, not the completed TikTok game: wallet values are preview values, dice results use browser cryptographic randomness, fork choices follow the demo's seat/turn rule, and no live chat, gifts, economy settlement or backend has been implemented. Authoritative multiplayer dice would need a server.

## Validation

`tests/browser-smoke.py` uses Python Playwright and Chromium to verify real asset loading, finite geometry, movement and frame advance, third-person position, camera switches, seat selection, pause, both maps, mobile 9:16 layout and image export. The retained report and screenshots are in `docs/`.

`npm test` checks every die result on both maps, including both routes at each fork, pause, cancellation, invalid values and RNG rejection sampling. `tests/dice-browser.py` verifies the manual button, visible spin/reveal order, frozen spin/settling on pause, matching pips and actual tile counts. [Result screenshot](docs/dice-result-mobile.png) · [Dice browser report](docs/dice-browser.json).

```bash
python web/tests/browser-smoke.py
python web/tests/dice-browser.py
```

The test renderer is Chromium's software WebGL fallback in this cloud instance. It is not evidence of FPS on the user's streaming hardware.

## Hosting

The output directory is a static website. `.openai/hosting.json` declares `dist` for environments that provide the preview relay. The current cloud instance reports `preview relay unavailable` even outside the sandbox.

A static `gh-pages` branch can be served by GitHub Pages. In the repository's Settings → Pages, select **Deploy from a branch → gh-pages → /(root)**. The corresponding project URL is `https://vietcodebug.github.io/C-_t-_Ph-_Tiktok_Live/`; do not describe it as live until Pages deployment has been confirmed. GitHub API access from this cloud is blocked, so site enablement cannot be confirmed here.
