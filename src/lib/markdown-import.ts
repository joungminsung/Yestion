/**
 * Converts Markdown content to Tiptap-compatible JSON blocks.
 */

type TiptapMark = { type: string; attrs?: Record<string, unknown> };
type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
};

export function markdownToBlocks(markdown: string): TiptapNode[] {
  const lines = markdown.split("\n");
  const blocks: TiptapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        codeLines.push(lines[i]!);
        i++;
      }
      blocks.push({
        type: "codeBlock",
        attrs: { language: lang || null },
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s(.+)/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        attrs: { level: headingMatch[1]!.length },
        content: parseInline(headingMatch[2]!),
      });
      i++;
      continue;
    }

    // HR
    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Bullet list
    if (/^\s*[-*+]\s/.test(line)) {
      blocks.push({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: parseInline(line.replace(/^\s*[-*+]\s/, "")),
              },
            ],
          },
        ],
      });
      i++;
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s/.test(line)) {
      blocks.push({
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: parseInline(line.replace(/^\s*\d+\.\s/, "")),
              },
            ],
          },
        ],
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      blocks.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: parseInline(line.slice(2)),
          },
        ],
      });
      i++;
      continue;
    }

    // Image
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      blocks.push({
        type: "image",
        attrs: { src: imgMatch[2]!, alt: imgMatch[1]! },
      });
      i++;
      continue;
    }

    // Paragraph (non-empty)
    if (line.trim()) {
      blocks.push({
        type: "paragraph",
        content: parseInline(line),
      });
    }

    i++;
  }

  return blocks;
}

function parseInline(text: string): TiptapNode[] {
  const result: TiptapNode[] = [];
  // Regex to match inline formatting: **bold**, *italic*, `code`, ~~strike~~, [link](url)
  const regex =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\~\~(.+?)\~\~)|(\[([^\]]+)\]\(([^)]+)\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Push any plain text before this match
    if (match.index > lastIndex) {
      result.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // **bold**
      result.push({
        type: "text",
        text: match[2],
        marks: [{ type: "bold" }],
      });
    } else if (match[3]) {
      // *italic*
      result.push({
        type: "text",
        text: match[4],
        marks: [{ type: "italic" }],
      });
    } else if (match[5]) {
      // `code`
      result.push({
        type: "text",
        text: match[6],
        marks: [{ type: "code" }],
      });
    } else if (match[7]) {
      // ~~strike~~
      result.push({
        type: "text",
        text: match[8],
        marks: [{ type: "strike" }],
      });
    } else if (match[9]) {
      // [link](url)
      result.push({
        type: "text",
        text: match[10],
        marks: [{ type: "link", attrs: { href: match[11] } }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    result.push({ type: "text", text: text.slice(lastIndex) });
  }

  // Fallback: if nothing was parsed, return the full text
  if (result.length === 0 && text) {
    result.push({ type: "text", text });
  }

  return result;
}
