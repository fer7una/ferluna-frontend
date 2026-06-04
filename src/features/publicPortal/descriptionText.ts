export type DescriptionBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

export type MarkdownInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "emphasis"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

const ORDERED_LIST_ITEM = /^\s*\d+[.)]\s+(.+?)\s*$/;
const UNORDERED_LIST_ITEM = /^\s*[-*]\s+(.+?)\s*$/;
const MARKDOWN_INLINE =
  /(\[([^\]\n]+)\]\(([^)\s]+)\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_)/g;

export function parseDescriptionBlocks(text: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let paragraphLines: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  text.replace(/\r\n?/g, "\n").split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const ordered = line.match(ORDERED_LIST_ITEM);
    const unordered = line.match(UNORDERED_LIST_ITEM);
    const listMatch = ordered ?? unordered;

    if (listMatch) {
      flushParagraph();
      const nextOrdered = Boolean(ordered);
      if (list && list.ordered !== nextOrdered) {
        flushList();
      }
      if (!list) {
        list = { ordered: nextOrdered, items: [] };
      }
      list.items.push(listMatch[1]);
      return;
    }

    flushList();
    paragraphLines.push(trimmed);
  });

  flushParagraph();
  flushList();

  return blocks;
}

export function parseMarkdownInline(text: string): MarkdownInline[] {
  const nodes: MarkdownInline[] = [];
  let cursor = 0;
  const pushText = (value: string) => {
    if (!value) return;
    const previous = nodes[nodes.length - 1];
    if (previous?.type === "text") {
      previous.text += value;
      return;
    }
    nodes.push({ type: "text", text: value });
  };

  for (const match of text.matchAll(MARKDOWN_INLINE)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      pushText(text.slice(cursor, index));
    }

    const [raw, , linkText, href, code, strongStar, strongUnderscore, emphasisStar, emphasisUnderscore] = match;
    const linkHref = href?.trim();
    if (linkText && linkHref) {
      if (isSafeMarkdownHref(linkHref)) {
        nodes.push({ type: "link", text: linkText, href: linkHref });
      } else {
        pushText(raw);
      }
    } else if (code) {
      nodes.push({ type: "code", text: code });
    } else if (strongStar || strongUnderscore) {
      nodes.push({ type: "strong", text: strongStar ?? strongUnderscore });
    } else if (emphasisStar || emphasisUnderscore) {
      nodes.push({ type: "emphasis", text: emphasisStar ?? emphasisUnderscore });
    } else {
      pushText(raw);
    }

    cursor = index + raw.length;
  }

  if (cursor < text.length) {
    pushText(text.slice(cursor));
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text }];
}

export function isSafeMarkdownHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || /[\u0000-\u001f\u007f\s<>"']/u.test(trimmed)) {
    return false;
  }

  if (trimmed.startsWith("//")) {
    return true;
  }

  const protocol = trimmed.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (protocol) {
    return protocol === "http" || protocol === "https" || protocol === "mailto";
  }

  return true;
}
