import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BookmarkNodeView } from "../media/bookmark-node-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    bookmark: {
      setBookmark: (attrs: {
        url?: string;
        title?: string;
        description?: string;
        image?: string;
        favicon?: string;
      }) => ReturnType;
    };
  }
}

export const BookmarkBlock = Node.create({
  name: "bookmark",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
      image: { default: "" },
      favicon: { default: "" },
      siteName: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="bookmark"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "bookmark" }),
      ["a", { href: HTMLAttributes.url, target: "_blank", rel: "noopener noreferrer" }],
    ];
  },

  addCommands() {
    return {
      setBookmark:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkNodeView);
  },
});
