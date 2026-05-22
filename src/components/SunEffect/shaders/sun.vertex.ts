export const sunVertexShader = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPositionW;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vPositionW = worldPosition.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;
