import { Node, mergeAttributes } from "@tiptap/core";

export const DatabaseBlock = Node.create({
  name: "databaseBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      blockId: { default: null },
      databaseId: { default: null },
      viewId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="database-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "database-block",
        class: "notion-database-block",
      }),
      "\uD83D\uDCCA \uB370\uC774\uD130\uBCA0\uC774\uC2A4",
    ];
  },
});
