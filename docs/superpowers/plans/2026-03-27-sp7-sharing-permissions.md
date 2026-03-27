# SP-7: Sharing & Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement page-level sharing with per-user permissions (edit/comment/view), public links, guest invites, and permission inheritance from parent pages.

**Architecture:** New PagePermission Prisma model for page-level access control. Share dialog UI in topbar. Permission checks integrated into existing page/block routers. Public link via unique token on Page model.

**Tech Stack:** Prisma (PagePermission model), tRPC (share router), React (share dialog)

---

## Task 1: Prisma Schema + Share Router

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/server/routers/share.ts`, `tests/server/routers/share.test.ts`
- Modify: `src/server/trpc/router.ts`

Add PagePermission model, publicAccessToken/publicAccessLevel to Page. Create share router with: sharePage, updatePermission, removePermission, listPermissions, enablePublicLink, disablePublicLink, getPublicAccess. Tests for all. Register router.

Commit: `feat(sp7): add PagePermission model and share router`

## Task 2: Share Dialog UI

**Files:**
- Create: `src/components/share/share-dialog.tsx`, `src/components/share/permission-row.tsx`
- Modify: `src/components/layout/topbar.tsx`

Share dialog opened from topbar "공유" button. Shows: current permissions list, invite by email with role picker, public link toggle with access level dropdown, copy link button.

Commit: `feat(sp7): add share dialog with invite, permissions, public link`

## Task 3: Permission Enforcement

**Files:**
- Modify: `src/server/routers/page.ts`, `src/server/routers/block.ts`
- Create: `src/lib/permissions.ts`

Permission check utility that resolves effective permission for a user on a page (checking page-level, then parent inheritance, then workspace role). Integrate into page view, block mutations, and editor (read-only for view-only users).

Commit: `feat(sp7): enforce page-level permissions in page and block routers`

## Task 4: Public Page Access

**Files:**
- Create: `src/app/public/[token]/page.tsx`
- Modify: `src/middleware.ts`

Public page route accessible without login. Renders page content based on publicAccessLevel (read/comment/edit). Middleware allows /public/* routes without auth.

Commit: `feat(sp7): add public page access via shareable link`

## Task 5: Final Build

Run tests, build, commit.
