export const revealVertex = /* glsl */ `
varying vec3 vPos;
varying vec3 vNormal;
void main() {
  vPos = position;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const revealFragment = /* glsl */ `
uniform float uReveal;
uniform float uScan;
uniform vec3 uColor;
varying vec3 vPos;
varying vec3 vNormal;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

void main() {
  float h = (vPos.y + 0.5);
  float noise = hash(floor(vPos * 18.0));
  float reveal = step(h + noise * 0.15, uReveal * 1.2);
  float scan = 1.0 - smoothstep(0.0, 0.08, abs(h - uScan));
  float light = clamp(dot(normalize(vNormal), normalize(vec3(0.2, 1.0, 0.3))), 0.2, 1.0);
  vec3 color = uColor * light + vec3(0.4, 0.85, 1.0) * scan * 0.6;
  gl_FragColor = vec4(color, reveal);
  if (gl_FragColor.a < 0.05) discard;
}
`;
