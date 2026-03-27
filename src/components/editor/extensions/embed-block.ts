import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { EmbedNodeView } from "../media/embed-node-view";

export type EmbedInfo = {
  provider: string;
  embedUrl: string;
};

export function isValidEmbedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function getEmbedInfo(url: string): EmbedInfo | null {
  if (!url) return null;
  if (!isValidEmbedUrl(url)) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");

    // YouTube
    if (host === "youtube.com" || host === "youtu.be") {
      let videoId: string | null = null;
      if (host === "youtu.be") {
        videoId = parsed.pathname.slice(1);
      } else {
        videoId = parsed.searchParams.get("v");
      }
      if (videoId) {
        return {
          provider: "YouTube",
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
        };
      }
    }

    // Vimeo
    if (host === "vimeo.com") {
      const match = parsed.pathname.match(/^\/(\d+)/);
      if (match) {
        return {
          provider: "Vimeo",
          embedUrl: `https://player.vimeo.com/video/${match[1]}`,
        };
      }
    }

    // Figma
    if (host === "figma.com") {
      return {
        provider: "Figma",
        embedUrl: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`,
      };
    }

    // CodePen
    if (host === "codepen.io") {
      const embedUrl = url.replace("/pen/", "/embed/");
      return { provider: "CodePen", embedUrl };
    }

    // CodeSandbox
    if (host === "codesandbox.io") {
      const embedUrl = url.replace("/s/", "/embed/");
      return { provider: "CodeSandbox", embedUrl };
    }

    // Google Maps
    if (host === "google.com" && parsed.pathname.startsWith("/maps")) {
      // If already an embed URL, use as-is
      if (parsed.pathname.includes("/embed")) {
        return { provider: "Google Maps", embedUrl: url };
      }
      // For regular map URLs, use embed API
      return {
        provider: "Google Maps",
        embedUrl: `https://www.google.com/maps/embed?pb=${parsed.searchParams.get("pb") || ""}&q=${encodeURIComponent(url)}`,
      };
    }

    // Twitter / X — show as link card, no iframe
    if (host === "twitter.com" || host === "x.com") {
      return { provider: "Twitter", embedUrl: url };
    }

    // GitHub Gist — show as link
    if (host === "gist.github.com") {
      return { provider: "GitHub Gist", embedUrl: url };
    }

    // General — iframe with URL directly
    return { provider: "일반", embedUrl: url };
  } catch {
    return null;
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (attrs: { url?: string; provider?: string; embedUrl?: string }) => ReturnType;
    };
  }
}

export const EmbedBlock = Node.create({
  name: "embed",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      url: { default: "" },
      provider: { default: "" },
      embedUrl: { default: "" },
      width: { default: "100%" },
      height: { default: 400 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { url, embedUrl, width, height, provider } = HTMLAttributes;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "embed",
        "data-provider": provider,
        style: `width: ${width}`,
      }),
      [
        "iframe",
        {
          src: embedUrl || url,
          width: "100%",
          height: `${height}px`,
          frameborder: "0",
          allowfullscreen: "true",
          allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          style: "border: none; border-radius: 4px;",
        },
      ],
    ];
  },

  addCommands() {
    return {
      setEmbed:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedNodeView);
  },
});
