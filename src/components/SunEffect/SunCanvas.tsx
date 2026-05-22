import { useRef, type MutableRefObject, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { SunCorona } from "./SunCorona";
import { SunMesh } from "./SunMesh";
import type {
  ResolvedSunEffectConfig,
  SunFrameState,
  SunLayoutState,
  SunQualityPreset,
} from "./SunEffect.types";
import type { PointerUniforms } from "./hooks/usePointerUniforms";

type SunCanvasProps = {
  anchorRef?: RefObject<HTMLElement>;
  config: ResolvedSunEffectConfig;
  pointer: PointerUniforms;
  preset: SunQualityPreset;
  reducedMotion: boolean;
};

function SunFrameDriver({
  config,
  pointer,
  frameState,
  reducedMotion,
}: {
  config: ResolvedSunEffectConfig;
  pointer: PointerUniforms;
  frameState: MutableRefObject<SunFrameState>;
  reducedMotion: boolean;
}) {
  useFrame((_state, delta) => {
    pointer.update(delta, config.interactive ? config.cursorInfluence : 0);

    if (!config.paused && !reducedMotion) {
      frameState.current.time += Math.min(delta, 0.05);
    }
  }, -100);

  return null;
}

function SunLayoutDriver({
  anchorRef,
  layout,
}: {
  anchorRef?: RefObject<HTMLElement>;
  layout: MutableRefObject<SunLayoutState>;
}) {
  const viewport = useThree((state) => state.viewport);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);

  useFrame(() => {
    const anchor = anchorRef?.current;
    const canvasRect = gl.domElement.getBoundingClientRect();

    if (!anchor || !canvasRect.width || !canvasRect.height) {
      layout.current.position.set(0, 0, 0);
      layout.current.scale = 1;
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const centerX = anchorRect.left + anchorRect.width / 2 - canvasRect.left;
    const centerY = anchorRect.top + anchorRect.height / 2 - canvasRect.top;
    const cssScale = anchor.offsetWidth > 0 ? anchorRect.width / anchor.offsetWidth : 1;

    layout.current.position.set(
      (centerX / Math.max(size.width, 1) - 0.5) * viewport.width,
      (0.5 - centerY / Math.max(size.height, 1)) * viewport.height,
      0,
    );
    layout.current.scale = cssScale;
  }, -90);

  return null;
}

function SunScene({ anchorRef, config, pointer, preset, reducedMotion }: SunCanvasProps) {
  const frameState = useRef<SunFrameState>({ time: 0 });
  const layout = useRef<SunLayoutState>({ position: new Vector3(0, 0, 0), scale: 1 });

  return (
    <>
      <SunFrameDriver
        config={config}
        frameState={frameState}
        pointer={pointer}
        reducedMotion={reducedMotion}
      />
      <SunLayoutDriver anchorRef={anchorRef} layout={layout} />
      <SunMesh
        config={config}
        frameState={frameState}
        layout={layout}
        pointer={pointer}
        preset={preset}
      />
      <SunCorona
        config={config}
        frameState={frameState}
        layout={layout}
        pointer={pointer}
        preset={preset}
      />
    </>
  );
}

export function SunCanvas({ anchorRef, config, pointer, preset, reducedMotion }: SunCanvasProps) {
  const motionPaused = config.paused && !config.interactive;

  return (
    <Canvas
      aria-hidden="true"
      camera={{ fov: 35, position: [0, 0, 4] }}
      className="sun-effect__canvas"
      dpr={preset.dpr}
      frameloop={motionPaused ? "demand" : "always"}
      gl={{
        alpha: true,
        antialias: preset.antialias,
        premultipliedAlpha: false,
        powerPreference: preset.dpr > 1.5 ? "high-performance" : "default",
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <SunScene
        anchorRef={anchorRef}
        config={config}
        pointer={pointer}
        preset={preset}
        reducedMotion={reducedMotion}
      />
    </Canvas>
  );
}
