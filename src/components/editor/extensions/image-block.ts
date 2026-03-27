import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "../media/image-node-view";

/**
 * Enhanced Image extension with additional attributes for alignment, width,
 * and an "uploading" state that triggers the upload UI when src is empty.
 */
export const ImageBlock = Image.extend({
  name: "image",

  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: "",
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-width"),
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return {
            "data-width": attributes.width,
            style: `width: ${attributes.width}`,
          };
        },
      },
      alignment: {
        default: "center",
        parseHTML: (element) =>
          element.getAttribute("data-alignment") || "center",
        renderHTML: (attributes) => {
          return { "data-alignment": attributes.alignment };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure.notion-image-block img",
      },
      {
        tag: "img",
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
