import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FileNodeView } from "../media/file-node-view";

export const FileBlock = Node.create({
  name: "fileBlock",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      name: { default: "" },
      size: { default: 0 },
      type: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, name } = HTMLAttributes;
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "file-block" }),
      [
        "a",
        {
          href: src,
          download: name,
          target: "_blank",
          rel: "noopener noreferrer",
        },
        name || "파일",
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileNodeView);
  },
});
