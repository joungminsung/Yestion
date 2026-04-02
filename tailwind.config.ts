import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--notion-font-family)"],
        mono: ["var(--notion-font-mono)"],
      },
      colors: {
        notion: {
          bg: {
            primary: "var(--bg-primary)",
            secondary: "var(--bg-secondary)",
            tertiary: "var(--bg-tertiary)",
            sidebar: "var(--bg-sidebar)",
            hover: "var(--bg-hover)",
            active: "var(--bg-active)",
          },
          text: {
            primary: "var(--text-primary)",
            secondary: "var(--text-secondary)",
            tertiary: "var(--text-tertiary)",
            link: "var(--text-link)",
            placeholder: "var(--text-placeholder)",
          },
          border: {
            DEFAULT: "var(--border-default)",
            divider: "var(--border-divider)",
          },
        },
      },
      spacing: {
        "sidebar": "var(--sidebar-width)",
        "topbar": "var(--topbar-height)",
      },
      zIndex: {
        "sidebar": "var(--z-sidebar)",
        "topbar": "var(--z-topbar)",
        "modal": "var(--z-modal)",
        "toast": "var(--z-toast)",
        "command-palette": "var(--z-command-palette)",
        "dropdown": "var(--z-dropdown)",
        "tooltip": "var(--z-tooltip)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      maxWidth: {
        "page": "var(--page-max-width)",
      },
    },
  },
  plugins: [],
};

export default config;
