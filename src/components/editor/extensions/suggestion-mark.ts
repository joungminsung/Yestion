import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, TextSelection } from "@tiptap/pm/state";

export interface SuggestionMarkOptions {
  HTMLAttributes: Record<string, string>;
  currentUser?: {
    id: string;
    name: string;
  };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestionMark: {
      setSuggestion: (attrs: {
        authorId: string;
        authorName: string;
        action: "insert" | "delete" | "replace";
        originalText?: string;
        createdAt?: string;
      }) => ReturnType;
      unsetSuggestion: () => ReturnType;
      acceptSuggestion: () => ReturnType;
      rejectSuggestion: () => ReturnType;
      toggleSuggestionMode: () => ReturnType;
      setSuggestionMode: (enabled: boolean) => ReturnType;
    };
  }
}

export const SuggestionMark = Mark.create<SuggestionMarkOptions>({
  name: "suggestion",
  priority: 1000,
  inclusive: false,
  excludes: "",

  addOptions() {
    return {
      HTMLAttributes: {},
      currentUser: undefined,
    };
  },

  addStorage() {
    return {
      enabled: false,
    };
  },

  addAttributes() {
    return {
      authorId: { default: null },
      authorName: { default: null },
      action: { default: "insert" }, // "insert" | "delete" | "replace"
      originalText: { default: null },
      createdAt: { default: () => new Date().toISOString() },
      suggestionId: { default: () => `sug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-suggestion]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const action = HTMLAttributes.action || "insert";
    const bgColor =
      action === "insert"
        ? "rgba(0, 180, 80, 0.15)"
        : action === "delete"
          ? "rgba(235, 87, 87, 0.15)"
          : "rgba(255, 180, 0, 0.15)";
    const borderBottom =
      action === "insert"
        ? "2px solid rgba(0, 180, 80, 0.5)"
        : action === "delete"
          ? "2px solid rgba(235, 87, 87, 0.5)"
          : "2px solid rgba(255, 180, 0, 0.5)";
    const textDecoration = action === "delete" ? "line-through" : "none";

    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-suggestion": "",
        "data-action": action,
        style: `background-color: ${bgColor}; border-bottom: ${borderBottom}; text-decoration: ${textDecoration}; cursor: pointer;`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSuggestion:
        (attrs) =>
        ({ commands }) => {
          return commands.setMark(this.name, attrs);
        },
      unsetSuggestion:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      acceptSuggestion:
        () =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          // Find the suggestion mark in the selection
          let found = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            const mark = node.marks.find((m) => m.type.name === "suggestion");
            if (mark) {
              found = true;
              if (mark.attrs.action === "delete") {
                // Accept delete = remove the text
                tr.delete(pos, pos + node.nodeSize);
              } else {
                // Accept insert/replace = remove the mark, keep text
                tr.removeMark(pos, pos + node.nodeSize, mark.type);
              }
            }
          });
          if (found && dispatch) dispatch(tr);
          return found;
        },
      rejectSuggestion:
        () =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          let found = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            const mark = node.marks.find((m) => m.type.name === "suggestion");
            if (mark) {
              found = true;
              if (mark.attrs.action === "insert") {
                // Reject insert = remove the text
                tr.delete(pos, pos + node.nodeSize);
              } else if (mark.attrs.action === "delete") {
                // Reject delete = remove the mark, keep text
                tr.removeMark(pos, pos + node.nodeSize, mark.type);
              } else if (mark.attrs.action === "replace" && mark.attrs.originalText) {
                // Reject replace = restore original text
                tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(mark.attrs.originalText));
              }
            }
          });
          if (found && dispatch) dispatch(tr);
          return found;
        },
      toggleSuggestionMode:
        () =>
        () => {
          this.storage.enabled = !this.storage.enabled;
          return true;
        },
      setSuggestionMode:
        (enabled) =>
        () => {
          this.storage.enabled = enabled;
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const getAttrs = (
      action: "insert" | "delete" | "replace",
      originalText?: string
    ) => ({
      authorId: this.options.currentUser?.id ?? "unknown",
      authorName: this.options.currentUser?.name ?? "Unknown",
      action,
      originalText: originalText ?? null,
      createdAt: new Date().toISOString(),
    });

    return [
      new Plugin({
        props: {
          handleTextInput: (view, from, to, text) => {
            if (!this.storage.enabled) return false;

            const suggestionType = view.state.schema.marks.suggestion;
            if (!suggestionType) return false;

            const originalText = from !== to ? view.state.doc.textBetween(from, to, "\n", "\n") : "";
            const action = from !== to ? "replace" : "insert";
            const mark = suggestionType.create(getAttrs(action, originalText || undefined));
            const tr = view.state.tr.replaceRangeWith(from, to, view.state.schema.text(text, [mark]));
            view.dispatch(tr.scrollIntoView());
            return true;
          },
          handleKeyDown: (view, event) => {
            if (!this.storage.enabled) return false;
            if (event.key !== "Backspace" && event.key !== "Delete") return false;

            const suggestionType = view.state.schema.marks.suggestion;
            if (!suggestionType) return false;

            const { selection } = view.state;
            let from = selection.from;
            let to = selection.to;

            if (selection.empty) {
              if (event.key === "Backspace") {
                if (from <= 1) return false;
                from -= 1;
              } else {
                if (to >= view.state.doc.content.size) return false;
                to += 1;
              }
            }

            const originalText = view.state.doc.textBetween(from, to, "\n", "\n");
            if (!originalText.trim() && originalText.length === 0) return false;

            let hasSuggestion = false;
            view.state.doc.nodesBetween(from, to, (node) => {
              if (node.marks.some((mark) => mark.type.name === "suggestion")) {
                hasSuggestion = true;
                return false;
              }
              return undefined;
            });
            if (hasSuggestion) return false;

            event.preventDefault();
            const tr = view.state.tr.addMark(from, to, suggestionType.create(getAttrs("delete", originalText)));
            tr.setSelection(TextSelection.create(tr.doc, from, from));
            view.dispatch(tr.scrollIntoView());
            return true;
          },
        },
      }),
    ];
  },
});
