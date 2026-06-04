import type { RefObject } from "react";
import type { LayoutMode } from "./constants";

export function OrbitCore({
  anchorRef,
  mode,
  orbLabel,
  onOrbActivate,
}: {
  anchorRef: RefObject<HTMLDivElement>;
  mode: LayoutMode;
  orbLabel: string;
  onOrbActivate: () => void;
}) {
  return (
    <div ref={anchorRef} className={`orbit-stage ${mode === "section" ? "is-corner" : ""}`}>
      <div className="orbit-ring orbit-ring-a" aria-hidden="true" />
      <div className="orbit-ring orbit-ring-b" aria-hidden="true" />

      <div className="energy-orb-wrap">
        <button
          className="energy-orb"
          onClick={onOrbActivate}
          type="button"
          aria-label={orbLabel}
        />
      </div>
    </div>
  );
}
