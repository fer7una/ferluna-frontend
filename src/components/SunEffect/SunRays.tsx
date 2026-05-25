import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, Vector2, type Mesh } from "three";
import { raysFragmentShader } from "./shaders/rays.fragment";
import { raysVertexShader } from "./shaders/rays.vertex";
import type {
  ResolvedSunEffectConfig,
  SunFrameState,
  SunLayoutState,
  SunQualityPreset,
} from "./SunEffect.types";
import type { PointerUniforms } from "./hooks/usePointerUniforms";

type SunRaysProps = {
  config: ResolvedSunEffectConfig;
  frameState: MutableRefObject<SunFrameState>;
  layout: MutableRefObject<SunLayoutState>;
  pointer: PointerUniforms;
  preset: SunQualityPreset;
};

export function SunRays({ config, frameState, layout, pointer, preset }: SunRaysProps) {
  const meshRef = useRef<Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: config.intensity },
      uRayStrength: { value: config.rayStrength },
      uRayLength: { value: config.rayLength },
      uSunRadius: { value: 0.4 },
      uHoverIntensity: { value: 0 },
      uCenterIntensity: { value: 0 },
      uCursorVelocity: { value: 0 },
      uMouse: { value: new Vector2(0, 0) },
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
    uniforms.uCenterIntensity.value = pointerState.centerIntensity;
    uniforms.uCursorVelocity.value = pointerState.cursorVelocity;
    uniforms.uMouse.value.copy(pointerState.mouse);
    uniforms.uShaderComplexity.value = preset.shaderComplexity;

    if (meshRef.current) {
      const rayScale = config.size * layout.current.scale * config.coronaSize * config.rayLength * 3.05;
      meshRef.current.position.copy(layout.current.position);
      meshRef.current.position.z = -0.12;
      meshRef.current.scale.set(rayScale, rayScale, 1);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -0.12]}>
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
