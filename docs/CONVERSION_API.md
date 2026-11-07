# Conversion API

The Quest page never holds `GEMINI_API_KEY` or `HF_TOKEN`. Local Vite proxies `/v1/*` through `scripts/vite-conversion-plugin.mjs` to `scripts/live-reconstruct.mjs`. GitHub Pages has no keys, so it stays on bundled models.

## Contract (JSON, relative to `CONVERSION_API_URL`)

1. `POST /v1/conversions` — JSON `{ id, x, y, image, marked }`. Returns `202` `{ "jobId" }`.
2. `GET /v1/conversions/{jobId}` — status, progress, `modelUrl`, `label`, `realSize`, `up`.
3. `GET {modelUrl}` — GLB.
4. `POST /v1/films` — JSON `{ "filmUrl": "assets/movie/<id>.mp4" }`. Returns `202` `{ "jobId" }`.
5. `GET /v1/films/{jobId}` — status, progress, and when done `timelineUrl` and `manifestUrl`.

Local timeouts: conversion 400 s, film 1200 s. Failures fall back to the bundled sofa or an empty movie timeline.
