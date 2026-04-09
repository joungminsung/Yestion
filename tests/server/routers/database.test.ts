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
      email: "db-test@example.com",
      name: "DB Tester",
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
    session: { user: { id: userId, email: "db-test@example.com", name: "DB Tester" }, token: "test-token" },
    headers: new Headers(),
  });
}

describe("database router", () => {
  beforeEach(async () => {
    await db.activityLog.deleteMany();
    await db.notification.deleteMany();
    await db.rowTemplate.deleteMany();
    await db.row.deleteMany();
    await db.databaseView.deleteMany();
    await db.property.deleteMany();
    await db.database.deleteMany();
    await db.block.deleteMany();
    await db.favorite.deleteMany();
    await db.session.deleteMany();
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

  // ── create ──────────────────────────────────────────────────
  describe("create", () => {
    it("should create a database with page, default Title property, and default table view", async () => {
      const caller = getCaller();
      const database = await caller.database.create({ workspaceId, name: "Tasks" });

      expect(database.id).toBeDefined();
      expect(database.page.title).toBe("Tasks");
      expect(database.page.workspaceId).toBe(workspaceId);
      expect(database.isInline).toBe(false);

      // Default Title property
      expect(database.properties).toHaveLength(1);
      expect(database.properties[0]!.name).toBe("Title");
      expect(database.properties[0]!.type).toBe("title");
      expect(database.properties[0]!.position).toBe(0);

      // Default table view
      expect(database.views).toHaveLength(1);
      expect(database.views[0]!.name).toBe("Table View");
      expect(database.views[0]!.type).toBe("table");
      expect(database.views[0]!.position).toBe(0);
    });
  });

  // ── get ─────────────────────────────────────────────────────
  describe("get", () => {
    it("should return database with properties and views sorted by position", async () => {
      const caller = getCaller();
      const created = await caller.database.create({ workspaceId, name: "My DB" });

      // Add additional property
      await caller.database.addProperty({
        databaseId: created.id,
        name: "Status",
        type: "select",
      });

      const database = await caller.database.get({ databaseId: created.id });
      expect(database.id).toBe(created.id);
      expect(database.properties).toHaveLength(2);
      expect(database.properties[0]!.name).toBe("Title");
      expect(database.properties[1]!.name).toBe("Status");
      expect(database.views).toHaveLength(1);
    });
  });

  // ── addProperty ─────────────────────────────────────────────
  describe("addProperty", () => {
    it("should add a property with auto-incremented position", async () => {
      const caller = getCaller();
      const database = await caller.database.create({ workspaceId });

      const prop = await caller.database.addProperty({
        databaseId: database.id,
        name: "Status",
        type: "select",
        config: { options: [{ id: "1", name: "Todo", color: "gray" }] },
      });

      expect(prop.name).toBe("Status");
      expect(prop.type).toBe("select");
      expect(prop.position).toBe(1); // Title is 0
      expect((prop.config as { options: { id: string; name: string; color: string }[] }).options).toHaveLength(1);
    });
  });

  // ── updateProperty ──────────────────────────────────────────
  describe("updateProperty", () => {
    it("should update property name and visibility", async () => {
      const caller = getCaller();
      const database = await caller.database.create({ workspaceId });
      const prop = await caller.database.addProperty({
        databaseId: database.id,
        name: "Notes",
        type: "text",
      });

      const updated = await caller.database.updateProperty({
        id: prop.id,
        name: "Description",
        isVisible: false,
      });

      expect(updated.name).toBe("Description");
      expect(updated.isVisible).toBe(false);
    });
  });

  // ── deleteProperty ──────────────────────────────────────────
  describe("deleteProperty", () => {
    it("should delete a property", async () => {
      const caller = getCaller();
      const database = await caller.database.create({ workspaceId });
      const prop = await caller.database.addProperty({
        databaseId: database.id,
        name: "ToDelete",
        type: "text",
      });

      await caller.database.deleteProperty({ id: prop.id });

      const found = await db.property.findUnique({ where: { id: prop.id } });
      expect(found).toBeNull();
    });
  });

  // ── addView ─────────────────────────────────────────────────
  describe("addView", () => {
    it("should add a view with auto-incremented position", async () => {
      const caller = getCaller();
      const database = await caller.database.create({ workspaceId });

      const view = await caller.database.addView({
        databaseId: database.id,
        name: "Board View",
        type: "board",
      });

      expect(view.name).toBe("Board View");
      expect(view.type).toBe("board");
      expect(view.position).toBe(1); // default table view is 0
    });
  });

  // ── updateView ──────────────────────────────────────────────
  describe("updateView", () => {
    it("should merge config with existing", async () => {
      const caller = getCaller();
      const database = await caller.database.create({ workspaceId });
      const view = database.views[0]!;

      const updated = await caller.database.updateView({
        id: view!.id,
        config: { wrapCells: true },
      });

      expect((updated.config as { wrapCells: boolean }).wrapCells).toBe(true);
    });
  });

  // ── deleteView ──────────────────────────────────────────────
  describe("deleteView", () => {
    it("should delete a view", async () => {
      const caller = getCaller();
      const database = await caller.database.create({ workspaceId });
      const view = await caller.database.addView({
        databaseId: database.id,
        name: "Temp View",
        type: "list",
      });

      await caller.database.deleteView({ id: view.id });

      const found = await db.databaseView.findUnique({ where: { id: view.id } });
      expect(found).toBeNull();
    });
  });

  // ── addRow ──────────────────────────────────────────────────
  describe("addRow", () => {
    it("should create a row with its own page as child of database page", async () => {
      const caller = getCaller();
      const database = await caller.database.create({ workspaceId, name: "Tasks" });
      const titleProp = database.properties[0]!;

      const row = await caller.database.addRow({
        databaseId: database.id,
        values: { [titleProp!.id]: "My Task" },
      });

      expect(row.id).toBeDefined();
      expect(row.databaseId).toBe(database.id);
      expect(row.page).toBeDefined();
      expect(row.page!.title).toBe("My Task");

      // Verify the row page is a child of the database page
      const rowPage = await db.page.findUnique({ where: { id: row.pageId } });
      expect(rowPage!.parentId).toBe(database.pageId);
    });
  });

  // ── updateRow ───────────────────────────────────────────────
  describe("updateRow", () => {
    it("should merge new values with existing", async () => {
      const caller = getCaller();
      const database = await caller.database.create({ workspaceId });
      const titleProp = database.properties[0]!;

      const row = await caller.database.addRow({
        databaseId: database.id,
        values: { [titleProp!.id]: "Original" },
      });

      const updated = await caller.database.updateRow({
        id: row.id,
        values: { extraField: "new value" },
      });

      const vals = updated.values as Record<string, unknown>;
      expect(vals[titleProp!.id]).toBe("Original");
      expect(vals.extraField).toBe("new value");
    });
  });

  // ── deleteRow ───────────────────────────────────────────────
  describe("deleteRow", () => {
    it("should delete row and its page", async () => {
      const caller = getCaller();
      const database = await caller.database.create({ workspaceId });

      const row = await caller.database.addRow({
        databaseId: database.id,
        values: {},
      });

      await caller.database.deleteRow({ id: row.id });

      const foundRow = await db.row.findUnique({ where: { id: row.id } });
      expect(foundRow).toBeNull();

      const foundPage = await db.page.findUnique({ where: { id: row.pageId } });
      expect(foundPage).toBeNull();
    });
  });

  // ── queryRows ───────────────────────────────────────────────
  describe("queryRows", () => {
    it("should return all rows with page data sorted by createdAt", async () => {
      const caller = getCaller();
      const database = await caller.database.create({ workspaceId });
      const titleProp = database.properties[0]!;

      await caller.database.addRow({
        databaseId: database.id,
        values: { [titleProp!.id]: "First" },
      });
      await caller.database.addRow({
        databaseId: database.id,
        values: { [titleProp!.id]: "Second" },
      });

      const rows = await caller.database.queryRows({ databaseId: database.id });
      expect(rows).toHaveLength(2);
      expect(rows[0]!.page!.title).toBe("First");
      expect(rows[1]!.page!.title).toBe("Second");
    });
  });
});
