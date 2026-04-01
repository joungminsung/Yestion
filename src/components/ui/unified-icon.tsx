"use client";

import { memo } from "react";
import type { LucideProps } from "lucide-react";
import {
  FileText, Star, Lock, Unlock, Trash2, Copy, Upload, Download,
  Clock, BarChart3, Bell, Eye, ArrowLeftRight, Search, Settings,
  Plus, ChevronRight, ChevronDown, GripVertical, Palette, Link,
  MessageSquare, Sparkles, List, ListOrdered, ListChecks, Quote,
  Code, Type, Heading1, Heading2, Heading3, Lightbulb, Image,
  Table, Play, Bookmark, Film, Music, Paperclip, Database,
  X, Check, AlertCircle, Info, HelpCircle, Home, User, Users,
  Calendar, Folder, FolderOpen, Edit, ExternalLink, MoreHorizontal,
  Scissors, Clipboard, ClipboardPaste, MoveUp, MoveDown,
} from "lucide-react";
import type { ComponentType } from "react";

const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  FileText, Star, Lock, Unlock, Trash2, Copy, Upload, Download,
  Clock, BarChart3, Bell, Eye, ArrowLeftRight, Search, Settings,
  Plus, ChevronRight, ChevronDown, GripVertical, Palette, Link,
  MessageSquare, Sparkles, List, ListOrdered, ListChecks, Quote,
  Code, Type, Heading1, Heading2, Heading3, Lightbulb, Image,
  Table, Play, Bookmark, Film, Music, Paperclip, Database,
  X, Check, AlertCircle, Info, HelpCircle, Home, User, Users,
  Calendar, Folder, FolderOpen, Edit, ExternalLink, MoreHorizontal,
  Scissors, Clipboard, ClipboardPaste, MoveUp, MoveDown,
};

const SIZE_MAP = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 32,
} as const;

const ICON_COLORS: Record<string, string> = {
  default: "inherit",
  gray: "var(--color-gray)",
  brown: "var(--color-brown)",
  orange: "var(--color-orange)",
  yellow: "var(--color-yellow)",
  green: "var(--color-green)",
  blue: "var(--color-blue)",
  purple: "var(--color-purple)",
  pink: "var(--color-pink)",
  red: "var(--color-red)",
};

export type UnifiedIconData = {
  type: "emoji" | "lucide" | "custom";
  value: string;
  color?: string;
};

type UnifiedIconProps = {
  icon: UnifiedIconData;
  size?: keyof typeof SIZE_MAP;
  className?: string;
};

/**
 * Renders an emoji character, a lucide-react icon, or a custom image URL.
 * Use throughout the app for consistent icon rendering.
 */
export const UnifiedIcon = memo(function UnifiedIcon({
  icon,
  size = "md",
  className = "",
}: UnifiedIconProps) {
  const px = SIZE_MAP[size];

  if (icon.type === "emoji") {
    return (
      <span
        className={className}
        style={{ fontSize: `${px}px`, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", width: `${px}px`, height: `${px}px` }}
        role="img"
        aria-label={icon.value}
      >
        {icon.value}
      </span>
    );
  }

  if (icon.type === "lucide") {
    const IconComponent = ICON_MAP[icon.value];
    if (!IconComponent) {
      // Fallback to emoji if icon name is invalid
      return (
        <span className={className} style={{ fontSize: `${px}px`, width: `${px}px`, height: `${px}px`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          ?
        </span>
      );
    }
    const color = icon.color ? ICON_COLORS[icon.color] ?? icon.color : "currentColor";
    return <IconComponent size={px} color={color} className={className} />;
  }

  if (icon.type === "custom") {
    return (
      <img
        src={icon.value}
        alt="custom icon"
        className={`rounded ${className}`}
        style={{ width: `${px}px`, height: `${px}px`, objectFit: "cover" }}
      />
    );
  }

  return null;
});

/** Shorthand: render an emoji icon */
export function EmojiIcon({ value, size = "md", className }: { value: string; size?: keyof typeof SIZE_MAP; className?: string }) {
  return <UnifiedIcon icon={{ type: "emoji", value }} size={size} className={className} />;
}

/** Shorthand: render a lucide icon by name */
export function LucideIcon({ name, size = "md", color, className }: { name: string; size?: keyof typeof SIZE_MAP; color?: string; className?: string }) {
  return <UnifiedIcon icon={{ type: "lucide", value: name, color }} size={size} className={className} />;
}
