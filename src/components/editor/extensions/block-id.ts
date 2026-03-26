import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export const BlockId = Extension.create({
  name: "blockId",
  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "bulletList",
          "orderedList",
          "taskList",
          "taskItem",
          "codeBlock",
          "blockquote",
          "horizontalRule",
          "image",
          "table",
          "details",
          "callout",
          "equation",
          "tableOfContents",
          "columnList",
        ],
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-block-id"),
            renderHTML: (attributes) => {
              if (!attributes.blockId) return {};
              return { "data-block-id": attributes.blockId };
            },
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("blockId"),
        appendTransaction: (_, __, newState) => {
          const tr = newState.tr;
          let modified = false;
          newState.doc.descendants((node, pos) => {
            if (
              node.isBlock &&
              node.attrs.blockId === null &&
              node.type.spec.attrs?.blockId !== undefined
            ) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                blockId: generateId(),
              });
              modified = true;
            }
          });
          return modified ? tr : null;
        },
      }),
    ];
  },
});
