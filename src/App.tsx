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
  type ReactNode,
  type RefObject,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fallbackSiteData, fetchSiteData } from "./api";
import { SunEffect } from "./components/SunEffect";
import { useMoonPhaseFavicon, type MoonPhaseFavicon } from "./useMoonPhaseFavicon";
import type { DocLink, Post, ProfileLink, Project, SectionId, SiteData } from "./types";

const sectionCopy: Record<
  SectionId,
  {
    label: string;
    eyebrow: string;
    title: string;
    description: string;
    icon: typeof BriefcaseBusiness;
  }
> = {
  cv: {
    label: "CV",
    eyebrow: "Trayectoria",
    title: "CV vivo",
    description: "Experiencia, capacidades y foco profesional.",
    icon: BriefcaseBusiness,
  },
  projects: {
    label: "Proyectos",
    eyebrow: "Trabajo",
    title: "Proyectos visibles",
    description: "Productos, laboratorios y webs que puedo enseñar.",
    icon: Code2,
  },
  personal: {
    label: "Personal",
    eyebrow: "Publicaciones",
    title: "Notas personales",
    description: "Espacio para publicar ideas, avances y aprendizajes.",
    icon: UserRound,
  },
  docs: {
    label: "Docs",
    eyebrow: "Biblioteca",
    title: "Documentación",
    description: "Accesos a guías, recursos y webs técnicas.",
    icon: BookOpen,
  },
};

const orbitOrder: SectionId[] = ["cv", "projects", "personal", "docs"];

// Each tab owns an orbital angle. CSS animates the wrapper around the current
// orb center while the button counter-rotates so text remains readable.
const tabLayout: Record<SectionId, { angle: number }> = {
  cv: { angle: -90 },
  projects: { angle: 0 },
  personal: { angle: 90 },
  docs: { angle: 180 },
};

const momentaryTabs = [
  { label: "Referencias", icon: BookOpen, angle: -35 },
  { label: "Oportunidades", icon: Rocket, angle: 55 },
  { label: "Eventos", icon: Newspaper, angle: 145 },
  { label: "Ideas", icon: Layers, angle: 235 },
] as const;

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

function sectionFromPathname(pathname: string): SectionId | null {
  const segment = pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
  return (orbitOrder as string[]).includes(segment) ? (segment as SectionId) : null;
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

  const section = sectionFromPathname(location.pathname);
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const mode: LayoutMode = section ? "section" : "hub";

  // displayedSection lags behind `section` so the panel and title keep their
  // content while the close transition plays out.
  const [displayedSection, setDisplayedSection] = useState<SectionId | null>(section);

  useEffect(() => {
    if (section) {
      setDisplayedSection(section);
      return;
    }

    const timer = window.setTimeout(() => setDisplayedSection(null), SECTION_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [section]);

  useEffect(() => {
    if (normalizedPath !== "/" && section === null) {
      navigate("/", { replace: true });
    }
  }, [normalizedPath, section, navigate]);

  useEffect(() => {
    document.title = section
      ? `${sectionCopy[section].title} · Fernando Luna`
      : "Fernando Luna";
  }, [section]);

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

  const featuredProjects = useMemo(
    () => siteData.projects.filter((project) => project.featured),
    [siteData.projects],
  );

  const goToSection = (next: SectionId) => navigate(`/${next}`);
  const goHome = () => navigate("/");

  const orbLabel =
    siteData.profile.avatarAlt.length > 0
      ? siteData.profile.avatarAlt
      : "Portal de Fernando Luna";

  return (
    // data-orb-mode / data-orb-section expose the layout state for the UI orbit.
    // SunEffect remains fullscreen so the WebGL layers keep stable coordinates.
    <main className="app-shell" data-orb-mode={mode} data-orb-section={section ?? ""}>
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
        onOrbActivate={() => (mode === "section" ? goHome() : goToSection("cv"))}
      />

      <SectionTabs activeSection={section} onSelect={goToSection} mode={mode} />
      <MomentaryTabs mode={mode} />

      <SectionPanel
        section={displayedSection}
        open={mode === "section"}
        siteData={siteData}
        featuredProjects={featuredProjects}
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
}: {
  activeSection: SectionId | null;
  onSelect: (section: SectionId) => void;
  mode: LayoutMode;
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
      {orbitOrder.map((section, index) => {
        const Icon = sectionCopy[section].icon;
        const isActive = activeSection === section;
        const layout = tabLayout[section];

        return (
          <div
            className="section-tab-orbit"
            key={section}
            style={
              {
                "--orbit-angle": `${layout.angle}deg`,
                "--orbit-counter-angle": `${-layout.angle}deg`,
                "--tab-index": index,
              } as CSSProperties
            }
          >
            <div className="section-tab-radius">
              <div className="section-tab-level">
                <button
                  className={`section-tab ${isActive ? "is-active" : ""}`}
                  onClick={() => onSelect(section)}
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
                  title={sectionCopy[section].description}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{sectionCopy[section].label}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// Temporary topics live on a faster outer orbit. They are visual anchors for
// future content, not routes yet.
function MomentaryTabs({ mode }: { mode: LayoutMode }) {
  const tabsRef = useRef<HTMLElement>(null);
  useOrbitPointerHover(
    tabsRef,
    ".moment-tab",
    ".moment-tab-orbit, .moment-tab-level",
    mode === "hub",
  );

  return (
    <aside ref={tabsRef} className="momentary-tabs" aria-label="Pestanas momentaneas">
      {momentaryTabs.map((item) => {
        const Icon = item.icon;

        return (
          <div
            className="moment-tab-orbit"
            key={item.label}
            style={
              {
                "--orbit-angle": `${item.angle}deg`,
                "--orbit-counter-angle": `${-item.angle}deg`,
              } as CSSProperties
            }
          >
            <div className="moment-tab-radius">
              <div className="moment-tab-level">
                <span className="moment-tab">
                  <Icon size={17} aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
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
  open,
  siteData,
  featuredProjects,
}: {
  section: SectionId | null;
  open: boolean;
  siteData: SiteData;
  featuredProjects: Project[];
}) {
  return (
    <section className={`section-panel ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <div className="section-panel-scroll">
        {section ? (
          <SectionContent
            activeSection={section}
            siteData={siteData}
            featuredProjects={featuredProjects}
          />
        ) : null}
      </div>
    </section>
  );
}

function SectionContent({
  activeSection,
  siteData,
  featuredProjects,
}: {
  activeSection: SectionId;
  siteData: SiteData;
  featuredProjects: Project[];
}) {
  const copy = sectionCopy[activeSection];

  return (
    <StandardSectionView
      section={activeSection}
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      icon={copy.icon}
    >
      <SectionBody
        activeSection={activeSection}
        siteData={siteData}
        featuredProjects={featuredProjects}
      />
    </StandardSectionView>
  );
}

function StandardSectionView({
  section,
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
}: {
  section: SectionId;
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof BriefcaseBusiness;
  children: ReactNode;
}) {
  return (
    <article className="standard-section-view" data-section={section}>
      <header className="standard-section-header">
        <span className="standard-section-eyebrow">
          <Icon size={17} aria-hidden="true" />
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
  featuredProjects,
}: {
  activeSection: SectionId;
  siteData: SiteData;
  featuredProjects: Project[];
}) {
  if (activeSection === "projects") {
    return <Projects projects={siteData.projects} />;
  }

  if (activeSection === "personal") {
    return <Personal posts={siteData.posts} featuredProjects={featuredProjects} />;
  }

  if (activeSection === "docs") {
    return <Docs docs={siteData.docs} />;
  }

  return <CvSection siteData={siteData} />;
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
