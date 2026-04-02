import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const FOCUS_MODE_KEY = new PluginKey("focusMode");

export const FocusMode = Extension.create({
  name: "focusMode",

  addStorage() {
    return { enabled: false };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-f": () => {
        const storage = (this.editor.storage as unknown as Record<string, { enabled: boolean }>).focusMode;
        if (storage) {
          storage.enabled = !storage.enabled;
          this.editor.view.dispatch(this.editor.state.tr.setMeta(FOCUS_MODE_KEY, true));
        }
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const extensionStorage = this.storage as { enabled: boolean };

    return [
      new Plugin({
        key: FOCUS_MODE_KEY,
        props: {
          decorations(state) {
            if (!extensionStorage.enabled) {
              return DecorationSet.empty;
            }

            const { $from } = state.selection;
            const depth = $from.depth;
            let activePos = -1;
            let activeEnd = -1;

            if (depth >= 1) {
              const resolved = state.doc.resolve($from.before(1));
              activePos = resolved.pos;
              const node = state.doc.nodeAt(activePos);
              activeEnd = node ? activePos + node.nodeSize : activePos;
            }

            const decorations: Decoration[] = [];
            state.doc.forEach((node, pos) => {
              if (pos !== activePos) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: "focus-mode-dimmed",
                  })
                );
              } else {
                decorations.push(
                  Decoration.node(pos, activeEnd, {
                    class: "focus-mode-active",
                  })
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
