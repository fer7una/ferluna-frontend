export type LinkKind = "github" | "linkedin" | "mail" | "web";

export type ProfileLink = {
  label: string;
  href: string;
  kind: LinkKind;
};

export type Profile = {
  name: string;
  role: string;
  tagline: string;
  location: string;
  email: string;
  avatarAlt: string;
  links: ProfileLink[];
  highlights: string[];
};

export type SiteVisualSettings = {
  sectionOrbitDurationSeconds: number;
  momentaryOrbitDurationSeconds: number;
};

export type SiteSection = {
  id: string;
  route: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  iconKey: string;
  angle: number;
  order: number;
  visibleFrom: string | null;
  visibleUntil: string | null;
  enabled: boolean;
};

export type ContentItem = {
  id: string;
  kind: string;
  kicker: string;
  title: string;
  meta: string | null;
  description: string;
  href: string | null;
  tags: string[];
  iconKey: string;
  order: number;
  visibleFrom: string | null;
  visibleUntil: string | null;
  featured: boolean;
};

export type SectionItem = ContentItem & {
  sectionId: string;
};

export type MomentaryTab = {
  id: string;
  label: string;
  iconKey: string;
  angle: number;
  order: number;
  visibleFrom: string | null;
  visibleUntil: string | null;
  enabled: boolean;
};

export type MomentaryItem = ContentItem & {
  tabId: string;
};

export type SiteData = {
  profile: Profile;
  visualSettings: SiteVisualSettings;
  sections: SiteSection[];
  sectionItems: SectionItem[];
  momentaryTabs: MomentaryTab[];
  momentaryItems: MomentaryItem[];
  revision: number;
};

export type SectionId = string;
