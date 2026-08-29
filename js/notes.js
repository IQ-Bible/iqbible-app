/* ═══════════════════════════════════════════════════════════════════════
   MY LIBRARY — Notes / Bookmarks / Highlights / History, four tabs sharing
   one overlay shell (same `#xOverlay` + `.open` pattern as the search
   overlay, search.js). Notes are still authored/edited from the Verse
   Tools panel in reader.js; this overlay is for finding, filtering,
   exporting and jumping to whatever's been saved, across the whole Bible,
   not just the current chapter. */
let libraryActiveTab = localStorage.getItem("iqb_library_tab") || "notes";
let librarySortMode = localStorage.getItem("iqb_library_sort") || "book";
let libraryColorFilter = null;
let notesActiveTag = null;
let notesSearchTimer = null;
let renderedHistoryEntries = [];

function openLibrary() {
  switchMainView("library");
  document.getElementById("librarySearchInput").value = "";
  closeNoteComposer();
  switchLibraryTab(libraryActiveTab);
  // Skip the autofocus while the tour is driving this overlay — it's just
  // pointing at each tab in turn, and focusing the search input pops the
  // mobile keyboard up over the tour tooltip for no reason.
  if (!tourActive) setTimeout(() => document.getElementById("librarySearchInput").focus(), 80);
}
function closeLibrary() {
  switchMainView("read");
  closeNoteComposer();
}
const LIBRARY_TAB_DESC = {
  notes: "Your own notes — tied to a verse or free-standing, searchable and taggable. Stored on this device; export to back them up.",
  bookmarks: "Verses you've bookmarked, sorted in Bible order or by when you added them.",
  highlights: "Every verse you've highlighted, filterable by color.",
  history: "Chapters you've opened recently, most recent first.",
};
function switchLibraryTab(tab) {
  libraryActiveTab = tab;
  localStorage.setItem("iqb_library_tab", tab);
  document.querySelectorAll(".lib-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.getElementById("libraryDesc").textContent = LIBRARY_TAB_DESC[tab] || "";
  document.getElementById("notesTagChips").style.display = tab === "notes" ? "" : "none";
  document.getElementById("notesToolbar").style.display = tab === "notes" ? "" : "none";
  if (tab !== "notes") closeNoteComposer();
  document.getElementById("bookmarksToolbar").style.display = tab === "bookmarks" ? "" : "none";
  document.getElementById("highlightsToolbar").style.display = tab === "highlights" ? "" : "none";
  document.getElementById("libraryClearHistory").style.display = tab === "history" ? "" : "none";
  document.getElementById("librarySearchInput").placeholder = { notes: "Search your notes…", bookmarks: "Search your bookmarks…", highlights: "Search your highlights…", history: "Search your history…" }[tab];
  document.getElementById("librarySortColorChip").style.display = tab === "highlights" ? "inline-flex" : "none";
  if (tab !== "highlights") { libraryColorFilter = null; if (librarySortMode === "color") setLibrarySort("book"); }
  renderLibraryList();
}
// "By Color" (Highlights tab only — the swatches stay hidden elsewhere) is
// driven by libraryColorFilter: picking one of the 4 swatches filters the
// list down to just that color. HIGHLIGHT_COLOR_ORDER only still matters for
// the sort comparator's tie-break, in the same fixed order Verse Tools lists
// the swatches, then canonical Bible order within a color.
const HIGHLIGHT_COLOR_ORDER = ["yellow", "green", "blue", "pink"];
function setLibrarySort(mode) {
  librarySortMode = mode;
  if (mode !== "color") libraryColorFilter = null;
  localStorage.setItem("iqb_library_sort", mode);
  document.getElementById("librarySortBookChip").classList.toggle("active", mode === "book");
  document.getElementById("librarySortDateChip").classList.toggle("active", mode === "date");
  document.querySelectorAll("#librarySortColorChip .vtswatch").forEach(b => b.classList.toggle("on", mode === "color" && b.dataset.color === libraryColorFilter));
  renderLibraryList();
}
// Each of the 4 swatches filters the Highlights list down to just that color
// (not merely groups it) — clicking the active one again clears the filter.
function setLibraryColorFilter(color) {
  if (librarySortMode === "color" && libraryColorFilter === color) { setLibrarySort("book"); return; }
  libraryColorFilter = color;
  setLibrarySort("color");
}
function onLibrarySearchType() {
  clearTimeout(notesSearchTimer);
  notesSearchTimer = setTimeout(renderLibraryList, 200);
}
function renderLibraryList() {
  document.getElementById("librarySortBookChip").classList.toggle("active", librarySortMode === "book");
  document.getElementById("librarySortDateChip").classList.toggle("active", librarySortMode === "date");
  document.querySelectorAll("#librarySortColorChip .vtswatch").forEach(b => b.classList.toggle("on", librarySortMode === "color" && b.dataset.color === libraryColorFilter));
  if (libraryActiveTab === "bookmarks") return renderBookmarksList();
  if (libraryActiveTab === "highlights") return renderHighlightsList();
  if (libraryActiveTab === "history") return renderHistoryList();
  return renderNotesList();
}
function notesBookName(usfm) {
  if (!usfm) return "General";
  const b = bookList.find(x => x.usfm === usfm);
  return b ? b.name : usfm;
}
// A general note (item 3 — not tied to any verse) has no book/chapter/verses
// to build a reference from, so it's identified by its own title instead.
function noteRefLabel(note) {
  if (!note.book) return note.title || "General Note";
  return `${notesBookName(note.book)} ${note.chapter}:${compressVerseRanges(note.verses)}`;
}
// General notes (no book) always sort after every verse-tied note in "By
// Book" mode — there's no canonical position for them among the books.
function canonicalOrderCompare(a, b) {
  if (!a.book || !b.book) return (!a.book ? 1 : 0) - (!b.book ? 1 : 0);
  const bi = bookList.findIndex(x => x.usfm === a.book) - bookList.findIndex(x => x.usfm === b.book);
  if (bi) return bi;
  return a.chapter - b.chapter;
}
// "By Book" is canonical Bible order (then chapter/verse) — how a student
// browses. "By Date" is most-recent-first off whichever timestamp field
// this tab's entries carry. Shared by all four tabs so the toggle behaves
// identically everywhere instead of each tab picking its own meaning.
function librarySort(entries, dateField, verseField) {
  if (librarySortMode === "date") return [...entries].sort((a, b) => (b[dateField] || 0) - (a[dateField] || 0));
  if (librarySortMode === "color") {
    const filtered = libraryColorFilter ? entries.filter(e => e.color === libraryColorFilter) : entries;
    return [...filtered].sort((a, b) =>
      (HIGHLIGHT_COLOR_ORDER.indexOf(a.color) - HIGHLIGHT_COLOR_ORDER.indexOf(b.color))
      || canonicalOrderCompare(a, b) || (verseField ? a[verseField] - b[verseField] : 0));
  }
  return [...entries].sort((a, b) => canonicalOrderCompare(a, b) || (verseField ? a[verseField] - b[verseField] : 0));
}
function fmtDate(ms) { return ms ? new Date(ms).toLocaleString() : ""; }

/* ── Notes tab ── */
async function renderNotesList() {
  const list = document.getElementById("libraryResultList");
  const all = getNotes();
  const q = document.getElementById("librarySearchInput").value.trim().toLowerCase();

  renderNotesTagChips(all);

  let matches = all.filter(n => {
    if (notesActiveTag && !n.tags.includes(notesActiveTag)) return false;
    if (!q) return true;
    return n.text.toLowerCase().includes(q) || noteRefLabel(n).toLowerCase().includes(q) || n.tags.some(t => t.includes(q));
  });

  if (!all.length) {
    list.innerHTML = `<div class="emptynote">No notes yet — select a verse (or a range) and use Note in Verse Tools, or start a standalone one with + New Note above.</div>`;
    return;
  }
  if (!matches.length) {
    list.innerHTML = `<div class="emptynote">No notes match.</div>`;
    return;
  }

  matches = librarySort(matches.map(n => ({ ...n, __v0: n.verses[0] })), "updatedAt", "__v0");

  const htmlParts = await Promise.all(matches.map(async (n, i) => {
    const textHtml = await renderNoteMarkdown(n.text);
    const tagsHtml = n.tags.map(t => `<span class="note-tag-chip">${escHtml(t)}</span>`).join("");
    const meta = [n.versionTitle ? `Written in ${shortVersionLabel(n.versionTitle)}` : "", fmtDate(n.updatedAt)].filter(Boolean).join(" · ");
    return `
      <div class="result-card note-card" style="animation-delay:${Math.min(i * 25, 250)}ms" data-note-id="${n.id}">
        <div class="result-ref">${escHtml(noteRefLabel(n))}</div>
        <div class="result-text note-md">${textHtml}</div>
        ${meta ? `<div class="result-meta">${escHtml(meta)}</div>` : ""}
        ${tagsHtml ? `<div class="note-card-tags">${tagsHtml}</div>` : ""}
        <div class="note-card-actions">
          <button data-action="edit">Edit</button>
          <button data-action="delete" class="danger">Delete</button>
        </div>
      </div>`;
  }));
  list.innerHTML = htmlParts.join("");
}
function renderNotesTagChips(all) {
  const row = document.getElementById("notesTagChips");
  const tags = [...new Set(all.flatMap(n => n.tags))].sort();
  if (!tags.length) { row.innerHTML = ""; return; }
  row.innerHTML = `<span class="filter-label">Tags:</span>
    <button class="filter-chip${notesActiveTag ? "" : " active"}" data-tag="">All</button>
    ${tags.map(t => `<button class="filter-chip${notesActiveTag === t ? " active" : ""}" data-tag="${escAttr(t)}">${escHtml(t)}</button>`).join("")}`;
}
document.getElementById("notesTagChips") && document.getElementById("notesTagChips").addEventListener("click", e => {
  const chip = e.target.closest("[data-tag]");
  if (!chip) return;
  notesActiveTag = chip.dataset.tag || null;
  renderNotesList();
});
async function editNoteFromBrowser(note) {
  if (!note.book) { openNoteComposer(note); return; }
  closeLibrary();
  await jumpToVerse(note.book, note.chapter, note.verses[0]);
  selectedVerses = [...note.verses];
  lastClickedVerse = note.verses[note.verses.length - 1];
  renderVerseSelectionUI();
  openVerseTools();
  openNoteTool();
}
// ── General notes (item 3) — a note with no book/chapter/verses, for
// whatever a reader wants to write down that isn't an annotation on a
// specific verse. Composer doubles as create (openNoteComposer()) and edit
// (openNoteComposer(existingNote)) — same form either way. ──
function openNoteComposer(existing) {
  const el = document.getElementById("newNoteComposer");
  el.dataset.editId = existing ? existing.id : "";
  document.getElementById("newNoteTitle").value = existing ? (existing.title || "") : "";
  document.getElementById("newNoteText").value = existing ? existing.text : "";
  document.getElementById("newNoteTags").value = existing ? existing.tags.join(", ") : "";
  el.style.display = "";
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("newNoteText").focus();
}
function closeNoteComposer() {
  document.getElementById("newNoteComposer").style.display = "none";
}
function saveGeneralNote() {
  const text = document.getElementById("newNoteText").value.trim();
  if (!text) { toast("A note needs some text"); return; }
  const title = document.getElementById("newNoteTitle").value.trim();
  const tags = document.getElementById("newNoteTags").value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
  const editId = document.getElementById("newNoteComposer").dataset.editId;
  const notes = getNotes();
  if (editId) {
    const idx = notes.findIndex(n => n.id === editId);
    if (idx >= 0) notes[idx] = { ...notes[idx], title, text, tags, updatedAt: Date.now() };
  } else {
    notes.push({ id: newNoteId(), book: null, chapter: null, verses: [], title, text, tags, createdAt: Date.now(), updatedAt: Date.now() });
    maybeShowFirstTimeDataWarning();
  }
  setNotes(notes);
  closeNoteComposer();
  toast("Note saved");
  renderNotesList();
}
function deleteNoteFromBrowser(note) {
  const prompt = note.book ? `Delete this note on ${noteRefLabel(note)}?` : `Delete "${noteRefLabel(note)}"?`;
  if (!confirm(prompt)) return;
  setNotes(getNotes().filter(n => n.id !== note.id));
  if (current.book === note.book && current.chapter === note.chapter) applyVerseAnnotations();
  toast("Note removed");
  renderNotesList();
}

function downloadTextFile(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function exportNotesMarkdown() {
  const all = getNotes();
  if (!all.length) { toast("No notes to export"); return; }
  const sorted = [...all].sort((a, b) => canonicalOrderCompare(a, b) || a.verses[0] - b.verses[0]);
  let md = `# My Notes — IQ Bible App\nExported ${new Date().toLocaleString()}\n\n`;
  let lastBook = null;
  sorted.forEach(n => {
    if (n.book !== lastBook) { md += `## ${notesBookName(n.book)}\n\n`; lastBook = n.book; }
    md += `### ${noteRefLabel(n)}\n\n`;
    if (n.tags.length) md += `Tags: ${n.tags.join(", ")}\n\n`;
    md += `${n.text}\n\n`;
  });
  downloadTextFile("iqbible-notes.md", "text/markdown", md);
}
function exportNotesJSON() {
  const all = getNotes();
  if (!all.length) { toast("No notes to export"); return; }
  downloadTextFile("iqbible-notes.json", "application/json", JSON.stringify({ exportedAt: new Date().toISOString(), notes: all }, null, 2));
}
function triggerNotesImport() { document.getElementById("notesImportInput").click(); }
function importNotesFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { toast("Import failed — not valid JSON"); return; }
    const incoming = Array.isArray(data) ? data : (data.notes || []);
    // A verse-tied note needs book/chapter/verses; a general note (item 3)
    // has none of those by design — accept either shape.
    const valid = incoming.filter(n => n && typeof n.text === "string" &&
      ((n.book && n.chapter && Array.isArray(n.verses)) || !n.book));
    if (!valid.length) { toast("Import failed — no valid notes found"); return; }
    const notes = getNotes();
    valid.forEach(n => {
      const id = n.id || newNoteId();
      const idx = notes.findIndex(x => x.id === id);
      const clean = n.book
        ? { id, book: n.book, chapter: Number(n.chapter), verses: n.verses.map(Number), text: n.text, tags: Array.isArray(n.tags) ? n.tags : [], version: n.version, versionTitle: n.versionTitle, createdAt: n.createdAt || Date.now(), updatedAt: n.updatedAt || Date.now() }
        : { id, book: null, chapter: null, verses: [], title: n.title || "", text: n.text, tags: Array.isArray(n.tags) ? n.tags : [], createdAt: n.createdAt || Date.now(), updatedAt: n.updatedAt || Date.now() };
      if (idx >= 0) notes[idx] = clean; else notes.push(clean);
    });
    setNotes(notes);
    applyVerseAnnotations();
    renderNotesList();
    toast(`Imported ${valid.length} note${valid.length === 1 ? "" : "s"}`);
  };
  reader.readAsText(file);
  input.value = "";
}

/* ── Bookmarks tab — getBookmarks() (reader.js) is a flat {key:timestamp}
   map with no cached text, so previews are fetched via the shared
   fetchVersePreviews() (reader.js) batched call, one request for every
   bookmark rather than one per verse. ── */
async function renderBookmarksList() {
  const list = document.getElementById("libraryResultList");
  const map = getBookmarks();
  const q = document.getElementById("librarySearchInput").value.trim().toLowerCase();

  if (!Object.keys(map).length) {
    list.innerHTML = `<div class="emptynote">No bookmarks yet — select a verse and use Bookmark in Verse Tools.</div>`;
    return;
  }

  let entries = Object.keys(map).map(k => {
    const [book, chapter, verse] = k.split(":");
    const savedAt = map[k];
    return { key: k, book, chapter: Number(chapter), verse: Number(verse), savedAt: typeof savedAt === "number" ? savedAt : 0 };
  });
  entries = librarySort(entries, "savedAt", "verse");

  const previewByRef = await fetchVersePreviews(entries);

  if (q) entries = entries.filter(e => {
    const label = `${notesBookName(e.book)} ${e.chapter}:${e.verse}`.toLowerCase();
    const text = (previewByRef[`${e.book}.${e.chapter}.${e.verse}`] || "").toLowerCase();
    return label.includes(q) || text.includes(q);
  });
  if (!entries.length) { list.innerHTML = `<div class="emptynote">No bookmarks match.</div>`; return; }

  list.innerHTML = entries.map((e, i) => {
    const label = `${notesBookName(e.book)} ${e.chapter}:${e.verse}`;
    const text = previewByRef[`${e.book}.${e.chapter}.${e.verse}`];
    return `
      <div class="result-card bookmark-card" style="animation-delay:${Math.min(i * 25, 250)}ms" data-bookmark-key="${e.key}">
        <div class="result-ref">${escHtml(label)}</div>
        ${text ? `<div class="result-text">${escHtml(text)}</div>` : ""}
        ${e.savedAt ? `<div class="result-meta">${escHtml(fmtDate(e.savedAt))}</div>` : ""}
        <div class="note-card-actions"><button data-action="remove" class="danger">Remove</button></div>
      </div>`;
  }).join("");
}
function removeBookmarkFromBrowser(key) {
  const map = getBookmarks();
  delete map[key];
  setBookmarks(map);
  const [book, chapter] = key.split(":");
  if (current.book === book && current.chapter === Number(chapter)) applyVerseAnnotations();
  toast("Bookmark removed");
  renderLibraryList();
}
async function exportBookmarksMarkdown() {
  const map = getBookmarks();
  const keys = Object.keys(map);
  if (!keys.length) { toast("No bookmarks to export"); return; }
  const entries = keys.map(k => { const [book, chapter, verse] = k.split(":"); return { book, chapter: Number(chapter), verse: Number(verse), savedAt: map[k] }; })
    .sort((a, b) => canonicalOrderCompare(a, b) || a.verse - b.verse);
  const previewByRef = await fetchVersePreviews(entries);
  let md = `# My Bookmarks — IQ Bible App\nExported ${new Date().toLocaleString()}\n\n`;
  let lastBook = null;
  entries.forEach(e => {
    if (e.book !== lastBook) { md += `${lastBook !== null ? "\n" : ""}## ${notesBookName(e.book)}\n\n`; lastBook = e.book; }
    const text = previewByRef[`${e.book}.${e.chapter}.${e.verse}`];
    md += `- **${notesBookName(e.book)} ${e.chapter}:${e.verse}**${text ? " — " + text : ""}\n`;
  });
  downloadTextFile("iqbible-bookmarks.md", "text/markdown", md);
}
function exportBookmarksJSON() {
  const map = getBookmarks();
  if (!Object.keys(map).length) { toast("No bookmarks to export"); return; }
  downloadTextFile("iqbible-bookmarks.json", "application/json", JSON.stringify({ exportedAt: new Date().toISOString(), bookmarks: map }, null, 2));
}
function triggerBookmarksImport() { document.getElementById("bookmarksImportInput").click(); }
function importBookmarksFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { toast("Import failed — not valid JSON"); return; }
    const incoming = (data && data.bookmarks) || data;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) { toast("Import failed — no valid bookmarks found"); return; }
    const map = getBookmarks();
    let count = 0;
    Object.entries(incoming).forEach(([k, savedAt]) => {
      if (!/^[A-Za-z0-9]+:\d+:\d+$/.test(k)) return;
      map[k] = typeof savedAt === "number" ? savedAt : Date.now();
      count++;
    });
    if (!count) { toast("Import failed — no valid bookmarks found"); return; }
    setBookmarks(map);
    applyVerseAnnotations();
    renderLibraryList();
    toast(`Imported ${count} bookmark${count === 1 ? "" : "s"}`);
  };
  reader.readAsText(file);
  input.value = "";
}

/* ── Highlights tab — getHighlights() (reader.js) is { key: {color,
   createdAt} }; same batched-preview shape as Bookmarks, plus a color
   swatch reusing the existing .vtswatch.hl-* dot styling from Verse
   Tools. ── */
async function renderHighlightsList() {
  const list = document.getElementById("libraryResultList");
  const map = getHighlights();
  const q = document.getElementById("librarySearchInput").value.trim().toLowerCase();

  if (!Object.keys(map).length) {
    list.innerHTML = `<div class="emptynote">No highlights yet — select a verse and pick a color in Verse Tools.</div>`;
    return;
  }

  let entries = Object.keys(map).map(k => {
    const [book, chapter, verse] = k.split(":");
    return { key: k, book, chapter: Number(chapter), verse: Number(verse), color: map[k].color, savedAt: map[k].createdAt || 0 };
  });
  entries = librarySort(entries, "savedAt", "verse");

  const previewByRef = await fetchVersePreviews(entries);

  if (q) entries = entries.filter(e => {
    const label = `${notesBookName(e.book)} ${e.chapter}:${e.verse}`.toLowerCase();
    const text = (previewByRef[`${e.book}.${e.chapter}.${e.verse}`] || "").toLowerCase();
    return label.includes(q) || text.includes(q);
  });
  if (!entries.length) { list.innerHTML = `<div class="emptynote">No highlights match.</div>`; return; }

  list.innerHTML = entries.map((e, i) => {
    const label = `${notesBookName(e.book)} ${e.chapter}:${e.verse}`;
    const text = previewByRef[`${e.book}.${e.chapter}.${e.verse}`];
    return `
      <div class="result-card highlight-card" style="animation-delay:${Math.min(i * 25, 250)}ms" data-highlight-key="${e.key}">
        <div class="result-ref"><span class="vtswatch hl-${e.color}" style="display:inline-block;margin-right:8px"></span>${escHtml(label)}</div>
        ${text ? `<div class="result-text">${escHtml(text)}</div>` : ""}
        ${e.savedAt ? `<div class="result-meta">${escHtml(fmtDate(e.savedAt))}</div>` : ""}
        <div class="note-card-actions"><button data-action="remove" class="danger">Remove</button></div>
      </div>`;
  }).join("");
}
function removeHighlightFromBrowser(key) {
  const map = getHighlights();
  delete map[key];
  setHighlights(map);
  const [book, chapter] = key.split(":");
  if (current.book === book && current.chapter === Number(chapter)) applyVerseAnnotations();
  toast("Highlight removed");
  renderLibraryList();
}
async function exportHighlightsMarkdown() {
  const map = getHighlights();
  const keys = Object.keys(map);
  if (!keys.length) { toast("No highlights to export"); return; }
  const entries = keys.map(k => { const [book, chapter, verse] = k.split(":"); return { book, chapter: Number(chapter), verse: Number(verse), color: map[k].color }; })
    .sort((a, b) => canonicalOrderCompare(a, b) || a.verse - b.verse);
  const previewByRef = await fetchVersePreviews(entries);
  let md = `# My Highlights — IQ Bible App\nExported ${new Date().toLocaleString()}\n\n`;
  let lastBook = null;
  entries.forEach(e => {
    if (e.book !== lastBook) { md += `${lastBook !== null ? "\n" : ""}## ${notesBookName(e.book)}\n\n`; lastBook = e.book; }
    const text = previewByRef[`${e.book}.${e.chapter}.${e.verse}`];
    md += `- **${notesBookName(e.book)} ${e.chapter}:${e.verse}** (${e.color})${text ? " — " + text : ""}\n`;
  });
  downloadTextFile("iqbible-highlights.md", "text/markdown", md);
}
function exportHighlightsJSON() {
  const map = getHighlights();
  if (!Object.keys(map).length) { toast("No highlights to export"); return; }
  downloadTextFile("iqbible-highlights.json", "application/json", JSON.stringify({ exportedAt: new Date().toISOString(), highlights: map }, null, 2));
}
function triggerHighlightsImport() { document.getElementById("highlightsImportInput").click(); }
function importHighlightsFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { toast("Import failed — not valid JSON"); return; }
    const incoming = (data && data.highlights) || data;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) { toast("Import failed — no valid highlights found"); return; }
    const map = getHighlights();
    let count = 0;
    Object.entries(incoming).forEach(([k, v]) => {
      if (!/^[A-Za-z0-9]+:\d+:\d+$/.test(k)) return;
      const color = typeof v === "string" ? v : (v && v.color);
      if (!HIGHLIGHT_COLOR_ORDER.includes(color)) return;
      map[k] = { color, createdAt: (v && v.createdAt) || Date.now() };
      count++;
    });
    if (!count) { toast("Import failed — no valid highlights found"); return; }
    setHighlights(map);
    applyVerseAnnotations();
    renderLibraryList();
    toast(`Imported ${count} highlight${count === 1 ? "" : "s"}`);
  };
  reader.readAsText(file);
  input.value = "";
}

/* ── History tab — visitedAt for "By Date" (the default here), canonical
   book order available via the same shared sort toggle as every other
   tab. ── */
function renderHistoryList() {
  const list = document.getElementById("libraryResultList");
  const q = document.getElementById("librarySearchInput").value.trim().toLowerCase();
  const all = getHistory();
  let entries = librarySort(all, "visitedAt");
  if (q) entries = entries.filter(e => `${e.bookName} ${e.chapter}`.toLowerCase().includes(q));
  renderedHistoryEntries = entries;

  if (!all.length) { list.innerHTML = `<div class="emptynote">No reading history yet.</div>`; return; }
  if (!entries.length) { list.innerHTML = `<div class="emptynote">No history matches.</div>`; return; }

  list.innerHTML = entries.map((e, i) => `
    <div class="result-card history-row" style="animation-delay:${Math.min(i * 25, 250)}ms" data-history-idx="${i}">
      <div class="result-ref">${escHtml(e.bookName)} ${e.chapter}</div>
      <div class="result-meta">${escHtml(fmtDate(e.visitedAt))}</div>
    </div>`).join("");
}
function clearHistory() {
  if (!confirm("Clear your entire reading history?")) return;
  setHistory([]);
  toast("History cleared");
  renderLibraryList();
}
function exportHistoryMarkdown() {
  const all = getHistory();
  if (!all.length) { toast("No history to export"); return; }
  const sorted = [...all].sort((a, b) => b.visitedAt - a.visitedAt);
  let md = `# My Reading History — IQ Bible App\nExported ${new Date().toLocaleString()}\n\n`;
  sorted.forEach(e => { md += `- **${e.bookName} ${e.chapter}** — ${fmtDate(e.visitedAt)}\n`; });
  downloadTextFile("iqbible-history.md", "text/markdown", md);
}
function exportHistoryJSON() {
  const all = getHistory();
  if (!all.length) { toast("No history to export"); return; }
  downloadTextFile("iqbible-history.json", "application/json", JSON.stringify({ exportedAt: new Date().toISOString(), history: all }, null, 2));
}
function triggerHistoryImport() { document.getElementById("historyImportInput").click(); }
// Merges by book+chapter (last-write-wins on visitedAt) rather than a plain
// append, so re-importing the same export twice — or a file that overlaps
// what's already here — doesn't pile up duplicate rows the way two organic,
// non-consecutive visits to the same chapter legitimately can (logHistoryVisit,
// reader.js, only dedupes against the immediately-preceding entry).
function importHistoryFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { toast("Import failed — not valid JSON"); return; }
    const incoming = Array.isArray(data) ? data : (data.history || []);
    const valid = incoming.filter(e => e && e.book && e.chapter && e.visitedAt);
    if (!valid.length) { toast("Import failed — no valid history found"); return; }
    const byKey = new Map();
    getHistory().forEach(e => byKey.set(`${e.book}:${e.chapter}`, e));
    valid.forEach(e => {
      const key = `${e.book}:${Number(e.chapter)}`;
      const existing = byKey.get(key);
      if (!existing || e.visitedAt > existing.visitedAt) {
        byKey.set(key, { book: e.book, bookName: e.bookName || notesBookName(e.book), chapter: Number(e.chapter), visitedAt: e.visitedAt });
      }
    });
    let hist = [...byKey.values()].sort((a, b) => a.visitedAt - b.visitedAt);
    if (hist.length > 200) hist.splice(0, hist.length - 200);
    setHistory(hist);
    renderLibraryList();
    toast(`Imported ${valid.length} history entr${valid.length === 1 ? "y" : "ies"}`);
  };
  reader.readAsText(file);
  input.value = "";
}

/* ── shared click delegation across all four tabs' cards ── */
document.getElementById("libraryResultList") && document.getElementById("libraryResultList").addEventListener("click", async e => {
  const noteCard = e.target.closest(".note-card");
  if (noteCard) {
    const note = getNotes().find(n => n.id === noteCard.dataset.noteId);
    if (!note) return;
    const action = e.target.closest("[data-action]");
    if (action && action.dataset.action === "edit") { editNoteFromBrowser(note); return; }
    if (action && action.dataset.action === "delete") { deleteNoteFromBrowser(note); return; }
    if (!note.book) { openNoteComposer(note); return; }
    closeLibrary();
    await jumpToVerse(note.book, note.chapter, note.verses[0]);
    return;
  }
  const bmCard = e.target.closest(".bookmark-card");
  if (bmCard) {
    const key = bmCard.dataset.bookmarkKey;
    const action = e.target.closest("[data-action]");
    if (action && action.dataset.action === "remove") { removeBookmarkFromBrowser(key); return; }
    const [book, chapter, verse] = key.split(":");
    closeLibrary();
    await jumpToVerse(book, Number(chapter), Number(verse));
    return;
  }
  const hlCard = e.target.closest(".highlight-card");
  if (hlCard) {
    const key = hlCard.dataset.highlightKey;
    const action = e.target.closest("[data-action]");
    if (action && action.dataset.action === "remove") { removeHighlightFromBrowser(key); return; }
    const [book, chapter, verse] = key.split(":");
    closeLibrary();
    await jumpToVerse(book, Number(chapter), Number(verse));
    return;
  }
  const histRow = e.target.closest(".history-row");
  if (histRow) {
    const entry = renderedHistoryEntries[Number(histRow.dataset.historyIdx)];
    if (!entry) return;
    closeLibrary();
    await jumpToVerse(entry.book, entry.chapter, null);
  }
});
