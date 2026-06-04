import { type ReactNode } from "react";
import { isVisibleNow, sortByOrder } from "../../domain/site/selectors";
import { IconByKey } from "../../icons";
import type {
  ContentItem,
  MomentaryTab,
  SectionId,
  SiteData,
  SiteSection,
} from "../../types";
import { contentItemToCardViewModel, type CarouselCard } from "./cards";
import { PORTAL_LABELS } from "./constants";
import { RichDescription } from "./RichDescription";
import { SectionCardOverview } from "./SectionCardOverview";
import { SectionCarousel } from "./SectionCarousel";

export function SectionPanel({
  activeSectionCardId,
  section,
  moment,
  momentConfig,
  onOpenSectionCard,
  open,
  siteData,
  sections,
}: {
  activeSectionCardId: string | null;
  section: SectionId | null;
  moment: string | null;
  momentConfig: MomentaryTab | null;
  onOpenSectionCard: (cardId: string) => void;
  open: boolean;
  siteData: SiteData;
  sections: SiteSection[];
}) {
  const sectionConfig = sections.find((item) => item.id === section) ?? null;

  return (
    <section className={`section-panel ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <div className="section-panel-scroll">
        {section && sectionConfig ? (
          <SectionContent
            activeCardId={activeSectionCardId}
            onOpenCard={onOpenSectionCard}
            section={sectionConfig}
            siteData={siteData}
          />
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
      eyebrow={PORTAL_LABELS.momentaryEyebrow}
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
  activeCardId,
  onOpenCard,
  section,
  siteData,
}: {
  activeCardId: string | null;
  onOpenCard: (cardId: string) => void;
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
        activeCardId={activeCardId}
        activeSection={section.id}
        onOpenCard={onOpenCard}
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
          <RichDescription text={description} />
        </div>
      </header>

      <div className="standard-section-body">{children}</div>
    </article>
  );
}

function SectionBody({
  activeCardId,
  activeSection,
  onOpenCard,
  siteData,
}: {
  activeCardId: string | null;
  activeSection: SectionId;
  onOpenCard: (cardId: string) => void;
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

  return (
    <GenericSectionItems
      activeCardId={activeCardId}
      ariaLabel={activeSection}
      items={sectionItems}
      onOpenCard={onOpenCard}
    />
  );
}

function GenericSectionItems({
  activeCardId,
  ariaLabel,
  items,
  onOpenCard,
}: {
  activeCardId?: string | null;
  ariaLabel: string;
  items: ContentItem[];
  onOpenCard?: (cardId: string) => void;
}) {
  const cards: CarouselCard[] = items.map((item) => {
    const card = contentItemToCardViewModel(item);
    return {
      ...card,
      icon: <IconByKey iconKey={card.iconKey} size={20} />,
    };
  });

  if (activeCardId && cards.some((card) => card.id === activeCardId)) {
    return <SectionCarousel ariaLabel={ariaLabel} cards={cards} initialCardId={activeCardId} />;
  }

  if (onOpenCard) {
    return <SectionCardOverview ariaLabel={ariaLabel} cards={cards} onOpenCard={onOpenCard} />;
  }

  return <SectionCarousel ariaLabel={ariaLabel} cards={cards} />;
}

function EmptySectionState({ label }: { label: string }) {
  return (
    <div className="section-empty-state" role="status">
      <p>Todavía no hay contenido publicado en {label}.</p>
    </div>
  );
}
