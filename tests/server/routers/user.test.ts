import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db/client";
import { appRouter } from "@/server/trpc/router";
import { createCallerFactory } from "@/server/trpc/init";

const createCaller = createCallerFactory(appRouter);

async function createTestUser() {
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

  return result;
}

describe("user router", () => {
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

  describe("me", () => {
    it("should return the current user's profile", async () => {
      const { user } = await createTestUser();

      const caller = createCaller({
        db,
        session: { user: { id: user.id, email: user.email, name: user.name }, token: "test-token" },
        headers: new Headers(),
      });

      const me = await caller.user.me();

      expect(me.id).toBe(user.id);
      expect(me.email).toBe("test@example.com");
      expect(me.name).toBe("Test User");
      expect(me).toHaveProperty("locale");
      expect(me).toHaveProperty("theme");
    });

    it("should throw UNAUTHORIZED when not logged in", async () => {
      const caller = createCaller({
        db,
        session: null,
        headers: new Headers(),
      });

      await expect(caller.user.me()).rejects.toThrow();
    });
  });

  describe("updateProfile", () => {
    it("should update the user's name", async () => {
      const { user } = await createTestUser();

      const caller = createCaller({
        db,
        session: { user: { id: user.id, email: user.email, name: user.name }, token: "test-token" },
        headers: new Headers(),
      });

      const updated = await caller.user.updateProfile({ name: "New Name" });

      expect(updated.name).toBe("New Name");
      expect(updated.email).toBe("test@example.com");
    });

    it("should update the user's locale", async () => {
      const { user } = await createTestUser();

      const caller = createCaller({
        db,
        session: { user: { id: user.id, email: user.email, name: user.name }, token: "test-token" },
        headers: new Headers(),
      });

      const updated = await caller.user.updateProfile({ locale: "en" });

      expect(updated.locale).toBe("en");
    });

    it("should update the user's theme", async () => {
      const { user } = await createTestUser();

      const caller = createCaller({
        db,
        session: { user: { id: user.id, email: user.email, name: user.name }, token: "test-token" },
        headers: new Headers(),
      });

      const updated = await caller.user.updateProfile({ theme: "dark" });

      expect(updated.theme).toBe("dark");
    });
  });

  describe("changePassword", () => {
    it("should change password with correct current password", async () => {
      const { user } = await createTestUser();

      const caller = createCaller({
        db,
        session: { user: { id: user.id, email: user.email, name: user.name }, token: "test-token" },
        headers: new Headers(),
      });

      const result = await caller.user.changePassword({
        currentPassword: "password123",
        newPassword: "newpassword456",
      });

      expect(result.success).toBe(true);

      // Verify new password works by logging in
      const loginCaller = createCaller({
        db,
        session: null,
        headers: new Headers(),
      });

      const loginResult = await loginCaller.auth.login({
        email: "test@example.com",
        password: "newpassword456",
      });

      expect(loginResult.user.email).toBe("test@example.com");
    });

    it("should reject incorrect current password", async () => {
      const { user } = await createTestUser();

      const caller = createCaller({
        db,
        session: { user: { id: user.id, email: user.email, name: user.name }, token: "test-token" },
        headers: new Headers(),
      });

      await expect(
        caller.user.changePassword({
          currentPassword: "wrongpassword",
          newPassword: "newpassword456",
        })
      ).rejects.toThrow();
    });

    it("should reject new password shorter than 8 characters", async () => {
      const { user } = await createTestUser();

      const caller = createCaller({
        db,
        session: { user: { id: user.id, email: user.email, name: user.name }, token: "test-token" },
        headers: new Headers(),
      });

      await expect(
        caller.user.changePassword({
          currentPassword: "password123",
          newPassword: "short",
        })
      ).rejects.toThrow();
    });
  });
});
