# Scene Echoes

A mixed-reality prototype for the Meta VR Start Developer Competition 2026 (Entertainment track, New Experience division). Pictures and films echo into your real room as 3D objects you can move with your hands.

The headset starts as a clean view of your room. Open **Meta Echoes** from the dock, open a photo, or load from empty space using the hand gestures below. An MP4 in Meta Echoes is the movie flow.

Hosted link: `https://muhayyo-tash.github.io/scene-echoes/` (see `DEPLOY.md`).

## Hand gestures

Aligned with [Meta’s hands interaction types](https://developers.meta.com/horizon/design/hands-interaction-types/) (pinch for UI/select, palm grab for heavier actions):

| Gesture | What it does |
| --- | --- |
| **Fist** | Empty-space scene load (live API when keys are set; otherwise eagle demo) |
| **Pinch** | Meta Echoes UI + open photo + 2D→3D pop |

- **Fist** — close the hand and hold ~0.7s in empty space (not while aiming at UI). This is the scene-capture gesture for **both** the Gemini → Hugging Face API path and the offline eagle fallback. Pinch alone will not spawn scene models.
- **Pinch** — thumb + index (Meta select): open the dock icon, pick a photo card, then pinch-and-hold on the open 2D print to pop its 3D model.

## How to run locally

Needs Node.js 20.19 or newer.

### Offline / competition demo (no API keys)

```bash
npm install
npm run dev
```

Open the printed HTTPS URL in the **Meta Quest Browser**. Tap **Enter**.

- Pinch Meta Echoes → sofa photo → pinch-hold → `sofa.glb`
- **Fist** in empty room space (~0.7s) → **Loading…** → `eagle.glb`

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

- **Meta Echoes photo pinch** → Gemini names the marked object → SAM 3D Objects (Hugging Face) rebuilds a GLB → object appears in the room. If the API fails, the bundled model for that photo is used when allowed.
- **Empty-space fist** → headset still → same Gemini → HF pipeline. If capture or conversion fails, the app falls back to `eagle.glb`.

`docs/CONVERSION_API.md` describes the JSON contract. Standalone server (optional): `npm run conversion-server`.

GitHub Pages stays on bundled models because API keys never ship to the browser.

Useful query flags (debug only): `?debug=1`, `?fast=1`, `?movie=ready`, `?object=eagle`, `?open=sofa`, `?handsless=1`, `?reset=1`, `?live=1`.

## Asset folder layout

| Path | Role |
| --- | --- |
| `public/assets/photos/` | 2D images for Meta Echoes cards |
| `public/assets/models/` | Matching GLBs (and scene-fist demos) |
| `public/assets/manifest.json` | Registers every object the runtime can load |
| `public/assets/explorer.json` | Subset listed in the Meta Echoes UI |

**Competition default:** Meta Echoes only lists the sofa photo (`explorer.json`). Sofa’s GLB must stay for submission. `eagle.glb` is only for empty-space fist when live APIs are unavailable; remove it (and its `manifest.json` entry) before submit if you want a leaner package.

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

Restart `npm run dev`. The new card appears in Meta Echoes; pinch-hold on the open print loads that GLB.

## Adding a film (offline demo timeline)

Competition / Pages ships a **preprocessed** film (timeline + GLBs already in the repo), so Quest playback does not wait on APIs. Use this script only when you want to bake your own MP4.

1. Drop an MP4 in `public/assets/movie/` (e.g. `park.mp4`).
2. With `GEMINI_API_KEY` + `HF_TOKEN` in `.env` and `ffmpeg` installed:

```bash
npm run prepare-film -- park.mp4
```

Pass the full MP4 name (or path). Bare ids like `park` error.

That extracts JPEG frames (at 1s, then every 5s), asks Gemini to name each, then sends the same frame + label to Hugging Face (SAM 3D Objects). Expect **~1.5 minutes per object** on HF (plus a short Gemini call). The HF API also has a daily usage limit, so long or multi-object runs can stop mid-way.

Writes:

- `public/assets/models/<object>.glb` — reconstructed props
- `public/assets/movie/timeline.json` — when each object appears
- movie entries in `public/assets/manifest.json`
- `public/assets/movie/films.json` — Meta Echoes Movies list

Optional flags: `--every 4` (spacing after the first 1s frame), `--max 6` (max moments), `--skip-hf` (timeline only; you drop GLBs yourself).

Live film conversion on `npm run dev` uses the same Gemini → HF path; this script bakes those assets for the offline demo / Pages deploy.
