import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
} from "react";
import { externalLinkProps } from "../../shared/externalLinks";
import {
  CAROUSEL_ROTATE_MS,
} from "./constants";
import type { CarouselCard } from "./cards";
import { RichDescription } from "./RichDescription";
import { scrollShadowClassNames, useMeasuredScrollShadows } from "./scrollShadows";

export function SectionCarousel({
  ariaLabel,
  cards,
  initialCardId,
}: {
  ariaLabel: string;
  cards: CarouselCard[];
  initialCardId?: string | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const count = cards.length;
  const cardIds = cards.map((card) => card.id).join("\0");
  const paused = hoverPaused || focusPaused;

  const resumeWhenFocusLeaves = (event: ReactFocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setFocusPaused(false);
  };

  useEffect(() => {
    const nextIndex = initialCardId
      ? cards.findIndex((card) => card.id === initialCardId)
      : -1;
    setActiveIndex(nextIndex >= 0 ? nextIndex : 0);
  }, [ariaLabel, cardIds, initialCardId]);

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
      }, CAROUSEL_ROTATE_MS);
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
              onFocus={() => setFocusPaused(true)}
              onBlur={resumeWhenFocusLeaves}
              onMouseEnter={() => setHoverPaused(true)}
              onMouseLeave={() => setHoverPaused(false)}
            >
              <div className="carousel-card-main">
                <div className="carousel-card-icon">{card.icon}</div>
                <p className="carousel-card-kicker">{card.kicker}</p>
                <h3>{card.title}</h3>
                {card.meta ? <p className="carousel-card-meta">{card.meta}</p> : null}
                <ScrollableDescription text={card.description} />
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

      <div
        className="carousel-controls"
        aria-label={`Controles de ${ariaLabel}`}
        onFocus={() => setFocusPaused(true)}
        onBlur={resumeWhenFocusLeaves}
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
      >
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

function ScrollableDescription({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const shadows = useMeasuredScrollShadows(ref, text.trim().length > 0, [text]);

  if (text.trim().length === 0) {
    return null;
  }

  return (
    <div ref={ref} className={scrollShadowClassNames("carousel-card-description", shadows)}>
      <RichDescription text={text} />
    </div>
  );
}
