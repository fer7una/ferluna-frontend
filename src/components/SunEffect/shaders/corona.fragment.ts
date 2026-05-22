export const coronaFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uIntensity;
uniform float uCoronaDistortion;
uniform float uHoverIntensity;
uniform float uCursorVelocity;
uniform float uShaderComplexity;
uniform vec2 uMouse;
uniform vec2 uFieldCenter;
uniform vec2 uFieldScale;
uniform vec3 uCoreColor;
uniform vec3 uCoronaColor;

varying vec2 vUv;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.55;
  float frequency = 1.0;

  for (int i = 0; i < 6; i++) {
    float enabled = step(float(i), uShaderComplexity + 0.01);
    value += amplitude * noise(p * frequency) * enabled;
    frequency *= 2.0;
    amplitude *= 0.5;
  }

  return value;
}

void main() {
  vec2 uv = (vUv * 2.0 - 1.0) * uFieldScale - uFieldCenter;
  float radius = length(uv);
  vec2 dir = normalize(uv + 0.0001);
  float time = uTime * 0.22;

  float pointerField = 1.0 + dot(dir, normalize(uMouse + 0.0001)) * 0.5 * uHoverIntensity;
  float coronaReveal = smoothstep(0.0, 1.0, uHoverIntensity);
  float coronaFlow = smoothstep(0.05, 0.95, uHoverIntensity);
  vec2 noiseUv = dir * (3.0 + uCoronaDistortion * 3.0);
  noiseUv += vec2(time * 0.7, -time * 0.45);
  noiseUv += uMouse * (0.18 * uHoverIntensity);

  float ragged = fbm(noiseUv) * uCoronaDistortion;
  float coronaEdge = 0.52 + ragged * 0.2 + coronaReveal * 0.045;
  float outerEdge = 0.62 + ragged * 0.12 + coronaReveal * 0.44 + uCursorVelocity * 0.08;

  float inner = smoothstep(0.38, coronaEdge, radius);
  float outer = 1.0 - smoothstep(0.7, outerEdge, radius);
  float tendrils = smoothstep(0.36, 0.9, fbm(noiseUv * 2.3 + dir * 0.45));
  float rayNoiseA = fbm(dir * 5.4 + vec2(time * 0.9, radius * 2.4 - time * 0.75));
  float rayNoiseB = fbm(vec2(dir.y, -dir.x) * 8.0 + vec2(-time * 0.55, radius * 3.1 + time * 0.45));
  float rayMask = pow(smoothstep(0.36, 0.88, mix(rayNoiseA, rayNoiseB, 0.45)), 2.15);
  float rayReach = mix(0.54, 1.32, coronaFlow);
  float rayStart = smoothstep(0.38, 0.56, radius);
  float rayEnd = 1.0 - smoothstep(rayReach - 0.28, rayReach, radius);
  float flowPulse = 0.82 + 0.18 * sin(time * 5.0 + dot(dir, vec2(3.1, -2.4)) + rayNoiseA * 4.0);
  float rays = rayMask * rayStart * rayEnd * coronaFlow * flowPulse;
  float alpha = (inner * outer * (0.18 + tendrils * 0.46) + rays * 1.35) * pointerField * coronaReveal;

  vec3 color = mix(uCoreColor, uCoronaColor, 0.58 + tendrils * 0.42);
  color *= uIntensity * (0.78 + coronaFlow * 0.62);

  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}
`;
