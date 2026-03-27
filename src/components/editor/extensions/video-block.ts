import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { VideoNodeView } from "../media/video-node-view";

export const VideoBlock = Node.create({
  name: "videoBlock",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      title: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="video-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, title } = HTMLAttributes;
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "video-block" }),
      [
        "video",
        {
          src,
          title,
          controls: "true",
          preload: "metadata",
          style: "width: 100%; max-width: 100%; border-radius: 4px;",
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView);
  },
});
