import { Node, mergeAttributes } from "@tiptap/core";

export const ToggleBlock = Node.create({
  name: "details",
  group: "block",
  content: "detailsSummary detailsContent",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      blockId: { default: null },
      open: {
        default: true,
        parseHTML: (el) => el.hasAttribute("open"),
      },
    };
  },

  parseHTML() {
    return [{ tag: "details" }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs: Record<string, unknown> = { class: "notion-toggle" };
    if (HTMLAttributes.open) attrs.open = true;
    return [
      "details",
      mergeAttributes(HTMLAttributes, attrs),
      0,
    ];
  },
});

export const DetailsSummary = Node.create({
  name: "detailsSummary",
  group: "detailsSummary",
  content: "inline*",

  parseHTML() {
    return [{ tag: "summary" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "summary",
      mergeAttributes(HTMLAttributes, { class: "notion-toggle-summary" }),
      0,
    ];
  },
});

export const DetailsContent = Node.create({
  name: "detailsContent",
  group: "detailsContent",
  content: "block+",

  parseHTML() {
    return [{ tag: 'div[data-type="details-content"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "details-content",
        class: "notion-toggle-content",
      }),
      0,
    ];
  },
});
