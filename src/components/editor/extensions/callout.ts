import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CalloutNodeView } from "../callout-node-view";

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "paragraph+",
  defining: true,

  addAttributes() {
    return {
      blockId: { default: null },
      icon: {
        default: "💡",
        parseHTML: (el) => el.getAttribute("data-icon") || "💡",
        renderHTML: (attrs) => ({ "data-icon": attrs.icon }),
      },
      color: {
        default: "default",
        parseHTML: (el) => el.getAttribute("data-callout-color") || "default",
        renderHTML: (attrs) => ({ "data-callout-color": attrs.color }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "callout",
        class: "notion-callout",
      }),
      ["span", { class: "notion-callout-icon", contenteditable: "false" }, HTMLAttributes["data-icon"] || "💡"],
      ["div", { class: "notion-callout-content" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },
});
