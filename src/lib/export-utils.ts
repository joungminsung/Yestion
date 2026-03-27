export interface BlockData {
  id?: string;
  type: string;
  content: Record<string, unknown>;
  position?: number;
  children: BlockData[];
}

export function getTextContent(content: Record<string, unknown>): string {
  if (typeof content.text === "string") return content.text;
  if (typeof content.title === "string") return content.title;
  return "";
}

export function blocksToMarkdown(blocks: BlockData[], depth: number = 0): string {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  for (const block of blocks) {
    const text = getTextContent(block.content);

    switch (block.type) {
      case "heading_1":
        lines.push(`# ${text}`);
        break;
      case "heading_2":
        lines.push(`## ${text}`);
        break;
      case "heading_3":
        lines.push(`### ${text}`);
        break;
      case "paragraph":
        lines.push(`${indent}${text}`);
        break;
      case "bulleted_list":
        lines.push(`${indent}- ${text}`);
        break;
      case "numbered_list":
        lines.push(`${indent}1. ${text}`);
        break;
      case "to_do": {
        const checked = block.content.checked ? "x" : " ";
        lines.push(`${indent}- [${checked}] ${text}`);
        break;
      }
      case "toggle":
        lines.push(`${indent}<details><summary>${text}</summary>`);
        break;
      case "quote":
        lines.push(`${indent}> ${text}`);
        break;
      case "callout":
        lines.push(`${indent}> ${block.content.icon ?? ""} ${text}`);
        break;
      case "code":
        lines.push(`\`\`\`${block.content.language ?? ""}\n${text}\n\`\`\``);
        break;
      case "divider":
        lines.push("---");
        break;
      case "image":
        lines.push(`![${text || "image"}](${block.content.url ?? ""})`);
        break;
      default:
        if (text) lines.push(`${indent}${text}`);
        break;
    }

    if (block.children.length > 0) {
      lines.push(blocksToMarkdown(block.children, depth + 1));
    }

    if (block.type === "toggle") {
      lines.push("</details>");
    }
  }

  return lines.join("\n\n");
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function blocksToHtml(blocks: BlockData[], depth: number = 0): string {
  const parts: string[] = [];

  for (const block of blocks) {
    const text = escapeHtml(getTextContent(block.content));
    const childrenHtml = block.children.length > 0 ? blocksToHtml(block.children, depth + 1) : "";

    switch (block.type) {
      case "heading_1":
        parts.push(`<h1>${text}</h1>`);
        break;
      case "heading_2":
        parts.push(`<h2>${text}</h2>`);
        break;
      case "heading_3":
        parts.push(`<h3>${text}</h3>`);
        break;
      case "paragraph":
        parts.push(`<p>${text}</p>`);
        break;
      case "bulleted_list":
        parts.push(`<ul><li>${text}${childrenHtml}</li></ul>`);
        continue;
      case "numbered_list":
        parts.push(`<ol><li>${text}${childrenHtml}</li></ol>`);
        continue;
      case "to_do": {
        const checked = block.content.checked ? " checked" : "";
        parts.push(`<div><input type="checkbox"${checked} disabled /> ${text}</div>`);
        break;
      }
      case "toggle":
        parts.push(`<details><summary>${text}</summary>${childrenHtml}</details>`);
        continue;
      case "quote":
        parts.push(`<blockquote>${text}</blockquote>`);
        break;
      case "callout":
        parts.push(`<div class="callout"><span>${escapeHtml(String(block.content.icon ?? ""))}</span> ${text}</div>`);
        break;
      case "code":
        parts.push(`<pre><code class="language-${escapeHtml(String(block.content.language ?? ""))}">${text}</code></pre>`);
        break;
      case "divider":
        parts.push("<hr />");
        break;
      case "image":
        parts.push(`<img src="${escapeHtml(String(block.content.url ?? ""))}" alt="${text}" />`);
        break;
      default:
        if (text) parts.push(`<p>${text}</p>`);
        break;
    }

    if (childrenHtml) {
      parts.push(childrenHtml);
    }
  }

  return parts.join("\n");
}
