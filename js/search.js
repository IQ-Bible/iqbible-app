/* ═══════════════════════════════════════════════════════════════════════
   SEARCH OVERLAY — full-text search within the current translation. */
let overlayCursor = null;
let overlaySearchMode = "all";
let overlayTypingTimer = null;
let overlayResultOffset = 0;
let overlayTotalCount = null;

function openSearch() {
  switchMainView("search");
  setTimeout(() => document.getElementById("overlaySearchInput").focus(), 80);
}
function closeSearch() {
  switchMainView("read");
}
function setMode(btn) {
  btn.closest(".overlay-filters").querySelectorAll("[data-mode]").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  overlaySearchMode = btn.dataset.mode;
}
function onOverlayType() {
  clearTimeout(overlayTypingTimer);
  const q = document.getElementById("overlaySearchInput").value.trim();
  if (q.length >= 3) { overlayTypingTimer = setTimeout(() => overlaySearch(true), 450); return; }
  // Below the 3-char search threshold (including cleared via the × button) —
  // wipe any results left over from a previous query rather than stranding them.
  document.getElementById("overlayResultList").innerHTML = "";
  document.getElementById("overlayResultsMeta").textContent = "";
  document.getElementById("overlayLoadMore").style.display = "none";
}
async function overlaySearch(reset = true) {
  if (!getApiKey()) { closeSearch(); showKeyBanner(); return; }
  let query = document.getElementById("overlaySearchInput").value.trim();
  if (!query) return;
  // match=all/phrase tells the API how to combine multiple words (AND vs.
  // exact sequence) — the server builds the actual boolean-mode MATCH()
  // expression itself, quoting for phrase mode included, so the query text
  // is sent as plain words either way.
  const matchParam = `&match=${overlaySearchMode}`;

  if (reset) {
    overlayCursor = null; overlayResultOffset = 0; overlayTotalCount = null;
    document.getElementById("overlayResultList").innerHTML = "";
    document.getElementById("overlayResultsMeta").textContent = "Searching…";
  }
  document.getElementById("overlayLoadMore").style.display = "none";

  if (reset) {
    try {
      const res = await apiFetch(`${API_BASE}/bibles/${current.version}/search/count?q=${encodeURIComponent(query)}${matchParam}`);
      const countData = await res.json();
      overlayTotalCount = countData.total_matches ?? null;
    } catch (e) { /* non-fatal */ }
  }

  let url = `${API_BASE}/bibles/${current.version}/search?q=${encodeURIComponent(query)}${matchParam}&limit=15`;
  if (overlayCursor) url += `&cursor=${overlayCursor}`;

  try {
    const res = await apiFetch(url);
    const data = await res.json();
    const results = data.data || [];

    const from = overlayResultOffset + 1;
    const to = overlayResultOffset + results.length;
    const total = overlayTotalCount != null ? overlayTotalCount : (data.results_count || "?");

    document.getElementById("overlayResultsMeta").textContent = results.length === 0
      ? "No results found"
      : `Showing ${from}–${to} of ${total} results in ${shortVersionLabel(current.versionTitle)}`;

    overlayResultOffset = to;

    const container = document.getElementById("overlayResultList");
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);

    results.forEach((r, i) => {
      const card = document.createElement("div");
      card.className = "result-card";
      card.style.animationDelay = `${Math.min(i * 25, 250)}ms`;
      const ref = `${r.book_usfm} ${r.chapter_number}:${r.verse_number}`;
      const highlighted = highlightWords(escHtml(r.text), words);
      card.innerHTML = `
        <div class="result-ref"><span class="result-num">${from + i}</span>${ref}</div>
        <div class="result-text">${highlighted}</div>`;
      card.onclick = () => { closeSearch(); jumpToVerse(r.book_usfm, r.chapter_number, r.verse_number); };
      container.appendChild(card);
    });

    overlayCursor = data.next_cursor || null;
    document.getElementById("overlayLoadMore").style.display = overlayCursor ? "block" : "none";
  } catch (e) {
    document.getElementById("overlayResultsMeta").textContent = "Search failed — please try again";
  }
}
function highlightWords(html, words) {
  words.forEach(w => {
    const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
    html = html.replace(re, '<mark>$1</mark>');
  });
  return html;
}
async function jumpToVerse(bookUsfm, chapter, verse, verseEnd) {
  const b = bookList.find(x => x.usfm === bookUsfm);
  current.book = bookUsfm;
  current.bookName = b ? b.name : bookUsfm;
  chapterMeta = [];
  await loadChapter(chapter, true, verse, verseEnd);
}
