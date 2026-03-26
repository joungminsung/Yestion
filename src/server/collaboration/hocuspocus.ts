import { Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const hocuspocus = new Server({
  port: Number(process.env.COLLAB_PORT) || 4000,

  async onAuthenticate({ token }) {
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

    return {
      userId: session.userId,
      userName: session.user.name,
    };
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

        if (page?.yjsState) {
          return Buffer.from(page.yjsState, "base64");
        }

        return null;
      },

      async store({ documentName, state }) {
        const pageId = documentName.replace(/^page:/, "");
        const base64State = Buffer.from(state).toString("base64");

        await prisma.page.update({
          where: { id: pageId },
          data: { yjsState: base64State },
        });
      },
    }),
  ],
});
