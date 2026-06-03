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
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { isVisibleNow, sortByOrder } from "../../domain/site/selectors";
import { IconByKey } from "../../icons";
import { externalLinkProps } from "../../shared/externalLinks";
import type { MoonPhaseFavicon } from "../../useMoonPhaseFavicon";
import type {
  ContentItem,
  MomentaryTab,
  ProfileLink,
  SectionId,
  SiteData,
  SiteSection,
} from "../../types";
import {
  ORBIT_HOVER_PLAYBACK_RATE,
  setOrbitPlaybackRate,
  useOrbitPointerHover,
  type LayoutMode,
} from "./orbitHooks";

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

export function Header({
  links,
  brandIcon,
  onHome,
}: {
  links: ProfileLink[];
  brandIcon: MoonPhaseFavicon;
  onHome: () => void;
}) {
  return (
    <header className="topbar">
      <a
        className="brand-mark"
        href="/"
        onClick={(event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            event.shiftKey
          ) {
            return;
          }

          event.preventDefault();
          onHome();
        }}
        aria-label="Fernando Luna inicio"
      >
        <img src={brandIcon.href} alt="" title={brandIcon.label} />
        <span>Fernando Luna</span>
      </a>

      <nav className="top-links" aria-label="Enlaces de marca">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            title={link.label}
            aria-label={link.label}
            {...externalLinkProps(link.href)}
          >
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

// Rings, glow and the central orb. Two visible rings match the section orbit
// and the momentary-tab orbit.
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

// The section tabs live on the first orbit; when a section is open, it
// follows the corner orb with a smaller radius.
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

// Momentary tabs live on the second orbit. In hub mode they spin around the center; in section mode they
// glide to the corner column, stacked above the inner section tabs while
// keeping their compact yellowish style from the hub.
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
export function SectionPanel({
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
      eyebrow="PestaÃ±a momentÃ¡nea"
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
      <p>TodavÃ­a no hay contenido publicado en {label}.</p>
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
                  <a
                    className="carousel-card-action"
                    href={card.action.href}
                    {...externalLinkProps(card.action.href)}
                  >
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

export function Footer({ links }: { links: ProfileLink[] }) {
  return (
    <footer className="footer">
      <span>Fernando Luna</span>
      <nav aria-label="Enlaces secundarios">
        {links.map((link) => (
          <a key={link.label} href={link.href} {...externalLinkProps(link.href)}>
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

