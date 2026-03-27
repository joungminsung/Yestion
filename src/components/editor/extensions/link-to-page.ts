import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { LinkToPageView } from "../media/link-to-page-view";

export const LinkToPage = Node.create({
  name: "linkToPage",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      blockId: { default: null },
      pageId: { default: null },
      pageTitle: { default: "" },
      pageIcon: { default: "📄" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="link-to-page"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "link-to-page",
        class: "notion-link-to-page",
        "data-page-icon": HTMLAttributes.pageIcon || "📄",
        "data-page-title": HTMLAttributes.pageTitle || "제목 없음",
      }),
      `${HTMLAttributes.pageIcon || "📄"} ${HTMLAttributes.pageTitle || "제목 없음"}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkToPageView);
  },
});
