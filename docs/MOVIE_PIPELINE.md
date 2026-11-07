# Movie pipeline

Any MP4 in `public/assets/movie/` appears in Finder Movies. That card is the movie scene.

On local Vite (or `?live=1`), clicking the card sends the file to the conversion plugin:

1. ffmpeg takes stills every **6 seconds** (not every 6 frames).
2. Gemini names the main object in each still.
3. Repeated labels are skipped. Rain stays an effect with no GLB.
4. SAM 3D reconstructs at most **4** objects.
5. The app replaces the empty bundled timeline with that live timeline and the downloaded GLBs.

If the live path fails, the film can still play with no extra objects.

```bash
npm run optimize-video -- yourclip.mp4
```

writes `public/assets/movie/yourclip.mp4`. Restart or refresh Vite so Finder lists it.
