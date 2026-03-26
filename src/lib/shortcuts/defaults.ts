import type { Shortcut } from "./manager";

export const DEFAULT_SHORTCUTS: Omit<Shortcut, "handler">[] = [
  { id: "command-palette", key: "k", meta: true },
  { id: "search", key: "p", meta: true },
  { id: "toggle-sidebar", key: "\\", meta: true },
  { id: "new-page", key: "n", meta: true },
  { id: "shortcuts-help", key: "/", meta: true },
  { id: "toggle-dark-mode", key: "d", meta: true, shift: true },
  { id: "bold", key: "b", meta: true, context: "editor" },
  { id: "italic", key: "i", meta: true, context: "editor" },
  { id: "underline", key: "u", meta: true, context: "editor" },
  { id: "strikethrough", key: "d", meta: true, shift: true, context: "editor" },
  { id: "code-inline", key: "e", meta: true, context: "editor" },
  { id: "link", key: "k", meta: true, context: "editor" },
  { id: "indent", key: "Tab", context: "editor" },
  { id: "outdent", key: "Tab", shift: true, context: "editor" },
  { id: "undo", key: "z", meta: true, context: "editor" },
  { id: "redo", key: "z", meta: true, shift: true, context: "editor" },
];
