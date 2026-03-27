import { Node, mergeAttributes } from "@tiptap/core";

export const SyncedBlockNode = Node.create({
  name: "syncedBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      blockId: { default: null },
      sourceBlockId: { default: null },
      sourcePageId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="synced-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "synced-block",
        class: "notion-synced-block",
      }),
      "동기화 블록",
    ];
  },
});
