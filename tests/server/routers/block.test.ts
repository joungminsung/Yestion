import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db/client";
import { appRouter } from "@/server/trpc/router";
import { createCallerFactory } from "@/server/trpc/init";
import bcrypt from "bcryptjs";

const createCaller = createCallerFactory(appRouter);

let userId: string;
let pageId: string;

async function setup() {
  const user = await db.user.create({
    data: { email: "editor@test.com", name: "Editor", password: await bcrypt.hash("password123", 12) },
  });
  userId = user.id;
  const workspace = await db.workspace.create({
    data: { name: "Test WS", members: { create: { userId: user.id, role: "OWNER" } } },
  });
  const page = await db.page.create({
    data: { workspaceId: workspace.id, title: "Test Page", createdBy: user.id, lastEditedBy: user.id },
  });
  pageId = page.id;
}

function getCaller() {
  return createCaller({ db, session: { user: { id: userId, email: "editor@test.com", name: "Editor" }, token: "test-token" }, headers: new Headers() });
}

describe("block router", () => {
  beforeEach(async () => {
    await db.activityLog.deleteMany();
    await db.notification.deleteMany();
    await db.block.deleteMany();
    await db.session.deleteMany();
    await db.favorite.deleteMany();
    await db.page.deleteMany();
    await db.workspaceChannelAuditLog.deleteMany();
    await db.workspaceChannelReadState.deleteMany();
    await db.workspaceChannelBrowserTab.deleteMany();
    await db.workspaceChannelBrowserSession.deleteMany();
    await db.workspaceChannelVoicePresence.deleteMany();
    await db.workspaceChannelMessage.deleteMany();
    await db.workspaceChannel.deleteMany();
    await db.workspaceMember.deleteMany();
    await db.workspace.deleteMany();
    await db.user.deleteMany();
    await setup();
  });

  it("should create a block", async () => {
    const caller = getCaller();
    const block = await caller.block.create({ pageId, type: "paragraph", content: { richText: [] }, position: 0 });
    expect(block.id).toBeDefined();
    expect(block.type).toBe("paragraph");
  });

  it("should list blocks for a page", async () => {
    await db.block.createMany({ data: [
      { pageId, type: "paragraph", content: {}, position: 0 },
      { pageId, type: "heading_1", content: {}, position: 1 },
    ]});
    const caller = getCaller();
    const blocks = await caller.block.list({ pageId });
    expect(blocks).toHaveLength(2);
  });

  it("should update a block", async () => {
    const block = await db.block.create({ data: { pageId, type: "paragraph", content: {}, position: 0 } });
    const caller = getCaller();
    const updated = await caller.block.update({ id: block.id, content: { richText: [{ text: "Updated" }] } });
    expect((updated.content as { richText: { text: string }[] }).richText[0]!.text).toBe("Updated");
  });

  it("should delete a block", async () => {
    const block = await db.block.create({ data: { pageId, type: "paragraph", content: {}, position: 0 } });
    const caller = getCaller();
    await caller.block.delete({ id: block.id });
    const found = await db.block.findUnique({ where: { id: block.id } });
    expect(found).toBeNull();
  });

  it("should reorder blocks", async () => {
    const b1 = await db.block.create({ data: { pageId, type: "paragraph", content: {}, position: 0 } });
    const b2 = await db.block.create({ data: { pageId, type: "paragraph", content: {}, position: 1 } });
    const caller = getCaller();
    await caller.block.reorder({ pageId, blocks: [{ id: b2.id, position: 0 }, { id: b1.id, position: 1 }] });
    const blocks = await caller.block.list({ pageId });
    expect(blocks[0]!.id).toBe(b2.id);
  });

  describe("bulkSave", () => {
    it("should create new blocks via upsert", async () => {
      const caller = getCaller();
      const blockId = "test-block-id-1";
      await caller.block.bulkSave({
        pageId,
        blocks: [
          { id: blockId, type: "paragraph", content: { richText: [] }, position: 0, parentId: null },
        ],
      });
      const blocks = await caller.block.list({ pageId });
      expect(blocks).toHaveLength(1);
      expect(blocks[0]!.id).toBe(blockId);
    });

    it("should delete blocks not in the input", async () => {
      const old = await db.block.create({ data: { pageId, type: "paragraph", content: {}, position: 0 } });
      const caller = getCaller();
      await caller.block.bulkSave({
        pageId,
        blocks: [
          { id: "new-block", type: "heading_1", content: { richText: [] }, position: 0, parentId: null },
        ],
      });
      const found = await db.block.findUnique({ where: { id: old.id } });
      expect(found).toBeNull();
      const blocks = await caller.block.list({ pageId });
      expect(blocks).toHaveLength(1);
      expect(blocks[0]!.type).toBe("heading_1");
    });

    it("should update existing blocks", async () => {
      const existing = await db.block.create({ data: { pageId, type: "paragraph", content: { richText: [] }, position: 0 } });
      const caller = getCaller();
      await caller.block.bulkSave({
        pageId,
        blocks: [
          { id: existing.id, type: "heading_2", content: { richText: [{ text: "Updated" }] }, position: 0, parentId: null },
        ],
      });
      const blocks = await caller.block.list({ pageId });
      expect(blocks).toHaveLength(1);
      expect(blocks[0]!.type).toBe("heading_2");
    });
  });
});
