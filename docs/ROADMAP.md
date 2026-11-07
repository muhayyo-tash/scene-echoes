# Roadmap

1. Host a conversion backend so Quest on GitHub Pages can do live reconstruct without keys in the browser.
2. Rigged animation clips (`walk`, `fly`, `idle`) blended with procedural motion.
3. Persistent anchors that survive a headset reboot when the browser supports them.

## Expected challenges

- Latency of several minutes for a live film (Gemini + up to 4 SAM 3D jobs).
- GPU quota on Hugging Face ZeroGPU.
- Uncertain real-world scale; `realSize` still needs a human check.
