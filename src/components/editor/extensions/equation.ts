import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { EquationView } from "../media/equation-view";

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

  addNodeView() {
    return ReactNodeViewRenderer(EquationView);
  },
});
