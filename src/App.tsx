import {
  BookOpen,
  BriefcaseBusiness,
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

type LayoutMode = "hub" | "section";

// Closing the section view keeps the panel/title mounted for this long so the
// exit transition can finish before the content unmounts.
const SECTION_EXIT_MS = 460;

function sectionFromPathname(pathname: string): SectionId | null {
  const segment = pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
  return (orbitOrder as string[]).includes(segment) ? (segment as SectionId) : null;
}

function App() {
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
        hoverTargetRadius={0.75}
        interactive={mode === "hub"}
        colorPalette={{
          core: "#fff7bd",
          plasma: "#ff9500",
          corona: "#ff4a18",
          shadow: "#170100",
        }}
      />

      <Header links={siteData.profile.links} />

      <h1 className="sr-only">{siteData.profile.name}</h1>

      <OrbitCore
        anchorRef={orbAnchorRef}
        mode={mode}
        orbLabel={mode === "section" ? "Volver al inicio" : orbLabel}
        onOrbActivate={() => (mode === "section" ? goHome() : goToSection("cv"))}
      />

      <SectionTabs activeSection={section} onSelect={goToSection} />

      <SectionPanel
        section={displayedSection}
        open={mode === "section"}
        siteData={siteData}
        featuredProjects={featuredProjects}
      />
    </main>
  );
}

function Header({ links }: { links: ProfileLink[] }) {
  return (
    <header className="topbar">
      <a className="brand-mark" aria-label="Fernando Luna inicio">
        <img src="/favicon.svg" alt="" />
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

// Rings, glow and the central orb. The whole stage glides to the bottom-right
// corner when a section is open; the orb stays visible and returns home.
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

// The four section tabs. A single set of buttons orbits the current orb center;
// when a section is open, the orbit follows the corner orb with a smaller radius.
function SectionTabs({
  activeSection,
  onSelect,
}: {
  activeSection: SectionId | null;
  onSelect: (section: SectionId) => void;
}) {
  return (
    <nav className="section-tabs" aria-label="Secciones del portal">
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
  return (
    <div className="cv-layout">
      <article className="cv-summary">
        <p>{siteData.cv.summary}</p>
        <div className="skill-cloud" aria-label="Competencias">
          {siteData.cv.skills.map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
      </article>

      <div className="timeline" aria-label="Experiencia">
        {siteData.cv.experience.map((item) => (
          <article className="timeline-item" key={`${item.period}-${item.title}`}>
            <time>{item.period}</time>
            <h3>{item.title}</h3>
            <p className="company">{item.company}</p>
            <p>{item.description}</p>
          </article>
        ))}
      </div>

      <div className="education-panel">
        <Rocket size={22} aria-hidden="true" />
        {siteData.cv.education.map((item) => (
          <article key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function Projects({ projects }: { projects: Project[] }) {
  return (
    <div className="project-grid">
      {projects.map((project) => (
        <article className="project-card" key={project.name}>
          <div className="card-topline">
            <span>{project.category}</span>
            <strong>{project.status}</strong>
          </div>
          <h3>{project.name}</h3>
          <p>{project.summary}</p>
          <div className="stack-list">
            {project.stack.map((tech) => (
              <span key={tech}>{tech}</span>
            ))}
          </div>
          <a href={project.href}>
            Abrir
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </article>
      ))}
    </div>
  );
}

function Personal({
  posts,
  featuredProjects,
}: {
  posts: Post[];
  featuredProjects: Project[];
}) {
  return (
    <div className="personal-layout">
      <div className="post-list">
        {posts.map((post) => (
          <article className="post-item" key={post.title}>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <h3>{post.title}</h3>
            <p>{post.excerpt}</p>
            <a href={post.href}>
              Leer
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>

      <aside className="focus-panel" aria-label="Proyectos destacados">
        <Layers size={22} aria-hidden="true" />
        <h3>Ahora mismo</h3>
        {featuredProjects.map((project) => (
          <p key={project.name}>
            <strong>{project.name}</strong>
            {project.summary}
          </p>
        ))}
      </aside>
    </div>
  );
}

function Docs({ docs }: { docs: DocLink[] }) {
  return (
    <div className="docs-grid">
      {docs.map((doc) => (
        <article className="doc-card" key={doc.title}>
          <Newspaper size={22} aria-hidden="true" />
          <h3>{doc.title}</h3>
          <p>{doc.description}</p>
          <a href={doc.href}>
            Abrir docs
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </article>
      ))}
    </div>
  );
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default App;
