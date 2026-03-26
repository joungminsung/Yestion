# SP-1: Project Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Notion clone with Next.js 14, PostgreSQL, authentication, base layout (pixel-identical to Notion), keyboard shortcuts, toast system, i18n, and settings page structure.

**Architecture:** Next.js 14 App Router monolith with tRPC for type-safe API, Prisma ORM for PostgreSQL, NextAuth.js v5 for credentials-based auth, Zustand for client state, Tailwind CSS + CSS Modules for pixel-perfect Notion styling, next-intl for i18n.

**Tech Stack:** Next.js 14, TypeScript (strict), Tailwind CSS, CSS Modules, Zustand, PostgreSQL 16, Prisma, tRPC v11, NextAuth.js v5, next-intl, pnpm

---

## File Structure

```
notion-web/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── .env.local                          # DB, auth secrets
├── .gitignore
├── prisma/
│   └── schema.prisma                   # User, Workspace, WorkspaceMember, Session, Favorite
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout: providers, fonts, global styles
│   │   ├── globals.css                 # Tailwind imports + Notion design tokens
│   │   ├── (auth)/
│   │   │   ├── layout.tsx              # Auth pages layout (centered card)
│   │   │   ├── login/
│   │   │   │   └── page.tsx            # Login page
│   │   │   └── signup/
│   │   │       └── page.tsx            # Signup page
│   │   ├── (main)/
│   │   │   ├── layout.tsx              # Main layout: sidebar + content area
│   │   │   └── [workspaceId]/
│   │   │       ├── page.tsx            # Workspace home (redirect to first page)
│   │   │       ├── settings/
│   │   │       │   └── page.tsx        # Settings page
│   │   │       └── [pageId]/
│   │   │           └── page.tsx        # Page view (placeholder for SP-2)
│   │   └── api/
│   │       └── trpc/
│   │           └── [trpc]/
│   │               └── route.ts        # tRPC HTTP handler
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx              # Base button component
│   │   │   ├── input.tsx               # Base input component
│   │   │   ├── modal.tsx               # Modal/dialog component
│   │   │   ├── toast.tsx               # Toast notification component
│   │   │   ├── toast-container.tsx     # Toast container + positioning
│   │   │   └── dropdown-menu.tsx       # Dropdown menu component
│   │   ├── layout/
│   │   │   ├── sidebar.tsx             # Main sidebar
│   │   │   ├── sidebar-item.tsx        # Sidebar page tree item
│   │   │   ├── sidebar-resizer.tsx     # Sidebar drag-to-resize handle
│   │   │   ├── topbar.tsx              # Top bar (breadcrumb + actions)
│   │   │   └── command-palette.tsx     # Cmd+K command palette
│   │   ├── auth/
│   │   │   ├── login-form.tsx          # Login form component
│   │   │   └── signup-form.tsx         # Signup form component
│   │   └── settings/
│   │       ├── settings-layout.tsx     # Settings sidebar + content
│   │       ├── account-settings.tsx    # Profile, email, password, language, theme
│   │       └── workspace-settings.tsx  # Workspace name, icon, members
│   ├── server/
│   │   ├── db/
│   │   │   └── client.ts              # Prisma client singleton
│   │   ├── auth/
│   │   │   ├── config.ts              # NextAuth config
│   │   │   └── session.ts             # Session helpers (getSession, requireAuth)
│   │   ├── trpc/
│   │   │   ├── init.ts                # tRPC initialization + context
│   │   │   ├── router.ts              # Root router (merges all sub-routers)
│   │   │   └── client.ts              # tRPC client for React
│   │   └── routers/
│   │       ├── auth.ts                # Auth router (signup, login, logout)
│   │       ├── user.ts                # User router (profile, settings)
│   │       └── workspace.ts           # Workspace router (CRUD, members)
│   ├── lib/
│   │   ├── shortcuts/
│   │   │   ├── manager.ts             # Keyboard shortcut manager
│   │   │   └── defaults.ts            # Default shortcut definitions
│   │   ├── i18n/
│   │   │   ├── config.ts              # next-intl config
│   │   │   └── request.ts             # Server-side i18n request config
│   │   └── utils.ts                   # cn() helper, misc utilities
│   ├── stores/
│   │   ├── sidebar.ts                 # Sidebar state (open/closed, width)
│   │   ├── toast.ts                   # Toast notification state
│   │   ├── theme.ts                   # Theme state (light/dark/system)
│   │   └── command-palette.ts         # Command palette state
│   ├── styles/
│   │   └── notion-tokens.css          # Notion exact CSS custom properties
│   ├── types/
│   │   └── index.ts                   # Shared type definitions
│   └── messages/
│       ├── ko.json                    # Korean translations
│       └── en.json                    # English translations
├── tests/
│   ├── setup.ts                       # Test setup (vitest)
│   ├── server/
│   │   ├── routers/
│   │   │   ├── auth.test.ts           # Auth router tests
│   │   │   ├── user.test.ts           # User router tests
│   │   │   └── workspace.test.ts      # Workspace router tests
│   ├── components/
│   │   ├── ui/
│   │   │   └── toast.test.tsx         # Toast tests
│   │   ├── layout/
│   │   │   ├── sidebar.test.tsx       # Sidebar tests
│   │   │   └── command-palette.test.tsx
│   │   └── auth/
│   │       ├── login-form.test.tsx    # Login form tests
│   │       └── signup-form.test.tsx   # Signup form tests
│   └── lib/
│       └── shortcuts/
│           └── manager.test.ts        # Shortcut manager tests
└── vitest.config.ts
```

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `.env.local`, `.gitignore`, `pnpm-workspace.yaml`

- [ ] **Step 1: Initialize Next.js project with pnpm**

```bash
cd "/Users/dgsw36/Desktop/01_프로젝트-개발/앱-도구/Notion Web"
pnpm create next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

Expected: Project scaffolded with Next.js 14, TypeScript, Tailwind, App Router in `src/` directory.

- [ ] **Step 2: Install core dependencies**

```bash
pnpm add @trpc/server@next @trpc/client@next @trpc/react-query@next @trpc/next@next @tanstack/react-query @prisma/client next-auth@5 zustand next-intl clsx tailwind-merge bcryptjs zod
pnpm add -D prisma vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/bcryptjs
```

- [ ] **Step 3: Configure TypeScript strict mode**

`tsconfig.json` — ensure these compiler options are set:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 4: Create .env.local**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/notion_clone"
NEXTAUTH_SECRET="your-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

- [ ] **Step 5: Create .gitignore**

```gitignore
node_modules/
.next/
.env.local
.env*.local
prisma/*.db
*.tsbuildinfo
next-env.d.ts
coverage/
```

- [ ] **Step 6: Create vitest config**

`vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

`tests/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 7: Create utility helpers**

`src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 8: Verify project builds**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 9: Initialize git and commit**

```bash
git init
git add -A
git commit -m "chore: initialize Next.js 14 project with core dependencies"
```

---

## Task 2: Notion Design Tokens & Global Styles

**Files:**
- Create: `src/styles/notion-tokens.css`, `src/app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Create Notion CSS custom properties**

`src/styles/notion-tokens.css`:

```css
:root {
  /* Notion Light Theme Colors */
  --notion-font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol";
  --notion-font-mono: iawriter-mono, Nitti, Menlo, Courier, monospace;

  /* Background */
  --bg-primary: #ffffff;
  --bg-secondary: #f7f6f3;
  --bg-tertiary: #ffffff;
  --bg-sidebar: #f7f6f3;
  --bg-hover: rgba(55, 53, 47, 0.08);
  --bg-active: rgba(55, 53, 47, 0.16);

  /* Text */
  --text-primary: #37352f;
  --text-secondary: rgba(55, 53, 47, 0.65);
  --text-tertiary: rgba(55, 53, 47, 0.45);
  --text-link: #37352f;
  --text-placeholder: rgba(55, 53, 47, 0.35);

  /* Borders */
  --border-default: rgba(55, 53, 47, 0.09);
  --border-divider: rgba(55, 53, 47, 0.16);

  /* Shadows */
  --shadow-popup: rgba(15, 15, 15, 0.05) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px, rgba(15, 15, 15, 0.2) 0px 9px 24px;
  --shadow-tooltip: rgba(15, 15, 15, 0.05) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px;

  /* Notion Block Colors */
  --color-default: #37352f;
  --color-gray: #9b9a97;
  --color-brown: #64473a;
  --color-orange: #d9730d;
  --color-yellow: #dfab01;
  --color-green: #0f7b6c;
  --color-blue: #0b6e99;
  --color-purple: #6940a5;
  --color-pink: #ad1a72;
  --color-red: #e03e3e;

  --color-gray-bg: #ebeced;
  --color-brown-bg: #e9e5e3;
  --color-orange-bg: #faebdd;
  --color-yellow-bg: #fbf3db;
  --color-green-bg: #ddedea;
  --color-blue-bg: #ddebf1;
  --color-purple-bg: #eae4f2;
  --color-pink-bg: #f4dfeb;
  --color-red-bg: #fbe4e4;

  /* Sizing */
  --sidebar-width: 280px;
  --sidebar-min-width: 200px;
  --sidebar-max-width: 480px;
  --topbar-height: 45px;
  --page-max-width: 900px;
  --page-full-width: 100%;
  --page-padding-x: 96px;
  --page-padding-x-mobile: 24px;

  /* Animation */
  --transition-fast: 120ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;

  /* Z-index */
  --z-sidebar: 100;
  --z-topbar: 90;
  --z-modal: 200;
  --z-toast: 300;
  --z-command-palette: 250;
  --z-dropdown: 150;
  --z-tooltip: 350;
}

[data-theme="dark"] {
  --bg-primary: #191919;
  --bg-secondary: #202020;
  --bg-tertiary: #2f2f2f;
  --bg-sidebar: #202020;
  --bg-hover: rgba(255, 255, 255, 0.055);
  --bg-active: rgba(255, 255, 255, 0.1);

  --text-primary: rgba(255, 255, 255, 0.9);
  --text-secondary: rgba(255, 255, 255, 0.6);
  --text-tertiary: rgba(255, 255, 255, 0.4);
  --text-link: rgba(255, 255, 255, 0.9);
  --text-placeholder: rgba(255, 255, 255, 0.3);

  --border-default: rgba(255, 255, 255, 0.094);
  --border-divider: rgba(255, 255, 255, 0.14);

  --shadow-popup: rgba(15, 15, 15, 0.1) 0px 0px 0px 1px, rgba(15, 15, 15, 0.2) 0px 3px 6px, rgba(15, 15, 15, 0.4) 0px 9px 24px;
  --shadow-tooltip: rgba(15, 15, 15, 0.1) 0px 0px 0px 1px, rgba(15, 15, 15, 0.2) 0px 3px 6px;

  --color-default: rgba(255, 255, 255, 0.9);
  --color-gray: #979a9b;
  --color-brown: #937264;
  --color-orange: #ffa344;
  --color-yellow: #ffdc49;
  --color-green: #4dab9a;
  --color-blue: #529cca;
  --color-purple: #9a6dd7;
  --color-pink: #e255a1;
  --color-red: #ff7369;

  --color-gray-bg: #454b4e;
  --color-brown-bg: #434040;
  --color-orange-bg: #594a3a;
  --color-yellow-bg: #59563b;
  --color-green-bg: #354c4b;
  --color-blue-bg: #364954;
  --color-purple-bg: #443f57;
  --color-pink-bg: #533b4c;
  --color-red-bg: #594141;
}
```

- [ ] **Step 2: Update globals.css**

`src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import "../styles/notion-tokens.css";

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  height: 100%;
  font-family: var(--notion-font-family);
  color: var(--text-primary);
  background-color: var(--bg-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

::selection {
  background-color: rgba(35, 131, 226, 0.28);
}

/* Scrollbar - Notion style */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: var(--bg-active);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--text-tertiary);
}
```

- [ ] **Step 3: Extend Tailwind config with Notion tokens**

`tailwind.config.ts`:

```typescript
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
      maxWidth: {
        "page": "var(--page-max-width)",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/notion-tokens.css src/app/globals.css tailwind.config.ts
git commit -m "feat: add Notion design tokens and global styles (light/dark)"
```

---

## Task 3: Prisma Schema & Database Setup

**Files:**
- Create: `prisma/schema.prisma`, `src/server/db/client.ts`

- [ ] **Step 1: Write Prisma schema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  password    String
  avatarUrl   String?
  locale      String   @default("ko")
  theme       String   @default("system")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  memberships WorkspaceMember[]
  sessions    Session[]
  favorites   Favorite[]
}

model Workspace {
  id        String   @id @default(cuid())
  name      String
  icon      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members WorkspaceMember[]
  pages   Page[]
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  userId      String
  workspaceId String
  role        Role     @default(MEMBER)
  joinedAt    DateTime @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])
  @@index([workspaceId])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
}

model Page {
  id           String    @id @default(cuid())
  workspaceId  String
  parentId     String?
  title        String    @default("")
  icon         String?
  cover        String?
  isTemplate   Boolean   @default(false)
  isDeleted    Boolean   @default(false)
  deletedAt    DateTime?
  isLocked     Boolean   @default(false)
  isFullWidth  Boolean   @default(false)
  position     Int       @default(0)
  createdBy    String
  lastEditedBy String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  workspace Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  parent    Page?      @relation("PageTree", fields: [parentId], references: [id], onDelete: SetNull)
  children  Page[]     @relation("PageTree")
  favorites Favorite[]

  @@index([workspaceId])
  @@index([parentId])
  @@index([isDeleted])
}

model Favorite {
  id        String   @id @default(cuid())
  userId    String
  pageId    String
  position  Int      @default(0)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  page Page @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@unique([userId, pageId])
  @@index([userId])
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  GUEST
}
```

- [ ] **Step 2: Create Prisma client singleton**

`src/server/db/client.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 3: Generate Prisma client and run migration**

```bash
pnpm prisma generate
pnpm prisma db push
```

Expected: Database schema created, Prisma client generated.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/server/db/client.ts
git commit -m "feat: add Prisma schema with User, Workspace, Page, Favorite models"
```

---

## Task 4: tRPC Setup

**Files:**
- Create: `src/server/trpc/init.ts`, `src/server/trpc/router.ts`, `src/server/trpc/client.ts`, `src/app/api/trpc/[trpc]/route.ts`

- [ ] **Step 1: Create tRPC initialization with context**

`src/server/trpc/init.ts`:

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { db } from "@/server/db/client";
import { getServerSession } from "@/server/auth/session";

export async function createContext(opts: FetchCreateContextFnOptions) {
  const session = await getServerSession();
  return {
    db,
    session,
    headers: opts.resHeaders,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});
```

- [ ] **Step 2: Install superjson**

```bash
pnpm add superjson
```

- [ ] **Step 3: Create placeholder auth session helper**

`src/server/auth/session.ts`:

```typescript
import { cookies } from "next/headers";
import { db } from "@/server/db/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export type Session = {
  user: SessionUser;
};

export async function getServerSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session-token")?.value;

  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return { user: session.user };
}
```

- [ ] **Step 4: Create root router**

`src/server/trpc/router.ts`:

```typescript
import { router } from "./init";
import { authRouter } from "@/server/routers/auth";
import { userRouter } from "@/server/routers/user";
import { workspaceRouter } from "@/server/routers/workspace";

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 5: Create placeholder routers**

`src/server/routers/auth.ts`:

```typescript
import { router, publicProcedure } from "@/server/trpc/init";

export const authRouter = router({
  health: publicProcedure.query(() => {
    return { status: "ok" };
  }),
});
```

`src/server/routers/user.ts`:

```typescript
import { router, protectedProcedure } from "@/server/trpc/init";

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.session.user;
  }),
});
```

`src/server/routers/workspace.ts`:

```typescript
import { router, protectedProcedure } from "@/server/trpc/init";

export const workspaceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.workspaceMember.findMany({
      where: { userId: ctx.session.user.id },
      include: { workspace: true },
    });
  }),
});
```

- [ ] **Step 6: Create API route handler**

`src/app/api/trpc/[trpc]/route.ts`:

```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/router";
import { createContext } from "@/server/trpc/init";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

- [ ] **Step 7: Create tRPC React client**

`src/server/trpc/client.ts`:

```typescript
"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./router";

export const trpc = createTRPCReact<AppRouter>();
```

- [ ] **Step 8: Commit**

```bash
git add src/server/ src/app/api/
git commit -m "feat: set up tRPC with auth context, root router, and API handler"
```

---

## Task 5: Authentication - Signup & Login

**Files:**
- Create: `tests/server/routers/auth.test.ts`
- Modify: `src/server/routers/auth.ts`, `src/server/auth/session.ts`

- [ ] **Step 1: Write failing tests for auth router**

`tests/server/routers/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db/client";
import { appRouter } from "@/server/trpc/router";
import { createCallerFactory } from "@/server/trpc/init";

const createCaller = createCallerFactory(appRouter);

describe("auth router", () => {
  beforeEach(async () => {
    await db.session.deleteMany();
    await db.favorite.deleteMany();
    await db.page.deleteMany();
    await db.workspaceMember.deleteMany();
    await db.workspace.deleteMany();
    await db.user.deleteMany();
  });

  describe("signup", () => {
    it("should create user, workspace, and return session token", async () => {
      const caller = createCaller({
        db,
        session: null,
        headers: new Headers(),
      });

      const result = await caller.auth.signup({
        email: "test@example.com",
        name: "Test User",
        password: "password123",
      });

      expect(result.user.email).toBe("test@example.com");
      expect(result.user.name).toBe("Test User");
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");

      // Verify workspace was created
      const memberships = await db.workspaceMember.findMany({
        where: { userId: result.user.id },
        include: { workspace: true },
      });
      expect(memberships).toHaveLength(1);
      expect(memberships[0].role).toBe("OWNER");
    });

    it("should reject duplicate email", async () => {
      const caller = createCaller({
        db,
        session: null,
        headers: new Headers(),
      });

      await caller.auth.signup({
        email: "test@example.com",
        name: "Test User",
        password: "password123",
      });

      await expect(
        caller.auth.signup({
          email: "test@example.com",
          name: "Another User",
          password: "password456",
        })
      ).rejects.toThrow();
    });
  });

  describe("login", () => {
    it("should return session token for valid credentials", async () => {
      const caller = createCaller({
        db,
        session: null,
        headers: new Headers(),
      });

      await caller.auth.signup({
        email: "test@example.com",
        name: "Test User",
        password: "password123",
      });

      const result = await caller.auth.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result.user.email).toBe("test@example.com");
      expect(result.token).toBeDefined();
    });

    it("should reject invalid password", async () => {
      const caller = createCaller({
        db,
        session: null,
        headers: new Headers(),
      });

      await caller.auth.signup({
        email: "test@example.com",
        name: "Test User",
        password: "password123",
      });

      await expect(
        caller.auth.login({
          email: "test@example.com",
          password: "wrongpassword",
        })
      ).rejects.toThrow();
    });

    it("should reject non-existent email", async () => {
      const caller = createCaller({
        db,
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.auth.login({
          email: "nobody@example.com",
          password: "password123",
        })
      ).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/server/routers/auth.test.ts
```

Expected: FAIL — `signup` and `login` procedures not defined.

- [ ] **Step 3: Export createCallerFactory from tRPC init**

Add to `src/server/trpc/init.ts`:

```typescript
export const createCallerFactory = t.createCallerFactory;
```

- [ ] **Step 4: Implement auth router**

`src/server/routers/auth.ts`:

```typescript
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "@/server/trpc/init";

export const authRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1).max(100),
        password: z.string().min(8).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 12);

      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          name: input.name,
          password: hashedPassword,
        },
      });

      // Create default workspace
      const workspace = await ctx.db.workspace.create({
        data: {
          name: `${input.name}'s Workspace`,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });

      // Create welcome page
      await ctx.db.page.create({
        data: {
          workspaceId: workspace.id,
          title: "Getting Started",
          icon: "👋",
          createdBy: user.id,
          lastEditedBy: user.id,
        },
      });

      // Create session
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await ctx.db.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      return {
        user: { id: user.id, email: user.email, name: user.name },
        token,
      };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const valid = await bcrypt.compare(input.password, user.password);

      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await ctx.db.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      return {
        user: { id: user.id, email: user.email, name: user.name },
        token,
      };
    }),

  logout: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.session.deleteMany({
        where: { token: input.token },
      });
      return { success: true };
    }),
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test tests/server/routers/auth.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/server/routers/auth.test.ts src/server/routers/auth.ts src/server/trpc/init.ts
git commit -m "feat: implement auth router with signup, login, logout + tests"
```

---

## Task 6: Workspace Router

**Files:**
- Create: `tests/server/routers/workspace.test.ts`
- Modify: `src/server/routers/workspace.ts`

- [ ] **Step 1: Write failing tests**

`tests/server/routers/workspace.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db/client";
import { appRouter } from "@/server/trpc/router";
import { createCallerFactory } from "@/server/trpc/init";
import bcrypt from "bcryptjs";

const createCaller = createCallerFactory(appRouter);

async function createTestUser() {
  const user = await db.user.create({
    data: {
      email: "test@example.com",
      name: "Test User",
      password: await bcrypt.hash("password123", 12),
    },
  });

  const workspace = await db.workspace.create({
    data: {
      name: "Test Workspace",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  return { user, workspace };
}

describe("workspace router", () => {
  beforeEach(async () => {
    await db.session.deleteMany();
    await db.favorite.deleteMany();
    await db.page.deleteMany();
    await db.workspaceMember.deleteMany();
    await db.workspace.deleteMany();
    await db.user.deleteMany();
  });

  describe("list", () => {
    it("should return user workspaces", async () => {
      const { user } = await createTestUser();
      const caller = createCaller({
        db,
        session: { user: { id: user.id, email: user.email, name: user.name } },
        headers: new Headers(),
      });

      const result = await caller.workspace.list();
      expect(result).toHaveLength(1);
      expect(result[0].workspace.name).toBe("Test Workspace");
    });
  });

  describe("update", () => {
    it("should update workspace name and icon", async () => {
      const { user, workspace } = await createTestUser();
      const caller = createCaller({
        db,
        session: { user: { id: user.id, email: user.email, name: user.name } },
        headers: new Headers(),
      });

      const result = await caller.workspace.update({
        id: workspace.id,
        name: "Updated Name",
        icon: "🚀",
      });

      expect(result.name).toBe("Updated Name");
      expect(result.icon).toBe("🚀");
    });
  });

  describe("members", () => {
    it("should return workspace members", async () => {
      const { user, workspace } = await createTestUser();
      const caller = createCaller({
        db,
        session: { user: { id: user.id, email: user.email, name: user.name } },
        headers: new Headers(),
      });

      const result = await caller.workspace.members({ workspaceId: workspace.id });
      expect(result).toHaveLength(1);
      expect(result[0].user.email).toBe("test@example.com");
      expect(result[0].role).toBe("OWNER");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/server/routers/workspace.test.ts
```

Expected: FAIL — `update` and `members` procedures not defined.

- [ ] **Step 3: Implement workspace router**

`src/server/routers/workspace.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

export const workspaceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.workspaceMember.findMany({
      where: { userId: ctx.session.user.id },
      include: { workspace: true },
      orderBy: { joinedAt: "asc" },
    });
  }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        icon: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is OWNER or ADMIN
      const membership = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.id,
          },
        },
      });

      if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.workspace.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.icon !== undefined && { icon: input.icon }),
        },
      });
    }),

  members: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify user is a member
      const membership = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.workspaceMember.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      });
    }),

  inviteMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        email: z.string().email(),
        role: z.enum(["ADMIN", "MEMBER", "GUEST"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify caller is OWNER or ADMIN
      const callerMembership = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!callerMembership || !["OWNER", "ADMIN"].includes(callerMembership.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const targetUser = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return ctx.db.workspaceMember.create({
        data: {
          userId: targetUser.id,
          workspaceId: input.workspaceId,
          role: input.role,
        },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });
    }),
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/server/routers/workspace.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/server/routers/workspace.test.ts src/server/routers/workspace.ts
git commit -m "feat: implement workspace router with list, update, members, invite"
```

---

## Task 7: Theme Store & Provider

**Files:**
- Create: `src/stores/theme.ts`, `src/components/providers.tsx`

- [ ] **Step 1: Create theme store**

`src/stores/theme.ts`:

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

type ThemeStore = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolvedTheme: "light",
      setTheme: (theme: Theme) => {
        const resolved = theme === "system" ? getSystemTheme() : theme;
        document.documentElement.setAttribute("data-theme", resolved);
        set({ theme, resolvedTheme: resolved });
      },
    }),
    {
      name: "notion-theme",
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved =
            state.theme === "system" ? getSystemTheme() : state.theme;
          document.documentElement.setAttribute("data-theme", resolved);
          state.resolvedTheme = resolved;
        }
      },
    }
  )
);
```

- [ ] **Step 2: Create providers wrapper**

`src/components/providers.tsx`:

```typescript
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/server/trpc/client";
import superjson from "superjson";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

- [ ] **Step 3: Update root layout**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notion",
  description: "Team workspace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/stores/theme.ts src/components/providers.tsx src/app/layout.tsx
git commit -m "feat: add theme store with system/light/dark + tRPC providers"
```

---

## Task 8: Toast Notification System

**Files:**
- Create: `src/stores/toast.ts`, `src/components/ui/toast.tsx`, `src/components/ui/toast-container.tsx`, `tests/components/ui/toast.test.tsx`

- [ ] **Step 1: Write failing test for toast store**

`tests/components/ui/toast.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToastStore } from "@/stores/toast";

describe("toast store", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it("should add a toast", () => {
    const { result } = renderHook(() => useToastStore());

    act(() => {
      result.current.addToast({ message: "Hello", type: "success" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe("Hello");
    expect(result.current.toasts[0].type).toBe("success");
  });

  it("should remove a toast", () => {
    const { result } = renderHook(() => useToastStore());

    act(() => {
      result.current.addToast({ message: "Hello", type: "info" });
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("should support undo action", () => {
    const undoFn = vi.fn();
    const { result } = renderHook(() => useToastStore());

    act(() => {
      result.current.addToast({
        message: "Deleted",
        type: "info",
        undo: undoFn,
      });
    });

    expect(result.current.toasts[0].undo).toBe(undoFn);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/components/ui/toast.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement toast store**

`src/stores/toast.ts`:

```typescript
import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
  undo?: () => void;
  duration?: number;
};

type ToastStore = {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
};

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${++counter}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    return id;
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test tests/components/ui/toast.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Create toast UI component**

`src/components/ui/toast.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Toast as ToastType } from "@/stores/toast";
import { useToastStore } from "@/stores/toast";

const icons: Record<ToastType["type"], string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

export function Toast({ toast }: { toast: ToastType }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => removeToast(toast.id), 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => removeToast(toast.id), 200);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-lg",
        "transition-all duration-200",
        isExiting ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100",
        "bg-notion-bg-primary border border-notion-border"
      )}
      style={{
        boxShadow: "var(--shadow-popup)",
        color: "var(--text-primary)",
        fontFamily: "var(--notion-font-family)",
      }}
      role="alert"
    >
      <span className="flex-shrink-0">{icons[toast.type]}</span>
      <span className="flex-1">{toast.message}</span>
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo?.();
            handleClose();
          }}
          className="flex-shrink-0 font-medium underline hover:no-underline"
          style={{ color: "var(--color-blue)" }}
        >
          Undo
        </button>
      )}
      <button
        onClick={handleClose}
        className="flex-shrink-0 ml-1 opacity-50 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Create toast container**

`src/components/ui/toast-container.tsx`:

```tsx
"use client";

import { useToastStore } from "@/stores/toast";
import { Toast } from "./toast";

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2"
      style={{ zIndex: "var(--z-toast)" }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Add ToastContainer to providers**

Add to `src/components/providers.tsx`, inside the return JSX, after `{children}`:

```tsx
import { ToastContainer } from "@/components/ui/toast-container";

// Inside Providers return:
<trpc.Provider client={trpcClient} queryClient={queryClient}>
  <QueryClientProvider client={queryClient}>
    {children}
    <ToastContainer />
  </QueryClientProvider>
</trpc.Provider>
```

- [ ] **Step 8: Commit**

```bash
git add src/stores/toast.ts src/components/ui/toast.tsx src/components/ui/toast-container.tsx src/components/providers.tsx tests/components/ui/toast.test.tsx
git commit -m "feat: add toast notification system with undo support"
```

---

## Task 9: Keyboard Shortcut Manager

**Files:**
- Create: `src/lib/shortcuts/manager.ts`, `src/lib/shortcuts/defaults.ts`, `tests/lib/shortcuts/manager.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/lib/shortcuts/manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShortcutManager } from "@/lib/shortcuts/manager";

describe("ShortcutManager", () => {
  let manager: ShortcutManager;

  beforeEach(() => {
    manager = new ShortcutManager();
  });

  it("should register and trigger a shortcut", () => {
    const handler = vi.fn();
    manager.register({
      id: "test",
      key: "k",
      meta: true,
      handler,
    });

    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
    });
    manager.handleKeyDown(event);

    expect(handler).toHaveBeenCalledOnce();
  });

  it("should not trigger when modifier doesn't match", () => {
    const handler = vi.fn();
    manager.register({
      id: "test",
      key: "k",
      meta: true,
      handler,
    });

    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: false,
    });
    manager.handleKeyDown(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it("should unregister a shortcut", () => {
    const handler = vi.fn();
    manager.register({
      id: "test",
      key: "k",
      meta: true,
      handler,
    });

    manager.unregister("test");

    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
    });
    manager.handleKeyDown(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it("should support context-based shortcuts", () => {
    const globalHandler = vi.fn();
    const editorHandler = vi.fn();

    manager.register({
      id: "global-save",
      key: "s",
      meta: true,
      handler: globalHandler,
    });

    manager.register({
      id: "editor-save",
      key: "s",
      meta: true,
      context: "editor",
      handler: editorHandler,
    });

    manager.setContext("editor");

    const event = new KeyboardEvent("keydown", {
      key: "s",
      metaKey: true,
    });
    manager.handleKeyDown(event);

    expect(editorHandler).toHaveBeenCalledOnce();
    expect(globalHandler).not.toHaveBeenCalled();
  });

  it("should fall back to global when no context match", () => {
    const globalHandler = vi.fn();

    manager.register({
      id: "global-action",
      key: "p",
      meta: true,
      handler: globalHandler,
    });

    manager.setContext("editor");

    const event = new KeyboardEvent("keydown", {
      key: "p",
      metaKey: true,
    });
    manager.handleKeyDown(event);

    expect(globalHandler).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/lib/shortcuts/manager.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ShortcutManager**

`src/lib/shortcuts/manager.ts`:

```typescript
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

    for (const shortcut of this.shortcuts.values()) {
      if (!this.matchesEvent(shortcut, event)) continue;
      matching.push(shortcut);
    }

    if (matching.length === 0) return;

    // Prefer context-specific match over global
    const contextMatch = matching.find(
      (s) => s.context === this.currentContext
    );
    const globalMatch = matching.find((s) => !s.context);

    const chosen = contextMatch ?? globalMatch;

    if (chosen) {
      event.preventDefault?.();
      chosen.handler(event);
    }
  }

  private matchesEvent(shortcut: Shortcut, event: KeyboardEvent): boolean {
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

// Singleton instance
export const shortcutManager = new ShortcutManager();
```

- [ ] **Step 4: Create default shortcuts**

`src/lib/shortcuts/defaults.ts`:

```typescript
import type { Shortcut } from "./manager";

// Defined without handlers — handlers are bound when components mount
export const DEFAULT_SHORTCUTS: Omit<Shortcut, "handler">[] = [
  // Global
  { id: "command-palette", key: "k", meta: true },
  { id: "search", key: "p", meta: true },
  { id: "toggle-sidebar", key: "\\", meta: true },
  { id: "new-page", key: "n", meta: true },
  { id: "shortcuts-help", key: "/", meta: true },
  { id: "toggle-dark-mode", key: "d", meta: true, shift: true },

  // Editor context
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test tests/lib/shortcuts/manager.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shortcuts/ tests/lib/shortcuts/
git commit -m "feat: add keyboard shortcut manager with context support"
```

---

## Task 10: i18n Setup

**Files:**
- Create: `src/messages/ko.json`, `src/messages/en.json`, `src/lib/i18n/config.ts`, `src/lib/i18n/request.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Create translation files**

`src/messages/ko.json`:

```json
{
  "common": {
    "save": "저장",
    "cancel": "취소",
    "delete": "삭제",
    "edit": "수정",
    "create": "생성",
    "search": "검색",
    "settings": "설정",
    "logout": "로그아웃",
    "undo": "실행 취소",
    "loading": "로딩 중..."
  },
  "auth": {
    "login": "로그인",
    "signup": "회원가입",
    "email": "이메일",
    "password": "비밀번호",
    "name": "이름",
    "emailPlaceholder": "이메일을 입력하세요",
    "passwordPlaceholder": "비밀번호를 입력하세요",
    "namePlaceholder": "이름을 입력하세요",
    "noAccount": "계정이 없으신가요?",
    "hasAccount": "이미 계정이 있으신가요?",
    "loginError": "이메일 또는 비밀번호가 올바르지 않습니다",
    "signupError": "회원가입에 실패했습니다"
  },
  "sidebar": {
    "search": "빠른 검색",
    "settings": "설정",
    "newPage": "새 페이지",
    "favorites": "즐겨찾기",
    "private": "개인 페이지",
    "shared": "공유됨",
    "trash": "휴지통"
  },
  "settings": {
    "title": "설정",
    "account": "내 계정",
    "workspace": "워크스페이스",
    "members": "멤버",
    "language": "언어",
    "theme": "테마",
    "themeLight": "라이트",
    "themeDark": "다크",
    "themeSystem": "시스템",
    "profile": "프로필",
    "changePassword": "비밀번호 변경"
  },
  "page": {
    "untitled": "제목 없음",
    "addIcon": "아이콘 추가",
    "addCover": "커버 추가",
    "typeSlash": "'/'를 입력하여 명령어 사용"
  }
}
```

`src/messages/en.json`:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "search": "Search",
    "settings": "Settings",
    "logout": "Log out",
    "undo": "Undo",
    "loading": "Loading..."
  },
  "auth": {
    "login": "Log in",
    "signup": "Sign up",
    "email": "Email",
    "password": "Password",
    "name": "Name",
    "emailPlaceholder": "Enter your email",
    "passwordPlaceholder": "Enter your password",
    "namePlaceholder": "Enter your name",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?",
    "loginError": "Invalid email or password",
    "signupError": "Failed to sign up"
  },
  "sidebar": {
    "search": "Quick search",
    "settings": "Settings",
    "newPage": "New page",
    "favorites": "Favorites",
    "private": "Private",
    "shared": "Shared",
    "trash": "Trash"
  },
  "settings": {
    "title": "Settings",
    "account": "My account",
    "workspace": "Workspace",
    "members": "Members",
    "language": "Language",
    "theme": "Appearance",
    "themeLight": "Light",
    "themeDark": "Dark",
    "themeSystem": "System",
    "profile": "Profile",
    "changePassword": "Change password"
  },
  "page": {
    "untitled": "Untitled",
    "addIcon": "Add icon",
    "addCover": "Add cover",
    "typeSlash": "Type '/' for commands"
  }
}
```

- [ ] **Step 2: Create i18n config**

`src/lib/i18n/config.ts`:

```typescript
export const locales = ["ko", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ko";
```

`src/lib/i18n/request.ts`:

```typescript
import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";

export default getRequestConfig(async () => {
  // For now, use default locale. Later: read from user preference or cookie.
  const locale = defaultLocale;

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 3: Update next.config.ts**

`next.config.ts`:

```typescript
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const nextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 4: Commit**

```bash
git add src/messages/ src/lib/i18n/ next.config.ts
git commit -m "feat: add i18n with Korean and English translations"
```

---

## Task 11: Sidebar Store & Component

**Files:**
- Create: `src/stores/sidebar.ts`, `src/components/layout/sidebar.tsx`, `src/components/layout/sidebar-resizer.tsx`, `tests/components/layout/sidebar.test.tsx`

- [ ] **Step 1: Write failing test for sidebar store**

`tests/components/layout/sidebar.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarStore } from "@/stores/sidebar";

describe("sidebar store", () => {
  beforeEach(() => {
    useSidebarStore.setState({
      isOpen: true,
      width: 280,
      isResizing: false,
    });
  });

  it("should toggle sidebar", () => {
    const { result } = renderHook(() => useSidebarStore());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it("should clamp width to min/max", () => {
    const { result } = renderHook(() => useSidebarStore());

    act(() => {
      result.current.setWidth(100); // below min 200
    });

    expect(result.current.width).toBe(200);

    act(() => {
      result.current.setWidth(600); // above max 480
    });

    expect(result.current.width).toBe(480);
  });

  it("should set width within range", () => {
    const { result } = renderHook(() => useSidebarStore());

    act(() => {
      result.current.setWidth(350);
    });

    expect(result.current.width).toBe(350);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/components/layout/sidebar.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement sidebar store**

`src/stores/sidebar.ts`:

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_DEFAULT_WIDTH = 280;

type SidebarStore = {
  isOpen: boolean;
  width: number;
  isResizing: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setResizing: (resizing: boolean) => void;
};

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      isOpen: true,
      width: SIDEBAR_DEFAULT_WIDTH,
      isResizing: false,
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      setOpen: (open) => set({ isOpen: open }),
      setWidth: (width) =>
        set({
          width: Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)),
        }),
      setResizing: (resizing) => set({ isResizing: resizing }),
    }),
    {
      name: "notion-sidebar",
      partialize: (state) => ({
        isOpen: state.isOpen,
        width: state.width,
      }),
    }
  )
);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test tests/components/layout/sidebar.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Create sidebar resizer component**

`src/components/layout/sidebar-resizer.tsx`:

```tsx
"use client";

import { useCallback, useEffect } from "react";
import { useSidebarStore } from "@/stores/sidebar";

export function SidebarResizer() {
  const { setWidth, setResizing } = useSidebarStore();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizing(true);

      const handleMouseMove = (e: MouseEvent) => {
        setWidth(e.clientX);
      };

      const handleMouseUp = () => {
        setResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [setWidth, setResizing]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute right-0 top-0 bottom-0 w-[3px] cursor-col-resize hover:bg-notion-border-divider transition-colors z-10"
      style={{ transition: "background-color var(--transition-fast)" }}
    />
  );
}
```

- [ ] **Step 6: Create sidebar component**

`src/components/layout/sidebar.tsx`:

```tsx
"use client";

import { useSidebarStore } from "@/stores/sidebar";
import { SidebarResizer } from "./sidebar-resizer";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { isOpen, width, isResizing } = useSidebarStore();

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 flex flex-col",
          "bg-notion-bg-sidebar",
          !isResizing && "transition-all duration-300 ease-in-out"
        )}
        style={{
          width: isOpen ? `${width}px` : "0px",
          zIndex: "var(--z-sidebar)",
          overflow: "hidden",
        }}
      >
        <div className="flex flex-col h-full" style={{ width: `${width}px` }}>
          {/* Workspace Switcher */}
          <div
            className="flex items-center px-3 h-[45px] hover:bg-notion-bg-hover cursor-pointer"
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            <span className="mr-2 text-lg">📋</span>
            <span className="truncate flex-1">Workspace</span>
            <span
              className="opacity-0 group-hover:opacity-100 text-xs"
              style={{ color: "var(--text-tertiary)" }}
            >
              ···
            </span>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer"
            style={{
              fontSize: "14px",
              color: "var(--text-secondary)",
            }}
          >
            <span>🔍</span>
            <span>검색</span>
            <span className="ml-auto text-xs opacity-50">⌘K</span>
          </div>

          {/* Settings */}
          <div
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer"
            style={{
              fontSize: "14px",
              color: "var(--text-secondary)",
            }}
          >
            <span>⚙️</span>
            <span>설정</span>
          </div>

          {/* Divider */}
          <div
            className="mx-3 my-1"
            style={{
              height: "1px",
              backgroundColor: "var(--border-divider)",
            }}
          />

          {/* Favorites Section */}
          <div className="flex-1 overflow-y-auto px-1">
            <div
              className="px-3 py-1"
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text-tertiary)",
                letterSpacing: "0.02em",
              }}
            >
              즐겨찾기
            </div>
            {/* Page tree items will be rendered here in SP-3 */}

            <div
              className="px-3 py-1 mt-4"
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text-tertiary)",
                letterSpacing: "0.02em",
              }}
            >
              개인 페이지
            </div>
            {/* Page tree items will be rendered here in SP-3 */}
          </div>

          {/* New Page Button */}
          <div
            className="flex items-center gap-2 mx-2 mb-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer"
            style={{
              fontSize: "14px",
              color: "var(--text-secondary)",
            }}
          >
            <span>➕</span>
            <span>새 페이지</span>
          </div>
        </div>

        <SidebarResizer />
      </aside>

      {/* Spacer to push main content */}
      <div
        className={cn(!isResizing && "transition-all duration-300 ease-in-out")}
        style={{
          width: isOpen ? `${width}px` : "0px",
          flexShrink: 0,
        }}
      />
    </>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/stores/sidebar.ts src/components/layout/sidebar.tsx src/components/layout/sidebar-resizer.tsx tests/components/layout/sidebar.test.tsx
git commit -m "feat: add sidebar with resizer, favorites/private sections, Notion styling"
```

---

## Task 12: Top Bar Component

**Files:**
- Create: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Create topbar component**

`src/components/layout/topbar.tsx`:

```tsx
"use client";

import { useSidebarStore } from "@/stores/sidebar";

export function Topbar() {
  const { isOpen, toggle } = useSidebarStore();

  return (
    <header
      className="sticky top-0 flex items-center justify-between px-3"
      style={{
        height: "var(--topbar-height)",
        zIndex: "var(--z-topbar)",
        backgroundColor: "var(--bg-primary)",
        fontSize: "14px",
      }}
    >
      {/* Left: Sidebar toggle + Breadcrumb */}
      <div className="flex items-center gap-1">
        {!isOpen && (
          <button
            onClick={toggle}
            className="p-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
            title="Open sidebar (⌘\\)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v1.5H2V3zm0 4.25h12v1.5H2v-1.5zm0 4.25h12V13H2v-1.5z" />
            </svg>
          </button>
        )}

        {/* Breadcrumb placeholder — will be dynamic in SP-3 */}
        <div
          className="flex items-center gap-1 px-1"
          style={{ color: "var(--text-secondary)" }}
        >
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            Getting Started
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-0.5">
        {/* Share button */}
        <button
          className="px-3 py-1 rounded hover:bg-notion-bg-hover text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          공유
        </button>

        {/* Comment button */}
        <button
          className="p-1.5 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.32 15.424l4.644-2.432a.5.5 0 01.235-.059h3.3A2.5 2.5 0 0015 10.433V5.5A2.5 2.5 0 0012.5 3h-9A2.5 2.5 0 001 5.5v4.933a2.5 2.5 0 002.5 2.5h.32a.5.5 0 01.5.5v1.991z" />
          </svg>
        </button>

        {/* More menu */}
        <button
          className="p-1.5 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm4.5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM12 6.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/topbar.tsx
git commit -m "feat: add topbar with sidebar toggle, breadcrumb, and action buttons"
```

---

## Task 13: Command Palette

**Files:**
- Create: `src/stores/command-palette.ts`, `src/components/layout/command-palette.tsx`, `tests/components/layout/command-palette.test.tsx`

- [ ] **Step 1: Write failing test for command palette store**

`tests/components/layout/command-palette.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCommandPaletteStore } from "@/stores/command-palette";

describe("command palette store", () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({ isOpen: false, query: "" });
  });

  it("should toggle open state", () => {
    const { result } = renderHook(() => useCommandPaletteStore());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("should clear query on close", () => {
    const { result } = renderHook(() => useCommandPaletteStore());

    act(() => {
      result.current.open();
      result.current.setQuery("test");
    });

    expect(result.current.query).toBe("test");

    act(() => {
      result.current.close();
    });

    expect(result.current.query).toBe("");
    expect(result.current.isOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/components/layout/command-palette.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement command palette store**

`src/stores/command-palette.ts`:

```typescript
import { create } from "zustand";

type CommandPaletteStore = {
  isOpen: boolean;
  query: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
};

export const useCommandPaletteStore = create<CommandPaletteStore>((set) => ({
  isOpen: false,
  query: "",
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, query: "" }),
  toggle: () =>
    set((s) => (s.isOpen ? { isOpen: false, query: "" } : { isOpen: true })),
  setQuery: (query) => set({ query }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test tests/components/layout/command-palette.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Create command palette UI component**

`src/components/layout/command-palette.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useCommandPaletteStore } from "@/stores/command-palette";

export function CommandPalette() {
  const { isOpen, query, close, setQuery } = useCommandPaletteStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{
          zIndex: "var(--z-command-palette)",
          backgroundColor: "rgba(15, 15, 15, 0.6)",
        }}
        onClick={close}
      />

      {/* Palette */}
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-[620px] rounded-lg overflow-hidden"
        style={{
          top: "max(12vh, 80px)",
          zIndex: "calc(var(--z-command-palette) + 1)",
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
        }}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b" style={{ borderColor: "var(--border-default)" }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            style={{ color: "var(--text-tertiary)", flexShrink: 0 }}
          >
            <path
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              fill="currentColor"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색..."
            className="flex-1 ml-3 bg-transparent outline-none"
            style={{
              fontSize: "16px",
              color: "var(--text-primary)",
              fontFamily: "var(--notion-font-family)",
            }}
          />
        </div>

        {/* Results */}
        <div
          className="max-h-[60vh] overflow-y-auto py-1"
          style={{ fontSize: "14px" }}
        >
          {/* Recent pages section — will be populated in SP-3 */}
          <div
            className="px-4 py-2"
            style={{
              fontSize: "12px",
              color: "var(--text-tertiary)",
              fontWeight: 500,
            }}
          >
            최근 방문
          </div>
          <div
            className="px-4 py-3 text-center"
            style={{ color: "var(--text-tertiary)" }}
          >
            결과가 없습니다
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/stores/command-palette.ts src/components/layout/command-palette.tsx tests/components/layout/command-palette.test.tsx
git commit -m "feat: add command palette (Cmd+K) with search UI"
```

---

## Task 14: Auth UI - Login & Signup Pages

**Files:**
- Create: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/components/auth/login-form.tsx`, `src/components/auth/signup-form.tsx`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`

- [ ] **Step 1: Create base UI components**

`src/components/ui/button.tsx`:

```tsx
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded font-medium transition-colors",
          "disabled:opacity-50 disabled:pointer-events-none",
          variant === "primary" &&
            "bg-[#2383e2] text-white hover:bg-[#0b6ec5]",
          variant === "secondary" &&
            "bg-notion-bg-hover text-notion-text-primary hover:bg-notion-bg-active",
          variant === "ghost" &&
            "hover:bg-notion-bg-hover text-notion-text-secondary",
          size === "sm" && "px-2 py-1 text-xs",
          size === "md" && "px-3 py-1.5 text-sm",
          size === "lg" && "px-4 py-2 text-sm",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
```

`src/components/ui/input.tsx`:

```tsx
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded px-3 py-2 text-sm outline-none",
          "border transition-colors",
          "focus:border-[#2383e2] focus:ring-1 focus:ring-[#2383e2]",
          className
        )}
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
          fontFamily: "var(--notion-font-family)",
        }}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
```

- [ ] **Step 2: Create auth layout**

`src/app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="w-full max-w-[400px] px-6">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create login form component**

`src/components/auth/login-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

export function LoginForm() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      // Set cookie
      document.cookie = `session-token=${data.token}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`;
      router.push("/");
      router.refresh();
    },
    onError: (error) => {
      addToast({ message: error.message, type: "error" });
      setIsLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    login.mutate({ email, password });
  };

  return (
    <div>
      {/* Logo */}
      <div className="text-center mb-8">
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          로그인
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label
            className="block text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            이메일
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일을 입력하세요"
            required
            autoFocus
          />
        </div>

        <div>
          <label
            className="block text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            비밀번호
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            required
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full mt-2"
          disabled={isLoading}
        >
          {isLoading ? "로그인 중..." : "로그인"}
        </Button>
      </form>

      <p
        className="text-center text-sm mt-4"
        style={{ color: "var(--text-secondary)" }}
      >
        계정이 없으신가요?{" "}
        <Link
          href="/signup"
          className="underline hover:no-underline"
          style={{ color: "var(--color-blue)" }}
        >
          회원가입
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create signup form component**

`src/components/auth/signup-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

export function SignupForm() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const signup = trpc.auth.signup.useMutation({
    onSuccess: (data) => {
      document.cookie = `session-token=${data.token}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`;
      router.push("/");
      router.refresh();
    },
    onError: (error) => {
      addToast({ message: error.message, type: "error" });
      setIsLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    signup.mutate({ email, name, password });
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          회원가입
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label
            className="block text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            이름
          </label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            required
            autoFocus
          />
        </div>

        <div>
          <label
            className="block text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            이메일
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일을 입력하세요"
            required
          />
        </div>

        <div>
          <label
            className="block text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            비밀번호
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요 (8자 이상)"
            required
            minLength={8}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full mt-2"
          disabled={isLoading}
        >
          {isLoading ? "가입 중..." : "회원가입"}
        </Button>
      </form>

      <p
        className="text-center text-sm mt-4"
        style={{ color: "var(--text-secondary)" }}
      >
        이미 계정이 있으신가요?{" "}
        <Link
          href="/login"
          className="underline hover:no-underline"
          style={{ color: "var(--color-blue)" }}
        >
          로그인
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Create login and signup pages**

`src/app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return <LoginForm />;
}
```

`src/app/(auth)/signup/page.tsx`:

```tsx
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return <SignupForm />;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/input.tsx src/app/\(auth\)/ src/components/auth/
git commit -m "feat: add auth UI — login and signup pages with Notion styling"
```

---

## Task 15: Main Layout (Sidebar + Topbar + Content)

**Files:**
- Create: `src/app/(main)/layout.tsx`, `src/app/(main)/[workspaceId]/page.tsx`, `src/app/(main)/[workspaceId]/[pageId]/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create main layout with sidebar + topbar**

`src/app/(main)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
```

- [ ] **Step 2: Create workspace home page**

`src/app/(main)/[workspaceId]/page.tsx`:

```tsx
export default function WorkspaceHomePage() {
  return (
    <div
      className="flex items-center justify-center h-full"
      style={{ color: "var(--text-tertiary)" }}
    >
      페이지를 선택하거나 새 페이지를 만드세요
    </div>
  );
}
```

- [ ] **Step 3: Create page view placeholder**

`src/app/(main)/[workspaceId]/[pageId]/page.tsx`:

```tsx
export default function PageView({
  params,
}: {
  params: { workspaceId: string; pageId: string };
}) {
  return (
    <div
      className="mx-auto py-12"
      style={{
        maxWidth: "var(--page-max-width)",
        paddingLeft: "var(--page-padding-x)",
        paddingRight: "var(--page-padding-x)",
      }}
    >
      {/* Page icon + title placeholder */}
      <h1
        className="text-4xl font-bold outline-none"
        style={{
          color: "var(--text-primary)",
          fontWeight: 700,
          lineHeight: 1.2,
        }}
        contentEditable
        suppressContentEditableWarning
      >
        제목 없음
      </h1>

      {/* Editor placeholder — will be replaced in SP-2 */}
      <div
        className="mt-4"
        style={{
          color: "var(--text-placeholder)",
          fontSize: "16px",
          lineHeight: 1.5,
        }}
      >
        &apos;/&apos;를 입력하여 명령어 사용
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add root redirect to login**

`src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { db } from "@/server/db/client";

export default async function HomePage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  // Redirect to first workspace
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });

  if (membership) {
    redirect(`/${membership.workspaceId}`);
  }

  redirect("/login");
}
```

- [ ] **Step 5: Verify build**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/
git commit -m "feat: add main layout with sidebar + topbar + auth redirect"
```

---

## Task 16: Settings Page

**Files:**
- Create: `src/app/(main)/[workspaceId]/settings/page.tsx`, `src/components/settings/settings-layout.tsx`, `src/components/settings/account-settings.tsx`, `src/components/settings/workspace-settings.tsx`
- Modify: `src/server/routers/user.ts`

- [ ] **Step 1: Create user update router**

`src/server/routers/user.ts`:

```typescript
import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        locale: true,
        theme: true,
      },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    return user;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        avatarUrl: z.string().url().nullable().optional(),
        locale: z.enum(["ko", "en"]).optional(),
        theme: z.enum(["light", "dark", "system"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: input,
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          locale: true,
          theme: true,
        },
      });
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
      });

      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const valid = await bcrypt.compare(input.currentPassword, user.password);
      if (!valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Current password is incorrect",
        });
      }

      const hashed = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { password: hashed },
      });

      return { success: true };
    }),
});
```

- [ ] **Step 2: Create settings layout**

`src/components/settings/settings-layout.tsx`:

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AccountSettings } from "./account-settings";
import { WorkspaceSettings } from "./workspace-settings";

type Tab = "account" | "workspace";

const tabs: { id: Tab; label: string }[] = [
  { id: "account", label: "내 계정" },
  { id: "workspace", label: "워크스페이스" },
];

export function SettingsLayout({ workspaceId }: { workspaceId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("account");

  return (
    <div className="flex h-full">
      {/* Settings sidebar */}
      <div
        className="w-[240px] flex-shrink-0 py-4 px-2"
        style={{
          borderRight: "1px solid var(--border-default)",
        }}
      >
        <div
          className="px-3 py-1 mb-2"
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          설정
        </div>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "w-full text-left px-3 py-1.5 rounded text-sm",
              activeTab === tab.id
                ? "bg-notion-bg-active font-medium"
                : "hover:bg-notion-bg-hover"
            )}
            style={{
              color:
                activeTab === tab.id
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto py-8 px-12">
        {activeTab === "account" && <AccountSettings />}
        {activeTab === "workspace" && (
          <WorkspaceSettings workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create account settings**

`src/components/settings/account-settings.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";
import { useThemeStore } from "@/stores/theme";

export function AccountSettings() {
  const addToast = useToastStore((s) => s.addToast);
  const { theme, setTheme } = useThemeStore();
  const { data: user, refetch } = trpc.user.me.useQuery();

  const [name, setName] = useState(user?.name ?? "");
  const [locale, setLocale] = useState(user?.locale ?? "ko");

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      addToast({ message: "프로필이 업데이트되었습니다", type: "success" });
      refetch();
    },
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  if (!user) return null;

  return (
    <div>
      <h2
        className="text-xl font-semibold mb-6"
        style={{ color: "var(--text-primary)" }}
      >
        내 계정
      </h2>

      {/* Profile */}
      <section className="mb-8">
        <h3
          className="text-sm font-medium mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          프로필
        </h3>
        <div className="flex flex-col gap-3 max-w-[400px]">
          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              이름
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              이메일
            </label>
            <Input value={user.email} disabled />
          </div>
          <Button
            onClick={() => updateProfile.mutate({ name })}
            size="md"
            className="self-start"
          >
            저장
          </Button>
        </div>
      </section>

      {/* Theme */}
      <section className="mb-8">
        <h3
          className="text-sm font-medium mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          테마
        </h3>
        <div className="flex gap-2">
          {(["system", "light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTheme(t);
                updateProfile.mutate({ theme: t });
              }}
              className={cn(
                "px-4 py-2 rounded text-sm border",
                theme === t
                  ? "border-[#2383e2] font-medium"
                  : "border-transparent hover:bg-notion-bg-hover"
              )}
              style={{
                color: theme === t ? "var(--color-blue)" : "var(--text-secondary)",
                backgroundColor: theme === t ? "var(--color-blue-bg)" : undefined,
              }}
            >
              {t === "system" ? "시스템" : t === "light" ? "라이트" : "다크"}
            </button>
          ))}
        </div>
      </section>

      {/* Language */}
      <section className="mb-8">
        <h3
          className="text-sm font-medium mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          언어
        </h3>
        <div className="flex gap-2">
          {([
            { id: "ko", label: "한국어" },
            { id: "en", label: "English" },
          ] as const).map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setLocale(l.id);
                updateProfile.mutate({ locale: l.id });
              }}
              className={cn(
                "px-4 py-2 rounded text-sm border",
                locale === l.id
                  ? "border-[#2383e2] font-medium"
                  : "border-transparent hover:bg-notion-bg-hover"
              )}
              style={{
                color: locale === l.id ? "var(--color-blue)" : "var(--text-secondary)",
                backgroundColor: locale === l.id ? "var(--color-blue-bg)" : undefined,
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
```

Wait — that has a local `cn` duplicate. Fix: remove the local `cn` at bottom, the import from `@/lib/utils` at top is correct.

`src/components/settings/account-settings.tsx` — use the import `cn` from `@/lib/utils` at top and remove the duplicate local function at the bottom.

- [ ] **Step 4: Create workspace settings**

`src/components/settings/workspace-settings.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

export function WorkspaceSettings({ workspaceId }: { workspaceId: string }) {
  const addToast = useToastStore((s) => s.addToast);

  const { data: memberships } = trpc.workspace.list.useQuery();
  const workspace = memberships?.find(
    (m) => m.workspaceId === workspaceId
  )?.workspace;

  const { data: members } = trpc.workspace.members.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const [name, setName] = useState(workspace?.name ?? "");
  const [inviteEmail, setInviteEmail] = useState("");

  const updateWorkspace = trpc.workspace.update.useMutation({
    onSuccess: () => {
      addToast({ message: "워크스페이스가 업데이트되었습니다", type: "success" });
    },
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  const inviteMember = trpc.workspace.inviteMember.useMutation({
    onSuccess: () => {
      addToast({ message: "멤버를 초대했습니다", type: "success" });
      setInviteEmail("");
    },
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  if (!workspace) return null;

  return (
    <div>
      <h2
        className="text-xl font-semibold mb-6"
        style={{ color: "var(--text-primary)" }}
      >
        워크스페이스
      </h2>

      {/* Workspace info */}
      <section className="mb-8">
        <h3
          className="text-sm font-medium mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          워크스페이스 정보
        </h3>
        <div className="flex flex-col gap-3 max-w-[400px]">
          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              이름
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button
            onClick={() => updateWorkspace.mutate({ id: workspaceId, name })}
            size="md"
            className="self-start"
          >
            저장
          </Button>
        </div>
      </section>

      {/* Members */}
      <section className="mb-8">
        <h3
          className="text-sm font-medium mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          멤버 ({members?.length ?? 0})
        </h3>

        {/* Member list */}
        <div className="flex flex-col gap-1 mb-4">
          {members?.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between px-3 py-2 rounded"
              style={{ fontSize: "14px" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
                  style={{
                    backgroundColor: "var(--color-blue-bg)",
                    color: "var(--color-blue)",
                  }}
                >
                  {member.user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: "var(--text-primary)" }}>
                    {member.user.name}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {member.user.email}
                  </div>
                </div>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  color: "var(--text-secondary)",
                  backgroundColor: "var(--bg-secondary)",
                }}
              >
                {member.role}
              </span>
            </div>
          ))}
        </div>

        {/* Invite */}
        <div className="flex gap-2 max-w-[400px]">
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="이메일로 초대"
            type="email"
          />
          <Button
            onClick={() =>
              inviteMember.mutate({
                workspaceId,
                email: inviteEmail,
                role: "MEMBER",
              })
            }
            disabled={!inviteEmail}
          >
            초대
          </Button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Create settings page**

`src/app/(main)/[workspaceId]/settings/page.tsx`:

```tsx
import { SettingsLayout } from "@/components/settings/settings-layout";

export default function SettingsPage({
  params,
}: {
  params: { workspaceId: string };
}) {
  return <SettingsLayout workspaceId={params.workspaceId} />;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/user.ts src/components/settings/ src/app/\(main\)/\[workspaceId\]/settings/
git commit -m "feat: add settings page with account (profile, theme, language) and workspace (members, invite)"
```

---

## Task 17: Wire Up Keyboard Shortcuts

**Files:**
- Create: `src/components/shortcuts-provider.tsx`
- Modify: `src/components/providers.tsx`

- [ ] **Step 1: Create shortcuts provider**

`src/components/shortcuts-provider.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { shortcutManager } from "@/lib/shortcuts/manager";
import { useSidebarStore } from "@/stores/sidebar";
import { useCommandPaletteStore } from "@/stores/command-palette";
import { useThemeStore } from "@/stores/theme";

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const togglePalette = useCommandPaletteStore((s) => s.toggle);
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    shortcutManager.register({
      id: "toggle-sidebar",
      key: "\\",
      meta: true,
      handler: () => toggleSidebar(),
    });

    shortcutManager.register({
      id: "command-palette",
      key: "k",
      meta: true,
      handler: () => togglePalette(),
    });

    shortcutManager.register({
      id: "search",
      key: "p",
      meta: true,
      handler: () => togglePalette(),
    });

    shortcutManager.register({
      id: "toggle-dark-mode",
      key: "d",
      meta: true,
      shift: true,
      handler: () => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
      },
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      shortcutManager.handleKeyDown(e);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      shortcutManager.unregister("toggle-sidebar");
      shortcutManager.unregister("command-palette");
      shortcutManager.unregister("search");
      shortcutManager.unregister("toggle-dark-mode");
    };
  }, [toggleSidebar, togglePalette, theme, setTheme]);

  return <>{children}</>;
}
```

- [ ] **Step 2: Add ShortcutsProvider to providers**

Modify `src/components/providers.tsx` — wrap children with `ShortcutsProvider`:

```tsx
import { ShortcutsProvider } from "@/components/shortcuts-provider";
import { ToastContainer } from "@/components/ui/toast-container";

// Inside Providers return:
<trpc.Provider client={trpcClient} queryClient={queryClient}>
  <QueryClientProvider client={queryClient}>
    <ShortcutsProvider>
      {children}
    </ShortcutsProvider>
    <ToastContainer />
  </QueryClientProvider>
</trpc.Provider>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shortcuts-provider.tsx src/components/providers.tsx
git commit -m "feat: wire up global keyboard shortcuts (Cmd+K, Cmd+\\, Cmd+Shift+D)"
```

---

## Task 18: Middleware (Auth Guard)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create auth middleware**

`src/middleware.ts`:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // Redirect to home if already logged in
    const token = request.cookies.get("session-token")?.value;
    if (token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Allow API routes
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Require auth for everything else
  const token = request.cookies.get("session-token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware — redirect to login when unauthenticated"
```

---

## Task 19: Final Integration & Build Verification

**Files:**
- No new files. Verification task.

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Run dev server and verify manually**

```bash
pnpm dev
```

Verify:
- `/login` shows login page with Notion-style UI
- `/signup` shows signup page
- After signup, redirects to workspace
- Sidebar shows with correct width, resizable
- Cmd+K opens command palette
- Cmd+\\ toggles sidebar
- Cmd+Shift+D toggles dark/light mode
- Settings page accessible with account + workspace tabs
- Toast notifications appear on actions

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: SP-1 project foundation complete — auth, layout, shortcuts, toast, i18n, settings"
```
