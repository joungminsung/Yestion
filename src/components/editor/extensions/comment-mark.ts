import { Mark, mergeAttributes } from "@tiptap/core";

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, string>;
  onCommentClick?: (commentId: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    commentMark: {
      setComment: (attrs: { commentId: string }) => ReturnType;
      unsetComment: (commentId: string) => ReturnType;
    };
  }
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: "comment",
  priority: 900,
  inclusive: false,
  excludes: "",

  addOptions() {
    return {
      HTMLAttributes: {},
      onCommentClick: undefined,
    };
  },

  addAttributes() {
    return {
      commentId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, {
        "data-comment-id": HTMLAttributes.commentId,
        style:
          "background-color: var(--comment-highlight, rgba(255, 212, 0, 0.3)); border-bottom: 2px solid rgba(255, 180, 0, 0.6); cursor: pointer;",
        class: "inline-comment-highlight",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (attrs) =>
        ({ commands }) => {
          return commands.setMark(this.name, attrs);
        },
      unsetComment:
        (commentId) =>
        ({ state, tr, dispatch }) => {
          let found = false;
          state.doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (
                mark.type.name === "comment" &&
                mark.attrs.commentId === commentId
              ) {
                found = true;
                tr.removeMark(pos, pos + node.nodeSize, mark.type);
              }
            });
          });
          if (found && dispatch) dispatch(tr);
          return found;
        },
    };
  },
});
