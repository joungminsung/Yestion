import { Node, mergeAttributes } from "@tiptap/core";

export const Equation = Node.create({
  name: "equation",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      blockId: { default: null },
      expression: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-expression") || "",
        renderHTML: (attrs) => ({ "data-expression": attrs.expression }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="equation"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "equation",
        class: "notion-equation",
      }),
      HTMLAttributes["data-expression"] || "",
    ];
  },
});
