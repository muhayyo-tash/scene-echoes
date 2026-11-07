# Testing on a rented Quest

## Open the app

1. On the headset, open **Meta Quest Browser**.
2. Turn on **hand tracking** in Settings (Hands).
3. Visit the GitHub Pages URL from `README.md` / `DEPLOY.md` over HTTPS.
4. Tap the large **Enter** button.
5. You should see only your room. Slide an open hand left to open the file explorer, right to close it.

If AR or hands are missing, the landing page explains what to turn on. Add `?debug=1` to the URL if something silently fails.

Fast checks: `?fast=1` (short reveal), `?movie=ready`, `?object=duck`, `?open=sofa`, `?handsless=1`, `?t=4` (start the film at 4 s), `?reset=1`.

## Checklist

- [ ] Surfaces: floor and a table are found, or palm-touch fallback works at least 8 times out of 10.
- [ ] Library: slide left opens it, slide right closes it, cards are easy to poke or pinch, a photo opens wide.
- [ ] Sofa: long press on the sofa in the photo loads the real sofa GLB; you can hold and place it while seated.
- [ ] Furniture: real-size scale looks right; pressing and dropping feel springy, not glitchy.
- [ ] Book: explorer closed, nothing on screen; opening a real book (two hands on the table) and long-pressing with a finger on the page converts a real 3D object. Floor holds do nothing.
- [ ] Movie processing: selecting the movie starts Processing, the card shows progress while the video and models load, then Ready. Reload keeps Ready.
- [ ] Movie mode: an MP4 in Finder starts Processing then Ready; the film plays; reconstructed objects appear; touching triggers a reaction; poking the screen pauses and resumes.
- [ ] Whole app: nothing but the room, the explorer, the video screen and the objects is visible; frame rate stays smooth; objects do not jitter; no controller was needed.

## Notes to paste back to Cursor

What felt wrong:

Which config values to change (names from `src/config.ts`):

Which model files look bad:
