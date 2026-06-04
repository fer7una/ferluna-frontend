import {
  BookOpen,
  BriefcaseBusiness,
  Code2,
  Globe2,
  GraduationCap,
  Layers,
  Newspaper,
  Rocket,
  UserRound,
} from "lucide-react";

export type IconComponent = typeof BriefcaseBusiness;

// Fixed icon catalogue. The admin picks an iconKey from this list; the public
// site resolves it here. Adding a new icon is a code change on purpose.
export const iconMap: Record<string, IconComponent> = {
  book: BookOpen,
  briefcase: BriefcaseBusiness,
  code: Code2,
  globe: Globe2,
  graduation: GraduationCap,
  layers: Layers,
  newspaper: Newspaper,
  rocket: Rocket,
  user: UserRound,
};

export const ICON_KEYS = Object.keys(iconMap);

export function IconByKey({ iconKey, size }: { iconKey: string; size: number }) {
  const Icon = iconMap[iconKey] ?? Globe2;
  return <Icon size={size} aria-hidden="true" />;
}
