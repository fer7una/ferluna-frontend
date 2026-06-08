import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SunEffect } from "../../components/SunEffect";
import {
  isVisibleNow,
  momentFromPathname,
  sectionFromPathname,
  sortByOrder,
} from "../../domain/site/selectors";
import { usePerformanceGovernor } from "../../performance/usePerformanceGovernor";
import { useMoonPhaseFavicon } from "../../useMoonPhaseFavicon";
import type { SectionId, SiteSection } from "../../types";
import {
  Header,
  MomentaryTabs,
  OrbitCore,
  SectionPanel,
  SectionTabs,
} from "./components";
import {
  ORB_SECTION_PHASES,
  PORTAL_LABELS,
  SECTION_EXIT_MS,
  type LayoutMode,
} from "./constants";
import { useOrbPhase, useOrbitPointerHover } from "./orbitHooks";
import { scrollShadowClassNames, useMeasuredScrollShadows } from "./scrollShadows";
import { useSiteData } from "./useSiteData";

export function PublicPortalPage() {
  const moonPhaseFavicon = useMoonPhaseFavicon();
  const siteData = useSiteData();
  const orbAnchorRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Watches frame smoothness / long tasks and lowers the orb's quality (and,
  // at the bottom of the ladder, drops WebGL for the CSS fallback) when the
  // user's machine is saturated. Degradation is sticky until reload.
  const sunPerformance = usePerformanceGovernor({ initialQuality: "high" });

  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const visibleSections = useMemo(
    () => sortByOrder(siteData.sections.filter(isVisibleNow)),
    [siteData.sections],
  );
  const visibleMomentaryTabs = useMemo(
    () => sortByOrder(siteData.momentaryTabs.filter(isVisibleNow)),
    [siteData.momentaryTabs],
  );
  const section: SectionId | null = sectionFromPathname(location.pathname, visibleSections);
  const sectionConfig: SiteSection | null =
    visibleSections.find((item) => item.id === section) ?? null;
  const activeMoment = section
    ? null
    : momentFromPathname(location.pathname, visibleMomentaryTabs);
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
  const orbTabsRef = useRef<HTMLDivElement>(null);
  const orbPhase = useOrbPhase(mode);
  const usesEdgeRail = orbPhase === "rail";
  const orbitInteractionEnabled = orbPhase === "hub";
  const orbitCoreMode: LayoutMode = ORB_SECTION_PHASES.includes(orbPhase) ? "section" : "hub";
  const orbTabScrollShadows = useMeasuredScrollShadows(orbTabsRef, usesEdgeRail, [
    displayedMoment,
    displayedSection,
    normalizedPath,
    visibleMomentaryTabs.length,
    visibleSections.length,
  ]);

  useOrbitPointerHover(
    orbTabsRef,
    ".section-tab, .moment-tab",
    "",
    usesEdgeRail,
    visibleSections.length + visibleMomentaryTabs.length,
  );

  useEffect(() => {
    if (section) {
      setDisplayedSection(section);
      return;
    }

    const timer = window.setTimeout(() => setDisplayedSection(null), SECTION_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [section, sectionConfig]);

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
    if (normalizedPath !== "/" && section === null && activeMoment === null) {
      navigate("/", { replace: true });
    }
  }, [normalizedPath, section, activeMoment, navigate]);

  useEffect(() => {
    if (sectionConfig) {
      document.title = `${sectionConfig.title} - Fernando Luna`;
      return;
    }

    if (momentConfig) {
      document.title = `${momentConfig.label} · Fernando Luna`;
      return;
    }

    document.title = "Fernando Luna";
  }, [sectionConfig, momentConfig]);

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
      : PORTAL_LABELS.defaultOrb;
  const orbitDurationStyle = {
    "--tab-orbit-duration": `${siteData.visualSettings.sectionOrbitDurationSeconds}s`,
    "--moment-tab-orbit-duration": `${siteData.visualSettings.momentaryOrbitDurationSeconds}s`,
    // Drives the bottom-anchored rail stack: the moment-tab block sits just above
    // the topmost section, so its glide offset needs the live section count.
    "--section-count": visibleSections.length,
  } as CSSProperties;
  const defaultSection = visibleSections[0];
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

      <div className="orb-ui-rail">
        <div
          ref={orbTabsRef}
          className={scrollShadowClassNames("orb-ui-tabs", orbTabScrollShadows)}
        >
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
          orbLabel={mode === "section" ? PORTAL_LABELS.returnHome : orbLabel}
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
