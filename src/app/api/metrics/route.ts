import { NextResponse } from "next/server";
import { register } from "@/lib/metrics";

export async function GET() {
  try {
    const metrics = await register.metrics();
    return new NextResponse(metrics, {
      headers: {
        "Content-Type": register.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to collect metrics" }, { status: 500 });
  }
}
