import type { AdminContentData } from "../../api";
import { ICON_KEYS } from "../../icons";
import type {
  MomentaryItem,
  MomentaryTab,
  ProfileLink,
  SectionItem,
  SiteSection,
  SiteVisualSettings,
} from "../../types";

const FIRST_ICON = ICON_KEYS[0] ?? "globe";

export function emptyDoc(): AdminContentData {
  return {
    profile: {
      name: "",
      role: "",
      tagline: "",
      location: "",
      email: "",
      avatarAlt: "",
      links: [],
      highlights: [],
    },
    visualSettings: emptyVisualSettings(),
    sections: [],
    sectionItems: [],
    momentaryTabs: [],
    momentaryItems: [],
  };
}

export function emptyVisualSettings(): SiteVisualSettings {
  return {
    sectionOrbitDurationSeconds: 34,
    momentaryOrbitDurationSeconds: 18,
  };
}

export function emptySection(): SiteSection {
  return {
    id: "",
    route: "",
    label: "",
    eyebrow: "",
    title: "",
    description: "",
    iconKey: FIRST_ICON,
    angle: 0,
    order: 0,
    visibleFrom: null,
    visibleUntil: null,
    enabled: true,
  };
}

export function emptySectionItem(sectionId: string): SectionItem {
  return {
    id: "",
    sectionId,
    kind: "card",
    kicker: "",
    title: "",
    meta: null,
    description: "",
    href: null,
    tags: [],
    iconKey: FIRST_ICON,
    order: 0,
    visibleFrom: null,
    visibleUntil: null,
    featured: false,
  };
}

export function emptyTab(): MomentaryTab {
  return {
    id: "",
    label: "",
    iconKey: FIRST_ICON,
    angle: 0,
    order: 0,
    visibleFrom: null,
    visibleUntil: null,
    enabled: true,
  };
}

export function emptyMomentaryItem(tabId: string): MomentaryItem {
  return {
    id: "",
    tabId,
    kind: "note",
    kicker: "",
    title: "",
    meta: null,
    description: "",
    href: null,
    tags: [],
    iconKey: FIRST_ICON,
    order: 0,
    visibleFrom: null,
    visibleUntil: null,
    featured: false,
  };
}

export function emptyLink(): ProfileLink {
  return { label: "", href: "", kind: "web" };
}

// Single rule for optional free-text and timestamp fields: null, "", and
// whitespace-only all collapse to null, and surrounding whitespace is trimmed.
// prepareForSave and every "dirty" check share this so the dirty state answers
// "would saving change the stored content?" instead of flagging a no-op edit
// (e.g. an empty input that the backend already stores as null).
export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function prepareForSave(doc: AdminContentData): AdminContentData {
  const cleanItem = <T extends SectionItem | MomentaryItem>(item: T): T => ({
    ...item,
    order: Math.round(item.order),
    meta: normalizeOptionalText(item.meta),
    href: normalizeOptionalText(item.href),
    visibleFrom: normalizeOptionalText(item.visibleFrom),
    visibleUntil: normalizeOptionalText(item.visibleUntil),
  });

  return {
    profile: doc.profile,
    visualSettings: doc.visualSettings,
    sections: doc.sections.map((section) => ({
      ...section,
      order: Math.round(section.order),
      visibleFrom: normalizeOptionalText(section.visibleFrom),
      visibleUntil: normalizeOptionalText(section.visibleUntil),
    })),
    sectionItems: doc.sectionItems.map(cleanItem),
    momentaryTabs: doc.momentaryTabs.map((tab) => ({
      ...tab,
      order: Math.round(tab.order),
      visibleFrom: normalizeOptionalText(tab.visibleFrom),
      visibleUntil: normalizeOptionalText(tab.visibleUntil),
    })),
    momentaryItems: doc.momentaryItems.map(cleanItem),
  };
}

export function applyVisualOrder<T extends { order: number }>(items: T[]): T[] {
  return items.map((item, index) => ({
    ...item,
    order: (index + 1) * 10,
  }));
}

export function nextCollectionOrder(items: { order: number }[]): number {
  const maxOrder = items.reduce((max, item) => {
    const order = Number.isFinite(item.order) ? Math.round(item.order) : 0;
    return Math.max(max, order);
  }, 0);
  return maxOrder + 10;
}

// --- Dirty-state canonicalization -----------------------------------------
// These mirror prepareForSave's optional-field rule so every "unsaved changes"
// indicator answers the same question: would saving change the stored content?

function itemForDirty<T extends SectionItem | MomentaryItem>(item: T): T {
  return {
    ...item,
    meta: normalizeOptionalText(item.meta),
    href: normalizeOptionalText(item.href),
    visibleFrom: normalizeOptionalText(item.visibleFrom),
    visibleUntil: normalizeOptionalText(item.visibleUntil),
  };
}

export function itemsForDirty<T extends SectionItem | MomentaryItem>(items: T[]): T[] {
  return items.map(itemForDirty);
}

export function sectionForDirty(section: SiteSection): SiteSection {
  return {
    ...section,
    visibleFrom: normalizeOptionalText(section.visibleFrom),
    visibleUntil: normalizeOptionalText(section.visibleUntil),
  };
}

export function tabForDirty(tab: MomentaryTab): MomentaryTab {
  return {
    ...tab,
    visibleFrom: normalizeOptionalText(tab.visibleFrom),
    visibleUntil: normalizeOptionalText(tab.visibleUntil),
  };
}

// Items live in flat arrays whose cross-owner order is just storage order: the
// editor's replaceSectionItems/replaceTabItems rewrite it (moving the edited
// owner's slice to the end) on every item edit. Group by owner with a stable
// sort so that reshuffle is not seen as a change, while a real reorder *within*
// an owner still is — matching the per-entity checks (isSectionDirty/isTabDirty)
// that compare each owner's slice in isolation.
function groupItemsByOwner<T extends SectionItem | MomentaryItem>(
  items: T[],
  ownerId: (item: T) => string,
): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ownerA = ownerId(a.item);
      const ownerB = ownerId(b.item);
      if (ownerA < ownerB) return -1;
      if (ownerA > ownerB) return 1;
      return a.index - b.index; // preserve original order within an owner
    })
    .map((entry) => entry.item);
}

export function docForDirty(doc: AdminContentData) {
  return {
    ...doc,
    sections: doc.sections.map(sectionForDirty),
    sectionItems: groupItemsByOwner(itemsForDirty(doc.sectionItems), (item) => item.sectionId),
    momentaryTabs: doc.momentaryTabs.map(tabForDirty),
    momentaryItems: groupItemsByOwner(itemsForDirty(doc.momentaryItems), (item) => item.tabId),
  };
}

export function hasUnsavedChanges(current: AdminContentData, saved: AdminContentData | null): boolean {
  return saved !== null && JSON.stringify(docForDirty(current)) !== JSON.stringify(docForDirty(saved));
}

export function validateDoc(doc: AdminContentData): string[] {
  const errors: string[] = [];
  const required = (value: string, message: string) => {
    if (!value || !value.trim()) errors.push(message);
  };

  const { profile } = doc;
  required(profile.name, "El perfil necesita un nombre.");
  required(profile.role, "El perfil necesita un rol.");
  required(profile.tagline, "El perfil necesita un tagline.");
  required(profile.location, "El perfil necesita una ubicación.");
  required(profile.email, "El perfil necesita un email.");
  required(profile.avatarAlt, "El perfil necesita un texto alternativo de avatar.");
  profile.links.forEach((link, index) => {
    required(link.label, `Enlace #${index + 1}: falta la etiqueta.`);
    required(link.href, `Enlace #${index + 1}: falta la URL.`);
  });

  if (
    !Number.isFinite(doc.visualSettings.sectionOrbitDurationSeconds) ||
    doc.visualSettings.sectionOrbitDurationSeconds <= 0
  ) {
    errors.push("La duración de la 1.ª órbita debe ser mayor que 0.");
  }
  if (
    !Number.isFinite(doc.visualSettings.momentaryOrbitDurationSeconds) ||
    doc.visualSettings.momentaryOrbitDurationSeconds <= 0
  ) {
    errors.push("La duración de la 2.ª órbita debe ser mayor que 0.");
  }

  const sectionIds = new Set<string>();
  const routes = new Set<string>();
  doc.sections.forEach((section, index) => {
    const label = section.id || `#${index + 1}`;
    required(section.id, `Sección ${label}: falta el id.`);
    required(section.route, `Sección ${label}: falta la ruta.`);
    required(section.label, `Sección ${label}: falta la etiqueta.`);
    required(section.eyebrow, `Sección ${label}: falta el eyebrow.`);
    required(section.title, `Sección ${label}: falta el título.`);
    required(section.description, `Sección ${label}: falta la descripción.`);
    if (section.id) {
      if (sectionIds.has(section.id)) errors.push(`Sección ${label}: id duplicado.`);
      sectionIds.add(section.id);
    }
    if (section.route) {
      if (routes.has(section.route)) errors.push(`Sección ${label}: ruta duplicada.`);
      routes.add(section.route);
    }
  });

  const itemIds = new Set<string>();
  doc.sectionItems.forEach((item, index) => {
    const label = item.id || `#${index + 1}`;
    required(item.id, `Item ${label}: falta el id.`);
    required(item.kind, `Item ${label}: falta el kind.`);
    required(item.kicker, `Item ${label}: falta el kicker.`);
    required(item.title, `Item ${label}: falta el título.`);
    required(item.description, `Item ${label}: falta la descripción.`);
    if (!sectionIds.has(item.sectionId)) {
      errors.push(`Item ${label}: la sección "${item.sectionId}" no existe.`);
    }
    if (item.id) {
      if (itemIds.has(item.id)) errors.push(`Item ${label}: id duplicado.`);
      itemIds.add(item.id);
    }
  });

  const tabIds = new Set<string>();
  doc.momentaryTabs.forEach((tab, index) => {
    const label = tab.id || `#${index + 1}`;
    required(tab.id, `Pestaña ${label}: falta el id.`);
    required(tab.label, `Pestaña ${label}: falta la etiqueta.`);
    if (tab.id) {
      if (tabIds.has(tab.id)) errors.push(`Pestaña ${label}: id duplicado.`);
      tabIds.add(tab.id);
    }
  });

  const tabItemIds = new Set<string>();
  doc.momentaryItems.forEach((item, index) => {
    const label = item.id || `#${index + 1}`;
    required(item.id, `Item de pestaña ${label}: falta el id.`);
    required(item.kind, `Item de pestaña ${label}: falta el kind.`);
    required(item.kicker, `Item de pestaña ${label}: falta el kicker.`);
    required(item.title, `Item de pestaña ${label}: falta el título.`);
    required(item.description, `Item de pestaña ${label}: falta la descripción.`);
    if (!tabIds.has(item.tabId)) {
      errors.push(`Item de pestaña ${label}: la pestaña "${item.tabId}" no existe.`);
    }
    if (item.id) {
      if (tabItemIds.has(item.id)) errors.push(`Item de pestaña ${label}: id duplicado.`);
      tabItemIds.add(item.id);
    }
  });

  return errors;
}
