import { useMemo, type ReactNode } from "react";
import { externalLinkProps } from "../../shared/externalLinks";
import { parseDescriptionBlocks, parseMarkdownInline, type MarkdownInline } from "./descriptionText";

export function RichDescription({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseDescriptionBlocks(text), [text]);
  const classes = ["rich-description", className].filter(Boolean).join(" ");

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className={classes}>
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return <p key={index}>{renderMarkdownInline(block.text)}</p>;
        }

        const ListTag = block.ordered ? "ol" : "ul";
        return (
          <ListTag key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={`${index}-${itemIndex}`}>{renderMarkdownInline(item)}</li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}

function renderMarkdownInline(text: string): ReactNode[] {
  return parseMarkdownInline(text).map((node, index) => renderMarkdownNode(node, index));
}

function renderMarkdownNode(node: MarkdownInline, index: number): ReactNode {
  switch (node.type) {
    case "strong":
      return <strong key={index}>{node.text}</strong>;
    case "emphasis":
      return <em key={index}>{node.text}</em>;
    case "code":
      return <code key={index}>{node.text}</code>;
    case "link":
      return (
        <a key={index} href={node.href} {...externalLinkProps(node.href)}>
          {node.text}
        </a>
      );
    case "text":
    default:
      return node.text;
  }
}
