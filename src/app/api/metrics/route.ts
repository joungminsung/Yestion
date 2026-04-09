import { NextRequest, NextResponse } from "next/server";
import { register } from "@/lib/metrics";

export async function GET(req: NextRequest) {
  try {
    // Metrics endpoint uses a bearer token for Prometheus scraping
    // instead of session auth (Prometheus cannot hold a browser session).
    // Always require authentication for metrics endpoint
    const metricsToken = process.env.METRICS_SECRET;
    if (!metricsToken) {
      return NextResponse.json({ error: "Metrics endpoint not configured" }, { status: 503 });
    }
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${metricsToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metrics = await register.metrics();
    return new NextResponse(metrics, {
      headers: {
        "Content-Type": register.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to collect metrics" }, { status: 500 });
  }
}
