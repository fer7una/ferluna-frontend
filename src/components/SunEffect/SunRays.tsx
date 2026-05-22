import { useEffect, useMemo, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color } from "three";
import { raysFragmentShader } from "./shaders/rays.fragment";
import { raysVertexShader } from "./shaders/rays.vertex";
import type {
  ResolvedSunEffectConfig,
  SunFrameState,
  SunQualityPreset,
} from "./SunEffect.types";
import type { PointerUniforms } from "./hooks/usePointerUniforms";

type SunRaysProps = {
  config: ResolvedSunEffectConfig;
  frameState: MutableRefObject<SunFrameState>;
  pointer: PointerUniforms;
  preset: SunQualityPreset;
};

export function SunRays({ config, frameState, pointer, preset }: SunRaysProps) {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: config.intensity },
      uRayStrength: { value: config.rayStrength },
      uRayLength: { value: config.rayLength },
      uSunRadius: { value: 0.4 },
      uHoverIntensity: { value: 0 },
      uCursorVelocity: { value: 0 },
      uShaderComplexity: { value: preset.shaderComplexity },
      uCoreColor: { value: new Color(config.colorPalette.core) },
      uCoronaColor: { value: new Color(config.colorPalette.corona) },
    }),
    [],
  );

  useEffect(() => {
    uniforms.uCoreColor.value.set(config.colorPalette.core);
    uniforms.uCoronaColor.value.set(config.colorPalette.corona);
  }, [config.colorPalette, uniforms]);

  useFrame(() => {
    const pointerState = pointer.state.current;
    uniforms.uTime.value = frameState.current.time;
    uniforms.uIntensity.value = config.intensity;
    uniforms.uRayStrength.value = config.rayStrength;
    uniforms.uRayLength.value = config.rayLength;
    uniforms.uSunRadius.value = 2 / (config.coronaSize * config.rayLength * 3.05);
    uniforms.uHoverIntensity.value = pointerState.hoverIntensity;
    uniforms.uCursorVelocity.value = pointerState.cursorVelocity;
    uniforms.uShaderComplexity.value = preset.shaderComplexity;
  });

  const rayScale = config.size * config.coronaSize * config.rayLength * 3.05;

  return (
    <mesh position={[0, 0, -0.12]} scale={[rayScale, rayScale, 1]}>
      <planeGeometry args={[1, 1, preset.planeSegments, preset.planeSegments]} />
      <shaderMaterial
        blending={AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        fragmentShader={raysFragmentShader}
        transparent
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={raysVertexShader}
      />
    </mesh>
  );
}
