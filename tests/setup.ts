import "@testing-library/jest-dom/vitest";
import { beforeAll } from "vitest";

// Clean database before all tests to remove stale data
beforeAll(async () => {
  try {
    const { db } = await import("@/server/db/client");
    await db.session.deleteMany();
    await db.favorite.deleteMany();
    await db.page.deleteMany();
    await db.workspaceMember.deleteMany();
    await db.workspace.deleteMany();
    await db.user.deleteMany();
  } catch {
    // Ignore if db not available (e.g., component tests)
  }
});
