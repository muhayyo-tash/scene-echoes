# Scene Echoes — competition submission draft

**Tagline:** Pictures and films that echo into your room.

**Track:** Entertainment  
**Division:** New Experience

## Audience

Ages 12 and up. Meta requires a parent-managed account for ages 10 to 12, and age limits can differ by country. The experience is gentle and follows Meta's 10+ content guidelines: no fear, no violence, no identifiable people, brands, logos or number plates.

## Description (under 500 words)

Scene Echoes starts with a clean view of your real room. Nothing is added until you ask. The app is a file explorer you open with your hands: slide an open hand to the left and a glass panel appears. Open a photo, pinch-and-hold the object, and a real 3D model lifts off the print so you can place it on the floor or a table. Slide a hand to the right and the explorer disappears.

Or skip the explorer. The book scene puts nothing on the screen. Open a real picture book; when two hands rest on the page and you long-press with a finger, that picture becomes a 3D object you can pick up and move.

Pick an MP4 and the card says Processing while frames are named and reconstructed. Come back when it says Ready. A floating screen plays the film. Objects from the video appear in the room. Touch them and they react. Poke the screen to pause. Pinch to move them; two hands scale objects.

The app is built with the Immersive Web SDK for WebXR on Quest Browser: `immersive-ar` passthrough, hand tracking, plane and mesh detection, anchors, optional depth occlusion, and SDK grabbing. Custom code covers the explorer, long-press conversion reveal, book pose detection, object squash, movie timeline and behaviors. All sounds except the film soundtrack are generated in Web Audio and placed at the object.

**This is a prototype.** The browser does not give apps camera pictures, so the app cannot see the printed page. An open-book hand pose (two palms apart at table height) plus a still fingertip on an elevated surface starts the book conversion. The sofa and duck GLBs are bundled for the hosted demo. Local development can call Gemini and SAM 3D through a same-origin Node plugin so keys never enter the Quest browser bundle. GitHub Pages stays on the bundled models.

## Scene understanding, anchors, hands and passthrough

Detected horizontal planes are used as floors and tables for placing objects, for the real-book hold (tables only, never the floor), and for walking or perching film objects. Mesh detection is requested and skipped silently if it would hurt frame rate. Placed objects and the video screen are world-locked. Hands only: pinch, poke, slide, palm-touch calibration, long press, fingertip hold. Passthrough is required: the same content would not make sense in an empty virtual room.

## Hand interactions (for judges)

Poke or pinch to open cards; long press to convert a photo object; far placement along a surface under a pinch-ray; pressing the sofa; poking the film to pause; touching and moving film objects; palm-touch calibration when planes are missing; slide left to open the file explorer and slide right to close it; open a real book and long-press with a finger on the page to convert that object.
