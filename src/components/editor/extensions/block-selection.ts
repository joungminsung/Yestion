import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";
import { Node as PmNode } from "@tiptap/pm/model";

export const BLOCK_SELECTION_KEY = new PluginKey("blockSelection");

export type BlockSelectionState = {
  selectedBlocks: number[];
  anchorBlock: number | null;
};

export const BlockSelection = Extension.create({
  name: "blockSelection",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: BLOCK_SELECTION_KEY,
        state: {
          init(): BlockSelectionState {
            return { selectedBlocks: [], anchorBlock: null };
          },
          apply(tr, prev): BlockSelectionState {
            const meta = tr.getMeta(BLOCK_SELECTION_KEY);
            if (meta !== undefined) return meta;
            if (tr.docChanged && prev.selectedBlocks.length > 0) {
              return { selectedBlocks: [], anchorBlock: null };
            }
            return prev;
          },
        },
        props: {
          decorations(state) {
            const pluginState = BLOCK_SELECTION_KEY.getState(state);
            if (!pluginState || pluginState.selectedBlocks.length === 0)
              return DecorationSet.empty;

            const decorations: Decoration[] = [];
            for (const pos of pluginState.selectedBlocks) {
              const node = state.doc.nodeAt(pos);
              if (node) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: "notion-block-selected",
                  })
                );
              }
            }
            return DecorationSet.create(state.doc, decorations);
          },
          handleKeyDown(view, event) {
            const pluginState = BLOCK_SELECTION_KEY.getState(view.state);
            if (!pluginState || pluginState.selectedBlocks.length === 0)
              return false;

            if (event.key === "Backspace" || event.key === "Delete") {
              event.preventDefault();
              const sorted = [...pluginState.selectedBlocks].sort(
                (a, b) => b - a
              );
              let tr = view.state.tr;
              for (const pos of sorted) {
                const node = tr.doc.nodeAt(pos);
                if (node) {
                  tr = tr.delete(pos, pos + node.nodeSize);
                }
              }
              tr = tr.setMeta(BLOCK_SELECTION_KEY, {
                selectedBlocks: [],
                anchorBlock: null,
              });
              view.dispatch(tr);
              return true;
            }

            if (event.key === "Escape") {
              const tr = view.state.tr.setMeta(BLOCK_SELECTION_KEY, {
                selectedBlocks: [],
                anchorBlock: null,
              });
              view.dispatch(tr);
              return true;
            }

            if (
              !event.metaKey &&
              !event.ctrlKey &&
              !event.altKey &&
              event.key.length === 1
            ) {
              const tr = view.state.tr.setMeta(BLOCK_SELECTION_KEY, {
                selectedBlocks: [],
                anchorBlock: null,
              });
              view.dispatch(tr);
            }

            return false;
          },
          handleClick(view) {
            const pluginState = BLOCK_SELECTION_KEY.getState(view.state);
            if (pluginState && pluginState.selectedBlocks.length > 0) {
              const tr = view.state.tr.setMeta(BLOCK_SELECTION_KEY, {
                selectedBlocks: [],
                anchorBlock: null,
              });
              view.dispatch(tr);
            }
            return false;
          },
        },
      }),
    ];
  },
});

type EditorLike = {
  state: EditorState;
  view: EditorView;
};

/** Select a single block at `pos` (depth-1 offset). */
export function selectBlock(editor: EditorLike, pos: number) {
  const tr = editor.state.tr.setMeta(BLOCK_SELECTION_KEY, {
    selectedBlocks: [pos],
    anchorBlock: pos,
  });
  editor.view.dispatch(tr);
}

/** Select all top-level blocks between fromPos and toPos (inclusive). */
export function selectBlockRange(
  editor: EditorLike,
  fromPos: number,
  toPos: number,
) {
  const positions: number[] = [];
  const minPos = Math.min(fromPos, toPos);
  const maxPos = Math.max(fromPos, toPos);

  editor.state.doc.forEach((_node: PmNode, offset: number) => {
    if (offset >= minPos && offset <= maxPos) {
      positions.push(offset);
    }
  });

  const tr = editor.state.tr.setMeta(BLOCK_SELECTION_KEY, {
    selectedBlocks: positions,
    anchorBlock: fromPos,
  });
  editor.view.dispatch(tr);
}
