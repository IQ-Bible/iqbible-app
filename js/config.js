// The IQ Bible API endpoint. It's a commercial, closed-source API served
// only at api.iqbible.com — there's no "run your own instance" option, so
// forks of this app should leave this pointed at the hosted API.
const API_ORIGIN = "https://api.iqbible.com";

// The official hosted instance (app.iqbible.com) puts a Cloudflare Worker in
// front of the authenticated API endpoints (see cloudflare/) that injects a
// shared key server-side, so visitors there never have to bring their own.
// Anywhere else — a local checkout, a fork, a self-hosted copy — there's no
// proxy: calls go straight to the API with the visitor's own key (entered in
// Settings, stored only in localStorage). This one hostname check is the only
// thing that distinguishes the two.
const IS_HOSTED_INSTANCE = location.hostname === "app.iqbible.com";

// Authenticated endpoints: the same-origin proxy path on the hosted instance
// (resolves to https://app.iqbible.com/api/v2/... — the Worker's route), a
// direct call to the API everywhere else.
const API_BASE = IS_HOSTED_INSTANCE ? "/api/v2" : API_ORIGIN + "/api/v2";

// Public, unauthenticated endpoints — GET /image/verse and /embed/verse (the
// Share Tools). Always pointed straight at the API, never the proxy: these
// URLs are meant to be copied out and embedded on other sites, so they must
// not depend on this app's origin, and there's no key to inject anyway.
const API_PUBLIC_BASE = API_ORIGIN + "/api/v2";

// Every deployment of this app is served from its domain root (the hosted
// instance at app.iqbible.com, a Cloudflare Pages site, `npx serve .` locally
// — and a GitHub Pages project site redirects its /reponame path to whatever
// custom domain is set). So this is "" in practice. It's kept as a single
// named constant purely so a fork that genuinely must live under a subpath
// has one line to change (and see the <base> tag in index.html/404.html).
const BASE_PATH = "";

// Offline fallback for the left nav footer / About page version display —
// js/main.js's refreshAppVersionFromChangelog() reads the real, current
// version out of CHANGELOG.md at load time and overwrites this whenever that
// fetch succeeds, so this constant only shows if the fetch fails (e.g. no
// network). Bump alongside a CHANGELOG.md version cut anyway, so the offline
// case doesn't drift too far.
const APP_VERSION = "1.16.3";
