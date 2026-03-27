import { Extension } from "@tiptap/core";
import { PluginKey, Plugin } from "@tiptap/pm/state";

export const SLASH_COMMAND_KEY = new PluginKey("slashCommand");

export type SlashCommandState = {
  active: boolean;
  query: string;
  from: number;
  to: number;
};

export const SlashCommandExtension = Extension.create({
  name: "slashCommand",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: SLASH_COMMAND_KEY,
        state: {
          init: (): SlashCommandState => ({
            active: false,
            query: "",
            from: 0,
            to: 0,
          }),
          apply(tr, prev): SlashCommandState {
            const meta = tr.getMeta(SLASH_COMMAND_KEY);
            if (meta) return meta;
            if (!prev.active) return prev;
            try {
              const { from } = tr.selection;
              if (prev.from < 0 || prev.from > tr.doc.content.size || from < prev.from) {
                return { active: false, query: "", from: 0, to: 0 };
              }
              const text = tr.doc.textBetween(prev.from, from, "\n");
              if (!text.startsWith("/"))
                return { active: false, query: "", from: 0, to: 0 };
              return { active: true, query: text.slice(1), from: prev.from, to: from };
            } catch {
              return { active: false, query: "", from: 0, to: 0 };
            }
          },
        },
        props: {
          handleKeyDown(view, event) {
            if (event.key === "/") {
              const { $from } = view.state.selection;
              const textBefore = $from.parent.textContent.slice(
                0,
                $from.parentOffset,
              );
              if (textBefore === "" || textBefore.endsWith(" ")) {
                setTimeout(() => {
                  const { from } = view.state.selection;
                  view.dispatch(
                    view.state.tr.setMeta(SLASH_COMMAND_KEY, {
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
              const pluginState = SLASH_COMMAND_KEY.getState(view.state);
              if (pluginState?.active) {
                view.dispatch(
                  view.state.tr.setMeta(SLASH_COMMAND_KEY, {
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
