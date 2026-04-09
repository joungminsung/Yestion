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
  const normalized = markdown.replace(/\r\n?/g, "\n").trimEnd();
  if (!normalized.trim()) {
    return [];
  }

  const lines = normalized.split("\n");
  const blocks: TiptapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (isCodeFence(line)) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !isCodeFence(lines[i] ?? "")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      if (i < lines.length && isCodeFence(lines[i] ?? "")) {
        i++;
      }
      blocks.push({
        type: "codeBlock",
        attrs: { language: lang || null },
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        attrs: { level: headingMatch[1]!.length },
        content: parseInline(headingMatch[2]!.trim()),
      });
      i++;
      continue;
    }

    if (isHorizontalRule(line)) {
      blocks.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    const taskMatch = line.match(/^\s*-\s\[( |x|X)\]\s+(.+)/);
    if (taskMatch) {
      const items: TiptapNode[] = [];
      while (i < lines.length) {
        const current = lines[i] ?? "";
        const currentMatch = current.match(/^\s*-\s\[( |x|X)\]\s+(.+)/);
        if (!currentMatch) {
          break;
        }
        items.push({
          type: "taskItem",
          attrs: { checked: currentMatch[1]!.toLowerCase() === "x" },
          content: [
            {
              type: "paragraph",
              content: parseInline(currentMatch[2]!.trim()),
            },
          ],
        });
        i++;
      }
      blocks.push({ type: "taskList", content: items });
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*+]\s+(.+)/);
    if (bulletMatch) {
      const items: TiptapNode[] = [];
      while (i < lines.length) {
        const current = lines[i] ?? "";
        if (/^\s*-\s\[( |x|X)\]\s+(.+)/.test(current)) {
          break;
        }
        const currentMatch = current.match(/^\s*[-*+]\s+(.+)/);
        if (!currentMatch) {
          break;
        }
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: parseInline(currentMatch[1]!.trim()),
            },
          ],
        });
        i++;
      }
      blocks.push({ type: "bulletList", content: items });
      continue;
    }

    const orderedMatch = line.match(/^\s*(\d+)\.\s+(.+)/);
    if (orderedMatch) {
      const items: TiptapNode[] = [];
      while (i < lines.length) {
        const current = lines[i] ?? "";
        const currentMatch = current.match(/^\s*(\d+)\.\s+(.+)/);
        if (!currentMatch) {
          break;
        }
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: parseInline(currentMatch[2]!.trim()),
            },
          ],
        });
        i++;
      }
      blocks.push({ type: "orderedList", content: items });
      continue;
    }

    if (isBlockquote(line)) {
      const quoteParagraphs: TiptapNode[] = [];
      while (i < lines.length && isBlockquote(lines[i] ?? "")) {
        const quoteText = (lines[i] ?? "").replace(/^>\s?/, "").trim();
        if (quoteText) {
          quoteParagraphs.push({
            type: "paragraph",
            content: parseInline(quoteText),
          });
        }
        i++;
      }
      if (quoteParagraphs.length > 0) {
        blocks.push({ type: "blockquote", content: quoteParagraphs });
      }
      continue;
    }

    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      blocks.push({
        type: "image",
        attrs: { src: imgMatch[2]!, alt: imgMatch[1]! },
      });
      i++;
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const current = lines[i] ?? "";
      const currentTrimmed = current.trim();
      if (!currentTrimmed || startsNewBlock(current)) {
        break;
      }
      paragraphLines.push(currentTrimmed);
      i++;
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: "paragraph",
        content: parseInline(paragraphLines.join(" ")),
      });
      continue;
    }

    i++;
  }

  return blocks;
}

function isCodeFence(line: string) {
  return /^```/.test(line.trim());
}

function isHorizontalRule(line: string) {
  return /^[-*_]{3,}\s*$/.test(line.trim());
}

function isBlockquote(line: string) {
  return /^>\s?/.test(line.trimStart());
}

function startsNewBlock(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }

  return (
    isCodeFence(line) ||
    /^(#{1,3})\s+/.test(trimmed) ||
    isHorizontalRule(line) ||
    /^\s*-\s\[( |x|X)\]\s+/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    isBlockquote(line) ||
    /^!\[([^\]]*)\]\(([^)]+)\)/.test(trimmed)
  );
}

function parseInline(text: string): TiptapNode[] {
  const result: TiptapNode[] = [];
  const regex =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\~\~(.+?)\~\~)|(\[([^\]]+)\]\(([^)]+)\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      result.push({
        type: "text",
        text: match[2],
        marks: [{ type: "bold" }],
      });
    } else if (match[3]) {
      result.push({
        type: "text",
        text: match[4],
        marks: [{ type: "italic" }],
      });
    } else if (match[5]) {
      result.push({
        type: "text",
        text: match[6],
        marks: [{ type: "code" }],
      });
    } else if (match[7]) {
      result.push({
        type: "text",
        text: match[8],
        marks: [{ type: "strike" }],
      });
    } else if (match[9]) {
      result.push({
        type: "text",
        text: match[10],
        marks: [{ type: "link", attrs: { href: match[11] } }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ type: "text", text: text.slice(lastIndex) });
  }

  if (result.length === 0 && text) {
    result.push({ type: "text", text });
  }

  return result;
}
