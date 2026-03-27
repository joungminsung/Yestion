import { Node, mergeAttributes } from "@tiptap/core";

export interface MentionAttrs {
  type: "user" | "page" | "date";
  id: string;
  label: string;
}

/**
 * Custom inline mention node.
 * Renders as an atom (non-editable chip) with type, id, and label attributes.
 */
export const MentionNode = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      type: { default: "user" },
      id: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-mention]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const mentionType = node.attrs.type as string;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-mention": "",
        "data-mention-type": mentionType,
        class: "notion-mention",
      }),
      `@${node.attrs.label}`,
    ];
  },
});
