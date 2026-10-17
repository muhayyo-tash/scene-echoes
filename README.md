# Scene Echoes

A mixed-reality prototype for the Meta VR Start Developer Competition 2026 (Entertainment track, New Experience division). Pictures and films echo into your real room as small 3D objects you can touch with your hands.

Scene Echoes is a file explorer in passthrough. The headset starts as a clean view of your room. Slide an open hand left to open the explorer (sofa photo and park film). The book scene never adds UI: open a real book, long-press with a finger on the page, and that object becomes a 3D model you can hold.

The demo loads **real GLB models**. It does not use box/sphere placeholders or a fake conversion timer. Movie **Processing** is a real preload of the film and its 3D objects; come back when the card says **Ready**.

Hosted link: `https://muhayyo-tash.github.io/scene-echoes/` (see `DEPLOY.md`).

## Who it is for

Ages 12 and up. Meta requires a parent-managed account for ages 10 to 12, and age limits can differ by country. Everything in the app is meant to follow Meta's 10+ content guidelines: gentle, with nothing scary or violent.

## How to run locally

Needs Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Open the printed HTTPS URL in the **Meta Quest Browser**, or use the bundled desktop WebXR emulator (IWER). Tap **Enter** on the landing page. You should see only your room.

Useful query flags (debug only): `?debug=1`, `?fast=1`, `?movie=ready`, `?object=duck`, `?open=sofa`, `?handsless=1`, `?reset=1`.

## How it was built

TypeScript WebXR app on the Immersive Web SDK, with three.js for custom visuals. Hand input, the file explorer, conversion reveal, book pose detection, movie timeline and furniture squash are custom. Scene understanding, optional depth occlusion and SDK grabbing are enabled in `iwsdk.config.json`.

## Adding your own photos, models and film

Drop files in, then edit JSON. No code changes.

- Photo: `public/assets/photos/<id>.jpg`
- Optional mask: `public/assets/masks/<id>.png`
- Model: `public/assets/models/<id>.glb` (required; the app will not substitute a primitive mesh)
- Film: `public/assets/movie/park.mp4`, `poster.jpg`, `timeline.json`
- List files in `public/assets/explorer.json` and objects in `public/assets/manifest.json`

Then run `npm run download-models` (if using the bundled Khronos/three.js samples), `npm run optimize-models`, `npm run optimize-video -- <input>`, `npm run validate-timeline` and rebuild.

Frame ranking for a future film (`npm run extract-frames -- <video>`) is a simple sharpness ranking, not AI. See `docs/MOVIE_PIPELINE.md` and `docs/CONVERSION_API.md`.

## Conversion service

The app loads models from the local manifest. A real client for a cloud conversion service (SAM 3D behind your own backend) lives under `src/conversion/live/` and is not connected. `CONVERSION_MODE` in `src/config.ts` stays `manifest` for the demo. Details: `docs/CONVERSION_API.md`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run download-models` | Fetches the real sofa, duck, flamingo and fox GLBs |
| `npm run generate-placeholders` | Builds the sofa photo, mask, poster and silent film if missing |
| `npm run optimize-models` | Recenter, scale, simplify, compress GLBs |
| `npm run optimize-video -- <file>` | H.264 MP4 under 50 MB |
| `npm run extract-frames -- <file>` | Candidate frames every 2 seconds |
| `npm run validate-timeline` | Checks `timeline.json` |
| `npm run mock-conversion-server` | Local mock of the conversion API |
| `npm test` | Unit tests |
| `npm run build` | Production build |

Animation lab (desktop only, not linked from the landing page): `/lab.html`. It loads the same real GLBs.
