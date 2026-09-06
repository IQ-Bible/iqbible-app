/* ═══════════════════════════════════════════════════════════════════════
   CATALOG */
// The API's language_code / version-id prefix is ISO 639-3; BCP-47 (and the
// axe "valid-lang" check) wants the 2-letter 639-1 code where one exists.
// Covers the languages the catalog actually carries translations in; anything
// not listed falls back to the 3-letter code, which is still valid BCP-47.
const ISO3_TO_BCP47 = {
  eng: "en", spa: "es", por: "pt", fra: "fr", fre: "fr", deu: "de", ger: "de", rus: "ru", ita: "it",
  nld: "nl", dut: "nl", pol: "pl", ron: "ro", rum: "ro", ell: "el", gre: "el", ukr: "uk", ces: "cs", cze: "cs",
  hun: "hu", swe: "sv", fin: "fi", dan: "da", nor: "no", nob: "nb", nno: "nn", isl: "is", ice: "is", tur: "tr",
  ara: "ar", heb: "he", fas: "fa", per: "fa", urd: "ur", hin: "hi", ben: "bn", tam: "ta", tel: "te", mar: "mr",
  guj: "gu", pan: "pa", kan: "kn", mal: "ml", nep: "ne", sin: "si", tha: "th", vie: "vi", ind: "id",
  msa: "ms", may: "ms", zsm: "ms", tgl: "tl", zho: "zh", chi: "zh", cmn: "zh", yue: "zh", jpn: "ja", kor: "ko",
  swa: "sw", swh: "sw", amh: "am", hau: "ha", yor: "yo", ibo: "ig", zul: "zu", xho: "xh", afr: "af", som: "so",
  mlg: "mg", nya: "ny", sna: "sn", kin: "rw", lug: "lg", lin: "ln", hrv: "hr", srp: "sr", slk: "sk", slo: "sk",
  slv: "sl", bul: "bg", bel: "be", lit: "lt", lav: "lv", est: "et", sqi: "sq", alb: "sq", hye: "hy", arm: "hy",
  kat: "ka", geo: "ka", aze: "az", kaz: "kk", uzb: "uz", mon: "mn", khm: "km", lao: "lo", mya: "my", bur: "my",
  cat: "ca", eus: "eu", baq: "eu", glg: "gl", cym: "cy", wel: "cy", gle: "ga", gla: "gd", bre: "br", ltz: "lb",
  mlt: "mt", epo: "eo", lat: "la", hat: "ht", tir: "ti", orm: "om", tuk: "tk", kir: "ky", tgk: "tg", pus: "ps",
};
function bcp47(code) {
  const c = (code || "").toLowerCase().split(/[-_]/)[0];
  return ISO3_TO_BCP47[c] || c || "";
}
async function loadCatalog() {
  if (catalog && catalog.length) return catalog;
  try {
    const data = await apiJSON("/bibles");
    catalog = data.data || [];
    if (!catalog.length) toast("Could not load the translation catalog");
  } catch (e) { catalog = []; if (e.message !== "no_api_key") toast("Could not load the translation catalog"); }
  return catalog;
}

// Primary short abbreviation per book (e.g. GEN -> "Gen", 1CO -> "1 Cor"),
// used for the book-picker grid where full names don't fit — the grid still
// shows the full name via a tooltip, and the chapter header always shows it
// in full once a book is selected.
let bookAbbrev = {};
// Version-independent USFM -> full English name, so a book can be named even
// when it isn't in the current version's bookList (e.g. a deuterocanonical
// reference followed from a note while reading a 66-book translation).
let bookNameByUsfm = {};
async function loadBookAbbreviations() {
  try {
    const data = await apiJSON("/books/abbreviations");
    (data.data || []).forEach(b => {
      bookNameByUsfm[b.usfm_code] = b.name_en;
      // Some books carry more than one is_primary entry, including the
      // full English name itself (e.g. GEN: "Gen" and "Genesis" both
      // flagged primary; COL: only "Colossians" is flagged primary, "Col"
      // isn't) — so "first primary" or "shortest primary" alone can both
      // land on the full name. Prefer the shortest *non-full-name* entry,
      // primary first, falling back to any abbreviation, then the name.
      const all = b.abbreviations || [];
      const notFullName = list => list.filter(a => a.abbreviation !== b.name_en);
      let pool = notFullName(all.filter(a => a.is_primary));
      if (!pool.length) pool = notFullName(all);
      if (!pool.length) pool = all;
      const chosen = pool.slice().sort((a, c) => a.abbreviation.length - c.abbreviation.length)[0];
      bookAbbrev[b.usfm_code] = chosen ? chosen.abbreviation : b.name_en;
    });
  } catch (e) { /* falls back to full names in the grid */ }
}

/* ═══════════════════════════════════════════════════════════════════════
   VERSION PICKER — search-first because the catalog spans 1,000+
   languages; a language is a filterable field, not a menu to scroll. The
   active language filter shows as one always-visible button (#langSelBtn)
   that opens a language sub-screen; it used to be a scrolling chip strip
   whose selected chip could sit off-screen. */
let versionPickerLang = null;
let versionPickerAudioOnly = false;
const AUDIO_ICON = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 5V4L8 9H4Z"/><path d="M17 8a5 5 0 0 1 0 8"/></svg>`;

// Remembers the reader's last-picked language filter across visits (and
// across whichever version they land on), so reopening the picker doesn't
// dump a Spanish-speaking reader back into "All languages" every time.
function getLastLang() { return localStorage.getItem("iqb_last_lang") || null; }
function setLastLang(l) {
  if (l) localStorage.setItem("iqb_last_lang", l);
  else localStorage.removeItem("iqb_last_lang");
}
// Same idea, for the version itself — reading always resumes in whatever
// translation was last picked, instead of resetting to the hardcoded
// eng_kjv default in `current` on every reload. Applied once at init
// (js/main.js), before selectVersion() exists to be called normally.
function getLastVersion() { return localStorage.getItem("iqb_last_version") || null; }
function setLastVersion(id) { localStorage.setItem("iqb_last_version", id); }

function shortVersionLabel(title) {
  if (!title) return "";
  // No longer blanket-strips "(…)" content before abbreviating. That was
  // meant to stop a source citation like "(wordproject.org)" from
  // contributing its leading "(" as a fake initial ("AB(") — but the per-word
  // filter below already excludes any token that doesn't start with a letter
  // or digit, which handles exactly that case on its own (the whole
  // "(wordproject.org)" token starts with "(", so it's dropped either way).
  // Stripping unconditionally instead swallowed real, distinguishing edition
  // text too — "King James Version (1611 Original)" collapsed to the same
  // "KJV" as plain "King James Version", making the two indistinguishable
  // everywhere this label is used (the reading-page version button, Compare
  // Versions chips, the favorites row, search's results meta line). Leaving
  // parens in place lets a word *inside* them (e.g. "Original)") still count
  // normally, since only its own first character matters to the filter.
  const t = title.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const colon = t.indexOf(":");
  if (colon > 1 && colon <= 10) return t.slice(0, colon).trim();
  const STOP = new Set(["of", "the", "and", "for", "in", "a", "an"]);
  // Only tokens that start with a letter or digit feed the acronym — a bare
  // em dash between name parts ("Greek Bible — Modern") isn't an initial.
  const words = t.split(/\s+/).filter(w => /^[\p{L}\p{N}]/u.test(w) && !STOP.has(w.toLowerCase()));
  if (words.length >= 2) {
    const initials = words.map(w => w[0]).join("").toUpperCase();
    if (initials.length >= 2 && initials.length <= 6) return initials;
  }
  return t.length <= 8 ? t : t.slice(0, 6);
}

// "navigate" (default) picks a version to actually read; "plan" picks the
// version/canon a new reading plan is built for (js/plans.js), without
// touching what's on screen; "compare-default"/"compare-session" reuse this
// same search/filter picker to instead add a version to a Compare list
// (Settings' persisted default set, or a one-off addition inside Verse Tools >
// Compare) — see pickVersionRow() below. Every other picker mechanic (search,
// language selector, audio filter) is unchanged regardless of mode.
let versionPickerMode = "navigate";
function versionPickerTitleText() {
  return (versionPickerMode === "navigate" || versionPickerMode === "plan") ? "Choose a translation"
    : versionPickerMode === "search" ? "Search a translation"
    : "Add a Compare version";
}
async function openVersionPicker(mode) {
  versionPickerMode = mode || "navigate";
  openModal("versionPickerScrim");
  document.getElementById("versionSearchInput").value = "";
  await loadCatalog();
  versionPickerLang = getLastLang();
  versionPickerAudioOnly = false;
  document.getElementById("audioFilterCheck").checked = false;
  versionPickerShowVersions(); // resets to the translation screen (a prior open may have left it on the language sub-screen) and sets the title
  renderLangSelector();
  renderVersionList("");
  // Skip autofocus below the mobile breakpoint (1180px, matching every other
  // mobile check in this app) — it pops the on-screen keyboard immediately on
  // open, before the reader has asked to search, eating half the screen for
  // no reason on a touch device (unlike desktop, where jumping straight to
  // typing is the point).
  if (window.innerWidth > 1180) setTimeout(() => document.getElementById("versionSearchInput").focus(), 60);
}
function pickVersionRow(id) {
  if (versionPickerMode === "navigate") { selectVersion(id); return; }
  if (versionPickerMode === "plan") { setPlanBuilderVersion(id); return; }
  if (versionPickerMode === "search") { closeModal("versionPickerScrim"); setSearchVersion(id); return; }
  addCompareVersion(id, versionPickerMode);
  closeModal("versionPickerScrim");
}

// Two screens in one modal — the translation list and a language sub-screen —
// toggled with a back arrow, same pattern as the book/chapter navigator.
function versionPickerShowVersions() {
  document.getElementById("versionPickerTitle").textContent = versionPickerTitleText();
  document.getElementById("versionPickerBack").hidden = true;
  document.getElementById("langListSearch").hidden = true;
  document.getElementById("langSelBtn").hidden = false;
  document.getElementById("versionPickerSearch").hidden = false;
  document.getElementById("versionPickerFilters").hidden = false;
  document.getElementById("versionList").hidden = false;
  document.getElementById("versionLangList").hidden = true;
  renderFavRow(); // restores #favRow's display (openLangList hid it)
}
function openLangList() {
  document.getElementById("versionPickerTitle").textContent = "Choose a language";
  document.getElementById("versionPickerBack").hidden = false;
  document.getElementById("langSelBtn").hidden = true;
  document.getElementById("versionPickerSearch").hidden = true;
  document.getElementById("versionPickerFilters").hidden = true;
  document.getElementById("favRow").style.display = "none";
  document.getElementById("langListSearch").hidden = false;
  document.getElementById("langSearchInput").value = "";
  document.getElementById("versionList").hidden = true;
  document.getElementById("versionLangList").hidden = false;
  renderLangList("");
  if (window.innerWidth > 1180) setTimeout(() => document.getElementById("langSearchInput").focus(), 60);
}
function versionPickerBack() {
  versionPickerShowVersions();
  renderVersionList(document.getElementById("versionSearchInput").value);
}

// The active language filter as one always-visible button (was a horizontal
// #langRow chip strip whose selected chip scrolled out of sight — a filter you
// can't see is a filter you forget, then fight when you search). Also names the
// filter in the search placeholder so its scope is never ambiguous.
function renderLangSelector() {
  const count = versionPickerLang
    ? (catalog || []).filter(v => v.language_name === versionPickerLang).length
    : (catalog || []).length;
  document.getElementById("langSelName").textContent = versionPickerLang || "All languages";
  document.getElementById("langSelCount").textContent =
    count.toLocaleString() + (count === 1 ? " version" : " versions");
  document.getElementById("versionSearchInput").placeholder = versionPickerLang
    ? `Search ${versionPickerLang} versions…`
    : "Search all translations…";
}

// The language sub-screen — every language in the catalog (not a curated
// preset list), alphabetical, each with its version count and a tick on the
// active one. "All languages" (no filter) leads.
function renderLangList(q) {
  q = (q || "").trim().toLowerCase();
  const counts = {};
  (catalog || []).forEach(v => { if (v.language_name) counts[v.language_name] = (counts[v.language_name] || 0) + 1; });
  const names = Object.keys(counts).sort((a, b) => a.localeCompare(b)).filter(n => !q || n.toLowerCase().includes(q));
  const tick = `<svg class="langlist-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>`;
  const row = (label, call, on, count) =>
    `<button type="button" class="vrow langlist-row${on ? " on" : ""}"${on ? ' aria-current="true"' : ""} onclick="${call}"><span class="vt">${escHtml(label)}</span><span class="langlist-count">${count.toLocaleString()}</span>${on ? tick : ""}</button>`;
  let html = "";
  if (!q) {
    html += row("All languages", "pickLang(null)", !versionPickerLang, (catalog || []).length);
    html += `<div class="glabel">Languages</div>`;
  }
  names.forEach(n => { html += row(n, `pickLang('${n.replace(/'/g, "\\'")}')`, versionPickerLang === n, counts[n]); });
  if (q && !names.length) html = `<div class="emptynote" style="padding:24px">No language matches &ldquo;${escHtml(q)}&rdquo;. Try the version search instead.</div>`;
  document.getElementById("versionLangList").innerHTML = html;
}
function pickLang(l) {
  versionPickerLang = l;
  setLastLang(l);
  document.getElementById("versionSearchInput").value = "";
  renderLangSelector();
  versionPickerShowVersions();
  renderVersionList("");
}
function toggleAudioFilter() {
  versionPickerAudioOnly = !versionPickerAudioOnly;
  document.getElementById("audioFilterCheck").checked = versionPickerAudioOnly;
  renderVersionList(document.getElementById("versionSearchInput").value);
}
function onVersionSearch() { renderVersionList(document.getElementById("versionSearchInput").value); }

/* ── favorite translations — a star per row in the picker to favorite/
   unfavorite, plus a small standalone chip row (#favRow) above the list for
   one-tap access — not a section mixed into the scrollable list itself. Pure
   client-side (localStorage), global across every picker mode — a favorite
   translation is a favorite regardless of why you opened the picker. */
const LS_FAV_VERSIONS = "iqb_fav_versions";
function getFavoriteVersions() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_FAV_VERSIONS) || "[]")); }
  catch (e) { return new Set(); }
}
function toggleFavoriteVersion(id) {
  const favs = getFavoriteVersions();
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  localStorage.setItem(LS_FAV_VERSIONS, JSON.stringify(Array.from(favs)));
  renderFavRow();
  renderVersionList(document.getElementById("versionSearchInput").value);
}
function renderFavRow() {
  const row = document.getElementById("favRow");
  if (!row) return;
  const favs = getFavoriteVersions();
  const favVersions = (catalog || []).filter(v => favs.has(v.version_id))
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  if (!favVersions.length) { row.innerHTML = ""; row.style.display = "none"; return; }
  row.style.display = "flex";
  row.innerHTML = `<span class="filter-label favrow-label">Favorites</span>` + favVersions.map(v =>
    `<button type="button" class="favchip" onclick="pickVersionRow('${v.version_id}')" title="${escHtml(v.title || v.version_id)}">★ ${escHtml(shortVersionLabel(v.title) || v.version_id)}</button>`
  ).join("");
}
function versionRowHtml(v, favs) {
  const on = versionPickerMode === "navigate"
    ? v.version_id === current.version
    : versionPickerMode === "plan"
    ? v.version_id === planTargetVersion().id
    : versionPickerMode === "search"
    ? v.version_id === overlaySearchVersion
    : compareTargetList(versionPickerMode).includes(v.version_id);
  const audioBit = v.audio_count > 0
    ? `<span class="audiobadge" title="${v.audio_count > 1 ? v.audio_count + ' narrations available' : 'Audio narration available'}">${AUDIO_ICON}${v.audio_count > 1 ? ` ×${v.audio_count}` : ""}</span>`
    : "";
  const isFav = favs.has(v.version_id);
  // The row itself is a plain container — the name is one button and the star
  // another, as siblings, so there's no interactive-inside-interactive
  // (WCAG 4.1.2 / axe nested-interactive) and both are real tab stops.
  return `<div class="vrow ${on ? 'on' : ''}"${on ? ' aria-current="true"' : ''}>
      <button type="button" class="vrow-main" onclick="pickVersionRow('${v.version_id}')"><span class="vt">${escHtml(v.title || v.version_id)}</span><span class="vd">${escHtml(v.language_name || "")}${audioBit}</span></button>
      <button type="button" class="fav-star ${isFav ? 'on' : ''}" onclick="toggleFavoriteVersion('${v.version_id}')" aria-pressed="${isFav}" aria-label="${isFav ? 'Remove ' + escAttr(v.title || v.version_id) + ' from favorites' : 'Add ' + escAttr(v.title || v.version_id) + ' to favorites'}">${isFav ? '★' : '☆'}</button>
    </div>`;
}
function renderVersionList(q) {
  q = (q || "").trim().toLowerCase();
  let rows = (catalog || []);
  if (versionPickerLang) rows = rows.filter(v => v.language_name === versionPickerLang);
  if (versionPickerAudioOnly) rows = rows.filter(v => v.audio_count > 0);
  if (q) rows = rows.filter(v =>
    (v.title || "").toLowerCase().includes(q) ||
    (v.version_id || "").toLowerCase().includes(q) ||
    (v.language_name || "").toLowerCase().includes(q) ||
    (v.language_code || "").toLowerCase().includes(q)
  );
  rows = rows.slice(0, 200);

  const list = document.getElementById("versionList");
  if (!rows.length) {
    const hint = versionPickerLang
      ? `No matching translation in ${escHtml(versionPickerLang)}. Try a version name, or change the language above.`
      : `No matching translation. Try a language name, code (e.g. "spa"), or version title.`;
    list.innerHTML = `<div class="emptynote" style="padding:24px">${hint}</div>`;
    return;
  }

  const favs = getFavoriteVersions();
  let html = "";
  let lastLang = null;
  rows.sort((a, b) => (a.language_name || "").localeCompare(b.language_name || "") || (a.title || "").localeCompare(b.title || ""));
  rows.forEach(v => {
    if (!q && !versionPickerLang && v.language_name !== lastLang) {
      lastLang = v.language_name;
      html += `<div class="glabel">${escHtml(lastLang || "Other")}</div>`;
    }
    html += versionRowHtml(v, favs);
  });
  list.innerHTML = html;
}
async function selectVersion(id) {
  const v = (catalog || []).find(x => x.version_id === id);
  if (!v) return;
  current.version = id;
  current.versionTitle = v.title || id;
  current.textDirection = v.text_direction === "rtl" ? "rtl" : "ltr";
  current.lang = bcp47(v.language_code || id);
  if (v.language_name) setLastLang(v.language_name);
  setLastVersion(id);
  closeModal("versionPickerScrim");
  bookList = [];
  await loadBooks();
  // Stay exactly where the reader was — same book if this version has it
  // (loadBooks() already falls back to the first book when it doesn't, e.g.
  // an NT-only version), same chapter clamped to that book's length, same
  // verse target.
  await loadChapterMeta();
  const maxCh = chapterMeta.length ? chapterMeta[chapterMeta.length - 1].chapter : 1;
  const ch = Math.min(current.chapter || 1, maxCh);
  await loadChapter(ch, false, current.verse, current.verseEnd);
}
// Sets current.version/versionTitle/textDirection from a version id without
// any navigation side effects (no chapter reload) — used at init and by the
// router (a `?v=` deep link, or a popstate to an entry in another version).
// Returns false if the id isn't in the catalog, so callers can fall back.
function applyVersionById(id) {
  const v = (catalog || []).find(x => x.version_id === id);
  if (!v) return false;
  current.version = id;
  current.versionTitle = v.title || id;
  current.textDirection = v.text_direction === "rtl" ? "rtl" : "ltr";
  current.lang = bcp47(v.language_code || id);
  return true;
}
// Applied once at init from the stored iqb_last_version (js/main.js).
function applyStoredVersion() {
  const id = getLastVersion();
  if (id) applyVersionById(id);
}

/* ═══════════════════════════════════════════════════════════════════════
   BOOK PICKER */
async function loadBooks() {
  try {
    const data = await apiJSONCached(`/bibles/${current.version}/books`);
    bookList = data.data || [];
  } catch (e) { bookList = []; if (e.message !== "no_api_key") toast("Could not load this version's books"); }
  if (bookList.length && !bookList.some(b => b.usfm === current.book)) {
    current.book = bookList[0].usfm;
    current.bookName = bookList[0].name;
  }
}
async function openBookPicker() {
  navPickerShowBooks();
  openModal("navPickerScrim");
  document.getElementById("bookSearchInput").value = "";
  if (!bookList.length) await loadBooks();
  renderBookList("");
  // See openVersionPicker's matching comment — same reason to skip autofocus below 1180px.
  if (window.innerWidth > 1180) setTimeout(() => document.getElementById("bookSearchInput").focus(), 60);
}
// The navigator is one modal with two steps — book grid and chapter grid.
// These two just flip which step is showing; the callers below do the data.
function navPickerShowBooks() {
  document.getElementById("navPickerTitle").textContent = "Choose a book";
  document.getElementById("navPickerBack").hidden = true;
  document.getElementById("navPickerSearch").hidden = false;
  document.getElementById("bookList").hidden = false;
  document.getElementById("chapterGrid").hidden = true;
}
async function navPickerBack() {
  navPickerShowBooks();
  if (!bookList.length) await loadBooks();
  renderBookList(document.getElementById("bookSearchInput").value || "");
}
function onBookSearch() { renderBookList(document.getElementById("bookSearchInput").value); }
// Row-major grid, 4 rows per testament: column count is Math.ceil(count/4),
// so the default grid-auto-flow (row-major) naturally lines up row 1 as the
// first N books in canonical order, row 2 as the next N, etc.
function bookGridSection(label, list) {
  if (!list.length) return "";
  const cols = Math.max(1, Math.ceil(list.length / 4));
  const chips = list.map(b => {
    const on = b.usfm === current.book;
    const label2 = bookAbbrev[b.usfm] || b.name;
    return `<button class="bookchip ${on ? 'on' : ''}" title="${escHtml(b.name)}" onclick="selectBook('${b.usfm}','${b.name.replace(/'/g, "\\'")}')">${escHtml(label2)}</button>`;
  }).join("");
  return `<div class="glabel">${label}</div><div class="bookgrid" style="grid-template-columns:repeat(${cols},1fr)">${chips}</div>`;
}
function renderBookList(q) {
  q = (q || "").trim().toLowerCase();
  const rows = bookList.filter(b => !q || b.name.toLowerCase().includes(q) || b.usfm.toLowerCase().includes(q));
  // NT is the fixed 27; everything else (incl. any deuterocanonical books this
  // version's canon carries) is "Old Testament", kept in the API's returned
  // canonical order. See NT_USFM's comment for why there's no third section.
  const nt = rows.filter(b => NT_USFM.has(b.usfm));
  const ot = rows.filter(b => !NT_USFM.has(b.usfm));
  document.getElementById("bookList").innerHTML =
    (bookGridSection("Old Testament", ot) + bookGridSection("New Testament", nt))
    || `<div class="emptynote" style="padding:24px">No matching book.</div>`;
}
async function selectBook(usfm, name) {
  current.book = usfm; current.bookName = name;
  chapterMeta = [];
  await loadChapterMeta();
  // Single-chapter books (Obadiah, Philemon, Jude, 2–3 John) — a one-button
  // chapter grid is pure friction, so read straight in. Every other book
  // advances to the chapter step of the navigator.
  if (chapterMeta.length <= 1) { closeModal("navPickerScrim"); await loadChapter(1, false); return; }
  openChapterPicker(true);
}

/* ═══════════════════════════════════════════════════════════════════════
   CHAPTER PICKER */
async function loadChapterMeta() {
  try {
    const data = await apiJSONCached(`/bibles/${current.version}/${current.book}/meta`);
    chapterMeta = data.chapters || [];
  } catch (e) { chapterMeta = [{ chapter: 1, verse_count: 0 }]; }
}
// `freshBook` = opened straight after a book selection, so nothing is "on"
// yet (no chapter loaded) and the old book's chapter must not light up.
async function openChapterPicker(freshBook) {
  openModal("navPickerScrim"); // no-op if already open (advanced here from selectBook)
  document.getElementById("navPickerTitle").textContent = current.bookName;
  document.getElementById("navPickerBack").hidden = false;
  document.getElementById("navPickerSearch").hidden = true;
  document.getElementById("bookList").hidden = true;
  document.getElementById("chapterGrid").hidden = false;
  if (!chapterMeta.length) await loadChapterMeta();
  const grid = document.getElementById("chapterGrid");
  grid.innerHTML = chapterMeta.map(c =>
    `<button class="chapchip ${!freshBook && c.chapter == current.chapter ? 'on' : ''}" onclick="selectChapter(${c.chapter})">${c.chapter}</button>`
  ).join("");
  // Prepend a full-width "Intro" chip only when the API actually carries
  // book-intro text (GET /books/{book}/info) — it's book metadata, not a
  // chapter, so it opens the same lightweight preview as the reading
  // header's (i) button rather than pretending to be chapter 0. Injected
  // async so the numbered grid never waits on this fetch.
  const bookAtOpen = current.book;
  getBookInfo(bookAtOpen).then(info => {
    if (current.book !== bookAtOpen || grid.querySelector(".introchip")) return;
    if (!info || !(info.introduction || info.canonical_significance)) return;
    grid.insertAdjacentHTML("afterbegin",
      `<button class="chapchip introchip" onclick="closeModal('navPickerScrim');openBookInfoModal('${bookAtOpen}')">Intro</button>`);
  });
}
async function selectChapter(n) {
  closeModal("navPickerScrim");
  await loadChapter(n, false);
}
