/* ═══════════════════════════════════════════════════════════════════════
   NOTES DRAWER — a persistent, dockable capture surface (see the long
   comment on #notesDrawer in css/styles.css). It's the one editor for the
   app's single note model (getNotes/setNotes/newNoteId, reader.js) — used
   from here, from My Library, and from the reading-view note icon. One note
   is "active" at a time; the N shortcut, the launcher and Verse Tools ▸ Note
   all write to it. A note may carry verse anchors (added by Verse Tools) and
   a notebookId; both are edited here.

   Everything here is local-only (localStorage) — no API call is needed to
   store a note. The one API touch is /parse/citations, used (as everywhere
   else in the app) to make every reference inside a note hover-previewable
   and to count refs for the chip — never a client-side citation parser. */

const ND_ACTIVE_KEY = "iqb_active_note";
const ND_HEIGHT_KEY = "iqb_notes_drawer_h";        // desktop: a px height
const ND_SHEET_DETENT_KEY = "iqb_notes_sheet_detent"; // mobile: "peek" | "full"
// Mobile sheet snap points, as a fraction of the viewport height.
const ND_PEEK_VH = 0.42, ND_FULL_VH = 0.78;
let ndCurrentId = "";
let ndSwitcherOpen = false;
let ndSaveTimer = null;
let ndRefreshTimer = null;
let ndSearchTimer = null;
// Ref counts keyed by note id + updatedAt, so an edited note re-counts but a
// re-render of an unchanged one is free.
const ndRefCountCache = new Map();

function ndAllNotes() { return getNotes(); }
function getActiveNoteId() { return localStorage.getItem(ND_ACTIVE_KEY) || ""; }
function setActiveNoteId(id) { localStorage.setItem(ND_ACTIVE_KEY, id || ""); }
function ndCurrentNote() { return ndCurrentId ? getNotes().find(n => n.id === ndCurrentId) || null : null; }
const ND_NB_FILTER_KEY = "iqb_notes_nb_filter"; // "" = all, "none" = Unfiled, else a notebookId
function ndNbFilter() { return localStorage.getItem(ND_NB_FILTER_KEY) || ""; }
function ndSetNbFilter(v) { localStorage.setItem(ND_NB_FILTER_KEY, v || ""); }

// The active note, or the most recently touched note, or null when the
// visitor has never written one.
function getActiveNote() {
  const all = ndAllNotes();
  if (!all.length) return null;
  const byId = all.find(n => n.id === getActiveNoteId());
  if (byId) return byId;
  const latest = [...all].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  setActiveNoteId(latest.id);
  return latest;
}

function ndBlankNote() {
  return { id: newNoteId(), title: "", text: "", tags: [], notebookId: null, anchors: [], createdAt: Date.now(), updatedAt: Date.now() };
}

/* ── open / close ── */
function openNotesDrawer(opts) {
  const d = document.getElementById("notesDrawer");
  if (!d) return;
  document.getElementById("notesLauncher").hidden = true;
  // Size the sheet/panel before it's shown so the reading-column clearance
  // padding (keyed off --notes-drawer-h) is right on the first frame.
  ndApplyStoredHeight();
  d.hidden = false;
  document.body.classList.add("notes-drawer-open");
  document.body.classList.remove("chrome-hidden"); // bring the chrome back so the drawer doesn't open under a tucked-away topbar
  // Read-first: the drawer opens showing the rendered note with every verse
  // hoverable. Editing is an explicit step (the Edit button, or clicking into
  // the text). A brand-new / empty note has nothing to read, so it opens
  // straight in the text box.
  ndLoadActiveIntoEditor(opts && opts.edit ? "edit" : "read");
  ndUpdateAttachButton();
  if (!(opts && opts.keepSwitcher)) ndCloseSwitcher();
  // Focus the text box only when it's the visible view (an explicit edit open,
  // or an empty note that fell back to edit) — never steal focus into a hidden
  // textarea sitting behind the read view.
  if (!opts || opts.focus !== false) setTimeout(() => { const e = document.getElementById("ndEditor"); if (e && !e.hidden) e.focus(); }, 60);
}
function closeNotesDrawer() {
  const d = document.getElementById("notesDrawer");
  if (!d || d.hidden) return;
  ndFlushSave();
  d.hidden = true;
  document.body.classList.remove("notes-drawer-open");
  ndSyncLauncher();
  document.getElementById("notesLauncher").hidden = false;
  if (typeof refreshNotesListIfOpen === "function") refreshNotesListIfOpen();
}
function toggleNotesDrawer() {
  const d = document.getElementById("notesDrawer");
  if (!d) return;
  // N is the capture shortcut — opening with it drops you straight into the
  // text box; pressing it again (drawer already open) flips edit ⇄ read.
  if (d.hidden) openNotesDrawer({ edit: true }); else ndModeToggle();
}
function ndIsMobile() { return window.matchMedia("(max-width:1180px)").matches; }

/* ── editor ── */
// mode: "edit" opens straight in the text box (a new note, or N-to-capture);
// "read" (the default for opening the drawer or picking a note) shows the
// rendered, hover-previewable view — an empty note falls back to edit since
// there's nothing to read.
function ndLoadActiveIntoEditor(mode) {
  const note = getActiveNote();
  ndCurrentId = note ? note.id : "";
  document.getElementById("ndTitle").value = note ? (note.title || "") : "";
  document.getElementById("ndEditor").value = note ? note.text : "";
  ndRenderTags(note ? note.tags : []);
  ndRenderNotebookChip();
  ndRenderAnchors();
  ndSetSaved(true);
  ndSyncLauncher();
  ndRenderRefChip();
  if (mode === "edit") ndEnterEdit({ focus: false }); else ndEnterRead();
  if (ndSwitcherOpen) ndRenderSwitcherList();
}
function ndOnEditInput() {
  ndSetSaved(false);
  clearTimeout(ndSaveTimer);
  ndSaveTimer = setTimeout(ndFlushSave, 450);
  clearTimeout(ndRefreshTimer);
  ndRefreshTimer = setTimeout(() => { ndRenderRefChip(); if (ndSwitcherOpen) ndRenderSwitcherList(); }, 1500);
}
// Writes the editor's current title/text to the active note, creating one on
// the first keystroke if none exists yet (so an opened-but-untouched drawer
// never leaves an empty note behind).
function ndFlushSave() {
  clearTimeout(ndSaveTimer);
  const titleEl = document.getElementById("ndTitle"), editorEl = document.getElementById("ndEditor");
  if (!editorEl) return;
  const text = editorEl.value, title = titleEl.value.trim();
  const notes = getNotes();
  let note = notes.find(n => n.id === ndCurrentId);
  if (!note) {
    if (!text.trim() && !title) { ndSetSaved(true); return; }
    note = ndBlankNote();
    // A note started while a notebook filter is active lands in that notebook.
    const f = ndNbFilter();
    if (f && f !== "none") note.notebookId = f;
    notes.push(note);
    ndCurrentId = note.id;
    setActiveNoteId(note.id);
    maybeShowFirstTimeDataWarning();
  }
  note.title = title;
  note.text = text;
  note.updatedAt = Date.now();
  setNotes(notes);
  ndSetSaved(true);
  ndSyncLauncher();
}
function ndSetSaved(saved) {
  const el = document.getElementById("ndSaved");
  if (!el) return;
  el.classList.toggle("saving", !saved);
  el.querySelector("span").textContent = saved ? "Saved" : "Saving…";
}

/* ── edit / read mode ──
   Two explicit modes, one at a time, toggled by the header button (or Esc,
   or clicking into the read text). READ shows the note run through
   linkifyCitations — the shared helper, same /parse/citations path as My
   Library and every other prose surface, never a local parser — so every
   verse in it is hover-previewable. EDIT is the plain <textarea>; a
   <textarea> can't hold a live hover chip, so citations aren't interactive
   while you're actually typing — that's the reason the two modes exist. */
let ndEditing = false;
// Rendered HTML keyed by the exact note text, so returning to a note whose
// text hasn't changed costs no /parse/citations call.
const ndPreviewHtmlCache = new Map();

function ndSyncModeButton() {
  const btn = document.getElementById("ndModeBtn");
  if (btn) {
    btn.classList.toggle("editing", ndEditing);
    btn.setAttribute("aria-label", ndEditing ? "Finish editing note" : "Edit note");
    btn.title = ndEditing ? "Done editing (Esc)" : "Edit note (N)";
    const lbl = btn.querySelector(".nd-mode-label");
    if (lbl) lbl.textContent = ndEditing ? "Done" : "Edit";
  }
  const saved = document.getElementById("ndSaved");
  if (saved) saved.hidden = !ndEditing; // "Saved / Saving…" only means something while editing
  const tb = document.getElementById("ndToolbar");
  if (tb) tb.hidden = !ndEditing; // the Markdown toolbar belongs to the text box only
}

// opts.focus:false skips the focus/caret (drawer opening does its own timed
// focus after the slide-in). opts.caret places the cursor at an offset (a
// click into the read text lands the cursor where you clicked).
function ndEnterEdit(opts) {
  opts = opts || {};
  const ed = document.getElementById("ndEditor"), pv = document.getElementById("ndPreview");
  // Clicking the read view to edit should be seamless. The textarea and the
  // preview share font size, line-height and padding, so carrying the preview's
  // scroll offset straight across keeps a long note from lurching —
  // setSelectionRange scrolls the caret into view synchronously, so the scroll
  // is re-pinned after it.
  const fromClick = !!opts.keepScroll && !pv.hidden;
  const carryScroll = fromClick ? pv.scrollTop : 0;
  ndEditing = true;
  pv.hidden = true;
  ed.hidden = false;
  ndSyncModeButton();
  ndRenderAnchors();
  if (opts.focus !== false) {
    ed.focus();
    let at = typeof opts.caret === "number" ? opts.caret : null;
    if (at == null && !fromClick) at = ed.value.length; // explicit edit open → caret at end
    if (at != null) { try { ed.setSelectionRange(at, at); } catch (_) {} }
    if (fromClick) ed.scrollTop = carryScroll; // re-pin after setSelectionRange's scroll-into-view
  }
}

function ndEnterRead() {
  const ed = document.getElementById("ndEditor"), pv = document.getElementById("ndPreview");
  const text = ed.value;
  if (!text.trim()) { ndEnterEdit({ focus: false }); return; } // nothing to read yet
  ndEditing = false;
  ndSyncModeButton();
  ndRenderAnchors();
  pv.dataset.src = text;
  const cached = ndPreviewHtmlCache.get(text);
  // Interim (pre-render) view keeps line breaks as <br> so it doesn't reflow
  // when the Markdown/citation HTML lands a beat later.
  pv.innerHTML = cached != null ? cached : escHtml(text).replace(/\n/g, "<br>");
  pv.hidden = false;
  ed.hidden = true;
  if (cached == null) {
    renderNoteMarkdown(text).then(html => {
      ndPreviewHtmlCache.set(text, html);
      if (!ndEditing && ed.value === text && !pv.hidden) pv.innerHTML = html;
    });
  }
}

function ndModeToggle() {
  if (ndEditing) { ndFlushSave(); ndEnterRead(); }
  else ndEnterEdit();
}

/* ── Markdown toolbar ──
   Notes are stored as plain text; these buttons (and Ctrl/Cmd+B / +I) just
   drop the Markdown marks into the textarea — the read view renders them via
   renderNoteMarkdown. Nothing here touches storage. */
function ndFmt(kind) {
  const ed = document.getElementById("ndEditor");
  if (!ed || ed.hidden) return;
  const s = ed.selectionStart, e = ed.selectionEnd, val = ed.value, sel = val.slice(s, e);

  const wrap = (mark, ph) => {
    const body = sel || ph;
    ed.setRangeText(mark + body + mark, s, e, "select");
    if (!sel) ed.setSelectionRange(s + mark.length, s + mark.length + ph.length);
  };
  const prefixLines = mk => {
    const from = val.lastIndexOf("\n", s - 1) + 1;
    let to = val.indexOf("\n", e); if (to === -1) to = val.length;
    const block = val.slice(from, to).split("\n").map(l => mk + l).join("\n");
    ed.setRangeText(block, from, to, "select");
  };

  switch (kind) {
    case "bold":   wrap("**", "bold text"); break;
    case "italic": wrap("*", "italic text"); break;
    case "head":   prefixLines("## "); break;
    case "quote":  prefixLines("> "); break;
    case "ul":     prefixLines("- "); break;
    case "link": {
      const body = sel || "text";
      ed.setRangeText(`[${body}](url)`, s, e, "select");
      const u = s + 1 + body.length + 2;
      ed.setSelectionRange(u, u + 3);
      break;
    }
  }
  ed.focus();
  ndOnEditInput();
}

// Re-render the current view after the note text changed underneath us
// (Verse Tools ▸ Note) — but never yank someone out of the text box mid-edit.
function ndRefreshView() {
  if (ndEditing) return;
  ndEnterRead();
}

// Where in the note text a click on the read view landed. This only lines up
// 1:1 with the textarea value when the render preserved every source
// character — plain text and citations do (a citation just wraps its own raw
// text); Markdown does not (it drops #, *, - and newlines from the DOM text).
// The caller checks pane.textContent === source before trusting the result.
function ndCaretOffsetFromPoint(pane, x, y) {
  let node, offset;
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (!p) return null;
    node = p.offsetNode; offset = p.offset;
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (!r) return null;
    node = r.startContainer; offset = r.startOffset;
  } else return null;
  if (!pane.contains(node)) return null;
  const r = document.createRange();
  r.setStart(pane, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

// Fallback for the Markdown case: the source offset of the block that was
// clicked, from its data-sl (stamped by ndMarkdownToHtml). Lands the caret at
// the start of that line — coarser than a click point, but always on target.
function ndBlockSrcOffset(pane, x, y) {
  const el = document.elementFromPoint(x, y);
  const block = el && el.closest && el.closest("[data-sl]");
  return block && pane.contains(block) ? +block.dataset.sl : null;
}

// A fresh note is a pending state (ndCurrentId = "") — nothing is written to
// storage until the first keystroke, matching My Library's composer.
function ndNewNote() {
  ndFlushSave();
  ndCurrentId = "";
  setActiveNoteId("");
  document.getElementById("ndTitle").value = "";
  document.getElementById("ndEditor").value = "";
  ndRenderTags([]);
  ndRenderNotebookChip();
  ndRenderAnchors();
  ndSetSaved(true);
  document.getElementById("ndRefChip").hidden = true;
  ndEnterEdit({ focus: false });
  ndSyncLauncher();
  ndCloseSwitcher();
  setTimeout(() => document.getElementById("ndEditor").focus(), 50);
}

/* ── tags ── */
function ndRenderTags(tags) {
  const wrap = document.getElementById("ndTags");
  const input = document.getElementById("ndTagInput");
  wrap.querySelectorAll(".nd-tag").forEach(el => el.remove());
  (tags || []).forEach(t => {
    const chip = document.createElement("span");
    chip.className = "nd-tag";
    chip.innerHTML = `${escHtml(t)}<button type="button" aria-label="Remove tag ${escAttr(t)}" data-tag="${escAttr(t)}">&times;</button>`;
    wrap.insertBefore(chip, input);
  });
}
function ndAddTag(raw) {
  const t = raw.trim().toLowerCase().replace(/,+$/, "").trim();
  if (!t) return;
  const notes = getNotes();
  let n = notes.find(x => x.id === ndCurrentId);
  if (!n) { n = ndBlankNote(); notes.push(n); ndCurrentId = n.id; setActiveNoteId(n.id); maybeShowFirstTimeDataWarning(); }
  if (!n.tags.includes(t)) { n.tags.push(t); n.updatedAt = Date.now(); setNotes(notes); }
  ndRenderTags(n.tags);
  ndSyncLauncher();
}
function ndRemoveTag(t) {
  const notes = getNotes();
  const n = notes.find(x => x.id === ndCurrentId);
  if (!n) return;
  n.tags = n.tags.filter(x => x !== t);
  n.updatedAt = Date.now();
  setNotes(notes);
  ndRenderTags(n.tags);
}

/* ── notebook selector (footer chip + menu) ── */
function ndRenderNotebookChip() {
  const btn = document.getElementById("ndNotebookBtn");
  if (!btn) return;
  const note = ndCurrentNote();
  const name = note && note.notebookId ? notebookName(note.notebookId) : "";
  btn.classList.toggle("set", !!name);
  btn.querySelector("span").textContent = name || "Notebook";
}
function ndToggleNotebookMenu() {
  const menu = document.getElementById("ndNotebookMenu");
  if (!menu) return;
  if (!menu.hidden) { menu.hidden = true; return; }
  const note = ndCurrentNote();
  const cur = note ? note.notebookId : null;
  const rows = [`<button class="nd-nb-opt${!cur ? " on" : ""}" data-nb="none">Unfiled</button>`]
    .concat(getNotebooks().sort((a, b) => a.name.localeCompare(b.name))
      .map(nb => `<button class="nd-nb-opt${cur === nb.id ? " on" : ""}" data-nb="${nb.id}">${escHtml(nb.name)}</button>`))
    .concat([`<button class="nd-nb-opt nd-nb-new" data-nb="new">+ New notebook…</button>`]);
  menu.innerHTML = rows.join("");
  menu.hidden = false;
}
async function ndSetNotebook(val) {
  document.getElementById("ndNotebookMenu").hidden = true;
  const notes = getNotes();
  let n = notes.find(x => x.id === ndCurrentId);
  if (!n) { n = ndBlankNote(); notes.push(n); ndCurrentId = n.id; setActiveNoteId(n.id); maybeShowFirstTimeDataWarning(); }
  let id = null;
  if (val === "new") {
    const name = await uiPrompt({ title: "New notebook", placeholder: "Notebook name", okLabel: "Create" });
    if (!name) return;
    const nb = createNotebook(name);
    id = nb ? nb.id : null;
  } else if (val !== "none") {
    id = val;
  }
  n.notebookId = id;
  n.updatedAt = Date.now();
  setNotes(notes);
  ndRenderNotebookChip();
  if (ndSwitcherOpen) ndRenderSwitcherList();
}

/* ── anchors (verses this note is tied to) — a hover-previewable chip row on
   the read view, so a migrated verse-tied note keeps its verse connection
   visible even when the text has no explicit "> Ref" line. Each chip jumps to
   the verse; its × detaches the anchor (which also removes the verse's
   reading-view note icon). Uses the shared known-ref path (registerCiteId +
   fetchVersePreviews), never a parser. ── */
async function ndRenderAnchors() {
  const wrap = document.getElementById("ndAnchors");
  if (!wrap) return;
  const note = ndCurrentNote();
  const anchors = (note && note.anchors) || [];
  if (!anchors.length || ndEditing) { wrap.hidden = true; wrap.innerHTML = ""; return; }
  wrap.hidden = false;
  wrap.innerHTML = anchors.map(a => {
    const label = `${notesBookName(a.book)} ${a.chapter}:${a.verse}`;
    return `<span class="nd-anchor" data-book="${escAttr(a.book)}" data-ch="${a.chapter}" data-v="${a.verse}"><span class="nd-anchor-go">${escHtml(label)}</span><button type="button" class="nd-anchor-x" aria-label="Remove ${escAttr(label)} from this note" title="Remove reference">&times;</button></span>`;
  }).join("");
  const previewByRef = await fetchVersePreviews(anchors);
  const still = ndCurrentNote();
  if (!still || still.id !== note.id || ndEditing) return;
  wrap.querySelectorAll(".nd-anchor").forEach(el => {
    const key = `${el.dataset.book}.${el.dataset.ch}.${el.dataset.v}`;
    const txt = previewByRef[key];
    if (txt) {
      const id = registerCiteId(`${notesBookName(el.dataset.book)} ${el.dataset.ch}:${el.dataset.v}`, txt);
      el.setAttribute("data-cite-id", id);
    }
  });
}
function ndDetachAnchor(book, chapter, verse) {
  const notes = getNotes();
  const n = notes.find(x => x.id === ndCurrentId);
  if (!n || !n.anchors) return;
  n.anchors = n.anchors.filter(a => !(a.book === book && a.chapter === chapter && a.verse === verse));
  n.updatedAt = Date.now();
  setNotes(notes);
  ndRenderAnchors();
  if (typeof applyVerseAnnotations === "function") applyVerseAnnotations();
  if (ndSwitcherOpen) ndRenderSwitcherList();
  toast(`Removed ${notesBookName(book)} ${chapter}:${verse}`);
}

/* ── launcher ── */
function ndFirstLine(text) {
  // Skip a leading "> Ref — …" capture line so the first real sentence is what
  // names the note in the launcher / switcher, and flatten Markdown marks so
  // "### heading" doesn't show through as source.
  const lines = (text || "").split("\n").map(s => s.trim()).filter(Boolean);
  const raw = lines.find(l => !l.startsWith(">")) || lines[0] || "";
  const line = stripNoteMarkdown(raw);
  return line.length > 46 ? line.slice(0, 46).replace(/\s+\S*$/, "") + "…" : line;
}
function ndNoteLabel(note) {
  if (!note) return "New note";
  return (note.title || "").trim() || ndFirstLine(note.text) || "Untitled note";
}
function ndSyncLauncher() {
  const t = document.getElementById("notesLauncherTitle");
  if (t) t.textContent = ndNoteLabel(ndCurrentId ? ndCurrentNote() : null);
}
function ndFlashLauncher() {
  const l = document.getElementById("notesLauncher");
  if (!l || l.hidden) return;
  l.classList.remove("pulse");
  void l.offsetWidth;
  l.classList.add("pulse");
  const c = document.getElementById("notesLauncherCount");
  c.textContent = "+1";
  c.classList.add("show");
  clearTimeout(ndFlashLauncher._t);
  ndFlashLauncher._t = setTimeout(() => c.classList.remove("show"), 1900);
}

/* ── ref chip (uses /parse/citations, cached) ── */
function ndCitationCount(citations) {
  return (citations || []).filter(m => m.verse && (m.verse_end || m.verse) - m.verse + 1 <= 6).length;
}
async function ndCountRefs(note) {
  if (!note || !note.text.trim()) return 0;
  const key = note.id + ":" + note.updatedAt;
  if (ndRefCountCache.has(key)) return ndRefCountCache.get(key);
  let count = 0;
  try {
    const d = await apiJSON(`/parse/citations?text=${encodeURIComponent(note.text)}`);
    count = ndCitationCount(d.citations);
  } catch (e) { /* count is a nice-to-have; the note is fine without it */ }
  ndRefCountCache.set(key, count);
  return count;
}
async function ndRenderRefChip() {
  const chip = document.getElementById("ndRefChip");
  const note = ndCurrentNote();
  if (!note) { chip.hidden = true; return; }
  const forId = note.id;
  const n = await ndCountRefs(note);
  if (forId !== ndCurrentId) return; // switched away mid-fetch
  if (n > 0) { chip.hidden = false; chip.textContent = n === 1 ? "1 ref" : n + " refs"; }
  else chip.hidden = true;
}

/* ── switcher ── */
function ndToggleSwitcher() { ndSwitcherOpen ? ndCloseSwitcher() : ndOpenSwitcher(); }
function ndOpenSwitcher() {
  ndSwitcherOpen = true;
  document.getElementById("ndSwitcher").hidden = false;
  document.getElementById("notesDrawer").classList.add("nd-switcher-open");
  document.getElementById("ndSwitcherToggle").classList.add("on");
  // Mobile: the list takes over the whole sheet (see the .nd-switcher-open
  // rules) — pop to the full detent so there's room to browse, and skip the
  // search autofocus so the on-screen keyboard doesn't cover the list.
  if (ndIsMobile()) {
    document.documentElement.style.setProperty("--notes-drawer-h", ndSheetHeight("full") + "px");
  } else {
    setTimeout(() => document.getElementById("ndSearch").focus(), 40);
  }
  ndRenderSwitcherList();
}
function ndCloseSwitcher() {
  ndSwitcherOpen = false;
  document.getElementById("ndSwitcher").hidden = true;
  document.getElementById("notesDrawer").classList.remove("nd-switcher-open");
  document.getElementById("ndSwitcherToggle").classList.remove("on");
  if (ndIsMobile()) ndApplyStoredHeight();
}
function ndRelTime(ms) {
  if (!ms) return "";
  const diff = Date.now() - ms, min = 60000, hr = 3600000, day = 86400000;
  if (diff < 45000) return "just now";
  if (diff < hr) return Math.max(1, Math.round(diff / min)) + "m ago";
  if (diff < day) return Math.round(diff / hr) + "h ago";
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return Math.round(diff / day) + "d ago";
  return new Date(ms).toLocaleDateString();
}
function ndRenderNbFilter() {
  const row = document.getElementById("ndNbFilter");
  if (!row) return;
  const books = getNotebooks();
  const f = ndNbFilter();
  const chip = (val, label) => `<button class="nd-nbf${f === val ? " on" : ""}" data-nbf="${escAttr(val)}">${escHtml(label)}</button>`;
  if (!books.length) { row.hidden = true; row.innerHTML = ""; return; }
  row.hidden = false;
  row.innerHTML = chip("", "All") + chip("none", "Unfiled")
    + books.slice().sort((a, b) => a.name.localeCompare(b.name)).map(nb => chip(nb.id, nb.name)).join("");
}
function ndSetNbFilterAndRender(val) {
  ndSetNbFilter(val);
  ndRenderNbFilter();
  ndRenderSwitcherList();
}
async function ndRenderSwitcherList() {
  ndRenderNbFilter();
  const list = document.getElementById("ndList");
  const all = ndAllNotes();
  const q = document.getElementById("ndSearch").value.trim().toLowerCase();
  const f = ndNbFilter();
  let notes = [...all].sort((a, b) => b.updatedAt - a.updatedAt);
  if (f === "none") notes = notes.filter(n => !n.notebookId);
  else if (f) notes = notes.filter(n => n.notebookId === f);
  if (q) notes = notes.filter(n =>
    (n.title || "").toLowerCase().includes(q) || (n.text || "").toLowerCase().includes(q) || n.tags.some(t => t.includes(q)));

  if (!notes.length) {
    list.innerHTML = `<div class="nd-list-empty">${all.length
      ? "No notes match."
      : "No notes yet — start typing, or send a verse here with <strong>Note</strong> in Verse Tools."}</div>`;
    return;
  }

  const activeId = ndCurrentId;
  list.innerHTML = notes.map(n => {
    const hasTitle = !!(n.title || "").trim();
    const title = escHtml(hasTitle ? n.title.trim() : (ndFirstLine(n.text) || "Untitled note"));
    const snipSrc = hasTitle ? n.text : n.text.split("\n").slice(1).join(" ");
    const nb = n.notebookId ? notebookName(n.notebookId) : "";
    return `<div class="nd-list-item${n.id === activeId ? " active" : ""}" data-note-id="${n.id}">
        <div class="nd-li-title" data-li-title="${n.id}">${title}</div>
        <div class="nd-li-snip" data-snip="${n.id}">${escHtml(snipSrc.trim().slice(0, 160))}</div>
        <div class="nd-li-meta">${nb ? `<span class="nd-li-nb">${escHtml(nb)}</span>` : ""}<span class="nd-li-refs" data-refs="${n.id}" hidden></span><span>${escHtml(ndRelTime(n.updatedAt))}</span></div>
      </div>`;
  }).join("");

  // Per note: hover-previewable citations in the title and snippet + a ref count.
  notes.forEach(async n => {
    const titleEl = list.querySelector(`[data-li-title="${n.id}"]`);
    const tSrc = titleEl && titleEl.textContent.trim();
    if (titleEl && tSrc) { const h = await linkifyCitations(tSrc); if (titleEl.isConnected) titleEl.innerHTML = h; }
    const snip = list.querySelector(`[data-snip="${n.id}"]`);
    const src = snip && snip.textContent.trim();
    if (snip && src) { const h = await linkifyCitations(src); if (snip.isConnected) snip.innerHTML = h; }
    const refEl = list.querySelector(`[data-refs="${n.id}"]`);
    const c = await ndCountRefs(n);
    if (refEl && refEl.isConnected && c > 0) { refEl.hidden = false; refEl.textContent = c === 1 ? "1 ref" : c + " refs"; }
  });
}
function ndSelectNote(id) {
  ndFlushSave();
  setActiveNoteId(id);
  ndLoadActiveIntoEditor("read"); // picking a note is a review action — show it, don't edit it
  ndUpdateAttachButton();
  ndCloseSwitcher();
}

/* ── Verse Tools ▸ Note (target picker) + the drawer's footer button ──
   target: "new" | "current" | a note id. Appends "> Ref — text" to the note,
   records each selected verse as an anchor (so the reading-view icon shows),
   makes it active, and opens the drawer on it. ── */
function addSelectionToNote(target) {
  if (!selectedVerses.length) { toast("Select a verse first"); return; }
  const ref = selectionRefLabel();
  const body = selectionText();
  const notes = getNotes();

  let n = null;
  if (target && target !== "new" && target !== "current") n = notes.find(x => x.id === target);
  else if (target === "current") {
    n = (ndCurrentId && notes.find(x => x.id === ndCurrentId))
      || notes.find(x => x.id === getActiveNoteId())
      || [...notes].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }
  if (!n) { n = ndBlankNote(); notes.push(n); maybeShowFirstTimeDataWarning(); }

  const line = `> ${ref} — ${body}`;
  n.text = n.text.trim() ? `${n.text.replace(/\s+$/, "")}\n\n${line}\n` : `${line}\n`;
  n.anchors = n.anchors || [];
  selectedVerses.forEach(v => {
    if (!n.anchors.some(a => a.book === current.book && a.chapter === current.chapter && a.verse === v))
      n.anchors.push({ book: current.book, chapter: current.chapter, verse: v });
  });
  if (!n.version && current.version) { n.version = current.version; n.versionTitle = current.versionTitle; }
  n.updatedAt = Date.now();
  setNotes(notes);
  ndCurrentId = n.id;
  setActiveNoteId(n.id);
  if (typeof applyVerseAnnotations === "function") applyVerseAnnotations();

  const d = document.getElementById("notesDrawer");
  if (d && d.hidden) openNotesDrawer({ focus: false });
  else {
    const ed = document.getElementById("ndEditor");
    ed.value = n.text;
    ed.scrollTop = ed.scrollHeight;
    ndSetSaved(true);
    ndRenderRefChip();
    ndRenderAnchors();
    ndRefreshView(); // re-render the read view with the appended ref (no-op mid-edit)
    if (ndSwitcherOpen) ndRenderSwitcherList();
  }
  ndSyncLauncher();
  ndFlashLauncher();
  toast(`Added ${ref} to “${ndNoteLabel(n)}”`);
}
// The drawer footer "+ Attach <ref>" button — same action, current note.
function addSelectionToActiveNote() { addSelectionToNote("current"); }
// Shown only while a verse selection exists (Verse Tools is the primary path;
// this footer button is the same action from inside the drawer).
function ndUpdateAttachButton() {
  const btn = document.getElementById("ndAttachBtn");
  if (!btn) return;
  if (selectedVerses.length && current.book) {
    btn.hidden = false;
    btn.textContent = "+ Attach " + selectionRefLabel();
  } else {
    btn.hidden = true;
  }
}

/* ── sizing ──
   Desktop: free-drag the grip to any docked height, persisted as a px value.
   Mobile: the grip drags a bottom sheet between two snap detents (peek / full)
   — snap points, not free-drag, since the earlier free-drag math was a source
   of mobile bugs — and a firm drag below peek dismisses it. The chosen detent
   is persisted by name (not px) so it survives a rotation. */
function ndSheetHeight(detent) {
  const vh = window.innerHeight || 800;
  return Math.round(vh * (detent === "full" ? ND_FULL_VH : ND_PEEK_VH));
}
function ndApplyStoredHeight() {
  const root = document.documentElement.style;
  if (ndIsMobile()) {
    // Default to the full sheet on a first open; a drag to the peek detent sticks.
    root.setProperty("--notes-drawer-h", ndSheetHeight(localStorage.getItem(ND_SHEET_DETENT_KEY) || "full") + "px");
  } else {
    const storedH = localStorage.getItem(ND_HEIGHT_KEY);
    if (storedH) root.setProperty("--notes-drawer-h", storedH);
    else root.removeProperty("--notes-drawer-h");
  }
}
function ndInitResize() {
  const grip = document.getElementById("ndGrip");
  const drawer = document.getElementById("notesDrawer");
  grip.addEventListener("pointerdown", e => {
    const mobile = ndIsMobile();
    e.preventDefault();
    try { grip.setPointerCapture(e.pointerId); } catch (_) {}
    const startY = e.clientY;
    const startH = drawer.offsetHeight;
    const vh = window.innerHeight;
    if (mobile) drawer.classList.add("nd-dragging"); // kill the snap transition while tracking the finger

    const move = ev => {
      const raw = startH + (startY - ev.clientY);
      const h = mobile
        ? Math.max(90, Math.min(vh * 0.92, raw))
        : Math.max(200, Math.min(vh * 0.72, raw));
      document.documentElement.style.setProperty("--notes-drawer-h", h + "px");
    };
    const up = ev => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      if (mobile) {
        drawer.classList.remove("nd-dragging");
        const peek = ndSheetHeight("peek"), full = ndSheetHeight("full");
        const h = drawer.offsetHeight;
        if (h < peek - 60) { closeNotesDrawer(); ndApplyStoredHeight(); return; } // dragged down past peek = dismiss
        const detent = h < (peek + full) / 2 ? "peek" : "full";
        localStorage.setItem(ND_SHEET_DETENT_KEY, detent);
        document.documentElement.style.setProperty("--notes-drawer-h", ndSheetHeight(detent) + "px");
        return;
      }
      localStorage.setItem(ND_HEIGHT_KEY, getComputedStyle(document.documentElement).getPropertyValue("--notes-drawer-h").trim());
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  });
}

// On mobile the launcher is a slim pull-tab (css/styles.css) — a short
// upward swipe on it opens the drawer, the same as a tap. A real drag past
// ~24px suppresses the browser's synthetic click, so this and the tab's
// onclick stay mutually exclusive.
function ndInitLauncherSwipe() {
  const l = document.getElementById("notesLauncher");
  if (!l) return;
  let sy = 0, sx = 0, tracking = false;
  l.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) { tracking = false; return; }
    sy = e.touches[0].clientY; sx = e.touches[0].clientX; tracking = true;
  }, { passive: true });
  l.addEventListener("touchend", e => {
    if (!tracking) return;
    tracking = false;
    const dy = e.changedTouches[0].clientY - sy;
    const dx = Math.abs(e.changedTouches[0].clientX - sx);
    if (dy < -24 && dx < 50 && document.getElementById("notesDrawer").hidden) openNotesDrawer();
  }, { passive: true });
}

/* ── init / wiring ── */
function initNotesDrawer() {
  ndApplyStoredHeight();

  const ndEd = document.getElementById("ndEditor");
  ndEd.addEventListener("input", ndOnEditInput);
  ndEd.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === "b") { e.preventDefault(); ndFmt("bold"); }
      else if (k === "i") { e.preventDefault(); ndFmt("italic"); }
    }
  });
  const ndTb = document.getElementById("ndToolbar");
  ndTb.addEventListener("mousedown", e => { if (e.target.closest("[data-fmt]")) e.preventDefault(); }); // keep the caret in the textarea
  ndTb.addEventListener("click", e => {
    const b = e.target.closest("[data-fmt]");
    if (b) ndFmt(b.dataset.fmt);
  });
  const preview = document.getElementById("ndPreview");
  // Clicking the read text is a shortcut into edit mode, cursor dropped where
  // you clicked. preventDefault stops the browser's own focus handling on the
  // (about-to-be-hidden) read view from fighting the ed.focus() call. A click
  // on a .citelink falls through untouched so the shared hover/preview still
  // works there. The click-point offset is character-exact only when the render
  // kept every source character (plain single-paragraph text); once Markdown
  // (or a line break) is in play, fall back to the clicked block's data-sl —
  // the caret lands at the start of that source line.
  preview.addEventListener("mousedown", e => {
    if (e.target.closest("[data-cite-id]")) return;
    e.preventDefault();
    let caret;
    if (preview.textContent === (preview.dataset.src || "")) {
      caret = ndCaretOffsetFromPoint(preview, e.clientX, e.clientY);
      // offset 0 on a scrolled note is a mis-hit on the top padding, not a
      // real click at the start — drop it so the view doesn't snap up.
      if (caret === 0 && preview.scrollTop > 4) caret = null;
    } else {
      caret = ndBlockSrcOffset(preview, e.clientX, e.clientY);
    }
    ndEnterEdit({ keepScroll: true, caret });
  });
  // Typing while the read view holds focus (Tab landed there, say) is also
  // taken as "start editing"; a printable key is carried into the text box so
  // it isn't swallowed. Esc/Tab pass through to the drawer's own handlers.
  preview.addEventListener("keydown", e => {
    if (e.key === "Tab" || e.key === "Escape" || e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation(); // keep a bare letter off the global "N" toggle
    const printable = e.key.length === 1;
    ndEnterEdit();
    if (printable) {
      e.preventDefault();
      const ed = document.getElementById("ndEditor");
      ed.setRangeText(e.key, ed.selectionStart, ed.selectionEnd, "end");
      ndOnEditInput();
    }
  });
  document.getElementById("ndTitle").addEventListener("input", ndOnEditInput);
  document.getElementById("ndTitle").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); ndEnterEdit(); }
  });

  const tagInput = document.getElementById("ndTagInput");
  tagInput.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); ndAddTag(tagInput.value); tagInput.value = ""; }
    else if (e.key === "Backspace" && !tagInput.value) {
      const n = ndCurrentNote();
      if (n && n.tags.length) ndRemoveTag(n.tags[n.tags.length - 1]);
    }
  });
  tagInput.addEventListener("blur", () => { if (tagInput.value.trim()) { ndAddTag(tagInput.value); tagInput.value = ""; } });
  document.getElementById("ndTags").addEventListener("click", e => {
    const b = e.target.closest("button[data-tag]");
    if (b) ndRemoveTag(b.dataset.tag);
  });

  document.getElementById("ndSearch").addEventListener("input", () => {
    clearTimeout(ndSearchTimer);
    ndSearchTimer = setTimeout(ndRenderSwitcherList, 170);
  });
  document.getElementById("ndList").addEventListener("click", e => {
    const item = e.target.closest(".nd-list-item");
    if (item) ndSelectNote(item.dataset.noteId);
  });
  const nbFilter = document.getElementById("ndNbFilter");
  if (nbFilter) nbFilter.addEventListener("click", e => {
    const b = e.target.closest("[data-nbf]");
    if (b) ndSetNbFilterAndRender(b.dataset.nbf);
  });

  // Notebook selector (footer chip + its popover menu)
  const nbBtn = document.getElementById("ndNotebookBtn");
  if (nbBtn) nbBtn.addEventListener("click", e => { e.stopPropagation(); ndToggleNotebookMenu(); });
  const nbMenu = document.getElementById("ndNotebookMenu");
  if (nbMenu) nbMenu.addEventListener("click", e => {
    const o = e.target.closest("[data-nb]");
    if (o) ndSetNotebook(o.dataset.nb);
  });
  document.addEventListener("click", e => {
    if (nbMenu && !nbMenu.hidden && !e.target.closest("#ndNotebookMenu") && !e.target.closest("#ndNotebookBtn")) nbMenu.hidden = true;
  });

  // Anchor chips on the read view jump to the verse (hover-preview is wired
  // generically off [data-cite-id] elsewhere).
  const anchorRow = document.getElementById("ndAnchors");
  if (anchorRow) anchorRow.addEventListener("click", e => {
    const chip = e.target.closest(".nd-anchor");
    if (!chip) return;
    if (e.target.closest(".nd-anchor-x")) {
      ndDetachAnchor(chip.dataset.book, Number(chip.dataset.ch), Number(chip.dataset.v));
    } else {
      // Going to the verse — get the drawer out of the way so it isn't
      // covering the passage you asked to see (the launcher pill still holds
      // the note, one tap to reopen).
      closeNotesDrawer();
      jumpToVerse(chip.dataset.book, Number(chip.dataset.ch), Number(chip.dataset.v));
    }
  });

  ndInitResize();
  ndInitLauncherSwipe();

  document.addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable || e.target.id === "ndPreview");
    const modalOpen = document.querySelector(".modalscrim.show, #keyBanner.show");
    if ((e.key === "n" || e.key === "N") && !typing && !modalOpen && !e.defaultPrevented && !(typeof tourActive !== "undefined" && tourActive)) {
      e.preventDefault();
      toggleNotesDrawer();
      return;
    }
    if (e.key === "Escape") {
      const d = document.getElementById("notesDrawer");
      if (d && !d.hidden) {
        if (ndSwitcherOpen) ndCloseSwitcher();
        else if (ndEditing && document.getElementById("ndEditor").value.trim()) { ndFlushSave(); ndEnterRead(); } // out of edit, back to the readable view
        else closeNotesDrawer();
        e.stopImmediatePropagation(); // don't also bounce the main view to Read
      }
    }
  });

  ndSyncLauncher();
  document.getElementById("notesLauncher").hidden = false;
}

// Gated the same way the rest of the app is: with no key set (and not the
// hosted instance) init() never loads a chapter, so there's nothing to note
// against yet — saveSettings() reloads the page once a key is added.
if (IS_HOSTED_INSTANCE || getApiKey()) initNotesDrawer();
