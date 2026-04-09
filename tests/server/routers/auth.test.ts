import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db/client";
import { appRouter } from "@/server/trpc/router";
import { createCallerFactory } from "@/server/trpc/init";

const createCaller = createCallerFactory(appRouter);

describe("auth router", () => {
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
      // Token is no longer returned in response body (set via HttpOnly cookie instead)

      const memberships = await db.workspaceMember.findMany({
        where: { userId: result.user.id },
        include: { workspace: true },
      });
      expect(memberships).toHaveLength(1);
      expect(memberships[0]!.role).toBe("OWNER");
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
      // Token is no longer returned in response body (set via HttpOnly cookie instead)
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
