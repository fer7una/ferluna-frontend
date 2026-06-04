import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IconByKey } from "../../icons";
import type { MomentaryTab, SectionId, SiteSection } from "../../types";
import {
  ORBIT_HOVER_PLAYBACK_RATE,
  PORTAL_LABELS,
} from "./constants";
import { setOrbitPlaybackRate, useOrbitPointerHover } from "./orbitHooks";

function TabLabel({ children }: { children: string }) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [marqueeDistance, setMarqueeDistance] = useState(0);

  useEffect(() => {
    const label = labelRef.current;
    const text = textRef.current;
    if (!label || !text) return;

    const updateOverflow = () => {
      const labelWidth = label.getBoundingClientRect().width;
      const textWidth = text.getBoundingClientRect().width;
      const distance = Math.max(0, textWidth - labelWidth);
      setIsOverflowing(distance > 1);
      setMarqueeDistance(distance);
    };

    updateOverflow();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateOverflow);
      return () => window.removeEventListener("resize", updateOverflow);
    }

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(label);
    observer.observe(text);
    return () => observer.disconnect();
  }, [children]);

  return (
    <span
      ref={labelRef}
      className={`tab-label ${isOverflowing ? "is-overflowing" : ""}`}
      style={{ "--tab-label-shift": `${marqueeDistance}px` } as CSSProperties}
      aria-label={children}
    >
      <span ref={textRef} className="tab-label-text">
        {children}
      </span>
    </span>
  );
}

export function SectionTabs({
  activeSection,
  onSelect,
  orbitInteractionEnabled,
  sections,
}: {
  activeSection: SectionId | null;
  onSelect: (section: SectionId) => void;
  orbitInteractionEnabled: boolean;
  sections: SiteSection[];
}) {
  const tabsRef = useRef<HTMLElement>(null);
  useOrbitPointerHover(
    tabsRef,
    ".section-tab",
    ".section-tab-orbit, .section-tab-level",
    orbitInteractionEnabled,
    sections.length,
  );

  return (
    <nav ref={tabsRef} className="section-tabs" aria-label={PORTAL_LABELS.sectionTabsNav}>
      {sections.map((section, index) => {
        const isActive = activeSection === section.id;

        return (
          <div
            className="section-tab-orbit"
            key={section.id}
            style={
              {
                "--orbit-angle": `${section.angle}deg`,
                "--orbit-counter-angle": `${-section.angle}deg`,
                "--tab-index": index,
              } as CSSProperties
            }
          >
            <div className="section-tab-radius">
              <div className="section-tab-level">
                <button
                  className={`section-tab ${isActive ? "is-active" : ""}`}
                  onClick={() => onSelect(section.id)}
                  onBlur={() =>
                    setOrbitPlaybackRate(tabsRef.current, ".section-tab-orbit, .section-tab-level", 1)
                  }
                  onFocus={() =>
                    setOrbitPlaybackRate(
                      tabsRef.current,
                      ".section-tab-orbit, .section-tab-level",
                      ORBIT_HOVER_PLAYBACK_RATE,
                    )
                  }
                  title={section.description}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                >
                  <IconByKey iconKey={section.iconKey} size={20} />
                  <TabLabel>{section.label}</TabLabel>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function MomentaryTabs({
  orbitInteractionEnabled,
  tabs,
  activeMoment,
  onSelect,
}: {
  orbitInteractionEnabled: boolean;
  tabs: MomentaryTab[];
  activeMoment: string | null;
  onSelect: (next: string) => void;
}) {
  const tabsRef = useRef<HTMLElement>(null);
  useOrbitPointerHover(
    tabsRef,
    ".moment-tab",
    ".moment-tab-orbit, .moment-tab-level",
    orbitInteractionEnabled,
    tabs.length,
  );

  return (
    <aside ref={tabsRef} className="momentary-tabs" aria-label={PORTAL_LABELS.momentaryTabsNav}>
      {tabs.map((item, index) => {
        const isActive = activeMoment === item.id;

        return (
          <div
            className="moment-tab-orbit"
            key={item.id}
            style={
              {
                "--orbit-angle": `${item.angle}deg`,
                "--orbit-counter-angle": `${-item.angle}deg`,
                "--moment-tab-index": index,
              } as CSSProperties
            }
          >
            <div className="moment-tab-radius">
              <div className="moment-tab-level">
                <button
                  className={`moment-tab ${isActive ? "is-active" : ""}`}
                  onClick={() => onSelect(item.id)}
                  onBlur={() =>
                    setOrbitPlaybackRate(tabsRef.current, ".moment-tab-orbit, .moment-tab-level", 1)
                  }
                  onFocus={() =>
                    setOrbitPlaybackRate(
                      tabsRef.current,
                      ".moment-tab-orbit, .moment-tab-level",
                      ORBIT_HOVER_PLAYBACK_RATE,
                    )
                  }
                  title={item.label}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                >
                  <IconByKey iconKey={item.iconKey} size={17} />
                  <TabLabel>{item.label}</TabLabel>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
