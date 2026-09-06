/* ═══════════════════════════════════════════════════════════════════════
   STATE — shared across every other file, loaded first so `let`/`const`
   declarations exist before catalog.js/reader.js/search.js reference them
   (plain scripts execute top-to-bottom in document order; unlike function
   declarations, let/const aren't hoisted). Genesis 1 default: the default
   illustration pack (Schnorr, see getIllustPack below) is Old Testament-
   only, so a New Testament default would never show any imagery out of
   the box. */
let current = { version: "eng_kjv", versionTitle: "King James Version", book: "GEN", bookName: "Genesis", chapter: 1, verse: null, verseEnd: null, audioId: null, textDirection: "ltr", lang: "en" };
let catalog = null;
let bookList = [];
let chapterMeta = [];

// Well-known English editions worth trying as a fallback when the reader's
// current/searched version comes up short — shared by js/reader.js
// (handleRefNotInVersion, offering a version that contains a reference the
// current one doesn't) and js/search.js (the no-results "search other
// versions" prompt). Deuterocanon-carrying editions (KJVA, DRA, CPDV) matter
// here as much as plain modern ones — a name like "Tobias" (Tobit) only
// exists in those, and a 66-book-only fallback list would never find it.
// KJV 1611 covers the reverse case: archaic spellings ("sonne") a modern
// edition normalized away. One shared list so the two features can't drift.
const WELL_KNOWN_ENGLISH_VERSIONS = ["eng_kja", "eng_kjva", "eng_dra", "eng_cpdv", "eng_kjv1611", "eng_web", "eng_bbe", "eng_ylt", "eng_asv"];

// The 27 canonical NT USFM codes, per GET /bibles/{version}/books?testament=
// — matched by USFM membership rather than a numeric cutoff, same rule the
// API itself documents, so traditions with extra OT-side books still split
// correctly.
const NT_USFM = new Set(["MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"]);
// The book picker splits only OT vs NT (NT by the fixed set above; everything
// else is "Old Testament"). It deliberately does NOT carve out a separate
// "Apocrypha / Deuterocanon" section: the app is denominationally agnostic, so
// on a version whose canon includes Tobit / Maccabees / Sirach / etc. (CPDV,
// DRC, KJVA, …) those books belong under OT in the position the version's own
// book list returns them — not quarantined into a section that presumes a
// Protestant 66-book canon is the norm. The API returns books in each
// version's canonical order, so preserving that order is all that's needed.

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
// Turn an API enum/marker token ("unknown_place", "multiple_locations") into
// display text ("Unknown place", "Multiple locations") — the values are
// correct API responses, they just read like an error rendered raw.
function humanizeToken(s) {
  return (s || "").replace(/_/g, " ").replace(/^\s*./, c => c.toUpperCase());
}
/* ── modal dialog manager ──────────────────────────────────────────────────
   openModal/closeModal are still "toggle .show", but now also give the modal
   real dialog semantics (role, aria-modal, a label from its heading), move
   focus in on open and back to the trigger on close, hold focus inside while
   open (trap), and make everything behind it inert. Every .modalscrim in the
   app goes through here, so this is the one place it's handled. */
const FOCUSABLE_SEL = 'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),iframe,audio[controls],video[controls],[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';
// Page-level regions that get inert-ed while any modal is open (they sit
// outside every .modalscrim). #toast / #dictTooltip stay live on purpose.
const INERT_REGION_IDS = ["topbar", "profilePanel", "shell", "mobileFooterNav", "moreMenuSheet", "discoverHub", "notesLauncher", "notesDrawer", "keyBanner"];
let _modalFocusStack = [];
// The element that actually holds the dialog's content + focusables. Usually
// the .modal inside the scrim; #cardsSheetScrim is the odd one out — its
// content lives in a separate #rightRail element (data-dialog-content).
function _dialogEl(scrim) {
  return scrim.querySelector(".modal, .tour-welcome-box")
    || (scrim.dataset.dialogContent && document.getElementById(scrim.dataset.dialogContent))
    || scrim;
}
function _visibleFocusables(root) {
  return [...root.querySelectorAll(FOCUSABLE_SEL)].filter(el => el.offsetParent !== null || el === document.activeElement);
}
function _topOpenModal() {
  const open = [...document.querySelectorAll(".modalscrim.show")];
  return open[open.length - 1] || null;
}
// When a dialog's content lives *inside* a region we'd otherwise inert wholesale
// (#cardsSheetScrim's content is #rightRail, which sits inside #shell), we can't
// just inert the region — inert propagates to every descendant with no way for
// one to opt back in. Track that region so we can inert its other branches
// individually and undo it cleanly on the next sync.
let _splitInertEl = null;
function _syncModalInert() {
  const top = _topOpenModal();
  const liveDlg = top ? _dialogEl(top) : null;
  if (_splitInertEl) { [..._splitInertEl.children].forEach(ch => { ch.inert = false; }); _splitInertEl = null; }
  INERT_REGION_IDS.forEach(rid => {
    const el = document.getElementById(rid);
    if (!el) return;
    if (liveDlg && el !== liveDlg && el.contains(liveDlg)) {
      el.inert = false;
      [...el.children].forEach(ch => { ch.inert = ch !== liveDlg && !ch.contains(liveDlg); });
      _splitInertEl = el;
    } else {
      el.inert = !!top;
    }
  });
  // Stacked pickers (e.g. the version picker opened from inside another modal):
  // only the topmost stays interactive.
  document.querySelectorAll(".modalscrim").forEach(s => { s.inert = !!top && s !== top && s.classList.contains("show"); });
}
function openModal(id) {
  const scrim = document.getElementById(id);
  if (!scrim || scrim.classList.contains("show")) { if (scrim) scrim.classList.add("show"); return; }
  const dlg = _dialogEl(scrim);
  if (!dlg.getAttribute("role")) dlg.setAttribute("role", "dialog");
  dlg.setAttribute("aria-modal", "true");
  if (!dlg.hasAttribute("aria-label") && !dlg.hasAttribute("aria-labelledby")) {
    const h = dlg.querySelector(".mhead h2, .overlay-title, h1, h2");
    if (h) { if (!h.id) h.id = id + "__title"; dlg.setAttribute("aria-labelledby", h.id); }
  }
  _modalFocusStack.push(document.activeElement);
  scrim.classList.add("show");
  _syncModalInert();
  requestAnimationFrame(() => {
    if (dlg.contains(document.activeElement)) return; // a caller already placed focus
    const pick = dlg.querySelector("[autofocus],[data-autofocus]") || _visibleFocusables(dlg)[0] || dlg;
    if (pick === dlg && !dlg.hasAttribute("tabindex")) dlg.tabIndex = -1;
    try { pick.focus({ preventScroll: true }); } catch (e) {}
  });
}
function closeModal(id) {
  const scrim = document.getElementById(id);
  if (!scrim) return;
  const wasOpen = scrim.classList.contains("show");
  scrim.classList.remove("show");
  if (!wasOpen) return;
  _syncModalInert();
  const prev = _modalFocusStack.pop();
  if (prev && prev.isConnected && typeof prev.focus === "function" && !prev.closest("[inert]")) {
    try { prev.focus({ preventScroll: true }); } catch (e) {}
  }
}
// Focus trap — keeps Tab inside the topmost open modal.
document.addEventListener("keydown", e => {
  if (e.key !== "Tab") return;
  const top = _topOpenModal();
  if (!top) return;
  const dlg = _dialogEl(top);
  const f = _visibleFocusables(dlg);
  if (!f.length) { e.preventDefault(); dlg.focus?.(); return; }
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === first || !dlg.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}, true);
function fmtTime(s) { if (!isFinite(s)) return "0:00"; const m = Math.floor(s / 60), sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, "0")}`; }
// Honour the OS "reduce motion" setting for JS-driven animation (CSS handles
// its own via the @media block in css/styles.css).
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ── brand-styled confirm / prompt (#uiDialogScrim) — window.confirm and
   window.prompt look like nothing else in the app and can't be themed, so
   every destructive-action confirm and every name-this input routes through
   here instead. Promise-based: callers `await uiConfirm(...)` / `uiPrompt(...)`.
   uiConfirm resolves true/false; uiPrompt resolves the trimmed string, or
   null if cancelled (same contract as window.prompt). Both accept either a
   plain message string or an options object. */
let _uiDlgResolve = null;
function _uiDlgSettle(result) {
  if (!_uiDlgResolve) return;
  const done = _uiDlgResolve; _uiDlgResolve = null;
  closeModal("uiDialogScrim");
  done(result);
}
function _openUiDialog(cfg) {
  if (_uiDlgResolve) _uiDlgSettle(null); // never leave a prior dialog's promise hanging
  document.getElementById("uiDialogTitle").textContent = cfg.title;
  const msg = document.getElementById("uiDialogMsg");
  msg.textContent = cfg.message || ""; msg.hidden = !cfg.message;
  const input = document.getElementById("uiDialogInput");
  input.hidden = !cfg.input;
  const ok = document.getElementById("uiDialogOk");
  ok.textContent = cfg.okLabel;
  ok.classList.toggle("danger", !!cfg.danger);
  document.getElementById("uiDialogCancel").textContent = cfg.cancelLabel;
  const p = new Promise(res => { _uiDlgResolve = res; });
  openModal("uiDialogScrim");
  if (cfg.input) {
    input.value = cfg.value || "";
    input.placeholder = cfg.placeholder || "";
    setTimeout(() => { input.focus(); input.select(); }, 40);
  } else {
    // focus the safe choice for a destructive confirm, the primary otherwise
    setTimeout(() => document.getElementById(cfg.danger ? "uiDialogCancel" : "uiDialogOk").focus(), 40);
  }
  return p;
}
function uiConfirm(opts) {
  if (typeof opts === "string") opts = { message: opts };
  return _openUiDialog({
    title: opts.title || "Are you sure?",
    message: opts.message || "",
    okLabel: opts.okLabel || "OK",
    cancelLabel: opts.cancelLabel || "Cancel",
    danger: opts.danger,
    input: false,
  }).then(v => v !== null);
}
function uiPrompt(opts) {
  if (typeof opts === "string") opts = { message: opts };
  return _openUiDialog({
    title: opts.title || "",
    message: opts.message || "",
    okLabel: opts.okLabel || "Save",
    cancelLabel: opts.cancelLabel || "Cancel",
    input: true,
    placeholder: opts.placeholder || "",
    value: opts.value || "",
  }).then(v => v === null ? null : v.trim());
}
(function initUiDialog() {
  const scrim = document.getElementById("uiDialogScrim");
  if (!scrim) return;
  const ok = document.getElementById("uiDialogOk");
  const input = document.getElementById("uiDialogInput");
  const submit = () => _uiDlgSettle(input.hidden ? "" : input.value);
  ok.addEventListener("click", submit);
  document.getElementById("uiDialogCancel").addEventListener("click", () => _uiDlgSettle(null));
  document.getElementById("uiDialogX").addEventListener("click", () => _uiDlgSettle(null));
  scrim.addEventListener("click", e => { if (e.target === scrim) _uiDlgSettle(null); });
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  });
  // Registered before main.js's global Escape handler (script order), so a
  // stopImmediatePropagation here keeps Escape from also bouncing the main
  // view to Read while the dialog is up.
  document.addEventListener("keydown", e => {
    if (!_uiDlgResolve || e.key !== "Escape") return;
    e.preventDefault(); e.stopImmediatePropagation();
    _uiDlgSettle(null);
  });
})();

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
// before. 429/5xx and 401/403 now surface everything it sends — message,
// detail, hint, and (for a 429) the full X-RateLimit-*/Retry-After picture —
// in a modal that has to be dismissed, so a developer testing against a
// free-tier key actually sees what happened and why instead of a feature
// just quietly not rendering. 401/403 is the case that reads worst without
// this: the API returns `api_key_required` for an *unrecognized* key, not
// only a missing one, so a stale/mistyped key otherwise shows up as a bare
// "api_key_required" errnote that looks like "no key set" when a key very
// much is set — the modal's Message/Hint rows make "your key was refused"
// unambiguous. A routine 404 (this app relies on those constantly — "no
// illustrations/places/people for this chapter" is a normal response,
// not a problem) still just toasts; a blocking modal on every one of those
// would make ordinary browsing unusable.
// A bad key at boot fails 5-6 catalog/chapter calls in a row — the modal is
// shown once per page load (authErrorShown) so it doesn't thrash.
let authErrorShown = false;
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
    else if ((res.status === 401 || res.status === 403) && !authErrorShown) {
      authErrorShown = true;
      showApiErrorModal(res.status, body, res.headers, path);
    }
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
  // pointer-events:none (the css lockdown) doesn't take the topbar / nav rail
  // out of the tab order — inert does, so a keyboard user can't tab into the
  // visually-blocked chrome behind the gate.
  ["topbar", "navrail", "mobileFooterNav", "profileTrigger"].forEach(rid => { const el = document.getElementById(rid); if (el) el.inert = true; });
  const rt = document.getElementById("readingText");
  if (rt) rt.innerHTML = "";
  // Move focus into the gate — its first link, or the "Open Settings" button.
  requestAnimationFrame(() => {
    const kb = document.getElementById("keyBanner");
    const f = kb && kb.querySelector("a[href], button");
    if (f) try { f.focus(); } catch (e) {}
  });
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
  document.getElementById("settingsIconVariant").value = getIconOBVariant();
  syncIconVariantField();
  document.getElementById("settingsFontSlider").value = getFontSize();
  document.getElementById("settingsUiFontSlider").value = getUiFontSize();
  document.getElementById("settingsExportReminder").checked = getExportReminderEnabled();
  document.getElementById("settingsReadStamp").checked = getReadStampEnabled();
  document.getElementById("settingsAudioContinuous").checked = getAudioContinuous();
  document.getElementById("settingsMarkReadOnListen").checked = getMarkReadOnListen();
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
  const segL = document.getElementById("themeSegLight"), segD = document.getElementById("themeSegDark");
  if (segL) segL.classList.toggle("on", t !== "dark");
  if (segD) segD.classList.toggle("on", t === "dark");
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
// The "Read on …" line under the chapter title. Default-on (absence = never
// turned off). Off falls back to the end-of-chapter "Marked as read" box.
function getReadStampEnabled() { return localStorage.getItem("iqb_read_stamp_enabled") !== "0"; }
function setReadStampEnabled(v) { localStorage.setItem("iqb_read_stamp_enabled", v ? "1" : "0"); renderChapterReadPrompt(); }
// Continuous audio play — when a chapter's narration ends, advance and keep
// playing. Default-off. Stops at the end of the book; a running sleep timer
// (js/reader.js) overrides it.
function getAudioContinuous() { return localStorage.getItem("iqb_audio_continuous") === "1"; }
function setAudioContinuous(v) {
  localStorage.setItem("iqb_audio_continuous", v ? "1" : "0");
  // The sleep timer only makes sense with continuous play — turning it off
  // cancels any running timer and hides the control (syncSleepTimerBtn).
  if (!v && typeof clearSleepTimer === "function") clearSleepTimer();
  else if (typeof syncSleepTimerBtn === "function") syncSleepTimerBtn();
}
// Count a chapter as read once its narration plays to the end (handleAudioEnded,
// js/reader.js). Default off. Deliberately skipped while a sleep timer is
// running — chapters that play out while you're dozing off shouldn't count.
function getMarkReadOnListen() { return localStorage.getItem("iqb_mark_read_on_listen") === "1"; }
function setMarkReadOnListen(v) { localStorage.setItem("iqb_mark_read_on_listen", v ? "1" : "0"); }
// Book icons. iqb_icon_style used to hold off|color|bw; it now holds
// off|overview|letters, with the Overview Bible color/B&W choice split out into
// iqb_icon_ob_variant. The two legacy values are migrated on read (no write) so
// an existing "bw" preference keeps meaning "Overview Bible, black & white".
function getIconStyle() {
  const v = localStorage.getItem("iqb_icon_style");
  if (v === "color" || v === "bw") return "overview";
  return v || "overview";
}
function getIconOBVariant() {
  const legacy = localStorage.getItem("iqb_icon_style");
  if (legacy === "color" || legacy === "bw") return legacy;
  return localStorage.getItem("iqb_icon_ob_variant") || "bw";
}
function setIconStyle(v) { localStorage.setItem("iqb_icon_style", v); syncIconVariantField(); loadTopBookIcon(); }
function setIconOBVariant(v) { localStorage.setItem("iqb_icon_ob_variant", v); loadTopBookIcon(); }
// Color / B&W applies to both the Overview Bible artwork and the lettered
// tiles (brand tint vs greyscale) — only "Off" has nothing to vary.
function syncIconVariantField() {
  const f = document.getElementById("settingsIconVariantField");
  if (f) f.hidden = getIconStyle() === "off";
}
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
  const t = getTheme();
  document.getElementById("themeSegLight").classList.toggle("on", t !== "dark");
  document.getElementById("themeSegDark").classList.toggle("on", t === "dark");
  openModal("fontSizeScrim");
}
