/* ═══════════════════════════════════════════════════════════════════════
   STATE — shared across every other file, loaded first so `let`/`const`
   declarations exist before catalog.js/reader.js/search.js reference them
   (plain scripts execute top-to-bottom in document order; unlike function
   declarations, let/const aren't hoisted). Genesis 1 default: the default
   illustration pack (Schnorr, see getIllustPack below) is Old Testament-
   only, so a New Testament default would never show any imagery out of
   the box. */
let current = { version: "eng_kjv", versionTitle: "King James Version", book: "GEN", bookName: "Genesis", chapter: 1, verse: null, verseEnd: null, audioId: null, textDirection: "ltr" };
let catalog = null;
let bookList = [];
let chapterMeta = [];

// The 27 canonical NT USFM codes, per GET /bibles/{version}/books?testament=
// — matched by USFM membership rather than a numeric cutoff, same rule the
// API itself documents, so traditions with extra OT-side books still split
// correctly.
const NT_USFM = new Set(["MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"]);
// The 39 protocanonical OT books. A version's book list (e.g. KJVA, DRC,
// CPDV) can also include deuterocanonical/apocryphal/other extrabiblical
// texts the API's catalog knows about (Tobit, Maccabees, Enoch, ...) —
// anything outside these two sets is grouped as its own section rather than
// enumerated by name, so the book picker doesn't need updating every time
// the catalog's non-canonical coverage grows.
const OT_USFM = new Set(["GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL"]);

/* ═══════════════════════════════════════════════════════════════════════
   GENERIC HELPERS */
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 3000);
}
function escHtml(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
// escHtml alone isn't safe inside a "-quoted HTML attribute (it doesn't touch
// quote chars) — use this instead wherever free text lands in one.
function escAttr(s) { return escHtml(s).replace(/"/g, "&quot;"); }
function openModal(id) { document.getElementById(id).classList.add("show"); }
function closeModal(id) { document.getElementById(id).classList.remove("show"); }
function fmtTime(s) { if (!isFinite(s)) return "0:00"; const m = Math.floor(s / 60), sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, "0")}`; }

/* ═══════════════════════════════════════════════════════════════════════
   AUTH — every user brings their own API key (free at developer.iqbible.com),
   stored only in this browser's localStorage. Nothing is hardcoded or
   shipped in source: see README's security note before deploying your own
   public copy of this app for other people to use. */
const LS_KEY = "iqb_api_key";

function getApiKey() { return (localStorage.getItem(LS_KEY) || "").trim(); }
function setApiKey(k) { localStorage.setItem(LS_KEY, (k || "").trim()); }

async function apiFetch(url, opts = {}) {
  const headers = new Headers(opts.headers || {});
  const key = getApiKey();
  if (key) headers.set("X-API-Key", key);
  return fetch(url, { ...opts, headers });
}
// The API's own error envelope ({status,error:{code,message,detail,hint,...}}
// — see the private backend's apierror.go, never linked publicly) is
// genuinely descriptive; this app just wasn't reading past `.error.code`
// before. 429/5xx now surface everything it sends — message, detail, hint,
// and (for a 429) the full X-RateLimit-*/Retry-After picture — in a modal
// that has to be dismissed, so a developer testing against a free-tier key
// actually sees what happened and why instead of a feature just quietly not
// rendering. A routine 404 (this app relies on those constantly — "no
// illustrations/places/people for this chapter" is a normal response,
// not a problem) still just toasts; a blocking modal on every one of those
// would make ordinary browsing unusable.
const RATE_LIMIT_HEADER_SCOPES = [
  { suffix: "", label: "Per-minute" },
  { suffix: "-Month", label: "Monthly" },
  { suffix: "-Audio", label: "Audio streams" },
];
function showApiErrorModal(status, body, headers, path) {
  const e = (body && body.error) || {};
  const rows = [["Endpoint", path], ["HTTP status", status]];
  if (e.code) rows.push(["Code", e.code]);
  if (e.message) rows.push(["Message", e.message]);
  if (e.detail) rows.push(["Detail", e.detail]);
  if (e.hint) rows.push(["Hint", e.hint]);
  const retryAfter = headers.get("Retry-After");
  if (retryAfter) rows.push(["Retry after", retryAfter + "s"]);
  RATE_LIMIT_HEADER_SCOPES.forEach(({ suffix, label }) => {
    const limit = headers.get("X-RateLimit-Limit" + suffix);
    if (!limit) return;
    const remaining = headers.get("X-RateLimit-Remaining" + suffix);
    const reset = headers.get("X-RateLimit-Reset" + suffix);
    let val = `${remaining ?? "?"} / ${limit} remaining`;
    if (reset) val += `, resets ${new Date(parseInt(reset, 10) * 1000).toLocaleString()}`;
    rows.push([label + " limit", val]);
  });
  const cost = headers.get("X-RateLimit-Cost");
  if (cost && cost !== "1") rows.push(["Request cost", cost + " (this endpoint is compute-heavier than most)"]);
  document.getElementById("apiErrorTitle").textContent = e.code ? `API Error — ${e.code}` : "API Error";
  document.getElementById("apiErrorBody").innerHTML = rows.map(([k, v]) =>
    `<div class="err-row"><div class="err-key">${escHtml(k)}</div><div class="err-val">${escHtml(String(v))}</div></div>`
  ).join("");
  openModal("apiErrorScrim");
}
async function apiJSON(path) {
  // The hosted instance's proxy injects a key server-side, so "no key set"
  // isn't a blocking state there — apiFetch just sends no X-API-Key header
  // and the Worker fills one in.
  if (!IS_HOSTED_INSTANCE && !getApiKey()) {
    showKeyBanner();
    const err = new Error("no_api_key");
    err.status = 0;
    throw err;
  }
  const res = await apiFetch(API_BASE + path);
  if (!res.ok) {
    let body = null;
    try { body = await res.clone().json(); } catch (_) { }
    const code = (body && body.error && body.error.code) || "http_" + res.status;
    if (res.status === 429 || res.status >= 500) showApiErrorModal(res.status, body, res.headers, path);
    // A 404 is routine, expected control flow throughout this app — "no
    // illustrations/places/people/dictionary entry/genealogy record for
    // this" happens dozens of times per chapter by design, not a problem
    // worth a toast every time. Anything else 4xx (a real client mistake)
    // still surfaces.
    else if (res.status !== 404) toast(`API error (${res.status}): ${code} — ${path}`);
    const err = new Error(code);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Session-lifetime cache for GET calls whose response can't change under a
// visitor's feet mid-session (chapter text, illustrations, book icons,
// per-chapter places/people, audio file URLs...) — most of the app's
// browsing is back-and-forth over the same handful of chapters/books, and
// re-fetching those every time was pure waste. Keyed by the full path
// (already includes query params, so distinct params naturally miss), and
// caches the in-flight promise itself so two callers racing the same path
// share one request instead of firing two. A rejected call is evicted so a
// transient failure doesn't get remembered as permanent.
const apiCache = new Map();
function apiJSONCached(path) {
  if (apiCache.has(path)) return apiCache.get(path);
  const p = apiJSON(path).catch(e => { apiCache.delete(path); throw e; });
  apiCache.set(path, p);
  return p;
}

/* ═══════════════════════════════════════════════════════════════════════
   SETTINGS — the only place an API key is entered. Saving reloads the
   page: simpler and more robust than re-running init() mid-session with a
   new key. */
function showKeyBanner() {
  document.getElementById("keyBanner").classList.add("show");
  // Locks the topbar + nav rail (pointer-events:none, see css/styles.css)
  // for the rest of the no-key session — not just while the gate dialog
  // itself is visible. hideKeyBanner() only hides the dialog (so the
  // Settings mainview underneath is reachable when opened from it); this
  // class is deliberately never removed by hideKeyBanner(), only ever
  // cleared by the fresh page load saveSettings() triggers once a key is
  // actually saved. Without it, opening Settings from the gate re-exposed
  // Search/Explore/etc. via the still-clickable nav rail.
  document.body.classList.add("no-key-lockdown");
  // init() returns before ever loading a chapter when no key is set, so
  // the spinner index.html ships as readingText's initial content would
  // otherwise spin forever behind the banner, reading as "stuck loading"
  // rather than "waiting for you to add a key."
  const rt = document.getElementById("readingText");
  if (rt) rt.innerHTML = "";
}
function hideKeyBanner() { document.getElementById("keyBanner").classList.remove("show"); }

function openSettings() {
  document.getElementById("settingsKeyInput").value = getApiKey();
  // On the hosted instance a key is optional (the proxy supplies a shared
  // one) — say so, and note that entering a personal key switches that
  // visitor off the shared pool and onto their own quota.
  const keyHint = document.getElementById("settingsKeyHint");
  if (keyHint) keyHint.innerHTML = IS_HOSTED_INSTANCE
    ? `Optional here — app.iqbible.com includes a shared key, so you can read without one. Enter your own (free at <a href="https://developer.iqbible.com" target="_blank" rel="noopener">developer.iqbible.com</a>) to use your own quota instead of the shared pool. Stored only in this browser.`
    : `Free at <a href="https://developer.iqbible.com" target="_blank" rel="noopener">developer.iqbible.com</a>. Stored only in this browser's local storage — never sent anywhere but the IQ Bible API.`;
  document.getElementById("settingsIllustSelect").value = getIllustPack();
  document.getElementById("settingsIllustBW").checked = getIllustBW();
  document.getElementById("settingsIconSelect").value = getIconStyle();
  document.getElementById("settingsFontSlider").value = getFontSize();
  document.getElementById("settingsUiFontSlider").value = getUiFontSize();
  document.getElementById("settingsExportReminder").checked = getExportReminderEnabled();
  renderSettingsCompareChips();
  switchMainView("settings");
}
function closeSettings() {
  switchMainView("read");
  // Leaving Settings without a key re-blocks the app the same way arriving
  // with none did — covers both a direct close and saveSettings() below.
  // Not on the hosted instance, where a key is optional.
  if (!IS_HOSTED_INSTANCE && !getApiKey()) showKeyBanner();
}
function saveSettings() {
  setApiKey(document.getElementById("settingsKeyInput").value);
  closeSettings();
  if (getApiKey()) location.reload();
}

/* ═══════════════════════════════════════════════════════════════════════
   THEME — manual day/night toggle (topbar), not tied to prefers-color-
   scheme; the choice is explicit and persisted rather than following the
   OS. Applied before first paint by a small inline script in index.html's
   <head> (this file loads at the end of <body>), so this only needs to
   sync the sun/moon icon and handle later toggles. */
function getTheme() { return localStorage.getItem("iqb_theme") || "light"; }
function setTheme(t) {
  localStorage.setItem("iqb_theme", t);
  document.documentElement.dataset.theme = t;
  const sun = document.getElementById("themeIconSun"), moon = document.getElementById("themeIconMoon");
  if (sun) sun.style.display = t === "dark" ? "none" : "";
  if (moon) moon.style.display = t === "dark" ? "" : "none";
}
function toggleTheme() { setTheme(getTheme() === "dark" ? "light" : "dark"); }

/* ═══════════════════════════════════════════════════════════════════════
   DISPLAY PREFS — illustration pack, book-icon style, reading font size.
   Unlike the API key these apply immediately (no Save/reload) — each
   setter both persists and re-renders whatever's already on screen. */
function getIllustPack() { return localStorage.getItem("iqb_illust_pack") || "schnorr"; }
function setIllustPack(v) { localStorage.setItem("iqb_illust_pack", v); refreshInlineIllustrations(); }
// Pure CSS (grayscale filter, see .illust-bw in css/styles.css) — no
// different image variant to fetch, so this just toggles a class. Default-on:
// absence of the key means "never explicitly turned off", matching the
// print-Bible look the app ships with.
function getIllustBW() { return localStorage.getItem("iqb_illust_bw") !== "0"; }
function setIllustBW(v) { localStorage.setItem("iqb_illust_bw", v ? "1" : "0"); document.documentElement.classList.toggle("illust-bw", v); }
// Default-on (see js/reader.js's DATA BACKUP AWARENESS section) — absence of
// the key means "never explicitly turned off", not "off".
function getExportReminderEnabled() { return localStorage.getItem("iqb_export_reminder_enabled") !== "0"; }
function setExportReminderEnabled(v) { localStorage.setItem("iqb_export_reminder_enabled", v ? "1" : "0"); }
function getIconStyle() { return localStorage.getItem("iqb_icon_style") || "bw"; }
function setIconStyle(v) { localStorage.setItem("iqb_icon_style", v); loadTopBookIcon(); }
function getFontSize() { return parseInt(localStorage.getItem("iqb_font_size"), 10) || 20; }
function setFontSize(px) {
  localStorage.setItem("iqb_font_size", px);
  document.documentElement.style.setProperty("--reading-font-size", px + "px");
  ["settingsFontSlider", "fontSizeSlider"].forEach(id => { const el = document.getElementById(id); if (el) el.value = px; });
}
// Nearly every UI element (menu, labels, modals, buttons...) is sized in
// rem, so scaling the root font-size scales all of it at once — everything
// except the reading text itself, which is pinned to --reading-font-size in
// px above rather than rem specifically so this setting can't touch it.
function getUiFontSize() { return parseInt(localStorage.getItem("iqb_ui_font_size"), 10) || 17; }
function setUiFontSize(px) {
  localStorage.setItem("iqb_ui_font_size", px);
  document.documentElement.style.setProperty("--ui-font-size", px + "px");
  ["settingsUiFontSlider", "fontSizeUiSlider"].forEach(id => { const el = document.getElementById(id); if (el) el.value = px; });
}
function openFontSizeModal() {
  document.getElementById("fontSizeSlider").value = getFontSize();
  document.getElementById("fontSizeUiSlider").value = getUiFontSize();
  openModal("fontSizeScrim");
}
