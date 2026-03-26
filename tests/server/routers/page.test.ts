import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db/client";
import { appRouter } from "@/server/trpc/router";
import { createCallerFactory } from "@/server/trpc/init";
import bcrypt from "bcryptjs";

const createCaller = createCallerFactory(appRouter);

let userId: string;
let workspaceId: string;

async function setup() {
  const user = await db.user.create({
    data: {
      email: "page-test@example.com",
      name: "Page Tester",
      password: await bcrypt.hash("password123", 12),
    },
  });
  userId = user.id;

  const workspace = await db.workspace.create({
    data: {
      name: "Test Workspace",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  workspaceId = workspace.id;
}

function getCaller() {
  return createCaller({
    db,
    session: { user: { id: userId, email: "page-test@example.com", name: "Page Tester" } },
    headers: new Headers(),
  });
}

describe("page router", () => {
  beforeEach(async () => {
    await db.block.deleteMany();
    await db.favorite.deleteMany();
    await db.session.deleteMany();
    await db.page.deleteMany();
    await db.workspaceMember.deleteMany();
    await db.workspace.deleteMany();
    await db.user.deleteMany();
    await setup();
  });

  // ── create ──────────────────────────────────────────────────
  describe("create", () => {
    it("should create a page in a workspace", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "My Page" });
      expect(page.id).toBeDefined();
      expect(page.title).toBe("My Page");
      expect(page.workspaceId).toBe(workspaceId);
      expect(page.parentId).toBeNull();
    });

    it("should create a sub-page with parentId", async () => {
      const caller = getCaller();
      const parent = await caller.page.create({ workspaceId, title: "Parent" });
      const child = await caller.page.create({ workspaceId, title: "Child", parentId: parent.id });
      expect(child.parentId).toBe(parent.id);
    });

    it("should auto-increment position", async () => {
      const caller = getCaller();
      const p1 = await caller.page.create({ workspaceId, title: "First" });
      const p2 = await caller.page.create({ workspaceId, title: "Second" });
      expect(p2.position).toBeGreaterThan(p1.position);
    });
  });

  // ── list ────────────────────────────────────────────────────
  describe("list", () => {
    it("should return page tree excluding deleted pages", async () => {
      const caller = getCaller();
      await caller.page.create({ workspaceId, title: "Active Page" });
      const deleted = await caller.page.create({ workspaceId, title: "Deleted Page" });
      await caller.page.moveToTrash({ id: deleted.id });

      const pages = await caller.page.list({ workspaceId });
      expect(pages).toHaveLength(1);
      expect(pages[0].title).toBe("Active Page");
    });

    it("should return flat list including all depths", async () => {
      const caller = getCaller();
      const l1 = await caller.page.create({ workspaceId, title: "Level 1" });
      const l2 = await caller.page.create({ workspaceId, title: "Level 2", parentId: l1.id });
      const l3 = await caller.page.create({ workspaceId, title: "Level 3", parentId: l2.id });

      const pages = await caller.page.list({ workspaceId });
      // Flat list: all 3 levels returned + the "Active Page" from beforeEach
      expect(pages.length).toBeGreaterThanOrEqual(3);
      const ids = pages.map((p: { id: string }) => p.id);
      expect(ids).toContain(l1.id);
      expect(ids).toContain(l2.id);
      expect(ids).toContain(l3.id);
      // Verify parentId references are present
      const l2Page = pages.find((p: { id: string }) => p.id === l2.id);
      expect(l2Page?.parentId).toBe(l1.id);
      const l3Page = pages.find((p: { id: string }) => p.id === l3.id);
      expect(l3Page?.parentId).toBe(l2.id);
    });
  });

  // ── get ─────────────────────────────────────────────────────
  describe("get", () => {
    it("should return a single page with children and parent", async () => {
      const caller = getCaller();
      const parent = await caller.page.create({ workspaceId, title: "Parent" });
      const child = await caller.page.create({ workspaceId, title: "Child", parentId: parent.id });

      const result = await caller.page.get({ id: child.id });
      expect(result.title).toBe("Child");
      expect(result.parent?.id).toBe(parent.id);
    });
  });

  // ── update ──────────────────────────────────────────────────
  describe("update", () => {
    it("should update title, icon, cover, isFullWidth, isLocked", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Original" });

      const updated = await caller.page.update({
        id: page.id,
        title: "Updated",
        icon: "📄",
        cover: "https://example.com/cover.jpg",
        isFullWidth: true,
        isLocked: true,
      });

      expect(updated.title).toBe("Updated");
      expect(updated.icon).toBe("📄");
      expect(updated.cover).toBe("https://example.com/cover.jpg");
      expect(updated.isFullWidth).toBe(true);
      expect(updated.isLocked).toBe(true);
    });
  });

  // ── updateTitle ─────────────────────────────────────────────
  describe("updateTitle", () => {
    it("should update only the title", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Old Title" });

      const updated = await caller.page.updateTitle({ id: page.id, title: "New Title" });
      expect(updated.title).toBe("New Title");
    });
  });

  // ── moveToTrash / restore / deletePermanently ───────────────
  describe("trash", () => {
    it("should soft delete a page", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "To Delete" });

      const trashed = await caller.page.moveToTrash({ id: page.id });
      expect(trashed.isDeleted).toBe(true);
      expect(trashed.deletedAt).toBeDefined();
    });

    it("should restore a deleted page", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Restore Me" });
      await caller.page.moveToTrash({ id: page.id });

      const restored = await caller.page.restore({ id: page.id });
      expect(restored.isDeleted).toBe(false);
      expect(restored.deletedAt).toBeNull();
    });

    it("should permanently delete a page", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Gone Forever" });
      await caller.page.moveToTrash({ id: page.id });
      await caller.page.deletePermanently({ id: page.id });

      const found = await db.page.findUnique({ where: { id: page.id } });
      expect(found).toBeNull();
    });

    it("should list trashed pages", async () => {
      const caller = getCaller();
      await caller.page.create({ workspaceId, title: "Active" });
      const trashed = await caller.page.create({ workspaceId, title: "Trashed" });
      await caller.page.moveToTrash({ id: trashed.id });

      const result = await caller.page.listTrash({ workspaceId });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Trashed");
    });
  });

  // ── favorites ───────────────────────────────────────────────
  describe("favorites", () => {
    it("should add a page to favorites", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Fav Page" });

      const fav = await caller.page.addFavorite({ pageId: page.id });
      expect(fav.pageId).toBe(page.id);
      expect(fav.userId).toBe(userId);
    });

    it("should remove a page from favorites", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Unfav Page" });
      await caller.page.addFavorite({ pageId: page.id });

      await caller.page.removeFavorite({ pageId: page.id });
      const favs = await db.favorite.findMany({ where: { userId, pageId: page.id } });
      expect(favs).toHaveLength(0);
    });

    it("should list favorites for a workspace", async () => {
      const caller = getCaller();
      const p1 = await caller.page.create({ workspaceId, title: "Fav 1" });
      const p2 = await caller.page.create({ workspaceId, title: "Fav 2" });
      await caller.page.addFavorite({ pageId: p1.id });
      await caller.page.addFavorite({ pageId: p2.id });

      const result = await caller.page.listFavorites({ workspaceId });
      expect(result).toHaveLength(2);
    });
  });

  // ── updateIcon ──────────────────────────────────────────────
  describe("updateIcon", () => {
    it("should update the icon of a page", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Icon Page" });

      const updated = await caller.page.update({ id: page.id, icon: "🎯" });
      expect(updated.icon).toBe("🎯");
    });
  });

  // ── move ────────────────────────────────────────────────────
  describe("move", () => {
    it("should move a page to a different parent", async () => {
      const caller = getCaller();
      const parentA = await caller.page.create({ workspaceId, title: "Parent A" });
      const parentB = await caller.page.create({ workspaceId, title: "Parent B" });
      const child = await caller.page.create({ workspaceId, title: "Child", parentId: parentA.id });

      const moved = await caller.page.move({ id: child.id, parentId: parentB.id });
      expect(moved.parentId).toBe(parentB.id);
    });

    it("should move a page to root (null parentId)", async () => {
      const caller = getCaller();
      const parent = await caller.page.create({ workspaceId, title: "Parent" });
      const child = await caller.page.create({ workspaceId, title: "Child", parentId: parent.id });

      const moved = await caller.page.move({ id: child.id, parentId: null });
      expect(moved.parentId).toBeNull();
    });
  });

  // ── duplicate ───────────────────────────────────────────────
  describe("duplicate", () => {
    it("should duplicate a page with blocks and add (복사본) suffix", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Original" });
      // Add a block to the original
      await db.block.create({
        data: { pageId: page.id, type: "paragraph", content: { richText: [{ text: "Hello" }] }, position: 0 },
      });

      const dup = await caller.page.duplicate({ id: page.id });
      expect(dup.title).toBe("Original (복사본)");
      expect(dup.id).not.toBe(page.id);

      const blocks = await db.block.findMany({ where: { pageId: dup.id } });
      expect(blocks).toHaveLength(1);
      expect((blocks[0].content as any).richText[0].text).toBe("Hello");
    });
  });

  // ── reorder ─────────────────────────────────────────────────
  describe("reorder", () => {
    it("should batch update positions", async () => {
      const caller = getCaller();
      const p1 = await caller.page.create({ workspaceId, title: "First" });
      const p2 = await caller.page.create({ workspaceId, title: "Second" });

      await caller.page.reorder({
        pages: [
          { id: p2.id, position: 0 },
          { id: p1.id, position: 1 },
        ],
      });

      const pages = await caller.page.list({ workspaceId });
      expect(pages[0].id).toBe(p2.id);
      expect(pages[1].id).toBe(p1.id);
    });
  });
});
