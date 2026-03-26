# SP-4: Real-time Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Notion-identical real-time collaboration — multiple users editing the same page simultaneously with live cursors, user presence, and conflict-free merging via CRDT.

**Architecture:** Yjs (CRDT library) syncs editor state between clients. Hocuspocus WebSocket server handles document persistence (Yjs → PostgreSQL) and authentication. Tiptap's built-in Yjs extension (`@tiptap/extension-collaboration` and `@tiptap/extension-collaboration-cursor`) connects the editor to Yjs. The existing tRPC-based bulkSave is replaced by Yjs persistence for collaborative documents.

**Tech Stack:** Yjs, @hocuspocus/server, @hocuspocus/extension-database, @tiptap/extension-collaboration, @tiptap/extension-collaboration-cursor, y-prosemirror, WebSocket

---

## File Structure

```
src/
├── server/
│   └── collaboration/
│       ├── hocuspocus.ts               # Hocuspocus server setup + auth + DB persistence
│       └── start-server.ts             # Standalone script to run WS server
├── components/
│   ├── editor/
│   │   ├── editor.tsx                  # Modify: add Yjs collaboration extensions
│   │   ├── collaborative-editor.tsx    # New: wraps editor with Yjs provider
│   │   └── cursor-styles.css           # New: remote cursor + user label CSS
│   └── layout/
│       └── topbar.tsx                  # Modify: add presence avatars
├── lib/
│   └── collaboration/
│       └── provider.ts                 # New: YjsProvider (HocuspocusProvider wrapper)
├── stores/
│   └── presence.ts                     # New: online users store
├── app/
│   └── (main)/[workspaceId]/[pageId]/
│       └── page.tsx                    # Modify: use CollaborativeEditor
```

---

## Task 1: Install Dependencies & Hocuspocus Server

**Files:**
- Create: `src/server/collaboration/hocuspocus.ts`, `src/server/collaboration/start-server.ts`

- [ ] **Step 1: Install collaboration dependencies**

```bash
cd "/Users/dgsw36/Desktop/01_프로젝트-개발/앱-도구/Notion Web"
pnpm add yjs @hocuspocus/server @hocuspocus/extension-database @tiptap/extension-collaboration @tiptap/extension-collaboration-cursor y-prosemirror
```

- [ ] **Step 2: Create Hocuspocus server**

`src/server/collaboration/hocuspocus.ts`:

```typescript
import { Hocuspocus } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Store Yjs documents as binary in a dedicated column
// We'll use the Page model's existing structure and add a yjsState column

export function createHocuspocusServer() {
  return new Hocuspocus({
    port: 4000,
    address: "0.0.0.0",

    async onAuthenticate({ token, documentName }) {
      // Token is the session token from cookies
      if (!token) throw new Error("No auth token");

      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: { select: { id: true, email: true, name: true } } },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new Error("Invalid or expired session");
      }

      // documentName format: "page:{pageId}"
      const pageId = documentName.replace("page:", "");
      const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { workspaceId: true },
      });

      if (!page) throw new Error("Page not found");

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: session.user.id,
            workspaceId: page.workspaceId,
          },
        },
      });

      if (!membership) throw new Error("No access");

      return {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
        },
      };
    },

    extensions: [
      new Database({
        async fetch({ documentName }) {
          const pageId = documentName.replace("page:", "");
          const page = await prisma.page.findUnique({
            where: { id: pageId },
            select: { yjsState: true },
          });

          if (page?.yjsState) {
            return Buffer.from(page.yjsState as string, "base64");
          }

          return null;
        },

        async store({ documentName, state }) {
          const pageId = documentName.replace("page:", "");
          await prisma.page.update({
            where: { id: pageId },
            data: { yjsState: Buffer.from(state).toString("base64") },
          });
        },
      }),
    ],
  });
}
```

- [ ] **Step 3: Create server start script**

`src/server/collaboration/start-server.ts`:

```typescript
import { createHocuspocusServer } from "./hocuspocus";

const server = createHocuspocusServer();

server.listen().then(() => {
  console.log("Hocuspocus collaboration server running on port 4000");
});
```

- [ ] **Step 4: Add yjsState column to Page model**

In `prisma/schema.prisma`, add to the Page model:

```prisma
  yjsState    String?   @db.Text  // Base64-encoded Yjs document state
```

Run migration:
```bash
pnpm prisma generate
pnpm prisma db push
```

- [ ] **Step 5: Add server start script to package.json**

```json
{
  "scripts": {
    "collab": "tsx src/server/collaboration/start-server.ts"
  }
}
```

Install tsx if not present:
```bash
pnpm add -D tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/server/collaboration/ prisma/schema.prisma package.json pnpm-lock.yaml
git commit -m "feat(sp4): add Hocuspocus collaboration server with auth and DB persistence"
```

---

## Task 2: Yjs Provider & Collaborative Editor

**Files:**
- Create: `src/lib/collaboration/provider.ts`, `src/components/editor/collaborative-editor.tsx`, `src/components/editor/cursor-styles.css`
- Modify: `src/components/editor/editor.tsx`

- [ ] **Step 1: Create Yjs provider wrapper**

`src/lib/collaboration/provider.ts`:

```typescript
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";

export type CollaborationUser = {
  id: string;
  name: string;
  color: string;
};

const USER_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
  "#F1948A", "#82E0AA", "#F8C471", "#AED6F1", "#D2B4DE",
  "#A3E4D7", "#FAD7A0", "#D5DBDB", "#ABEBC6", "#F9E79F",
];

export function getColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export function createCollaborationProvider({
  pageId,
  token,
  user,
}: {
  pageId: string;
  token: string;
  user: CollaborationUser;
}) {
  const ydoc = new Y.Doc();

  const provider = new HocuspocusProvider({
    url: process.env.NEXT_PUBLIC_COLLAB_URL || "ws://localhost:4000",
    name: `page:${pageId}`,
    document: ydoc,
    token,
    onAuthenticationFailed: () => {
      console.error("Collaboration auth failed");
    },
  });

  return { ydoc, provider };
}
```

- [ ] **Step 2: Create cursor styles**

`src/components/editor/cursor-styles.css`:

```css
/* Remote user cursors */
.collaboration-cursor__caret {
  position: relative;
  margin-left: -1px;
  margin-right: -1px;
  border-left: 2px solid;
  border-right: 0;
  word-break: normal;
  pointer-events: none;
}

.collaboration-cursor__label {
  position: absolute;
  top: -1.6em;
  left: -1px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  color: #fff;
  padding: 1px 6px;
  border-radius: 6px 6px 6px 0;
  user-select: none;
  pointer-events: none;
  font-family: var(--notion-font-family);
}

/* Selection highlight for remote users */
.collaboration-cursor__selection {
  opacity: 0.2;
}
```

- [ ] **Step 3: Create collaborative editor wrapper**

`src/components/editor/collaborative-editor.tsx`:

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { NotionEditor } from "./editor";
import { createCollaborationProvider, getColorForUser, type CollaborationUser } from "@/lib/collaboration/provider";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";

type CollaborativeEditorProps = {
  pageId: string;
  sessionToken: string;
  user: { id: string; name: string };
  isLocked?: boolean;
};

export function CollaborativeEditor({
  pageId,
  sessionToken,
  user,
  isLocked = false,
}: CollaborativeEditorProps) {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const providerRef = useRef<HocuspocusProvider | null>(null);

  useEffect(() => {
    const collabUser: CollaborationUser = {
      id: user.id,
      name: user.name,
      color: getColorForUser(user.id),
    };

    const { ydoc: doc, provider: prov } = createCollaborationProvider({
      pageId,
      token: sessionToken,
      user: collabUser,
    });

    prov.on("synced", () => setIsConnected(true));
    prov.on("disconnect", () => setIsConnected(false));

    setYdoc(doc);
    setProvider(prov);
    providerRef.current = prov;

    return () => {
      prov.destroy();
      doc.destroy();
    };
  }, [pageId, sessionToken, user.id, user.name]);

  if (!provider || !ydoc) {
    return (
      <div className="py-8 text-center" style={{ color: "var(--text-tertiary)" }}>
        연결 중...
      </div>
    );
  }

  return (
    <div>
      {/* Connection status */}
      {!isConnected && (
        <div
          className="mb-2 px-3 py-1 rounded text-xs"
          style={{ backgroundColor: "var(--color-yellow-bg)", color: "var(--color-orange)" }}
        >
          오프라인 — 변경 사항이 로컬에 저장됩니다
        </div>
      )}

      <NotionEditor
        collaboration={{
          ydoc,
          provider,
          user: { id: user.id, name: user.name, color: getColorForUser(user.id) },
        }}
        editable={!isLocked}
      />
    </div>
  );
}
```

- [ ] **Step 4: Modify editor to support collaboration mode**

Update `src/components/editor/editor.tsx` to accept optional `collaboration` prop and add Yjs extensions when provided:

```typescript
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import "./cursor-styles.css";

type CollaborationConfig = {
  ydoc: any; // Y.Doc
  provider: any; // HocuspocusProvider
  user: { id: string; name: string; color: string };
};

type NotionEditorProps = {
  initialContent?: Record<string, unknown>;
  onUpdate?: (json: Record<string, unknown>) => void;
  editable?: boolean;
  collaboration?: CollaborationConfig;
};
```

In the `useEditor` hook, conditionally add collaboration extensions:

```typescript
const collaborationExtensions = collaboration
  ? [
      Collaboration.configure({ document: collaboration.ydoc }),
      CollaborationCursor.configure({
        provider: collaboration.provider,
        user: {
          name: collaboration.user.name,
          color: collaboration.user.color,
        },
      }),
    ]
  : [];

const editor = useEditor({
  extensions: [
    // ... existing extensions ...
    ...collaborationExtensions,
  ],
  // When using collaboration, don't set initial content — Yjs manages it
  content: collaboration ? undefined : (initialContent || { type: "doc", content: [{ type: "paragraph" }] }),
  editable,
  onUpdate: collaboration ? undefined : ({ editor }) => {
    onUpdate?.(editor.getJSON() as Record<string, unknown>);
  },
  // ...
});
```

When collaboration is active, `onUpdate` is not needed because Yjs handles persistence via Hocuspocus.

- [ ] **Step 5: Verify build**

```bash
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/collaboration/ src/components/editor/ package.json pnpm-lock.yaml
git commit -m "feat(sp4): add Yjs collaboration provider, collaborative editor, cursor styles"
```

---

## Task 3: Presence (Online Users) in Topbar

**Files:**
- Create: `src/stores/presence.ts`
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Create presence store**

`src/stores/presence.ts`:

```typescript
import { create } from "zustand";

export type PresenceUser = {
  id: string;
  name: string;
  color: string;
};

type PresenceStore = {
  users: PresenceUser[];
  setUsers: (users: PresenceUser[]) => void;
};

export const usePresenceStore = create<PresenceStore>((set) => ({
  users: [],
  setUsers: (users) => set({ users }),
}));
```

- [ ] **Step 2: Update CollaborativeEditor to track presence**

In `src/components/editor/collaborative-editor.tsx`, add awareness listener:

```typescript
import { usePresenceStore } from "@/stores/presence";
import { getColorForUser } from "@/lib/collaboration/provider";

// Inside the useEffect, after setting up provider:
const awareness = prov.awareness;

const updatePresence = () => {
  const states = awareness.getStates();
  const users: { id: string; name: string; color: string }[] = [];
  states.forEach((state: any, clientId: number) => {
    if (state.user && clientId !== awareness.clientID) {
      users.push({
        id: state.user.id || String(clientId),
        name: state.user.name || "Anonymous",
        color: state.user.color || getColorForUser(String(clientId)),
      });
    }
  });
  usePresenceStore.getState().setUsers(users);
};

awareness.on("change", updatePresence);

// Set own user info
awareness.setLocalStateField("user", {
  id: collabUser.id,
  name: collabUser.name,
  color: collabUser.color,
});

// Cleanup:
return () => {
  awareness.off("change", updatePresence);
  usePresenceStore.getState().setUsers([]);
  prov.destroy();
  doc.destroy();
};
```

- [ ] **Step 3: Add presence avatars to topbar**

Modify `src/components/layout/topbar.tsx` — add between breadcrumb and action buttons:

```tsx
import { usePresenceStore } from "@/stores/presence";

// Inside Topbar component:
const presenceUsers = usePresenceStore((s) => s.users);

// In JSX, between breadcrumb div and actions div:
{presenceUsers.length > 0 && (
  <div className="flex items-center -space-x-2 mx-2">
    {presenceUsers.slice(0, 5).map((user) => (
      <div
        key={user.id}
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2"
        style={{
          backgroundColor: user.color,
          color: "#fff",
          borderColor: "var(--bg-primary)",
        }}
        title={user.name}
      >
        {user.name.charAt(0).toUpperCase()}
      </div>
    ))}
    {presenceUsers.length > 5 && (
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2"
        style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", borderColor: "var(--bg-primary)" }}
      >
        +{presenceUsers.length - 5}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/stores/presence.ts src/components/editor/collaborative-editor.tsx src/components/layout/topbar.tsx
git commit -m "feat(sp4): add presence tracking with user avatars in topbar"
```

---

## Task 4: Page View Integration

**Files:**
- Modify: `src/app/(main)/[workspaceId]/[pageId]/page.tsx`, `src/components/editor/page-editor.tsx`

- [ ] **Step 1: Update page view to pass session token**

The page view needs to pass the session token to the collaborative editor. Read the cookie server-side and pass it as a prop.

Update `src/app/(main)/[workspaceId]/[pageId]/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { getServerSession } from "@/server/auth/session";

// Inside PageView:
const session = await getServerSession();
const cookieStore = await cookies();
const sessionToken = cookieStore.get("session-token")?.value || "";

// Pass to PageEditor:
<PageEditor
  pageId={page.id}
  initialBlocks={...}
  isLocked={page.isLocked}
  sessionToken={sessionToken}
  user={session ? { id: session.user.id, name: session.user.name } : undefined}
/>
```

- [ ] **Step 2: Update PageEditor to use CollaborativeEditor when available**

Update `src/components/editor/page-editor.tsx`:

```tsx
import { CollaborativeEditor } from "./collaborative-editor";

type PageEditorProps = {
  pageId: string;
  initialBlocks: { id: string; type: string; content: unknown; position: number; parentId: string | null }[];
  isLocked?: boolean;
  sessionToken?: string;
  user?: { id: string; name: string };
};

export function PageEditor({ pageId, initialBlocks, isLocked, sessionToken, user }: PageEditorProps) {
  // Use collaborative editor if session info is available
  if (sessionToken && user) {
    return (
      <CollaborativeEditor
        pageId={pageId}
        sessionToken={sessionToken}
        user={user}
        isLocked={isLocked}
      />
    );
  }

  // Fallback: non-collaborative editor (existing behavior)
  // ... existing code with NotionEditor + bulkSave ...
}
```

Keep the existing non-collaborative path as fallback for when collaboration server is not running.

- [ ] **Step 3: Add NEXT_PUBLIC_COLLAB_URL to .env.local**

```env
NEXT_PUBLIC_COLLAB_URL=ws://localhost:4000
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/ src/components/editor/page-editor.tsx .env.local
git commit -m "feat(sp4): integrate collaborative editor into page view with session token"
```

---

## Task 5: Final Integration & Testing

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Note: Collaboration tests require a running Hocuspocus server, so unit tests will focus on non-collaboration paths. Integration testing requires manual verification with two browser windows.

- [ ] **Step 2: Run build**

```bash
pnpm build
```

- [ ] **Step 3: Manual verification**

Start both servers:
```bash
# Terminal 1:
pnpm dev

# Terminal 2:
pnpm collab
```

Verify with two browser tabs:
- Both connect to same page
- Typing in one tab appears in the other
- Remote cursor with name label is visible
- Presence avatars show in topbar
- Offline indicator appears when disconnecting collab server
- Reconnection automatically syncs

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(sp4): real-time collaboration complete — Yjs, cursors, presence, persistence"
```
