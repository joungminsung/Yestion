import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, EditorState, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";
import { Node as PmNode, DOMSerializer } from "@tiptap/pm/model";

/**
 * Pure utility: given a sorted list of block offsets, returns those
 * falling within [min(fromPos,toPos), max(fromPos,toPos)].
 */
export function selectBlockRangePositions(
  blockOffsets: number[],
  fromPos: number,
  toPos: number
): number[] {
  const minPos = Math.min(fromPos, toPos);
  const maxPos = Math.max(fromPos, toPos);
  return blockOffsets.filter((offset) => offset >= minPos && offset <= maxPos);
}

export const BLOCK_SELECTION_KEY = new PluginKey("blockSelection");

export type BlockSelectionState = {
  selectedBlocks: number[];
  anchorBlock: number | null;
};

/** Serialize selected blocks to clipboard as text + HTML. */
function copyBlocksToClipboard(view: EditorView, positions: number[]) {
  const fragments: string[] = [];
  const serializer = DOMSerializer.fromSchema(view.state.schema);
  const container = document.createElement("div");

  for (const pos of positions) {
    const node = view.state.doc.nodeAt(pos);
    if (node) {
      fragments.push(node.textContent);
      const domNode = serializer.serializeNode(node);
      container.appendChild(domNode);
    }
  }

  const text = fragments.join("\n");
  const html = container.innerHTML;

  navigator.clipboard
    .write([
      new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ])
    .catch(() => {
      navigator.clipboard.writeText(text).catch(() => {});
    });
}

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

            // Copy selected blocks with full formatting
            if ((event.metaKey || event.ctrlKey) && event.key === "c") {
              event.preventDefault();
              copyBlocksToClipboard(view, pluginState.selectedBlocks);
              return true;
            }

            // Cut selected blocks with full formatting
            if ((event.metaKey || event.ctrlKey) && event.key === "x") {
              event.preventDefault();
              copyBlocksToClipboard(view, pluginState.selectedBlocks);
              const sorted = [...pluginState.selectedBlocks].sort((a, b) => b - a);
              let tr = view.state.tr;
              for (const pos of sorted) {
                const node = tr.doc.nodeAt(pos);
                if (node) tr = tr.delete(pos, pos + node.nodeSize);
              }
              tr = tr.setMeta(BLOCK_SELECTION_KEY, { selectedBlocks: [], anchorBlock: null });
              view.dispatch(tr);
              return true;
            }

            // Select all blocks (Cmd+A when blocks already selected)
            if ((event.metaKey || event.ctrlKey) && event.key === "a") {
              if (pluginState.selectedBlocks.length > 0) {
                event.preventDefault();
                const positions: number[] = [];
                view.state.doc.forEach((_node: PmNode, offset: number) => {
                  positions.push(offset);
                });
                const tr = view.state.tr.setMeta(BLOCK_SELECTION_KEY, {
                  selectedBlocks: positions,
                  anchorBlock: positions[0] ?? null,
                });
                view.dispatch(tr);
                return true;
              }
              return false;
            }

            // Delete block(s) (Cmd+Shift+D)
            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "d") {
              event.preventDefault();
              const positions = pluginState.selectedBlocks.length > 0
                ? [...pluginState.selectedBlocks]
                : (() => {
                    const { from } = view.state.selection;
                    try {
                      const $from = view.state.doc.resolve(from);
                      return [$from.before(1)];
                    } catch { return []; }
                  })();

              if (positions.length === 0) return false;

              const sorted = positions.sort((a, b) => b - a);
              let tr = view.state.tr;
              for (const pos of sorted) {
                const node = tr.doc.nodeAt(pos);
                if (node) tr = tr.delete(pos, pos + node.nodeSize);
              }
              tr = tr.setMeta(BLOCK_SELECTION_KEY, { selectedBlocks: [], anchorBlock: null });
              view.dispatch(tr);
              return true;
            }

            // Duplicate block(s) (Cmd+D)
            if ((event.metaKey || event.ctrlKey) && event.key === "d") {
              event.preventDefault();
              const positions = pluginState.selectedBlocks.length > 0
                ? [...pluginState.selectedBlocks].sort((a, b) => a - b)
                : (() => {
                    // No block selection — duplicate the block at cursor
                    const { from } = view.state.selection;
                    try {
                      const $from = view.state.doc.resolve(from);
                      return [$from.before(1)];
                    } catch { return []; }
                  })();

              if (positions.length === 0) return false;

              let tr = view.state.tr;
              const lastPos = positions[positions.length - 1];
              const lastNode = view.state.doc.nodeAt(lastPos);
              if (!lastNode) return false;
              let insertAt = lastPos + lastNode.nodeSize;

              // Positions are read from the original doc (view.state.doc).
              // Insertions happen after all selected blocks, so original positions remain valid.
              for (const pos of positions) {
                const node = view.state.doc.nodeAt(pos);
                if (node) {
                  tr = tr.insert(insertAt, node.copy(node.content));
                  insertAt += node.nodeSize;
                }
              }

              tr = tr.setMeta(BLOCK_SELECTION_KEY, { selectedBlocks: [], anchorBlock: null });
              view.dispatch(tr);
              return true;
            }

            // Move block up (Cmd+Shift+ArrowUp)
            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "ArrowUp") {
              event.preventDefault();
              const { from } = view.state.selection;
              try {
                const $from = view.state.doc.resolve(from);
                const blockPos = $from.before(1);
                const node = view.state.doc.nodeAt(blockPos);
                if (!node) return true;

                // Find previous sibling using index
                const $block = view.state.doc.resolve(blockPos);
                const indexInParent = $block.index(0);
                if (indexInParent === 0) return true; // already first block

                // Previous block position
                let prevPos = 0;
                let idx = 0;
                view.state.doc.forEach((_n, offset) => {
                  if (idx === indexInParent - 1) prevPos = offset;
                  idx++;
                });

                let tr = view.state.tr;
                tr = tr.delete(blockPos, blockPos + node.nodeSize);
                tr = tr.insert(prevPos, node);
                tr = tr.setSelection(TextSelection.near(tr.doc.resolve(prevPos + 1)));
                view.dispatch(tr);
              } catch { /* ignore */ }
              return true;
            }

            // Move block down (Cmd+Shift+ArrowDown)
            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "ArrowDown") {
              event.preventDefault();
              const { from } = view.state.selection;
              try {
                const $from = view.state.doc.resolve(from);
                const blockPos = $from.before(1);
                const node = view.state.doc.nodeAt(blockPos);
                if (!node) return true;

                const blockEnd = blockPos + node.nodeSize;
                if (blockEnd >= view.state.doc.content.size) return true; // already at bottom

                // Find next block
                const nextNode = view.state.doc.nodeAt(blockEnd);
                if (!nextNode) return true;

                let tr = view.state.tr;
                const nextEnd = blockEnd + nextNode.nodeSize;
                // Delete current block, insert after next
                tr = tr.delete(blockPos, blockPos + node.nodeSize);
                // After deletion, the next block has shifted up by node.nodeSize
                const newInsertPos = nextEnd - node.nodeSize;
                tr = tr.insert(newInsertPos, node);
                // Keep cursor in moved block
                tr = tr.setSelection(TextSelection.near(tr.doc.resolve(newInsertPos + 1)));
                view.dispatch(tr);
              } catch { /* ignore */ }
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

/** Toggle a block in/out of the current selection (for Ctrl/Cmd+click). */
export function toggleBlockInSelection(editor: EditorLike, pos: number) {
  const current = BLOCK_SELECTION_KEY.getState(editor.state);
  const selected = current?.selectedBlocks ?? [];
  const isSelected = selected.includes(pos);
  const newSelected = isSelected
    ? selected.filter((p: number) => p !== pos)
    : [...selected, pos];
  const tr = editor.state.tr.setMeta(BLOCK_SELECTION_KEY, {
    selectedBlocks: newSelected,
    anchorBlock: newSelected.length > 0 ? (isSelected ? newSelected[0] : pos) : null,
  });
  editor.view.dispatch(tr);
}

/** Select all top-level blocks between fromPos and toPos (inclusive, overlap-based). */
export function selectBlockRange(
  editor: EditorLike,
  fromPos: number,
  toPos: number,
) {
  const positions: number[] = [];
  const minPos = Math.min(fromPos, toPos);
  const maxPos = Math.max(fromPos, toPos);

  editor.state.doc.forEach((node: PmNode, offset: number) => {
    const blockEnd = offset + node.nodeSize;
    // Include if block overlaps the range at all
    if (offset <= maxPos && blockEnd > minPos) {
      positions.push(offset);
    }
  });

  const tr = editor.state.tr.setMeta(BLOCK_SELECTION_KEY, {
    selectedBlocks: positions,
    anchorBlock: fromPos,
  });
  editor.view.dispatch(tr);
}
