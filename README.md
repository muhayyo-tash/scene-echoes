# Scene Echoes

A mixed-reality prototype for the Meta VR Start Developer Competition 2026 (Entertainment track, New Experience division). Pictures and films echo into your real room as 3D objects you can move with your hands.

The headset starts as a clean view of your room. Slide an open hand left to open Finder. A photo is the hold-to-convert flow for any 3D object. An MP4 in Finder is the movie flow: the film plays in the room while Gemini + SAM 3D pull objects out of sampled frames.

Hosted link: `https://muhayyo-tash.github.io/scene-echoes/` (see `DEPLOY.md`).

## Who it is for

Ages 12 and up. Meta requires a parent-managed account for ages 10 to 12, and age limits can differ by country. Everything in the app is meant to follow Meta's 10+ content guidelines: gentle, with nothing scary or violent.

## How to run locally

Needs Node.js 20.19 or newer. Put `GEMINI_API_KEY` and `HF_TOKEN` in `.env` for live conversion (never commit that file).

```bash
npm install
npm run dev
```

Open the printed HTTPS URL in the **Meta Quest Browser**, or press **Enter** in a desktop browser for the orbit/click preview. Tap **Enter** on the landing page. You should see only your room.

Local Vite enables live conversion automatically. GitHub Pages stays on bundled sofa/duck models because API keys never go in the browser.

Useful query flags (debug only): `?debug=1`, `?fast=1`, `?movie=ready`, `?object=duck`, `?open=sofa`, `?handsless=1`, `?reset=1`, `?live=1`.

## Adding a film

Drop an MP4 in `public/assets/movie/`. Finder Movies lists each file. Click it to process that video (frames every 6 seconds, at most 4 SAM 3D reconstructions). No bundled fox, flamingo, or park clip.

## How it was built

TypeScript WebXR on the Immersive Web SDK. Hand input, Finder, conversion reveal, book pose, movie timeline and object squash are custom. Scene understanding, optional depth occlusion and SDK grabbing are enabled in `iwsdk.config.json`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run download-models` | Fetches the sofa and duck GLBs if missing |
| `npm run generate-placeholders` | Builds the sofa photo, mask and film poster if missing |
| `npm run optimize-models` | Recenter, scale, simplify, compress GLBs |
| `npm run optimize-video -- <file>` | H.264 MP4 under 50 MB, written into `public/assets/movie/` |
| `npm run validate-timeline` | Checks `timeline.json` |
| `npm run conversion-server` | Standalone Gemini + SAM 3D server |
| `npm test` | Unit tests |
| `npm run build` | Production build |

Animation lab (desktop only, not linked from the landing page): `/lab.html`.
