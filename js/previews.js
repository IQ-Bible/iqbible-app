/* ═══════════════════════════════════════════════════════════════════════
   VERSE PREVIEWS — the shared floating tooltip and the citation-preview
   helpers (linkifyCitations, linkifyPreParsedCitations, registerCiteId,
   citelinkHTML, fetchVersePreviews). Split out of reader.js so a page that
   doesn't load the reader (Scroll the Bible, /scroll/) can still make every
   verse reference hover/tap-previewable, per the app's citation rule — one
   implementation, never a copy. Needs api.js (apiJSON, escHtml, current) and
   an element #dictTooltip.dict-tooltip in the page. The dictionary-term
   tooltip (showDictTooltip) stays in reader.js; showRefPreview only calls it
   when it exists. */
// Shared by both the dictionary-term tooltip and the citation-preview
// tooltip below (linkifyCitations) — one floating element, positioned above
// whatever's hovered (or below, if there's no room above).
let _tipShownAt = 0; // when the preview last opened — see the click handler below
function showFloatingTooltip(el, html) {
  _tipShownAt = Date.now();
  const tip = document.getElementById("dictTooltip");
  tip.innerHTML = html;
  tip.style.left = "-9999px"; tip.style.top = "-9999px";
  tip.classList.add("show");
  const r = el.getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - 8));
  let top = r.top - th - 10;
  if (top < 8) top = r.bottom + 10;
  tip.style.left = left + "px";
  tip.style.top = top + "px";
}
let _tipHideTimer = null;
let _tipOwner = null; // the element the tooltip is currently describing
function _tipCancelHide() { if (_tipHideTimer) { clearTimeout(_tipHideTimer); _tipHideTimer = null; } }
function _tipScheduleHide() { _tipCancelHide(); _tipHideTimer = setTimeout(hideFloatingTooltip, 200); }
function hideFloatingTooltip() {
  _tipCancelHide();
  document.getElementById("dictTooltip").classList.remove("show");
  if (_tipOwner) { if (_tipOwner.hasAttribute("aria-expanded")) _tipOwner.setAttribute("aria-expanded", "false"); _tipOwner = null; }
}

// [data-cite-id] rather than .citelink specifically — decouples the hover
// mechanic from that one visual style, so it can be reused on differently-
// styled elements too (e.g. the pill-button cross-reference list in Verse
// Tools, which needs its own button look, not a dotted-underline citelink).
// Hover OR keyboard focus shows the preview (CLAUDE.md's citation rule +
// WCAG 1.4.13 / 2.1.1). A short close delay — cancelled if the pointer moves
// onto the tooltip itself — keeps it hoverable; Escape dismisses it (main.js).
function showRefPreview(target) {
  _tipCancelHide();
  const cite = target.closest("[data-cite-id]");
  if (cite && cite.dataset.citeId) {
    const d = citePreviewData.get(cite.dataset.citeId);
    if (d) { showFloatingTooltip(cite, `<div class="dt-term">${escHtml(d.ref)}</div>${escHtml(d.preview)}`); _tipOwner = cite; if (cite.hasAttribute("aria-expanded")) cite.setAttribute("aria-expanded", "true"); }
    return;
  }
  const dt = target.closest(".dict-term");
  if (dt && typeof showDictTooltip === "function") { showDictTooltip(dt); _tipOwner = dt; }
}
// Click / Enter on a citation button toggles its preview (touch + keyboard).
// A touch tap makes the browser fire a compatibility mouseover just before the
// click, which has already opened the preview — without the time check, that
// click would read "already open" and close it again, so the first tap showed
// nothing and only the second one did. A click within CITE_TAP_GRACE_MS of the
// preview opening keeps it open; a later click closes it.
const CITE_TAP_GRACE_MS = 600;
document.addEventListener("click", e => {
  const cite = e.target.closest("button.citelink[data-cite-id]");
  if (!cite) return;
  if (cite.getAttribute("aria-expanded") === "true" && Date.now() - _tipShownAt > CITE_TAP_GRACE_MS) hideFloatingTooltip();
  else showRefPreview(cite);
});
document.addEventListener("mouseover", e => {
  const t = e.target.closest("[data-cite-id], .dict-term");
  if (t) showRefPreview(t);
});
// On a touch screen there's no pointer to move away, but the browser still sends
// compatibility mouse events (including a mouseout) right after a tap, which
// would close a preview the tap just opened. So after a touch, mouseout is
// ignored and a touch anywhere else closes the preview instead.
let _tipTouchAt = 0;
document.addEventListener("touchstart", e => {
  _tipTouchAt = Date.now();
  if (!e.target.closest("[data-cite-id], .dict-term, #dictTooltip")) hideFloatingTooltip();
}, { passive: true });
document.addEventListener("mouseout", e => {
  if (Date.now() - _tipTouchAt < 1000) return;
  if (e.target.closest("[data-cite-id], .dict-term")) _tipScheduleHide();
});
document.addEventListener("focusin", e => {
  const t = e.target.closest("[data-cite-id], .dict-term");
  if (t) showRefPreview(t);
  else if (!e.target.closest("#dictTooltip")) hideFloatingTooltip();
});
document.addEventListener("focusout", e => {
  if (e.target.closest("[data-cite-id], .dict-term")) _tipScheduleHide();
});
(function () {
  const tip = document.getElementById("dictTooltip");
  if (!tip) return;
  tip.addEventListener("mouseenter", _tipCancelHide);
  tip.addEventListener("mouseleave", _tipScheduleHide);
})();

/* ── citation preview — the general "any prose from the API may contain
   Scripture references" requirement (see CLAUDE.md's development rules).
   linkifyCitations(text) sends plain text through GET /parse/citations
   (?hydrate=true fetches each match's verse text in the same call, no
   per-citation round trip) and returns escaped HTML with every citation
   wrapped in a hoverable .citelink. Preview data is kept in a side map
   rather than a data-* attribute so verse text containing a literal quote
   character can't break out of an HTML attribute. ── */
const citePreviewData = new Map();
let citePreviewSeq = 0;
// A citation spanning many verses (John 3:1-10) still gets a hover preview
// (#257) — but the popup shows only the opening verses with a "+N more" tail,
// not the whole passage, which stops being a glanceable "check this verse"
// aid. Past CITE_LINK_MAX_VERSES in one citation it's left as plain text —
// too broad to preview usefully at all.
const CITE_PREVIEW_MAX_VERSES = 4;
const CITE_LINK_MAX_VERSES = 40;
function rangePreviewText(verseTexts, totalCount) {
  const total = totalCount || verseTexts.length;
  let shown = verseTexts.slice(0, CITE_PREVIEW_MAX_VERSES).join(" ").trim();
  // Keep room for the "+N more" tail inside registerCiteId's own length cap.
  if (shown.length > 240) shown = shown.slice(0, 240).replace(/\s+\S*$/, "") + "…";
  const more = total - Math.min(verseTexts.length, CITE_PREVIEW_MAX_VERSES);
  return more > 0 ? `${shown} [+${more} more ${more === 1 ? "verse" : "verses"}]` : shown;
}
// Shared by every hover-preview call site regardless of how it learned the
// ref/text — a citation parsed out of prose (linkifyCitations), a reference
// resolved lazily on hover (Timeline), or a reference that was already
// known structurally and just needed its text (fetchVersePreviews below).
// Registering here is what makes the generic [data-cite-id] mouseover
// listener show a tooltip for that element — see CLAUDE.md's citation rule.
function registerCiteId(ref, previewText) {
  const preview = previewText.length > 320 ? previewText.slice(0, 320).replace(/\s+\S*$/, "") + "…" : previewText;
  const id = "cp" + (++citePreviewSeq);
  citePreviewData.set(id, { ref, preview });
  return id;
}
// The one place a .citelink span is built. Focusable + self-describing: the
// aria-label carries the reference and its verse text, so a keyboard/screen-
// reader user gets the preview straight from the element without depending on
// the pointer-positioned tooltip. `raw` is the citation as it appeared in the
// prose. Not role="link" — a citelink previews, it doesn't navigate.
function citelinkHTML(raw, ref, previewText, id) {
  // A <button> (not a styled span): activating it toggles the preview — which
  // makes it work on touch too, not just hover/focus — and the aria-label
  // carries the reference + verse text so a screen reader needs no popup.
  const label = escAttr(((ref ? ref + ": " : "") + (previewText || "")).slice(0, 400));
  return `<button type="button" class="citelink" aria-label="${label}" aria-expanded="false" data-cite-id="${id}">${escHtml(raw)}</button>`;
}
async function linkifyCitations(text, version) {
  if (!text || !text.trim()) return escHtml(text || "");
  // Hydrate against a caller-supplied version (a note's own translation —
  // see notePreviewVersion), else the one being read, never the endpoint's
  // eng_kjv default: otherwise a preview shows KJV text under a reader on
  // another translation. Deuterocanonical citations — the book name spelled
  // out ("1 Maccabees 1:1", "Sirach 2:4") as well as the USFM code, and the
  // extra-chapter cases ("Daniel 14:1") — now resolve too: the endpoint
  // detects the names and auto-falls-back to an apocrypha-carrying version
  // for the text (API beta-44/45), so nothing special is needed here.
  version = version || current.version;
  // The endpoint scans ~8 KB per call and returns next_offset to resume
  // (beta-44) — loop for a long note/definition so citations past the first
  // window aren't lost. start/end are absolute once ?offset= is passed;
  // dedupe by start across the overlapping seam.
  let matches = [];
  try {
    let offset = 0;
    for (let i = 0; i < 9; i++) {
      const chunk = offset ? text.slice(offset) : text;
      const url = `/parse/citations?text=${encodeURIComponent(chunk)}&hydrate=true&version=${encodeURIComponent(version)}${offset ? `&offset=${offset}` : ""}`;
      const d = await apiJSON(url);
      (d.citations || []).forEach(m => {
        const s = typeof m.start === "number" ? m.start : 0;
        if (!matches.some(x => (typeof x.start === "number" ? x.start : 0) === s)) matches.push(m);
      });
      if (typeof d.next_offset !== "number") break;
      offset = d.next_offset;
    }
  } catch (e) { return escHtml(text); }
  matches.sort((a, b) => (typeof a.start === "number" ? a.start : 0) - (typeof b.start === "number" ? b.start : 0));
  if (!matches.length) return escHtml(text);

  let html = "";
  let last = 0;
  matches.forEach(m => {
    // start is omitted from the response when it's 0 (Go omitempty), i.e. a
    // citation that opens the string — treat a missing start as 0, the same
    // way linkifyPreParsedCitations does. Without this, a note/definition/
    // heading that begins with a reference silently loses its hover link.
    const start = typeof m.start === "number" ? m.start : 0;
    if (start < last) return;
    const verses = m.data || [];
    // A bare "Book chapter" match (no verse) has nothing to preview; a very
    // wide range (past CITE_LINK_MAX_VERSES) is left as plain text. Everything
    // in between links, with the preview truncated to the opening verses.
    if (!m.verse || !verses.length || verses.length > CITE_LINK_MAX_VERSES) return;
    html += escHtml(text.slice(last, start));
    const verseText = rangePreviewText(verses.map(v => v.text), verses.length);
    const ref = `${m.name_en} ${m.chapter}:${m.verse}${m.verse_end ? "-" + m.verse_end : ""}`;
    const id = registerCiteId(ref, verseText);
    html += citelinkHTML(m.raw, ref, verseText, id);
    last = m.end;
  });
  html += escHtml(text.slice(last));
  return html;
}

// Commentary, dictionary, bible-character definition and devotional-reading
// responses already carry a server-parsed `citations` array over their own
// prose (same scanCitations engine /parse/citations uses, run once at fetch
// time) — reusing it here means never re-sending that prose through
// /parse/citations, which both avoids a redundant call and sidesteps the
// windowing/length handling for long-form text. Unlike linkifyCitations,
// hydration isn't included server-side for these, so verse text is fetched
// here via the same batched fetchVersePreviews() every other "ref already
// known" call site uses.
async function linkifyPreParsedCitations(text, citations) {
  if (!text) return escHtml(text || "");
  // Same "too wide to preview usefully" cutoff linkifyCitations applies,
  // plus a bare chapter-only match (no m.verse) has nothing to preview.
  const matches = (citations || []).filter(m => m.verse && (m.verse_end || m.verse) - m.verse + 1 <= CITE_LINK_MAX_VERSES);
  if (!matches.length) return escHtml(text);

  // Only the opening verses of each range are previewed, so only those need
  // fetching — a 30-verse citation shouldn't pull 30 verses to show 4.
  const refs = [];
  const seen = new Set();
  const previewEnd = m => Math.min(m.verse_end || m.verse, m.verse + CITE_PREVIEW_MAX_VERSES - 1);
  matches.forEach(m => {
    for (let v = m.verse; v <= previewEnd(m); v++) {
      const key = `${m.book}.${m.chapter}.${v}`;
      if (!seen.has(key)) { seen.add(key); refs.push({ book: m.book, chapter: m.chapter, verse: v }); }
    }
  });
  const previewByRef = await fetchVersePreviews(refs);

  let html = "";
  let last = 0;
  matches.forEach(m => {
    const start = m.start || 0;
    if (start < last) return;
    const verseTexts = [];
    for (let v = m.verse; v <= previewEnd(m); v++) {
      const t = previewByRef[`${m.book}.${m.chapter}.${v}`];
      if (t) verseTexts.push(t);
    }
    if (!verseTexts.length) return;
    html += escHtml(text.slice(last, start));
    const ref = `${m.name_en} ${m.chapter}:${m.verse}${m.verse_end ? "-" + m.verse_end : ""}`;
    const joined = rangePreviewText(verseTexts, (m.verse_end || m.verse) - m.verse + 1);
    const id = registerCiteId(ref, joined);
    html += citelinkHTML(m.raw, ref, joined, id);
    last = m.end;
  });
  html += escHtml(text.slice(last));
  return html;
}
// Batched preview-text fetch for a list of *already-known* {book,chapter,
// verse} refs — one GET /bibles/{version}/verses?refs=... call regardless
// of list size (the same BatchVerses endpoint/zip-against-not_found pattern
// showCrossRefsTool and the Bookmarks/Highlights browser tabs all need), so
// every "I already know the ref, I just need its text" call site shares one
// implementation instead of each reinventing it. Returns a map keyed by
// "book.chapter.verse" -> verse text (missing entries just get no preview).
// `version` defaults to what's being read, but a caller with refs from a
// different translation (a note anchor captured in another version — a
// deuterocanonical verse especially) passes that version so the preview
// still resolves while the reader is elsewhere.
async function fetchVersePreviews(refs, version) {
  if (!refs.length) return {};
  version = version || current.version;
  const refStrings = refs.map(r => `${r.book}.${r.chapter}.${r.verse}`);
  const out = {};
  let notFound = [];
  try {
    const bd = await apiJSONCached(`/bibles/${version}/verses?refs=${refStrings.join(",")}`);
    notFound = bd.not_found || [];
    const nf = new Set(notFound);
    refStrings.filter(r => !nf.has(r)).forEach((r, i) => { if (bd.data[i]) out[r] = bd.data[i].text; });
  } catch (e) { /* preview text is a nice-to-have; refs still work without it */ }
  // A deuterocanonical ref (1 Maccabees, Sirach…) won't resolve against a
  // 66-book reading version — GET /bibles/{version}/verses has no cross-canon
  // fallback the way GET /parse/citations does (#265, gap logged in NOTES.md).
  // Retry exactly the refs the batch call dropped through the citation
  // resolver, which auto-falls-back to an apocrypha-carrying edition. One
  // extra call, only when something was unresolved.
  if (notFound.length) {
    try {
      const asText = notFound.map(r => r.replace(/\.(\d+)\.(\d+)$/, " $1:$2")).join("; ");
      const d = await apiJSONCached(`/parse/citations?text=${encodeURIComponent(asText)}&hydrate=true&version=${encodeURIComponent(version)}`);
      (d.citations || []).forEach(c => {
        const first = c.verse, end = c.verse_end || c.verse;
        (c.data || []).forEach(v => {
          const vn = v.verse_number ?? v.verse;
          if (vn >= first && vn <= end) out[`${c.book}.${c.chapter}.${vn}`] = v.text;
        });
      });
    } catch (e) { /* still just a nice-to-have */ }
  }
  return out;
}
