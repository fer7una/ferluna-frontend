export const sunFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uIntensity;
uniform float uPlasmaScale;
uniform float uPlasmaSpeed;
uniform float uHoverIntensity;
uniform float uCursorVelocity;
uniform float uShaderComplexity;
uniform vec2 uMouse;
uniform vec3 uCoreColor;
uniform vec3 uPlasmaColor;
uniform vec3 uCoronaColor;
uniform vec3 uShadowColor;

varying vec3 vNormalW;
varying vec3 vPositionW;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.52;
  float frequency = 1.0;

  for (int i = 0; i < 6; i++) {
    float enabled = step(float(i), uShaderComplexity + 0.01);
    value += amplitude * noise(p * frequency) * enabled;
    frequency *= 2.05;
    amplitude *= 0.52;
  }

  return value;
}

float angleDistance(float a, float b) {
  float diff = abs(a - b);
  return min(diff, 6.2831853 - diff);
}

void main() {
  vec3 normal = normalize(vNormalW);
  vec3 viewDir = normalize(cameraPosition - vPositionW);
  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.2);

  float time = uTime * uPlasmaSpeed;
  vec3 p = normal * uPlasmaScale;
  vec2 cursorWarp = uMouse * (0.18 * uHoverIntensity + 0.06 * uCursorVelocity);
  p.xy += cursorWarp;

  float cellular = fbm(p * 2.2 + vec3(time * 0.85, -time * 0.45, time * 0.26));
  float slowVeins = fbm(p * 4.8 + vec3(-time * 0.24, time * 0.36, time * 0.18));
  float hotCells = smoothstep(0.46, 0.88, cellular);
  float darkRifts = smoothstep(0.56, 0.86, slowVeins) * (1.0 - hotCells * 0.4);

  vec3 flowAxis = normalize(vec3(0.72, -0.38, 0.58));
  float flowPath = dot(normal, flowAxis) + fbm(normal.yzx * 5.2 + vec3(time * 0.18, -time * 0.11, time * 0.24)) * 0.28;
  float flowChannels = pow(abs(sin((flowPath - time * 0.08) * 21.0)), 8.0);
  float flowCells = smoothstep(0.52, 0.86, fbm(normal * 6.4 + vec3(time * 0.16, -time * 0.21, time * 0.12)));
  float innerFlow = flowChannels * flowCells * (0.55 + darkRifts * 0.45);

  float cycle = floor(uTime / 5.4);
  float phase = fract(uTime / 5.4);
  float burstEnvelope = smoothstep(0.05, 0.24, phase) * (1.0 - smoothstep(0.42, 0.78, phase));
  float burstAngle = hash(vec3(cycle + 11.7, cycle * 0.31, 0.73)) * 6.2831853;
  float edgeAngle = atan(normal.y, normal.x);
  float edgeArc = 1.0 - smoothstep(0.0, 0.36, angleDistance(edgeAngle, burstAngle));
  float edgeBurst = pow(edgeArc, 2.8) * fresnel * burstEnvelope * (0.55 + uHoverIntensity * 0.45);

  vec3 base = mix(uShadowColor, uPlasmaColor, 0.46 + cellular * 0.62);
  base = mix(base, uCoreColor, hotCells * 0.76);
  base = mix(base, uShadowColor, darkRifts * 0.34);
  base = mix(base, mix(uCoronaColor, uShadowColor, 0.56), innerFlow * 0.22);
  base += uCoronaColor * fresnel * (0.9 + hotCells * 0.55);
  base += mix(uCoronaColor, uShadowColor, 0.42) * edgeBurst * 0.46;
  base += uCoreColor * pow(max(dot(viewDir, normal), 0.0), 9.0) * 0.32;

  float cursorHeat = uHoverIntensity * (0.18 + uCursorVelocity * 0.2);
  float outputIntensity = uIntensity * (1.0 + cursorHeat);
  vec3 color = base * outputIntensity;

  gl_FragColor = vec4(color, 1.0);
}
`;
