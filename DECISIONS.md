# Decisions

Ambiguous spec items and the simplest choice used.

1. **Project folder.** The app is this repository (`scene-echoes`), scaffolded with `npm create @iwsdk@latest` for TypeScript mixed reality, scene understanding, grabbing and physics.

2. **Entry file.** The SDK scaffold uses `src/index.ts`, not `src/main.ts`. Behavior lives in `src/runtime/app.ts`.

3. **Explorer vs Library names.** Config keeps the spec table names `libraryDistance`, `libraryWidth` and `openBookWidth`, and aliases them as `explorerDistance`, `explorerWidth` and `openPhotoWidth`.

4. **Extra constants.** Values the spec uses but did not list (`swipeDistance`, `swipeSeconds`, `bookHoldSeconds`, `surfaceHoldDistance`, timeouts, gravity, flick speed, book palm span) live in `src/config.ts`.

5. **Landing / XR offer.** `offer` is `none` so the 2D Enter button starts AR. Auto-offer would skip the landing page.

6. **SDK grabbing vs custom carry.** IWSDK grabbing is enabled with `useHandPinchForGrab`. Converted objects still use custom surface-constrained pinch carry so they slide on planes, flick away, and two-hand resize. The video screen also uses that custom grab.

7. **Physics.** Havok is enabled in the project. Placed-object drop bounce uses handwritten gravity, restitution and squash-and-stretch on the model scale so the original GLB materials stay visible. Planes are treated as simple supports, not Havok colliders.

8. **Persistent anchors.** Objects get a stable world pose. Cross-session restore uses `localStorage` of poses when available and is skipped silently if not. Native persistent-anchor handles are not required.

9. **Light estimation.** Not a first-class IWSDK feature flag. The app uses a warm hemisphere plus a weak directional light. If a session exposes `requestLightProbe`, it is tried and ignored on failure.

10. **Mesh detection.** Requested as optional. Placement, walking and perching use horizontal planes only, so frame rate stays predictable.

11. **Film length.** Real films should be 60–120 s. The bundled silent film is 30 s (or a looping canvas if ffmpeg cannot encode) so the three moments still play.

12. **Real models.** Runtime loads GLBs from the manifest. Missing or invalid files throw; there is no primitive-mesh fallback. Bundled samples: Khronos GlamVelvetSofa, Duck, Fox, and three.js Flamingo.

13. **JSON loading.** Manifest, explorer and timeline are bundled by Vite `import` so the demo never calls `fetch`. Live conversion is the only `fetch` path, under `src/conversion/live/`.

14. **Draco CDN.** The GLTF loader does not fetch a Draco decoder. Meshopt is bundled. Missing compression fails the load.

15. **Spatial UI kit.** Disabled. The headset has no UIKit panels. The only words in AR are "Processing" and "Ready" on the movie card.

16. **GitHub Pages base.** Vite `base` is `./` so assets work on a project site or a custom domain.

17. **Lab smoke test.** Playwright covers `/lab.html` as `npm run test:lab`. `npm test` is Vitest, including a static check that every lab tab exists. The lab loads the same real GLBs.

18. **Boing sound.** Played on a palm press, not on every fingertip contact, so it does not spam.

19. **No cat scene.** The product is sofa (explorer photo), book (empty passthrough + real book + finger long-press), and movie (explorer video). Converted book objects are grabbable 3D models, not a purring animal.

20. **Book detection.** The browser has no camera. Two palms 0.12–0.55 m apart at table height count as a book opened. Conversion fires only on an elevated horizontal surface, never the floor.

21. **No simulated delay.** Conversion plays a short reveal of the already-loaded GLB. Movie Processing reports progress while the video and movie GLBs preload.
