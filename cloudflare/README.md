# Cloudflare Worker — hosted-instance serving layer

**You almost certainly don't need this.** It exists only so the official
hosted instance at <https://app.iqbible.com> can be used without each visitor
supplying their own API key. If you're forking or self-hosting this app, skip
this folder entirely — the app calls the IQ Bible API directly with the key
each visitor enters in Settings, which is the right model for any deployment
you don't control the API billing for. See the repo `README.md` ("Self-hosting")
for why.

## What it does

`app.iqbible.com` is a Cloudflare-proxied CNAME pointing at GitHub Pages. This
Worker sits on `app.iqbible.com/*` and does two things; everything it doesn't
handle falls through to GitHub Pages untouched.

### 1. API auth proxy

`/api/v2/*` is forwarded to `https://api.iqbible.com/api/v2/*` with a shared
`X-API-Key` from a Worker secret added. A request that already carries an
`X-API-Key` header (a visitor who entered their own key in Settings) is passed
through as-is, so they use their own quota rather than the shared pool. The
upstream response — status, body, and all `X-RateLimit-*` / `Retry-After`
headers — is returned verbatim so the app's error modal still shows real API
responses.

### 2. Social link-preview cards

A shared Scripture URL — `/gen/32`, `/jhn/3/16`, `/gal/5/14-16` — is a single
static SPA page whose `<meta>` tags are generic, and GitHub Pages serves deep
links with a 404 status, so pasting one into LinkedIn / Slack / iMessage gives
a poor preview or none. For a path that parses as `book/chapter[/verse]` the
Worker fetches the app shell, rewrites the Open Graph / Twitter tags for that
reference, and returns it with a 200:

- **title** — the reference (`Genesis 32`, `John 3:16`, `Galatians 5:14–16`)
- **description** — the verse text, from the public `GET /parse/citation`
- **image** — `GET /api/v2/image/verse?...&preset=og` (public, 1200×630,
  edge-cached 24h)

Both API calls are unauthenticated public endpoints, so cards cost nothing
against the shared key. Results are cached at the edge (the rendered card HTML
for 10 min, the parsed reference for 7 days), so repeat crawler hits mostly
never reach the API.

## Deploy

```sh
cd cloudflare
npx wrangler deploy
npx wrangler secret put IQBIBLE_API_KEY   # paste the shared key when prompted
```

The `iqbible.com` zone must already exist in the same Cloudflare account, and
`app.iqbible.com` must be a proxied DNS record. The key is a **Cloudflare
Worker secret** — never committed here, never reaches the browser.

### One-time dashboard step — asset route exclusions

The route is `app.iqbible.com/*`, but the static assets don't need the Worker
and the app's service worker keeps revalidating them, so leaving them on the
route wastes request quota. In the Cloudflare dashboard, add a route for each
of the following with the Worker set to **None**:

```
app.iqbible.com/js/*
app.iqbible.com/css/*
app.iqbible.com/img/*
app.iqbible.com/assets/*
```

`worker.js` also fast-paths these straight to origin, but only the dashboard
exclusion actually saves the invocation. Skipping this step doesn't break
anything — it just uses more of the daily Worker request allowance.

## Known limitations

- **Shared key behind a public proxy** can still be abused by a non-browser
  client (the `Origin` check only stops trivial cross-site browser scraping).
  Accepted trade-off for the convenience instance; logged in `../NOTES.md`.
- The verse-card image is served by the API at 1200×630 via `preset=og`; see
  `../NOTES.md` for the (resolved) history of that size.
