import { NextRequest } from "next/server";
import { getServerSession } from "@/server/auth/session";

export const runtime = "nodejs";

const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];
const TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 20 * 1024 * 1024; // 20MB

function isBlockedHost(hostname: string) {
  return (
    BLOCKED_HOSTS.includes(hostname) ||
    hostname.endsWith(".local") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

const STRIP_HEADERS = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-content-type-options",
  "strict-transport-security",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
  "permissions-policy",
]);

const PASSTHROUGH_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "last-modified",
  "expires",
];

// Script injected into HTML pages to intercept fetch/XHR and route through proxy
function getInjectionScript(baseOrigin: string) {
  return `<script data-proxy-injected>
(function() {
  var PROXY = "${baseOrigin}/api/proxy?url=";

  function rewrite(url, base) {
    if (!url || url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("javascript:")) return url;
    try {
      var resolved = new URL(url, base || document.baseURI);
      if (resolved.origin === window.location.origin) {
        // Already on our origin — check if it's a proxy URL
        if (resolved.pathname === "/api/proxy") return url;
        // It's a relative call that resolved to our origin — rewrite to upstream
        var docBase = document.querySelector("base");
        if (docBase) {
          resolved = new URL(url, docBase.href);
        }
      }
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        return PROXY + encodeURIComponent(resolved.href);
      }
    } catch(e) {}
    return url;
  }

  // Patch fetch
  var _fetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === "string") {
      input = rewrite(input);
    } else if (input instanceof Request) {
      input = new Request(rewrite(input.url), input);
    }
    return _fetch.call(this, input, init);
  };

  // Patch XMLHttpRequest
  var _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    arguments[1] = rewrite(url);
    return _xhrOpen.apply(this, arguments);
  };

  // Patch EventSource
  if (window.EventSource) {
    var _ES = window.EventSource;
    window.EventSource = function(url, config) {
      return new _ES(rewrite(url), config);
    };
    window.EventSource.prototype = _ES.prototype;
    window.EventSource.CONNECTING = _ES.CONNECTING;
    window.EventSource.OPEN = _ES.OPEN;
    window.EventSource.CLOSED = _ES.CLOSED;
  }

  // Patch WebSocket — can't proxy, but prevent errors
  // (WebSocket connections won't work through HTTP proxy)

  // Patch window.open
  var _open = window.open;
  window.open = function(url) {
    if (url) arguments[0] = rewrite(url);
    return _open.apply(this, arguments);
  };

  // Patch createElement for dynamic script/link/img
  var _createElement = document.createElement;
  document.createElement = function(tag) {
    var el = _createElement.apply(this, arguments);
    var tagLower = tag.toLowerCase();
    if (tagLower === "script" || tagLower === "img" || tagLower === "iframe" || tagLower === "link") {
      var srcProp = tagLower === "link" ? "href" : "src";
      var descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, srcProp) ||
        Object.getOwnPropertyDescriptor(el.__proto__, srcProp);
      if (descriptor && descriptor.set) {
        Object.defineProperty(el, srcProp, {
          set: function(v) { descriptor.set.call(this, rewrite(v)); },
          get: descriptor.get ? function() { return descriptor.get.call(this); } : undefined,
          configurable: true,
        });
      }
    }
    return el;
  };
})();
</script>`;
}

async function readBody(body: ReadableStream<Uint8Array> | null): Promise<Uint8Array | null> {
  if (!body) return null;
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      reader.cancel();
      return null; // too large
    }
    chunks.push(value);
  }

  if (chunks.length === 1) return chunks[0]!;
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const targetUrl = req.nextUrl.searchParams.get("url");
  if (!targetUrl) {
    return new Response("url parameter required", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return new Response("Only HTTP(S) URLs allowed", { status: 400 });
  }

  if (isBlockedHost(parsed.hostname)) {
    return new Response("Blocked host", { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const upstream = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: req.headers.get("accept") ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "identity", // don't request compressed — we need to modify body
        Referer: parsed.origin + "/",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    const contentType = upstream.headers.get("content-type") ?? "";
    const isHtml = contentType.includes("text/html");

    // Build clean response headers
    const responseHeaders = new Headers();
    for (const key of PASSTHROUGH_RESPONSE_HEADERS) {
      const val = upstream.headers.get(key);
      if (val) responseHeaders.set(key, val);
    }
    // Allow iframe embedding
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    if (!isHtml) {
      // Non-HTML: stream through directly
      const body = await readBody(upstream.body);
      if (!body) {
        return Response.redirect(targetUrl, 302);
      }
      return new Response(body as unknown as BodyInit, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    // HTML: read, inject proxy script, rewrite
    const rawBody = await readBody(upstream.body);
    if (!rawBody) {
      return Response.redirect(targetUrl, 302);
    }

    let html = new TextDecoder().decode(rawBody);
    const finalUrl = upstream.url || targetUrl;
    const baseOrigin = req.nextUrl.origin;

    // Inject <base> and proxy script as early as possible
    const injection = `<base href="${finalUrl}">` + getInjectionScript(baseOrigin);

    if (/<head[\s>]/i.test(html)) {
      html = html.replace(/<head([\s>])/i, `<head$1${injection}`);
    } else if (/<html[\s>]/i.test(html)) {
      html = html.replace(/<html([\s>])/i, `<html$1<head>${injection}</head>`);
    } else {
      html = injection + html;
    }

    // Rewrite meta refresh redirects
    html = html.replace(
      /(<meta[^>]*http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["']\d+;\s*url=)([^"']+)/gi,
      (_, prefix, url) => {
        try {
          const abs = new URL(url, finalUrl).href;
          return `${prefix}/api/proxy?url=${encodeURIComponent(abs)}`;
        } catch {
          return prefix + url;
        }
      },
    );

    responseHeaders.set("content-type", "text/html; charset=utf-8");
    return new Response(html, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return new Response("Upstream timeout", { status: 504 });
    }
    return new Response(`Proxy error: ${error instanceof Error ? error.message : "unknown"}`, {
      status: 502,
    });
  }
}
