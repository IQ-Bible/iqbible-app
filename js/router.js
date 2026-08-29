/* ═══════════════════════════════════════════════════════════════════════
   URL — /{book}/{chapter}[/{verse}] deep links, e.g. /gen/1/1. A verse
   segment can also be a range, /gal/5/14-16, which lands on the first verse
   and rings the whole span. BASE_PATH (config.js) is stripped/re-added so
   the same code works at the root of a custom domain or under a GitHub Pages
   project subpath. The version isn't encoded — a deep link always resolves
   against the default translation; picking a different translation from an
   already-loaded chapter doesn't need to round-trip through the URL. */
function parsePathRoute() {
  let path = location.pathname;
  if (BASE_PATH && path.startsWith(BASE_PATH)) path = path.slice(BASE_PATH.length);
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return null;
  const book = parts[0].toUpperCase();
  const chapter = parts[1] ? parseInt(parts[1], 10) : 1;
  const [rawStart, rawEnd] = (parts[2] || "").split("-");
  const verse = parseInt(rawStart, 10);
  const verseEnd = parseInt(rawEnd, 10);
  return {
    book,
    chapter: isNaN(chapter) ? 1 : chapter,
    verse: isNaN(verse) ? null : verse,
    verseEnd: (!isNaN(verse) && !isNaN(verseEnd) && verseEnd > verse) ? verseEnd : null,
  };
}
function currentPath() {
  const base = `${BASE_PATH}/${(current.book || "").toLowerCase()}/${current.chapter}`;
  if (!current.verse) return base;
  return current.verseEnd ? `${base}/${current.verse}-${current.verseEnd}` : `${base}/${current.verse}`;
}
// pushState for every real navigation so Back/Forward walks chapter by
// chapter; the very first sync (whatever chapter the page happened to load)
// uses replaceState instead, so landing on the site's root doesn't leave a
// redundant duplicate entry pointing at the same content once its URL is
// filled in.
let urlSynced = false;
function syncURL() {
  const path = currentPath();
  if (location.pathname === path) { urlSynced = true; return; }
  if (!urlSynced) { history.replaceState(null, "", path); urlSynced = true; }
  else history.pushState(null, "", path);
}
window.addEventListener("popstate", async () => {
  const route = parsePathRoute();
  if (!route) return;
  const b = bookList.find(x => x.usfm === route.book);
  if (b) { current.book = b.usfm; current.bookName = b.name; }
  chapterMeta = [];
  await loadChapter(route.chapter, true, route.verse, route.verseEnd);
});

/* ── menu-page hash — /{book}/{chapter}#explore, #share-tools, etc. ──
   Lets a left-nav view/Settings be linked to directly, e.g.
   /gen/38/26#explore. Kept as a reflection of whichever view is currently
   open (replaceState, not pushState) rather than its own history stack —
   Back/Forward still only walks chapter history, same as before; this just
   makes an already-open view's URL something you can copy and share. */
const HASH_SLUGS = { search: "search", library: "my-library", explore: "explore", study: "study-tools", devotionals: "devotionals", share: "share-tools", settings: "settings", about: "about", plans: "plans", help: "help", progress: "my-progress" };
function parseHashRoute() {
  const slug = (location.hash || "").slice(1);
  return Object.keys(HASH_SLUGS).find(k => HASH_SLUGS[k] === slug) || null;
}
function setMenuHash(key) {
  const slug = HASH_SLUGS[key] || "";
  const url = currentPath() + (slug ? `#${slug}` : "");
  if (location.pathname + location.hash === url) return;
  history.replaceState(null, "", url);
}
function openHashRoute() {
  const key = parseHashRoute();
  if (key) navMenuClick(key);
}
window.addEventListener("hashchange", openHashRoute);
