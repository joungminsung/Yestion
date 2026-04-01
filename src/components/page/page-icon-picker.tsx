"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { X, Search } from "lucide-react";

const EMOJI_CATEGORIES: { name: string; emoji: string[] }[] = [
  {
    name: "Smileys",
    emoji: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔"],
  },
  {
    name: "People",
    emoji: ["👋","🤚","🖐","✋","🖖","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤝"],
  },
  {
    name: "Objects",
    emoji: ["📄","📝","📚","📖","📕","📗","📘","📙","📓","📒","📰","📑","🔖","💼","📁","📂","🗂","📅","📆","📇","📋","📌","📍","📎","🖇","📏","📐","🗃","🗄","🗑"],
  },
  {
    name: "Symbols",
    emoji: ["💡","🔥","⭐","🌟","✨","⚡","💎","🔑","🔒","🔓","🔔","🔕","📌","📍","🎯","🚀","🏆","🎨","🎭","🎪","🎬","🎤","🎧","🎵","🎶","💻","📱","⌨️","🖥","🖨"],
  },
  {
    name: "Nature",
    emoji: ["🌸","🌺","🌻","🌹","🌷","🌼","🌱","🌿","☘️","🍀","🌵","🌴","🌳","🌲","🍃","🍂","🍁","🌾","🌈","☀️","🌤","⛅","🌥","☁️","🌧","⛈","🌩","❄️","🌊","💧"],
  },
  {
    name: "Food",
    emoji: ["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🥑","🥦","🥬","🥒","🌶","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐"],
  },
  {
    name: "Travel",
    emoji: ["🚗","🚕","🚙","🚌","🚎","🏎","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍","🛵","🚲","🛴","🚏","🛣","🛤","🚆","🚇","🚈","🚉","✈️","🛩","🚀","🛸","🚁"],
  },
  {
    name: "Flags",
    emoji: ["🏁","🚩","🎌","🏴","🏳️","🇰🇷","🇺🇸","🇯🇵","🇨🇳","🇬🇧","🇫🇷","🇩🇪","🇪🇸","🇮🇹","🇧🇷","🇷🇺","🇦🇺","🇨🇦","🇮🇳","🇲🇽"],
  },
];

const ALL_EMOJI = EMOJI_CATEGORIES.flatMap((c) => c.emoji);

const EMOJI_KEYWORDS: Record<string, string[]> = {
  "😀": ["smile", "happy", "grin", "face"],
  "😃": ["smile", "happy", "grin"],
  "😄": ["smile", "happy", "grin", "laugh"],
  "😁": ["grin", "smile", "teeth"],
  "😆": ["laugh", "happy"],
  "😅": ["sweat", "smile", "nervous"],
  "🤣": ["laugh", "rofl", "floor"],
  "😂": ["laugh", "cry", "tears", "joy"],
  "🙂": ["smile", "slight"],
  "😉": ["wink"],
  "😊": ["blush", "smile", "shy"],
  "😇": ["angel", "halo", "innocent"],
  "😍": ["love", "heart", "eyes"],
  "🤩": ["star", "eyes", "excited"],
  "😎": ["cool", "sunglasses"],
  "🤓": ["nerd", "glasses"],
  "📄": ["page", "document", "file", "paper"],
  "📝": ["memo", "note", "write", "pencil"],
  "📚": ["books", "library", "study"],
  "📖": ["book", "open", "read"],
  "💡": ["idea", "light", "bulb", "tip"],
  "🔥": ["fire", "hot", "flame", "trending"],
  "⭐": ["star", "favorite", "rating"],
  "🌟": ["star", "glow", "sparkle"],
  "✨": ["sparkle", "magic", "new"],
  "⚡": ["lightning", "fast", "electric"],
  "💎": ["diamond", "gem", "precious"],
  "🔑": ["key", "password", "access"],
  "🔒": ["lock", "secure", "private"],
  "🔓": ["unlock", "open", "public"],
  "🔔": ["bell", "notification", "alert"],
  "📌": ["pin", "location", "mark"],
  "🎯": ["target", "goal", "aim", "bullseye"],
  "🚀": ["rocket", "launch", "fast", "startup"],
  "🏆": ["trophy", "winner", "award"],
  "🎨": ["art", "palette", "design", "color"],
  "💻": ["computer", "laptop", "code", "dev"],
  "📱": ["phone", "mobile", "app"],
  "📅": ["calendar", "date", "schedule"],
  "📁": ["folder", "directory"],
  "📂": ["folder", "open"],
  "📋": ["clipboard", "list", "checklist"],
  "🗑": ["trash", "delete", "bin"],
  "👋": ["wave", "hello", "hi", "bye"],
  "👍": ["thumbs up", "like", "good", "yes"],
  "👎": ["thumbs down", "dislike", "bad", "no"],
  "👏": ["clap", "applause", "bravo"],
  "🤝": ["handshake", "deal", "agreement"],
  "❤️": ["heart", "love", "red"],
  "🌈": ["rainbow", "colorful"],
  "☀️": ["sun", "sunny", "bright"],
  "🌊": ["wave", "ocean", "water"],
  "🍎": ["apple", "fruit", "red"],
  "🎵": ["music", "note", "song"],
  "🎬": ["movie", "film", "action"],
  "🚗": ["car", "drive", "vehicle"],
  "✈️": ["plane", "fly", "travel", "airport"],
  "🏁": ["flag", "finish", "race"],
  "🇰🇷": ["korea", "korean", "flag"],
  "🇺🇸": ["usa", "american", "flag"],
  "🇯🇵": ["japan", "japanese", "flag"],
};
const RECENT_KEY = "notion-recent-icons";
const MAX_RECENT = 16;

function getRecent(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecent(emoji: string) {
  try {
    const recent = getRecent().filter((e) => e !== emoji);
    recent.unshift(emoji);
    if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    // Ignore storage errors (private mode, quota exceeded)
  }
}

type PageIconPickerProps = {
  currentIcon: string | null;
  onSelect: (icon: string | null) => void;
  onClose: () => void;
};

export function PageIconPicker({ currentIcon, onSelect, onClose }: PageIconPickerProps) {
  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(getRecent());
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const filteredEmoji = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return ALL_EMOJI.filter((emoji) => {
      // Check if emoji character contains the query (for pasting emoji)
      if (emoji.toLowerCase().includes(q)) return true;
      // Check keywords
      const keywords = EMOJI_KEYWORDS[emoji];
      if (keywords) {
        return keywords.some((kw) => kw.includes(q));
      }
      return false;
    });
  }, [search]);

  const handleSelect = useCallback(
    (emoji: string) => {
      addRecent(emoji);
      setRecent(getRecent());
      onSelect(emoji);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleRemove = useCallback(() => {
    onSelect(null);
    onClose();
  }, [onSelect, onClose]);

  return (
    <div
      ref={pickerRef}
      className="absolute z-50 rounded-xl shadow-lg border overflow-hidden dropdown-enter"
      style={{
        width: "340px",
        maxHeight: "420px",
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
        boxShadow: "var(--shadow-popup)",
      }}
    >
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Search size={14} style={{ color: "var(--text-tertiary)" }} />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emoji..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        {search && (
          <button onClick={() => setSearch("")} className="hover:opacity-70">
            <X size={14} style={{ color: "var(--text-tertiary)" }} />
          </button>
        )}
      </div>

      {/* Emoji grid */}
      <div className="overflow-y-auto px-2 py-2" style={{ maxHeight: "320px" }}>
        {filteredEmoji ? (
          filteredEmoji.length > 0 ? (
            <div className="grid grid-cols-8 gap-0.5">
              {filteredEmoji.map((emoji, i) => (
                <button
                  key={`search-${i}`}
                  className="w-8 h-8 flex items-center justify-center rounded text-xl hover:bg-notion-bg-hover transition-colors"
                  style={{ backgroundColor: emoji === currentIcon ? "var(--bg-active)" : undefined }}
                  onClick={() => handleSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm py-4" style={{ color: "var(--text-tertiary)" }}>
              No results
            </p>
          )
        ) : (
          <>
            {/* Recent */}
            {recent.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-medium px-1 mb-1" style={{ color: "var(--text-tertiary)" }}>
                  Recent
                </h4>
                <div className="grid grid-cols-8 gap-0.5">
                  {recent.map((emoji, i) => (
                    <button
                      key={`recent-${i}`}
                      className="w-8 h-8 flex items-center justify-center rounded text-xl hover:bg-notion-bg-hover transition-colors"
                      style={{ backgroundColor: emoji === currentIcon ? "var(--bg-active)" : undefined }}
                      onClick={() => handleSelect(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            {EMOJI_CATEGORIES.map((category) => (
              <div key={category.name} className="mb-3">
                <h4 className="text-xs font-medium px-1 mb-1" style={{ color: "var(--text-tertiary)" }}>
                  {category.name}
                </h4>
                <div className="grid grid-cols-8 gap-0.5">
                  {category.emoji.map((emoji, i) => (
                    <button
                      key={`${category.name}-${i}`}
                      className="w-8 h-8 flex items-center justify-center rounded text-xl hover:bg-notion-bg-hover transition-colors"
                      style={{ backgroundColor: emoji === currentIcon ? "var(--bg-active)" : undefined }}
                      onClick={() => handleSelect(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t" style={{ borderColor: "var(--border-default)" }}>
        {currentIcon ? (
          <button
            className="text-xs px-2 py-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--color-red)" }}
            onClick={handleRemove}
          >
            Remove icon
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {ALL_EMOJI.length} emoji
        </span>
      </div>
    </div>
  );
}
