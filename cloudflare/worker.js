/*
 * Cloudflare Worker — official hosted instance (app.iqbible.com) only.
 *
 * Forks and self-hosted copies deploy none of this: the app calls the IQ Bible
 * API directly with the key each visitor enters in Settings. See ../README.md
 * ("Self-hosting"), ./README.md, ../NOTES.md, ../CLAUDE.md.
 *
 * Two jobs, both just serving plumbing for anonymous end users — the same
 * documented exception to the app's "zero backend" design, not a GOLDEN-RULE
 * workaround (the API itself is fine):
 *
 *   1. API auth proxy. /api/v2/* is forwarded to api.iqbible.com/api/v2/* with
 *      the shared key from the IQBIBLE_API_KEY secret injected, so visitors
 *      never supply one. A request that already carries an X-API-Key header (a
 *      visitor using their own key) is passed through untouched.
 *
 *   2. Social link-preview cards. A shared Scripture URL (/gen/32, /jhn/3/16,
 *      /gal/5/14-16) is a single static SPA page with generic <meta> tags, and
 *      GitHub Pages serves deep links with a 404 status — so pasting one into
 *      LinkedIn / Slack / iMessage gives a poor unfurl or none at all. For
 *      those paths this Worker fetches the app shell, rewrites the Open Graph /
 *      Twitter tags to that reference (title, the verse text as the
 *      description, and the API's public verse-card image), and returns it with
 *      a 200. Everything else falls straight through to GitHub Pages untouched.
 *
 * Route: app.iqbible.com/* (wrangler.toml). The Worker only needs to see page
 * navigations and the API path — NOT the static assets (/js, /css, /img, the
 * PWA files), which the app's service worker also keeps revalidating. Add
 * "route -> (None)" exclusions for those in the Cloudflare dashboard so they
 * don't spend Worker request quota; skipping that step costs quota but breaks
 * nothing. See ./README.md.
 *
 * Deploy:
 *   cd cloudflare
 *   npx wrangler deploy
 *   npx wrangler secret put IQBIBLE_API_KEY      # paste the shared key
 */

const UPSTREAM = "https://api.iqbible.com";
const APP_ORIGIN = "https://app.iqbible.com";
const DEFAULT_VERSION = "eng_kjv";

// Belt-and-braces for the dashboard exclusions above: if an asset request does
// reach the Worker, skip straight to origin with no work.
const STATIC_PREFIX = /^\/(?:js|css|img|assets|fonts)\//;

// Deuterocanon / apocrypha USFM codes. A reference in one of these on a version
// that doesn't carry the book resolves its name but returns no verse text — see
// resolveCitation, which then retries against ?canon=catholic. Gated to this
// set so a mistyped or unloaded version code for an ordinary book can't quietly
// turn into a Douay-Rheims card.
const DEUTEROCANON = new Set([
  "TOB", "JDT", "ESG", "WIS", "SIR", "BAR", "LJE", "S3Y", "SUS", "BEL",
  "1MA", "2MA", "3MA", "4MA", "1ES", "2ES", "MAN", "PS2", "ODA",
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/v2/")) {
      return proxyApi(request, url, env);
    }

    if (request.method === "GET" && !STATIC_PREFIX.test(url.pathname)) {
      const ref = parseScripturePath(url);
      if (ref) {
        try {
          const card = await renderCard(ref, env, ctx);
          if (card) return card;
        } catch {
          // A working SPA page (even at a 404 status) always beats an error —
          // fall through on anything unexpected.
        }
      }
    }

    return fetch(request);
  },
};

/* ── 1. API auth proxy ──────────────────────────────────────────────────── */

async function proxyApi(request, url, env) {
  // Cheap abuse brake: a browser fetch/XHR from another site sends an Origin
  // header that won't match. Same-origin app calls, <img>/<audio> loads and
  // non-browser clients send no Origin and pass through — a shared key is
  // inherently best-effort to protect here (see ../NOTES.md).
  const origin = request.headers.get("Origin");
  if (origin && origin !== APP_ORIGIN) {
    return new Response("Forbidden", { status: 403 });
  }

  const headers = new Headers(request.headers);
  headers.delete("Host");
  if (!headers.has("X-API-Key")) {
    headers.set("X-API-Key", env.IQBIBLE_API_KEY);
  }

  const method = request.method;
  const upstream = await fetch(UPSTREAM + url.pathname + url.search, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : request.body,
    redirect: "follow",
  });

  // Rebuild so the body streams straight back with the API's own headers
  // (status, X-RateLimit-*, Retry-After) intact for the app's error modal.
  const out = new Headers(upstream.headers);
  out.set("Access-Control-Allow-Origin", APP_ORIGIN);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

/* ── 2. Per-reference social cards ──────────────────────────────────────── */

// /{book}/{chapter}[/{verse|verse-range}] — the app's own deep-link shape
// (js/router.js). Strict on purpose: a 2-4 char book-ish first segment and a
// numeric chapter, so static files and menu routes never match and never cost
// a lookup. Returns null for anything else, which falls through untouched.
function parseScripturePath(url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return null;

  const book = parts[0].toUpperCase();
  if (!/^[1-4A-Z][A-Z0-9]{1,3}$/.test(book)) return null;
  if (!/^\d{1,3}$/.test(parts[1])) return null;
  const chapter = parseInt(parts[1], 10);
  if (chapter < 1) return null;

  let verse = null;
  let verseEnd = null;
  if (parts[2] !== undefined) {
    const m = /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(parts[2]);
    if (!m) return null;
    verse = parseInt(m[1], 10);
    if (verse < 1) return null;
    if (m[2]) {
      const end = parseInt(m[2], 10);
      if (end > verse) verseEnd = end;
    }
  }

  let version = (url.searchParams.get("v") || DEFAULT_VERSION).toLowerCase();
  if (!/^[a-z]{2,4}_[a-z0-9]+$/.test(version)) version = DEFAULT_VERSION;

  return { book, chapter, verse, verseEnd, version };
}

async function renderCard(ref, env, ctx) {
  const cache = caches.default;

  const verseKey = ref.verseEnd
    ? `${ref.verse}-${ref.verseEnd}`
    : ref.verse != null
      ? String(ref.verse)
      : "0";
  const cacheKey = new Request(
    `${APP_ORIGIN}/__card/${ref.version}/${ref.book}.${ref.chapter}.${verseKey}`,
  );
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const meta = await resolveCitation(ref, ctx);
  // No verse text means the reference doesn't resolve to a real verse (bad
  // version code, or a chapter/verse past the end of the book). Don't fabricate
  // a card — fall through to the normal 404 / SPA handling.
  if (!meta || !meta.name_en || !meta.data || !meta.data.length) return null;

  // Same-zone subrequest — Cloudflare sends this to the GitHub Pages origin,
  // never back through this Worker, so there's no loop. 404.html is a copy of
  // index.html; either serves as the shell, index.html just 200s.
  const shell = await fetch(`${APP_ORIGIN}/index.html`, {
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!shell.ok) return null;

  const tags = buildTags(ref, meta);
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=600",
  });

  let rw = new HTMLRewriter()
    .on("title", { element: (el) => el.setInnerContent(tags.title) })
    .on('meta[property="og:title"]', setAttr("content", tags.title))
    .on('meta[name="twitter:title"]', setAttr("content", tags.title))
    .on('meta[property="og:url"]', setAttr("content", tags.url))
    .on('meta[property="og:image"]', setAttr("content", tags.image))
    .on('meta[name="twitter:image"]', setAttr("content", tags.image))
    .on('meta[property="og:image:width"]', setAttr("content", "1200"))
    .on('meta[property="og:image:height"]', setAttr("content", "630"))
    .on('meta[property="og:image:alt"]', setAttr("content", tags.imageAlt))
    .on('meta[name="twitter:image:alt"]', setAttr("content", tags.imageAlt));

  if (tags.description) {
    rw = rw
      .on('meta[name="description"]', setAttr("content", tags.description))
      .on('meta[property="og:description"]', setAttr("content", tags.description))
      .on('meta[name="twitter:description"]', setAttr("content", tags.description));
  }

  const out = rw.transform(new Response(shell.body, { status: 200, headers }));
  ctx.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}

// HTMLRewriter's setAttribute writes the value as-is, so escape what would
// break a double-quoted attribute (a verse with a `"` in it, an `&` in the
// image URL) ourselves.
const escAttr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const setAttr = (name, value) => ({
  element: (el) => el.setAttribute(name, escAttr(value)),
});

// Book name + verse text for the card. The public GET /parse/citation is
// unauthenticated (no key sent here — card traffic then costs nothing against
// the shared key's quota) and its response is immutable, so it's cached hard.
async function resolveCitation(ref, ctx) {
  const cache = caches.default;
  const v = ref.verse != null ? ref.verse : 1;
  const spec = ref.verseEnd ? `${v}-${ref.verseEnd}` : String(v);
  // /parse/citation uses colon notation (GEN.32:1); /image/verse uses dots.
  const citation = `${ref.book}.${ref.chapter}:${spec}`;

  const key = new Request(`${APP_ORIGIN}/__cite/${ref.version}/${citation}`);
  const hit = await cache.match(key);
  if (hit) return hit.json();

  let data = await parseCitation(citation, `version=${encodeURIComponent(ref.version)}`);
  // A deuterocanon reference on a version that doesn't carry the book resolves
  // the name but returns no verse text — retry against a canon that has it.
  // Only for deuterocanon books: for an ordinary book, "no text back" means a
  // bad version code or a verse past the end of the book, not a canon gap.
  if (
    DEUTEROCANON.has(ref.book) &&
    data && data.count > 0 && (!data.data || !data.data.length)
  ) {
    const alt = await parseCitation(citation, "canon=catholic");
    if (alt && alt.data && alt.data.length) data = alt;
  }
  if (!data || !data.name_en) return null;

  ctx.waitUntil(
    cache.put(
      key,
      new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=604800",
        },
      }),
    ),
  );
  return data;
}

async function parseCitation(citation, extra) {
  const r = await fetch(
    `${UPSTREAM}/api/v2/parse/citation?citation=${encodeURIComponent(citation)}&${extra}`,
  );
  if (!r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

function buildTags(ref, meta) {
  const name = meta.name_en;
  const c = ref.chapter;
  const bl = ref.book.toLowerCase();
  const version = meta.version || ref.version;

  let label;
  let path;
  let imgRef;
  if (ref.verse != null && ref.verseEnd) {
    label = `${name} ${c}:${ref.verse}–${ref.verseEnd}`;
    path = `/${bl}/${c}/${ref.verse}-${ref.verseEnd}`;
    imgRef = `${ref.book}.${c}.${ref.verse}-${ref.verseEnd}`;
  } else if (ref.verse != null) {
    label = `${name} ${c}:${ref.verse}`;
    path = `/${bl}/${c}/${ref.verse}`;
    imgRef = `${ref.book}.${c}.${ref.verse}`;
  } else {
    // Chapter link: a clean opening-verse card reads better as an unfurl than a
    // whole chapter shrunk to fit. /image/verse also takes ref=BOOK.chapter for
    // a full-chapter card if that's ever preferred.
    label = `${name} ${c}`;
    path = `/${bl}/${c}`;
    imgRef = `${ref.book}.${c}.1`;
  }

  let description = null;
  if (meta.data && meta.data.length) {
    description = meta.data.map((d) => d.text).join(" ").replace(/\s+/g, " ").trim();
    if (description.length > 280) {
      description = description.slice(0, 280).replace(/\s+\S*$/, "") + "…";
    }
    description = description || null;
  }

  return {
    title: `${label} — IQ Bible`,
    description,
    url: `${APP_ORIGIN}${path}?v=${encodeURIComponent(version)}`,
    image:
      `${UPSTREAM}/api/v2/image/verse?ref=${encodeURIComponent(imgRef)}` +
      `&version=${encodeURIComponent(version)}&preset=og&style=light&format=png`,
    imageAlt: `${label}, a verse card from IQ Bible`,
  };
}
