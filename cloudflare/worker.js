/*
 * Cloudflare Worker — API auth proxy for the official hosted instance only.
 *
 * This exists solely so app.iqbible.com can be used without a personal API
 * key. Forks and self-hosted copies do NOT need it and should not deploy it:
 * they call the API directly with the visitor's own key (Settings ->
 * localStorage), exactly as the app does out of the box. See ../README.md
 * ("Self-hosting") and ../CLAUDE.md.
 *
 * What it does: it's bound (see wrangler.toml) to the one path
 *   https://app.iqbible.com/api/v2/*
 * — which is what js/config.js's API_BASE resolves to on the hosted instance
 * — and forwards each request to https://api.iqbible.com/api/v2/*, adding the
 * shared key from the IQBIBLE_API_KEY secret. Everything else on
 * app.iqbible.com falls through to GitHub Pages (a proxied CNAME in
 * Cloudflare DNS).
 *
 * If the incoming request already carries an X-API-Key header, it's passed
 * through untouched — a visitor who enters their own key in Settings keeps
 * using their own quota instead of the shared pool.
 *
 * The API's response (status, body, and its X-RateLimit-* / Retry-After
 * headers) is returned verbatim so the app's error modal can read it — the
 * whole point of this app is to surface real API friction, not hide it.
 *
 * Deploy:
 *   cd cloudflare
 *   npx wrangler deploy
 *   npx wrangler secret put IQBIBLE_API_KEY      # paste the shared key
 */

const UPSTREAM = "https://api.iqbible.com";
const APP_ORIGIN = "https://app.iqbible.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // The route pattern should already scope this, but never forward anything
    // outside the API path even if the binding is ever widened by accident.
    if (!url.pathname.startsWith("/api/v2/")) {
      return new Response("Not found", { status: 404 });
    }

    // Cheap abuse brake: a browser fetch/XHR from another site sends an Origin
    // header that won't match. Same-origin app calls, <img>/<audio> loads and
    // non-browser clients send no Origin and pass through — a shared key is
    // inherently best-effort to protect here (documented in ../NOTES.md), this
    // just stops the most trivial cross-site scraping.
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

    // Rebuild the response so the body streams straight back with the API's
    // own headers intact.
    const out = new Headers(upstream.headers);
    out.set("Access-Control-Allow-Origin", APP_ORIGIN);
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
