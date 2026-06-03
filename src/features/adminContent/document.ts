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

export function prepareForSave(doc: AdminContentData): AdminContentData {
  const cleanItem = <T extends SectionItem | MomentaryItem>(item: T): T => ({
    ...item,
    order: Math.round(item.order),
    meta: item.meta && item.meta.trim() ? item.meta.trim() : null,
    href: item.href && item.href.trim() ? item.href.trim() : null,
  });

  return {
    profile: doc.profile,
    visualSettings: doc.visualSettings,
    sections: doc.sections.map((section) => ({ ...section, order: Math.round(section.order) })),
    sectionItems: doc.sectionItems.map(cleanItem),
    momentaryTabs: doc.momentaryTabs.map((tab) => ({ ...tab, order: Math.round(tab.order) })),
    momentaryItems: doc.momentaryItems.map(cleanItem),
  };
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
    errors.push("La duracion de la 1a orbita debe ser mayor que 0.");
  }
  if (
    !Number.isFinite(doc.visualSettings.momentaryOrbitDurationSeconds) ||
    doc.visualSettings.momentaryOrbitDurationSeconds <= 0
  ) {
    errors.push("La duracion de la 2a orbita debe ser mayor que 0.");
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
