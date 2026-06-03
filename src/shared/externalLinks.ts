export function externalLinkProps(href: string) {
  if (/^(https?:\/\/|\/\/)/i.test(href.trim())) {
    return { target: "_blank", rel: "noopener noreferrer" };
  }

  return {};
}
