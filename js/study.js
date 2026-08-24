/* ═══════════════════════════════════════════════════════════════════════
   STUDY TOOLS — three tabs aimed at deep word/passage study, the part of a
   "study Bible" the app didn't cover at all before (Verse Tools has
   Original Language/Cross-refs/Commentary/Compare/Topics, but nothing
   book-level or lexicon-level). Same overlay shell as #exploreOverlay. */
let studyActiveTab = "word";
function openStudy() {
  switchMainView("study");
  switchStudyTab(studyActiveTab);
}
function closeStudy() {
  switchMainView("read");
}
function switchStudyTab(tab) {
  studyActiveTab = tab;
  document.querySelectorAll("#studyTabs .lib-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
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
// Cross-link from the reading header's book-info button — jumps straight to
// Study Tools > Book Guide for the book currently open, instead of making
// the reader hunt for it after switching tabs by hand.
function openBookGuide(usfm) {
  bookGuideSelected = usfm;
  openStudy();
  switchStudyTab("book");
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
    return `<div class="char-def"><div class="char-def-src">${escHtml(label)}</div><div class="char-def-text">${html}</div></div>`;
  }));
  return rows.join("");
}

/* ── Word Study — GET /lexicon/{greek|hebrew}/strongs/{key} (+ BDB for
   Hebrew, LSJ/Abbott-Smith for Greek — each tried independently, a 404 from
   one source is normal, same tolerance the five dictionary tabs already
   use), then GET /original-language/search?strongs= for every occurrence
   across Scripture. Strong's-id input only — there's no by-English-word
   lexicon search endpoint, so this deliberately doesn't try to guess
   one. ── */
function renderStudyWord() {
  document.getElementById("studyBody").innerHTML = `
    <div class="msearch" style="margin-bottom:10px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg><input type="text" id="wordStudySearchInput" placeholder="Strong's number, e.g. G26 or H430…" onkeydown="if(event.key==='Enter') runWordStudy(this.value)" autocomplete="off"><button type="button" class="mclear" aria-label="Clear" onclick="clearSearchInput('wordStudySearchInput')">&times;</button></div>
    <div class="tool-hint">Enter a Strong's id to look up its lexicon entry and every occurrence across Scripture. Find one on any verse via Verse Tools › Original Language.</div>
    <div id="wordStudyArea"></div>`;
}
// LSJ/Abbott-Smith key their entries by zero-padded dStrong codes (e.g.
// "G0026", per both endpoints' own 404 hint), not the bare Strong's number a
// reader actually types/clicks through with — without this, every LSJ/
// Abbott-Smith lookup 404s regardless of the word, silently (same "no entry
// from this source" tolerance as everywhere else), so those two sources
// never actually returned anything. BDB has no such mapping (its own codes,
// e.g. "BDB1005", are unrelated to Strong's numbering) — flagged in
// NOTES.md, not fixable client-side.
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
  return `<div class="char-section lw-card">
    <div class="char-section-label">${escHtml(sourceLabel)}</div>
    <div class="lw-headline">
      ${wordText ? `<span class="lw-orig">${escHtml(wordText)}</span>` : ""}
      ${row.transliteration ? `<span class="lw-translit">${escHtml(row.transliteration)}</span>` : ""}
    </div>
    ${chips.length ? `<div class="lw-chips">${chips.map(c => `<span class="topic-chip">${escHtml(c)}</span>`).join("")}</div>` : ""}
    ${bodyHtml ? `<div class="lw-gloss">${bodyHtml}</div>` : ""}
    ${extraHtml ? `<div class="lw-extra">${extraHtml}</div>` : ""}
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
  const sources = [{ path: `/lexicon/${lang}/strongs/${encodeURIComponent(key)}`, label: "Strong's" }]
    .concat(lang === "hebrew"
      ? [{ path: `/lexicon/hebrew/bdb/${encodeURIComponent(key)}`, label: "BDB" }]
      : [{ path: `/lexicon/greek/lsj/${encodeURIComponent(zeroPadGreekKey(key))}`, label: "LSJ" }, { path: `/lexicon/greek/abbott-smith/${encodeURIComponent(zeroPadGreekKey(key))}`, label: "Abbott-Smith" }]);
  const sections = [];
  for (const src of sources) {
    try {
      const d = await apiJSON(src.path);
      for (const row of (d.data || [])) sections.push(await renderLexiconEntry(row, src.label));
    } catch (e) { /* no entry from this source — normal, same as the dictionary tabs */ }
  }
  if (token !== wordStudyToken) return;
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
      occHtml = `<div class="char-section"><div class="char-section-label">Every Occurrence</div>${rows}${moreNote}</div>`;
    }
  } catch (e) { /* no occurrences — normal */ }
  if (token !== wordStudyToken) return;
  document.getElementById("wordStudyArea").innerHTML = (sections.join("") || `<div class="dd-empty">No lexicon entry found for "${escHtml(key)}".</div>`) + occHtml;
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
function renderStudyBook() {
  bookGuideSelected = bookGuideSelected || current.book;
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
    ${sigHtml ? `<div class="char-def"><div class="char-def-src">Canonical Significance</div><div class="char-def-text">${sigHtml}</div></div>` : ""}
    ${introHtml ? `<div class="char-def" style="margin-top:10px"><div class="char-def-src">Introduction</div><div class="char-def-text">${introHtml}</div></div>` : ""}
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
    return `<div class="char-def"><div class="char-def-src">${escHtml(label)}</div><div class="char-def-text">${html}</div></div>`;
  }));
  return rows.join("");
}
async function runBookGuideLookup() {
  const area = document.getElementById("bookGuideArea");
  area.innerHTML = `<div class="spin"></div>`;
  const usfm = bookGuideSelected;
  const [infoResult, commResult] = await Promise.allSettled([
    apiJSONCached(`/books/${usfm}/info`),
    apiJSONCached(`/books/${usfm}/commentaries`),
  ]);
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
  let commHtml = "";
  if (commResult.status === "fulfilled") {
    const sources = commResult.value.data || [];
    if (sources.length) commHtml = `<div class="char-section"><div class="char-section-label">Commentary Coverage (${sources.length})</div>${sources.map(s => `<span class="topic-chip">${escHtml(s.author_name || s.name)}</span>`).join("")}</div>`;
  }
  const body = `
    <div class="bg-head">${iconHtml}<div class="bg-title">${escHtml(info.name_en || current.bookName)}</div></div>
    ${metaCells ? `<div class="bg-meta-grid">${metaCells}</div>` : ""}
    ${overviewHtml ? `<div class="char-section">${overviewHtml}</div>` : ""}
    ${structureHtml ? `<details class="bg-accordion" open><summary>Structure &amp; Key Content</summary><div class="bg-accordion-body">${structureHtml}</div></details>` : ""}
    ${contextHtml ? `<details class="bg-accordion"><summary>Historical &amp; Literary Context</summary><div class="bg-accordion-body">${contextHtml}</div></details>` : ""}
    ${theologyHtml ? `<details class="bg-accordion"><summary>Theological Themes</summary><div class="bg-accordion-body">${theologyHtml}</div></details>` : ""}
    ${commHtml}`;
  area.innerHTML = (overviewHtml || structureHtml || contextHtml || theologyHtml || commHtml) ? body : `<div class="dd-empty">No book guide data on file for this book.</div>`;
}

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
      <div class="char-def"><div class="char-def-src">Traditional</div><div class="char-def-text">${escHtml(v.traditional_reading)}${v.witnesses_traditional ? ` <span class="rc-more">(${escHtml(v.witnesses_traditional)})</span>` : ""}</div></div>
      <div class="char-def"><div class="char-def-src">Critical</div><div class="char-def-text">${escHtml(v.critical_reading)}${v.witnesses_critical ? ` <span class="rc-more">(${escHtml(v.witnesses_critical)})</span>` : ""}</div></div>
      ${v.explanation ? `<div class="prophecy-desc">${explanationHtml}</div>` : ""}
      <button class="prophecy-ref" onclick="closeStudy();jumpToVerse('${v.book}',${v.chapter_start},${v.verse_start})">Go to ${escHtml(refLabel)}</button>
    </div>`;
  }));
  area.innerHTML = entries.join("");
}
