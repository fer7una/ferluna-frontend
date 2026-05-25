import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { Vector2 } from "three";

type PointerUniformInternalState = {
  mouse: Vector2;
  targetMouse: Vector2;
  lastTargetMouse: Vector2;
  hoverIntensity: number;
  targetHoverIntensity: number;
  centerIntensity: number;
  targetCenterIntensity: number;
  cursorVelocity: number;
  targetCursorVelocity: number;
};

export type PointerUniforms = {
  targetRef: RefObject<HTMLDivElement>;
  state: MutableRefObject<PointerUniformInternalState>;
  handlers: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  update: (delta: number, cursorInfluence: number) => void;
};

function damp(current: number, target: number, lambda: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function smoothStep(value: number) {
  return value * value * (3 - 2 * value);
}

type PointerBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const POINTER_RESPONSE_LAMBDA = 2.35;
const HOVER_RESPONSE_LAMBDA = 0.6;
const VELOCITY_RESPONSE_LAMBDA = 2.2;
const VELOCITY_DECAY_LAMBDA = 1.55;
const CURSOR_VELOCITY_SCALE = 4.2;

export function usePointerUniforms(
  interactive: boolean,
  hoverTargetRadius?: number,
  hoverTargetRef?: RefObject<HTMLElement>,
): PointerUniforms {
  const targetRef = useRef<HTMLDivElement>(null);
  const state = useRef<PointerUniformInternalState>({
    mouse: new Vector2(0, 0),
    targetMouse: new Vector2(0, 0),
    lastTargetMouse: new Vector2(0, 0),
    hoverIntensity: 0,
    targetHoverIntensity: 0,
    centerIntensity: 0,
    targetCenterIntensity: 0,
    cursorVelocity: 0,
    targetCursorVelocity: 0,
  });

  const updatePointerTarget = useCallback(
    (clientX: number, clientY: number, bounds: PointerBounds) => {
      const x = clamp(((clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1, -1, 1);
      const y = clamp(-(((clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 - 1), -1, 1);
      const pointer = state.current;

      pointer.targetMouse.set(x, y);
      if (hoverTargetRadius === undefined) {
        pointer.targetHoverIntensity = 1;
        pointer.targetCenterIntensity = 1;
      } else {
        const targetRect = hoverTargetRef?.current?.getBoundingClientRect();
        const centerX = targetRect ? targetRect.left + targetRect.width / 2 : bounds.left + bounds.width / 2;
        const centerY = targetRect ? targetRect.top + targetRect.height / 2 : bounds.top + bounds.height / 2;
        const distance = Math.hypot(clientX - centerX, clientY - centerY);
        const targetSize = targetRect ? Math.min(targetRect.width, targetRect.height) : Math.min(bounds.width, bounds.height);
        const radius = Math.max(targetSize * hoverTargetRadius, 1);
        const centerRadius = targetSize * 0.2;
        const centerFeather = Math.max(targetSize * 0.22, 1);

        const hoverProgress = clamp(1 - distance / radius, 0, 1);
        pointer.targetHoverIntensity = Math.pow(hoverProgress, 1.2);

        const centerProgress = clamp(1 - (distance - centerRadius) / centerFeather, 0, 1);
        pointer.targetCenterIntensity = smoothStep(centerProgress);
      }

      const velocity = pointer.targetMouse.distanceTo(pointer.lastTargetMouse);
      pointer.targetCursorVelocity = Math.min(1, velocity * CURSOR_VELOCITY_SCALE);
      pointer.lastTargetMouse.copy(pointer.targetMouse);
    },
    [hoverTargetRadius, hoverTargetRef],
  );

  const onPointerEnter = useCallback(() => {
    if (!interactive) {
      return;
    }
    const fallback = hoverTargetRadius === undefined ? 1 : 0;
    state.current.targetHoverIntensity = fallback;
    state.current.targetCenterIntensity = fallback;
  }, [hoverTargetRadius, interactive]);

  const onPointerLeave = useCallback(() => {
    const pointer = state.current;
    pointer.targetHoverIntensity = 0;
    pointer.targetCenterIntensity = 0;
    pointer.targetCursorVelocity = 0;
  }, []);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!interactive) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      updatePointerTarget(event.clientX, event.clientY, rect);
    },
    [interactive, updatePointerTarget],
  );

  useEffect(() => {
    if (!interactive || hoverTargetRadius === undefined) {
      return;
    }

    const onWindowPointerMove = (event: PointerEvent) => {
      const rect = targetRef.current?.getBoundingClientRect();
      const bounds = rect
        ? {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }
        : {
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          };

      updatePointerTarget(event.clientX, event.clientY, {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      });
    };

    const clearPointerTarget = () => {
      const pointer = state.current;
      pointer.targetHoverIntensity = 0;
      pointer.targetCenterIntensity = 0;
      pointer.targetCursorVelocity = 0;
    };

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerleave", clearPointerTarget);
    window.addEventListener("blur", clearPointerTarget);

    return () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerleave", clearPointerTarget);
      window.removeEventListener("blur", clearPointerTarget);
    };
  }, [hoverTargetRadius, interactive, updatePointerTarget]);

  const update = useCallback((delta: number, cursorInfluence: number) => {
    const pointer = state.current;
    const dt = Math.min(delta, 0.05);
    const influence = Math.max(0, cursorInfluence);

    pointer.mouse.lerp(pointer.targetMouse, 1 - Math.exp(-POINTER_RESPONSE_LAMBDA * dt));
    pointer.hoverIntensity = damp(
      pointer.hoverIntensity,
      pointer.targetHoverIntensity * influence,
      HOVER_RESPONSE_LAMBDA,
      dt,
    );
    pointer.centerIntensity = damp(
      pointer.centerIntensity,
      pointer.targetCenterIntensity * influence,
      HOVER_RESPONSE_LAMBDA,
      dt,
    );
    pointer.cursorVelocity = damp(
      pointer.cursorVelocity,
      pointer.targetCursorVelocity,
      VELOCITY_RESPONSE_LAMBDA,
      dt,
    );
    pointer.targetCursorVelocity *= Math.exp(-VELOCITY_DECAY_LAMBDA * dt);
  }, []);

  return useMemo(
    () => ({
      targetRef,
      state,
      handlers: {
        onPointerEnter,
        onPointerLeave,
        onPointerMove,
      },
      update,
    }),
    [onPointerEnter, onPointerLeave, onPointerMove, update],
  );
}
