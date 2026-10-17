# Conversion API

The headset app never talks to SAM 3D or any model vendor. It talks only to **your backend**, which holds keys and issues a short-lived token sent as `Authorization: Bearer …`.

`CONVERSION_MODE` in `src/config.ts` is `manifest` for the demo: models load from bundled GLBs. `CONVERSION_API_URL` defaults to `https://example.invalid`, which never resolves. `?live=1` enables live mode only when that URL is not the placeholder.

## Contract (JSON, relative to `CONVERSION_API_URL`)

1. `POST /v1/conversions` — multipart form: `image`, normalized `x` and `y`, optional `mask` PNG. Returns `202` `{ "jobId": "..." }`.
2. `GET /v1/conversions/{jobId}` — `{ "status": "queued"|"processing"|"done"|"failed", "progress": 0..1, "modelUrl", "realSize", "up", "error" }`. Poll once per second.
3. `GET {modelUrl}` — optimized GLB (≤ 30000 triangles, textures ≤ 1024 px).
4. `POST /v1/films` — JSON `{ "filmUrl": "..." }` or multipart upload. Returns `202` `{ "jobId" }`.
5. `GET /v1/films/{jobId}` — status, progress, and when done `timelineUrl` and `manifestUrl`.

Timeouts: conversion 120 s, film 600 s. Invalid GLBs and failures fall back to the bundled manifest model.

## What the backend must do

**Photo:** turn the pressed point into a mask with a segmentation model, reconstruct 3D with SAM 3D in the cloud, estimate real size, optimize the mesh, host the GLB.

**Film:** sample frames, rank them with an AI model, pick one or two objects per scene, recognize each (`label`), convert them, choose behaviors, build `timeline.json`.

This repository contains no model code. `npm run mock-conversion-server` implements the HTTP contract with the bundled GLBs.

## Honesty

The demo conversion is a reveal of a pre-bundled GLB. Movie Processing is a real preload of the film and those GLBs. Nothing may claim that the demo ran a live reconstruction.
