import type { ReactNode } from "react";
import type { ContentItem } from "../../types";

export type CarouselAction = {
  label: string;
  href: string;
};

export type CarouselCard = {
  id: string;
  kicker: string;
  title: string;
  meta?: string;
  description: string;
  tags?: string[];
  action?: CarouselAction;
  icon: ReactNode;
};

export type CardViewModel = Omit<CarouselCard, "icon"> & {
  iconKey: string;
};

export function contentItemToCardViewModel(item: ContentItem): CardViewModel {
  return {
    id: item.id,
    kicker: normalizeKicker(item),
    title: item.title,
    meta: item.meta ?? undefined,
    description: item.description,
    tags: item.tags,
    action: item.href
      ? { label: item.kind === "post" ? "Leer" : "Abrir", href: item.href }
      : undefined,
    iconKey: item.iconKey,
  };
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

const DATE_FORMATTER = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value: string) {
  return DATE_FORMATTER.format(new Date(value));
}
