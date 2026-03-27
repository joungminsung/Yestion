# SP-6: Media & Embeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file uploads (images, files), embed blocks (YouTube, Figma, CodePen, etc.), bookmark blocks with OG metadata, and image resize — using local file storage (MinIO-ready path) for on-premises deployment.

**Architecture:** File upload via Next.js API route to local disk (configurable to MinIO later). Image block enhanced with upload + resize. New embed block as custom Tiptap extension rendering iframes. Bookmark block fetches OG metadata server-side. Slash commands for all media types.

**Tech Stack:** Next.js API Routes (file upload), sharp (image processing), Tiptap custom extensions (embed, bookmark, video, audio, file blocks), open-graph-scraper (OG metadata)

---

## File Structure

```
src/
├── app/api/
│   └── upload/
│       └── route.ts                    # File upload API endpoint
├── server/routers/
│   └── media.ts                        # Media router (upload metadata, bookmark OG fetch)
├── components/editor/
│   ├── extensions/
│   │   ├── image-block.ts              # Enhanced: upload, URL, resize
│   │   ├── embed-block.ts             # New: iframe embeds (YouTube, Figma, etc.)
│   │   ├── bookmark-block.ts          # New: bookmark with OG preview
│   │   ├── video-block.ts             # New: video upload/URL
│   │   ├── audio-block.ts             # New: audio upload/URL
│   │   └── file-block.ts             # New: file attachment
│   ├── media/
│   │   ├── image-upload.tsx            # Image upload UI (upload, URL, drag&drop)
│   │   ├── embed-input.tsx            # Embed URL input
│   │   └── file-upload.tsx            # File/video/audio upload UI
│   └── slash-command/
│       └── slash-items.ts              # Modify: add media slash commands
├── lib/
│   └── upload.ts                       # Upload helper (client-side)
public/
└── uploads/                            # Local file storage directory
tests/
└── server/routers/
    └── media.test.ts
```

---

## Task 1: File Upload API + Upload Helper

**Files:**
- Create: `src/app/api/upload/route.ts`, `src/lib/upload.ts`

- [ ] **Step 1: Create upload API route**

`src/app/api/upload/route.ts` — handles multipart file upload, saves to `public/uploads/`, returns URL.

- Accepts POST with FormData (file field)
- Validates file size (max 50MB)
- Generates unique filename with timestamp
- Saves to `public/uploads/`
- Returns `{ url: "/uploads/filename.ext", name, size, type }`

- [ ] **Step 2: Create client upload helper**

`src/lib/upload.ts` — function to upload a File object and return the URL.

- [ ] **Step 3: Create uploads directory**

```bash
mkdir -p public/uploads
echo "*\n!.gitkeep" > public/uploads/.gitignore
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(sp6): add file upload API route and client helper"
```

---

## Task 2: Enhanced Image Block (Upload + Resize)

**Files:**
- Create: `src/components/editor/extensions/image-block.ts`, `src/components/editor/media/image-upload.tsx`
- Modify: `src/components/editor/editor.tsx`, `src/components/editor/slash-command/slash-items.ts`

- [ ] **Step 1: Create image upload component** — drag&drop zone, click to select file, paste URL input, preview
- [ ] **Step 2: Create enhanced image Tiptap extension** — custom NodeView with resize handles (drag corners to resize), caption support, alignment
- [ ] **Step 3: Update slash command** — replace basic image prompt with upload UI
- [ ] **Step 4: Add image resize CSS**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(sp6): add image upload with drag-drop, URL input, and resize handles"
```

---

## Task 3: Embed Block (YouTube, Figma, etc.)

**Files:**
- Create: `src/components/editor/extensions/embed-block.ts`, `src/components/editor/media/embed-input.tsx`

- [ ] **Step 1: Create embed extension** — custom Tiptap node that renders an iframe. Attributes: `url`, `width`, `height`. Parses URL to detect provider (YouTube, Vimeo, Figma, CodePen, CodeSandbox, Google Maps, Twitter, GitHub Gist) and converts to embed URL.
- [ ] **Step 2: Create embed URL input** — popover where user pastes URL, auto-detects provider, shows preview
- [ ] **Step 3: Add slash commands** — "임베드", "YouTube", "Google Maps"
- [ ] **Step 4: Add embed CSS**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(sp6): add embed block supporting YouTube, Figma, CodePen, and more"
```

---

## Task 4: Bookmark Block (OG Metadata)

**Files:**
- Create: `src/components/editor/extensions/bookmark-block.ts`, `src/server/routers/media.ts`
- Modify: `src/server/trpc/router.ts`

- [ ] **Step 1: Install open-graph-scraper**

```bash
pnpm add open-graph-scraper
```

- [ ] **Step 2: Create media router** with `fetchOgMetadata` procedure — takes URL, fetches OG tags, returns title/description/image/url
- [ ] **Step 3: Create bookmark extension** — renders a card with title, description, thumbnail, and link
- [ ] **Step 4: Add slash command** — "북마크"
- [ ] **Step 5: Register media router, commit**

```bash
git commit -m "feat(sp6): add bookmark block with OG metadata preview"
```

---

## Task 5: Video, Audio, File Blocks

**Files:**
- Create: `src/components/editor/extensions/video-block.ts`, `src/components/editor/extensions/audio-block.ts`, `src/components/editor/extensions/file-block.ts`, `src/components/editor/media/file-upload.tsx`

- [ ] **Step 1: Video block** — renders `<video>` with controls, accepts upload or URL
- [ ] **Step 2: Audio block** — renders `<audio>` with controls
- [ ] **Step 3: File block** — renders download link with file icon, name, size
- [ ] **Step 4: File upload component** — shared upload UI for video/audio/file
- [ ] **Step 5: Add slash commands** — "동영상", "오디오", "파일"
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(sp6): add video, audio, and file attachment blocks"
```

---

## Task 6: Final Integration & Build

- [ ] **Step 1: Run all tests** — `pnpm test`
- [ ] **Step 2: Run build** — `pnpm build`
- [ ] **Step 3: Final commit**

```bash
git commit -m "chore(sp6): media & embeds complete — upload, image resize, embeds, bookmarks, video/audio/file"
```
