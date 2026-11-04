const LOGO_URL = "/ankit-chaudhary-logo.webp";
const SOCIAL_TEXT = "Aane wala hai";
/** The visitor-facing WhatsApp channel used wherever the sites linked socials. */
const SOCIAL_HREF = "https://whatsapp.com/channel/0029VbDpUev9RZASnSmVTo3w";

/** Tokens that must never be touched by the text rewriting (asset paths, api urls). */
// The URL alternative excludes backslashes: inside Next.js flight/JSON strings a URL is
// followed by `\"`, and a greedy `[^...]` class would swallow the escape's `\`, leaving a
// raw `"` that breaks the surrounding JS string.
const PROTECTED = /(https?:\/\/[^\s"'<>\\)]+|[\w./-]+\.(?:jpg|jpeg|png|webp|gif|svg|ico|json|html|css|js|mp4|m3u8))/gi;

interface SiteConfig {
  id: "kgs" | "pw";
  origin: string;
  hostDomain: string;
  brand: string;
  /** Brand text shown on the floating switch pill that leads to the OTHER site. */
  switchHref: string;
  switchLabel: string;
  /** Text replaced with the brand name. */
  brandText: RegExp;
  /** Upstream logo image URLs replaced with our logo. */
  logoUrls: RegExp;
  /** Upstream domains removed from any text/URL. */
  hiddenHosts: RegExp;
  hiddenBareHosts: RegExp;
  /** Anchor hrefs matching this are replaced with SOCIAL_TEXT. */
  socialAnchors: RegExp;
}

const SITES: Record<"kgs" | "pw", SiteConfig> = {
  kgs: {
    id: "kgs",
    origin: "https://www.study-mate.in",
    hostDomain: "study-mate.in",
    brand: "Ankit Chaudhary X KGS Batches",
    switchHref: "/pw",
    switchLabel: "PW x Ankit Chaudhary",
    brandText:
      /Sunny\s*X\s*Khan\s*Global\s*Studies|Khan\s*Global\s*Studies|Sunny\s*Kgs|\bKGS\b|Sunny|\bAnkit\b/gi,
    logoUrls: /https?:\/\/i\.postimg\.cc\/(?:x1M0YN5Z\/sunny\.jpg|3rB8SZGp\/[^"'()\s>]+)/gi,
    hiddenHosts: /https?:\/\/(?:www\.)?study-mate\.in/gi,
    hiddenBareHosts: /study-mate\.in/gi,
    socialAnchors: /(?:t\.me|telegram\.me|whatsapp\.com)/i,
  },
  pw: {
    id: "pw",
    origin: "https://www.learnxpw.site",
    hostDomain: "learnxpw.site",
    brand: "PW x Ankit Chaudhary",
    switchHref: "/kgs",
    switchLabel: "KGS Batches",
    brandText: /Learn\s*x\s*pw|Study\s*Meta/gi,
    logoUrls: /https?:\/\/i\.ibb\.co\/V8CbjrG\/[^"'()\s>]+/gi,
    hiddenHosts:
      /https?:\/\/(?:www\.)?(?:learnxpw\.site|power-x-library\.netlify\.app)/gi,
    hiddenBareHosts: /(?:learnxpw\.site|power-x-library\.netlify\.app)/gi,
    socialAnchors: /(?:t\.me|telegram\.me|whatsapp\.com|power-x-library\.netlify\.app)/i,
  },
};

export type SiteId = keyof typeof SITES;

/** Picks the proxied site from the `site_mode` cookie (defaults to the KGS site). */
export function resolveSite(request: Request): SiteConfig {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)site_mode=(kgs|pw)(?:;|$)/);
  return SITES[(match?.[1] as SiteId) ?? "kgs"];
}

function rewriteUrls(site: SiteConfig, text: string): string {
  return text
    // brand logo -> ours
    .replace(site.logoUrls, LOGO_URL)
    // social URLs -> our own channel link (never the originals)
    .replace(/https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/[^\s"'<>)]*/gi, SOCIAL_HREF)
    .replace(
      /https?:\/\/(?:(?:www|chat|api)\.)?whatsapp\.com\/[^\s"'<>)]*/gi,
      SOCIAL_HREF,
    )
    // hide the original domains
    .replace(site.hiddenHosts, "")
    .replace(site.hiddenBareHosts, "");
}

function rewriteText(site: SiteConfig, text: string): string {
  return text
    .replace(site.brandText, site.brand)
    // preview/iframe safe navigation: top-frame nav & new tabs are blocked
    .replace(/window\.top\.location/g, "window.location")
    .replace(/window\.parent\.location/g, "window.location")
    // keep any JSON-escaping backslashes around the quotes intact: inside a
    // JSON string `target=\"_blank\"` must become `target=\"_self\"`, not
    // `target="_self"` (unescaped quotes invalidate the whole JSON payload)
    .replace(/target=(\\?["'])_blank(\\?["'])/g, (_m, q1: string, q2: string) => `target=${q1}_self${q2}`);
}

/** Applies branding rewrites while leaving URLs / file paths intact. */
export function rewriteBody(site: SiteConfig, body: string): string {
  // fullscreen support: every iframe gets allowfullscreen + autoplay/PII permissions
  body = body.replace(/<iframe\b[^>]*>/gi, (iframe) => {
    let tag = iframe;
    if (!/\ballowfull(?:screen)?\b/i.test(tag)) {
      tag = tag.replace(/\s*\/?\s*>$/, " allowfullscreen>");
    }
    if (!/\ballow\s*=/i.test(tag)) {
      tag = tag.replace(/\s*\/?\s*>$/, ' allow="autoplay; fullscreen; encrypted-media; picture-in-picture">');
    }
    return tag;
  });

  body = body.replace(/<img\b[^>]*>/gi, (image) => {
    const classes = image.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const className = classes?.slice(1).find(Boolean) ?? "";
    if (!/(?:^|\s)logo-img(?:\s|$)/i.test(className)) return image;

    const withoutSrcset = image.replace(/\s+srcset\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, "");
    if (/\bsrc\s*=/i.test(withoutSrcset)) {
      return withoutSrcset.replace(
        /\bsrc\s*=\s*(?:"[^"]*"|'([^']*)'|[^\s>]+)/i,
        `src="${LOGO_URL}"`,
      );
    }
    return withoutSrcset.replace(/\s*\/?\s*>$/, ` src="${LOGO_URL}">`);
  });

  body = body.replace(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi, (anchor) => {
    const openingTag = anchor.match(/^<a\b[^>]*>/i)?.[0] ?? "";
    const hrefMatch = openingTag.match(
      /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const href = hrefMatch?.slice(1).find(Boolean) ?? "";
    return site.socialAnchors.test(href)
      ? `<a href="${SOCIAL_HREF}" target="_self" rel="noopener noreferrer">${SOCIAL_TEXT}</a>`
      : anchor;
  });

  let out = "";
  let last = 0;
  PROTECTED.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PROTECTED.exec(body)) !== null) {
    out += rewriteText(site, body.slice(last, m.index));
    out += rewriteUrls(site, m[0]);
    last = m.index + m[0].length;
  }
  out += rewriteText(site, body.slice(last));
  return out;
}

// Next.js streams its RSC payload as several `self.__next_f.push([1,"..."])` script
// chunks, and a chunk boundary can split a URL or brand phrase mid-token — rewriting
// them separately corrupts the payload (a logo URL split as `...image.` / `png...`
// becomes `.webp.png`). Reassemble the chunks, rewrite once, then emit the whole
// payload from the first chunk and leave the rest empty.
const FLIGHT_PUSH = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
const FLIGHT_PLACEHOLDER = "__LOVABLE_FLIGHT_PAYLOAD__";

export function rewriteHtml(site: SiteConfig, html: string): string {
  const pushes = [...html.matchAll(FLIGHT_PUSH)];
  if (pushes.length < 2) return rewriteBody(site, html);

  let payload = "";
  for (const push of pushes) {
    const literal = push[1];
    if (!literal) return rewriteBody(site, html);
    try {
      payload += JSON.parse(literal) as string;
    } catch {
      return rewriteBody(site, html); // unexpected escape — fall back to per-chunk rewriting
    }
  }

  let out = "";
  let last = 0;
  pushes.forEach((push, i) => {
    out += html.slice(last, push.index);
    if (i === 0) out += FLIGHT_PLACEHOLDER;
    last = push.index + push[0].length;
  });
  out += html.slice(last);

  out = rewriteBody(site, out);
  const encoded = JSON.stringify(rewriteBody(site, payload))
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  // replacer function: the payload is full of `$` sequences React flight treats
  // specially, and `$&`-style patterns in a plain replacement string would corrupt it
  return out.replace(FLIGHT_PLACEHOLDER, () => `self.__next_f.push([1,${encoded}])`);
}

const HOP_BY_HOP = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "strict-transport-security",
  "set-cookie",
]);

// Forward everything the browser sends (cookies, auth tokens, custom headers) so
// upstream APIs that rely on session cookies / verification keys see the real
// caller. Only transport-level and unsafe-to-override headers are dropped.
const STRIPPED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "upgrade",
  "proxy-connection",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "content-length",
  "accept-encoding",
  "if-modified-since",
  "if-none-match",
  "cf-connecting-ip",
  "cf-ray",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-forwarded-host",
  "x-real-ip",
]);

function switcherPill(site: SiteConfig): string {
  return `<a href="${site.switchHref}" id="site-switcher" style="position:fixed;left:12px;bottom:12px;z-index:2147483000;display:inline-flex;align-items:center;gap:8px;padding:9px 15px;border-radius:999px;background:linear-gradient(135deg,#111827,#1f2937);color:#fff;font:600 13px/1 system-ui,-apple-system,sans-serif;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.18)"><img src="${LOGO_URL}" alt="" style="width:18px;height:18px;border-radius:50%;object-fit:cover"><span>${site.switchLabel}</span><span style="opacity:.65">▸</span></a>`;
}

export async function proxyRequest(
  request: Request,
  pathAndQuery: string,
  site: SiteConfig,
): Promise<Response> {
  const targetUrl = site.origin + (pathAndQuery.startsWith("/") ? "" : "/") + pathAndQuery;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set(
    "user-agent",
    request.headers.get("user-agent") ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  );
  headers.set("referer", site.origin + "/");

  const init: RequestInit = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(targetUrl, init);

  // follow redirects internally so the original host never leaks
  if (upstream.status >= 300 && upstream.status < 400) {
    const loc = upstream.headers.get("location");
    if (loc) {
      const abs = new URL(loc, targetUrl);
      const path = abs.hostname.endsWith(site.hostDomain)
        ? abs.pathname + abs.search
        : null;
      if (path) return proxyRequest(new Request(request.url, { method: "GET" }), path, site);
      return Response.redirect(abs.toString(), 302);
    }
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) outHeaders.set(key, value);
  });

  // pass upstream session cookies through, scoped to our own domain (upstream
  // Domain=/Secure attributes would otherwise be dropped by the browser)
  for (const cookie of upstream.headers.getSetCookie()) {
    outHeaders.append(
      "set-cookie",
      cookie
        .replace(/\s*domain=[^;]*/gi, "")
        .replace(/\s*path=[^;]*/gi, "path=/"),
    );
  }

  const isText =
    contentType.includes("text/html") ||
    contentType.includes("javascript") ||
    contentType.includes("text/css") ||
    contentType.includes("json") ||
    // Next.js RSC flight payloads (client-side navigation data)
    contentType.includes("x-component");

  if (isText) {
    const text = await upstream.text();
    let rewritten = contentType.includes("text/html")
      ? rewriteHtml(site, text)
      : rewriteBody(site, text);
    if (contentType.includes("text/html")) {
      const developerCredit = "<footer>Developer: Ankit G ❤️‍🩹</footer>";
      rewritten = rewritten.replace(/<\/body\s*>/i, `${switcherPill(site)}${developerCredit}</body>`);
    }
    return new Response(rewritten, {
      status: upstream.status,
      headers: outHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}
