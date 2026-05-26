import {
  BookOpen,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Code2,
  ExternalLink,
  Github,
  Globe2,
  Layers,
  Linkedin,
  Mail,
  Newspaper,
  Rocket,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ApiError,
  fallbackSiteData,
  fetchAdminSiteData,
  fetchSiteData,
  loginAdmin,
  saveAdminSiteData,
} from "./api";
import { SunEffect } from "./components/SunEffect";
import { useMoonPhaseFavicon, type MoonPhaseFavicon } from "./useMoonPhaseFavicon";
import type {
  DocLink,
  MomentaryTab,
  Post,
  ProfileLink,
  Project,
  SectionId,
  SectionItem,
  SiteData,
  SiteSection,
} from "./types";

type IconComponent = typeof BriefcaseBusiness;

const iconMap: Record<string, IconComponent> = {
  book: BookOpen,
  briefcase: BriefcaseBusiness,
  code: Code2,
  globe: Globe2,
  layers: Layers,
  newspaper: Newspaper,
  rocket: Rocket,
  user: UserRound,
};

type LayoutMode = "hub" | "section";
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

function IconByKey({ iconKey, size }: { iconKey: string; size: number }) {
  const Icon = iconMap[iconKey] ?? Globe2;
  return <Icon size={size} aria-hidden="true" />;
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
  }, [enabled, animationSelector, containerRef, hitSelector]);
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

  return (
    // data-orb-mode / data-orb-section expose the layout state for the UI orbit.
    // SunEffect remains fullscreen so the WebGL layers keep stable coordinates.
    <main
      className="app-shell"
      data-orb-mode={mode}
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

      <OrbitCore
        anchorRef={orbAnchorRef}
        mode={mode}
        orbLabel={mode === "section" ? "Volver al inicio" : orbLabel}
        onOrbActivate={() =>
          mode === "section" ? goHome() : defaultSection ? goToSection(defaultSection.id) : undefined
        }
      />

      <SectionTabs
        activeSection={section}
        onSelect={goToSection}
        mode={mode}
        sections={visibleSections}
      />
      <MomentaryTabs
        mode={mode}
        tabs={visibleMomentaryTabs}
        activeMoment={activeMoment}
        onSelect={goToMoment}
      />

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
  mode,
  sections,
}: {
  activeSection: SectionId | null;
  onSelect: (section: SectionId) => void;
  mode: LayoutMode;
  sections: SiteSection[];
}) {
  const tabsRef = useRef<HTMLElement>(null);
  useOrbitPointerHover(
    tabsRef,
    ".section-tab",
    ".section-tab-orbit, .section-tab-level",
    mode === "hub",
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
  mode,
  tabs,
  activeMoment,
  onSelect,
}: {
  mode: LayoutMode;
  tabs: MomentaryTab[];
  activeMoment: string | null;
  onSelect: (next: string) => void;
}) {
  const tabsRef = useRef<HTMLElement>(null);
  useOrbitPointerHover(
    tabsRef,
    ".moment-tab",
    ".moment-tab-orbit, .moment-tab-level",
    mode === "hub",
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
          <MomentPlaceholder moment={momentConfig} />
        ) : null}
      </div>
    </section>
  );
}

function MomentPlaceholder({ moment }: { moment: MomentaryTab }) {
  const cards: CarouselCard[] = [
    {
      id: `${moment.id}-placeholder-1`,
      kicker: "Próximamente",
      title: `${moment.label} en preparación`,
      description:
        "Estoy curando el contenido de esta pestaña. Pronto verás aquí lo más relevante.",
      icon: <IconByKey iconKey={moment.iconKey} size={20} />,
    },
    {
      id: `${moment.id}-placeholder-2`,
      kicker: "Vista previa",
      title: "Estructura reservada",
      description:
        "Misma estructura que las secciones principales: tarjetas con resumen, etiquetas y enlace.",
      icon: <IconByKey iconKey="layers" size={20} />,
    },
    {
      id: `${moment.id}-placeholder-3`,
      kicker: "Detalle",
      title: "Pendiente de definir",
      description:
        "Cuando el contenido esté listo, esta vista cargará tarjetas reales desde el backend.",
      icon: <IconByKey iconKey="newspaper" size={20} />,
    },
  ];

  return (
    <StandardSectionView
      section={moment.id}
      eyebrow="Pestaña momentánea"
      title={moment.label}
      description="Contenido placeholder con la misma estructura que las secciones principales."
      iconKey={moment.iconKey}
    >
      <SectionCarousel ariaLabel={moment.label} cards={cards} />
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

  if (sectionItems.length > 0) {
    return <GenericSectionItems ariaLabel={activeSection} items={sectionItems} />;
  }

  if (activeSection === "projects") {
    return <Projects projects={siteData.projects} />;
  }

  if (activeSection === "personal") {
    return <Personal posts={siteData.posts} featuredProjects={siteData.projects.filter((project) => project.featured)} />;
  }

  if (activeSection === "docs") {
    return <Docs docs={siteData.docs} />;
  }

  return <CvSection siteData={siteData} />;
}

function GenericSectionItems({ ariaLabel, items }: { ariaLabel: string; items: SectionItem[] }) {
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

function normalizeKicker(item: SectionItem) {
  if (item.kind === "post") {
    return formatDate(item.kicker);
  }
  return item.kicker;
}

function CvSection({ siteData }: { siteData: SiteData }) {
  const cards: CarouselCard[] = [
    {
      id: "cv-summary",
      kicker: "Perfil",
      title: "Resumen profesional",
      description: siteData.cv.summary,
      tags: siteData.cv.skills,
      icon: <BriefcaseBusiness size={20} aria-hidden="true" />,
    },
    ...siteData.cv.experience.map((item, index) => ({
      id: `experience-${index}`,
      kicker: item.period,
      title: item.title,
      meta: item.company,
      description: item.description,
      icon: <BriefcaseBusiness size={20} aria-hidden="true" />,
    })),
    ...siteData.cv.education.map((item, index) => ({
      id: `education-${index}`,
      kicker: "Formacion",
      title: item.title,
      description: item.detail,
      icon: <Rocket size={20} aria-hidden="true" />,
    })),
  ];

  return <SectionCarousel ariaLabel="CV" cards={cards} />;
}

function Projects({ projects }: { projects: Project[] }) {
  const cards: CarouselCard[] = projects.map((project) => ({
    id: project.name,
    kicker: project.category,
    title: project.name,
    meta: project.status,
    description: project.summary,
    tags: project.stack,
    action: { label: "Abrir", href: project.href },
    icon: <Code2 size={20} aria-hidden="true" />,
  }));

  return <SectionCarousel ariaLabel="Proyectos" cards={cards} />;
}

function Personal({
  posts,
  featuredProjects,
}: {
  posts: Post[];
  featuredProjects: Project[];
}) {
  const cards: CarouselCard[] = [
    ...posts.map((post) => ({
      id: `post-${post.title}`,
      kicker: formatDate(post.date),
      title: post.title,
      description: post.excerpt,
      action: { label: "Leer", href: post.href },
      icon: <UserRound size={20} aria-hidden="true" />,
    })),
    ...featuredProjects.map((project) => ({
      id: `focus-${project.name}`,
      kicker: "Ahora mismo",
      title: project.name,
      meta: project.status,
      description: project.summary,
      tags: project.stack,
      action: { label: "Abrir", href: project.href },
      icon: <Layers size={20} aria-hidden="true" />,
    })),
  ];

  return <SectionCarousel ariaLabel="Notas personales" cards={cards} />;
}

function Docs({ docs }: { docs: DocLink[] }) {
  const cards: CarouselCard[] = docs.map((doc) => ({
    id: doc.title,
    kicker: "Documento",
    title: doc.title,
    description: doc.description,
    action: { label: "Abrir docs", href: doc.href },
    icon: <Newspaper size={20} aria-hidden="true" />,
  }));

  return <SectionCarousel ariaLabel="Documentacion" cards={cards} />;
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

type AdminContentData = Pick<SiteData, "sections" | "sectionItems" | "momentaryTabs">;

type AdminSession = {
  accessToken: string;
  expiresAt: number;
};

const ADMIN_SESSION_STORAGE_KEY = "ferluna-admin-session";

function getStoredAdminSession(): AdminSession | null {
  try {
    const rawSession = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!rawSession) return null;

    const session = JSON.parse(rawSession) as Partial<AdminSession>;
    if (!session.accessToken || !session.expiresAt) return null;
    if (Date.now() >= session.expiresAt * 1000) {
      clearStoredAdminSession();
      return null;
    }

    return {
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
    };
  } catch {
    return null;
  }
}

function storeAdminSession(session: AdminSession) {
  try {
    sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    return;
  }
}

function clearStoredAdminSession() {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    return;
  }
}

function AdminLoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Introduce la clave de administracion.");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password) {
      setError("La clave es obligatoria.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus("Validando");

    try {
      const session = await loginAdmin(password);
      storeAdminSession({
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
      });
      navigate("/admin", { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesion.");
      setStatus("Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-shell">
      <section className="admin-panel admin-login-panel" aria-labelledby="admin-login-title">
        <header className="admin-header">
          <div>
            <p>Fernando Luna</p>
            <h1 id="admin-login-title">Acceso de administracion</h1>
          </div>
          <a href="/">Volver</a>
        </header>

        <form className="admin-token-row" onSubmit={submitLogin}>
          <label>
            Clave
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          <button type="submit" disabled={busy}>
            Entrar
          </button>
        </form>

        <div className="admin-status" aria-live="polite">
          <span>{status}</span>
          {error ? <strong>{error}</strong> : null}
        </div>
      </section>
    </main>
  );
}

function AdminPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getStoredAdminSession());
  const [draft, setDraft] = useState(() => JSON.stringify(adminContentFromSiteData(fallbackSiteData), null, 2));
  const [status, setStatus] = useState("Sin cargar");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAdminData = async () => {
    const currentSession = getStoredAdminSession();
    if (!currentSession) {
      clearStoredAdminSession();
      navigate("/", { replace: true });
      return;
    }

    setSession(currentSession);
    const controller = new AbortController();
    setBusy(true);
    setError(null);
    setStatus("Cargando");

    try {
      const data = await fetchAdminSiteData(currentSession.accessToken, controller.signal);
      setDraft(JSON.stringify(adminContentFromSiteData(data), null, 2));
      setStatus("Contenido cargado");
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        clearStoredAdminSession();
        navigate("/", { replace: true });
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el contenido.");
      setStatus("Error");
    } finally {
      setBusy(false);
    }
  };

  const saveAdminData = async () => {
    const currentSession = getStoredAdminSession();
    if (!currentSession) {
      clearStoredAdminSession();
      navigate("/", { replace: true });
      return;
    }

    setSession(currentSession);
    let parsed: AdminContentData;
    try {
      parsed = parseAdminDraft(draft);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "JSON invalido.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus("Guardando");

    try {
      const saved = await saveAdminSiteData(currentSession.accessToken, parsed);
      setDraft(JSON.stringify(saved, null, 2));
      setStatus("Guardado");
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 401) {
        clearStoredAdminSession();
        navigate("/", { replace: true });
        return;
      }

      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el contenido.");
      setStatus("Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-shell">
      <section className="admin-panel" aria-labelledby="admin-title">
        <header className="admin-header">
          <div>
            <p>Fernando Luna</p>
            <h1 id="admin-title">Administracion de contenido</h1>
          </div>
          <a href="/">Volver</a>
        </header>

        <div className="admin-token-row">
          <span className="admin-session-expiry">
            Sesion activa hasta {session ? formatDateTime(session.expiresAt) : "sin sesion"}
          </span>
          <button type="button" onClick={loadAdminData} disabled={busy}>
            Cargar
          </button>
          <button type="button" onClick={saveAdminData} disabled={busy}>
            Guardar
          </button>
        </div>

        <div className="admin-status" aria-live="polite">
          <span>{status}</span>
          {error ? <strong>{error}</strong> : null}
        </div>

        <textarea
          className="admin-editor"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
          aria-label="Contenido editable en JSON"
        />
      </section>
    </main>
  );
}

function adminContentFromSiteData(data: SiteData): AdminContentData {
  return {
    sections: data.sections,
    sectionItems: data.sectionItems,
    momentaryTabs: data.momentaryTabs,
  };
}

function parseAdminDraft(value: string): AdminContentData {
  const parsed = JSON.parse(value) as Partial<AdminContentData>;
  if (!Array.isArray(parsed.sections)) throw new Error("sections debe ser una lista.");
  if (!Array.isArray(parsed.sectionItems)) throw new Error("sectionItems debe ser una lista.");
  if (!Array.isArray(parsed.momentaryTabs)) throw new Error("momentaryTabs debe ser una lista.");

  return {
    sections: parsed.sections,
    sectionItems: parsed.sectionItems,
    momentaryTabs: parsed.momentaryTabs,
  };
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

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value: string) {
  return DATE_FORMATTER.format(new Date(value));
}

function formatDateTime(unixSeconds: number) {
  return DATE_TIME_FORMATTER.format(new Date(unixSeconds * 1000));
}

export default App;
