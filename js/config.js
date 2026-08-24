// The IQ Bible API endpoint. It's a commercial, closed-source API served
// only at api.iqbible.com — there's no "run your own instance" option, so
// forks of this app should leave this pointed at the hosted API.
const API_BASE = "https://api.iqbible.com/api/v2";

// GitHub Pages *project* sites (username.github.io/reponame/) serve this app
// from a subpath, so the router needs to know it to build correct URLs. Set
// once, at runtime, by the inline script at the very top of index.html's/
// 404.html's <head> (before this file — before any <link>/<script src> tag —
// even loads), so this file, index.html, and 404.html can all stay byte-
// identical between the `main` (deployed) and `develop` (local root-served)
// branches instead of needing a `/reponame` prefix hand-maintained on one of
// them. Forking to your own GitHub Pages project site: edit the hostname
// check in that inline script, not this line.
const BASE_PATH = window.BASE_PATH;

// Shown in the left nav footer. Bump alongside a CHANGELOG.md version cut.
const APP_VERSION = "1.1.1";
