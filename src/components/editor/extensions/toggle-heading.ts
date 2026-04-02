import { Node, mergeAttributes } from "@tiptap/core";

export interface ToggleHeadingOptions {
  levels: number[];
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    toggleHeading: {
      setToggleHeading: (attrs: { level: number }) => ReturnType;
    };
  }
}

export const ToggleHeading = Node.create<ToggleHeadingOptions>({
  name: "toggleHeading",
  group: "block",
  content: "inline*",
  defining: true,
  draggable: true,

  addOptions() {
    return { levels: [1, 2, 3] };
  },

  addAttributes() {
    return {
      level: {
        default: 2,
        parseHTML: (el: HTMLElement) => parseInt(el.getAttribute("data-level") || "2"),
        renderHTML: (attrs: Record<string, unknown>) => ({ "data-level": attrs.level }),
      },
      collapsed: {
        default: false,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-collapsed") === "true",
        renderHTML: (attrs: Record<string, unknown>) => ({ "data-collapsed": String(attrs.collapsed) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-heading"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const level = HTMLAttributes["data-level"] || 2;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "toggle-heading",
        class: `notion-toggle-heading notion-toggle-heading-${level}`,
        role: "heading",
        "aria-level": level,
      }),
      [
        "button",
        {
          class: "toggle-heading-trigger",
          contenteditable: "false",
          "aria-label": "토글",
        },
        ["span", { class: "toggle-heading-arrow" }, "\u25B6"],
      ],
      ["span", { class: "toggle-heading-content" }, 0],
    ];
  },

  addCommands() {
    return {
      setToggleHeading:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: "toggleHeading",
            attrs,
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive("toggleHeading")) return false;
        return editor.commands.insertContentAt(
          editor.state.selection.$to.after(),
          { type: "paragraph" }
        );
      },
    };
  },
});
