import { NextRequest, NextResponse } from "next/server";

function isAllowedUrl(input: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
    return false;
  }
  const parts = hostname.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const octets = parts.map(Number);
    const [a, b] = octets;
    if (
      a === 10 || a === 127 || a === 0 ||
      (a === 172 && b !== undefined && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    ) {
      return false;
    }
  }
  if (hostname.startsWith("[")) {
    const ipv6 = hostname.slice(1, -1).toLowerCase();
    if (ipv6 === "::1" || ipv6.startsWith("fc") || ipv6.startsWith("fd") || ipv6.startsWith("fe80")) {
      return false;
    }
  }
  return true;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    if (!isAllowedUrl(url)) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NotionWeb/1.0; +https://notion-web.app)",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ title: url }, { status: 200 });
    }

    const html = await response.text();

    // Parse OG tags from HTML
    const getMetaContent = (property: string): string | null => {
      // Match both property="..." and name="..."
      const regex = new RegExp(
        `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
        "i"
      );
      const match = html.match(regex);
      return match?.[1] || match?.[2] || null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);

    const title = getMetaContent("og:title") || titleMatch?.[1]?.trim() || url;
    const description = getMetaContent("og:description") || getMetaContent("description") || "";
    const image = getMetaContent("og:image") || "";
    const domain = new URL(url).hostname;

    return NextResponse.json({
      title,
      description,
      image,
      domain,
    });
  } catch {
    return NextResponse.json({ title: url, domain: "" }, { status: 200 });
  }
}
