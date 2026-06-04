import { Github, Globe2, Linkedin, Mail } from "lucide-react";
import { externalLinkProps } from "../../shared/externalLinks";
import type { MoonPhaseFavicon } from "../../useMoonPhaseFavicon";
import type { ProfileLink } from "../../types";
import { PORTAL_LABELS } from "./constants";

export function Header({
  links,
  brandIcon,
  onHome,
}: {
  links: ProfileLink[];
  brandIcon: MoonPhaseFavicon;
  onHome: () => void;
}) {
  return (
    <header className="topbar">
      <a
        className="brand-mark"
        href="/"
        onClick={(event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            event.shiftKey
          ) {
            return;
          }

          event.preventDefault();
          onHome();
        }}
        aria-label={PORTAL_LABELS.brandHome}
      >
        <img src={brandIcon.href} alt="" title={brandIcon.label} />
        <span>Fernando Luna</span>
      </a>

      <nav className="top-links" aria-label="Enlaces de marca">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            title={link.label}
            aria-label={link.label}
            {...externalLinkProps(link.href)}
          >
            <LinkIcon kind={link.kind} />
          </a>
        ))}
      </nav>
    </header>
  );
}

function LinkIcon({ kind }: { kind: ProfileLink["kind"] }) {
  const iconProps = { size: 18, "aria-hidden": true };

  if (kind === "github") {
    return <Github {...iconProps} />;
  }

  if (kind === "linkedin") {
    return <Linkedin {...iconProps} />;
  }

  if (kind === "mail") {
    return <Mail {...iconProps} />;
  }

  return <Globe2 {...iconProps} />;
}
