import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AudioNodeView } from "../media/audio-node-view";

export const AudioBlock = Node.create({
  name: "audioBlock",

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
    return [{ tag: 'div[data-type="audio-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, title } = HTMLAttributes;
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "audio-block" }),
      [
        "audio",
        {
          src,
          title,
          controls: "true",
          style: "width: 100%;",
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioNodeView);
  },
});
