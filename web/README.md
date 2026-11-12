# Phố Đồ Chơi — web camera demo

Interactive portrait preview with ten real characters from the user's Sprite V2.3 pack, the prepared two map layouts, and environment models from the user's V1 pack.

## Run

Requires Node 24 (tested: 24.22.1).

```bash
cd web
npm ci
npm run dev
```

`npm run build` prepares only the assets needed by the demo and builds a standalone static site in `web/dist`. `npm run preview` serves that build on port 4173. The site makes no external font/CDN requests and does not need a TikTok connection.

## Controls

- **Tự chuyển**: overview → dice gesture → third-person chase → arrival → next seat.
- **Toàn bàn**: keep the aerial camera while characters take turns.
- **Bám nhân vật**: third-person camera behind the character; the body remains visible.
- Select A–J to change the active character; **Lượt tiếp** advances the seat.
- Pause/resume with the button or Space; V switches aerial/chase; Right Arrow advances a seat.
- Scroll over the map to adjust camera distance.
- Switch Chợ Vỉa Hè / Phố Giao Hàng, change demo speed, enter fullscreen, or export a 1080×1920 map capture.

## Assets and animation

The source commit is `fb996c6c23433f14b465849510ba797ab6818bbe` on `assets/co-ty-phu-prototype`.

- Sprites: `assets/co-ty-phi-tiktok-live-v2`, including Idle revision 2.3 and locomotion revisions in the actual manifests.
- Environment: `assets/co-ty-phi-tiktok-live-v1/assets/map/kit`.
- Maps/graph: `assets/map` from the portrait-map work.

Original asset files are not edited. The preparation script copies selected files and writes hashes to `runtime/provenance.json`. Each player uses a 256×256 canvas texture, a fixed foot pivot (128,218), metadata-defined crop rectangles, and S/E/N plus mirrored W art. Run frame progression follows traveled distance using `cycleTravelArtPx`; idle uses elapsed time with no root movement. The chase camera projects movement into camera-relative facing so its rear view uses the supplied back art.

The renderer batches static geometry and fades buildings between the camera and the active character. It keeps the active character's name in the HUD rather than duplicating a large tag above the head. Ten seats remain visible/selectable.

Three.js is pinned to **0.180.0**. In 0.187.0, GLTFLoader interprets the pack's descriptive `extras.pivot: 'bottom-center'` as a numeric pivot container, producing nonfinite transforms. The compatible version loads the source metadata without modifying the GLBs. Recheck this when upgrading Three.js.

This is a **visual/camera demo**, not the completed TikTok game: wallet values are preview values, turn/movement playback is deterministic, and no live chat, gifts, economy settlement or backend has been implemented.

## Validation

`tests/browser-smoke.py` uses Python Playwright and Chromium to verify real asset loading, finite geometry, movement and frame advance, third-person position, camera switches, seat selection, pause, both maps, mobile 9:16 layout and image export. The retained report and screenshots are in `docs/`.

```bash
python web/tests/browser-smoke.py
```

The test renderer is Chromium's software WebGL fallback in this cloud instance. It is not evidence of FPS on the user's streaming hardware.

## Hosting

The output directory is a static website. `.openai/hosting.json` declares `dist` for environments that provide the preview relay. The current cloud instance reports `preview relay unavailable` even outside the sandbox.

A static `gh-pages` branch can be served by GitHub Pages. In the repository's Settings → Pages, select **Deploy from a branch → gh-pages → /(root)**. The corresponding project URL is `https://vietcodebug.github.io/C-_t-_Ph-_Tiktok_Live/`; do not describe it as live until Pages deployment has been confirmed. GitHub API access from this cloud is blocked, so site enablement cannot be confirmed here.
