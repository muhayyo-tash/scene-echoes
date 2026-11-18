# Scene Echoes

<p align="center">
  <img src=".github/logo.png" alt="Meta Echoes" width="160" />
</p>

A mixed-reality prototype for the Meta VR Start Developer Competition 2026 (Entertainment track, New Experience division). Photos and films leave the screen and show up in your real room as 3D objects you can move with your hands.

The headset starts as a clean view of your room. Open **Meta Echoes** from the dock for Pictures and Movies. With local API keys, you can also hold a fist toward empty space to load what you are looking at.

Hosted link: `https://muhayyo-tash.github.io/scene-echoes/` (see `DEPLOY.md`).

## Hand gestures

Aligned with [Meta’s hands interaction types](https://developers.meta.com/horizon/design/hands-interaction-types/) (pinch to select, palm grab for heavier actions):

| Gesture | What it does |
| --- | --- |
| **Pinch** | Meta Echoes UI, open a photo or film, pinch and hold on a photo to bring its subject into the room |
| **Fist** | Empty-space scene load (local live API only) |

- **Pinch** — thumb + index (Meta select): open the dock icon, pick a photo or film, then pinch and hold on an open photo to load its 3D model. Grab film objects to move them.
- **Fist** — hold a clear fist out in front of you for about 1 second (not at your sides, not while aiming at UI). Runs only with local live conversion (`.env` keys via `npm run dev`). On GitHub Pages, or without keys, fist does nothing. There is no offline stand-in model.

## How to run locally

Needs Node.js 20.19 or newer.

### Offline / competition demo (no API keys)

```bash
npm install
npm run dev
```

Open the printed HTTPS URL in the **Meta Quest Browser**. Tap **Enter**.

- Pinch Meta Echoes → sofa photo → pinch and hold → `sofa.glb`
- Open Movies for the bundled films (soft echo past the screen + grabable props)
- Empty-space fist is inactive without live API keys

### Live Gemini → Hugging Face flow

Keys never go into the Quest page or GitHub Pages. Local Vite proxies `/v1/*` to a Node conversion worker (`scripts/live-reconstruct.mjs`).

1. Copy `.env.example` → `.env` and set:

```bash
GEMINI_API_KEY=your_gemini_key
HF_TOKEN=your_huggingface_token
```

2. Install and start the app (conversion middleware loads with Vite):

```bash
npm install
npm run dev
```

3. On Quest (same LAN), open the printed HTTPS URL, enter XR, then:

- **Photo:** pinch and hold on the open print → Gemini names the marked object → SAM 3D Objects (Hugging Face) rebuilds a GLB → object appears in the room. If the API fails, the bundled model for that photo is used when allowed.
- **Empty space:** hold a fist out in front → same Gemini → HF pipeline. On failure, the load cancels (no bundled stand-in).

`docs/CONVERSION_API.md` describes the JSON contract. Standalone server (optional): `npm run conversion-server`.

GitHub Pages stays on bundled models because API keys never ship to the browser.

Useful query flags (debug only): `?debug=1`, `?fast=1`, `?movie=ready`, `?object=sofa`, `?open=sofa`, `?handsless=1`, `?reset=1`, `?live=1`.

## Asset folder layout

| Path | Role |
| --- | --- |
| `public/assets/photos/` | 2D images for Meta Echoes Pictures |
| `public/assets/models/` | Matching GLBs (photos + film-scoped props) |
| `public/assets/movie/` | MP4s, `films.json`, `timeline.json` |
| `public/assets/manifest.json` | Registers every object the runtime can load |
| `public/assets/explorer.json` | Photos listed in Meta Echoes |

**Competition default:** Meta Echoes Pictures lists the sofa photo (`explorer.json`). Sofa’s GLB must stay for submission. Movies come from `films.json` and the preprocessed timeline.

## Adding a photo to Meta Echoes

1. Drop the 2D image at `public/assets/photos/<id>.jpg` (or `.png`).
2. Drop the matching GLB at `public/assets/models/<id>.glb`.
3. Add an object in `public/assets/manifest.json`:

```json
{
  "id": "lamp",
  "scene": "object3d",
  "photo": "assets/photos/lamp.jpg",
  "model": "assets/models/lamp.glb",
  "kind": "object",
  "label": "lamp",
  "realSize": 0.4,
  "up": "y",
  "baseOffset": 0,
  "hotspot": { "type": "circle", "x": 0.5, "y": 0.45, "r": 0.3 }
}
```

4. List it in `public/assets/explorer.json`:

```json
[
  { "type": "photo", "id": "sofa" },
  { "type": "photo", "id": "lamp" }
]
```

Restart `npm run dev`. The new card appears in Meta Echoes; pinch and hold on the open print loads that GLB.

## Adding a film (offline demo timeline)

Competition / Pages ships **preprocessed** films (timeline + GLBs already in the repo), so Quest playback does not wait on APIs. Use this script only when you want to bake your own MP4.

1. Drop an MP4 in `public/assets/movie/` (e.g. `park.mp4`).
2. With `GEMINI_API_KEY` + `HF_TOKEN` in `.env` and `ffmpeg` installed:

```bash
npm run prepare-film -- park.mp4
```

Pass the full MP4 name (or path). Bare ids like `park` error.

That extracts JPEG frames (at 1s, then every 5s) and asks Gemini for the main object only:

`object: deer`

Objects go to Hugging Face for a GLB. Room mood comes from the soft video echo around the player, not from Gemini. While a film plays, the picture softens and expands past the frame as a translucent echo (room still visible through it); the center panel stays the original opaque MP4. Expect **~1–2 minutes per object** on HF. The HF API also has a daily usage limit, so long or multi-object runs can stop mid-way.

Each sample time is an appear mark (not a 5s window). Props stay in the scene for **6 seconds**, then ease out. The first **~3.5s** of playback stay prop-free so you can see the film; all props use one small hand-reachable size. The same `objectId` across consecutive samples keeps one continuous mesh.

Writes:

- `public/assets/models/<filmId>-<object>.glb` — film-scoped props (e.g. `london-bridge.glb` vs `japan-bridge.glb`)
- `public/assets/movie/timeline.json` — **per film id** object moments (`films.<id>`, `objectId` matches the GLB stem, `lifetime: 6`)
- movie entries in `public/assets/manifest.json` (same film-scoped ids)
- `public/assets/movie/films.json` — Meta Echoes Movies list

Optional flags: `--every 4` (spacing after the first 1s frame), `--max 6` (max moments), `--skip-hf` (timeline only; you drop GLBs yourself).

Live film conversion on `npm run dev` uses the same Gemini → HF path; this script bakes those assets for the offline demo / Pages deploy.
