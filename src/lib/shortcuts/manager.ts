export type Shortcut = {
  id: string;
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  context?: string;
  handler: (event: KeyboardEvent) => void;
};

export class ShortcutManager {
  private shortcuts: Map<string, Shortcut> = new Map();
  private currentContext: string = "global";

  register(shortcut: Shortcut) {
    this.shortcuts.set(shortcut.id, shortcut);
  }

  unregister(id: string) {
    this.shortcuts.delete(id);
  }

  setContext(context: string) {
    this.currentContext = context;
  }

  getContext(): string {
    return this.currentContext;
  }

  handleKeyDown(event: KeyboardEvent) {
    const matching: Shortcut[] = [];
    for (const shortcut of Array.from(this.shortcuts.values())) {
      if (!this.matchesEvent(shortcut, event)) continue;
      matching.push(shortcut);
    }
    if (matching.length === 0) return;
    const contextMatch = matching.find((s) => s.context === this.currentContext);
    const globalMatch = matching.find((s) => !s.context);
    const chosen = contextMatch ?? globalMatch;
    if (chosen) {
      event.preventDefault?.();
      chosen.handler(event);
    }
  }

  private matchesEvent(shortcut: Shortcut, event: KeyboardEvent): boolean {
    if (!shortcut.key || !event.key) return false;
    if (shortcut.key.toLowerCase() !== event.key.toLowerCase()) return false;
    if (!!shortcut.meta !== event.metaKey) return false;
    if (!!shortcut.ctrl !== event.ctrlKey) return false;
    if (!!shortcut.shift !== event.shiftKey) return false;
    if (!!shortcut.alt !== event.altKey) return false;
    return true;
  }

  getAll(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }
}

export const shortcutManager = new ShortcutManager();
