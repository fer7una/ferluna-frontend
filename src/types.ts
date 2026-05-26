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

export type Experience = {
  period: string;
  title: string;
  company: string;
  description: string;
};

export type Education = {
  title: string;
  detail: string;
};

export type Cv = {
  summary: string;
  experience: Experience[];
  skills: string[];
  education: Education[];
};

export type Project = {
  name: string;
  category: string;
  summary: string;
  status: string;
  stack: string[];
  href: string;
  featured: boolean;
};

export type Post = {
  title: string;
  date: string;
  excerpt: string;
  href: string;
};

export type DocLink = {
  title: string;
  description: string;
  href: string;
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

export type SectionItem = {
  id: string;
  sectionId: string;
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

export type SiteData = {
  profile: Profile;
  cv: Cv;
  projects: Project[];
  posts: Post[];
  docs: DocLink[];
  sections: SiteSection[];
  sectionItems: SectionItem[];
  momentaryTabs: MomentaryTab[];
};

export type SectionId = string;
