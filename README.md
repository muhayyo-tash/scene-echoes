# Scene Echoes

<p align="center">
  <img src=".github/logo.png" alt="Meta Echoes" width="160" />
</p>

Mixed-reality entertainment for Meta Quest (WebXR / IWSDK). Photos and films appear in your room as 3D objects you move with your hands.

**Live demo:** https://muhayyo-tash.github.io/scene-echoes/  
Deploy notes: `DEPLOY.md`

## Gestures

| Gesture | Action |
| --- | --- |
| **Pinch** | Open Meta Echoes, pick Pictures / Movies, pinch and hold a photo to load its 3D model, grab film props |
| **Fist** | Empty-space load (local API keys only; inactive on GitHub Pages) |

## Run locally

Needs Node.js 20.19+.

### 1. Demo (no keys)

```bash
npm install
npm run dev
```

1. Open the printed HTTPS URL in **Meta Quest Browser**
2. Tap **Enter**
3. Pinch Meta Echoes → sofa photo, or open Movies

### 2. Live conversion (API keys)

Keys stay in a local `.env` file. They never go to Quest Browser or GitHub Pages.

1. Copy the example env file:

```bash
cp .env.example .env
```

2. Put your keys in `.env`:

```bash
GEMINI_API_KEY=your_gemini_key
HF_TOKEN=your_huggingface_token
```

3. Start the app:

```bash
npm install
npm run dev
```

4. On Quest (same Wi‑Fi), open the printed HTTPS URL and enter XR

- Photo pinch and hold → Gemini + Hugging Face → 3D object (bundled photo model if API fails)
- Empty-space fist → same pipeline (cancels on failure; no offline stand-in)

Optional: `npm run conversion-server` · contract in `docs/CONVERSION_API.md`

## Assets

| Path | Role |
| --- | --- |
| `public/assets/photos/` | Pictures |
| `public/assets/models/` | GLBs |
| `public/assets/movie/` | MP4s, `films.json`, `timeline.json` |
| `public/assets/manifest.json` | All loadable objects |
| `public/assets/explorer.json` | Pictures shown in Meta Echoes |

Competition default: sofa photo + preprocessed films.

### Add a photo

1. Add `photos/<id>.jpg` and `models/<id>.glb`
2. Register in `manifest.json` and `explorer.json`
3. Restart `npm run dev`

### Bake a film (needs keys + ffmpeg)

```bash
npm run prepare-film -- park.mp4
```

Samples every 5s (after 1s), writes film-scoped GLBs + `timeline.json` + `films.json`. Optional: `--every 4`, `--max 6`, `--skip-hf`.
