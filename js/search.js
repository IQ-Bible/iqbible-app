/* ═══════════════════════════════════════════════════════════════════════
   SEARCH OVERLAY — full-text verse search (Verses tab) plus a disambiguated
   Bible-person index search (People tab), issue #290: MySQL FULLTEXT
   matching is case-insensitive with no proper-noun awareness, so a query
   like "lot" can never be told apart from "Lot" (the man) at the verse-
   search level — that's flagged in NOTES.md, not routed around. The People
   tab searches GET /bible-people instead, which is already correctly
   classified, and the Verses tab nudges toward it on an exact name match. */
let overlaySearchTab = "verses";      // "verses" | "people"
let overlayMatchMode = "all";         // all | any | phrase | prefix | boolean
let overlayTestament = "";            // "" | "ot" | "nt"
let overlaySelectedBooks = new Set(); // USFM codes; empty = no book restriction
let overlaySort = "canonical";        // canonical | relevance
let overlaySearchVersion = null;      // defaults to current.version on first open
let overlaySearchVersionTitle = null;
let overlayCursor = null;             // canonical-sort paging
let overlayOffset = 0;                // relevance-sort paging
let overlayResultOffset = 0;          // running count for the "Showing X–Y of Z" line
let overlayTotalCount = null;
let overlayTypingTimer = null;
let peopleListCache = null;           // GET /bible-people, fetched once (bulk, unpaginated by API design)
let _searchBookPickerList = [];       // books currently shown in the book-filter modal
// Bumped on every newly-initiated search (either tab); async callbacks
// (search itself, the person nudge, the no-results fallback) compare against
// it before touching the DOM, so a slow request that's since been superseded
// by a faster/newer one can't land its results on top of the current ones.
let _searchToken = 0;

function openSearch() {
  switchMainView("search");
  if (!overlaySearchVersion) { overlaySearchVersion = current.version; overlaySearchVersionTitle = current.versionTitle; }
  updateSearchVersionLabel();
  if (!document.getElementById("overlaySearchInput").value.trim()) renderSearchHistory();
  setTimeout(() => document.getElementById("overlaySearchInput").focus(), 80);
}
function closeSearch() {
  switchMainView("read");
}

/* ── tabs (Verses / People) ── */
function setSearchTab(tab) {
  overlaySearchTab = tab;
  document.querySelectorAll("#searchTabs .lib-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  const isPeople = tab === "people";
  document.getElementById("searchVersionRow").style.display = isPeople ? "none" : "";
  document.getElementById("searchModeRow").style.display = isPeople ? "none" : "";
  document.getElementById("searchFiltersToggleRow").style.display = isPeople ? "none" : "";
  document.getElementById("searchFiltersPanel").style.display = isPeople ? "none" : "";
  if (isPeople) document.getElementById("searchAdvHint").hidden = true;
  document.getElementById("overlaySearchInput").placeholder = isPeople ? "Search people by name…" : "What are you looking for?";
  document.getElementById("overlaySearchNotice").hidden = true;
  const q = document.getElementById("overlaySearchInput").value.trim();
  if (!q) {
    document.getElementById("overlayResultList").innerHTML = "";
    document.getElementById("overlayResultsMeta").textContent = "";
    document.getElementById("overlayLoadMore").style.display = "none";
    renderSearchHistory();
    return;
  }
  if (isPeople) overlayPeopleSearch(); else overlaySearch(true);
}

/* ── Verses tab: match mode / testament / sort chips ── */
function setMatchMode(btn) {
  btn.closest(".overlay-filters").querySelectorAll("[data-mode]").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  overlayMatchMode = btn.dataset.mode;
  const isBool = overlayMatchMode === "boolean";
  document.getElementById("searchAdvHint").hidden = !isBool;
  const excludeInput = document.getElementById("searchExcludeInput");
  excludeInput.disabled = isBool;
  excludeInput.placeholder = isBool ? "handled inline via -term" : "e.g. cast";
  overlaySearch(true);
}
function setTestament(btn) {
  btn.closest(".chip-row").querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  overlayTestament = btn.dataset.testament;
  if (overlayTestament && overlaySelectedBooks.size) { overlaySelectedBooks = new Set(); updateSearchBooksLabel(); }
  overlaySearch(true);
}
function setSearchSort(btn) {
  btn.closest(".chip-row").querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  overlaySort = btn.dataset.sort;
  overlaySearch(true);
}
function toggleSearchFilters() {
  document.getElementById("searchFiltersToggle").classList.toggle("expanded");
  document.getElementById("searchFiltersPanel").classList.toggle("open");
}
function onSearchFilterChange() {
  clearTimeout(overlayTypingTimer);
  overlayTypingTimer = setTimeout(() => overlaySearch(true), 450);
}

/* ── version selector ("Searching in") — reuses the existing version picker
   (js/catalog.js openVersionPicker/pickVersionRow, mode "search") rather than
   a second search/filter component. Independent of `current.version` (the
   reading position) until a result is actually opened. ── */
function setSearchVersion(id) {
  const v = (catalog || []).find(x => x.version_id === id);
  if (!v) return;
  overlaySearchVersion = id;
  overlaySearchVersionTitle = v.title || id;
  overlaySelectedBooks = new Set(); // a new version may have a different canon entirely
  updateSearchVersionLabel();
  updateSearchBooksLabel();
  overlaySearch(true);
}
function updateSearchVersionLabel() {
  const el = document.getElementById("searchVersionLabel");
  if (el) el.textContent = overlaySearchVersionTitle || current.versionTitle;
}

/* ── book-filter modal: multi-select, scoped to whichever version is being
   searched — GET /bibles/{version}/books, not a fixed 66-book list, since a
   Catholic/Orthodox canon is genuinely larger (Tobit, Judith, Wisdom, 1–2
   Maccabees, …). Mirrors js/catalog.js's bookGridSection markup/classes but
   toggles membership instead of swapping a single selection. ── */
async function openSearchBookPicker() {
  const version = overlaySearchVersion || current.version;
  document.getElementById("searchBookFilterNote").textContent = `Books shown for ${overlaySearchVersionTitle || current.versionTitle}.`;
  openModal("searchBookFilterScrim");
  document.getElementById("searchBookFilterBody").innerHTML = `<div class="spin"></div>`;
  try {
    const data = await apiJSONCached(`/bibles/${version}/books`);
    _searchBookPickerList = data.data || [];
  } catch (e) { _searchBookPickerList = []; }
  renderSearchBookGrid();
}
function renderSearchBookGrid() {
  const nt = _searchBookPickerList.filter(b => NT_USFM.has(b.usfm));
  const ot = _searchBookPickerList.filter(b => !NT_USFM.has(b.usfm));
  const section = (label, list) => {
    if (!list.length) return "";
    const cols = Math.max(1, Math.ceil(list.length / 4));
    const chips = list.map(b => {
      const on = overlaySelectedBooks.has(b.usfm);
      const label2 = bookAbbrev[b.usfm] || b.name;
      return `<button class="bookchip ${on ? "on" : ""}" title="${escHtml(b.name)}" onclick="toggleSearchBook('${b.usfm}')">${escHtml(label2)}</button>`;
    }).join("");
    return `<div class="glabel">${label}</div><div class="bookgrid" style="grid-template-columns:repeat(${cols},1fr)">${chips}</div>`;
  };
  document.getElementById("searchBookFilterBody").innerHTML = (section("Old Testament", ot) + section("New Testament", nt))
    || `<div class="emptynote" style="padding:24px">No books found for this version.</div>`;
}
function toggleSearchBook(usfm) {
  if (overlaySelectedBooks.has(usfm)) overlaySelectedBooks.delete(usfm); else overlaySelectedBooks.add(usfm);
  renderSearchBookGrid();
}
function searchBooksSelectAll() { overlaySelectedBooks = new Set(_searchBookPickerList.map(b => b.usfm)); renderSearchBookGrid(); }
function searchBooksClearAll() { overlaySelectedBooks = new Set(); renderSearchBookGrid(); }
function closeSearchBookPicker() {
  closeModal("searchBookFilterScrim");
  if (overlaySelectedBooks.size && overlayTestament) {
    overlayTestament = "";
    document.querySelectorAll("#searchTestamentRow .filter-chip").forEach(b => b.classList.toggle("active", b.dataset.testament === ""));
  }
  updateSearchBooksLabel();
  overlaySearch(true);
}
function updateSearchBooksLabel() {
  const el = document.getElementById("searchBooksLabel");
  const n = overlaySelectedBooks.size;
  el.textContent = n === 0 ? "All books" : `${n} selected`;
}

/* ── typing in the main input ── */
function onOverlayType() {
  clearTimeout(overlayTypingTimer);
  const q = document.getElementById("overlaySearchInput").value.trim();
  if (!q) {
    document.getElementById("overlayResultList").innerHTML = "";
    document.getElementById("overlayResultsMeta").textContent = "";
    document.getElementById("overlayLoadMore").style.display = "none";
    document.getElementById("overlaySearchNotice").hidden = true;
    renderSearchHistory();
    return;
  }
  if (overlaySearchTab === "people") { overlayTypingTimer = setTimeout(() => overlayPeopleSearch(), 150); return; }
  // Below the 3-char search threshold, the FULLTEXT index can't match
  // anything yet regardless of mode (min token size) — wait for it rather
  // than firing a query guaranteed to come back empty.
  if (q.length >= 3) { overlayTypingTimer = setTimeout(() => overlaySearch(true), 450); return; }
  document.getElementById("overlayResultList").innerHTML = "";
  document.getElementById("overlayResultsMeta").textContent = "";
  document.getElementById("overlayLoadMore").style.display = "none";
}

// Shared by the main search and the no-results fallback below — the fallback
// has to check other versions under the *same* scope (testament/book/chapter/
// verse/exclude), or it can report a false "found in 4 other versions" for a
// phrase that only exists outside the current filter in every version, not
// just this one (e.g. an NT-only phrase with Testament set to OT).
function buildSearchScopeParams(mode) {
  const p = new URLSearchParams();
  if (mode !== "boolean") {
    const exclude = document.getElementById("searchExcludeInput").value.trim();
    if (exclude) p.set("exclude", exclude);
  }
  if (overlaySelectedBooks.size) p.set("book", Array.from(overlaySelectedBooks).join(","));
  else if (overlayTestament) p.set("testament", overlayTestament);
  const chapter = document.getElementById("searchChapterInput").value.trim();
  if (chapter) p.set("chapter", chapter);
  const verse = document.getElementById("searchVerseInput").value.trim();
  if (verse) p.set("verse", verse);
  return p;
}

/* ── Verses tab search ── */
async function overlaySearch(reset = true) {
  hideSearchHistory();
  // Hosted instance proxies a key server-side, so "no key set" is fine there.
  if (!IS_HOSTED_INSTANCE && !getApiKey()) { closeSearch(); showKeyBanner(); return; }
  const query = document.getElementById("overlaySearchInput").value.trim();
  if (!query) { renderSearchHistory(); return; }
  const version = overlaySearchVersion || current.version;
  const mode = overlayMatchMode;
  if (reset) _searchToken++;
  const token = _searchToken;

  const params = buildSearchScopeParams(mode);
  params.set("q", query);
  params.set("match", mode);
  params.set("sort", overlaySort);
  params.set("highlight", "1");
  params.set("limit", "15");

  if (reset) {
    overlayCursor = null; overlayOffset = 0; overlayResultOffset = 0; overlayTotalCount = null;
    document.getElementById("overlayResultList").innerHTML = "";
    document.getElementById("overlayResultsMeta").textContent = "Searching…";
    document.getElementById("overlaySearchNotice").hidden = true;
    params.set("count", "1"); // folded into this same request — see below, the filters (book/
                               // testament/chapter/verse) only apply correctly to the total this
                               // way, since GET /search/count doesn't accept those params at all
    saveSearchHistory(query, mode, "verses");
  } else {
    if (overlaySort === "relevance") params.set("offset", overlayOffset);
    else if (overlayCursor) params.set("cursor", overlayCursor);
  }
  document.getElementById("overlayLoadMore").style.display = "none";

  try {
    const res = await apiFetch(`${API_BASE}/bibles/${version}/search?${params.toString()}`);
    const data = await res.json();
    if (token !== _searchToken) return; // a newer search has already superseded this response
    if (reset && data.total_matches != null) overlayTotalCount = data.total_matches;
    const results = data.data || [];

    // The full-text index silently ignores stop-words ("are", "the", "of")
    // and terms under 3 characters — surface it rather than letting a
    // phrase search quietly match on only some of the typed words.
    const notice = document.getElementById("overlaySearchNotice");
    if (reset && data.notice) { notice.textContent = data.notice; notice.hidden = false; }
    else if (reset) notice.hidden = true;

    const from = overlayResultOffset + 1;
    const to = overlayResultOffset + results.length;
    const total = overlayTotalCount != null ? overlayTotalCount : (data.results_count || "?");

    document.getElementById("overlayResultsMeta").textContent = results.length === 0
      ? `No results for "${query}" in ${overlaySearchVersionTitle || current.versionTitle}`
      : `Showing ${from}–${to} of ${total} results in ${shortVersionLabel(overlaySearchVersionTitle || current.versionTitle)}`;

    overlayResultOffset = to;

    const container = document.getElementById("overlayResultList");
    results.forEach((r, i) => {
      const card = document.createElement("div");
      card.className = "result-card";
      card.style.animationDelay = `${Math.min(i * 25, 250)}ms`;
      const ref = `${r.book_usfm} ${r.chapter_number}:${r.verse_number}`;
      const text = r.highlight || escHtml(r.text);
      card.innerHTML = `
        <div class="result-ref"><span class="result-num">${from + i}</span>${ref}</div>
        <div class="result-text">${text}</div>`;
      card.onclick = () => openSearchResult(r.book_usfm, r.chapter_number, r.verse_number, version);
      container.appendChild(card);
    });

    if (overlaySort === "relevance") {
      overlayOffset = data.next_offset != null ? data.next_offset : overlayOffset;
      document.getElementById("overlayLoadMore").style.display = data.next_offset != null ? "block" : "none";
    } else {
      overlayCursor = data.next_cursor || null;
      document.getElementById("overlayLoadMore").style.display = overlayCursor ? "block" : "none";
    }

    if (reset && results.length === 0) showNoResultsFallback(query, mode, version, token);
    if (reset && results.length > 0) checkPersonNudge(query, token);
  } catch (e) {
    document.getElementById("overlayResultsMeta").textContent = "Search failed — please try again";
  }
}

// A search result's text belongs specifically to `version` — jumpToVerse's
// normal "can the current reading version show this reference at all" check
// is the right call for a citation link (any version containing the passage
// is fine), but not here: a book both versions share (Nehemiah is in both
// KJV and Translation for Translators, say) would pass that check and just
// navigate within the current version, silently landing on a verse that may
// not even contain the searched text. Always offer the switch when the
// result's version differs from the current one, regardless of whether the
// current version also happens to have that reference.
async function openSearchResult(bookUsfm, chapter, verse, version) {
  closeSearch();
  if (version === current.version) {
    await jumpToVerse(bookUsfm, chapter, verse);
    return;
  }
  const v = (catalog || []).find(x => x.version_id === version);
  const versionLabel = v ? (v.title || version) : version;
  const name = bookNameByUsfm[bookUsfm] || bookUsfm;
  const refLabel = `${name} ${chapter}:${verse}`;
  const ok = await uiConfirm({
    title: `Switch to ${versionLabel}?`,
    message: `This result is from ${versionLabel}. Switch to it and go to ${refLabel}?`,
    okLabel: "Switch & read", cancelLabel: "Cancel",
  });
  if (ok) await switchVersionAndJump(version, bookUsfm, chapter, verse);
}

/* ── "Did you mean a person?" nudge — cross-links to the People tab on an
   exact name match rather than filtering/hiding the noun-sense verse
   results (no denylist; see NOTES.md's case-sensitivity entry for why this
   can't be resolved inside verse search itself). ── */
async function checkPersonNudge(query, token) {
  if (overlaySearchTab !== "verses") return;
  try {
    const people = await getPeopleList();
    if (token !== _searchToken) return;
    const hit = people.find(p => p.name.toLowerCase() === query.toLowerCase());
    if (!hit) return;
    const container = document.getElementById("overlayResultList");
    if (container.querySelector(".nudge-banner")) return;
    const banner = document.createElement("div");
    banner.className = "nudge-banner";
    banner.innerHTML = `<span>Looking for a person, not a word? → <b>${escHtml(hit.name)}</b></span><button class="nudge-go">Open in People</button>`;
    banner.querySelector(".nudge-go").onclick = () => {
      document.getElementById("overlaySearchInput").value = hit.name;
      setSearchTab("people");
    };
    container.insertBefore(banner, container.firstChild);
  } catch (e) { /* non-fatal */ }
}

/* ── no-results fallback: an opt-in "Search all N other-language versions"
   button, not an automatic fan-out — checking every version on a free-tier
   key for what's often just a typo would burn quota with no ask. No curated
   shortlist (deliberately dropped — deciding which handful of ~60 English
   editions count as "common enough" is an arbitrary editorial call, and it
   already proved wrong: it missed CPDV/eng_kjv1611, which is exactly where a
   Deuterocanon name or an archaic spelling actually lives). Offers every
   other version sharing the searched version's language instead, run at a
   capped concurrency so a big language (English: ~60) doesn't fire 60
   requests at once, with a live progress line and honest reporting if the
   API starts rate-limiting partway through — silently under-reporting hits
   because of a 429 would be worse than not offering this at all. */
async function showNoResultsFallback(query, mode, version, token) {
  if (!FEATURE_SEARCH_ALL_VERSIONS) return;
  await loadCatalog();
  if (token !== _searchToken) return;
  const searched = (catalog || []).find(v => v.version_id === version);
  const lang = searched && searched.language_name;
  const candidates = (catalog || [])
    .filter(v => v.version_id !== version && v.language_name === lang)
    .map(v => v.version_id);
  if (!candidates.length) return;

  const container = document.getElementById("overlayResultList");
  const banner = document.createElement("div");
  banner.className = "miss-banner";
  banner.innerHTML = `
    <div class="mb-icon">⌕</div>
    <button class="miss-go">Search all ${candidates.length} other ${escHtml(lang || "")} version${candidates.length === 1 ? "" : "s"}</button>
    <div class="fallback-progress" id="fallbackProgress" hidden></div>
    <div class="fallback-results" id="fallbackResultsArea"></div>`;
  banner.querySelector(".miss-go").onclick = (e) => runFallbackVersionSearch(query, mode, candidates, e.target);
  container.appendChild(banner);
}
const FALLBACK_CONCURRENCY = 8;
async function runFallbackVersionSearch(query, mode, candidates, btn) {
  btn.disabled = true; btn.textContent = "Searching…";
  const area = document.getElementById("fallbackResultsArea");
  const progress = document.getElementById("fallbackProgress");
  progress.hidden = false;
  const scopeParams = buildSearchScopeParams(mode); // same testament/book/chapter/verse/exclude as the search that just missed
  const hits = [];
  const queue = candidates.slice();
  const total = candidates.length;
  let checked = 0;
  let rateLimited = false;

  async function worker() {
    while (queue.length && !rateLimited) {
      const id = queue.shift();
      try {
        const p = new URLSearchParams(scopeParams);
        p.set("q", query); p.set("match", mode); p.set("count", "1"); p.set("limit", "1");
        const res = await apiFetch(`${API_BASE}/bibles/${id}/search?${p.toString()}`);
        if (res.status === 429) { rateLimited = true; break; }
        const data = await res.json();
        if (data.total_matches) {
          const v = (catalog || []).find(x => x.version_id === id);
          hits.push({ id, title: (v && v.title) || id, count: data.total_matches });
        }
      } catch (e) { /* one version failing shouldn't stop the rest */ }
      checked++;
      progress.textContent = `Checked ${checked} of ${total}…`;
    }
  }
  await Promise.all(Array.from({ length: Math.min(FALLBACK_CONCURRENCY, total) }, worker));

  btn.style.display = "none";
  progress.hidden = true;
  hits.sort((a, b) => b.count - a.count);
  const rows = hits.map(h => `
      <div class="fallback-row" onclick="setSearchVersion('${h.id}')">
        <span class="fv-name">${escHtml(h.title)}</span>
        <span class="fv-count">${h.count} result${h.count > 1 ? "s" : ""}</span>
      </div>`).join("");
  if (rateLimited) {
    area.innerHTML = `<div class="fallback-lede">Stopped after checking ${checked} of ${total} — the API started rate-limiting this key. ${hits.length ? "Showing what was found so far:" : "Try again in a moment."}</div>` + rows;
  } else if (!hits.length) {
    area.innerHTML = `<div class="fallback-lede">Not found in any of the ${total} other version${total > 1 ? "s" : ""} checked.</div>`;
  } else {
    area.innerHTML = `<div class="fallback-lede">Found in ${hits.length} other version${hits.length > 1 ? "s" : ""}:</div>` + rows;
  }
}

/* ── People tab: searches the API's own disambiguated Bible-person index
   (GET /bible-people, ~3,000 rows, unpaginated by the API's own design —
   same precedent GET /topics already set) instead of verse text. Mirrors
   js/explore.js's getTopicsList()/renderTopicsListArea() pattern exactly. ── */
async function getPeopleList() {
  if (!peopleListCache) {
    try { const d = await apiJSONCached("/bible-people"); peopleListCache = d.data || []; }
    catch (e) { peopleListCache = []; }
  }
  return peopleListCache;
}
async function overlayPeopleSearch() {
  const raw = document.getElementById("overlaySearchInput").value.trim();
  const q = raw.toLowerCase();
  const meta = document.getElementById("overlayResultsMeta");
  const container = document.getElementById("overlayResultList");
  document.getElementById("overlayLoadMore").style.display = "none";
  document.getElementById("overlaySearchNotice").hidden = true;
  if (!q) { renderSearchHistory(); meta.textContent = ""; container.innerHTML = ""; return; }
  hideSearchHistory();
  _searchToken++;
  const token = _searchToken;
  const people = await getPeopleList();
  if (token !== _searchToken) return; // a newer keystroke already superseded this
  const filtered = people.filter(p => p.name.toLowerCase().includes(q)).slice(0, 100);
  meta.textContent = filtered.length
    ? `${filtered.length} ${filtered.length === 1 ? "person" : "people"} matching "${escHtml(raw)}"`
    : "No results found";
  container.innerHTML = filtered.map(p => `
    <div class="vrow" onclick="openPersonDetailFromSearch('${p.name.replace(/'/g, "\\'")}'${p.ustrong ? `, '${p.ustrong}'` : ""})">
      <div class="person-avatar">${escHtml((p.name || "?")[0].toUpperCase())}</div>
      <div class="person-main"><div class="vt">${escHtml(p.name)}</div><div class="vd">${escHtml(p.gender || "")}</div></div>
      <span class="person-row-arrow">›</span>
    </div>`).join("");
  saveSearchHistory(raw, null, "people");
}
function openPersonDetailFromSearch(name, ustrong) {
  closeSearch();
  document.getElementById("peopleBackBtn").style.display = "none";
  openModal("peopleScrim");
  openPersonDetail(name, ustrong);
}

/* ── search history: Saved (starred, pinned indefinitely) + Recent (ages
   out, individually removable) — pure client-side (localStorage), no API
   involved. One chip component with a star toggle, not two features. ── */
const LS_SEARCH_RECENT = "iqb_search_recent";
const LS_SEARCH_SAVED = "iqb_search_saved";
const SEARCH_HISTORY_MAX = 12;
function loadSearchList(key) { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { return []; } }
function saveSearchListRaw(key, list) { localStorage.setItem(key, JSON.stringify(list)); }
function sameEntry(a, query, tab) { return a.tab === tab && a.query.toLowerCase() === query.toLowerCase(); }

// Search-as-you-type fires this on every debounced keystroke, not just a
// deliberate submit — without coalescing, typing "l" → "lo" → "lot" would
// leave three near-duplicate entries. Within a short window, refining the
// same tab's query replaces the most recent entry instead of adding a new
// one; pausing longer (or switching tabs) starts a fresh entry.
const HISTORY_COALESCE_MS = 4000;
let _lastHistorySave = { tab: null, at: 0 };
function saveSearchHistory(query, mode, tab) {
  if (!query) return;
  if (loadSearchList(LS_SEARCH_SAVED).some(e => sameEntry(e, query, tab))) return; // already pinned — don't also clutter recent
  let recent = loadSearchList(LS_SEARCH_RECENT).filter(e => !sameEntry(e, query, tab));
  const coalesce = _lastHistorySave.tab === tab && (Date.now() - _lastHistorySave.at) < HISTORY_COALESCE_MS && recent[0] && recent[0].tab === tab;
  if (coalesce) recent[0] = { query, mode, tab };
  else recent.unshift({ query, mode, tab });
  _lastHistorySave = { tab, at: Date.now() };
  saveSearchListRaw(LS_SEARCH_RECENT, recent.slice(0, SEARCH_HISTORY_MAX));
}
function toggleSaveSearch(query, tab) {
  let saved = loadSearchList(LS_SEARCH_SAVED);
  if (saved.some(e => sameEntry(e, query, tab))) {
    saveSearchListRaw(LS_SEARCH_SAVED, saved.filter(e => !sameEntry(e, query, tab)));
  } else {
    const recent = loadSearchList(LS_SEARCH_RECENT);
    const entry = recent.find(e => sameEntry(e, query, tab)) || { query, mode: overlayMatchMode, tab };
    saved.unshift(entry);
    saveSearchListRaw(LS_SEARCH_SAVED, saved);
    saveSearchListRaw(LS_SEARCH_RECENT, recent.filter(e => !sameEntry(e, query, tab)));
  }
  renderSearchHistory();
}
function clearRecentSearches() { saveSearchListRaw(LS_SEARCH_RECENT, []); renderSearchHistory(); }
function renderSearchHistory() {
  const area = document.getElementById("overlayHistoryArea");
  if (!area) return;
  const tab = overlaySearchTab;
  const saved = loadSearchList(LS_SEARCH_SAVED).filter(e => e.tab === tab);
  const recent = loadSearchList(LS_SEARCH_RECENT).filter(e => e.tab === tab);
  if (!saved.length && !recent.length) { area.hidden = true; area.innerHTML = ""; return; }
  area.hidden = false;
  const chip = (e, isSaved) => {
    const jsQuery = escAttr(e.query).replace(/'/g, "\\'");
    return `<button class="history-chip${isSaved ? " saved" : ""}" onclick="rerunSearchHistory('${jsQuery}','${e.tab}')">${escHtml(e.query)}<span class="history-star" onclick="event.stopPropagation(); toggleSaveSearch('${jsQuery}','${e.tab}')">${isSaved ? "★" : "☆"}</span></button>`;
  };
  let html = "";
  if (saved.length) html += `<div class="history-section"><div class="history-section-label">Saved</div><div class="history-row">${saved.map(e => chip(e, true)).join("")}</div></div>`;
  if (recent.length) html += `<div class="history-section"><div class="history-section-label">Recent</div><div class="history-row">${recent.map(e => chip(e, false)).join("")}<button class="history-clear" onclick="clearRecentSearches()">Clear recent</button></div></div>`;
  area.innerHTML = html;
}
function hideSearchHistory() {
  const area = document.getElementById("overlayHistoryArea");
  if (area) { area.hidden = true; area.innerHTML = ""; }
}
function rerunSearchHistory(query, tab) {
  document.getElementById("overlaySearchInput").value = query;
  setSearchTab(tab);
}

async function jumpToVerse(bookUsfm, chapter, verse, verseEnd, opts) {
  // A reference can point somewhere the current translation can't show — a
  // book outside its canon (1 Maccabees, Wisdom under a 66-book version), or
  // a chapter/verse beyond its range (Catholic Daniel 13/14, the Daniel 3
  // additions). Hand off to the switch/picker prompt instead of navigating
  // into a "book_not_found" error or a silently empty chapter.
  // opts.preferVersion (a note anchor's captured version, or the version a
  // search result actually came from) lets it offer a one-tap switch to the
  // exact translation the reference came from.
  if (!(await versionCanShowRef(bookUsfm, chapter, verse))) {
    return handleRefNotInVersion(bookUsfm, chapter, verse, verseEnd, opts && opts.preferVersion);
  }
  // Landing on a verse always means "show it in the reader" — if a menu view
  // (Study Tools, My Library, …) is covering it, surface the reading view
  // first so the chapter renders (and its nav buttons get positioned) into a
  // visible layout, not a display:none one.
  const rvg = document.getElementById("readViewGroup");
  if (rvg && rvg.style.display === "none" && typeof switchMainView === "function") switchMainView("read");
  const b = bookList.find(x => x.usfm === bookUsfm);
  current.book = bookUsfm;
  current.bookName = b ? b.name : bookUsfm;
  chapterMeta = [];
  await loadChapter(chapter, true, verse, verseEnd);
}
