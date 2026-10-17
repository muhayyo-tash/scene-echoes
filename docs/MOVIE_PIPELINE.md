# Movie pipeline (plain language)

You film a short park clip. The app does not invent objects from the film during the demo. You pick moments, cut objects out, make 3D models outside the app, and list them in `timeline.json`.

## Film

- Your own footage, 60–120 seconds, 16:9, daylight, steady.
- No people, brand names, logos or number plates.
- Clear single objects: a bird, a tree, a flower, a bench, a dog.
- Ambient sound only. No music unless you made it or it is public domain.
- Run `npm run optimize-video -- yourclip.mp4` so the file is H.264, AAC, faststart, under 50 MB.

## Pick moments

1. `npm run extract-frames -- public/assets/movie/park.mp4`
2. Look in `tmp/frames/` and `tmp/frames/best.json`. This ranking is sharpness only, not AI.
3. Keep at most 8 moments, at least 6 seconds apart, at most 2 objects and 1 weather effect at once.

## Make 3D objects

Cut each object from its frame (any 2D editor). Convert the cutout to a GLB with a single-image 3D tool you own a license for. Name it `public/assets/models/<id>.glb`. Add an entry in `public/assets/manifest.json` with `scene: "movie"`, `label`, `realSize`, optional `behavior`, `reaction`, `landing`, `floatScale`.

## Fill timeline.json

Each moment needs `id`, `time` (seconds), `objectId`, `rect` (0–1 box in the frame), optional `side` (`left`, `right`, `low-left`, `low-right`) and `lifetime`.

Then `npm run validate-timeline`.
