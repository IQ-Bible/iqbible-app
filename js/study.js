/* ═══════════════════════════════════════════════════════════════════════
   STUDY TOOLS — three tabs aimed at deep word/passage study, the part of a
   "study Bible" the app didn't cover at all before (Verse Tools has
   Original Language/Cross-refs/Commentary/Compare/Topics, but nothing
   book-level or lexicon-level). Same overlay shell as #exploreOverlay. */
let studyActiveTab = "book";
function openStudy() {
  switchMainView("study");
  switchStudyTab(studyActiveTab);
}
function closeStudy() {
  switchMainView("read");
}
const STUDY_TAB_DESC = {
  book: "Background on a book of the Bible — who wrote it, when, and its main themes and structure.",
  word: "Look up a Strong's number for its Hebrew/Greek lexicon entries — Strong's, BDB, LSJ, Abbott-Smith — and every place that word occurs in Scripture.",
  variants: "Places where the manuscript tradition differs, and how the major textual editions read there.",
};
function switchStudyTab(tab) {
  studyActiveTab = tab;
  document.querySelectorAll("#studyTabs .lib-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.getElementById("studyDesc").textContent = STUDY_TAB_DESC[tab] || "";
  if (tab === "word") renderStudyWord();
  else if (tab === "book") renderStudyBook();
  else if (tab === "variants") renderStudyVariants();
}
// Cross-link from Verse Tools > Original Language (js/reader.js): each
// word's strongs_id is clickable straight into this tab, pre-filled.
function openWordStudy(strongsId) {
  openStudy();
  switchStudyTab("word");
  document.getElementById("wordStudySearchInput").value = strongsId;
  runWordStudy(strongsId);
}
// Cross-link from the reading header's book-info button (current book) and
// the Book Picker's preview panel (any book) — jumps straight to Study Tools
// > Book Guide for a specific book. pendingBookGuideBook survives the
// openStudy() → switchStudyTab("book") → renderStudyBook() hop and is
// consumed there, so an explicit jump wins over the "default to current
// book" reset renderStudyBook otherwise does every time the tab opens.
let pendingBookGuideBook = null;
function openBookGuide(usfm) {
  pendingBookGuideBook = usfm;
  studyActiveTab = "book";
  openStudy();
}
// Renders an arbitrary key/value object as labeled rows — used for the
// lexicon endpoints (GET /lexicon/.../{key} has no fixed Go struct; each
// row is literally "whatever columns that source's DB table has") and for
// Book Guide's free-form book-info JSON (same situation, documented as
// such in the API source). Values are run through linkifyCitations, not a
// plain escape, since a free-form field can legitimately embed a Scripture
// reference (e.g. book-info's "key_passages"/"cross_references").
async function renderGenericFields(obj, skipKeys) {
  const skip = new Set(skipKeys || []);
  const entries = Object.entries(obj || {}).filter(([k, v]) =>
    !skip.has(k) && v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length));
  const rows = await Promise.all(entries.map(async ([k, v]) => {
    const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const raw = Array.isArray(v) ? v.join("; ") : (typeof v === "object" ? JSON.stringify(v) : String(v));
    const html = await linkifyCitations(raw);
    return `<div class="person-def"><div class="person-def-src">${escHtml(label)}</div><div class="person-def-text">${html}</div></div>`;
  }));
  return rows.join("");
}

/* ── Word Study — GET /lexicon/{greek|hebrew}/strongs/{key} for the Strong's
   entry, GET /lexicon/crosswalk/{key} to map that Strong's number onto the
   native key each other source uses (BDB for Hebrew; LSJ/Abbott-Smith for
   Greek — none of them key on a bare Strong's number), then one lookup per
   resolved key. Each source is tried independently — a 404 from one is
   normal, same tolerance the five dictionary tabs already use — and the
   results are shown one source at a time in a tab row, with a Crosswalk tab
   for the raw mapping itself. Finally GET /original-language/search?strongs=
   for every occurrence across Scripture. Strong's-id input only — there's no
   by-English-word lexicon search endpoint, so this deliberately doesn't try
   to guess one. ── */
function renderStudyWord() {
  document.getElementById("studyBody").innerHTML = `
    <div class="msearch" style="margin-bottom:10px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg><input type="text" id="wordStudySearchInput" placeholder="Strong's number, e.g. G26 or H430…" onkeydown="if(event.key==='Enter') runWordStudy(this.value)" autocomplete="off"><button type="button" class="mclear" aria-label="Clear" onclick="clearSearchInput('wordStudySearchInput')">&times;</button></div>
    <div class="tool-hint">Enter a Strong's id to look up its lexicon entries — Strong's, plus BDB, LSJ or Abbott-Smith — and every occurrence across Scripture. Find one on any verse via Verse Tools › Original Language.</div>
    <div id="wordStudyArea"></div>`;
}
// GET /lexicon/crosswalk/{key} is the real Strong's → native-key bridge and
// is used first. This stays only as a fallback for the two Greek sources when
// the crosswalk has no row for a key (or that dataset isn't loaded on the API
// instance in use): LSJ/Abbott-Smith key their entries by zero-padded dStrong
// codes (e.g. "G0026", per both endpoints' own 404 hint), which the crosswalk
// would otherwise be the only way to obtain. No equivalent fallback exists for
// BDB — its codes ("BDB1005") aren't derivable from a Strong's number, so
// without a crosswalk row the BDB tab just doesn't appear.
function zeroPadGreekKey(key) {
  const m = /^G(\d+)([A-Za-z]?)$/i.exec(key);
  return m ? `G${m[1].padStart(4, "0")}${m[2].toUpperCase()}` : key;
}
const LEX_BODY_KEYS = ["glossary", "meaning", "gloss", "definition"];
const LEX_SKIP_KEYS = new Set(["word", "greek", "hebrew", "transliteration", "part_of_speech", "morph", "occurences", "id", "language", "strongs_id", "native_key", "estrong", "ustrong", "key", ...LEX_BODY_KEYS]);
async function renderLexiconEntry(row, sourceLabel) {
  const wordText = row.word || row.greek || row.hebrew || "";
  const pos = row.part_of_speech || row.morph || "";
  const occ = row.occurences;
  const chips = [pos, typeof occ === "number" ? `${occ} occurrence${occ === 1 ? "" : "s"}` : null].filter(Boolean);
  const bodyKey = LEX_BODY_KEYS.find(k => row[k]);
  const bodyHtml = bodyKey ? await linkifyCitations(String(row[bodyKey])) : "";
  const extraHtml = await renderGenericFields(row, [...LEX_SKIP_KEYS]);
  return `<div class="person-section lw-card">
    <div class="person-section-label">${escHtml(sourceLabel)}</div>
    <div class="lw-headline">
      ${wordText ? `<span class="lw-orig">${escHtml(wordText)}</span>` : ""}
      ${row.transliteration ? `<span class="lw-translit">${escHtml(row.transliteration)}</span>` : ""}
    </div>
    ${chips.length ? `<div class="lw-chips">${chips.map(c => `<span class="topic-chip">${escHtml(c)}</span>`).join("")}</div>` : ""}
    ${bodyHtml ? `<div class="lw-gloss">${bodyHtml}</div>` : ""}
    ${extraHtml ? `<div class="lw-extra">${extraHtml}</div>` : ""}
  </div>`;
}
// Non-Strong's lexicon sources per language, in tab order after Strong's.
const LEX_SOURCES = {
  hebrew: [{ id: "bdb", label: "BDB", name: "Brown-Driver-Briggs" }],
  greek: [{ id: "lsj", label: "LSJ", name: "Liddell-Scott-Jones" }, { id: "abbott-smith", label: "Abbott-Smith", name: "Abbott-Smith" }],
};
// The Crosswalk tab — the raw GET /lexicon/crosswalk/{key} rows, i.e. which
// other lexicons carry this word and under what native key (the same mapping
// used above to fetch those entries).
function renderCrosswalk(rows) {
  const srcName = {};
  Object.values(LEX_SOURCES).flat().forEach(s => { srcName[s.id] = s.name; });
  const items = rows.map(r => `<div class="person-def">
    <div class="person-def-src">${escHtml(srcName[r.source] || r.source)}</div>
    <div class="person-def-text">${escHtml(r.native_key)}${r.lemma ? ` · <span class="lw-orig">${escHtml(r.lemma)}</span>` : ""}</div>
  </div>`).join("");
  return `<div class="person-section lw-card">
    <div class="person-section-label">Lexicon Crosswalk</div>
    <div class="lw-extra" style="border-top:none;padding-top:0">${items}</div>
  </div>`;
}
let wordStudyToken = 0;
async function runWordStudy(key) {
  key = (key || "").trim();
  if (!key) return;
  const token = ++wordStudyToken;
  const area = document.getElementById("wordStudyArea");
  area.innerHTML = `<div class="spin"></div>`;
  const lang = /^h/i.test(key) ? "hebrew" : "greek";

  const [strongsRes, crossRes] = await Promise.all([
    apiJSON(`/lexicon/${lang}/strongs/${encodeURIComponent(key)}`).catch(() => null),
    apiJSON(`/lexicon/crosswalk/${encodeURIComponent(key)}`).catch(() => null),
  ]);
  if (token !== wordStudyToken) return;
  const crossRows = (crossRes && crossRes.data) || [];

  // One tab per source that returned an entry, Strong's first, then a
  // Crosswalk tab if the mapping had any rows.
  const tabs = [];
  for (const row of (strongsRes && strongsRes.data) || []) tabs.push({ label: "Strong's", html: await renderLexiconEntry(row, "Strong's") });
  for (const src of LEX_SOURCES[lang]) {
    let keys = crossRows.filter(r => r.source === src.id).map(r => r.native_key);
    if (!keys.length && lang === "greek") keys = [zeroPadGreekKey(key)]; // crosswalk unavailable — fall back to the documented G0026 shape
    for (const nk of keys) {
      try {
        const d = await apiJSON(`/lexicon/${lang}/${src.id}/${encodeURIComponent(nk)}`);
        for (const row of (d.data || [])) tabs.push({ label: src.label, html: await renderLexiconEntry(row, src.name) });
      } catch (e) { /* no entry from this source — normal, same as the dictionary tabs */ }
    }
  }
  if (crossRows.length) tabs.push({ label: "Crosswalk", html: renderCrosswalk(crossRows) });
  if (token !== wordStudyToken) return;

  let lexHtml;
  if (!tabs.length) lexHtml = `<div class="dd-empty">No lexicon entry found for "${escHtml(key)}".</div>`;
  else if (tabs.length === 1) lexHtml = tabs[0].html;
  else {
    const btns = tabs.map((t, i) => `<button type="button" class="filter-chip dict-tab-btn${i === 0 ? " active" : ""}" data-idx="${i}">${escHtml(t.label)}</button>`).join("");
    const panels = tabs.map((t, i) => `<div class="dict-tab-panel${i === 0 ? " active" : ""}" data-idx="${i}">${t.html}</div>`).join("");
    lexHtml = `<div class="dict-tabs"><div class="dict-tab-btns">${btns}</div>${panels}</div>`;
  }

  let occHtml = "";
  try {
    const d = await apiJSON(`/original-language/search?strongs=${encodeURIComponent(key)}&limit=100&count=1`);
    const occ = d.occurrences || [];
    if (occ.length) {
      const refs = occ.map(o => ({ book: o.book, chapter: o.chapter, verse: o.verse }));
      const previewByRef = await fetchVersePreviews(refs);
      const rows = occ.map(o => {
        const text = previewByRef[`${o.book}.${o.chapter}.${o.verse}`];
        const label = `${o.name_en} ${o.chapter}:${o.verse}`;
        const citeAttr = text ? ` data-cite-id="${registerCiteId(label, text)}"` : "";
        return `<button class="prophecy-ref" style="margin:0 6px 6px 0"${citeAttr} onclick="closeStudy();jumpToVerse('${o.book}',${o.chapter},${o.verse})">${escHtml(label)}</button>`;
      }).join("");
      const moreNote = d.total_matches && d.total_matches > occ.length ? `<div class="rc-more">Showing ${occ.length} of ${d.total_matches} occurrences.</div>` : "";
      occHtml = `<div class="person-section"><div class="person-section-label">Every Occurrence</div>${rows}${moreNote}</div>`;
    }
  } catch (e) { /* no occurrences — normal */ }
  if (token !== wordStudyToken) return;
  document.getElementById("wordStudyArea").innerHTML = lexHtml + occHtml;
}

/* ── Book Guide — GET /books/{book}/info (30+ free-form introduction/
   authorship/theology fields, not a fixed struct — see the API's own
   source) + GET /books/{book}/commentaries (which of the 326 sources cover
   this book). Grouped into a meta strip, an always-visible overview, and
   two <details> accordions (native, no JS state needed) rather than the
   raw field dump this used to render one after another — with this many
   keys (11 theological_* fields alone) that wasn't usable. Also backs the
   lightweight quick-info modal opened from the reading header's (i) button
   (bookInfoPreviewHTML, below) and the Book Picker's preview panel
   (js/catalog.js) — one cached fetch (getBookInfo), three call sites. ── */
let bookGuideSelected = null;
let bookGuideToken = 0;
function renderStudyBook() {
  // Opens on the book being read now, every time — a stale pick from an
  // earlier visit to this tab shouldn't linger. An explicit jump (Book
  // Picker preview → "Read More in Book Guide") sets pendingBookGuideBook to
  // override this for that one open.
  bookGuideSelected = pendingBookGuideBook || current.book;
  pendingBookGuideBook = null;
  const books = bookList.length ? bookList : [{ usfm: current.book, name: current.bookName }];
  document.getElementById("studyBody").innerHTML = `
    <div class="share-fields" style="margin-bottom:16px">
      <select id="bookGuideSelect" onchange="onBookGuideChange()">${books.map(b => `<option value="${escAttr(b.usfm)}"${b.usfm === bookGuideSelected ? " selected" : ""}>${escHtml(b.name)}</option>`).join("")}</select>
    </div>
    <div id="bookGuideArea"></div>`;
  runBookGuideLookup();
}
function onBookGuideChange() { bookGuideSelected = document.getElementById("bookGuideSelect").value; runBookGuideLookup(); }

async function getBookInfo(usfm) {
  try { return await apiJSONCached(`/books/${usfm}/info`); }
  catch (e) { return null; }
}
function truncateText(s, max) {
  if (!s || s.length <= max) return s || "";
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}
// Quick preview used by both the (i) button's modal and the Book Picker's
// panel above "Choose a Book" — closeScrimId names whichever modal hosts it,
// so "Read More" can dismiss the right one before jumping to the full guide.
async function bookInfoPreviewHTML(usfm, closeScrimId) {
  const info = await getBookInfo(usfm);
  if (!info) return `<div class="dd-empty">No book guide data on file for this book.</div>`;
  const metaBits = [info.author, info.date].filter(Boolean);
  const sigHtml = info.canonical_significance ? await linkifyCitations(truncateText(info.canonical_significance, 220)) : "";
  const introHtml = info.introduction ? await linkifyCitations(info.introduction) : "";
  const closeCall = closeScrimId ? `closeModal('${closeScrimId}');` : "";
  return `
    ${metaBits.length ? `<div class="place-meta" style="margin-bottom:12px">${escHtml(metaBits.join(" · "))}</div>` : ""}
    ${sigHtml ? `<div class="person-def"><div class="person-def-src">Canonical Significance</div><div class="person-def-text">${sigHtml}</div></div>` : ""}
    ${introHtml ? `<div class="person-def" style="margin-top:10px"><div class="person-def-src">Introduction</div><div class="person-def-text">${introHtml}</div></div>` : ""}
    ${!sigHtml && !introHtml ? `<div class="dd-empty">No book guide data on file for this book.</div>` : ""}
    <button class="filter-chip" style="margin-top:12px" onclick="${closeCall}openBookGuide('${usfm}')">Read More in Book Guide →</button>`;
}
// The reading header's (i) button — a lightweight preview instead of
// jumping straight into the full Study Tools > Book Guide.
async function openBookInfoModal(usfm) {
  const b = bookList.find(x => x.usfm === usfm);
  const name = b ? b.name : (current.bookName || usfm);
  document.getElementById("bookInfoTitle").textContent = name;
  openModal("bookInfoScrim");
  const bodyEl = document.getElementById("bookInfoBody");
  bodyEl.innerHTML = `<div class="spin"></div>`;
  bodyEl.innerHTML = await bookInfoPreviewHTML(usfm, "bookInfoScrim");
}

const BG_META_FIELDS = [["author", "Author"], ["date", "Date"], ["genre", "Genre"], ["chapterCount", "Chapters"], ["original_language", "Original Language"]];
const BG_OVERVIEW_FIELDS = [["canonical_significance", "Canonical Significance"], ["introduction", "Introduction"], ["purpose", "Purpose"], ["summary", "Summary"]];
const BG_STRUCTURE_FIELDS = [["structure", "Structure"], ["themes", "Themes"], ["major_characters", "Major Characters"], ["key_passages", "Key Passages"], ["key_verses", "Key Verses"]];
const BG_CONTEXT_FIELDS = [["historical_context", "Historical Context"], ["historical_impact", "Historical Impact"], ["literary_style", "Literary Style"], ["literary_influence", "Literary Influence"], ["cultural_practices", "Cultural Practices"], ["geographical_setting", "Geographical Setting"], ["manuscript_evidence", "Manuscript Evidence"], ["interpretive_challenges", "Interpretive Challenges"], ["connection_to_other_books", "Connection to Other Books"], ["notable_references", "Notable References"], ["audience", "Audience"], ["word_origin", "Word Origin"], ["original_language_meaning", "Original Language Meaning"], ["symbolism", "Symbolism"], ["introduction_long", "Extended Introduction"]];
const BG_THEOLOGY_FIELDS = [["theological_introduction", "Introduction"], ["theological_covenantal_themes", "Covenantal Themes"], ["theological_redemptive_plan", "Redemptive Plan"], ["theological_divine_attributes", "Divine Attributes"], ["theological_divine_providence", "Divine Providence"], ["theological_eschatological_themes", "Eschatological Themes"], ["theological_faith_and_obedience", "Faith & Obedience"], ["theological_humanity_image_of_god", "Humanity & the Image of God"], ["theological_justice_and_mercy", "Justice & Mercy"], ["theological_nature_of_revelation", "Nature of Revelation"], ["theological_symbolism", "Symbolism"], ["theological_theology_of_sin", "Theology of Sin"], ["ethical_teachings", "Ethical Teachings"], ["practical_application", "Practical Application"], ["cross_references", "Cross References"]];
async function renderFieldGroup(obj, fieldList) {
  const present = fieldList.filter(([k]) => obj[k] != null && obj[k] !== "" && !(Array.isArray(obj[k]) && !obj[k].length));
  const rows = await Promise.all(present.map(async ([k, label]) => {
    const raw = Array.isArray(obj[k]) ? obj[k].join("; ") : String(obj[k]);
    const html = await linkifyCitations(raw);
    return `<div class="person-def"><div class="person-def-src">${escHtml(label)}</div><div class="person-def-text">${html}</div></div>`;
  }));
  return rows.join("");
}
async function runBookGuideLookup() {
  const token = ++bookGuideToken;
  const area = document.getElementById("bookGuideArea");
  area.innerHTML = `<div class="spin"></div>`;
  const usfm = bookGuideSelected;
  const [infoResult, commResult] = await Promise.allSettled([
    apiJSONCached(`/books/${usfm}/info`),
    apiJSONCached(`/books/${usfm}/commentaries`),
  ]);
  if (token !== bookGuideToken) return;
  if (infoResult.status !== "fulfilled") { area.innerHTML = `<div class="dd-empty">No book guide data on file for this book.</div>`; return; }
  const info = infoResult.value;

  let iconHtml = "";
  const iconStyle = getIconStyle();
  if (iconStyle !== "off") {
    try {
      const icon = await apiJSONCached(`/icons/${usfm}?style=${iconStyle}`);
      if (icon.url) iconHtml = `<div class="bookicon-badge"><img src="${escHtml(icon.url)}" alt=""></div>`;
    } catch (e) { /* no icon on file for this book — header just skips it */ }
  }
  const metaCells = BG_META_FIELDS.filter(([k]) => info[k] != null && info[k] !== "")
    .map(([k, label]) => `<div class="bg-meta-cell"><div class="bg-meta-label">${escHtml(label)}</div><div class="bg-meta-value">${escHtml(String(info[k]))}</div></div>`).join("");

  const [overviewHtml, structureHtml, contextHtml, theologyHtml] = await Promise.all([
    renderFieldGroup(info, BG_OVERVIEW_FIELDS),
    renderFieldGroup(info, BG_STRUCTURE_FIELDS),
    renderFieldGroup(info, BG_CONTEXT_FIELDS),
    renderFieldGroup(info, BG_THEOLOGY_FIELDS),
  ]);
  const commSources = commResult.status === "fulfilled" ? (commResult.value.data || []) : [];
  const commHtml = bookCommentaryPickerHTML(usfm, commSources);
  if (token !== bookGuideToken) return;
  const body = `
    <div class="bg-head">${iconHtml}<div class="bg-title">${escHtml(info.name_en || current.bookName)}</div></div>
    ${metaCells ? `<div class="bg-meta-grid">${metaCells}</div>` : ""}
    ${overviewHtml ? `<div class="person-section">${overviewHtml}</div>` : ""}
    ${structureHtml ? `<details class="bg-accordion" open><summary>Structure &amp; Key Content</summary><div class="bg-accordion-body">${structureHtml}</div></details>` : ""}
    ${contextHtml ? `<details class="bg-accordion"><summary>Historical &amp; Literary Context</summary><div class="bg-accordion-body">${contextHtml}</div></details>` : ""}
    ${theologyHtml ? `<details class="bg-accordion"><summary>Theological Themes</summary><div class="bg-accordion-body">${theologyHtml}</div></details>` : ""}
    ${commHtml}`;
  area.innerHTML = (overviewHtml || structureHtml || contextHtml || theologyHtml || commHtml) ? body : `<div class="dd-empty">No book guide data on file for this book.</div>`;
  if (commHtml) loadBookCommentary(0);
}

/* Book-level commentary — a dropdown of every commentary source that covers
   this book (from the single GET /books/{book}/commentaries call
   runBookGuideLookup already makes), each loading that source's book
   introduction (GET /commentaries/{name}/{book}/0 — "chapter 0") on select,
   cached per source for the life of this Book Guide render. A native <select>
   was rejected for a 2-col grid: a book like Genesis has dozens of sources
   and the names run long. There's no bulk way to know which of the covering
   sources actually carry a chapter-0 entry (see NOTES.md / API issue #231),
   so the list can't be trimmed to only those — a source with no book intro
   just says so rather than being hidden behind one probe call per source.
   mhenry/gill (the two whole-Bible commentaries) sort to the front. */
let bgCommSources = [];
let bgCommHtml = {};
let bgCommBook = null;
let bgCommActive = 0;
function bookCommentaryPickerHTML(usfm, sources) {
  const rank = s => s.name === "mhenry" ? 0 : s.name === "gill" ? 1 : 2;
  bgCommSources = sources.slice().sort((a, b) => rank(a) - rank(b));
  bgCommHtml = {};
  bgCommBook = usfm;
  bgCommActive = 0;
  if (!bgCommSources.length) return "";
  const label = s => escHtml(s.author_name || s.name);
  const opts = bgCommSources.map((s, i) => `<button type="button" class="bg-comm-opt${i === 0 ? " active" : ""}" data-idx="${i}">${label(s)}</button>`).join("");
  return `<div class="person-section bg-comm">
    <div class="person-section-label">Commentary</div>
    <button type="button" class="bg-comm-trigger" aria-expanded="false" aria-haspopup="listbox" onclick="toggleBookCommMenu(this)">
      <span id="bgCommCurrent">${label(bgCommSources[0])}</span>
      <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div class="bg-comm-menu" id="bgCommMenu" role="listbox">${opts}</div>
    <div id="bgCommBody"><div class="spin"></div></div>
  </div>`;
}
function toggleBookCommMenu(btn) {
  const open = document.getElementById("bgCommMenu").classList.toggle("open");
  btn.setAttribute("aria-expanded", open ? "true" : "false");
}
function selectBookCommentary(idx) {
  if (!bgCommSources[idx]) return;
  bgCommActive = idx;
  const menu = document.getElementById("bgCommMenu");
  if (menu) {
    menu.classList.remove("open");
    menu.querySelectorAll(".bg-comm-opt").forEach(b => b.classList.toggle("active", +b.dataset.idx === idx));
  }
  const trigger = document.querySelector("#bookGuideArea .bg-comm-trigger");
  if (trigger) trigger.setAttribute("aria-expanded", "false");
  const cur = document.getElementById("bgCommCurrent");
  if (cur) cur.textContent = bgCommSources[idx].author_name || bgCommSources[idx].name;
  loadBookCommentary(idx);
}
async function loadBookCommentary(idx) {
  const el = document.getElementById("bgCommBody");
  if (!el || !bgCommSources[idx]) return;
  if (bgCommHtml[idx] != null) { el.innerHTML = bgCommHtml[idx]; return; }
  el.innerHTML = `<div class="spin"></div>`;
  const token = bookGuideToken;
  const src = bgCommSources[idx], usfm = bgCommBook;
  let html;
  try {
    const d = await apiJSONCached(`/commentaries/${encodeURIComponent(src.name)}/${usfm}/0`);
    const entries = d.entries || [];
    if (!entries.length) throw new Error("empty");
    const paragraphs = await Promise.all(entries.map(e => linkifyPreParsedCitations(e.text || "", e.citations)));
    html = paragraphs.map(p => `<div class="person-def-text" style="margin-bottom:14px">${p}</div>`).join("");
  } catch (e) {
    html = `<div class="dd-empty">No book-level introduction from this source.</div>`;
  }
  if (token !== bookGuideToken) return;
  bgCommHtml[idx] = html;
  if (bgCommActive === idx) el.innerHTML = html;
}
// Commentary picker — option select, plus outside-click to close the menu
// (no existing dropdown widget in the app to borrow a handler from).
document.addEventListener("click", e => {
  const opt = e.target.closest("#bookGuideArea .bg-comm-opt");
  if (opt) { selectBookCommentary(+opt.dataset.idx); return; }
  if (e.target.closest("#bookGuideArea .bg-comm")) return;
  const menu = document.getElementById("bgCommMenu");
  if (menu && menu.classList.contains("open")) {
    menu.classList.remove("open");
    const t = document.querySelector("#bookGuideArea .bg-comm-trigger");
    if (t) t.setAttribute("aria-expanded", "false");
  }
});

/* ── Textual Variants — GET /textual-variants (flat, unscoped list; the
   scoped route requires book AND chapter, so a book-only filter here is
   plain client-side filtering of the already-fully-fetched flat list, same
   precedent as Timeline's chronologyForChapter). ── */
let allTextualVariants = null;
let variantsBookFilter = null;
async function getAllTextualVariants() {
  if (!allTextualVariants) {
    try { const d = await apiJSON("/textual-variants"); allTextualVariants = d.data || []; }
    catch (e) { allTextualVariants = []; }
  }
  return allTextualVariants;
}
// Book select only lists books that actually have variant entries — built
// from the already-fetched flat list itself (not a heuristic/denylist),
// so a reader never picks a book that can only ever show "nothing on file".
async function renderStudyVariants() {
  document.getElementById("studyBody").innerHTML = `<div class="spin"></div>`;
  const all = await getAllTextualVariants();
  const presentBooks = new Set(all.map(v => v.book));
  const books = bookList.filter(b => presentBooks.has(b.usfm));
  document.getElementById("studyBody").innerHTML = `
    <div class="tool-filter-row share-fields">
      <select id="variantsBookSelect" onchange="onVariantsFilterChange()"><option value="">All Books</option>${books.map(b => `<option value="${escAttr(b.usfm)}"${b.usfm === variantsBookFilter ? " selected" : ""}>${escHtml(b.name)}</option>`).join("")}</select>
    </div>
    <div id="variantsArea"></div>`;
  runVariantsLookup(all);
}
function onVariantsFilterChange() { variantsBookFilter = document.getElementById("variantsBookSelect").value || null; runVariantsLookup(); }
async function runVariantsLookup(preloaded) {
  const area = document.getElementById("variantsArea");
  area.innerHTML = `<div class="spin"></div>`;
  const all = preloaded || await getAllTextualVariants();
  const filtered = variantsBookFilter ? all.filter(v => v.book === variantsBookFilter) : all;
  if (!filtered.length) { area.innerHTML = `<div class="dd-empty">No textual variants on file${variantsBookFilter ? " for this book" : ""}.</div>`; return; }
  const entries = await Promise.all(filtered.map(async v => {
    const bookName = (bookList.find(b => b.usfm === v.book) || {}).name || v.book;
    const crossesChapter = v.chapter_end !== v.chapter_start;
    const refLabel = `${bookName} ${v.chapter_start}:${v.verse_start}` + ((crossesChapter || v.verse_end !== v.verse_start) ? `-${crossesChapter ? v.chapter_end + ":" : ""}${v.verse_end}` : "");
    const explanationHtml = await linkifyCitations(v.explanation || "");
    return `<div class="prophecy-entry">
      <div class="place-name" style="margin-bottom:4px">${escHtml(v.title)}</div>
      <div class="place-meta" style="margin-bottom:8px">${escHtml(refLabel)} · ${escHtml(v.variant_type)}</div>
      <div class="person-def"><div class="person-def-src">Traditional</div><div class="person-def-text">${escHtml(v.traditional_reading)}${v.witnesses_traditional ? ` <span class="rc-more">(${escHtml(v.witnesses_traditional)})</span>` : ""}</div></div>
      <div class="person-def"><div class="person-def-src">Critical</div><div class="person-def-text">${escHtml(v.critical_reading)}${v.witnesses_critical ? ` <span class="rc-more">(${escHtml(v.witnesses_critical)})</span>` : ""}</div></div>
      ${v.explanation ? `<div class="prophecy-desc">${explanationHtml}</div>` : ""}
      <button class="prophecy-ref" onclick="closeStudy();jumpToVerse('${v.book}',${v.chapter_start},${v.verse_start})">Go to ${escHtml(refLabel)}</button>
    </div>`;
  }));
  area.innerHTML = entries.join("");
}
