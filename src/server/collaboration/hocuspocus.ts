import { Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const hocuspocus = new Server({
  port: Number(process.env.COLLAB_PORT) || 4000,

  async onAuthenticate({ token, documentName }) {
    if (!token) {
      throw new Error("No authentication token provided");
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      throw new Error("Invalid session token");
    }

    if (session.expiresAt < new Date()) {
      throw new Error("Session expired");
    }

    // C1: Document-level authorization — verify user has access to this page's workspace
    if (!documentName.startsWith("page:")) {
      throw new Error("Invalid document name");
    }
    const pageId = documentName.replace(/^page:/, "");

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { workspaceId: true, isLocked: true },
    });
    if (!page) {
      throw new Error("Page not found");
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.userId, workspaceId: page.workspaceId } },
    });
    if (!membership) {
      throw new Error("No access to this workspace");
    }

    // I6: Return readOnly flag when page is locked
    return {
      userId: session.userId,
      userName: session.user.name,
      readOnly: page.isLocked,
    };
  },

  // I6: Server-side page lock enforcement — reject writes on locked pages
  async onChange({ context }) {
    if (context.readOnly) {
      throw new Error("Page is locked");
    }
  },

  extensions: [
    new Database({
      async fetch({ documentName }) {
        // Document name format: page:{pageId}
        const pageId = documentName.replace(/^page:/, "");

        const page = await prisma.page.findUnique({
          where: { id: pageId },
          select: { yjsState: true },
        });

        // I5: yjsState is now Bytes — Prisma returns Buffer directly
        if (page?.yjsState) {
          return Buffer.from(page.yjsState);
        }

        return null;
      },

      async store({ documentName, state }) {
        const pageId = documentName.replace(/^page:/, "");

        // I5: Store as Buffer directly (Bytes column)
        await prisma.page.update({
          where: { id: pageId },
          data: { yjsState: Buffer.from(state) },
        });
      },
    }),
  ],
});
