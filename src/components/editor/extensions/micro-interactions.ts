import { Extension } from "@tiptap/core";

export const MicroInteractions = Extension.create({
  name: "microInteractions",

  addKeyboardShortcuts() {
    return {
      // 7.6 Cmd+Enter: insert new block below current
      "Mod-Enter": () => {
        const { $to } = this.editor.state.selection;
        const endOfBlock = $to.end();
        return this.editor
          .chain()
          .focus()
          .insertContentAt(endOfBlock + 1, { type: "paragraph" })
          .focus(endOfBlock + 2)
          .run();
      },

      // 7.7 Shift+Enter: soft break (line break within block)
      "Shift-Enter": () => {
        return this.editor.chain().focus().setHardBreak().run();
      },

      // 7.11 Cmd+Shift+K: remove link
      "Mod-Shift-k": () => {
        if (this.editor.isActive("link")) {
          return this.editor.chain().focus().unsetLink().run();
        }
        return false;
      },

      // 7.12 Cmd+Backspace: delete to start of block
      "Mod-Backspace": () => {
        return this.editor
          .chain()
          .focus()
          .deleteRange({
            from: this.editor.state.selection.$from.start(),
            to: this.editor.state.selection.from,
          })
          .run();
      },

      // 1.24 Cmd+Shift+Up: move block up
      "Mod-Shift-ArrowUp": () => {
        try {
          const { $from } = this.editor.state.selection;
          const blockStart = $from.before(1);
          if (blockStart <= 0) return false;
          const prevBlockEnd = blockStart - 1;
          const prevBlockStart = this.editor.state.doc
            .resolve(prevBlockEnd)
            .before(1);

          const currentNode = this.editor.state.doc.nodeAt(blockStart);
          const prevNode = this.editor.state.doc.nodeAt(prevBlockStart);
          if (!currentNode || !prevNode) return false;

          let tr = this.editor.state.tr;
          const currentJSON = currentNode.toJSON();
          tr = tr.delete(blockStart, blockStart + currentNode.nodeSize);
          tr = tr.insert(
            prevBlockStart,
            this.editor.state.schema.nodeFromJSON(currentJSON)
          );
          this.editor.view.dispatch(tr);
          return true;
        } catch {
          return false;
        }
      },

      // 1.24 Cmd+Shift+Down: move block down
      "Mod-Shift-ArrowDown": () => {
        try {
          const { $from } = this.editor.state.selection;
          const blockStart = $from.before(1);
          const currentNode = this.editor.state.doc.nodeAt(blockStart);
          if (!currentNode) return false;
          const blockEnd = blockStart + currentNode.nodeSize;
          if (blockEnd >= this.editor.state.doc.content.size) return false;

          const nextNode = this.editor.state.doc.nodeAt(blockEnd);
          if (!nextNode) return false;

          let tr = this.editor.state.tr;
          const currentJSON = currentNode.toJSON();
          tr = tr.delete(blockStart, blockEnd);
          const insertPos = blockStart + nextNode.nodeSize;
          tr = tr.insert(
            Math.min(insertPos, tr.doc.content.size),
            this.editor.state.schema.nodeFromJSON(currentJSON)
          );
          this.editor.view.dispatch(tr);
          return true;
        } catch {
          return false;
        }
      },

      // Cmd+D: duplicate block
      "Mod-d": () => {
        const { $from } = this.editor.state.selection;
        const blockStart = $from.before(1);
        const node = this.editor.state.doc.nodeAt(blockStart);
        if (!node) return false;
        this.editor.chain()
          .focus()
          .insertContentAt(blockStart + node.nodeSize, node.toJSON())
          .run();
        return true;
      },
    };
  },
});
