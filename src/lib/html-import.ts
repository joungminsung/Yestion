/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Converts HTML content to Tiptap-compatible JSON blocks.
 * Works without a DOM parser by using regex-based parsing suitable for server/client.
 */

interface InlineNode {
  type: string;
  text?: string;
  marks?: { type: string; attrs?: Record<string, string> }[];
  attrs?: Record<string, string>;
  content?: InlineNode[];
}

interface BlockNode {
  type: string;
  attrs?: Record<string, any>;
  content?: (BlockNode | InlineNode)[];
}

/**
 * Parse inline HTML formatting into Tiptap inline nodes.
 */
function parseInlineHtml(html: string): InlineNode[] {
  const result: InlineNode[] = [];
  // Strip wrapping tags like <p>, <li>, etc. if passed
  const text = html.replace(/^<[^>]+>|<\/[^>]+>$/g, "");

  const inlineRegex =
    /(<strong>(.+?)<\/strong>)|(<b>(.+?)<\/b>)|(<em>(.+?)<\/em>)|(<i>(.+?)<\/i>)|(<code>(.+?)<\/code>)|(<u>(.+?)<\/u>)|(<s>(.+?)<\/s>)|(<del>(.+?)<\/del>)|(<a\s+href="([^"]*)"[^>]*>(.+?)<\/a>)|(<br\s*\/?>)|([^<]+)|(<[^>]+>)/gi;

  let match: RegExpExecArray | null;
  while ((match = inlineRegex.exec(text)) !== null) {
    if (match[1] || match[3]) {
      // <strong> or <b> → bold
      const inner = match[2] || match[4] || "";
      const children = parseInlineHtml(inner);
      for (const child of children) {
        const marks = [...(child.marks || []), { type: "bold" }];
        result.push({ ...child, marks });
      }
    } else if (match[5] || match[7]) {
      // <em> or <i> → italic
      const inner = match[6] || match[8] || "";
      const children = parseInlineHtml(inner);
      for (const child of children) {
        const marks = [...(child.marks || []), { type: "italic" }];
        result.push({ ...child, marks });
      }
    } else if (match[9]) {
      // <code> → code mark
      result.push({
        type: "text",
        text: match[10] || "",
        marks: [{ type: "code" }],
      });
    } else if (match[11]) {
      // <u> → underline
      const inner = match[12] || "";
      const children = parseInlineHtml(inner);
      for (const child of children) {
        const marks = [...(child.marks || []), { type: "underline" }];
        result.push({ ...child, marks });
      }
    } else if (match[13] || match[15]) {
      // <s> or <del> → strike
      const inner = match[14] || match[16] || "";
      const children = parseInlineHtml(inner);
      for (const child of children) {
        const marks = [...(child.marks || []), { type: "strike" }];
        result.push({ ...child, marks });
      }
    } else if (match[17]) {
      // <a href="..."> → link
      const href = match[18] || "";
      const linkText = match[19] || "";
      const children = parseInlineHtml(linkText);
      for (const child of children) {
        const marks = [...(child.marks || []), { type: "link", attrs: { href } }];
        result.push({ ...child, marks });
      }
    } else if (match[20]) {
      // <br> → hard break
      result.push({ type: "hardBreak" });
    } else if (match[21]) {
      // Plain text
      const t = match[21];
      if (t) {
        result.push({ type: "text", text: t });
      }
    }
    // match[22] = unknown tags, skip silently
  }

  if (result.length === 0 && text.trim()) {
    result.push({ type: "text", text: decodeHtmlEntities(text) });
  }

  return result;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Extract inner content between a tag pair.
 */
function extractTagContent(html: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = html.match(regex);
  return m ? m[1]! : "";
}

/**
 * Split HTML into top-level elements for block-level parsing.
 */
function splitTopLevelElements(html: string): string[] {
  const elements: string[] = [];
  // Match self-closing tags, opening+closing tags, and plain text
  const regex = /(<(?:hr|br|img)[^>]*\/?>)|(<(\w+)[^>]*>[\s\S]*?<\/\3>)|([^<]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const el = (match[0] || "").trim();
    if (el) elements.push(el);
  }

  return elements;
}

/**
 * Parse list items from a <ul> or <ol> block.
 */
function parseListItems(html: string): BlockNode[] {
  const items: BlockNode[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = liRegex.exec(html)) !== null) {
    const content = match[1] || "";
    // Check for nested lists
    const hasNestedUl = /<ul[\s>]/i.test(content);
    const hasNestedOl = /<ol[\s>]/i.test(content);

    // Get the text part (before nested list)
    let textPart = content;
    if (hasNestedUl) textPart = content.split(/<ul[\s>]/i)[0] || "";
    if (hasNestedOl) textPart = content.split(/<ol[\s>]/i)[0] || "";

    const inline = parseInlineHtml(textPart.replace(/<\/?[^>]+>/g, "") || "");
    const listItem: BlockNode = {
      type: "listItem",
      content: [{ type: "paragraph", content: inline.length > 0 ? inline : [{ type: "text", text: " " }] }],
    };

    // Parse nested lists
    if (hasNestedUl) {
      const nestedHtml = extractTagContent(content, "ul");
      const nestedItems = parseListItems(nestedHtml);
      listItem.content!.push({ type: "bulletList", content: nestedItems });
    }
    if (hasNestedOl) {
      const nestedHtml = extractTagContent(content, "ol");
      const nestedItems = parseListItems(nestedHtml);
      listItem.content!.push({ type: "orderedList", content: nestedItems });
    }

    items.push(listItem);
  }

  return items;
}

/**
 * Parse table rows from a <table> block.
 */
function parseTable(html: string): BlockNode {
  const rows: BlockNode[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  let isFirstRow = true;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1] || "";
    const cells: BlockNode[] = [];
    const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const isHeader = cellMatch[1]!.toLowerCase() === "th";
      const cellContent = cellMatch[2] || "";
      const inline = parseInlineHtml(cellContent);

      cells.push({
        type: isHeader || isFirstRow ? "tableHeader" : "tableCell",
        content: [{ type: "paragraph", content: inline.length > 0 ? inline : [{ type: "text", text: " " }] }],
      });
    }

    if (cells.length > 0) {
      rows.push({ type: "tableRow", content: cells });
    }
    isFirstRow = false;
  }

  return { type: "table", content: rows };
}

/**
 * Main entry: converts HTML string to an array of Tiptap-compatible block nodes.
 */
export function htmlToBlocks(html: string): BlockNode[] {
  const blocks: BlockNode[] = [];

  // Clean up the HTML
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "") // Remove comments
    .replace(/<!DOCTYPE[^>]*>/gi, "") // Remove doctype
    .trim();

  // If there's a <body>, extract it
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) cleaned = bodyMatch[1]!;

  // Remove <style> and <script> tags
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.trim();

  const elements = splitTopLevelElements(cleaned);

  for (const el of elements) {
    const tagMatch = el.match(/^<(\w+)/i);
    if (!tagMatch) {
      // Plain text
      const trimmed = el.trim();
      if (trimmed) {
        blocks.push({ type: "paragraph", content: [{ type: "text", text: decodeHtmlEntities(trimmed) }] });
      }
      continue;
    }

    const tag = tagMatch[1]!.toLowerCase();

    switch (tag) {
      case "h1":
        blocks.push({ type: "heading", attrs: { level: 1 }, content: parseInlineHtml(extractTagContent(el, "h1")) });
        break;
      case "h2":
        blocks.push({ type: "heading", attrs: { level: 2 }, content: parseInlineHtml(extractTagContent(el, "h2")) });
        break;
      case "h3":
        blocks.push({ type: "heading", attrs: { level: 3 }, content: parseInlineHtml(extractTagContent(el, "h3")) });
        break;
      case "h4":
        blocks.push({ type: "heading", attrs: { level: 3 }, content: parseInlineHtml(extractTagContent(el, "h4")) });
        break;
      case "h5":
      case "h6":
        blocks.push({ type: "heading", attrs: { level: 3 }, content: parseInlineHtml(extractTagContent(el, tag)) });
        break;
      case "p": {
        const inline = parseInlineHtml(extractTagContent(el, "p"));
        blocks.push({ type: "paragraph", content: inline.length > 0 ? inline : [{ type: "text", text: " " }] });
        break;
      }
      case "blockquote": {
        const bqContent = extractTagContent(el, "blockquote");
        const innerBlocks = htmlToBlocks(bqContent);
        blocks.push({
          type: "blockquote",
          content: innerBlocks.length > 0 ? innerBlocks : [{ type: "paragraph", content: [{ type: "text", text: " " }] }],
        });
        break;
      }
      case "ul": {
        const items = parseListItems(extractTagContent(el, "ul"));
        if (items.length > 0) {
          blocks.push({ type: "bulletList", content: items });
        }
        break;
      }
      case "ol": {
        const items = parseListItems(extractTagContent(el, "ol"));
        if (items.length > 0) {
          blocks.push({ type: "orderedList", content: items });
        }
        break;
      }
      case "pre": {
        const codeContent = extractTagContent(el, "pre");
        // Try to extract language from <code class="language-xxx">
        const langMatch = codeContent.match(/class="language-(\w+)"/i);
        const language = langMatch ? langMatch[1] : null;
        const codeText = extractTagContent(codeContent || el, "code") || codeContent;
        const decoded = decodeHtmlEntities(codeText.replace(/<[^>]+>/g, ""));
        blocks.push({
          type: "codeBlock",
          attrs: { language: language || null },
          content: decoded ? [{ type: "text", text: decoded }] : [],
        });
        break;
      }
      case "hr":
        blocks.push({ type: "horizontalRule" });
        break;
      case "img": {
        const srcMatch = el.match(/src="([^"]*)"/i);
        const altMatch = el.match(/alt="([^"]*)"/i);
        blocks.push({
          type: "image",
          attrs: {
            src: srcMatch ? srcMatch[1] : "",
            alt: altMatch ? altMatch[1] : "",
          },
        });
        break;
      }
      case "table": {
        blocks.push(parseTable(el));
        break;
      }
      case "div":
      case "section":
      case "article":
      case "main":
      case "header":
      case "footer":
      case "nav": {
        // Recurse into container elements
        const innerContent = extractTagContent(el, tag);
        const innerBlocks = htmlToBlocks(innerContent);
        blocks.push(...innerBlocks);
        break;
      }
      default: {
        // Try to extract text content from unknown tags
        const innerText = el.replace(/<[^>]+>/g, "").trim();
        if (innerText) {
          blocks.push({ type: "paragraph", content: [{ type: "text", text: decodeHtmlEntities(innerText) }] });
        }
        break;
      }
    }
  }

  return blocks;
}
