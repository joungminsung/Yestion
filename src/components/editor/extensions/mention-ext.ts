import { Extension } from "@tiptap/core";
import { PluginKey, Plugin } from "@tiptap/pm/state";

export const MENTION_KEY = new PluginKey("mentionSuggestion");

export type MentionState = {
  active: boolean;
  query: string;
  from: number;
  to: number;
};

/**
 * ProseMirror plugin that detects `@` triggers and tracks the query,
 * following the same pattern as slash-command-ext.ts.
 */
export const MentionExtension = Extension.create({
  name: "mentionSuggestion",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: MENTION_KEY,
        state: {
          init: (): MentionState => ({
            active: false,
            query: "",
            from: 0,
            to: 0,
          }),
          apply(tr, prev): MentionState {
            const meta = tr.getMeta(MENTION_KEY);
            if (meta) return meta;
            if (!prev.active) return prev;
            try {
              const { from } = tr.selection;
              if (prev.from < 0 || prev.from > tr.doc.content.size || from < prev.from) {
                return { active: false, query: "", from: 0, to: 0 };
              }
              const text = tr.doc.textBetween(prev.from, from, "\n");
              if (!text.startsWith("@")) {
                return { active: false, query: "", from: 0, to: 0 };
              }
              return { active: true, query: text.slice(1), from: prev.from, to: from };
            } catch {
              return { active: false, query: "", from: 0, to: 0 };
            }
          },
        },
        props: {
          handleKeyDown(view, event) {
            if (event.key === "@") {
              const { $from } = view.state.selection;
              const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
              if (textBefore === "" || textBefore.endsWith(" ")) {
                setTimeout(() => {
                  const { from } = view.state.selection;
                  view.dispatch(
                    view.state.tr.setMeta(MENTION_KEY, {
                      active: true,
                      query: "",
                      from: from - 1,
                      to: from,
                    }),
                  );
                });
              }
            }
            if (event.key === "Escape") {
              const pluginState = MENTION_KEY.getState(view.state);
              if (pluginState?.active) {
                view.dispatch(
                  view.state.tr.setMeta(MENTION_KEY, {
                    active: false,
                    query: "",
                    from: 0,
                    to: 0,
                  }),
                );
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
