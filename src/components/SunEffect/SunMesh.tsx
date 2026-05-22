import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Vector2, type Mesh } from "three";
import { sunFragmentShader } from "./shaders/sun.fragment";
import { sunVertexShader } from "./shaders/sun.vertex";
import type {
  ResolvedSunEffectConfig,
  SunFrameState,
  SunLayoutState,
  SunQualityPreset,
} from "./SunEffect.types";
import type { PointerUniforms } from "./hooks/usePointerUniforms";

type SunMeshProps = {
  config: ResolvedSunEffectConfig;
  frameState: MutableRefObject<SunFrameState>;
  layout: MutableRefObject<SunLayoutState>;
  pointer: PointerUniforms;
  preset: SunQualityPreset;
};

export function SunMesh({ config, frameState, layout, pointer, preset }: SunMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: config.intensity },
      uPlasmaScale: { value: config.plasmaScale },
      uPlasmaSpeed: { value: config.plasmaSpeed },
      uHoverIntensity: { value: 0 },
      uCursorVelocity: { value: 0 },
      uShaderComplexity: { value: preset.shaderComplexity },
      uMouse: { value: new Vector2(0, 0) },
      uCoreColor: { value: new Color(config.colorPalette.core) },
      uPlasmaColor: { value: new Color(config.colorPalette.plasma) },
      uCoronaColor: { value: new Color(config.colorPalette.corona) },
      uShadowColor: { value: new Color(config.colorPalette.shadow) },
    }),
    [],
  );

  useEffect(() => {
    uniforms.uCoreColor.value.set(config.colorPalette.core);
    uniforms.uPlasmaColor.value.set(config.colorPalette.plasma);
    uniforms.uCoronaColor.value.set(config.colorPalette.corona);
    uniforms.uShadowColor.value.set(config.colorPalette.shadow);
  }, [config.colorPalette, uniforms]);

  useFrame(() => {
    const pointerState = pointer.state.current;
    uniforms.uTime.value = frameState.current.time;
    uniforms.uIntensity.value = config.intensity;
    uniforms.uPlasmaScale.value = config.plasmaScale;
    uniforms.uPlasmaSpeed.value = config.paused ? 0 : config.plasmaSpeed;
    uniforms.uHoverIntensity.value = pointerState.hoverIntensity;
    uniforms.uCursorVelocity.value = pointerState.cursorVelocity;
    uniforms.uShaderComplexity.value = preset.shaderComplexity;
    uniforms.uMouse.value.copy(pointerState.mouse);

    if (meshRef.current) {
      meshRef.current.position.copy(layout.current.position);
      meshRef.current.scale.setScalar(config.size * layout.current.scale);
    }
  });

  return (
    <mesh ref={meshRef} scale={config.size}>
      <sphereGeometry args={[1, preset.sphereSegments, preset.sphereSegments / 2]} />
      <shaderMaterial
        fragmentShader={sunFragmentShader}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={sunVertexShader}
      />
    </mesh>
  );
}
