import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { SyncedBlockView } from "../synced-block-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    syncedBlock: {
      insertSyncedBlock: (attrs: {
        blockId?: string;
        sourceBlockId?: string;
        sourcePageId?: string;
      }) => ReturnType;
    };
  }
}

export const SyncedBlockNode = Node.create({
  name: "syncedBlock",
  group: "block",
  content: "block+",
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      blockId: { default: null },
      sourceBlockId: { default: null },
      sourcePageId: { default: null },
      synced: { default: true },
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
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SyncedBlockView);
  },

  addCommands() {
    return {
      insertSyncedBlock:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: "syncedBlock",
              attrs,
              content: [{ type: "paragraph" }],
            })
            .run();
        },
    };
  },
});
