import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/server/auth/session";

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
  // Block common cloud metadata endpoints
  if (hostname === "metadata.google.internal" || hostname.endsWith(".internal")) {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      redirect: "manual", // Prevent open redirect to internal hosts
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NotionWeb/1.0; +https://notion-web.app)",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);

    // Handle redirects: validate redirect target before following
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      const resolvedUrl = location ? new URL(location, url).toString() : null;
      if (!resolvedUrl || !isAllowedUrl(resolvedUrl)) {
        return NextResponse.json({ title: url, domain: new URL(url).hostname }, { status: 200 });
      }
      // Follow the allowed redirect to get actual metadata
      const redirectController = new AbortController();
      const redirectTimeout = setTimeout(() => redirectController.abort(), 5000);
      try {
        const redirectResponse = await fetch(resolvedUrl, {
          signal: redirectController.signal,
          redirect: "manual",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; NotionWeb/1.0; +https://notion-web.app)",
            Accept: "text/html",
          },
        });
        clearTimeout(redirectTimeout);
        if (!redirectResponse.ok || redirectResponse.status >= 300) {
          return NextResponse.json({ title: url, domain: new URL(url).hostname }, { status: 200 });
        }
        const redirectHtml = await redirectResponse.text();
        const getRedirectMeta = (property: string): string | null => {
          const regex = new RegExp(
            `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
            "i"
          );
          const match = redirectHtml.match(regex);
          return match?.[1] || match?.[2] || null;
        };
        const titleMatch = redirectHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
        return NextResponse.json({
          title: getRedirectMeta("og:title") || titleMatch?.[1]?.trim() || url,
          description: getRedirectMeta("og:description") || getRedirectMeta("description") || "",
          image: getRedirectMeta("og:image") || "",
          domain: new URL(resolvedUrl).hostname,
        });
      } catch {
        clearTimeout(redirectTimeout);
        return NextResponse.json({ title: url, domain: new URL(url).hostname }, { status: 200 });
      }
    }

    if (!response.ok) {
      return NextResponse.json({ title: url }, { status: 200 });
    }

    // Limit response body size to prevent memory exhaustion (1MB)
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 1_000_000) {
      return NextResponse.json({ title: url, domain: new URL(url).hostname }, { status: 200 });
    }

    const html = (await response.text()).slice(0, 1_000_000);

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
