import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const TOUCH_DRAG_KEY = new PluginKey("touchDragHandle");

export const TouchDragHandle = Extension.create({
  name: "touchDragHandle",

  addProseMirrorPlugins() {
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let dragStartPos = -1;
    let dragNode: HTMLElement | null = null;

    return [
      new Plugin({
        key: TOUCH_DRAG_KEY,
        props: {
          handleDOMEvents: {
            touchstart(view, event) {
              const touch = event.touches[0];
              if (!touch) return false;

              const pos = view.posAtCoords({
                left: touch.clientX,
                top: touch.clientY,
              });
              if (!pos) return false;

              longPressTimer = setTimeout(() => {
                // Find the top-level node at this position
                const $pos = view.state.doc.resolve(pos.pos);
                if ($pos.depth < 1) return;

                const nodePos = $pos.before(1);
                const node = view.state.doc.nodeAt(nodePos);
                if (!node) return;

                dragStartPos = nodePos;

                // Visual feedback -- highlight the block
                const dom = view.nodeDOM(nodePos);
                if (dom instanceof HTMLElement) {
                  dragNode = dom;
                  dom.style.opacity = "0.5";
                  dom.style.outline = "2px dashed #2383e2";

                  // Haptic feedback if available
                  if (navigator.vibrate) navigator.vibrate(50);
                }
              }, 500);

              return false;
            },

            touchmove(_view, _event) {
              if (longPressTimer && dragStartPos === -1) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
              }
              return false;
            },

            touchend(view, event) {
              if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
              }

              if (dragStartPos === -1) return false;

              const touch = event.changedTouches[0];
              if (!touch) {
                dragStartPos = -1;
                return false;
              }

              // Find drop target position
              const dropCoords = view.posAtCoords({
                left: touch.clientX,
                top: touch.clientY,
              });

              if (dropCoords) {
                const $drop = view.state.doc.resolve(dropCoords.pos);
                if ($drop.depth >= 1) {
                  const dropPos = $drop.before(1);
                  const sourceNode = view.state.doc.nodeAt(dragStartPos);

                  if (sourceNode && dropPos !== dragStartPos) {
                    const tr = view.state.tr;
                    const slice = view.state.doc.slice(
                      dragStartPos,
                      dragStartPos + sourceNode.nodeSize
                    );
                    tr.delete(dragStartPos, dragStartPos + sourceNode.nodeSize);

                    const adjustedPos = dropPos > dragStartPos
                      ? dropPos - sourceNode.nodeSize
                      : dropPos;

                    tr.insert(Math.max(0, adjustedPos), slice.content);
                    view.dispatch(tr);
                  }
                }
              }

              // Cleanup visual
              if (dragNode) {
                dragNode.style.opacity = "";
                dragNode.style.outline = "";
                dragNode = null;
              }

              dragStartPos = -1;
              return true;
            },
          },
        },
      }),
    ];
  },
});
