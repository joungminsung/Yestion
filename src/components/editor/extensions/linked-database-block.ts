import { Node, mergeAttributes } from "@tiptap/core";

export interface LinkedDatabaseBlockOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    linkedDatabaseBlock: {
      insertLinkedDatabase: (attrs: { databaseId: string; viewId?: string }) => ReturnType;
    };
  }
}

export const LinkedDatabaseBlock = Node.create<LinkedDatabaseBlockOptions>({
  name: "linkedDatabase",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      databaseId: { default: null },
      viewId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="linked-database"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "linked-database",
      }),
    ];
  },

  addCommands() {
    return {
      insertLinkedDatabase:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
