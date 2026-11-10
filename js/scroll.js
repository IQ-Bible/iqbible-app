/* ═══════════════════════════════════════════════════════════════════════
   SCROLL THE BIBLE (/scroll/) — one verse per full-screen card, read by
   scrolling. A deliberately separate entry from the main app: it loads only
   config.js / api.js / readstate.js / catalog.js / share.js (shared state, auth,
   read progress, version + book lists, the share-image helpers) and none of the reader, so it carries none of the reader's one-chapter-on-
   screen assumptions. Chapters are fetched one call each and cut into cards;
   they're appended as you near the end and prepended as you near the top.

   A chapter's last verse offers a "Take a quiz" button when the API has questions
   for it; the quiz itself is js/quiz.js, shared with the reader (see quizHost, further down).

   Bookmarks and highlights live in the same localStorage keys as the main app
   (same origin), so what you mark here shows up in My Library there. The
   helpers below re-read/write that format rather than loading reader.js. */

const SC_POS_KEY = "iqb_scroll_pos";
const SC_FONT_KEY = "iqb_scroll_font_size";
const SC_HL_COLORS = ["yellow", "green", "blue", "pink"];
const SC_HL_SWATCH = { yellow: "#eab308", green: "#22c55e", blue: "#3b82f6", pink: "#ec4899" };
const SC_MIN_FONT = 15;           // the floor a long verse is shrunk to so it still fits one screen
let scBaseFont = 30;              // the reader's chosen size (Display > Text size)
const SC_BOOKMARK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg>`;
const SC_PLAY_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>`;
const SC_PAUSE_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;

const scById = id => document.getElementById(id);
const scFeed = scById("scFeed");
const sc = {
  first: null, last: null,       // {book, bookName, chapter} at each end of what's loaded
  atStart: false, atEnd: false,
  loadingNext: false, loadingPrev: false, retryAt: 0,
  cur: null,                     // the card on screen
  gen: 0,                        // bumped on every full reload so stale async work drops itself
};

/* ── annotations (same keys/shapes as js/reader.js) ── */
const scKey = (b, c, v) => `${b}:${c}:${v}`;
function scRead(key) { try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { return {}; } }
function scWrite(key, m) { localStorage.setItem(key, JSON.stringify(m)); }
function scHighlightOf(k) { const h = scRead("iqb_highlights")[k]; return h ? (typeof h === "string" ? h : h.color) : null; }
function scIsBookmarked(k) { return !!scRead("iqb_bookmarks")[k]; }
const scGroupId = () => "g_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ── building cards ── */
function scTitleCard(ref, count) {
  const s = document.createElement("section");
  s.className = "sc-card sc-title";
  Object.assign(s.dataset, { book: ref.book, bookName: ref.bookName, chapter: ref.chapter, verse: 0, count });
  s.setAttribute("aria-label", `${ref.bookName} ${ref.chapter}`);
  s.innerHTML = `<div class="sc-body"><div class="sc-eyebrow">Chapter ${ref.chapter}</div>
    <h2 class="sc-title-h">${escHtml(ref.bookName)} ${ref.chapter}</h2>
    <div class="sc-sub">${count} verse${count === 1 ? "" : "s"}</div>
    <div class="sc-readstamp" hidden></div>
    <div class="sc-hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>Scroll to read</div>
    <div class="sc-tip">Tap a verse to copy it · double-tap to bookmark it</div></div>`;
  scPaintReadStamp(s);
  return s;
}
// The "Read on …" line on a chapter's title card, as in the reader (same Settings
// toggle, same iqb_progress), plus the chapter's best quiz score.
const SC_CHECK_SVG = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5l4 4 8-9.5"/></svg>`;
function scPaintReadStamp(card) {
  const el = card.querySelector(".sc-readstamp");
  if (!el) return;
  const d = card.dataset, ts = getReadStampEnabled() ? getProgress()[`${d.book}.${d.chapter}`] : null;
  if (!ts) { el.hidden = true; el.innerHTML = ""; return; }
  const best = quizBestLabel(d.book, +d.chapter);
  el.hidden = false;
  el.innerHTML = `${SC_CHECK_SVG}<span>${escHtml(typeof ts === "number" ? formatReadStamp(ts) : "Read")}</span>`
    + (best ? `<span aria-hidden="true">·</span><span class="sc-quizbest">Quiz best ${escHtml(best)}</span>` : "");
}
function scRepaintReadStamp(book, chapter) {
  const c = scFeed.querySelector(`.sc-title[data-book="${book}"][data-chapter="${chapter}"]`);
  if (c) scPaintReadStamp(c);
}
function scVerseCard(ref, n, text, count) {
  const s = document.createElement("section");
  s.className = "sc-card";
  Object.assign(s.dataset, { book: ref.book, bookName: ref.bookName, chapter: ref.chapter, verse: n, count });
  s.setAttribute("aria-label", `${ref.bookName} ${ref.chapter}:${n}`);
  // ¶ is a paragraph marker some editions carry inside the verse text; a card has no paragraphs.
  const clean = (text || "").replace(/¶\s*/g, "");
  s.innerHTML = `<div class="sc-body"><p class="sc-verse"><span class="sc-vt">${escHtml(clean)}</span></p>
    <div class="sc-refrow"><span class="sc-ref">${escHtml(ref.bookName)} ${ref.chapter}:${n}</span><span class="sc-badges"></span></div></div>`;
  scPaintCard(s);
  return s;
}
function scPaintCard(card) {
  const vt = card.querySelector(".sc-vt");
  if (!vt) return;
  const k = scKey(card.dataset.book, card.dataset.chapter, card.dataset.verse);
  const color = scHighlightOf(k);
  SC_HL_COLORS.forEach(c => vt.classList.remove("hl-" + c));
  if (SC_HL_COLORS.includes(color)) vt.classList.add("hl-" + color);
  card.querySelector(".sc-badges").innerHTML = scIsBookmarked(k) ? SC_BOOKMARK_SVG : "";
}
function scCardsFor(ref, verses) {
  const frag = document.createDocumentFragment();
  const entries = verses.map(v => ({ n: v.verse_number ?? v.verse, text: v.text }));
  frag.appendChild(scTitleCard(ref, entries.length));
  entries.forEach((e, i) => {
    const card = scVerseCard(ref, e.n, e.text, entries.length);
    // Flagged here rather than inferred from the verse number, which a version can skip or number oddly.
    if (i === entries.length - 1) card.dataset.last = "1";
    frag.appendChild(card);
  });
  frag.querySelectorAll(".sc-card").forEach(c => scObserver.observe(c));
  return frag;
}
// Puts a built fragment into the feed (via `place`) and then fits its cards to
// one screen — so a caller that measures positions afterwards sees final heights.
function scAddCards(frag, place) {
  const cards = [...frag.children];
  place(frag);
  scFitCards(cards);
}

/* ── one card = one screen ── */
// A card is min-height one screen, so a long verse used to grow past it and the
// snap points (card tops) put the rest of its text off-screen: cut off at the
// bottom going down, and its top hidden coming back up. Shrink such a verse's
// text (or a heading), a pixel at a time, until the card is exactly one screen again (the
// padding already keeps clear of the top bar and the bottom overlay). The
// floor is SC_MIN_FONT; below that a verse is left to overflow rather than
// become unreadable.
function scFitCards(cards) {
  const vh = scFeed.clientHeight;
  if (!vh) return;
  const fitEl = c => c.querySelector(".sc-verse, .sc-title-h"); // verse text, else the chapter title card's heading
  cards.forEach(c => { const p = fitEl(c); if (p && p.style.fontSize) p.style.fontSize = ""; });
  cards.filter(c => c.offsetHeight > vh + 1).forEach(c => {
    const p = fitEl(c);
    if (!p) return;
    let px = parseFloat(getComputedStyle(p).fontSize);
    while (px > SC_MIN_FONT && c.offsetHeight > vh + 1) { px -= 1; p.style.fontSize = px + "px"; }
  });
}
let scFitTimer = 0;
// Everything already in the feed, after the size, the viewport or the web font changes.
function scFitAllSoon(delay = 0) {
  clearTimeout(scFitTimer);
  scFitTimer = setTimeout(() => scFitCards([...scFeed.querySelectorAll(".sc-card")]), delay);
}
new ResizeObserver(() => scFitAllSoon(120)).observe(scFeed);
if (document.fonts) document.fonts.addEventListener("loadingdone", () => scFitAllSoon(0));
function scMessageCard(html) {
  const s = document.createElement("section");
  s.className = "sc-card sc-msg";
  s.innerHTML = `<div class="sc-body">${html}</div>`;
  return s;
}

/* ── which card is on screen ── */
// A card counts as current while it crosses the middle band of the feed.
const scObserver = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) scSetCurrent(e.target); });
}, { root: scFeed, rootMargin: "-45% 0px -45% 0px", threshold: 0 });

function scSetCurrent(card) {
  const prev = sc.cur;
  sc.cur = card;
  scSyncUI();
  scSavePos();
  scCountRead(card, prev);
}

/* ── counting a chapter as read ── */
// A chapter counts as read when the reader reaches its last verse, or moves on
// from it into the next chapter (which also covers a quick scroll that never
// lands on the last verse's card) — but only if they scrolled through it:
// scStarted holds the chapters whose opening card (the title, or verse 1) has
// been on screen this session, so landing on a last verse by a jump, a ?ref=
// link or an Explain cross-reference doesn't count. A one-verse chapter has no
// verse 1 to scroll past, so only its title card starts it. `prev` is the card
// that was current before this one: only a forward move from the previous chapter
// into a title card counts, never scrolling back up to one (or a fresh jump, where
// sc.cur was cleared).
const scStarted = new Set();
function scCountRead(card, prev) {
  const d = card.dataset;
  const key = `${d.book}.${d.chapter}`;
  if (+d.verse === 0 || (+d.verse === 1 && +d.count > 1)) scStarted.add(key);
  if (d.last && scStarted.has(key)) scMarkRead(d.book, +d.chapter);
  const p = prev && prev.dataset;
  if (+d.verse === 0 && p && p.book && (p.book !== d.book || p.chapter !== d.chapter) && scStarted.has(`${p.book}.${p.chapter}`)) {
    scMarkRead(p.book, +p.chapter);
  }
}
// Finishing a plan day gets its milestone toast; a plain mark gets a short one
// so the reader knows it was counted. `quiet` (the quiz) skips that one — its
// results screen already says so.
function scMarkRead(book, chapter, quiet) {
  const r = recordChapterRead(book, chapter);
  if (!r) return false;
  scRepaintReadStamp(book, chapter);
  if (r.dayComplete) toast(`Day ${r.dayMatch} marked complete!`);
  else if (!quiet) {
    const b = bookList.find(x => x.usfm === book);
    toast(`${b ? b.name + " " : ""}${chapter} added to your Progress`);
  }
  return true;
}
function scSyncUI() {
  const card = sc.cur;
  if (!card) return;
  const d = card.dataset, verse = +d.verse, count = +d.count;
  scById("scChipText").textContent = `${d.bookName} ${d.chapter}`;
  // The accessible name has to contain the visible text (WCAG 2.5.3), so the
  // action rides after it rather than replacing it.
  scById("scChip").setAttribute("aria-label", `${d.bookName} ${d.chapter}, jump to a book and chapter`);
  const pct = count ? Math.round((verse / count) * 100) : 0;
  scById("scProgressBar").style.width = pct + "%";
  scById("scProgressTrack").setAttribute("aria-valuenow", pct);
  scById("scProgressLabel").textContent = verse ? `${verse} of ${count}` : `${count} verses`;
  scSyncPeek(card);
  // Verse tools need a verse; the chapter title card has none (Listen still works — it's per chapter).
  const isVerse = verse > 0;
  const k = scKey(d.book, d.chapter, d.verse);
  const bm = scById("scBtnBookmark"), hl = scById("scBtnHighlight");
  bm.disabled = hl.disabled = scById("scBtnShare").disabled = scById("scBtnExplain").disabled = !isVerse;
  const marked = isVerse && scIsBookmarked(k);
  bm.setAttribute("aria-pressed", marked ? "true" : "false");
  bm.setAttribute("aria-label", marked ? "Remove bookmark from this verse" : "Bookmark this verse");
  const color = isVerse ? scHighlightOf(k) : null;
  hl.classList.toggle("has-hl", SC_HL_COLORS.includes(color));
  if (SC_HL_COLORS.includes(color)) {
    hl.style.setProperty("--hl-ring", SC_HL_SWATCH[color]);
    hl.style.setProperty("--hl-bg", SC_HL_SWATCH[color] + "33");
  }
  scById("scPageLink").href = `/${d.book.toLowerCase()}/${d.chapter}${isVerse ? "/" + verse : ""}?v=${encodeURIComponent(current.version)}`;
  scSyncAudioButton();
}
// The strip above the progress bar: the next verse's text, or — on a chapter's
// last verse of a chapter that has questions — a real button that opens the quiz.
function scSyncPeek(card) {
  const next = card.nextElementSibling;
  const peek = scById("scPeek"), btn = scById("scQuizPrompt");
  const o = card.dataset.last ? quizOffer(card.dataset.book, +card.dataset.chapter) : null;
  if (o) {
    const rec = quizBestFor(card.dataset.book, +card.dataset.chapter);
    btn.innerHTML = `${QUIZ_ICON}<span class="sc-qp-text"><span class="sc-qp-main">${rec ? "Retake the quiz" : "Take a quiz"}</span><span class="sc-qp-sub">${escHtml(quizCountText(o))}${rec ? ` · best ${rec.best}/${rec.bestOf}` : ""}</span></span>`;
    btn.hidden = false;
    peek.hidden = true;
    peek.textContent = "";
    return;
  }
  btn.hidden = true;
  peek.hidden = false;
  const nt = next && next.querySelector(".sc-vt");
  peek.textContent = nt ? nt.textContent : "";
}
function scStartQuizFromPrompt() {
  const d = sc.cur && sc.cur.dataset;
  if (d) startQuiz(d.book, +d.chapter, d.bookName);
}
let scSaveTimer = 0;
function scSavePos() {
  clearTimeout(scSaveTimer);
  scSaveTimer = setTimeout(() => {
    const d = sc.cur && sc.cur.dataset;
    if (!d) return;
    const pos = { book: d.book, chapter: +d.chapter, verse: +d.verse };
    try { localStorage.setItem(SC_POS_KEY, JSON.stringify(pos)); } catch (e) { }
    const ref = `${pos.book}.${pos.chapter}${pos.verse ? "." + pos.verse : ""}`;
    history.replaceState(null, "", `${BASE_PATH}/scroll/?ref=${ref}&ver=${encodeURIComponent(current.version)}`);
    document.title = `${d.bookName} ${d.chapter} — Scroll the Bible`;
  }, 300);
}

/* ── loading chapters ── */
async function scFetchChapter(ref) {
  const d = await apiJSONCached(`/bibles/${current.version}/${ref.book}/${ref.chapter}`);
  const verses = d.data || [];
  if (!verses.length) throw Object.assign(new Error("chapter_not_found"), { status: 404 });
  return verses;
}
// The chapter's verses, with the book's quiz coverage fetched alongside so the
// chapter's quiz button (or its absence) is settled before the cards go in, so
// the last verse's strip never changes after the fact. Coverage never rejects:
// if it fails the chapter simply has no quiz button this time.
async function scFetchWithQuiz(ref) {
  const [verses] = await Promise.all([scFetchChapter(ref), ensureQuizCoverage(ref.book)]);
  return verses;
}
async function scBookLastChapter(usfm) {
  const d = await apiJSONCached(`/bibles/${current.version}/${usfm}/meta`);
  const ch = d.chapters || [];
  return ch.length ? ch[ch.length - 1].chapter : 1;
}
// The chapter after/before `ref`, rolling into the next/previous book at a
// boundary; null at either end of the version's canon.
async function scAdjacent(ref, dir) {
  const max = await scBookLastChapter(ref.book);
  const t = ref.chapter + dir;
  if (t >= 1 && t <= max) return { book: ref.book, bookName: ref.bookName, chapter: t };
  const idx = bookList.findIndex(b => b.usfm === ref.book);
  const nb = idx === -1 ? null : bookList[idx + dir];
  if (!nb) return null;
  return { book: nb.usfm, bookName: nb.name, chapter: dir > 0 ? 1 : await scBookLastChapter(nb.usfm) };
}
// Fires on scroll and after every load: keeps a few cards of runway in both
// directions. Checking positions (not an observer) so a short chapter that
// doesn't push the edge out of range still triggers the next load.
function scMaybeLoad() {
  const vh = scFeed.clientHeight || 1;
  if (scFeed.scrollHeight - scFeed.scrollTop - vh < vh * 3) scLoadNext();
  if (scFeed.scrollTop < vh * 3) scLoadPrev();
}
async function scLoadNext() {
  if (sc.loadingNext || sc.atEnd || !sc.last || Date.now() < sc.retryAt) return;
  sc.loadingNext = true;
  const gen = sc.gen;
  let more = false;
  try {
    const next = await scAdjacent(sc.last, 1);
    if (gen !== sc.gen) return;
    if (!next) {
      sc.atEnd = true;
      const end = scMessageCard(`<div class="sc-eyebrow">The end</div><p class="sc-verse">You've reached the end of ${escHtml(current.versionTitle)}.</p><button type="button" class="sc-btn" onclick="scOpenJump()">Jump to a book</button>`);
      scFeed.appendChild(end);
      return;
    }
    const verses = await scFetchWithQuiz(next);
    if (gen !== sc.gen) return;
    scAddCards(scCardsFor(next, verses), f => scFeed.appendChild(f));
    sc.last = next;
    more = true;
  } catch (e) {
    if (gen === sc.gen) sc.retryAt = Date.now() + 4000;
  } finally {
    if (gen === sc.gen) { sc.loadingNext = false; if (more) requestAnimationFrame(scMaybeLoad); }
  }
}
async function scLoadPrev() {
  if (sc.loadingPrev || sc.atStart || !sc.first || Date.now() < sc.retryAt) return;
  sc.loadingPrev = true;
  const gen = sc.gen;
  let more = false;
  try {
    const prev = await scAdjacent(sc.first, -1);
    if (gen !== sc.gen) return;
    if (!prev) { sc.atStart = true; return; }
    const verses = await scFetchWithQuiz(prev);
    if (gen !== sc.gen) return;
    // Prepending shoves everything down; re-pin the card the reader is on so the
    // screen doesn't jump. Snap is off for the move so it can't re-snap mid-way.
    const anchor = sc.cur || scFeed.querySelector(".sc-card");
    const before = anchor ? anchor.getBoundingClientRect().top : 0;
    scFeed.style.scrollSnapType = "none";
    scAddCards(scCardsFor(prev, verses), f => scFeed.insertBefore(f, scFeed.firstChild));
    if (anchor) scFeed.scrollTop += anchor.getBoundingClientRect().top - before;
    requestAnimationFrame(() => { scFeed.style.scrollSnapType = ""; });
    sc.first = prev;
    more = true;
  } catch (e) {
    if (gen === sc.gen) sc.retryAt = Date.now() + 4000;
  } finally {
    if (gen === sc.gen) { sc.loadingPrev = false; if (more) requestAnimationFrame(scMaybeLoad); }
  }
}
let scScrollTick = false;
scFeed.addEventListener("scroll", () => {
  if (scScrollTick) return;
  scScrollTick = true;
  requestAnimationFrame(() => { scScrollTick = false; scMaybeLoad(); });
}, { passive: true });

// (Re)start the feed at a chapter, optionally at a verse. Everything async
// that was in flight belongs to the old feed and drops itself via sc.gen.
async function scGoTo(book, chapter, verse) {
  const gen = ++sc.gen;
  scStopAudio();
  scFeed.querySelectorAll(".sc-card").forEach(c => scObserver.unobserve(c));
  Object.assign(sc, { first: null, last: null, atStart: false, atEnd: false, loadingNext: false, loadingPrev: false, retryAt: 0, cur: null });
  scFeed.innerHTML = `<div class="spin" role="status" aria-label="Loading"></div>`;
  const b = bookList.find(x => x.usfm === book);
  if (!b) { scShowProblem(`${escHtml(book)} isn't in ${escHtml(current.versionTitle)}.`); return; }
  const ref = { book: b.usfm, bookName: b.name, chapter };
  let verses;
  try { verses = await scFetchWithQuiz(ref); }
  catch (e) {
    if (gen !== sc.gen) return;
    if (e.status === 404) scShowProblem(`${escHtml(b.name)} ${chapter} isn't in ${escHtml(current.versionTitle)}.`);
    else if (e.message !== "no_api_key") scShowProblem(`Could not load ${escHtml(b.name)} ${chapter}.`, () => scGoTo(book, chapter, verse));
    return;
  }
  if (gen !== sc.gen) return;
  scFeed.innerHTML = "";
  scAddCards(scCardsFor(ref, verses), f => scFeed.appendChild(f));
  sc.first = sc.last = ref;
  const target = (verse && scFeed.querySelector(`.sc-card[data-verse="${verse}"]`)) || scFeed.querySelector(".sc-card");
  scFeed.style.scrollSnapType = "none";
  target.scrollIntoView({ block: "start", behavior: "auto" });
  requestAnimationFrame(() => { scFeed.style.scrollSnapType = ""; scMaybeLoad(); });
}
let scRetryFn = null;
function scShowProblem(html, retry) {
  scRetryFn = retry || null;
  scFeed.innerHTML = "";
  scFeed.appendChild(scMessageCard(`<p class="sc-verse">${html}</p>` +
    (retry ? `<button type="button" class="sc-btn" onclick="scRetryFn && scRetryFn()">Try again</button>`
           : `<button type="button" class="sc-btn" onclick="scOpenJump()">Jump to a book</button>`)));
}

// Keyboard: arrows / PageUp / PageDown / j / k step one card (the default would
// nudge 40px and snap straight back).
function scStep(dir) {
  const c = sc.cur;
  const t = c && (dir > 0 ? c.nextElementSibling : c.previousElementSibling);
  if (t) t.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}
document.addEventListener("keydown", e => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Escape") {
    const tip = document.getElementById("dictTooltip");
    if (tip && tip.classList.contains("show")) { e.preventDefault(); hideFloatingTooltip(); return; }
    const open = [...document.querySelectorAll(".modalscrim.show")].pop();
    if (open) { e.preventDefault(); closeModal(open.id); }
    return;
  }
  if (document.querySelector(".modalscrim.show") || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") { e.preventDefault(); scStep(1); }
  else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") { e.preventDefault(); scStep(-1); }
});
document.querySelectorAll(".modalscrim").forEach(s => s.addEventListener("click", e => { if (e.target === s) closeModal(s.id); }));

/* ── verse actions ── */
function scCurVerse() {
  const d = sc.cur && sc.cur.dataset;
  return d && +d.verse > 0 ? d : null;
}
function scToggleBookmark() { if (sc.cur) scBookmarkCard(sc.cur); }
// Toggles the bookmark on a given verse card (the rail button's current verse, or the card that was double-tapped).
function scBookmarkCard(card) {
  const d = card.dataset;
  if (!(+d.verse > 0)) return;
  const m = scRead("iqb_bookmarks"), k = scKey(d.book, d.chapter, d.verse), ref = `${d.bookName} ${d.chapter}:${d.verse}`;
  if (m[k]) { delete m[k]; toast(`Bookmark removed — ${ref}`); }
  else { m[k] = { createdAt: Date.now(), groupId: scGroupId() }; toast(`Bookmarked ${ref}`); }
  scWrite("iqb_bookmarks", m);
  scPaintCard(card);
  if (card === sc.cur) scSyncUI();
}

/* ── tap to copy, double-tap to bookmark ── */
// A pointer convenience on a verse card; the keyboard route to both is the rail's
// Bookmark button and Share > Copy Verse. The copy waits a beat so a second tap can
// turn it into a bookmark instead of copying twice. Taps on a control, or while text
// is selected, are left alone so selecting a verse by hand still works.
const SC_DOUBLE_TAP_MS = 260;
let scTapTimer = 0, scTapCard = null;
const scVerseQuote = card => `"${card.querySelector(".sc-vt").textContent}" — ${card.dataset.bookName} ${card.dataset.chapter}:${card.dataset.verse}`;
async function scCopyVerse(card) {
  try { await navigator.clipboard.writeText(scVerseQuote(card)); toast(`Copied ${card.dataset.bookName} ${card.dataset.chapter}:${card.dataset.verse}`); }
  catch (e) { toast("Couldn't copy — select the verse text instead"); }
}
// Stops the browser's own double-click word selection from fighting the gesture.
scFeed.addEventListener("mousedown", e => { if (e.detail > 1 && e.target.closest(".sc-card[data-verse]:not(.sc-title)")) e.preventDefault(); });
scFeed.addEventListener("click", e => {
  const card = e.target.closest(".sc-card");
  if (!card || !(+card.dataset.verse > 0) || !card.querySelector(".sc-vt")) return;
  if (e.target.closest("button, a, input, select, textarea, [data-cite-id]")) return;
  if (window.getSelection().toString()) return;
  clearTimeout(scTapTimer);
  if (scTapCard === card && scTapTimer) { scTapTimer = 0; scTapCard = null; scBookmarkCard(card); return; }
  scTapCard = card;
  scTapTimer = setTimeout(() => { scTapTimer = 0; scTapCard = null; scCopyVerse(card); }, SC_DOUBLE_TAP_MS);
});
function scOpenHighlight() {
  const d = scCurVerse();
  if (!d) return;
  scById("scHlTitle").textContent = `Highlight ${d.bookName} ${d.chapter}:${d.verse}`;
  const cur = scHighlightOf(scKey(d.book, d.chapter, d.verse));
  document.querySelectorAll("#scSwatches .sc-swatch").forEach(b => b.classList.toggle("on", b.dataset.color === cur));
  openModal("scHlScrim");
}
function scSetHighlight(color) {
  const d = scCurVerse();
  if (!d) return;
  const m = scRead("iqb_highlights"), k = scKey(d.book, d.chapter, d.verse);
  if (color) m[k] = { color, createdAt: Date.now(), groupId: scGroupId() };
  else delete m[k];
  scWrite("iqb_highlights", m);
  closeModal("scHlScrim");
  scPaintCard(sc.cur); scSyncUI();
}
/* ── share ── */
// The same Share options as the reader's Verse Tools > Share: the verse as an
// image (light or dark) with open / download / copy-link, the embed code and its
// live preview, and copy / send links, driven by the shared helpers in js/share.js
// (shareImageURL, shareEmbedSrc, copyShareLink, copyShareEmbed, downloadShareImage).
// Links point at the main app's verse URL, not Scroll's, so a pasted link gets the
// verse's preview card where the host provides one.
let scShareCard = null;
function scVerseLink(d) {
  return `${location.origin}${BASE_PATH}/${d.book.toLowerCase()}/${d.chapter}/${d.verse}?v=${encodeURIComponent(current.version)}`;
}
function scShare() {
  const d = scCurVerse();
  if (!d) return;
  scShareCard = sc.cur;
  shareToolRef = { book: d.book, chapter: +d.chapter, verse: +d.verse };
  shareToolTheme = getTheme() === "dark" ? "dark" : "light";
  scById("scShareTitle").textContent = `Share ${d.bookName} ${d.chapter}:${d.verse}`;
  openModal("scShareScrim");
  scRenderShare();
}
function scRenderShare() {
  const card = scShareCard, d = card.dataset;
  const ref = `${d.bookName} ${d.chapter}:${d.verse}`, quote = scVerseQuote(card), url = scVerseLink(d);
  const img = shareImageURL();
  const chip = t => `<button type="button" class="filter-chip${shareToolTheme === t ? " active" : ""}" aria-pressed="${shareToolTheme === t}" onclick="scSetShareTheme('${t}')">${t === "light" ? "Light" : "Dark"}</button>`;
  scById("scShareBody").innerHTML = `
    <div class="share-fields" role="group" aria-label="Image theme" style="margin-bottom:10px">${chip("light")}${chip("dark")}</div>
    <img class="share-preview" src="${escHtml(img)}" alt="Image of ${escHtml(ref)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'dd-empty',textContent:'Could not render a preview for this verse.'}))">
    <div class="share-actions">
      ${navigator.share ? `<button type="button" onclick="scNativeShare()">Share…</button>` : ""}
      <button type="button" onclick="scCopyVerse(scShareCard)">Copy Verse</button>
      <button type="button" onclick="scCopyLink()">Copy Link</button>
      <a href="${escHtml(img)}" target="_blank" rel="noopener">Open Full Image ↗</a>
      <button type="button" onclick="downloadShareImage()">Download</button>
      <button type="button" onclick="copyShareLink()">Copy Image Link</button>
      <button type="button" onclick="copyShareEmbed()">Copy Embed Code</button>
      <a href="mailto:?subject=${encodeURIComponent(ref)}&body=${encodeURIComponent(quote + "\n" + url)}">Email</a>
      <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(quote)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">X / Twitter</a>
      <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(quote + " " + url)}" target="_blank" rel="noopener">WhatsApp</a>
    </div>
    <iframe class="share-embed-frame" src="${escHtml(shareEmbedSrc())}" title="Verse embed preview"></iframe>`;
}
function scSetShareTheme(t) { shareToolTheme = t; scRenderShare(); }
async function scCopyLink() {
  try { await navigator.clipboard.writeText(scVerseLink(scShareCard.dataset)); toast("Link copied to clipboard"); }
  catch (e) { toast("Could not copy"); }
}
async function scNativeShare() {
  try { await navigator.share({ text: scVerseQuote(scShareCard), url: scVerseLink(scShareCard.dataset) }); } catch (e) { /* dismissed */ }
}

/* ── narration — per chapter (the API has no per-verse audio), so this says so
   and doesn't try to follow the cards ── */
const SC_VOICE_KEY = "iqb_scroll_voice"; // { [versionId]: audio_id } — the narrator last picked per translation
const scAudio = { ref: null, audioFor: null, audioId: null, narrations: [], mintAt: 0, ttl: 3600000, retried: false };
const scAudioEl = scById("scAudioEl");
function scVersionHasAudio() {
  const v = (catalog || []).find(x => x.version_id === current.version);
  return !!(v && v.audio_count > 0);
}
function scCurChapter() {
  const d = sc.cur && sc.cur.dataset;
  return d ? { book: d.book, bookName: d.bookName, chapter: +d.chapter, version: current.version } : null;
}
function scSameAudio(ref) {
  const a = scAudio.ref;
  return !!(a && ref && a.book === ref.book && a.chapter === ref.chapter && a.version === ref.version && scAudioEl.src);
}
function scSyncAudioButton() {
  const btn = scById("scBtnListen");
  const has = scVersionHasAudio();
  btn.disabled = !has;
  const playing = scSameAudio(scCurChapter()) && !scAudioEl.paused;
  btn.setAttribute("aria-label", !has ? "No narration for this translation" : playing ? "Pause narration" : "Listen to this chapter");
  btn.title = !has ? "No narration for this translation" : "Listen to this chapter";
  btn.innerHTML = playing ? SC_PAUSE_SVG : SC_PLAY_SVG;
}
// Same label rule as the main reader: the narrator's own name, else "Voice N".
const scVoiceLabel = (n, i) => n.narrator || n.name || `Voice ${i + 1}`;
function scSavedVoice(version) { try { return (JSON.parse(localStorage.getItem(SC_VOICE_KEY)) || {})[version] || null; } catch (e) { return null; } }
function scSaveVoice(version, id) {
  let m = {};
  try { m = JSON.parse(localStorage.getItem(SC_VOICE_KEY)) || {}; } catch (e) { }
  m[version] = id;
  try { localStorage.setItem(SC_VOICE_KEY, JSON.stringify(m)); } catch (e) { }
}
async function scMintAudio(ref) {
  if (scAudio.audioFor !== ref.version) {
    // Which narrators exist: the version's own list, falling back to its own id as the audio id (same as the main reader).
    try { scAudio.narrations = (await apiJSONCached(`/audio?version_id=${ref.version}`)).data || []; }
    catch (e) { scAudio.narrations = []; }
    const saved = scSavedVoice(ref.version);
    scAudio.audioId = (saved && scAudio.narrations.some(n => n.audio_id === saved)) ? saved
      : ((scAudio.narrations[0] || {}).audio_id || ref.version);
    scAudio.audioFor = ref.version;
  }
  scSyncVoiceBtn();
  const data = await apiJSON(`/audio/${scAudio.audioId}/${ref.book}/${ref.chapter}`);
  scAudioEl.src = data.file;
  scAudio.mintAt = Date.now();
  scAudio.ttl = (Number(data.expires_in) || 3600) * 1000;
}
async function scToggleAudio() {
  const ref = scCurChapter();
  if (!ref) return;
  if (scSameAudio(ref)) {
    if (!scAudioEl.paused) { scAudioEl.pause(); return; }
    // Signed URLs expire (documented contract): swap in a fresh one, keep the playhead.
    if (Date.now() - scAudio.mintAt > Math.max(0, scAudio.ttl - 90000)) {
      const at = scAudioEl.currentTime;
      try { await scMintAudio(ref); scAudioEl.currentTime = at; } catch (e) { toast("Couldn't play narration — try again"); return; }
    }
    scAudioEl.play().catch(() => toast("Couldn't play narration — try again"));
    return;
  }
  try { await scMintAudio(ref); }
  catch (e) {
    if (e.message === "no_api_key") return;
    toast(e.status === 404 ? "Narration isn't available for this chapter" : "Couldn't load narration — try again");
    return;
  }
  scAudio.ref = ref; scAudio.retried = false;
  scById("scPlayerLabel").textContent = `Listening to ${ref.bookName} ${ref.chapter}`;
  scById("scPlayer").hidden = false;
  scAudioEl.play().catch(() => toast("Couldn't play narration — try again"));
}
// The Voice pill shows only when there's a real choice (more than one narrator).
function scSyncVoiceBtn() {
  const btn = scById("scVoiceBtn");
  const list = scAudio.narrations;
  btn.hidden = list.length < 2;
  if (btn.hidden) return;
  const i = Math.max(0, list.findIndex(n => n.audio_id === scAudio.audioId));
  const name = scVoiceLabel(list[i], i);
  scById("scVoiceName").textContent = name.length > 12 ? name.slice(0, 11) + "…" : name;
  btn.setAttribute("aria-label", `${name}, choose narration voice`);
}
function scOpenVoices() {
  scById("scVoiceList").innerHTML = scAudio.narrations.map((n, i) =>
    `<button type="button" class="sc-vrow${n.audio_id === scAudio.audioId ? " on" : ""}" onclick="scSelectVoice('${n.audio_id}')"><span class="vt">${escHtml(scVoiceLabel(n, i))}</span></button>`).join("");
  openModal("scVoiceScrim");
}
// A different recording has different timing, so it starts the chapter over (as the main reader does) — and plays, since you asked to hear it.
async function scSelectVoice(id) {
  closeModal("scVoiceScrim");
  if (id === scAudio.audioId) return;
  const prev = scAudio.audioId;
  scAudio.audioId = id;
  scSyncVoiceBtn();
  const ref = scAudio.ref;
  if (ref) {
    scAudio.retried = false;
    try { await scMintAudio(ref); scAudioEl.play().catch(() => toast("Couldn't play narration — try again")); }
    catch (e) {
      // The new voice can't supply this chapter: keep the old one rather than leave the player pointing at nothing.
      scAudio.audioId = prev; scSyncVoiceBtn();
      toast(e.status === 404 ? "That voice doesn't have this chapter" : "Couldn't load narration — try again");
      return;
    }
  }
  scSaveVoice(scAudio.audioFor, id);
}
function scStopAudio() {
  scAudioEl.pause();
  scAudioEl.removeAttribute("src");
  scAudioEl.load();
  scAudio.ref = null;
  scById("scPlayer").hidden = true;
  scById("scPlayerFill").style.width = "0";
  if (sc.cur) scSyncAudioButton();
}
scAudioEl.addEventListener("play", () => { scById("scPlayBtn").innerHTML = SC_PAUSE_SVG; scById("scPlayBtn").setAttribute("aria-label", "Pause narration"); scSyncAudioButton(); });
scAudioEl.addEventListener("pause", () => { scById("scPlayBtn").innerHTML = SC_PLAY_SVG; scById("scPlayBtn").setAttribute("aria-label", "Resume narration"); scSyncAudioButton(); });
scAudioEl.addEventListener("ended", () => scStopAudio());
scAudioEl.addEventListener("timeupdate", () => {
  if (scAudioEl.duration) scById("scPlayerFill").style.width = (scAudioEl.currentTime / scAudioEl.duration * 100) + "%";
});
// A signed URL that dies mid-listen: one fresh mint, resumed where it was.
scAudioEl.addEventListener("error", async () => {
  if (!scAudio.ref || scAudio.retried || !scAudioEl.getAttribute("src")) return;
  scAudio.retried = true;
  const at = scAudioEl.currentTime;
  try { await scMintAudio(scAudio.ref); scAudioEl.currentTime = at; await scAudioEl.play(); }
  catch (e) { scStopAudio(); toast("Narration isn't available for this chapter"); }
});

/* ── Explain this verse — assembled from the API's own data (the original-
   language words, classic commentary, cross-references), not generated: the
   API has no explain endpoint. One GET /ai/context call (1 credit for the verse
   + 1 per section; "strongs" is left out, it only repeats what each original
   word already carries). Switching commentary source re-fetches just that
   section. Every verse reference shows its text inline and is previewable
   (js/previews.js), per the app's citation rule.

   The sheet is three collapsible sections — What it means, In the original,
   Related verses — each showing a short peek until opened, and all collapsed
   again for the next verse. The commentary leads (it's what answers "what does
   this verse mean"); if the chosen source has no entry for the verse it drops
   to the bottom so the sheet never opens on an empty section. ── */
const SC_COMMENTARIES = [{ id: "mhenry", name: "Matthew Henry" }, { id: "gill", name: "John Gill" }];
const SC_COMM_KEY = "iqb_scroll_commentary";
const SC_REFS_PAGE = 8;
const SC_CHEVRON = `<svg class="sc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
// open: which sections are expanded — { meaning, original, related }. Deliberately
// not saved: every verse opens with all three collapsed. It only outlives a
// re-render of the same sheet (switching commentary source).
const scExplain = { ref: null, gen: 0, refs: [], shown: 0, open: {} };
function scCommentarySource() {
  const s = localStorage.getItem(SC_COMM_KEY);
  return SC_COMMENTARIES.some(c => c.id === s) ? s : "mhenry";
}
function scExplainPath(ref, include, src) {
  return `/ai/context?ref=${ref.book}.${ref.chapter}.${ref.verse}&version=${encodeURIComponent(current.version)}&include=${include}&commentary=${src}`;
}
function scOpenExplain() {
  const d = scCurVerse();
  if (!d) return;
  scExplain.ref = { book: d.book, bookName: d.bookName, chapter: +d.chapter, verse: +d.verse };
  scExplain.open = {};
  scById("scExplainTitle").textContent = `${d.bookName} ${d.chapter}:${d.verse}`;
  openModal("scExplainScrim");
  scRenderExplain();
}

/* ── collapsible sections ── */
// variant: "clamp"  — the body is cut to a few lines (the commentary) with a fade;
//          "rows"   — the body shows a head start and the rest is display:none until opened.
// `pre` sits between the heading and the body and is always visible (the source switch);
// `post` sits after the body (the attribution, the "show more" button).
function scAccordion(id, variant, titleHtml, bodyHtml, { pre = "", post = "", fade = true } = {}) {
  const open = !!scExplain.open[id];
  return `<section class="sc-sec sc-acc${open ? " open" : ""}" id="scSec-${id}" data-sec="${id}" data-variant="${variant}">`
    + `<h3><button type="button" class="sc-acc-head" aria-expanded="${open}" aria-controls="scBody-${id}" onclick="scToggleSec('${id}')"><span>${titleHtml}</span>${SC_CHEVRON}</button></h3>`
    + pre
    + `<div class="sc-acc-body" id="scBody-${id}">${bodyHtml}`
    + (fade ? `<div class="sc-fade" aria-hidden="true"></div>` : "")
    + `</div>` + post + `</section>`;
}
function scPlainSection(id, titleHtml, bodyHtml, pre = "") {
  return `<section class="sc-sec" id="scSec-${id}" data-sec="${id}"><h3>${titleHtml}</h3>${pre}${bodyHtml}</section>`;
}
function scToggleSec(id) {
  const sec = scById("scSec-" + id);
  if (!sec) return;
  const open = sec.classList.toggle("open");
  const btn = sec.querySelector(".sc-acc-head");
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  scExplain.open[id] = open;
  scSyncPeekFocus(sec);
}
// A clamped body still holds the links that are cut off; keep them out of the
// tab order while collapsed so focus can't land on text you can't see.
function scSyncPeekFocus(sec) {
  const body = sec && sec.querySelector(".sc-acc-body");
  if (!body) return;
  const clamped = sec.dataset.variant === "clamp" && !sec.classList.contains("open");
  const edge = body.getBoundingClientRect().bottom + 1;
  body.querySelectorAll("button, a").forEach(el => {
    if (clamped && el.getBoundingClientRect().bottom > edge) el.setAttribute("tabindex", "-1");
    else el.removeAttribute("tabindex");
  });
}
// A clamped section whose text already fits in the peek has nothing to expand:
// make it a plain heading rather than a button that does nothing.
function scSettleSection(sec) {
  if (!sec || sec.dataset.variant !== "clamp" || !sec.classList.contains("sc-acc")) return;
  const body = sec.querySelector(".sc-acc-body");
  const wasOpen = sec.classList.contains("open");
  sec.classList.remove("open");
  const fits = body.scrollHeight <= body.clientHeight + 4;
  if (wasOpen) sec.classList.add("open");
  if (!fits) { scSyncPeekFocus(sec); return; }
  sec.querySelector("h3").textContent = sec.querySelector(".sc-acc-head > span").textContent;
  const fade = sec.querySelector(".sc-fade");
  if (fade) fade.remove();
  sec.classList.remove("sc-acc", "open");
  sec.dataset.variant = "plain";
  body.querySelectorAll("[tabindex]").forEach(el => el.removeAttribute("tabindex"));
}

/* ── the three sections ── */
async function scCommentaryHtml(entries, src) {
  const name = SC_COMMENTARIES.find(c => c.id === src).name;
  const chips = SC_COMMENTARIES.map(c => `<button type="button" class="sc-chip sc-chip-sm${c.id === src ? " on" : ""}" aria-pressed="${c.id === src}" onclick="scSetCommentary('${c.id}')">${c.name}</button>`).join("");
  const pre = `<div class="sc-chips" role="group" aria-label="Commentary source">${chips}</div>`;
  if (!(entries || []).length) return scPlainSection("meaning", "What it means", `<p class="sc-none">${escHtml(name)} has no entry for this exact verse.</p>`, pre);
  const paras = await Promise.all(entries.map(e => linkifyPreParsedCitations(e.text || "", e.citations)));
  const title = entries[0].source_title;
  return scAccordion("meaning", "clamp", "What it means", `<div class="sc-comm">${paras.map(p => `<p>${p}</p>`).join("")}</div>`,
    { pre, post: title ? `<div class="sc-attrib">${escHtml(title)}</div>` : "" });
}
function scOriginalHtml(d) {
  const words = (d.original || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!words.length) return scPlainSection("original", "In the original", `<p class="sc-none">No original-language text for this verse.</p>`);
  const lang = d.language || ""; // the API's own label ("hebrew" for the Old Testament, "greek" for the New)
  const rtl = lang === "hebrew", la = rtl ? "he" : "grc", dir = rtl ? "rtl" : "ltr";
  const rows = words.map(w => {
    const p = w.pronun && typeof w.pronun === "object" ? w.pronun : {};
    const say = p.dic || p.sbl || "";
    // The word on top (with its Strong's chip at the far end), its pronunciation / gloss / grammar underneath.
    return `<div class="sc-ow"><div class="sc-ow-head"><div class="sc-ow-orig" lang="${la}" dir="${dir}">${escHtml(w.word)}</div>`
      + (w.strongs_id ? `<button type="button" class="sc-ow-strongs" onclick="scWordStudy('${escAttr(w.strongs_id)}')" aria-label="Full lexicon entry for ${escAttr(w.strongs_id)}">${escHtml(w.strongs_id)}</button>` : "") + `</div>`
      + `<div class="sc-ow-mid">`
      + (say ? `<span class="sc-ow-pron"${p.ipa ? ` title="${escAttr(p.ipa)}"` : ""}>${escHtml(say)}</span>` : "")
      + (w.glossary ? `<span class="sc-ow-gloss">${escHtml(w.glossary)}</span>` : "")
      + (w.morph ? `<span class="sc-ow-morph">${escHtml(w.morph)}</span>` : "") + `</div></div>`;
  }).join("");
  // The peek is the verse itself in the original script, as one running line — the API's words in order.
  const line = `<div class="sc-orig-line" lang="${la}" dir="${dir}">${words.map(w => escHtml(w.word)).join(" ")}</div>`
    + `<div class="sc-orig-count">${words.length} word${words.length === 1 ? "" : "s"} — open for each one</div>`;
  return scAccordion("original", "rows", `In the original${lang ? ` <span class="sc-tag">${escHtml(humanizeToken(lang))}</span>` : ""}`,
    line + `<div class="sc-ow-rows">${rows}</div>`, { fade: false });
}
function scRelatedHtml(total) {
  const title = `Related verses${total ? ` <span class="sc-tag">${total}</span>` : ""}`;
  if (!total) return scPlainSection("related", "Related verses", `<p class="sc-none">No cross-references for this verse.</p>`);
  const list = `<div id="scRefsList"></div>`;
  const more = `<button type="button" class="sc-textbtn" id="scRefsMore" onclick="scMoreRefs()" hidden></button>`;
  // Two rows or fewer is already the whole list: nothing to open.
  return total <= 2 ? scPlainSection("related", title, list)
    : scAccordion("related", "rows", title, list, { post: more });
}

async function scSetCommentary(id) {
  localStorage.setItem(SC_COMM_KEY, id);
  const ref = scExplain.ref, gen = scExplain.gen;
  const sec = scById("scSec-meaning");
  if (!sec) return;
  sec.insertAdjacentHTML("beforeend", `<div class="spin" role="status" aria-label="Loading"></div>`);
  try {
    const d = await apiJSONCached(scExplainPath(ref, "commentary", id));
    if (gen !== scExplain.gen) return;
    const html = await scCommentaryHtml(d.commentary, id);
    if (gen !== scExplain.gen) return;
    // A source with no entry drops to the bottom; one with an entry comes back to the top.
    const slot = scById((d.commentary || []).length ? "scCommTop" : "scCommBottom");
    sec.remove();
    slot.innerHTML = html;
    requestAnimationFrame(() => scSettleSection(scById("scSec-meaning")));
  } catch (e) {
    if (gen !== scExplain.gen) return;
    const sp = sec.querySelector(".spin"); if (sp) sp.remove();
    toast("Couldn't load that commentary — try again");
  }
}
async function scMoreRefs() {
  const gen = scExplain.gen, list = scById("scRefsList"), more = scById("scRefsMore");
  if (!list) return;
  const batch = scExplain.refs.slice(scExplain.shown, scExplain.shown + SC_REFS_PAGE);
  if (!batch.length) return;
  scExplain.shown += batch.length;
  const previews = await fetchVersePreviews(batch); // one batched call for the whole page of refs
  if (gen !== scExplain.gen) return;
  list.insertAdjacentHTML("beforeend", batch.map(t => {
    const name = (bookList.find(b => b.usfm === t.book) || {}).name || t.book;
    const label = `${name} ${t.chapter}:${t.verse}${t.verse_end ? "-" + t.verse_end : ""}`;
    const text = previews[`${t.book}.${t.chapter}.${t.verse}`];
    const citeAttr = text ? ` data-cite-id="${registerCiteId(label, text)}"` : "";
    return `<div class="sc-xref"><div class="sc-xref-text">${text ? escHtml(text) : `<span class="sc-none">Text unavailable</span>`}</div>`
      + `<button type="button" class="sc-xref-ref"${citeAttr} onclick="scJumpToRef('${t.book}',${t.chapter},${t.verse})">${escHtml(label)}</button></div>`;
  }).join(""));
  if (more) {
    const left = scExplain.refs.length - scExplain.shown;
    more.hidden = left <= 0;
    more.textContent = `Show ${Math.min(left, SC_REFS_PAGE)} more`;
  }
}
function scJumpToRef(book, chapter, verse) {
  hideFloatingTooltip();
  closeModal("scExplainScrim");
  if (!bookList.some(b => b.usfm === book)) { toast("That book isn't in this translation"); return; }
  scGoTo(book, chapter, verse);
}
// The full lexicon entry lives in the main app's Study Tools > Word Study.
function scWordStudy(id) {
  const r = scExplain.ref;
  location.href = `${BASE_PATH}/${r.book.toLowerCase()}/${r.chapter}/${r.verse}?v=${encodeURIComponent(current.version)}#study-tools/word/${encodeURIComponent(id)}`;
}
async function scRenderExplain() {
  const ref = scExplain.ref, gen = ++scExplain.gen, body = scById("scExplainBody");
  const src = scCommentarySource();
  body.innerHTML = `<div class="spin" role="status" aria-label="Loading"></div>`;
  let d;
  try { d = await apiJSONCached(scExplainPath(ref, "original,commentary,crossrefs", src)); }
  catch (e) {
    if (gen !== scExplain.gen || e.message === "no_api_key") return;
    body.innerHTML = `<div class="emptynote">${e.status === 404 ? "There's nothing to explain for this verse in this translation." : "Could not load the explanation. Try again in a moment."}</div>`;
    return;
  }
  const comm = await scCommentaryHtml(d.commentary, src);
  if (gen !== scExplain.gen) return;
  scExplain.refs = (d.cross_references || []).map(e => e.reference).filter(Boolean);
  scExplain.shown = 0;
  const hasComm = (d.commentary || []).length > 0;
  body.innerHTML =
    (d.text ? `<blockquote class="sc-quote">${escHtml(d.text.replace(/¶\s*/g, ""))}</blockquote>` : "")
    + `<div id="scCommTop">${hasComm ? comm : ""}</div>`
    + scOriginalHtml(d)
    + scRelatedHtml(scExplain.refs.length)
    + `<div id="scCommBottom">${hasComm ? "" : comm}</div>`
    + (d.errors && Object.keys(d.errors).length ? `<p class="sc-none">Some parts are temporarily unavailable.</p>` : "")
    + `<p class="sc-foot">Original-language text, glosses, commentary and cross-references come from the IQ Bible API. Nothing here is AI-generated.</p>`;
  requestAnimationFrame(() => scSettleSection(scById("scSec-meaning")));
  if (scExplain.refs.length) scMoreRefs();
}
scById("scExplainBody").addEventListener("scroll", () => hideFloatingTooltip(), { passive: true });
// A collapsed peek opens when you tap anywhere on it, not just on the heading —
// except on something with its own action (a citation, a reference button, a
// Strong's chip) or while selecting text. A pointer convenience only: the
// heading button is the real control (keyboard, screen readers).
scById("scExplainBody").addEventListener("click", e => {
  const sec = e.target.closest(".sc-acc-body") && e.target.closest(".sc-acc");
  if (!sec || sec.classList.contains("open")) return;
  if (e.target.closest("button, a, input, select, textarea, [data-cite-id]")) return;
  if (window.getSelection().toString()) return;
  scToggleSec(sec.dataset.sec);
});

/* ── chapter quiz (js/quiz.js) ── */
// Scroll has no chapter-end nav, so "Next" scrolls on to the next chapter's title
// card (a plain Done if that chapter isn't loaded yet). A finished quiz marks the chapter read through the same DOM-free core
// (js/readstate.js) as the reader.
// The next chapter's title card, if it's loaded (it follows the quizzed chapter's last verse).
const scNextTitleOf = q => {
  const last = scFeed.querySelector(`.sc-card[data-last="1"][data-book="${q.book}"][data-chapter="${q.chapter}"]`);
  const next = last && last.nextElementSibling;
  return next && next.classList.contains("sc-title") ? next : null;
};
Object.assign(quizHost, {
  markRead(q) { return scMarkRead(q.book, q.chapter, true); },
  coverageLoaded() { },
  nextLabel(q) {
    const next = scNextTitleOf(q);
    return next ? `${next.dataset.bookName} ${next.dataset.chapter}` : "";
  },
  goNext() {
    const next = quiz && scNextTitleOf(quiz);
    if (next) next.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  },
  // Show the new best on the chapter's title card and on the last verse's prompt.
  scoresChanged(q) {
    scRepaintReadStamp(q.book, q.chapter);
    if (sc.cur) scSyncPeek(sc.cur);
  },
  focusAfterClose: "#scQuizPrompt",
});

/* ── pickers ── */
async function scOpenJump() {
  openModal("scJumpScrim");
  if (!bookList.length) await loadBooks();
  scJumpBooks();
}
function scJumpBooks() {
  scById("scJumpTitle").textContent = "Choose a book";
  scById("scJumpBack").hidden = true;
  const curBook = sc.cur && sc.cur.dataset.book;
  const grid = list => `<div class="sc-grid">${list.map(b =>
    `<button type="button" class="sc-chip${b.usfm === curBook ? " on" : ""}" onclick="scPickBook('${b.usfm}')">${escHtml(b.name)}</button>`).join("")}</div>`;
  const nt = bookList.filter(b => NT_USFM.has(b.usfm)), ot = bookList.filter(b => !NT_USFM.has(b.usfm));
  scById("scJumpBody").innerHTML =
    (ot.length ? `<div class="sc-glabel">Old Testament</div>${grid(ot)}` : "") +
    (nt.length ? `<div class="sc-glabel">New Testament</div>${grid(nt)}` : "") ||
    `<div class="emptynote">No books to show.</div>`;
}
async function scPickBook(usfm) {
  const b = bookList.find(x => x.usfm === usfm);
  if (!b) return;
  let max = 1;
  try { max = await scBookLastChapter(usfm); } catch (e) { /* falls back to chapter 1 */ }
  // One-chapter books (Obadiah, Philemon, Jude…): a chapter grid of one is just friction.
  if (max <= 1) { closeModal("scJumpScrim"); scGoTo(usfm, 1); return; }
  scById("scJumpTitle").textContent = b.name;
  scById("scJumpBack").hidden = false;
  const curCh = sc.cur && sc.cur.dataset.book === usfm ? +sc.cur.dataset.chapter : 0;
  scById("scJumpBody").innerHTML = `<div class="sc-grid sc-chapters">${Array.from({ length: max }, (_, i) => i + 1).map(n =>
    `<button type="button" class="sc-chip${n === curCh ? " on" : ""}" onclick="closeModal('scJumpScrim');scGoTo('${usfm}',${n})">${n}</button>`).join("")}</div>`;
  const first = scById("scJumpBody").querySelector("button");
  if (first) first.focus({ preventScroll: true });
}

async function scOpenVersions() {
  openModal("scVerScrim");
  scById("scVerSearch").value = "";
  scById("scVerList").innerHTML = `<div class="spin"></div>`;
  await loadCatalog();
  scRenderVersions();
}
function scRenderVersions() {
  const q = scById("scVerSearch").value.trim().toLowerCase();
  const all = catalog || [];
  // Empty search: the translations in the language you're already reading. Typing searches them all.
  const pool = q ? all.filter(v => `${v.title} ${v.language_name} ${v.version_id}`.toLowerCase().includes(q))
                 : all.filter(v => bcp47(v.language_code || v.version_id) === current.lang);
  const shown = pool.slice(0, 80);
  const row = v => `<button type="button" class="sc-vrow${v.version_id === current.version ? " on" : ""}" onclick="scSetVersion('${v.version_id}')"><span class="vt">${escHtml(v.title || v.version_id)}</span><span class="vs">${escHtml(v.language_name || "")} · ${escHtml(v.version_id)}${v.audio_count > 0 ? " · audio" : ""}</span></button>`;
  scById("scVerList").innerHTML =
    (q ? "" : `<div class="sc-hint-line">Showing translations in your current language. Search to find any of ${all.length.toLocaleString()}.</div>`) +
    (shown.map(row).join("") || `<div class="emptynote">No matching translation.</div>`) +
    (pool.length > shown.length ? `<div class="sc-hint-line">Showing the first ${shown.length} of ${pool.length.toLocaleString()} — narrow your search.</div>` : "");
}
async function scSetVersion(id) {
  const keep = sc.cur ? { book: sc.cur.dataset.book, chapter: +sc.cur.dataset.chapter, verse: +sc.cur.dataset.verse } : scStartRef();
  if (!applyVersionById(id)) return;
  setLastVersion(id);
  closeModal("scVerScrim");
  scApplyVersionUI();
  bookList = [];
  await loadBooks();
  await scGoTo(keep.book, keep.chapter, keep.verse);
}
function scApplyVersionUI() {
  const label = shortVersionLabel(current.versionTitle);
  scById("scVersionText").textContent = label;
  scById("scVersionBtn").title = current.versionTitle; // the abbreviation alone can't tell KJV from KJV 1611, KJVA, etc.
  scById("scVersionBtn").setAttribute("aria-label", `${label}, choose a translation`);
  scFeed.lang = current.lang || "";
  scFeed.dir = current.textDirection || "ltr";
}

/* ── display ── */
function scApplyFont() {
  const px = parseInt(localStorage.getItem(SC_FONT_KEY), 10) || 30;
  scBaseFont = px;
  document.documentElement.style.setProperty("--sc-font", px + "px");
  return px;
}
function scSetFont(px) { localStorage.setItem(SC_FONT_KEY, px); scApplyFont(); scFitAllSoon(); }
function scSetTheme(t) { setTheme(t); scSyncTheme(); }
function scSyncTheme() {
  const dark = getTheme() === "dark";
  scById("scThemeLight").classList.toggle("on", !dark);
  scById("scThemeDark").classList.toggle("on", dark);
  scById("scThemeLight").setAttribute("aria-pressed", dark ? "false" : "true");
  scById("scThemeDark").setAttribute("aria-pressed", dark ? "true" : "false");
}
function scOpenDisplay() {
  scById("scFontRange").value = scApplyFont();
  scSyncTheme();
  openModal("scDisplayScrim");
}

/* ── start-up ── */
function scSaveKey() {
  const v = scById("scKeyInput").value.trim();
  if (!v) { scById("scKeyInput").focus(); return; }
  setApiKey(v);
  location.reload();
}
// Where to begin: an explicit ?ref= link, else where Scroll left off, else the
// last chapter read in the main app, else John 1.
function scStartRef() {
  const q = new URLSearchParams(location.search).get("ref");
  if (q) {
    const [b, c, v] = q.split(".");
    if (b && parseInt(c, 10) > 0) return { book: b.toUpperCase(), chapter: parseInt(c, 10), verse: parseInt(v, 10) || 0 };
  }
  try { const p = JSON.parse(localStorage.getItem(SC_POS_KEY)); if (p && p.book && p.chapter) return p; } catch (e) { }
  try { const h = JSON.parse(localStorage.getItem("iqb_history") || "[]"); const l = h[h.length - 1]; if (l && l.book) return { book: l.book, chapter: l.chapter, verse: 0 }; } catch (e) { }
  return { book: "JHN", chapter: 1, verse: 0 };
}
(async function scInit() {
  setTheme(getTheme());
  scApplyFont();
  // Everything outside a dialog goes inert while one is open (api.js's modal manager).
  INERT_REGION_IDS.push("scStage");
  if (!IS_HOSTED_INSTANCE && !getApiKey()) { showKeyBanner(); return; }
  await loadCatalog();
  applyStoredVersion();
  const qv = new URLSearchParams(location.search).get("ver");
  if (qv && qv !== current.version && applyVersionById(qv)) setLastVersion(qv);
  scApplyVersionUI();
  await loadBooks();
  if (!bookList.length) { scShowProblem("Could not load this translation's books.", () => location.reload()); return; }
  let start = scStartRef();
  if (!bookList.some(b => b.usfm === start.book)) start = { book: bookList[0].usfm, chapter: 1, verse: 0 };
  await scGoTo(start.book, start.chapter, start.verse);
})();
