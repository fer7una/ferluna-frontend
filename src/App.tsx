import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Github,
  Globe2,
  Linkedin,
  Mail,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fallbackSiteData, fetchSiteData } from "./api";
import { AdminLoginPage, AdminPage, getStoredAdminSession } from "./components/admin";
import { SunEffect } from "./components/SunEffect";
import { IconByKey } from "./icons";
import { useMoonPhaseFavicon, type MoonPhaseFavicon } from "./useMoonPhaseFavicon";
import type {
  ContentItem,
  MomentaryTab,
  ProfileLink,
  SectionId,
  SiteData,
  SiteSection,
} from "./types";

type LayoutMode = "hub" | "section";
type OrbPhase =
  | "hub"
  | "gliding-to-section"
  | "rail"
  | "preparing-hub-glide"
  | "gliding-to-hub";
type CarouselAction = {
  label: string;
  href: string;
};

type CarouselCard = {
  id: string;
  kicker: string;
  title: string;
  meta?: string;
  description: string;
  tags?: string[];
  action?: CarouselAction;
  icon: ReactNode;
};

// Closing the section view keeps the panel/title mounted for this long so the
// exit transition can finish before the content unmounts.
const SECTION_EXIT_MS = 460;
const ORBIT_GLIDE_MS = 860;
const ORBIT_HOVER_PLAYBACK_RATE = 0.5;

function pathSegment(pathname: string): string {
  return pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
}

function sectionFromPathname(pathname: string, sections: SiteSection[]): SectionId | null {
  const segment = pathSegment(pathname);
  const section = sections.find((item) => item.route === segment);
  return section?.id ?? null;
}

function momentFromPathname(pathname: string, tabs: MomentaryTab[]): string | null {
  const segment = pathSegment(pathname);
  const moment = tabs.find((item) => item.id === segment);
  return moment?.id ?? null;
}

function isVisibleNow(item: { enabled?: boolean; visibleFrom?: string | null; visibleUntil?: string | null }) {
  if (item.enabled === false) {
    return false;
  }

  const now = Date.now();
  const visibleFrom = item.visibleFrom ? Date.parse(item.visibleFrom) : null;
  const visibleUntil = item.visibleUntil ? Date.parse(item.visibleUntil) : null;

  if (visibleFrom !== null && Number.isFinite(visibleFrom) && now < visibleFrom) {
    return false;
  }

  if (visibleUntil !== null && Number.isFinite(visibleUntil) && now >= visibleUntil) {
    return false;
  }

  return true;
}

function sortByOrder<T extends { order: number; id: string }>(items: T[]) {
  return [...items].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

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

function setOrbitPlaybackRate(
  container: HTMLElement | null,
  animationSelector: string,
  playbackRate: number,
) {
  if (!animationSelector) {
    return;
  }

  container?.querySelectorAll<HTMLElement>(animationSelector).forEach((element) => {
    element.getAnimations().forEach((animation) => {
      animation.updatePlaybackRate(playbackRate);
    });
  });
}

function useOrbitPointerHover(
  containerRef: RefObject<HTMLElement>,
  hitSelector: string,
  animationSelector: string,
  enabled: boolean,
  // Changes whenever the set of hoverable targets changes (e.g. tabs render
  // after the site data loads), so the effect re-queries them.
  targetsKey: number = 0,
) {
  const activeElementRef = useRef<HTMLElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, hasPointer: false });

  useEffect(() => {
    const clearActive = () => {
      if (activeElementRef.current) {
        activeElementRef.current.classList.remove("is-pointer-hover");
        activeElementRef.current = null;
        setOrbitPlaybackRate(containerRef.current, animationSelector, 1);
      }
    };

    if (!enabled) {
      clearActive();
      return;
    }

    const container = containerRef.current;
    const targets = container
      ? Array.from(container.querySelectorAll<HTMLElement>(hitSelector))
      : [];

    const setActiveElement = (nextElement: HTMLElement | null) => {
      if (activeElementRef.current === nextElement) {
        return;
      }
      activeElementRef.current?.classList.remove("is-pointer-hover");
      nextElement?.classList.add("is-pointer-hover");
      activeElementRef.current = nextElement;
      setOrbitPlaybackRate(
        containerRef.current,
        animationSelector,
        nextElement ? ORBIT_HOVER_PLAYBACK_RATE : 1,
      );
    };

    let frame = 0;

    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY, hasPointer: true };
    };

    const clearHover = () => {
      pointerRef.current.hasPointer = false;
      setActiveElement(null);
    };

    const tick = () => {
      const pointer = pointerRef.current;
      let found: HTMLElement | null = null;

      if (pointer.hasPointer) {
        for (const element of targets) {
          const rect = element.getBoundingClientRect();
          if (
            pointer.x >= rect.left &&
            pointer.x <= rect.right &&
            pointer.y >= rect.top &&
            pointer.y <= rect.bottom
          ) {
            found = element;
            break;
          }
        }
      }

      setActiveElement(found);
      frame = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", clearHover);
    window.addEventListener("blur", clearHover);
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", clearHover);
      window.removeEventListener("blur", clearHover);
      clearActive();
    };
  }, [enabled, animationSelector, containerRef, hitSelector, targetsKey]);
}

function useOrbPhase(routeMode: LayoutMode) {
  const [orbPhase, setOrbPhase] = useState<OrbPhase>(() =>
    routeMode === "section" ? "gliding-to-section" : "hub",
  );
  const previousRouteModeRef = useRef<LayoutMode>(routeMode);

  useLayoutEffect(() => {
    const previousRouteMode = previousRouteModeRef.current;
    previousRouteModeRef.current = routeMode;

    let frame = 0;
    let timer = 0;

    if (routeMode === "section") {
      setOrbPhase("gliding-to-section");
      timer = window.setTimeout(() => setOrbPhase("rail"), ORBIT_GLIDE_MS);
      return () => {
        window.clearTimeout(timer);
      };
    }

    if (previousRouteMode === "section") {
      setOrbPhase("preparing-hub-glide");
      frame = window.requestAnimationFrame(() => {
        setOrbPhase("gliding-to-hub");
        timer = window.setTimeout(() => setOrbPhase("hub"), ORBIT_GLIDE_MS);
      });

      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
    }

    setOrbPhase("hub");
    return undefined;
  }, [routeMode]);

  return orbPhase;
}

function App() {
  const moonPhaseFavicon = useMoonPhaseFavicon();

  const [siteData, setSiteData] = useState<SiteData>(fallbackSiteData);
  const orbAnchorRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const isAdmin = normalizedPath === "/admin";
  const isAdminLogin = normalizedPath === "/admin/login";
  const visibleSections = useMemo(
    () =>
      sortByOrder(
        siteData.sections.filter(
          (item) => item.orbit === "inner" && isVisibleNow(item),
        ),
      ),
    [siteData.sections],
  );
  const visibleMomentaryTabs = useMemo(
    () => sortByOrder(siteData.momentaryTabs.filter(isVisibleNow)),
    [siteData.momentaryTabs],
  );
  const section: SectionId | null = isAdmin || isAdminLogin
    ? null
    : sectionFromPathname(location.pathname, visibleSections);
  const sectionConfig: SiteSection | null = visibleSections.find((item) => item.id === section) ?? null;
  const activeMoment = isAdmin || isAdminLogin || section ? null : momentFromPathname(location.pathname, visibleMomentaryTabs);
  const momentConfig = visibleMomentaryTabs.find((item) => item.id === activeMoment) ?? null;
  const mode: LayoutMode = section || activeMoment ? "section" : "hub";

  // displayedSection / displayedMoment lag behind the live route so the panel
  // and title keep their content while the close transition plays out.
  const [displayedSection, setDisplayedSection] = useState<SectionId | null>(section);
  const [displayedMoment, setDisplayedMoment] = useState<string | null>(activeMoment);
  const orbRailRef = useRef<HTMLDivElement>(null);
  const orbTabsRef = useRef<HTMLDivElement>(null);
  const orbPhase = useOrbPhase(mode);
  const usesEdgeRail = orbPhase === "rail";
  const orbitInteractionEnabled = orbPhase === "hub";
  const orbitCoreMode: LayoutMode =
    orbPhase === "gliding-to-section" ||
    orbPhase === "rail" ||
    orbPhase === "preparing-hub-glide"
      ? "section"
      : "hub";
  const [orbTabScrollShadows, setOrbTabScrollShadows] = useState({
    down: false,
    measured: false,
    overflow: false,
    up: false,
  });

  useOrbitPointerHover(
    orbTabsRef,
    ".section-tab, .moment-tab",
    "",
    usesEdgeRail,
    visibleSections.length + visibleMomentaryTabs.length,
  );

  useEffect(() => {
    const tabs = orbTabsRef.current;

    if (!usesEdgeRail || !tabs) {
      setOrbTabScrollShadows((current) =>
        current.measured || current.overflow || current.up || current.down
          ? { down: false, measured: false, overflow: false, up: false }
          : current,
      );
      return;
    }

    setOrbTabScrollShadows({ down: false, measured: false, overflow: false, up: false });

    let frame = 0;
    const timers: number[] = [];
    const updateScrollShadows = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const tolerance = 2;
        const hasOverflow = tabs.scrollHeight - tabs.clientHeight > tolerance;
        const next = {
          down: hasOverflow && tabs.scrollTop + tabs.clientHeight < tabs.scrollHeight - tolerance,
          measured: true,
          overflow: hasOverflow,
          up: hasOverflow && tabs.scrollTop > tolerance,
        };

        setOrbTabScrollShadows((current) =>
          current.measured === next.measured &&
          current.overflow === next.overflow &&
          current.up === next.up &&
          current.down === next.down
            ? current
            : next,
        );
      });
    };
    const scheduleLayoutScrollShadowUpdate = () => {
      updateScrollShadows();
      timers.push(window.setTimeout(updateScrollShadows, 80));
      timers.push(window.setTimeout(updateScrollShadows, SECTION_EXIT_MS + 80));
    };

    scheduleLayoutScrollShadowUpdate();
    tabs.addEventListener("scroll", updateScrollShadows, { passive: true });
    window.addEventListener("resize", scheduleLayoutScrollShadowUpdate);

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollShadows);
    observer?.observe(tabs);
    Array.from(tabs.children).forEach((child) => observer?.observe(child));

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      tabs.removeEventListener("scroll", updateScrollShadows);
      window.removeEventListener("resize", scheduleLayoutScrollShadowUpdate);
      observer?.disconnect();
    };
  }, [
    displayedMoment,
    displayedSection,
    normalizedPath,
    usesEdgeRail,
    visibleMomentaryTabs.length,
    visibleSections.length,
  ]);

  useEffect(() => {
    if (section) {
      setDisplayedSection(section);
      return;
    }

    const timer = window.setTimeout(() => setDisplayedSection(null), SECTION_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [isAdmin, section, sectionConfig]);

  useEffect(() => {
    if (activeMoment) {
      setDisplayedMoment(activeMoment);
      return;
    }

    const timer = window.setTimeout(() => setDisplayedMoment(null), SECTION_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [activeMoment]);

  useEffect(() => {
    if (normalizedPath !== "/" && !isAdmin && !isAdminLogin && section === null && activeMoment === null) {
      navigate("/", { replace: true });
    }
  }, [normalizedPath, isAdmin, isAdminLogin, section, activeMoment, navigate]);

  useEffect(() => {
    if (isAdmin && !getStoredAdminSession()) {
      navigate("/", { replace: true });
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (sectionConfig) {
      document.title = `${sectionConfig.title} - Fernando Luna`;
      return;
    }

    if (momentConfig) {
      document.title = `${momentConfig.label} · Fernando Luna`;
      return;
    }

    document.title = isAdmin ? "Administracion · Fernando Luna" : "Fernando Luna";
  }, [isAdmin, isAdminLogin, section, sectionConfig, momentConfig]);

  useEffect(() => {
    const controller = new AbortController();

    fetchSiteData(controller.signal)
      .then((data) => {
        setSiteData(data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      });

    return () => controller.abort();
  }, []);

  const goToSection = (next: SectionId) => {
    const nextSection = visibleSections.find((item) => item.id === next);
    if (nextSection) navigate(`/${nextSection.route}`);
  };
  const goToMoment = (next: string) => {
    const nextMoment = visibleMomentaryTabs.find((item) => item.id === next);
    if (nextMoment) navigate(`/${nextMoment.id}`);
  };
  const goHome = () => navigate("/");

  const orbLabel =
    siteData.profile.avatarAlt.length > 0
      ? siteData.profile.avatarAlt
      : "Portal de Fernando Luna";

  if (isAdmin) {
    if (!getStoredAdminSession()) {
      return null;
    }

    return <AdminPage />;
  }

  if (isAdminLogin) {
    return <AdminLoginPage />;
  }

  const defaultSection = visibleSections[0];
  const orbTabsClassName = [
    "orb-ui-tabs",
    orbTabScrollShadows.measured && orbTabScrollShadows.overflow && orbTabScrollShadows.up
      ? "can-scroll-up"
      : "",
    orbTabScrollShadows.measured && orbTabScrollShadows.overflow && orbTabScrollShadows.down
      ? "can-scroll-down"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    // data-orb-phase exposes the UI orbit state independently from the route.
    // SunEffect remains fullscreen so the WebGL layers keep stable coordinates.
    <main
      className="app-shell"
      data-orb-phase={orbPhase}
      data-orb-section={section ?? activeMoment ?? ""}
    >
      <SunEffect
        anchorRef={orbAnchorRef}
        className="viewport-sun-field"
        quality="high"
        intensity={1.22}
        size={0.46}
        plasmaSpeed={0.32}
        plasmaScale={2.35}
        coronaSize={1.7}
        coronaDistortion={0.58}
        rayStrength={0.52}
        rayLength={1.75}
        cursorInfluence={0.9}
        bloomStrength={1.2}
        bloomRadius={0.38}
        hoverTargetRadius={0.42}
        interactive={mode === "hub"}
        colorPalette={{
          core: "#fff7bd",
          plasma: "#ff9500",
          corona: "#ff4a18",
          shadow: "#170100",
        }}
      />

      <Header links={siteData.profile.links} brandIcon={moonPhaseFavicon} />

      <h1 className="sr-only">{siteData.profile.name}</h1>

      <div ref={orbRailRef} className="orb-ui-rail">
        <div ref={orbTabsRef} className={orbTabsClassName}>
          <MomentaryTabs
            orbitInteractionEnabled={orbitInteractionEnabled}
            tabs={visibleMomentaryTabs}
            activeMoment={activeMoment}
            onSelect={goToMoment}
          />
          <SectionTabs
            activeSection={section}
            onSelect={goToSection}
            orbitInteractionEnabled={orbitInteractionEnabled}
            sections={visibleSections}
          />
        </div>
        <OrbitCore
          anchorRef={orbAnchorRef}
          mode={orbitCoreMode}
          orbLabel={mode === "section" ? "Volver al inicio" : orbLabel}
          onOrbActivate={() =>
            mode === "section"
              ? goHome()
              : defaultSection
                ? goToSection(defaultSection.id)
                : undefined
          }
        />
      </div>

      <SectionPanel
        section={displayedSection}
        moment={displayedMoment}
        momentConfig={visibleMomentaryTabs.find((item) => item.id === displayedMoment) ?? null}
        open={mode === "section"}
        siteData={siteData}
        sections={visibleSections}
      />
    </main>
  );
}

function Header({ links, brandIcon }: { links: ProfileLink[]; brandIcon: MoonPhaseFavicon }) {
  return (
    <header className="topbar">
      <a className="brand-mark" aria-label="Fernando Luna inicio">
        <img src={brandIcon.href} alt="" title={brandIcon.label} />
        <span>Fernando Luna</span>
      </a>

      <nav className="top-links" aria-label="Enlaces de marca">
        {links.map((link) => (
          <a key={link.label} href={link.href} title={link.label} aria-label={link.label}>
            <LinkIcon kind={link.kind} />
          </a>
        ))}
      </nav>
    </header>
  );
}

function LinkIcon({ kind }: { kind: ProfileLink["kind"] }) {
  const iconProps = { size: 18, "aria-hidden": true };

  if (kind === "github") {
    return <Github {...iconProps} />;
  }

  if (kind === "linkedin") {
    return <Linkedin {...iconProps} />;
  }

  if (kind === "mail") {
    return <Mail {...iconProps} />;
  }

  return <Globe2 {...iconProps} />;
}

// Rings, glow and the central orb. Two visible rings match the inner stable
// orbit and the faster outer orbit.
function OrbitCore({
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

// The four section tabs. This is the inner orbit; when a section is open, it
// follows the corner orb with a smaller radius.
function SectionTabs({
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
    <nav ref={tabsRef} className="section-tabs" aria-label="Secciones del portal">
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

// Outer orbit. In hub mode they spin around the center; in section mode they
// glide to the corner column, stacked above the inner section tabs while
// keeping their compact yellowish style from the hub.
function MomentaryTabs({
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
    <aside ref={tabsRef} className="momentary-tabs" aria-label="Pestanas momentaneas">
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

// Full-screen scrollable panel that holds the active section's content.
function SectionPanel({
  section,
  moment,
  momentConfig,
  open,
  siteData,
  sections,
}: {
  section: SectionId | null;
  moment: string | null;
  momentConfig: MomentaryTab | null;
  open: boolean;
  siteData: SiteData;
  sections: SiteSection[];
}) {
  const sectionConfig = sections.find((item) => item.id === section) ?? null;

  return (
    <section className={`section-panel ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <div className="section-panel-scroll">
        {section && sectionConfig ? (
          <SectionContent section={sectionConfig} siteData={siteData} />
        ) : moment && momentConfig ? (
          <MomentContent moment={momentConfig} siteData={siteData} />
        ) : null}
      </div>
    </section>
  );
}

function MomentContent({ moment, siteData }: { moment: MomentaryTab; siteData: SiteData }) {
  const items = sortByOrder(
    siteData.momentaryItems.filter(
      (item) => item.tabId === moment.id && isVisibleNow(item),
    ),
  );

  return (
    <StandardSectionView
      section={moment.id}
      eyebrow="Pestaña momentánea"
      title={moment.label}
      description={`Contenido de ${moment.label}.`}
      iconKey={moment.iconKey}
    >
      {items.length > 0 ? (
        <GenericSectionItems ariaLabel={moment.label} items={items} />
      ) : (
        <EmptySectionState label={moment.label} />
      )}
    </StandardSectionView>
  );
}

function SectionContent({
  section,
  siteData,
}: {
  section: SiteSection;
  siteData: SiteData;
}) {
  return (
    <StandardSectionView
      section={section.id}
      eyebrow={section.eyebrow}
      title={section.title}
      description={section.description}
      iconKey={section.iconKey}
    >
      <SectionBody
        activeSection={section.id}
        siteData={siteData}
      />
    </StandardSectionView>
  );
}

function StandardSectionView({
  section,
  eyebrow,
  title,
  description,
  iconKey,
  children,
}: {
  section: SectionId;
  eyebrow: string;
  title: string;
  description: string;
  iconKey: string;
  children: ReactNode;
}) {
  return (
    <article className="standard-section-view" data-section={section}>
      <header className="standard-section-header">
        <span className="standard-section-eyebrow">
          <IconByKey iconKey={iconKey} size={17} />
          {eyebrow}
        </span>
        <div className="standard-section-heading">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>

      <div className="standard-section-body">{children}</div>
    </article>
  );
}

function SectionBody({
  activeSection,
  siteData,
}: {
  activeSection: SectionId;
  siteData: SiteData;
}) {
  const sectionItems = sortByOrder(
    siteData.sectionItems.filter(
      (item) => item.sectionId === activeSection && isVisibleNow(item),
    ),
  );

  if (sectionItems.length === 0) {
    return <EmptySectionState label={activeSection} />;
  }

  return <GenericSectionItems ariaLabel={activeSection} items={sectionItems} />;
}

function GenericSectionItems({ ariaLabel, items }: { ariaLabel: string; items: ContentItem[] }) {
  const cards: CarouselCard[] = items.map((item) => ({
    id: item.id,
    kicker: normalizeKicker(item),
    title: item.title,
    meta: item.meta ?? undefined,
    description: item.description,
    tags: item.tags,
    action: item.href ? { label: item.kind === "post" ? "Leer" : "Abrir", href: item.href } : undefined,
    icon: <IconByKey iconKey={item.iconKey} size={20} />,
  }));

  return <SectionCarousel ariaLabel={ariaLabel} cards={cards} />;
}

function EmptySectionState({ label }: { label: string }) {
  return (
    <div className="section-empty-state" role="status">
      <p>Todavía no hay contenido publicado en {label}.</p>
    </div>
  );
}

function normalizeKicker(item: ContentItem) {
  if (item.kind === "post" && isIsoDate(item.kicker)) {
    return formatDate(item.kicker);
  }
  return item.kicker;
}

function isIsoDate(value: string) {
  return !Number.isNaN(Date.parse(value));
}

function SectionCarousel({ ariaLabel, cards }: { ariaLabel: string; cards: CarouselCard[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = cards.length;

  useEffect(() => {
    setActiveIndex(0);
  }, [ariaLabel]);

  useEffect(() => {
    setActiveIndex((current) => (count === 0 ? 0 : Math.min(current, count - 1)));
  }, [count]);

  useEffect(() => {
    if (paused || count <= 1) {
      return;
    }

    let timer: number | null = null;

    const start = () => {
      if (timer !== null) {
        return;
      }
      timer = window.setInterval(() => {
        setActiveIndex((current) => (current + 1) % count);
      }, 5200);
    };

    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, [count, paused]);

  const goTo = (index: number) => {
    if (count === 0) {
      return;
    }
    setActiveIndex((index + count) % count);
  };

  const previous = () => goTo(activeIndex - 1);
  const next = () => goTo(activeIndex + 1);

  if (count === 0) {
    return null;
  }

  return (
    <section className="section-carousel" aria-label={ariaLabel}>
      <div className="carousel-stage" aria-live={paused ? "off" : "polite"}>
        {cards.map((card, index) => {
          const offset = getCarouselOffset(index, activeIndex, count);
          const isActive = index === activeIndex;
          const isNearby = Math.abs(offset) <= 2;

          return (
            <article
              className={`carousel-card ${isActive ? "is-active" : ""} ${
                isNearby ? "" : "is-distant"
              }`}
              key={card.id}
              style={
                {
                  "--card-offset": offset,
                  "--card-depth": Math.abs(offset),
                } as CSSProperties
              }
              tabIndex={isActive ? 0 : -1}
              aria-hidden={!isActive}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <div className="carousel-card-main">
                <div className="carousel-card-icon">{card.icon}</div>
                <p className="carousel-card-kicker">{card.kicker}</p>
                <h3>{card.title}</h3>
                {card.meta ? <p className="carousel-card-meta">{card.meta}</p> : null}
                <p className="carousel-card-description">{card.description}</p>
                {card.tags && card.tags.length > 0 ? (
                  <div className="carousel-chip-list" aria-label="Etiquetas">
                    {card.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              <footer className="carousel-card-footer">
                {card.action ? (
                  <a className="carousel-card-action" href={card.action.href}>
                    {card.action.label}
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                ) : null}
              </footer>
            </article>
          );
        })}
      </div>

      <div className="carousel-controls" aria-label={`Controles de ${ariaLabel}`}>
        <button type="button" onClick={previous} aria-label="Tarjeta anterior" title="Anterior">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <div className="carousel-position" aria-label={`${activeIndex + 1} de ${count}`}>
          {cards.map((card, index) => (
            <button
              className={index === activeIndex ? "is-active" : ""}
              key={card.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Ver ${card.title}`}
              aria-current={index === activeIndex ? "true" : undefined}
            />
          ))}
        </div>
        <button type="button" onClick={next} aria-label="Tarjeta siguiente" title="Siguiente">
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function getCarouselOffset(index: number, activeIndex: number, count: number) {
  const raw = index - activeIndex;
  const half = count / 2;

  if (raw > half) {
    return raw - count;
  }

  if (raw < -half) {
    return raw + count;
  }

  return raw;
}

function Footer({ links }: { links: ProfileLink[] }) {
  return (
    <footer className="footer">
      <span>Fernando Luna</span>
      <nav aria-label="Enlaces secundarios">
        {links.map((link) => (
          <a key={link.label} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value: string) {
  return DATE_FORMATTER.format(new Date(value));
}

export default App;
