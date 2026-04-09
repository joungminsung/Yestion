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
  });

  describe("list", () => {
    it("should return user workspaces", async () => {
      const { user } = await createTestUser();
      const caller = createCaller({
        db,
        session: { user: { id: user.id, email: user.email, name: user.name }, token: "test-token" },
        headers: new Headers(),
      });

      const result = await caller.workspace.list();
      expect(result).toHaveLength(1);
      expect(result[0]!.workspace.name).toBe("Test Workspace");
    });
  });

  describe("update", () => {
    it("should update workspace name and icon", async () => {
      const { user, workspace } = await createTestUser();
      const caller = createCaller({
        db,
        session: { user: { id: user.id, email: user.email, name: user.name }, token: "test-token" },
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
        session: { user: { id: user.id, email: user.email, name: user.name }, token: "test-token" },
        headers: new Headers(),
      });

      const result = await caller.workspace.members({ workspaceId: workspace.id });
      expect(result).toHaveLength(1);
      expect(result[0]!.user.email).toBe("test@example.com");
      expect(result[0]!.role).toBe("OWNER");
    });
  });
});
