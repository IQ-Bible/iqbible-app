/* ═══════════════════════════════════════════════════════════════════════
   EXPLORE — five endpoint families this app didn't surface anywhere before:
   the Harmony of the Gospels, Topics, a standalone Bible Atlas (Places
   independent of the current chapter), a Genealogy Explorer, and a
   Collections tab (Parables/Miracles/Prayers/Names of God/Titles of
   Jesus/Weights & Measures/Stories). Same overlay shell as #libraryOverlay
   (js/notes.js); every tab renders its own controls + list/detail view
   into #exploreBody rather than pre-built per-tab markup. */
let exploreActiveTab = "atlas";
function openExplore() {
  switchMainView("explore");
  switchExploreTab(exploreActiveTab);
}
function closeExplore() {
  switchMainView("read");
}
function switchExploreTab(tab) {
  exploreActiveTab = tab;
  document.querySelectorAll("#exploreTabs .lib-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "harmony") renderExploreHarmonyList();
  else if (tab === "topics") renderExploreTopicsList();
  else if (tab === "atlas") renderExploreAtlas();
  else if (tab === "genealogy") renderExploreGenealogy();
  else if (tab === "collections") renderExploreCollections();
  else if (tab === "extrabiblical") renderExploreExtrabiblical();
}
const GOSPEL_NAMES = { MAT: "Matthew", MRK: "Mark", LUK: "Luke", JHN: "John" };

/* ── Harmony of the Gospels — GET /harmony, GET /harmony/{section}.
   List groups sections by part_title with a Gospel filter chip row; detail
   shows one column per Gospel present in that section's references, each
   pulled via fetchVerseRangeText (below) — the same BatchVerses call
   fetchVersePreviews already uses, just applied to a contiguous range
   instead of a scattered ref list, not a new endpoint. ── */
let harmonySections = null;
let harmonyGospelFilter = null;
async function getHarmonySections() {
  if (!harmonySections) {
    try { const d = await apiJSON("/harmony"); harmonySections = d.data || []; }
    catch (e) { harmonySections = []; }
  }
  return harmonySections;
}
async function renderExploreHarmonyList() {
  const body = document.getElementById("exploreBody");
  body.innerHTML = `<div class="spin"></div>`;
  const all = await getHarmonySections();
  const filterChips = `<div class="tool-filter-row">
    <button class="filter-chip${!harmonyGospelFilter ? " active" : ""}" onclick="setHarmonyFilter(null)">All Gospels</button>
    ${Object.entries(GOSPEL_NAMES).map(([code, name]) => `<button class="filter-chip${harmonyGospelFilter === code ? " active" : ""}" onclick="setHarmonyFilter('${code}')">${name}</button>`).join("")}
  </div>`;
  const filtered = harmonyGospelFilter ? all.filter(s => (s.references || []).some(r => r.book === harmonyGospelFilter)) : all;
  if (!filtered.length) { body.innerHTML = filterChips + `<div class="dd-empty">No sections match.</div>`; return; }
  let html = filterChips;
  let lastPart = null;
  filtered.forEach(s => {
    if (s.part_title !== lastPart) { html += `<div class="tool-group-label">${escHtml(s.part_title)}</div>`; lastPart = s.part_title; }
    const count = (s.references || []).length;
    html += `<div class="vrow" onclick="openHarmonySection('${String(s.number).replace(/'/g, "\\'")}')"><div><div class="vt">${escHtml(s.title)}</div><div class="vd">${count} reference${count === 1 ? "" : "s"}</div></div></div>`;
  });
  body.innerHTML = html;
}
function setHarmonyFilter(code) { harmonyGospelFilter = code; renderExploreHarmonyList(); }
async function openHarmonySection(number) {
  const body = document.getElementById("exploreBody");
  body.innerHTML = `<div class="tool-back-row"><button onclick="renderExploreHarmonyList()">‹ All Sections</button></div><div class="spin"></div>`;
  try {
    const d = await apiJSON(`/harmony/${encodeURIComponent(number)}`);
    body.innerHTML = await renderHarmonyDetail(d.data);
  } catch (e) {
    body.innerHTML = `<div class="tool-back-row"><button onclick="renderExploreHarmonyList()">‹ All Sections</button></div><div class="dd-empty">Could not load this section.</div>`;
  }
}
// Expands a harmony reference's range into individual verse refs (single-
// chapter case) and batches them through the existing verses?refs= endpoint
// — exactly fetchVersePreviews' own pattern, just for a contiguous range. A
// bare book+chapter reference (no verse bounds) falls back to the already-
// cached per-chapter endpoint instead of guessing a verse count; a
// cross-chapter section (rare) concatenates each full chapter.
async function fetchVerseRangeText(ref) {
  const { book, chapter_start, verse_start, chapter_end, verse_end } = ref;
  if (chapter_start === chapter_end) {
    if (!verse_start) {
      try { const d = await apiJSONCached(`/bibles/${current.version}/${book}/${chapter_start}`); return (d.data || []).map(v => v.text).join(" "); }
      catch (e) { return ""; }
    }
    const ve = verse_end || verse_start;
    const refs = [];
    for (let v = verse_start; v <= ve; v++) refs.push({ book, chapter: chapter_start, verse: v });
    const previewByRef = await fetchVersePreviews(refs);
    return refs.map(r => previewByRef[`${r.book}.${r.chapter}.${r.verse}`] || "").filter(Boolean).join(" ");
  }
  let text = "";
  for (let ch = chapter_start; ch <= chapter_end; ch++) {
    try { const d = await apiJSONCached(`/bibles/${current.version}/${book}/${ch}`); text += (d.data || []).map(v => v.text).join(" ") + " "; }
    catch (e) { /* this chapter didn't resolve — skip it, keep the rest */ }
  }
  return text.trim();
}
async function renderHarmonyDetail(section) {
  const byBook = {};
  (section.references || []).forEach(r => { (byBook[r.book] = byBook[r.book] || []).push(r); });
  const gospelOrder = Object.keys(GOSPEL_NAMES).filter(b => byBook[b]);
  const cols = await Promise.all(gospelOrder.map(async book => {
    const texts = await Promise.all(byBook[book].map(r => fetchVerseRangeText(r)));
    const refLabel = byBook[book].map(r => r.citation).join("; ");
    const text = texts.filter(Boolean).join(" ");
    return `<div class="harmony-col">
      <div class="harmony-col-head">${GOSPEL_NAMES[book]}</div>
      <div class="harmony-col-ref">${escHtml(refLabel)}</div>
      <div class="harmony-col-text">${text ? escHtml(text) : `<span class="harmony-col-empty">No text resolved for this reference.</span>`}</div>
    </div>`;
  }));
  return `<div class="tool-back-row"><button onclick="renderExploreHarmonyList()">‹ All Sections</button></div>
    <div class="tool-group-label">${escHtml(section.part_title)}</div>
    <h3 style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1.35rem;margin-bottom:14px">${escHtml(section.title)}</h3>
    <div class="harmony-columns">${cols.join("")}</div>`;
}

/* ── Topics — GET /topics (list of names), GET /topics/{topic} (citation
   list). List/edition-chip changes rebuild the whole tab; typed search only
   touches #topicsListArea so the input never loses focus mid-keystroke. ── */
let topicsListCache = {};
let topicsEdition = "all";
let topicsSearchTimer = null;
// Remembered across a detail visit and back — going to a topic and back to
// "All Topics" (or re-clicking the Topics tab) should land right where the
// reader left it, not a freshly reset search/scroll.
let topicsSearchValue = "";
let topicsListScrollTop = 0;
async function getTopicsList(edition) {
  if (!topicsListCache[edition]) {
    try { const d = await apiJSON(`/topics?edition=${edition}`); topicsListCache[edition] = d.data || []; }
    catch (e) { topicsListCache[edition] = []; }
  }
  return topicsListCache[edition];
}
async function renderExploreTopicsList() {
  const body = document.getElementById("exploreBody");
  body.innerHTML = `<div class="spin"></div>`;
  const names = await getTopicsList(topicsEdition);
  body.innerHTML = `
    <div class="msearch" style="margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg><input type="text" id="topicsSearchInput" placeholder="Search ${names.length} topics…" value="${escAttr(topicsSearchValue)}" oninput="onTopicsSearchType()" autocomplete="off"><button type="button" class="mclear" aria-label="Clear" onclick="clearSearchInput('topicsSearchInput')">&times;</button></div>
    <div class="tool-filter-row">
      <button class="filter-chip${topicsEdition === "all" ? " active" : ""}" onclick="setTopicsEdition('all')">All</button>
      <button class="filter-chip${topicsEdition === "iqbible" ? " active" : ""}" onclick="setTopicsEdition('iqbible')">Curated</button>
      <button class="filter-chip${topicsEdition === "nave-torrey" ? " active" : ""}" onclick="setTopicsEdition('nave-torrey')">Nave/Torrey</button>
    </div>
    <div id="topicsListArea"></div>`;
  await renderTopicsListArea();
  // #exploreBody doesn't scroll itself — .overlay-results-area, its direct
  // parent, is the actual scrollport (overflow-y:auto, css/styles.css).
  body.parentElement.scrollTop = topicsListScrollTop;
}
function setTopicsEdition(ed) { topicsEdition = ed; renderExploreTopicsList(); }
function onTopicsSearchType() {
  topicsSearchValue = document.getElementById("topicsSearchInput").value;
  clearTimeout(topicsSearchTimer);
  topicsSearchTimer = setTimeout(renderTopicsListArea, 150);
}
async function renderTopicsListArea() {
  const area = document.getElementById("topicsListArea");
  if (!area) return;
  const input = document.getElementById("topicsSearchInput");
  const q = ((input && input.value) || "").trim().toLowerCase();
  const names = await getTopicsList(topicsEdition);
  const filtered = (q ? names.filter(n => n.toLowerCase().includes(q)) : names).slice(0, 300);
  area.innerHTML = filtered.map(n => `<div class="vrow" onclick="openTopicDetail('${n.replace(/'/g, "\\'")}')"><div><div class="vt">${escHtml(n)}</div></div></div>`).join("")
    || `<div class="dd-empty">No matching topics.</div>`;
}
async function openTopicDetail(name) {
  const backRow = `<div class="tool-back-row"><button onclick="switchExploreTab('topics')">‹ All Topics</button></div>`;
  const body = document.getElementById("exploreBody");
  topicsListScrollTop = body.parentElement.scrollTop;
  body.innerHTML = backRow + `<div class="spin"></div>`;
  // GET /topics/{topic} only accepts "iqbible"/"nave-torrey", unlike the
  // list endpoint — omitted, it already falls back sensibly on its own, so
  // "all" (this tab's default edition filter) must never be sent through.
  const editionParam = topicsEdition !== "all" ? `?edition=${topicsEdition}` : "";
  let citations;
  try { const d = await apiJSON(`/topics/${encodeURIComponent(name)}${editionParam}`); citations = d.data || []; }
  catch (e) { body.innerHTML = backRow + `<div class="dd-empty">Could not load this topic.</div>`; return; }
  const allRefs = [];
  citations.forEach(c => (c.verses || []).forEach(v => allRefs.push(v)));
  const previewByRef = await fetchVersePreviews(allRefs.slice(0, 80));
  const html = citations.map(c => {
    const v = c.verses && c.verses[0];
    const text = v && previewByRef[`${v.book}.${v.chapter}.${v.verse}`];
    const citeAttr = text ? ` data-cite-id="${registerCiteId(c.citation, text)}"` : "";
    const jump = v ? ` onclick="closeExplore();jumpToVerse('${v.book}',${v.chapter},${v.verse})"` : "";
    return `<button class="prophecy-ref" style="margin:0 6px 8px 0"${citeAttr}${jump}>${c.label ? escHtml(c.label) + ": " : ""}${escHtml(c.citation)}</button>`;
  }).join("");
  body.innerHTML = backRow +
    `<h3 style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1.35rem;margin-bottom:14px">${escHtml(name)}</h3>
    <div>${html || `<div class="dd-empty">No citations for this topic.</div>`}</div>`;
}

/* ── Bible Atlas — GET /geo/places (search), GET /geo/places/{id} (detail
   + every verse occurrence). Independent of the current chapter, unlike
   the existing chapter-scoped Places card/modal in reader.js. ── */
let atlasSearchTimer = null;
// Remembered across a place visit and back, same as Topics above — going to
// a place (e.g. Egypt) and back to "‹ Search Places" should still show that
// search's results, not force retyping it. Cached results avoid a second
// live search call on the way back, not just an emptied input.
let atlasSearchValue = "";
let atlasLastResults = null;
let atlasListScrollTop = 0;
function renderExploreAtlas() {
  const body = document.getElementById("exploreBody");
  body.innerHTML = `
    <div class="msearch" style="margin-bottom:16px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg><input type="text" id="atlasSearchInput" placeholder="Search places by name…" value="${escAttr(atlasSearchValue)}" oninput="onAtlasSearchType()" autocomplete="off"><button type="button" class="mclear" aria-label="Clear" onclick="clearSearchInput('atlasSearchInput')">&times;</button></div>
    <div id="atlasListArea"></div>`;
  const area = document.getElementById("atlasListArea");
  if (atlasLastResults) renderAtlasResults(atlasLastResults, atlasSearchValue);
  else area.innerHTML = `<div class="dd-empty">Search for a place to begin — e.g. "Jerusalem" or "Egypt".</div>`;
  // #exploreBody doesn't scroll itself — .overlay-results-area, its direct
  // parent, is the actual scrollport (overflow-y:auto, css/styles.css).
  body.parentElement.scrollTop = atlasListScrollTop;
}
function onAtlasSearchType() {
  atlasSearchValue = document.getElementById("atlasSearchInput").value;
  clearTimeout(atlasSearchTimer);
  const q = atlasSearchValue.trim();
  if (q.length < 2) { atlasLastResults = null; document.getElementById("atlasListArea").innerHTML = `<div class="dd-empty">Search for a place to begin — e.g. "Jerusalem" or "Egypt".</div>`; return; }
  atlasSearchTimer = setTimeout(() => runAtlasSearch(q), 350);
}
function renderAtlasResults(places, q) {
  const area = document.getElementById("atlasListArea");
  if (!places.length) { area.innerHTML = `<div class="dd-empty">No places match "${escHtml(q)}".</div>`; return; }
  area.innerHTML = places.slice(0, 60).map(p =>
    `<div class="vrow" onclick="openAtlasPlace(${p.id})"><div><div class="vt">${escHtml((p.preceding_article ? p.preceding_article + " " : "") + p.name)}</div><div class="vd">${escHtml([p.place_type, p.modern_name].filter(Boolean).join(" · "))}</div></div></div>`
  ).join("");
}
async function runAtlasSearch(q) {
  const area = document.getElementById("atlasListArea");
  area.innerHTML = `<div class="spin"></div>`;
  let places = [];
  try { const d = await apiJSON(`/geo/places?q=${encodeURIComponent(q)}`); places = d.data || []; }
  catch (e) { area.innerHTML = `<div class="dd-empty">Search failed.</div>`; return; }
  atlasLastResults = places;
  renderAtlasResults(places, q);
}
// GeoPlace (the API's place record) has no description/encyclopedia field
// of its own — confirmed against the backend struct, logged in NOTES.md.
// The app's existing dictionary sources (DICT_SOURCES, js/reader.js — the
// same five used for the reading-text tooltip/term modal) genuinely cover
// well-known place names though (Smith's in particular is a Bible
// geography dictionary), so a place detail tries all five for an exact-name
// hit, same "a miss from one source is normal" tolerance runWordStudy uses.
// No section renders at all if nothing hits — honest absence, not filler.
// One tab per dictionary source that had an entry, rather than dumping every
// hit consecutively — .dict-tabs/.dict-tab-btn/.dict-tab-panel (styles in
// css/styles.css, switcher delegated in main.js) so a single-hit place skips
// the tab row entirely and just shows its one definition.
async function fetchAtlasPlaceDescription(name) {
  const results = await Promise.allSettled(DICT_SOURCES.map(s => apiJSON(`/dictionaries/${s.id}?q=${encodeURIComponent(name)}`)));
  const hits = [];
  results.forEach((r, i) => {
    const entry = r.status === "fulfilled" && (r.value.data || [])[0];
    if (entry && entry.definition) hits.push({ source: DICT_SOURCES[i].name, definition: entry.definition });
  });
  if (!hits.length) return "";
  const rows = await Promise.all(hits.map(h => linkifyCitations(h.definition)));
  const tabBtns = hits.length > 1
    ? `<div class="dict-tab-btns">${hits.map((h, i) => `<button type="button" class="filter-chip dict-tab-btn${i === 0 ? " active" : ""}" data-idx="${i}">${escHtml(h.source)}</button>`).join("")}</div>`
    : "";
  const panels = rows.map((html, i) => `<div class="dict-tab-panel${i === 0 ? " active" : ""}" data-idx="${i}"><div class="char-def-src">${escHtml(hits[i].source)}</div><div class="char-def-text">${html}</div></div>`).join("");
  return `<div class="char-section dict-tabs"><div class="char-section-label">Description</div>${tabBtns}${panels}</div>`;
}
async function openAtlasPlace(id) {
  const backRow = `<div class="tool-back-row"><button onclick="renderExploreAtlas()">‹ Search Places</button></div>`;
  const body = document.getElementById("exploreBody");
  atlasListScrollTop = body.parentElement.scrollTop;
  body.innerHTML = backRow + `<div class="spin"></div>`;
  let p;
  try { p = await apiJSON(`/geo/places/${id}`); }
  catch (e) { body.innerHTML = backRow + `<div class="dd-empty">Could not load this place.</div>`; return; }
  const title = (p.preceding_article ? p.preceding_article + " " : "") + p.name;
  const meta = [p.place_type, p.modern_name ? `modern: ${p.modern_name}` : ""].filter(Boolean).join(" · ");
  const thumb = p.thumbnail ? `<img class="place-thumb" src="${escHtml(p.thumbnail.url)}" alt="${escHtml(p.name)}" onerror="this.remove()">` : "";
  const hasCoords = typeof p.lat === "number" && typeof p.lon === "number";
  const map = hasCoords ? placeMapPreviewHTML(p.lat, p.lon, title) : (p.special ? `<div class="dd-empty">${escHtml(p.special)}</div>` : "");
  const allVerses = p.verses || [];
  const verses = allVerses.slice(0, 40);
  const [previewByRef, descHtml] = await Promise.all([fetchVersePreviews(verses), fetchAtlasPlaceDescription(p.name)]);
  // With a description to flow in beside it, media floats narrow
  // (.atlas-media, css/styles.css) so the text wraps around it. A place with
  // no description at all (e.g. "the Sea of Egypt" — GeoPlace has no prose
  // field of its own, see NOTES.md, and no dictionary source had an entry
  // either) has nothing to wrap around it, so the thumb and map instead go
  // side by side full-width — .place-media-row, the same pattern the
  // chapter-scoped Places modal already uses (js/reader.js).
  const mediaHtml = !thumb && !map ? "" :
    descHtml ? `<div class="atlas-media">${thumb}${map}</div>` :
    (thumb && map) ? `<div class="place-media-row">${thumb}${map}</div>` : (thumb || map);
  const versesHtml = verses.length ? `<div class="char-section"><div class="char-section-label">Appears In${allVerses.length > verses.length ? ` (showing ${verses.length} of ${allVerses.length})` : ""}</div>${verses.map(v => {
    const text = previewByRef[`${v.book}.${v.chapter}.${v.verse}`];
    const refLabel = `${(bookList.find(b => b.usfm === v.book) || {}).name || v.book} ${v.chapter}:${v.verse}`;
    const citeAttr = text ? ` data-cite-id="${registerCiteId(refLabel, text)}"` : "";
    return `<button class="prophecy-ref" style="margin:0 6px 6px 0"${citeAttr} onclick="closeExplore();jumpToVerse('${v.book}',${v.chapter},${v.verse})">${escHtml(refLabel)}</button>`;
  }).join("")}</div>` : "";
  body.innerHTML = backRow +
    `<div class="place-head"><div class="place-name">${escHtml(title)}</div>${meta ? `<div class="place-meta">${escHtml(meta)}</div>` : ""}</div>
    <div class="atlas-body">${mediaHtml}${descHtml}</div>
    ${versesHtml}`;
}

/* ── Genealogy Explorer — GET /genealogies/{name} (parents/children,
   traversable by clicking a relative), GET /genealogies?from=&to= (BFS
   relationship path between two names). ── */
let genealogyBreadcrumb = [];
function renderExploreGenealogy() {
  genealogyBreadcrumb = [];
  document.getElementById("exploreBody").innerHTML = `
    <div class="msearch" style="margin-bottom:10px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg><input type="text" id="genealogySearchInput" placeholder="Look up a name, e.g. Isaac…" onkeydown="if(event.key==='Enter'){genealogyBreadcrumb=[];runGenealogyLookup(this.value)}" autocomplete="off"><button type="button" class="mclear" aria-label="Clear" onclick="clearSearchInput('genealogySearchInput')">&times;</button></div>
    <div class="tool-hint">Enter an exact name to see recorded parents/children — click a relative to keep exploring the family tree.</div>
    <div id="genealogyArea"></div>
    <div class="tool-group-label">Find a relationship</div>
    <div class="share-fields">
      <input type="text" id="genealogyFromInput" placeholder="From, e.g. Adam">
      <input type="text" id="genealogyToInput" placeholder="To, e.g. David">
      <button class="filter-chip" onclick="runGenealogyPath()">Find Path</button>
    </div>`;
}
async function runGenealogyLookup(name) {
  name = (name || "").trim();
  if (!name) return;
  const area = document.getElementById("genealogyArea");
  area.innerHTML = `<div class="spin"></div>`;
  let person;
  try { const d = await apiJSON(`/genealogies/${encodeURIComponent(name)}`); person = d.data; }
  catch (e) { area.innerHTML = `<div class="dd-empty">No genealogy record for "${escHtml(name)}".</div>`; return; }
  if (!genealogyBreadcrumb.length || genealogyBreadcrumb[genealogyBreadcrumb.length - 1] !== person.name) genealogyBreadcrumb.push(person.name);
  area.innerHTML = renderGenealogyPerson(person);
}
function renderGenealogyPerson(person) {
  const crumbs = genealogyBreadcrumb.length > 1
    ? `<div class="tool-filter-row">${genealogyBreadcrumb.map((n, i) => `<button class="filter-chip${i === genealogyBreadcrumb.length - 1 ? " active" : ""}" onclick="jumpGenealogyBreadcrumb(${i})">${escHtml(n)}</button>`).join("")}</div>`
    : "";
  const relRow = r => `<div class="char-relative"><span class="char-relative-rel">${escHtml(r.relationship)}</span><button class="prophecy-ref" onclick="runGenealogyLookup('${r.name.replace(/'/g, "\\'")}')">${escHtml(r.name)}</button></div>`;
  const parents = (person.parents || []).length ? `<div class="char-section"><div class="char-section-label">Parents</div>${person.parents.map(relRow).join("")}</div>` : `<div class="tool-hint">No recorded parents.</div>`;
  const children = (person.children || []).length ? `<div class="char-section"><div class="char-section-label">Children</div>${person.children.map(relRow).join("")}</div>` : `<div class="tool-hint">No recorded children.</div>`;
  return `${crumbs}<h3 style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1.35rem;margin:10px 0 14px">${escHtml(person.name)}</h3>${parents}${children}`;
}
function jumpGenealogyBreadcrumb(i) {
  const name = genealogyBreadcrumb[i];
  genealogyBreadcrumb = genealogyBreadcrumb.slice(0, i + 1);
  runGenealogyLookup(name);
}
async function runGenealogyPath() {
  const from = document.getElementById("genealogyFromInput").value.trim();
  const to = document.getElementById("genealogyToInput").value.trim();
  if (!from || !to) return;
  const area = document.getElementById("genealogyArea");
  area.innerHTML = `<div class="spin"></div>`;
  let path;
  try { const d = await apiJSON(`/genealogies?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`); path = d.path || []; }
  catch (e) { area.innerHTML = `<div class="dd-empty">No path found between "${escHtml(from)}" and "${escHtml(to)}".</div>`; return; }
  if (!path.length) { area.innerHTML = `<div class="dd-empty">No path found between "${escHtml(from)}" and "${escHtml(to)}".</div>`; return; }
  area.innerHTML = `<div class="char-section"><div class="char-section-label">${escHtml(from)} → ${escHtml(to)}</div>${path.map(step => `
    <div class="char-relative">
      ${step.relationship ? `<span class="char-relative-rel">${escHtml(step.relationship)}</span>` : ""}
      <button class="prophecy-ref" onclick="genealogyBreadcrumb=[];runGenealogyLookup('${step.name.replace(/'/g, "\\'")}')">${escHtml(step.name)}</button>
    </div>`).join("")}</div>`;
}

/* ── Collections — Parables/Miracles/Prayers share a structured references[]
   array (already-known refs, hover+jump via registerCiteId); Names of God/
   Titles of Jesus/Weights & Measures/Stories each have one free-text
   reference field instead, resolved lazily on hover (resolveTimelineRef,
   js/reader.js) rather than eagerly linkifying every item up front — with
   15-30 items per tab, an eager linkifyCitations() per item fires that many
   concurrent /parse/citations calls for no reason nobody's hovered yet. ── */
let collectionsTab = "parables";
const COLLECTIONS_META = {
  parables: { path: "/parables", label: "Parables" },
  miracles: { path: "/miracles", label: "Miracles" },
  prayers: { path: "/prayers", label: "Prayers" },
  namesofgod: { path: "/names-of-god", label: "Names of God" },
  titlesofjesus: { path: "/titles-of-jesus", label: "Titles of Jesus" },
  weightsmeasures: { path: "/reference/weights-measures", label: "Weights & Measures" },
  stories: { path: "/stories", label: "Stories" },
};
let collectionsCache = {};
async function getCollectionData(key) {
  if (!collectionsCache[key]) {
    // Stories are already fetched/cached by the inline chapter-heading
    // feature (getAllStories, js/reader.js) — reuse that instead of a
    // second GET /stories for the same data.
    if (key === "stories") { collectionsCache[key] = await getAllStories(); }
    else {
      try { const d = await apiJSON(COLLECTIONS_META[key].path); collectionsCache[key] = d.data || []; }
      catch (e) { collectionsCache[key] = []; }
    }
  }
  return collectionsCache[key];
}
function setCollectionsTab(k) { collectionsTab = k; renderExploreCollections(); }
async function renderExploreCollections() {
  const body = document.getElementById("exploreBody");
  body.innerHTML = `<div class="spin"></div>`;
  const chips = `<div class="tool-filter-row">${Object.entries(COLLECTIONS_META).map(([k, m]) => `<button class="filter-chip${collectionsTab === k ? " active" : ""}" onclick="setCollectionsTab('${k}')">${m.label}</button>`).join("")}</div>`;
  const data = await getCollectionData(collectionsTab);
  if (!data.length) { body.innerHTML = chips + `<div class="dd-empty">Nothing on file.</div>`; return; }

  if (["parables", "miracles", "prayers"].includes(collectionsTab)) {
    const allRefs = [];
    data.forEach(item => (item.references || []).forEach(r => allRefs.push(r)));
    const previewByRef = await fetchVersePreviews(allRefs);
    const entries = data.map(item => {
      const meta = [item.category, item.performed_by ? "by " + item.performed_by : "", item.pray_er ? "by " + item.pray_er : "", item.context].filter(Boolean);
      const refsHtml = (item.references || []).map(r => {
        const text = previewByRef[`${r.book}.${r.chapter}.${r.verse}`];
        const citeAttr = text ? ` data-cite-id="${registerCiteId(r.citation, text)}"` : "";
        return `<button class="prophecy-ref" style="margin:0 6px 6px 0"${citeAttr} onclick="closeExplore();jumpToVerse('${r.book}',${r.chapter},${r.verse})">${escHtml(r.citation)}</button>`;
      }).join("");
      return `<div class="prophecy-entry"><div class="place-name" style="margin-bottom:4px">${escHtml(item.title)}</div>${meta.length ? `<div class="place-meta" style="margin-bottom:8px">${escHtml(meta.join(" · "))}</div>` : ""}<div>${refsHtml}</div></div>`;
    }).join("");
    body.innerHTML = chips + entries;
    return;
  }

  const entries = data.map(item => {
    const name = item.name || item.title;
    const desc = item.meaning || item.description || item.summary || "";
    const metaBits = [item.testament, item.type, item.modern_equivalent, item.era].filter(Boolean);
    const refHtml = item.reference
      ? `<button class="prophecy-ref" data-ref="${escAttr(item.reference)}" onmouseenter="resolveTimelineRef(this, this.dataset.ref)" onclick="jumpFreeTextRef('${item.reference.replace(/'/g, "\\'")}',closeExplore)">${escHtml(item.reference)}</button>`
      : "";
    return `<div class="prophecy-entry">
      <div class="place-name" style="margin-bottom:4px">${escHtml(name)}</div>
      ${metaBits.length ? `<div class="place-meta" style="margin-bottom:6px">${escHtml(metaBits.join(" · "))}</div>` : ""}
      ${desc ? `<div class="prophecy-desc">${escHtml(desc)}</div>` : ""}
      ${refHtml ? `<div class="rc-entry">${refHtml}</div>` : ""}
    </div>`;
  });
  body.innerHTML = chips + entries.join("");
}

/* ── Extrabiblical works — GET /extrabiblical (list), GET /extrabiblical/{id}/meta
   (chapter list + verse counts), GET /extrabiblical/{id}/{chapter} (verse text).
   Standalone historical/apocryphal works (1 Enoch, Jubilees, ...) the API tracks as
   their own "versions" (type=extrabiblical) rather than books inside any Bible
   version's own catalog — a completely separate id space (extra_eng_1_enoch, not a
   USFM code), so this is its own list→work→chapter drill-down, not a Book Picker
   entry. Read straight through like the main Reader; deliberately skips the
   highlight/bookmark/note/dict-term machinery tied to the visitor's regular Bible
   version, since none of that applies to a text outside it. ── */
let extraWorksCache = null;
let extraWorkOpen = null; // {id,title} of the work currently drilled into — used by the chapter view's back button
async function getExtraWorks() {
  if (!extraWorksCache) {
    try { const d = await apiJSON("/extrabiblical"); extraWorksCache = d.data || []; }
    catch (e) { extraWorksCache = []; }
  }
  return extraWorksCache;
}
async function renderExploreExtrabiblical() {
  extraWorkOpen = null;
  const body = document.getElementById("exploreBody");
  body.innerHTML = `<div class="spin"></div>`;
  const works = await getExtraWorks();
  if (!works.length) { body.innerHTML = `<div class="dd-empty">No extrabiblical works on file.</div>`; return; }
  const rows = await Promise.all(works.map(async w => {
    // description is free-text prose from the API and can itself cite a verse
    // (e.g. "quoted in Jude 1:14-15") — linkifyCitations per CLAUDE.md's rule
    // for any embedded free-text citation, same as every other detail prose
    // field in this file (fetchAtlasPlaceDescription above, etc.).
    const desc = w.description ? await linkifyCitations(w.description) : "";
    const meta = [w.language_name, w.license].filter(Boolean).join(" · ");
    return `<div class="prophecy-entry">
      <button class="place-name" style="background:none;border:none;padding:0;text-align:left;cursor:pointer;display:block" onclick="openExtraWork('${w.version_id}','${(w.title || "").replace(/'/g, "\\'")}')">${escHtml(w.title)}</button>
      ${meta ? `<div class="place-meta" style="margin:4px 0">${escHtml(meta)}</div>` : ""}
      ${desc ? `<div class="prophecy-desc">${desc}</div>` : ""}
    </div>`;
  }));
  body.innerHTML = rows.join("");
}
async function openExtraWork(id, title) {
  extraWorkOpen = { id, title };
  const backRow = `<div class="tool-back-row"><button onclick="renderExploreExtrabiblical()">‹ All Works</button></div>`;
  const body = document.getElementById("exploreBody");
  body.innerHTML = backRow + `<div class="spin"></div>`;
  let chapters;
  try { const d = await apiJSON(`/extrabiblical/${id}/meta`); chapters = d.chapters || []; }
  catch (e) { body.innerHTML = backRow + `<div class="dd-empty">Could not load this work.</div>`; return; }
  const grid = chapters.map(c => `<button class="chapchip" onclick="openExtraChapter('${id}',${c.chapter})">${c.chapter}</button>`).join("");
  body.innerHTML = backRow +
    `<h3 style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1.35rem;margin-bottom:14px">${escHtml(title)}</h3>
    <div class="chipgrid">${grid || `<div class="dd-empty">No chapters on file.</div>`}</div>`;
}
async function openExtraChapter(id, chapter) {
  const workTitle = (extraWorkOpen && extraWorkOpen.title) || "";
  const backRow = `<div class="tool-back-row"><button onclick="openExtraWork('${id}','${workTitle.replace(/'/g, "\\'")}')">‹ ${escHtml(workTitle)}</button></div>`;
  const body = document.getElementById("exploreBody");
  body.innerHTML = backRow + `<div class="spin"></div>`;
  let verses;
  try { const d = await apiJSON(`/extrabiblical/${id}/${chapter}`); verses = d.data || []; }
  catch (e) { body.innerHTML = backRow + `<div class="dd-empty">Could not load this chapter.</div>`; return; }
  const versesHtml = verses.map(v => `<sup class="vnum">${v.verse}</sup>${escHtml(v.text)} `).join("");
  body.innerHTML = backRow +
    `<h3 style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1.35rem;margin-bottom:14px">${escHtml(workTitle)} ${chapter}</h3>
    <div class="dictbody"><div class="dd-def" style="line-height:1.9">${versesHtml || `<div class="dd-empty">No verses on file.</div>`}</div></div>`;
}
