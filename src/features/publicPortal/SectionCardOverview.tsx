import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { CarouselCard } from "./cards";
import { scrollShadowClassNames, useMeasuredScrollShadows } from "./scrollShadows";

export function SectionCardOverview({
  ariaLabel,
  cards,
  onOpenCard,
}: {
  ariaLabel: string;
  cards: CarouselCard[];
  onOpenCard: (cardId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shadows = useMeasuredScrollShadows(ref, true, [ariaLabel, cards.length]);

  const onCardKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
    cardId: string,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onOpenCard(cardId);
  };

  return (
    <section className="section-card-overview" aria-label={`${ariaLabel}: vista general`}>
      <div
        ref={ref}
        className={scrollShadowClassNames("section-card-overview-scroll", shadows)}
      >
        {cards.map((card) => (
          <article
            className="section-overview-card"
            key={card.id}
            onClick={() => onOpenCard(card.id)}
            onKeyDown={(event) => onCardKeyDown(event, card.id)}
            role="button"
            tabIndex={0}
            aria-label={`Abrir ${card.title}`}
          >
            <p className="section-overview-card-kicker">{card.kicker}</p>
            <h3>{card.title}</h3>
          </article>
        ))}
      </div>
    </section>
  );
}
