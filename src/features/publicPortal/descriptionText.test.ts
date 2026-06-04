import { describe, expect, it } from "vitest";

import { isSafeMarkdownHref, parseDescriptionBlocks, parseMarkdownInline } from "./descriptionText";

describe("description text parsing", () => {
  it("keeps line breaks inside paragraphs and splits blank-line paragraphs", () => {
    expect(parseDescriptionBlocks("Línea 1\nLínea 2\n\nOtro bloque")).toEqual([
      { type: "paragraph", text: "Línea 1\nLínea 2" },
      { type: "paragraph", text: "Otro bloque" },
    ]);
  });

  it("parses unordered and ordered list groups", () => {
    expect(parseDescriptionBlocks("Intro\r\n- Uno\r\n- Dos\r\n\r\n1. Primero\r\n2. Segundo")).toEqual([
      { type: "paragraph", text: "Intro" },
      { type: "list", ordered: false, items: ["Uno", "Dos"] },
      { type: "list", ordered: true, items: ["Primero", "Segundo"] },
    ]);
  });

  it("parses safe inline markdown without using raw HTML", () => {
    expect(parseMarkdownInline("Uso **React**, *Python*, `SQL` y [GitHub](https://github.com).")).toEqual([
      { type: "text", text: "Uso " },
      { type: "strong", text: "React" },
      { type: "text", text: ", " },
      { type: "emphasis", text: "Python" },
      { type: "text", text: ", " },
      { type: "code", text: "SQL" },
      { type: "text", text: " y " },
      { type: "link", text: "GitHub", href: "https://github.com" },
      { type: "text", text: "." },
    ]);
  });

  it("keeps unsafe markdown links as text", () => {
    expect(parseMarkdownInline("[Click](javascript:alert(1))")).toEqual([
      { type: "text", text: "[Click](javascript:alert(1))" },
    ]);
  });

  it("allows http, https, mailto and relative markdown links", () => {
    expect(isSafeMarkdownHref("https://example.com")).toBe(true);
    expect(isSafeMarkdownHref("http://example.com")).toBe(true);
    expect(isSafeMarkdownHref("mailto:hola@example.com")).toBe(true);
    expect(isSafeMarkdownHref("/cv")).toBe(true);
    expect(isSafeMarkdownHref("#contacto")).toBe(true);
    expect(isSafeMarkdownHref("javascript:alert(1)")).toBe(false);
    expect(isSafeMarkdownHref("data:text/html,alert(1)")).toBe(false);
  });
});
