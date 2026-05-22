export const raysFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uIntensity;
uniform float uRayStrength;
uniform float uRayLength;
uniform float uSunRadius;
uniform float uHoverIntensity;
uniform float uCursorVelocity;
uniform float uShaderComplexity;
uniform vec3 uCoreColor;
uniform vec3 uCoronaColor;

varying vec2 vUv;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float angularNoise(float angle, float scale, float offset) {
  float x = angle * scale + offset;
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f);
}

float angleDistance(float a, float b) {
  float diff = mod(a - b + 3.14159265, 6.2831853) - 3.14159265;
  return abs(diff);
}

float solarFilament(vec2 uv, float radius, float angle, float seed, float time) {
  float pulse = 0.58 + 0.42 * sin(time * (0.9 + hash(seed) * 0.7) + seed * 2.1);
  float start = uSunRadius * (0.97 + hash(seed + 8.0) * 0.08);
  float length = uSunRadius * mix(0.26, 0.68, hash(seed + 1.0)) * uRayLength * pulse;
  float end = start + length;
  float radial = smoothstep(start, start + 0.028, radius) * (1.0 - smoothstep(end * 0.68, end, radius));
  float progress = clamp((radius - start) / max(length, 0.001), 0.0, 1.0);

  float orbit = time * mix(-0.34, 0.34, hash(seed + 10.0));
  float baseAngle = hash(seed + 2.0) * 6.2831853 + orbit;
  float curl = sin(progress * 5.8 + seed * 1.7 + time * 1.35) * (0.18 + hash(seed + 3.0) * 0.18);
  float drift = progress * progress * mix(-1.35, 1.35, hash(seed + 4.0));
  float targetAngle = baseAngle + curl + drift;
  float width = mix(0.028, 0.074, hash(seed + 5.0)) * (1.0 + progress * 1.45);
  float strand = exp(-pow(angleDistance(angle, targetAngle) / width, 2.0));

  float turbulence = angularNoise(angle + progress * 2.0, 22.0 + hash(seed) * 26.0, time * 1.8 + seed);
  float fork = smoothstep(0.62, 0.98, turbulence) * smoothstep(0.18, 0.7, progress);
  float body = strand * radial * (0.32 + fork * 0.34);

  return body * (1.0 - progress * 0.55);
}

float randomDischarge(vec2 uv, float radius, float angle, float seed, float time) {
  float cycle = floor(time * (0.42 + hash(seed + 9.0) * 0.28) + seed);
  float phase = fract(time * (0.42 + hash(seed + 9.0) * 0.28) + seed);
  float burst = smoothstep(0.04, 0.22, phase) * (1.0 - smoothstep(0.48, 0.92, phase));
  float idleSpark = smoothstep(0.86, 0.99, hash(cycle + seed * 11.7));
  float activity = burst * (0.28 + idleSpark * 0.72) * uHoverIntensity;
  float dischargeAngle = hash(cycle * 13.13 + seed * 3.7) * 6.2831853;
  float start = uSunRadius * 0.96;
  float length = uSunRadius * (0.16 + uRayLength * (0.06 + hash(cycle + seed) * 0.1));
  float end = start + length;
  float progress = clamp((radius - start) / max(length, 0.001), 0.0, 1.0);
  float radial = smoothstep(start, start + 0.012, radius) * (1.0 - smoothstep(end * 0.64, end, radius));

  float curl = sin(progress * 5.0 + time * 2.2 + seed) * 0.025;
  float drift = progress * progress * mix(-0.12, 0.12, hash(cycle + seed * 2.0));
  float width = mix(0.014, 0.036, progress);
  float mainArc = exp(-pow(angleDistance(angle, dischargeAngle + curl + drift) / width, 2.0));

  float forkA = exp(-pow(angleDistance(angle, dischargeAngle + curl + 0.05 + progress * 0.08) / (width * 0.55), 2.0));
  float forkB = exp(-pow(angleDistance(angle, dischargeAngle + curl - 0.06 - progress * 0.06) / (width * 0.48), 2.0));
  float forkGate = smoothstep(0.24, 0.82, progress) * (1.0 - smoothstep(0.86, 1.0, progress));

  return radial * (mainArc + (forkA + forkB) * forkGate * 0.16) * activity;
}

float rimFlux(float radius, float angle, float time) {
  float pulse = 0.55 + 0.45 * sin(time * 2.2 + angularNoise(angle, 18.0, time * 0.8) * 6.2831853);
  float rim = exp(-pow((radius - uSunRadius * (1.05 + pulse * 0.08)) * 34.0, 2.0));
  float texture = 0.45 + angularNoise(angle, 34.0, time * 1.7) * 0.55;
  return rim * texture;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float radius = length(uv);
  float angle = atan(uv.y, uv.x);
  float time = uTime * 0.42;

  float edge = exp(-pow((radius - uSunRadius) * 24.0, 2.0));
  float outerFade = 1.0 - smoothstep(uSunRadius * 2.05, uSunRadius * 2.65, radius);
  float filamentMask = 0.0;

  filamentMask += solarFilament(uv, radius, angle, 3.0, time);
  filamentMask += solarFilament(uv, radius, angle, 7.0, time);
  filamentMask += solarFilament(uv, radius, angle, 11.0, time);
  filamentMask += solarFilament(uv, radius, angle, 17.0, time);
  filamentMask += solarFilament(uv, radius, angle, 23.0, time);
  filamentMask += solarFilament(uv, radius, angle, 31.0, time) * step(2.0, uShaderComplexity);
  filamentMask += solarFilament(uv, radius, angle, 43.0, time) * step(3.0, uShaderComplexity);
  filamentMask += solarFilament(uv, radius, angle, 59.0, time) * step(4.0, uShaderComplexity);
  filamentMask *= uHoverIntensity;

  float discharge = randomDischarge(uv, radius, angle, 5.0, time);
  discharge += randomDischarge(uv, radius, angle, 19.0, time) * step(2.0, uShaderComplexity);
  discharge += randomDischarge(uv, radius, angle, 37.0, time) * step(4.0, uShaderComplexity);
  float softCoronaFlow = edge * (0.16 + angularNoise(angle, 20.0, time * 1.4) * 0.2);
  float localFlux = rimFlux(radius, angle, time) * (0.16 + (1.0 - uHoverIntensity) * 0.12);

  float hoverBoost = 1.0 + uHoverIntensity * 0.55 + uCursorVelocity * 0.12;
  float energy = (filamentMask * 0.58 + localFlux + softCoronaFlow + discharge * hoverBoost);
  energy *= outerFade * uRayStrength * uIntensity;
  float alpha = energy * (0.2 + uHoverIntensity * 0.5);

  vec3 ember = mix(uCoronaColor, uCoreColor, 0.34);
  vec3 color = mix(uCoronaColor * 0.62, ember, clamp(edge, 0.0, 1.0));
  color = mix(color, vec3(1.0, 0.12, 0.02), clamp(discharge * 1.6, 0.0, 1.0));
  color += uCoreColor * discharge * 0.18;

  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.44));
}
`;
