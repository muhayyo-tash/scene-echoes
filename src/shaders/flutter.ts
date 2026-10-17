export const flutterVertex = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
varying vec3 vNormal;
void main() {
  vec3 pos = position;
  float wing = abs(pos.x);
  pos.y += sin(uTime * 22.0 + pos.x * 30.0) * 0.012 * wing;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const swayVertex = /* glsl */ `
uniform float uTime;
varying vec3 vNormal;
void main() {
  vec3 pos = position;
  float h = max(pos.y, 0.0);
  pos.x += sin(uTime * 1.2) * 0.04 * h;
  pos.z += cos(uTime * 0.9) * 0.02 * h;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const simpleLitFragment = /* glsl */ `
uniform vec3 uColor;
varying vec3 vNormal;
void main() {
  float light = clamp(dot(normalize(vNormal), normalize(vec3(0.2, 1.0, 0.25))), 0.25, 1.0);
  gl_FragColor = vec4(uColor * light, 1.0);
}
`;
