/* ═══════════════════════════════════════════════════════════════════════
   MY LIBRARY — Notes / Bookmarks / Highlights / History, four tabs sharing
   one overlay shell (same `#xOverlay` + `.open` pattern as the search
   overlay, search.js). Notes are edited in the Notes drawer (js/notesdrawer.js)
   — "+ New Note" and a card's Edit both open it; this overlay is for finding,
   filtering by notebook/tag, exporting and jumping to whatever's been saved,
   across the whole Bible, not just the current chapter. */
let libraryActiveTab = localStorage.getItem("iqb_library_tab") || "notes";
let librarySortMode = localStorage.getItem("iqb_library_sort") || "book";
let libraryColorFilter = null;
let notesActiveTag = null;
let notesActiveNotebook = ""; // "" all, "none" Unfiled, else a notebookId
let notesSearchTimer = null;
let renderedHistoryEntries = [];

function openLibrary() {
  switchMainView("library");
  document.getElementById("librarySearchInput").value = "";
  switchLibraryTab(libraryActiveTab);
  // Skip the autofocus while the tour is driving this overlay — it's just
  // pointing at each tab in turn, and focusing the search input pops the
  // mobile keyboard up over the tour tooltip for no reason.
  if (!tourActive) setTimeout(() => {
    const el = document.getElementById(libraryActiveTab === "notes" ? "notesSearchInline" : "librarySearchInput");
    if (el) el.focus();
  }, 80);
}
function closeLibrary() {
  switchMainView("read");
}
const LIBRARY_TAB_DESC = {
  notes: "Your own notes — grouped into notebooks, searchable and taggable, edited in the Notes drawer. Stored on this device; export to back them up.",
  bookmarks: "Verses you've bookmarked, sorted in Bible order or by when you added them.",
  highlights: "Every verse you've highlighted, filterable by color.",
  history: "Chapters you've opened recently, most recent first.",
};
function switchLibraryTab(tab) {
  libraryActiveTab = tab;
  localStorage.setItem("iqb_library_tab", tab);
  document.querySelectorAll(".lib-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.getElementById("libraryOverlay").classList.toggle("lib-tab-notes", tab === "notes");
  document.getElementById("libraryDesc").textContent = LIBRARY_TAB_DESC[tab] || "";
  document.getElementById("notesToolbar").style.display = tab === "notes" ? "" : "none";
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
// A note is labelled by its title; failing that, by its first verse anchor;
// failing that, "Untitled note".
function noteAnchorGroups(note) {
  // { "book:chapter": [verses] } from the anchors list.
  const g = {};
  (note.anchors || []).forEach(a => { (g[`${a.book}:${a.chapter}`] = g[`${a.book}:${a.chapter}`] || []).push(a.verse); });
  return g;
}
function noteRefLabel(note) {
  if ((note.title || "").trim()) return note.title.trim();
  const a = (note.anchors || [])[0];
  if (a) {
    const groups = noteAnchorGroups(note);
    const first = `${notesBookName(a.book)} ${a.chapter}:${compressVerseRanges(groups[`${a.book}:${a.chapter}`])}`;
    return Object.keys(groups).length > 1 ? `${first} +${Object.keys(groups).length - 1} more` : first;
  }
  return "Untitled note";
}
function noteFirstAnchor(note) { return (note.anchors || [])[0] || null; }
// Works for both a note (positioned by its first verse anchor) and a flat
// bookmark/highlight entry ({book,chapter}). A note with no anchors sorts
// after everything positioned — there's no canonical place for it.
function orderKey(x) {
  if (Array.isArray(x.anchors)) return noteFirstAnchor(x);
  return x.book ? { book: x.book, chapter: x.chapter } : null;
}
function canonicalOrderCompare(a, b) {
  const aa = orderKey(a), ba = orderKey(b);
  if (!aa || !ba) return (!aa ? 1 : 0) - (!ba ? 1 : 0);
  const bi = bookList.findIndex(x => x.usfm === aa.book) - bookList.findIndex(x => x.usfm === ba.book);
  if (bi) return bi;
  return aa.chapter - ba.chapter;
}
// "By Book" is canonical Bible order (then chapter/verse) — how a student
// browses. "By Date" is most-recent-first off whichever timestamp field
// this tab's entries carry. Shared by all four tabs so the toggle behaves
// identically everywhere instead of each tab picking its own meaning.
function librarySort(entries, dateField, verseField, modeOverride) {
  const mode = modeOverride || librarySortMode;
  if (mode === "date") return [...entries].sort((a, b) => (b[dateField] || 0) - (a[dateField] || 0));
  if (mode === "color") {
    const filtered = libraryColorFilter ? entries.filter(e => e.color === libraryColorFilter) : entries;
    return [...filtered].sort((a, b) =>
      (HIGHLIGHT_COLOR_ORDER.indexOf(a.color) - HIGHLIGHT_COLOR_ORDER.indexOf(b.color))
      || canonicalOrderCompare(a, b) || (verseField ? a[verseField] - b[verseField] : 0));
  }
  return [...entries].sort((a, b) => canonicalOrderCompare(a, b) || (verseField ? a[verseField] - b[verseField] : 0));
}
// Notes keep their own sort preference (default: most-recently-edited first),
// separate from the Bookmarks/Highlights/History toggle.
let notesSort = localStorage.getItem("iqb_notes_sort") || "date";
function setNotesSort(mode) {
  notesSort = mode === "book" ? "book" : "date";
  localStorage.setItem("iqb_notes_sort", notesSort);
  renderNotesList();
}
function fmtDate(ms) { return ms ? new Date(ms).toLocaleString() : ""; }

/* ── Notes tab — a two-pane workspace: a notebook rail (navigation +
   inline management) on the left, a card grid on the right. Its search and
   sort live in the workspace, not the shared overlay chrome above. ── */
let nnbMenuOpenId = null;   // rail notebook whose ⋯ menu is open
let ncardMenuOpenId = null; // note card whose "move to notebook" menu is open
let notesQuery = "";

function noteDisplayTitle(n) {
  const t = (n.title || "").trim();
  if (t) return t;
  const fromText = typeof ndFirstLine === "function" ? ndFirstLine(n.text) : stripNoteMarkdown((n.text || "").split("\n")[0]);
  return fromText || "Untitled note";
}
function noteAnchorLabel(n) {
  const a = noteFirstAnchor(n);
  if (!a) return "";
  const groups = noteAnchorGroups(n);
  const first = `${notesBookName(a.book)} ${a.chapter}:${compressVerseRanges(groups[`${a.book}:${a.chapter}`])}`;
  const more = Object.keys(groups).length - 1;
  return more > 0 ? `${first} +${more}` : first;
}

async function renderNotesList() {
  const list = document.getElementById("libraryResultList");
  const all = getNotes();
  const q = notesQuery.trim().toLowerCase();
  const searchWasFocused = document.activeElement && document.activeElement.id === "notesSearchInline";

  let matches = all.filter(n => {
    if (notesActiveNotebook === "none" && n.notebookId) return false;
    if (notesActiveNotebook && notesActiveNotebook !== "none" && n.notebookId !== notesActiveNotebook) return false;
    if (notesActiveTag && !n.tags.includes(notesActiveTag)) return false;
    if (!q) return true;
    return n.text.toLowerCase().includes(q) || noteDisplayTitle(n).toLowerCase().includes(q)
      || noteAnchorLabel(n).toLowerCase().includes(q) || n.tags.some(t => t.includes(q));
  });
  matches = librarySort(matches.map(n => ({ ...n, __v0: noteFirstAnchor(n) ? noteFirstAnchor(n).verse : 0 })), "updatedAt", "__v0", notesSort);

  const notebooks = getNotebooks().slice().sort((a, b) => a.name.localeCompare(b.name));

  let gridHtml;
  if (!all.length) {
    gridHtml = `<div class="emptynote">No notes yet — press <strong>N</strong> or the Notes button (bottom-right) to open the drawer and write one, or select a verse and use <strong>Note</strong> in Verse Tools.</div>`;
  } else if (!matches.length) {
    gridHtml = `<div class="emptynote">No notes ${q || notesActiveTag ? "match" : "in this notebook yet"}.</div>`;
  } else {
    const cards = await Promise.all(matches.map(async (n, i) => {
      // Titleless note: the first line becomes the title, so the preview is
      // everything after it (matches the drawer's switcher list) — unless
      // that's a one-liner, in which case there's no separate preview.
      const hasTitle = !!(n.title || "").trim();
      const previewSrc = hasTitle ? n.text : n.text.split("\n").slice(1).join("\n").trim();
      const previewHtml = previewSrc ? await renderNoteMarkdown(previewSrc) : "";
      // A citation the visitor typed can land in the title too — a one-line
      // note is all title, no preview — so the title itself is run through
      // linkifyCitations (the shared helper) to stay hover/tap-previewable.
      const titleHtml = await linkifyCitations(noteDisplayTitle(n));
      const tagsHtml = n.tags.slice(0, 4).map(t => `<span class="ncard-tag">${escHtml(t)}</span>`).join("");
      const ref = noteAnchorLabel(n);
      const nb = n.notebookId ? notebookName(n.notebookId) : "";
      const foot = [
        ref ? `<span class="ncard-ref">${escHtml(ref)}</span>` : "",
        nb && !notesActiveNotebook ? `<span class="ncard-nb">${escHtml(nb)}</span>` : "",
        `<span class="ncard-date">${escHtml(relDate(n.updatedAt))}</span>`,
      ].filter(Boolean).join('<span class="ncard-mid-dot">·</span>');
      const moveMenu = ncardMenuOpenId === n.id ? `
        <div class="ncard-move-menu" data-move-for="${n.id}">
          <div class="ncard-move-head">Move to notebook</div>
          <button data-move="none"${!n.notebookId ? " class='on'" : ""}>Unfiled</button>
          ${notebooks.map(b => `<button data-move="${escAttr(b.id)}"${n.notebookId === b.id ? " class='on'" : ""}>${escHtml(b.name)}</button>`).join("")}
          <button data-move="new" class="ncard-move-new">+ New notebook…</button>
        </div>` : "";
      return `
        <article class="ncard${ncardMenuOpenId === n.id ? " menu-open" : ""}" style="animation-delay:${Math.min(i * 22, 200)}ms" data-note-id="${n.id}" tabindex="0" draggable="true">
          <div class="ncard-actions">
            <button data-action="move" title="Move to notebook" aria-label="Move to notebook"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h6l2 2h8v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg></button>
            <button data-action="edit" title="Edit" aria-label="Edit note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
            <button data-action="delete" class="danger" title="Delete" aria-label="Delete note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>
          </div>
          ${moveMenu}
          <h3 class="ncard-title">${titleHtml}</h3>
          ${previewHtml ? `<div class="ncard-preview note-md">${previewHtml}</div>` : (n.text.trim() ? "" : `<div class="ncard-preview"><span class="ncard-empty">Empty note</span></div>`)}
          <div class="ncard-foot">${foot}</div>
          ${tagsHtml ? `<div class="ncard-tags">${tagsHtml}</div>` : ""}
        </article>`;
    }));
    gridHtml = `<div class="notes-grid">${cards.join("")}</div>`;
  }

  const scope = notesActiveNotebook === "none" ? "Unfiled" : notesActiveNotebook ? notebookName(notesActiveNotebook) : "";
  list.innerHTML = `
    <div class="notes-workspace">
      ${notebookRailHtml(all, notebooks)}
      <div class="notes-main">
        <div class="notes-toolbar-row">
          <label class="notes-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input id="notesSearchInline" type="text" placeholder="Search notes" value="${escAttr(notesQuery)}" autocomplete="off" spellcheck="false">
          </label>
          <button class="notes-new-btn" data-notes-new><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>New note</span></button>
        </div>
        <div class="notes-subhead">
          <span class="notes-count">${matches.length} ${matches.length === 1 ? "note" : "notes"}${scope ? ` in ${escHtml(scope)}` : ""}${notesActiveTag ? ` tagged “${escHtml(notesActiveTag)}”` : ""}</span>
          <div class="notes-sort" role="group" aria-label="Sort notes">
            <button data-sort="date"${notesSort === "date" ? " class='on'" : ""}>Recent</button>
            <button data-sort="book"${notesSort === "book" ? " class='on'" : ""}>Canonical</button>
          </div>
        </div>
        ${gridHtml}
      </div>
    </div>`;

  if (searchWasFocused) {
    const si = document.getElementById("notesSearchInline");
    if (si) { si.focus(); const L = si.value.length; try { si.setSelectionRange(L, L); } catch (_) {} }
  }
}

// Turns a timestamp into a short, friendly label ("Today", "Yesterday",
// "Mon", "Aug 3", "Aug 2024") for the card foot.
function relDate(ms) {
  if (!ms) return "";
  const d = new Date(ms), now = new Date();
  const day = 86400000, diff = now - d;
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === new Date(now - day).toDateString()) return "Yesterday";
  if (diff < 7 * day) return d.toLocaleDateString(undefined, { weekday: "short" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function notebookRailHtml(all, notebooks) {
  const count = id => id === "none" ? all.filter(n => !n.notebookId).length : all.filter(n => n.notebookId === id).length;
  const item = (id, label, n, extra = "") => `
    <button class="nnb-item${notesActiveNotebook === id ? " active" : ""}" data-nb="${escAttr(id)}">
      <span class="nnb-name">${escHtml(label)}</span>
      <span class="nnb-count">${n}</span>
      ${extra}
    </button>`;
  const menuBtn = id => `<span class="nnb-menu-btn" data-nb-menu="${escAttr(id)}" role="button" tabindex="0" aria-label="Notebook options" title="Rename or delete">⋯</span>`;
  const menu = id => nnbMenuOpenId === id ? `
    <span class="nnb-menu" data-nb-menu-for="${escAttr(id)}">
      <button data-nb-act="rename">Rename</button>
      <button data-nb-act="delete" class="danger">Delete</button>
    </span>` : "";
  const tags = [...new Set(all.flatMap(n => n.tags))].sort();
  const tagSection = tags.length ? `
    <div class="nnb-heading nnb-heading-tags">Tags</div>
    <div class="nnb-tags">
      <button class="nnb-tag${notesActiveTag ? "" : " on"}" data-tag="">All</button>
      ${tags.map(t => `<button class="nnb-tag${notesActiveTag === t ? " on" : ""}" data-tag="${escAttr(t)}">${escHtml(t)}</button>`).join("")}
    </div>` : "";
  return `
    <aside class="notes-nb-rail">
      <div class="nnb-heading">Notebooks</div>
      ${item("", "All notes", all.length)}
      ${item("none", "Unfiled", count("none"))}
      ${notebooks.length ? '<div class="nnb-sep"></div>' : ""}
      ${notebooks.map(nb => `<div class="nnb-row${nnbMenuOpenId === nb.id ? " menu-open" : ""}">${item(nb.id, nb.name, count(nb.id), menuBtn(nb.id))}${menu(nb.id)}</div>`).join("")}
      <button class="nnb-new" data-nb-new><span>+</span> New notebook</button>
      ${tagSection}
    </aside>`;
}

function setNotesNotebook(id) {
  notesActiveNotebook = id || "";
  nnbMenuOpenId = null; ncardMenuOpenId = null;
  renderNotesList();
}
function setNotesTag(t) {
  notesActiveTag = t || null;
  ncardMenuOpenId = null;
  renderNotesList();
}
function newNoteInDrawer() {
  openNotesDrawer({ edit: true });
  if (typeof ndNewNote === "function") ndNewNote(); // force a blank note after the drawer loads the active one
}
// The drawer floats above My Library — no need to leave the Notes view to edit.
function openNoteInDrawer(id) {
  nnbMenuOpenId = null; ncardMenuOpenId = null;
  setActiveNoteId(id);
  openNotesDrawer();
}
// Called by closeNotesDrawer() so an edit made in the drawer shows up when
// the visitor lands back on the (still-open) My Library Notes view.
function refreshNotesListIfOpen() {
  const lib = document.getElementById("libraryOverlay");
  if (lib && lib.classList.contains("open") && libraryActiveTab === "notes") renderNotesList();
}
async function newNotebookFromLibrary() {
  const name = await uiPrompt({ title: "New notebook", placeholder: "Notebook name", okLabel: "Create" });
  if (!name) return;
  const nb = createNotebook(name);
  if (nb) { notesActiveNotebook = nb.id; renderNotesList(); }
}
async function moveNoteToNotebook(noteId, target) {
  const notes = getNotes();
  const n = notes.find(x => x.id === noteId);
  if (!n) return;
  let nbId = null;
  if (target === "new") {
    const name = await uiPrompt({ title: "New notebook", placeholder: "Notebook name", okLabel: "Create" });
    if (!name) { ncardMenuOpenId = null; renderNotesList(); return; }
    const nb = createNotebook(name);
    nbId = nb ? nb.id : null;
  } else if (target && target !== "none") {
    nbId = target;
  }
  n.notebookId = nbId;
  n.updatedAt = Date.now();
  setNotes(notes);
  ncardMenuOpenId = null;
  renderNotesList();
  toast(nbId ? `Moved to “${notebookName(nbId)}”` : "Moved to Unfiled");
}
// Inline rename — swaps the notebook's name for a text field in place.
function startNotebookRename(id) {
  nnbMenuOpenId = null;
  const btn = document.querySelector(`.nnb-item[data-nb="${CSS.escape(id)}"]`);
  if (!btn) { renderNotesList(); return; }
  const nameEl = btn.querySelector(".nnb-name");
  const input = document.createElement("input");
  input.className = "nnb-rename";
  input.value = notebookName(id);
  input.setAttribute("aria-label", "Notebook name");
  nameEl.replaceWith(input);
  input.focus();
  input.select();
  const commit = () => {
    const v = input.value.trim();
    if (v) renameNotebook(id, v);
    renderNotesList();
  };
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); renderNotesList(); }
  });
  input.addEventListener("blur", commit);
}
async function confirmDeleteNotebook(id) {
  nnbMenuOpenId = null;
  const nm = notebookName(id);
  const ok = await uiConfirm({ title: "Delete notebook", message: `Delete the notebook “${nm}”? Its notes are kept and become Unfiled.`, okLabel: "Delete", danger: true });
  if (!ok) { renderNotesList(); return; }
  deleteNotebook(id);
  if (notesActiveNotebook === id) notesActiveNotebook = "";
  toast(`Deleted "${nm}"`);
  renderNotesList();
}

// Every note now edits in the Notes drawer — the one editor.
function editNoteFromBrowser(note) { openNoteInDrawer(note.id); }
async function deleteNoteFromBrowser(note) {
  if (!await uiConfirm({ title: "Delete note", message: `Delete “${noteRefLabel(note)}”?`, okLabel: "Delete", danger: true })) return;
  setNotes(getNotes().filter(n => n.id !== note.id));
  applyVerseAnnotations();
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
  const books = getNotebooks();
  // Group by notebook (Unfiled last), then canonical order within a group.
  const groupsOrder = books.slice().sort((a, b) => a.name.localeCompare(b.name)).map(b => b.id).concat([null]);
  let md = `# My Notes — IQ Bible App\nExported ${new Date().toLocaleString()}\n\n`;
  groupsOrder.forEach(gid => {
    const inGroup = all.filter(n => (n.notebookId || null) === gid)
      .sort((a, b) => canonicalOrderCompare(a, b) || (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!inGroup.length) return;
    md += `## ${gid ? notebookName(gid) : "Unfiled"}\n\n`;
    inGroup.forEach(n => {
      md += `### ${noteRefLabel(n)}\n\n`;
      const refs = (n.anchors || []).map(a => `${notesBookName(a.book)} ${a.chapter}:${a.verse}`);
      if (refs.length) md += `Verses: ${refs.join(", ")}\n\n`;
      if (n.tags.length) md += `Tags: ${n.tags.join(", ")}\n\n`;
      md += `${n.text}\n\n`;
    });
  });
  downloadTextFile("iqbible-notes.md", "text/markdown", md);
}
function exportNotesJSON() {
  const all = getNotes();
  if (!all.length) { toast("No notes to export"); return; }
  downloadTextFile("iqbible-notes.json", "application/json", JSON.stringify({ exportedAt: new Date().toISOString(), notebooks: getNotebooks(), notes: all }, null, 2));
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
    // Accept the current shape (anchors) and both older shapes (verse-tied
    // book/chapter/verses, or a free note with neither) — convert on the way in.
    const valid = incoming.filter(n => n && typeof n.text === "string");
    if (!valid.length) { toast("Import failed — no valid notes found"); return; }
    // Bring in any notebooks the export carried (merge by name).
    let notebookIdMap = {};
    if (data && Array.isArray(data.notebooks)) {
      data.notebooks.forEach(nb => { if (nb && nb.name) { const created = createNotebook(nb.name); if (created) notebookIdMap[nb.id] = created.id; } });
    }
    const notes = getNotes();
    valid.forEach(n => {
      const id = n.id || newNoteId();
      const idx = notes.findIndex(x => x.id === id);
      const anchors = Array.isArray(n.anchors)
        ? n.anchors.filter(a => a && a.book).map(a => ({ book: a.book, chapter: Number(a.chapter), verse: Number(a.verse) }))
        : (n.book && Array.isArray(n.verses) ? n.verses.map(v => ({ book: n.book, chapter: Number(n.chapter), verse: Number(v) })) : []);
      const clean = {
        id, title: n.title || "", text: n.text, tags: Array.isArray(n.tags) ? n.tags : [],
        notebookId: n.notebookId ? (notebookIdMap[n.notebookId] || n.notebookId) : null,
        anchors, version: n.version, versionTitle: n.versionTitle,
        createdAt: n.createdAt || Date.now(), updatedAt: n.updatedAt || Date.now(),
      };
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

/* ── Bookmarks tab — getBookmarks() (reader.js) is a flat
   {key:{createdAt,groupId}} map with no cached text, so previews are fetched
   via the shared fetchVersePreviews() (reader.js) batched call, one request
   for every bookmarked verse rather than one per card. Verses bookmarked in
   a single action share a groupId and collapse into one entry. ── */
// Collapses the flat bookmark map into one entry per bookmarking action
// (shared groupId); a legacy groupId:null bookmark becomes its own entry.
// Sorted canonically. Shared by the Bookmarks tab and the Markdown export.
function groupedBookmarkEntries(map) {
  const groups = {};
  Object.keys(map).forEach(k => {
    const [book, chapter, verse] = k.split(":");
    const v = map[k] || {};
    const gid = v.groupId || k;
    const g = groups[gid] || (groups[gid] = { keys: [], book, chapter: Number(chapter), verses: [], savedAt: 0 });
    g.keys.push(k);
    g.verses.push(Number(verse));
    g.savedAt = Math.max(g.savedAt, v.createdAt || 0);
  });
  return Object.values(groups).map(g => {
    g.verses.sort((a, b) => a - b);
    g.verse = g.verses[0];
    return g;
  }).sort((a, b) => canonicalOrderCompare(a, b) || a.verse - b.verse);
}
async function renderBookmarksList() {
  const list = document.getElementById("libraryResultList");
  const map = getBookmarks();
  const q = document.getElementById("librarySearchInput").value.trim().toLowerCase();

  if (!Object.keys(map).length) {
    list.innerHTML = `<div class="emptynote">No bookmarks yet — select a verse and use Bookmark in Verse Tools.</div>`;
    return;
  }

  let entries = librarySort(groupedBookmarkEntries(map), "savedAt", "verse");

  const previewByRef = await fetchVersePreviews(
    entries.flatMap(g => g.verses.map(v => ({ book: g.book, chapter: g.chapter, verse: v }))));
  const groupLabel = g => `${notesBookName(g.book)} ${g.chapter}:${compressVerseRanges(g.verses)}`;
  const groupText = g => g.verses.map(v => previewByRef[`${g.book}.${g.chapter}.${v}`]).filter(Boolean).join(" ");

  if (q) entries = entries.filter(g => groupLabel(g).toLowerCase().includes(q) || groupText(g).toLowerCase().includes(q));
  if (!entries.length) { list.innerHTML = `<div class="emptynote">No bookmarks match.</div>`; return; }

  list.innerHTML = entries.map((g, i) => {
    const label = groupLabel(g);
    const text = groupText(g);
    const citeAttr = text ? ` data-cite-id="${registerCiteId(label, text)}"` : "";
    return `
      <div class="result-card bookmark-card" style="animation-delay:${Math.min(i * 25, 250)}ms" data-bookmark-key="${g.keys[0]}" data-bookmark-keys="${g.keys.join(',')}">
        <div class="result-ref"${citeAttr}>${escHtml(label)}</div>
        ${text ? `<div class="result-text">${escHtml(text)}</div>` : ""}
        ${g.savedAt ? `<div class="result-meta">${escHtml(fmtDate(g.savedAt))}</div>` : ""}
        <div class="note-card-actions"><button data-action="remove" class="danger">Remove</button></div>
      </div>`;
  }).join("");
}
function removeBookmarkFromBrowser(keys) {
  const list = Array.isArray(keys) ? keys : String(keys).split(",").filter(Boolean);
  const map = getBookmarks();
  list.forEach(k => delete map[k]);
  setBookmarks(map);
  if (list.some(k => k.startsWith(`${current.book}:${current.chapter}:`))) applyVerseAnnotations();
  toast(list.length > 1 ? "Bookmarks removed" : "Bookmark removed");
  renderLibraryList();
}
async function exportBookmarksMarkdown() {
  const map = getBookmarks();
  if (!Object.keys(map).length) { toast("No bookmarks to export"); return; }
  const groups = groupedBookmarkEntries(map);
  const previewByRef = await fetchVersePreviews(
    groups.flatMap(g => g.verses.map(v => ({ book: g.book, chapter: g.chapter, verse: v }))));
  let md = `# My Bookmarks — IQ Bible App\nExported ${new Date().toLocaleString()}\n\n`;
  let lastBook = null;
  groups.forEach(g => {
    if (g.book !== lastBook) { md += `${lastBook !== null ? "\n" : ""}## ${notesBookName(g.book)}\n\n`; lastBook = g.book; }
    const text = g.verses.map(v => previewByRef[`${g.book}.${g.chapter}.${v}`]).filter(Boolean).join(" ");
    md += `- **${notesBookName(g.book)} ${g.chapter}:${compressVerseRanges(g.verses)}**${text ? " — " + text : ""}\n`;
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
    Object.entries(incoming).forEach(([k, val]) => {
      if (!/^[A-Za-z0-9]+:\d+:\d+$/.test(k)) return;
      map[k] = val && typeof val === "object"
        ? { createdAt: typeof val.createdAt === "number" ? val.createdAt : Date.now(), groupId: val.groupId || null }
        : { createdAt: typeof val === "number" ? val : Date.now(), groupId: null };
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

/* ── Highlights tab — getHighlights() (reader.js) is
   { key: {color,createdAt,groupId} }; same batched-preview + grouping shape
   as Bookmarks (verses highlighted in one action share a groupId and collapse
   into one entry), plus a color swatch reusing the existing .vtswatch.hl-*
   dot styling from Verse Tools. ── */
function groupedHighlightEntries(map) {
  const groups = {};
  Object.keys(map).forEach(k => {
    const [book, chapter, verse] = k.split(":");
    const v = map[k] || {};
    const gid = v.groupId || k;
    const g = groups[gid] || (groups[gid] = { keys: [], book, chapter: Number(chapter), verses: [], color: v.color, savedAt: 0 });
    g.keys.push(k);
    g.verses.push(Number(verse));
    g.savedAt = Math.max(g.savedAt, v.createdAt || 0);
  });
  return Object.values(groups).map(g => {
    g.verses.sort((a, b) => a - b);
    g.verse = g.verses[0];
    return g;
  }).sort((a, b) => canonicalOrderCompare(a, b) || a.verse - b.verse);
}
async function renderHighlightsList() {
  const list = document.getElementById("libraryResultList");
  const map = getHighlights();
  const q = document.getElementById("librarySearchInput").value.trim().toLowerCase();

  if (!Object.keys(map).length) {
    list.innerHTML = `<div class="emptynote">No highlights yet — select a verse and pick a color in Verse Tools.</div>`;
    return;
  }

  let entries = librarySort(groupedHighlightEntries(map), "savedAt", "verse");

  const previewByRef = await fetchVersePreviews(
    entries.flatMap(g => g.verses.map(v => ({ book: g.book, chapter: g.chapter, verse: v }))));
  const groupLabel = g => `${notesBookName(g.book)} ${g.chapter}:${compressVerseRanges(g.verses)}`;
  const groupText = g => g.verses.map(v => previewByRef[`${g.book}.${g.chapter}.${v}`]).filter(Boolean).join(" ");

  if (q) entries = entries.filter(g => groupLabel(g).toLowerCase().includes(q) || groupText(g).toLowerCase().includes(q));
  if (!entries.length) { list.innerHTML = `<div class="emptynote">No highlights match.</div>`; return; }

  list.innerHTML = entries.map((g, i) => {
    const label = groupLabel(g);
    const text = groupText(g);
    const citeAttr = text ? ` data-cite-id="${registerCiteId(label, text)}"` : "";
    return `
      <div class="result-card highlight-card" style="animation-delay:${Math.min(i * 25, 250)}ms" data-highlight-key="${g.keys[0]}" data-highlight-keys="${g.keys.join(',')}">
        <div class="result-ref"${citeAttr}><span class="vtswatch hl-${g.color}" style="display:inline-block;margin-right:8px"></span>${escHtml(label)}</div>
        ${text ? `<div class="result-text">${escHtml(text)}</div>` : ""}
        ${g.savedAt ? `<div class="result-meta">${escHtml(fmtDate(g.savedAt))}</div>` : ""}
        <div class="note-card-actions"><button data-action="remove" class="danger">Remove</button></div>
      </div>`;
  }).join("");
}
function removeHighlightFromBrowser(keys) {
  const list = Array.isArray(keys) ? keys : String(keys).split(",").filter(Boolean);
  const map = getHighlights();
  list.forEach(k => delete map[k]);
  setHighlights(map);
  if (list.some(k => k.startsWith(`${current.book}:${current.chapter}:`))) applyVerseAnnotations();
  toast(list.length > 1 ? "Highlights removed" : "Highlight removed");
  renderLibraryList();
}
async function exportHighlightsMarkdown() {
  const map = getHighlights();
  if (!Object.keys(map).length) { toast("No highlights to export"); return; }
  const groups = groupedHighlightEntries(map);
  const previewByRef = await fetchVersePreviews(
    groups.flatMap(g => g.verses.map(v => ({ book: g.book, chapter: g.chapter, verse: v }))));
  let md = `# My Highlights — IQ Bible App\nExported ${new Date().toLocaleString()}\n\n`;
  let lastBook = null;
  groups.forEach(g => {
    if (g.book !== lastBook) { md += `${lastBook !== null ? "\n" : ""}## ${notesBookName(g.book)}\n\n`; lastBook = g.book; }
    const text = g.verses.map(v => previewByRef[`${g.book}.${g.chapter}.${v}`]).filter(Boolean).join(" ");
    md += `- **${notesBookName(g.book)} ${g.chapter}:${compressVerseRanges(g.verses)}** (${g.color})${text ? " — " + text : ""}\n`;
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
      map[k] = { color, createdAt: (v && v.createdAt) || Date.now(), groupId: (v && v.groupId) || null };
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
async function clearHistory() {
  if (!await uiConfirm({ title: "Clear reading history", message: "Clear your entire reading history? This can’t be undone.", okLabel: "Clear", danger: true })) return;
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
const libraryResultList = document.getElementById("libraryResultList");
libraryResultList && libraryResultList.addEventListener("input", e => {
  if (e.target.id === "notesSearchInline") {
    notesQuery = e.target.value;
    clearTimeout(notesSearchTimer);
    notesSearchTimer = setTimeout(renderNotesList, 170);
  }
});
// Drag a note card onto a rail notebook to file it there.
libraryResultList && libraryResultList.addEventListener("dragstart", e => {
  const c = e.target.closest(".ncard");
  if (!c) return;
  e.dataTransfer.setData("text/plain", c.dataset.noteId);
  e.dataTransfer.effectAllowed = "move";
  c.classList.add("dragging");
});
libraryResultList && libraryResultList.addEventListener("dragend", e => {
  const c = e.target.closest(".ncard");
  if (c) c.classList.remove("dragging");
  document.querySelectorAll(".nnb-item.nnb-drop").forEach(el => el.classList.remove("nnb-drop"));
});
libraryResultList && libraryResultList.addEventListener("dragover", e => {
  const t = e.target.closest(".nnb-item[data-nb]");
  if (t && t.dataset.nb !== "") { e.preventDefault(); e.dataTransfer.dropEffect = "move"; t.classList.add("nnb-drop"); }
});
libraryResultList && libraryResultList.addEventListener("dragleave", e => {
  const t = e.target.closest(".nnb-item[data-nb]");
  if (t) t.classList.remove("nnb-drop");
});
libraryResultList && libraryResultList.addEventListener("drop", e => {
  const t = e.target.closest(".nnb-item[data-nb]");
  if (!t || t.dataset.nb === "") return;
  e.preventDefault();
  t.classList.remove("nnb-drop");
  const id = e.dataTransfer.getData("text/plain");
  if (id) moveNoteToNotebook(id, t.dataset.nb === "none" ? "none" : t.dataset.nb);
});
libraryResultList && libraryResultList.addEventListener("click", async e => {
  // Notes workspace: rail (notebooks + tags), search/sort, card move menu
  if (e.target.closest(".notes-workspace")) {
    if (e.target.closest("[data-notes-new]")) { newNoteInDrawer(); return; }
    if (e.target.closest("[data-nb-new]")) { newNotebookFromLibrary(); return; }
    const sortBtn = e.target.closest("[data-sort]");
    if (sortBtn) { setNotesSort(sortBtn.dataset.sort); return; }
    const tagBtn = e.target.closest(".nnb-tag");
    if (tagBtn) { setNotesTag(tagBtn.dataset.tag); return; }
    const menuBtn = e.target.closest("[data-nb-menu]");
    if (menuBtn) { e.stopPropagation(); nnbMenuOpenId = nnbMenuOpenId === menuBtn.dataset.nbMenu ? null : menuBtn.dataset.nbMenu; renderNotesList(); return; }
    const act = e.target.closest("[data-nb-act]");
    if (act) {
      const id = act.closest("[data-nb-menu-for]").dataset.nbMenuFor;
      if (act.dataset.nbAct === "rename") startNotebookRename(id);
      else confirmDeleteNotebook(id);
      return;
    }
    const moveOpt = e.target.closest("[data-move]");
    if (moveOpt) {
      const noteId = moveOpt.closest("[data-move-for]").dataset.moveFor;
      moveNoteToNotebook(noteId, moveOpt.dataset.move);
      return;
    }
    const nbItem = e.target.closest(".nnb-item");
    if (nbItem) { setNotesNotebook(nbItem.dataset.nb); return; }
  }
  const noteCard = e.target.closest(".ncard");
  if (noteCard) {
    const note = getNotes().find(n => n.id === noteCard.dataset.noteId);
    if (!note) { ncardMenuOpenId = null; renderNotesList(); return; }
    const action = e.target.closest("[data-action]");
    if (action && action.dataset.action === "delete") { deleteNoteFromBrowser(note); return; }
    if (action && action.dataset.action === "move") {
      ncardMenuOpenId = ncardMenuOpenId === note.id ? null : note.id;
      nnbMenuOpenId = null;
      renderNotesList();
      return;
    }
    if (e.target.closest(".ncard-move-menu")) return;
    openNoteInDrawer(note.id);
    return;
  }
  // clicked outside any card / rail menu inside the workspace — dismiss menus
  if (e.target.closest(".notes-workspace") && (nnbMenuOpenId || ncardMenuOpenId)) {
    nnbMenuOpenId = null; ncardMenuOpenId = null; renderNotesList();
  }
  const bmCard = e.target.closest(".bookmark-card");
  if (bmCard) {
    const key = bmCard.dataset.bookmarkKey;
    const action = e.target.closest("[data-action]");
    if (action && action.dataset.action === "remove") { removeBookmarkFromBrowser(bmCard.dataset.bookmarkKeys || key); return; }
    const [book, chapter, verse] = key.split(":");
    closeLibrary();
    await jumpToVerse(book, Number(chapter), Number(verse));
    return;
  }
  const hlCard = e.target.closest(".highlight-card");
  if (hlCard) {
    const key = hlCard.dataset.highlightKey;
    const action = e.target.closest("[data-action]");
    if (action && action.dataset.action === "remove") { removeHighlightFromBrowser(hlCard.dataset.highlightKeys || key); return; }
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
