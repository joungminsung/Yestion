import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db/client";
import { appRouter } from "@/server/trpc/router";
import { createCallerFactory } from "@/server/trpc/init";
import bcrypt from "bcryptjs";

const createCaller = createCallerFactory(appRouter);

let ownerId: string;
let targetUserId: string;
let workspaceId: string;
let pageId: string;

async function setup() {
  const owner = await db.user.create({
    data: { email: "owner@test.com", name: "Owner", password: await bcrypt.hash("password123", 12) },
  });
  ownerId = owner.id;

  const target = await db.user.create({
    data: { email: "target@test.com", name: "Target", password: await bcrypt.hash("password123", 12) },
  });
  targetUserId = target.id;

  const workspace = await db.workspace.create({
    data: { name: "Test WS", members: { create: { userId: owner.id, role: "OWNER" } } },
  });
  workspaceId = workspace.id;

  const page = await db.page.create({
    data: { workspaceId: workspace.id, title: "Test Page", createdBy: owner.id, lastEditedBy: owner.id },
  });
  pageId = page.id;
}

function getOwnerCaller() {
  return createCaller({ db, session: { user: { id: ownerId, email: "owner@test.com", name: "Owner" } }, headers: new Headers() });
}

describe("share router", () => {
  beforeEach(async () => {
    await db.pagePermission.deleteMany();
    await db.block.deleteMany();
    await db.session.deleteMany();
    await db.favorite.deleteMany();
    await db.page.deleteMany();
    await db.workspaceMember.deleteMany();
    await db.workspace.deleteMany();
    await db.user.deleteMany();
    await setup();
  });

  it("should share a page with a user", async () => {
    const caller = getOwnerCaller();
    const perm = await caller.share.sharePage({ pageId, email: "target@test.com", level: "edit" });
    expect(perm.userId).toBe(targetUserId);
    expect(perm.level).toBe("edit");
    expect(perm.user.email).toBe("target@test.com");
  });

  it("should list permissions for a page", async () => {
    const caller = getOwnerCaller();
    await caller.share.sharePage({ pageId, email: "target@test.com", level: "view" });
    const permissions = await caller.share.listPermissions({ pageId });
    expect(permissions).toHaveLength(1);
    expect(permissions[0].user.email).toBe("target@test.com");
  });

  it("should update a permission level", async () => {
    const caller = getOwnerCaller();
    const perm = await caller.share.sharePage({ pageId, email: "target@test.com", level: "view" });
    const updated = await caller.share.updatePermission({ id: perm.id, level: "edit" });
    expect(updated.level).toBe("edit");
  });

  it("should remove a permission", async () => {
    const caller = getOwnerCaller();
    const perm = await caller.share.sharePage({ pageId, email: "target@test.com", level: "view" });
    const result = await caller.share.removePermission({ id: perm.id });
    expect(result.success).toBe(true);
    const permissions = await caller.share.listPermissions({ pageId });
    expect(permissions).toHaveLength(0);
  });

  it("should enable a public link", async () => {
    const caller = getOwnerCaller();
    const result = await caller.share.enablePublicLink({ pageId, level: "view" });
    expect(result.publicAccessToken).toBeDefined();
    expect(result.publicAccessToken).toHaveLength(32);
    expect(result.publicAccessLevel).toBe("view");
  });

  it("should disable a public link", async () => {
    const caller = getOwnerCaller();
    await caller.share.enablePublicLink({ pageId, level: "view" });
    await caller.share.disablePublicLink({ pageId });
    const page = await caller.share.getPublicPage({ pageId });
    expect(page?.publicAccessToken).toBeNull();
    expect(page?.publicAccessLevel).toBeNull();
  });

  it("should upsert permission when sharing same user again", async () => {
    const caller = getOwnerCaller();
    await caller.share.sharePage({ pageId, email: "target@test.com", level: "view" });
    const updated = await caller.share.sharePage({ pageId, email: "target@test.com", level: "edit" });
    expect(updated.level).toBe("edit");
    const permissions = await caller.share.listPermissions({ pageId });
    expect(permissions).toHaveLength(1);
  });

  it("should throw NOT_FOUND when sharing with non-existent user", async () => {
    const caller = getOwnerCaller();
    await expect(
      caller.share.sharePage({ pageId, email: "nobody@test.com", level: "view" })
    ).rejects.toThrow();
  });
});
