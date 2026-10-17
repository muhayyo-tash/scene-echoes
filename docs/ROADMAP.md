# Roadmap

1. Connect the real conversion backend and point `CONVERSION_API_URL` at it.
2. AI film analysis: frame ranking, object picking, labels, behaviors.
3. Rigged animation clips (`walk`, `fly`, `idle`) blended with procedural motion.
4. Persistent anchors that survive a headset reboot when the browser supports them.

## Expected challenges

- Latency of several seconds for a live conversion.
- GPU cost of SAM 3D and film analysis.
- Model license terms for any generator you use.
- Privacy of the user's pictures and film; keep them on your backend, not in the headset app.
- Uncertain real-world scale; `realSize` will still need a human check.
