# WebXR limitations we hit in Scene Echoes

Project-specific traps from building and shipping this Quest Browser AR demo.
Not a general WebXR catalog — only what broke or constrained *this* app.

## Headset camera vs `world.camera`

Parenting the Finder dock to `world.camera` made the icon **vanish in immersive AR**.

IWSDK / Three.js WebXR draws through the XR stereo cameras, not the plain
`world.camera` object. Children of `world.camera` never show up in the headset
view even though they look fine in a flat desktop preview.

**What we do instead:** keep the dock in the scene graph and each frame place it
at a fixed offset in the head’s **world** pose (`getWorldPosition` +
`getWorldQuaternion`), then `lookAt` the eyes. That is view-locked without
parenting to the wrong camera.

## Local vs world head pose

`world.camera.position` / `.quaternion` are **local to `world.player`**. Using
them as if they were world head pose made HUD and panel placement wrong or
slide when the player root moved.

**What we do instead:** always sample head with `getWorldPosition` /
`getWorldQuaternion` in `src/index.ts` before feeding `FrameInput`.

## “Head-locked” with yaw-only forward

An early dock used only horizontal `forward` from the headset quaternion, and
that helper clamped `z` with `Math.abs`. Turning right made the icon **slide
across the view** instead of staying top-right.

True view-lock needs the full world quaternion (pitch included) applied to a
local offset `(right, up, −forward)`, not yaw-only placement with a broken
forward vector.

## Plane facing / back-face culling on HUD and photos

A `PlaneGeometry` facing the wrong way is silently invisible (single-sided
materials). We lost the Finder icon after a `rotateY(Math.PI)` on a
view-locked mesh. `lookAt(head)` matched the orientation that had worked for
the dock before; `DoubleSide` is a safety net for the icon.

Same class of bug bit the open photo earlier (white matte / wrong facing).

## No hand haptics in WebXR

Quest’s system keyboard feels like real keys because of **visual key travel +
click audio** (and, on controllers, system haptics). WebXR hand tracking does
**not** expose finger contact haptics to the page.

**What we do instead:** on photo long-press — contact highlight, slight press-in
of the print, `click` / `tick` / `clickUp` sounds from `AudioEngine`. Controllers
could use Meta system haptics in a native app; this browser demo cannot.

## Poke reach vs “photo farther away”

Putting the open photo ~1.05 m ahead looked nicer but put it **out of index-finger
reach**. Long-press never completed because contact (`worldToPhotoUv`) never
stayed valid — users only saw the guidance label.

**What we do instead:** place the print around **0.62 m** so a poke can register,
widen depth tolerance, stick the hold timer to one hand, and assist with the
hand target-ray when the tip is near but depth jitters.

## Palm pinch is reserved by the system

On Quest WebXR, **palm pinch** (watch palm, pinch until the menu / Meta icon
fills) is reserved for system UI / leaving the session. We must not teach or
depend on that gesture. App pinches are the normal thumb–index pinch on the
emulated gamepad / joint poses.

## GitHub Pages cannot run the live AI pipeline

The public Pages build must stay **keyless**. Gemini → Hugging Face 2D→3D needs
a machine with secrets (local `/v1/*` proxy). On Pages, conversion falls back to
the **bundled sofa GLB** via the manifest model source. Live mode is
laptop-only (`CONVERSION_API_URL` + `?live=1`), not the competition URL.

## Depth sensing can eat nearby UI

With optional depth occlusion enabled, near-field HUD meshes can disappear into
passthrough depth if they write/test depth like scene geometry.

**What we do instead:** Finder dock materials use `depthTest: false`,
`depthWrite: false`, and a high `renderOrder` so the icon stays drawn on top.

## AudioContext needs a user gesture

SFX (including the keyboard-style clicks) stay silent until `AudioEngine.start()`
runs after the landing **Enter** tap. Entering XR without that gesture leaves
poke feedback visual-only.

## Desktop preview ≠ headset proof

Orbit-camera desktop mode can show a camera-parented or locally posed HUD that
**fails or differs in immersive AR**. Finder placement, poke long-press, and
hand joints must be judged on Quest (or IWER with a real XR session), not from
a flat screenshot alone.

## We do not preload the user’s selection

Warming the sofa GLB at boot hid a hitch but assumed the next convert target.
That is not product-like: the app cannot know what the user will touch. Models
load **on demand** when the poke long-press commits. The conversion FX runs
while the GLB fetches; the old “preload everything object3d” path was removed.

Quest hand tracking also drops index-tip frames during a press. Without a short
contact grace period, the hold timer reset forever and nothing ever popped.

## Blue rectangles were our conversion FX, not passthrough

While a GLB loaded, the old conversion animation entered its “build” phase and
drew cyan `EdgesGeometry` stubs, scan bars, particles, and scene-capture
**column** planes. `finish()` did not always remove those columns, so blue
rectangles lingered in the room. Conversion wait UX is now a soft white ring
only; no cyan wireframes.

## Photo pop uses Meta-style point + pinch

Quest system menus feel reliable because they use **hand target-ray aim, then
pinch** — not free-floating long-press or custom OK poses. Scene Echoes matches
that: with the photo open, the hand ray (or near tip) must hit the print, then
`justPinched` commits the pop. Casual hand motion alone does not start a load.
