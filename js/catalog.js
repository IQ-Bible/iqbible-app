/* ═══════════════════════════════════════════════════════════════════════
   CATALOG */
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
async function loadBookAbbreviations() {
  try {
    const data = await apiJSON("/books/abbreviations");
    (data.data || []).forEach(b => {
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
   languages; a language is a filterable field, not a menu to scroll. */
const POPULAR_LANGS = ["English", "Spanish", "French", "German", "Portuguese", "Arabic", "Chinese", "Hebrew", "Greek", "Russian"];
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
  // Strip any "(…)" source/qualifier (e.g. "Amharic Bible (wordproject.org)")
  // before abbreviating — otherwise its opening "(" becomes the first letter
  // of the acronym ("AB(").
  const t = title.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
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
// language chips, audio filter) is unchanged regardless of mode.
let versionPickerMode = "navigate";
async function openVersionPicker(mode) {
  versionPickerMode = mode || "navigate";
  document.getElementById("versionPickerTitle").textContent =
    (versionPickerMode === "navigate" || versionPickerMode === "plan") ? "Choose a translation" : "Add a Compare version";
  openModal("versionPickerScrim");
  document.getElementById("versionSearchInput").value = "";
  await loadCatalog();
  versionPickerLang = getLastLang();
  versionPickerAudioOnly = false;
  document.getElementById("audioFilterChip").classList.remove("active");
  renderLangRow();
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
  addCompareVersion(id, versionPickerMode);
  closeModal("versionPickerScrim");
}
function renderLangRow() {
  const counts = {};
  (catalog || []).forEach(v => { counts[v.language_name] = (counts[v.language_name] || 0) + 1; });
  const row = document.getElementById("langRow");
  const chips = [`<button class="langchip ${!versionPickerLang ? 'on' : ''}" onclick="pickLang(null)">All languages · ${(catalog || []).length}</button>`];
  POPULAR_LANGS.forEach(l => {
    if (!counts[l]) return;
    chips.push(`<button class="langchip ${versionPickerLang === l ? 'on' : ''}" onclick="pickLang('${l.replace(/'/g, "\\'")}')">${l} · ${counts[l]}</button>`);
  });
  row.innerHTML = chips.join("");
}
function pickLang(l) { versionPickerLang = l; setLastLang(l); renderLangRow(); renderVersionList(document.getElementById("versionSearchInput").value); }
function toggleAudioFilter() {
  versionPickerAudioOnly = !versionPickerAudioOnly;
  document.getElementById("audioFilterChip").classList.toggle("active", versionPickerAudioOnly);
  renderVersionList(document.getElementById("versionSearchInput").value);
}
function onVersionSearch() { renderVersionList(document.getElementById("versionSearchInput").value); }
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
  if (!rows.length) { list.innerHTML = `<div class="emptynote" style="padding:24px">No matching translation. Try a language name, code (e.g. "spa"), or version title.</div>`; return; }

  let html = "";
  let lastLang = null;
  rows.sort((a, b) => (a.language_name || "").localeCompare(b.language_name || "") || (a.title || "").localeCompare(b.title || ""));
  rows.forEach(v => {
    if (!q && !versionPickerLang && v.language_name !== lastLang) {
      lastLang = v.language_name;
      html += `<div class="glabel">${escHtml(lastLang || "Other")}</div>`;
    }
    const on = versionPickerMode === "navigate"
      ? v.version_id === current.version
      : versionPickerMode === "plan"
      ? v.version_id === planTargetVersion().id
      : compareTargetList(versionPickerMode).includes(v.version_id);
    const audioBit = v.audio_count > 0
      ? `<span class="audiobadge" title="${v.audio_count > 1 ? v.audio_count + ' narrations available' : 'Audio narration available'}">${AUDIO_ICON}${v.audio_count > 1 ? ` ×${v.audio_count}` : ""}</span>`
      : "";
    html += `<div class="vrow ${on ? 'on' : ''}" onclick="pickVersionRow('${v.version_id}')">
      <div><div class="vt">${escHtml(v.title || v.version_id)}</div><div class="vd">${escHtml(v.language_name || "")}${audioBit}</div></div>
    </div>`;
  });
  list.innerHTML = html;
}
async function selectVersion(id) {
  const v = (catalog || []).find(x => x.version_id === id);
  if (!v) return;
  current.version = id;
  current.versionTitle = v.title || id;
  current.textDirection = v.text_direction === "rtl" ? "rtl" : "ltr";
  if (v.language_name) setLastLang(v.language_name);
  setLastVersion(id);
  closeModal("versionPickerScrim");
  bookList = [];
  await loadBooks();
  await loadChapter(1, true);
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
  openModal("bookPickerScrim");
  document.getElementById("bookSearchInput").value = "";
  if (!bookList.length) await loadBooks();
  renderBookList("");
  // See openVersionPicker's matching comment — same reason to skip autofocus below 1180px.
  if (window.innerWidth > 1180) setTimeout(() => document.getElementById("bookSearchInput").focus(), 60);
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
  const ot = rows.filter(b => OT_USFM.has(b.usfm));
  const nt = rows.filter(b => NT_USFM.has(b.usfm));
  const other = rows.filter(b => !OT_USFM.has(b.usfm) && !NT_USFM.has(b.usfm));
  document.getElementById("bookList").innerHTML =
    (bookGridSection("Old Testament", ot) + bookGridSection("New Testament", nt) + bookGridSection("Apocrypha / Deuterocanon", other))
    || `<div class="emptynote" style="padding:24px">No matching book.</div>`;
}
async function selectBook(usfm, name) {
  current.book = usfm; current.bookName = name;
  closeModal("bookPickerScrim");
  await loadChapter(1, true);
}

/* ═══════════════════════════════════════════════════════════════════════
   CHAPTER PICKER */
async function loadChapterMeta() {
  try {
    const data = await apiJSONCached(`/bibles/${current.version}/${current.book}/meta`);
    chapterMeta = data.chapters || [];
  } catch (e) { chapterMeta = [{ chapter: 1, verse_count: 0 }]; }
}
async function openChapterPicker() {
  openModal("chapterPickerScrim");
  document.getElementById("chapterPickerTitle").textContent = `${current.bookName} — choose a chapter`;
  if (!chapterMeta.length) await loadChapterMeta();
  document.getElementById("chapterGrid").innerHTML = chapterMeta.map(c =>
    `<button class="chapchip ${c.chapter == current.chapter ? 'on' : ''}" onclick="selectChapter(${c.chapter})">${c.chapter}</button>`
  ).join("");
}
async function selectChapter(n) {
  closeModal("chapterPickerScrim");
  await loadChapter(n, false);
}
