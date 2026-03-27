import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          handlePaste(_view, event) {
            const text = event.clipboardData?.getData("text/plain");
            const html = event.clipboardData?.getData("text/html");

            // If there's HTML, let Tiptap handle it normally
            if (html && html.length > 0) return false;

            // If it's plain text that looks like markdown, convert it
            if (text && looksLikeMarkdown(text)) {
              event.preventDefault();
              const htmlContent = markdownToHtml(text);
              editor.chain().focus().insertContent(htmlContent).run();
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});

function looksLikeMarkdown(text: string): boolean {
  const mdPatterns = [
    /^#{1,3}\s/m, // headings
    /^\s*[-*+]\s/m, // unordered lists
    /^\s*\d+\.\s/m, // ordered lists
    /^\s*[-*_]{3,}\s*$/m, // horizontal rules
    /^\s*>/m, // blockquotes
    /```/m, // code blocks
    /\[.+\]\(.+\)/, // links
    /!\[.*\]\(.+\)/, // images
    /\*\*.+\*\*/, // bold
    /^\s*- \[[ x]\]/m, // task lists
  ];

  return mdPatterns.some((p) => p.test(text));
}

function markdownToHtml(md: string): string {
  let html = md;

  // Code blocks (must be first to avoid inner conversion)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre><code class="language-$1">$2</code></pre>'
  );

  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^[-*_]{3,}\s*$/gm, "<hr>");

  // Task lists
  html = html.replace(
    /^\s*- \[x\] (.+)$/gm,
    '<ul data-type="taskList"><li data-checked="true"><p>$1</p></li></ul>'
  );
  html = html.replace(
    /^\s*- \[ \] (.+)$/gm,
    '<ul data-type="taskList"><li data-checked="false"><p>$1</p></li></ul>'
  );

  // Unordered lists
  html = html.replace(/^\s*[-*+] (.+)$/gm, "<li><p>$1</p></li>");

  // Ordered lists
  html = html.replace(/^\s*\d+\. (.+)$/gm, "<li><p>$1</p></li>");

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote><p>$1</p></blockquote>");

  // Images
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1">'
  );

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Inline formatting
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");

  // Paragraphs (lines that aren't already wrapped)
  html = html.replace(/^(?!<[hluobpai]|<hr|<pre)(.+)$/gm, "<p>$1</p>");

  // Wrap loose <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");

  return html;
}
