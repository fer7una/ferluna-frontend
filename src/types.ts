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

export type OrbitSlot = "inner" | "outer";

export type SiteSection = {
  id: string;
  route: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  iconKey: string;
  orbit: OrbitSlot;
  angle: number;
  order: number;
  visibleFrom: string | null;
  visibleUntil: string | null;
  enabled: boolean;
};

// Shared presentation fields for any content card, whether it belongs to a
// section or to a momentary tab. The owner reference (sectionId / tabId) is
// added by the concrete item types below.
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
  sections: SiteSection[];
  sectionItems: SectionItem[];
  momentaryTabs: MomentaryTab[];
  momentaryItems: MomentaryItem[];
  revision: number;
};

export type SectionId = string;
