export const jellyVertex = /* glsl */ `
uniform vec4 uContacts[6];
uniform float uRadius;
uniform float uDepth;
uniform float uTime;
uniform float uSquashY;
uniform float uSquashXZ;
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
  vec3 pos = position;
  pos.y *= uSquashY;
  pos.xz *= uSquashXZ;
  vec4 world = modelMatrix * vec4(pos, 1.0);
  for (int i = 0; i < 6; i++) {
    float strength = uContacts[i].w;
    if (strength > 0.001) {
      vec3 delta = world.xyz - uContacts[i].xyz;
      float d = length(delta);
      float t = clamp(1.0 - d / max(uRadius, 0.0001), 0.0, 1.0);
      float fall = t * t * (3.0 - 2.0 * t);
      world.xyz -= normalize(delta + vec3(0.0, 0.001, 0.0)) * uDepth * strength * fall;
    }
  }
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(world.xyz, 1.0);
}
`;

export const jellyFragment = /* glsl */ `
uniform vec3 uColor;
varying vec3 vNormal;
void main() {
  float light = clamp(dot(normalize(vNormal), normalize(vec3(0.2, 1.0, 0.3))), 0.25, 1.0);
  gl_FragColor = vec4(uColor * light, 1.0);
}
`;
