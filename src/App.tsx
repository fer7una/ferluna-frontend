import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fallbackSiteData, fetchSiteData } from "./api";
import { AdminLoginPage, AdminPage, getStoredAdminSession } from "./components/admin";
import { SunEffect } from "./components/SunEffect";
import {
  isVisibleNow,
  momentFromPathname,
  sectionFromPathname,
  sortByOrder,
} from "./domain/site/selectors";
import {
  useOrbPhase,
  useOrbitPointerHover,
  type LayoutMode,
} from "./features/publicPortal/orbitHooks";
import {
  Footer,
  Header,
  MomentaryTabs,
  OrbitCore,
  SectionPanel,
  SectionTabs,
} from "./features/publicPortal/components";
import { usePerformanceGovernor } from "./performance/usePerformanceGovernor";
import { useMoonPhaseFavicon, type MoonPhaseFavicon } from "./useMoonPhaseFavicon";
import type {
  SectionId,
  SiteData,
  SiteSection,
} from "./types";

const SECTION_EXIT_MS = 460;

function App() {
  const moonPhaseFavicon = useMoonPhaseFavicon();

  const [siteData, setSiteData] = useState<SiteData>(fallbackSiteData);
  const orbAnchorRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Watches frame smoothness / long tasks and lowers the orb's quality (and,
  // at the bottom of the ladder, drops WebGL for the CSS fallback) when the
  // user's machine is saturated. Degradation is sticky until reload.
  const sunPerformance = usePerformanceGovernor({ initialQuality: "high" });

  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const isAdmin = normalizedPath === "/admin";
  const isAdminLogin = normalizedPath === "/admin/login";
  const visibleSections = useMemo(
    () => sortByOrder(siteData.sections.filter(isVisibleNow)),
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
  const [activeSectionCard, setActiveSectionCard] = useState<{
    cardId: string;
    section: SectionId;
  } | null>(null);
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
    setActiveSectionCard(null);
  }, [section]);

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
      navigate("/admin/login", { replace: true });
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

    document.title = isAdmin ? "Administración · Fernando Luna" : "Fernando Luna";
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
    if (!nextSection) {
      return;
    }

    if (section === next) {
      setActiveSectionCard(null);
      return;
    }

    setActiveSectionCard(null);
    navigate(`/${nextSection.route}`);
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
  const orbitDurationStyle = {
    "--tab-orbit-duration": `${siteData.visualSettings.sectionOrbitDurationSeconds}s`,
    "--moment-tab-orbit-duration": `${siteData.visualSettings.momentaryOrbitDurationSeconds}s`,
  } as CSSProperties;

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
  const activeSectionCardId =
    section && activeSectionCard?.section === section ? activeSectionCard.cardId : null;

  return (
    // data-orb-phase exposes the UI orbit state independently from the route.
    // SunEffect remains fullscreen so the WebGL layers keep stable coordinates.
    <main
      className="app-shell"
      data-orb-phase={orbPhase}
      data-orb-section={section ?? activeMoment ?? ""}
      style={orbitDurationStyle}
    >
      <SunEffect
        anchorRef={orbAnchorRef}
        className="viewport-sun-field"
        quality={sunPerformance.quality}
        forceFallback={!sunPerformance.webglEnabled}
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

      <Header links={siteData.profile.links} brandIcon={moonPhaseFavicon} onHome={goHome} />

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
        activeSectionCardId={activeSectionCardId}
        onOpenSectionCard={(cardId) => {
          if (section) {
            setActiveSectionCard({ cardId, section });
          }
        }}
        siteData={siteData}
        sections={visibleSections}
      />
    </main>
  );
}

export default App;

