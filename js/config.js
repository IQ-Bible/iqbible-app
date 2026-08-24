// The IQ Bible API endpoint. It's a commercial, closed-source API served
// only at api.iqbible.com — there's no "run your own instance" option, so
// forks of this app should leave this pointed at the hosted API.
const API_BASE = "https://api.iqbible.com/api/v2";

// GitHub Pages *project* sites (username.github.io/reponame/) serve this app
// from a subpath, so the router needs to know it to build correct URLs. A
// custom domain, Cloudflare Pages, or a GitHub Pages *user/org* site
// (reponame == username.github.io, served at the root) all want "". Only
// set this if you're deploying to a GitHub Pages project site under a repo
// name other than the site's root.
//
// Note: index.html/404.html load css/styles.css and js/*.js via root-absolute
// paths (e.g. "/css/styles.css") so a deep-link page refresh still finds them
// regardless of how deep the URL path is. On a project-site subpath, those
// tags also need the "/reponame" prefix added by hand — this constant alone
// doesn't reach them, since it's defined in a script tag that loads after
// the <link>/<script> tags that need it.
const BASE_PATH = "/iqbible-app";

// Shown in the left nav footer. Bump alongside a CHANGELOG.md version cut.
const APP_VERSION = "0.1.0";
