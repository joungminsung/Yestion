import { cookies } from "next/headers";
import { db } from "@/server/db/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export type Session = {
  user: SessionUser;
};

export async function getServerSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session-token")?.value;

  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await db.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  return { user: session.user };
}
