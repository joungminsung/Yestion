import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TocNodeView } from "../media/toc-node-view";

export const TableOfContents = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      blockId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toc"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "toc",
        class: "notion-toc",
      }),
      "목차",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TocNodeView);
  },
});
