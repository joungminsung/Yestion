import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid-token", req.url));
  }

  const user = await db.user.findFirst({
    where: {
      verifyToken: token,
      verifyTokenExp: { gte: new Date() },
    },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=expired-token", req.url));
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verifyToken: null,
      verifyTokenExp: null,
    },
  });

  return NextResponse.redirect(new URL("/login?verified=true", req.url));
}
