import { useEffect, useMemo, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, Color, Vector2 } from "three";
import { coronaFragmentShader } from "./shaders/corona.fragment";
import { coronaVertexShader } from "./shaders/corona.vertex";
import type {
  ResolvedSunEffectConfig,
  SunFrameState,
  SunLayoutState,
  SunQualityPreset,
} from "./SunEffect.types";
import type { PointerUniforms } from "./hooks/usePointerUniforms";

type SunCoronaProps = {
  config: ResolvedSunEffectConfig;
  frameState: MutableRefObject<SunFrameState>;
  layout: MutableRefObject<SunLayoutState>;
  pointer: PointerUniforms;
  preset: SunQualityPreset;
};

const CORONA_PLANE_Z = -0.08;

export function SunCorona({ config, frameState, layout, pointer, preset }: SunCoronaProps) {
  const camera = useThree((state) => state.camera);
  const viewport = useThree((state) => state.viewport);
  const coronaViewport = viewport.getCurrentViewport(camera, [0, 0, CORONA_PLANE_Z]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: config.intensity },
      uCoronaDistortion: { value: config.coronaDistortion },
      uHoverIntensity: { value: 0 },
      uCursorVelocity: { value: 0 },
      uShaderComplexity: { value: preset.shaderComplexity },
      uFieldCenter: { value: new Vector2(0, 0) },
      uMouse: { value: new Vector2(0, 0) },
      uFieldScale: { value: new Vector2(1, 1) },
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
    uniforms.uCoronaDistortion.value = config.coronaDistortion;
    uniforms.uHoverIntensity.value = pointerState.hoverIntensity;
    uniforms.uCursorVelocity.value = pointerState.cursorVelocity;
    uniforms.uShaderComplexity.value = preset.shaderComplexity;
    uniforms.uMouse.value.copy(pointerState.mouse);
    const coronaFieldSize = config.size * layout.current.scale * config.coronaSize * 2.9;
    uniforms.uFieldCenter.value.set(
      (layout.current.position.x * 2) / Math.max(coronaFieldSize, 0.001),
      (layout.current.position.y * 2) / Math.max(coronaFieldSize, 0.001),
    );
    uniforms.uFieldScale.value.set(
      coronaViewport.width / Math.max(coronaFieldSize, 0.001),
      coronaViewport.height / Math.max(coronaFieldSize, 0.001),
    );
  });

  return (
    <mesh position={[0, 0, CORONA_PLANE_Z]} scale={[coronaViewport.width, coronaViewport.height, 1]}>
      <planeGeometry args={[1, 1, preset.planeSegments, preset.planeSegments]} />
      <shaderMaterial
        blending={AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        fragmentShader={coronaFragmentShader}
        transparent
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={coronaVertexShader}
      />
    </mesh>
  );
}
