# Cloudflare Worker — hosted-instance API proxy

**You almost certainly don't need this.** It exists only so the official
hosted instance at <https://app.iqbible.com> can be used without each visitor
supplying their own API key. If you're forking or self-hosting this app, skip
this folder entirely — the app calls the IQ Bible API directly with the key
each visitor enters in Settings, which is the right model for any deployment
you don't control the API billing for. See the repo `README.md` ("Self-hosting")
for why.

## What it does

`app.iqbible.com` is a Cloudflare-proxied CNAME pointing at GitHub Pages. This
Worker is bound to the single path `app.iqbible.com/api/v2/*` (which is what
`js/config.js`'s `API_BASE` resolves to on the hosted instance) and forwards
those requests to `https://api.iqbible.com/api/v2/*`, adding a shared
`X-API-Key` from a Worker secret. Everything else on the domain falls through
to GitHub Pages untouched.

A request that already carries an `X-API-Key` header (a visitor who entered
their own key in Settings) is passed through as-is, so they use their own
quota rather than the shared pool.

The upstream response — status, body, and all `X-RateLimit-*` / `Retry-After`
headers — is returned verbatim so the app's error modal still shows real API
responses.

## Deploy

```sh
cd cloudflare
npx wrangler deploy
npx wrangler secret put IQBIBLE_API_KEY   # paste the shared key when prompted
```

The `iqbible.com` zone must already exist in the same Cloudflare account, and
`app.iqbible.com` must be a proxied DNS record. The key is a **Cloudflare
Worker secret** — it is never committed here and never reaches the browser.

## Known limitation

A shared key behind a public proxy can still be abused by a non-browser
client (the `Origin` check only stops trivial cross-site browser scraping).
This is an accepted trade-off for the hosted convenience instance and is
logged in `../NOTES.md`.
