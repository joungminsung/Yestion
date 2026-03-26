import { Node, mergeAttributes } from "@tiptap/core";

export const ColumnList = Node.create({
  name: "columnList",
  group: "block",
  content: "column column+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      blockId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="column-list"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "column-list",
        class: "notion-column-list",
      }),
      0,
    ];
  },
});

export const Column = Node.create({
  name: "column",
  group: "column",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      width: {
        default: 0.5,
        parseHTML: (el) => parseFloat(el.style.width) / 100 || 0.5,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "column",
        class: "notion-column",
        style: `width: ${(HTMLAttributes.width || 0.5) * 100}%`,
      }),
      0,
    ];
  },
});
