/* ═══════════════════════════════════════════════════════════════════════
   READ — chapter render */
async function loadChapter(chapter, refreshMeta, verse, verseEnd) {
  current.chapter = chapter;
  current.verse = verse || null;
  current.verseEnd = (verse && verseEnd && verseEnd > verse) ? verseEnd : null;
  logHistoryVisit();
  clearVerseSelection();
  document.getElementById("btnPickChapter").firstChild.textContent = chapter + " ";
  document.getElementById("btnPickVersion").firstChild.textContent = shortVersionLabel(current.versionTitle) + " ";
  document.getElementById("btnPickBook").firstChild.textContent = current.bookName + " ";
  document.getElementById("readingText").innerHTML = `<div class="spin"></div>`;
  // A fresh navigation (no target verse) always starts at the top — a cached
  // chapter renders fast enough that the previous chapter's scroll offset
  // would otherwise survive the innerHTML swap. A `verse` load is positioned
  // by scrollHighlightVerse() at the end of this function instead.
  if (!verse) document.getElementById("readMain").scrollTop = 0;
  // Otherwise the previous chapter's prompt (or its "done" state) stays
  // visible behind the spinner until renderChapterReadPrompt() below re-runs.
  document.getElementById("chapterReadPrompt").className = "";
  document.getElementById("chapterReadStamp").className = "";
  document.getElementById("chapterEndNav").hidden = true;

  if (refreshMeta) await loadChapterMeta();

  try {
    const data = await apiJSONCached(`/bibles/${current.version}/${current.book}/${chapter}?include=words_of_jesus`);
    document.getElementById("readingText").dir = current.textDirection;
    renderChapter(data.data || []);
    applyVerseAnnotations();
    loadInlineIllustrations();
    loadInlineStoryTitles();
    loadSidebarCards();
    markDictionaryTerms();
    renderChapterReadPrompt();
    renderChapterEndNav();
  } catch (e) {
    if (e.message !== "no_api_key") {
      document.getElementById("readingText").innerHTML = `<div class="errnote">Could not load ${escHtml(current.bookName)} ${chapter}. ${escHtml(e.message)}</div>`;
    }
  }

  loadTopBookIcon();
  refreshAudioAvailability();
  // Synchronous, not RAF-deferred: getBoundingClientRect() below forces its
  // own layout flush, so there's no need to wait a frame — and waiting would
  // let init()'s subsequent openHashRoute() hide #readViewGroup first (when
  // landing on a #devotionals/#search/etc. deep link), leaving alignRails()
  // measuring a display:none tree and collapsing the rails to the topbar.
  alignChapterNavButtons(); alignRails();
  syncURL();
  if (current.verse) scrollHighlightVerse(current.verse, current.verseEnd);
}
// Flashes the jump-target verse(s) a few times (.jump-target, css/styles.css)
// then leaves them persistently ringed — a scroll-position jump with no
// lasting marker is easy to lose track of, unlike a timed fade. Cleared on
// the reader's next click anywhere, or the next verse jump, not a timer.
// verseEnd (optional) rings a whole span, /gal/5/14-16.
function scrollHighlightVerse(verse, verseEnd) {
  setTimeout(() => {
    clearJumpTarget();
    const el = document.querySelector(`.verse-span[data-verse="${verse}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const last = (verseEnd && verseEnd > verse) ? verseEnd : verse;
    for (let v = verse; v <= last; v++) {
      document.querySelector(`.verse-span[data-verse="${v}"]`)?.classList.add("jump-target");
    }
  }, 300);
}
function clearJumpTarget() {
  document.querySelectorAll(".verse-span.jump-target").forEach(el => el.classList.remove("jump-target"));
}
document.addEventListener("click", e => {
  if (e.target.closest(".verse-span.jump-target")) return;
  clearJumpTarget();
});

function renderChapter(verses) {
  let html = "<p>";
  verses.forEach((v, i) => {
    const num = v.verse_number ?? v.verse ?? "";
    const dropcap = (i === 0);
    const rawText = v.text || "";
    // ¶ is a genuine paragraph marker some editions carry verbatim in the
    // verse text — rendered as an actual paragraph break, the way a
    // printed KJV shows it.
    const hasPara = i > 0 && rawText.includes("¶");
    let inner = escHtml(rawText.replace(/¶\s*/g, ""));
    if (dropcap && inner.length) {
      inner = `<span class="dropcap">${inner.charAt(0)}</span>` + inner.slice(1);
    }
    if (hasPara) html += `</p><p>`;
    const mark = hasPara ? `<span class="paramark">¶</span>` : "";
    html += `<span class="verse-span" data-verse="${num}">${mark}<span class="vnum">${num}</span>${inner}</span> `;
  });
  html += "</p>";
  document.getElementById("readingText").innerHTML = html || `<div class="emptynote">No verses in this chapter.</div>`;
}

// dir is -1 (previous) or 1 (next). Steps within the current book's
// chapter range; at a book boundary, rolls into the next/previous book,
// landing on its first (forward) or last (backward) chapter.
async function goAdjacentChapter(dir) {
  const maxCh = chapterMeta.length ? chapterMeta[chapterMeta.length - 1].chapter : current.chapter;
  const target = current.chapter + dir;
  if (target >= 1 && target <= maxCh) {
    await loadChapter(target, false);
    return;
  }
  const idx = bookList.findIndex(b => b.usfm === current.book);
  const nextIdx = idx + dir;
  if (idx === -1 || nextIdx < 0 || nextIdx >= bookList.length) {
    toast(dir > 0 ? "You've reached the end." : "You're at the beginning.");
    return;
  }
  const b = bookList[nextIdx];
  current.book = b.usfm;
  current.bookName = b.name;
  chapterMeta = [];
  await loadChapterMeta();
  const targetChapter = dir > 0 ? 1 : (chapterMeta.length ? chapterMeta[chapterMeta.length - 1].chapter : 1);
  await loadChapter(targetChapter, false);
}

// End-of-chapter prev/next (#chapterEndNav) — fills in where each arrow
// leads (next chapter in this book, or the first chapter / name of the
// adjacent book at a boundary) and greys out the arrow that would run off
// the ends of the canon. goAdjacentChapter still guards the boundary itself.
function renderChapterEndNav() {
  const nav = document.getElementById("chapterEndNav");
  if (!nav) return;
  const maxCh = chapterMeta.length ? chapterMeta[chapterMeta.length - 1].chapter : current.chapter;
  const idx = (typeof bookList !== "undefined" && bookList) ? bookList.findIndex(b => b.usfm === current.book) : -1;
  const destLabel = dir => {
    const t = current.chapter + dir;
    if (t >= 1 && t <= maxCh) return `${current.bookName} ${t}`;
    const nb = idx !== -1 ? bookList[idx + dir] : null;
    if (!nb) return "";
    return dir > 0 ? `${nb.name} 1` : nb.name; // last chapter of the previous book — count not known here
  };
  document.getElementById("cenPrevLabel").textContent = destLabel(-1);
  document.getElementById("cenNextLabel").textContent = destLabel(1);
  document.getElementById("cenPrev").disabled = current.chapter <= 1 && idx <= 0;
  document.getElementById("cenNext").disabled = current.chapter >= maxCh && idx !== -1 && idx >= bookList.length - 1;
  nav.hidden = false;
}

// Positions the fixed prev/next buttons just outside #readCol's own
// edges — no static CSS value can express that once the reading column's
// own width varies with viewport, so this measures at runtime.
function alignChapterNavButtons() {
  const prev = document.getElementById("btnPrevChapter");
  const next = document.getElementById("btnNextChapter");
  const col = document.getElementById("readCol");
  if (!prev || !next || !col || window.innerWidth <= 1180) {
    // Below 1180px .chapternav is CSS-docked to the bottom corners
    // (css/styles.css) instead — clear any leftover inline position so that
    // rule isn't beaten by inline style specificity.
    if (prev) prev.style.left = ""; if (next) next.style.right = "";
    return;
  }
  const colRect = col.getBoundingClientRect();
  const gap = 24, btn = 44;
  prev.style.left = Math.max(8, colRect.left - gap - btn) + "px";
  next.style.right = Math.max(8, window.innerWidth - colRect.right - gap - btn) + "px";
}
window.addEventListener("resize", alignChapterNavButtons);

// Touch gestures for the reader (all below 1180px, where the on-screen
// chrome is deliberately sparse):
//   • a horizontal swipe on the reading column turns the chapter — the
//     .chapternav arrows are gone at this width (css/styles.css), so this is
//     the primary way between adjacent chapters, not a nicety;
//   • an inward swipe from the right screen edge opens the Chapter Info sheet
//     (its docked button is gone on mobile too);
//   • a tap on empty reading space toggles the auto-hiding chrome — the only
//     way to bring it back without scrolling up.
// Passive listeners (no preventDefault) so vertical scroll and
// tap-to-select-verse keep working untouched; a swipe only acts once it's
// clearly more horizontal than vertical and past a minimum distance, so an
// ordinary scroll can't misfire it.
(function initReaderGestures() {
  const col = document.getElementById("readCol");
  if (!col) return;
  const EDGE = 30;
  let sx = 0, sy = 0, tracking = false, fromRightEdge = false, actedGesture = false;

  document.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) { tracking = false; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    tracking = true; actedGesture = false;
    fromRightEdge = sx >= window.innerWidth - EDGE;
  }, { passive: true });

  document.addEventListener("touchend", e => {
    if (!tracking) return;
    tracking = false;
    if (window.innerWidth > 1180) return;
    if (typeof tourActive !== "undefined" && tourActive) return;
    const rvg = document.getElementById("readViewGroup");
    if (rvg && rvg.style.display === "none") return; // Search / Explore / etc. is up, not the reader
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;

    // Right edge → inward: open Chapter Info. Claims the gesture so the
    // chapter-turn check below can't also fire off the same drag.
    if (fromRightEdge && dx < -50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (document.getElementById("notesDrawer").hidden && !document.querySelector(".modalscrim.show")) {
        openCardsSheet();
        actedGesture = true;
      }
    }

    if (!actedGesture && !fromRightEdge &&
        Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2 &&
        e.target.closest && e.target.closest("#readCol")) {
      goAdjacentChapter(dx < 0 ? 1 : -1);
      actedGesture = true;
    }
  }, { passive: true });

  col.addEventListener("click", e => {
    if (window.innerWidth > 1180 || actedGesture) return;
    if (typeof tourActive !== "undefined" && tourActive) return;
    if (e.target.closest(".verse-span, a, button, input, textarea, .dict-term, [data-cite-id], .inline-illust, [onclick]")) return;
    if (window.getSelection().toString()) return;
    document.body.classList.toggle("chrome-hidden");
  });
})();

// Below 1180px the topbar / chapter header / footer nav / audio bar hide on
// scroll-down and return on scroll-up (css/styles.css body.chrome-hidden) —
// more of a small screen goes to the text while you're actually reading.
(function initChromeAutoHide() {
  const sc = document.getElementById("readMain");
  if (!sc) return;
  let last = 0, ticking = false;
  function update() {
    ticking = false;
    const rvg = document.getElementById("readViewGroup");
    if (window.innerWidth > 1180 || !document.getElementById("notesDrawer").hidden ||
        (rvg && rvg.style.display === "none") ||
        (typeof tourActive !== "undefined" && tourActive)) { // don't tuck the chrome away mid-tour — steps spotlight it
      document.body.classList.remove("chrome-hidden");
      return;
    }
    const y = sc.scrollTop;
    const dy = y - last;
    last = y;
    if (y <= 64) { document.body.classList.remove("chrome-hidden"); return; }
    if (Math.abs(dy) > 200) return; // a big jump is a programmatic scroll (deep-link landing, view-switch restore) — resync, don't treat it as a direction
    if (dy > 6) {
      document.body.classList.add("chrome-hidden");
      if (typeof closeMoreMenu === "function") closeMoreMenu(); // it's anchored to the footer that's sliding away
    } else if (dy < -6) {
      document.body.classList.remove("chrome-hidden");
    }
  }
  sc.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1180) document.body.classList.remove("chrome-hidden"); // the hide transforms are mobile-only; don't leave the class stuck on
  });
})();

// .chhead is sticky (top:0 of #readMain's own scrollport), so it's always
// flush with #shell's top regardless of scroll position — its bottom edge
// is therefore a stable, scroll-independent proxy for "where the chapter's
// content starts," which is what the nav menu/cards are meant to line up
// with. A story title (see loadInlineStoryTitles) sits between chhead and
// the actual first sentence, adding real height only some chapters have —
// an earlier version of this function only reserved that extra space when
// the *current* chapter happened to have one, which meant the rails visibly
// jumped up or down depending on whether the chapter being viewed had a
// resolved story title (most don't). storyTitleReserve is instead a
// constant, learned once from the first real .story-title-heading this
// session ever renders (with a sane fallback until then) and applied to
// *every* chapter regardless — so the rails always land at the same
// position (calibrated against a chapter that has a title, e.g. Genesis 23,
// "The Death and Burial of Sarah") rather than moving chapter to chapter.
let storyTitleReserve = 68; // fallback ≈ .story-title-heading's own CSS box height, until measured for real
function alignRails() {
  const chhead = document.querySelector(".chhead");
  const shell = document.getElementById("shell");
  const navmenu = document.querySelector("#navrail .navmenu");
  const cardstack = document.getElementById("cardStack");
  if (!chhead || !shell) return;
  // Below 1180px neither rail is a static column any more (#navrail is
  // hidden, #rightRail is a bottom sheet toggled by #btnCardsSheet) — no
  // "line up with the chapter text" offset applies there, and leaving the
  // desktop-computed paddingTop in place would just push the sheet's
  // content down by however tall .chhead measures.
  if (window.innerWidth <= 1180) {
    if (cardstack) cardstack.style.paddingTop = "";
    return;
  }
  // #readViewGroup is display:none whenever another left-nav view (Search,
  // Devotionals, ...) is open — chhead measures as a zero-height box then,
  // which would otherwise collapse the rails' top offset to ~0. Bail and
  // keep whatever offset was last computed while Read was actually visible.
  const readViewGroup = document.getElementById("readViewGroup");
  if (readViewGroup && readViewGroup.style.display === "none") return;
  const heading = document.querySelector(".story-title-heading");
  if (heading) {
    const cs = getComputedStyle(heading);
    const measured = heading.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
    if (measured > 0) storyTitleReserve = measured;
  }
  const offset = Math.max(0, chhead.getBoundingClientRect().bottom - shell.getBoundingClientRect().top + storyTitleReserve);
  if (navmenu) navmenu.style.paddingTop = offset + "px";
  if (cardstack) cardstack.style.paddingTop = offset + "px";
}
window.addEventListener("resize", alignRails);

/* ═══════════════════════════════════════════════════════════════════════
   RIGHT-RAIL CARDS — per-chapter contextual cards (places, people,
   prophecies) plus an always-shown timeline card (chronology has no
   per-chapter filter to key off of, unlike the other three). Each API call
   404s when there's nothing for this chapter — caught and treated as "no
   card," same convention as the illustrations/story-titles above. */
let allProphecies = null;
async function getAllProphecies() {
  if (!allProphecies) {
    try { const d = await apiJSON("/prophecies"); allProphecies = d.data || []; }
    catch (e) { allProphecies = []; }
  }
  return allProphecies;
}
let allChronology = null;
async function getAllChronology() {
  if (!allChronology) {
    try { const d = await apiJSON("/chronology"); allChronology = d.data || []; }
    catch (e) { allChronology = []; }
  }
  return allChronology;
}
// /chronology has no per-chapter filter server-side (it's a flat curated
// list spanning all of Scripture, not scoped to one book), but each entry's
// `reference` is a free-text "Book chapter:verse" string — matched against
// the current book/chapter client-side rather than a second API round trip,
// since the whole list is already cached in memory.
function chronologyForChapter(all, bookName, chapter) {
  const re = new RegExp("^" + bookName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+(\\d+)");
  return all.filter(e => {
    const m = e.reference && e.reference.match(re);
    return m && parseInt(m[1], 10) === chapter;
  });
}
function railCard(label, body, onclick) {
  const cls = "railcard" + (onclick ? " clickable" : "");
  const click = onclick ? ` onclick="${onclick}"` : "";
  return `<div class="${cls}"${click}><div class="rc-label">${escHtml(label)}</div><div class="rc-body">${body}</div></div>`;
}
// Standard slippy-map tile math (lon/lat -> the z/x/y tile that contains it)
// — a plain raster image, not an interactive embed, for contexts too small
// for a full interactive map to render cleanly (see loadPlacesCard,
// placeMapPreviewHTML). Esri's free World Street Map basemap (no key, path
// order is z/y/x, unlike OSM's own z/x/y) rather than tile.openstreetmap.org
// two reasons: (1) OSM's volunteer-run tile servers now reject this app's
// requests outright ("not following the tile usage policy" — confirmed live,
// 2026-08-23; they're meant for occasional interactive browsing, not an
// app's automated thumbnail fetches, see osm.wiki/Blocked) and (2), the
// actual reason this file's Leaflet map switched providers in the first
// place, Esri's basemap renders Latin/English place names worldwide instead
// of whatever script OSM's own data happens to carry for a given region.
function staticMapTileURL(lon, lat, zoom) {
  const latRad = lat * Math.PI / 180;
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${y}/${x}`;
}
// Small non-interactive map preview (pointer-events:none — clicking it opens
// the real interactive Leaflet map instead, see openMapView in main.js) — a
// single static tile rather than a live embed, since nothing here needs
// panning. Shared by the chapter-scoped Places modal (this file) and the
// Bible Atlas place page (js/explore.js) — the same English-label fix, not
// reimplemented per call site.
function placeMapPreviewHTML(lat, lon, title) {
  const src = staticMapTileURL(lon, lat, 8);
  return `<div class="place-map-wrap" data-lat="${lat}" data-lon="${lon}" data-label="${escAttr(title)}"><img class="place-map" loading="lazy" src="${src}" alt="Map of ${escHtml(title)}"></div>`;
}
async function loadPlacesCard() {
  try {
    const d = await apiJSONCached(`/geo/${current.book}/${current.chapter}`);
    const places = d.data || [];
    if (!places.length) return null;
    const names = places.slice(0, 3).map(p => escHtml(p.name)).join(", ");
    const moreText = names + (places.length > 3 ? ` +${places.length - 3} more` : "");
    // A preview of the first place right on the card face rather than
    // making every open a click-through into the modal to see anything
    // visual — a real photo first when there is one (the API's own
    // thumbnail, no attribution/UI chrome to worry about), a plain static
    // map tile as a fallback when there's only coordinates. The full
    // interactive OSM embed (openPlacesModal, below) stays iframe-based —
    // it's shown at a real size there and works fine; at card-thumbnail
    // size that iframe's own "Make a donation"/attribution footer chrome
    // dominates a box this small, which is why this isn't just a smaller
    // copy of that embed.
    const first = places[0];
    let media = "";
    if (first.thumbnail) {
      media = `<img class="rc-thumb" src="${escHtml(first.thumbnail.url)}" alt="" onerror="this.remove()">`;
    } else if (typeof first.lat === "number" && typeof first.lon === "number") {
      media = `<img class="rc-thumb" src="${staticMapTileURL(first.lon, first.lat, 7)}" alt="Map of ${escHtml(first.name)}" onerror="this.remove()">`;
    }
    // Only the media variant keeps the 1:1 square (see .railcard--media, CSS) —
    // a Places card with just names, no thumbnail/coords, sizes to content.
    return `<div class="railcard clickable${media ? " railcard--media" : ""}" onclick="openPlacesModal()"><div class="rc-label">Places</div>${media ? `<div class="rc-media">${media}</div>` : ""}<div class="rc-body">${moreText}</div></div>`;
  } catch (e) { return null; }
}
// Opens with a real embedded map per place — a plain OpenStreetMap iframe
// (no mapping library; see CLAUDE.md's "no new runtime dependencies" rule)
// centered on that place's own resolved coordinates, when it has any (some
// places only resolve to a `special` marker instead — see domain.GeoPlace's
// doc comment in the API source).
async function openPlacesModal() {
  closeCardsSheet(); // else this modal (.modalscrim, z-index 130) opens beneath the still-open mobile Chapter Info sheet (z-index 425), invisible
  const book = current.book, chapter = current.chapter, label = `${current.bookName} ${chapter}`;
  document.getElementById("placesTitle").textContent = `Places in ${label}`;
  const body = document.getElementById("placesBody");
  body.innerHTML = `<div class="spin"></div>`;
  openModal("placesScrim");
  let places = [];
  try {
    const d = await apiJSONCached(`/geo/${book}/${chapter}`);
    places = d.data || [];
  } catch (e) { /* handled by the empty-state below */ }
  if (current.book !== book || current.chapter !== chapter) return;
  if (!places.length) { body.innerHTML = `<div class="dd-empty">No places found for this chapter.</div>`; return; }
  body.innerHTML = places.map(p => {
    const title = (p.preceding_article ? p.preceding_article + " " : "") + p.name;
    const meta = [p.place_type, p.modern_name ? `modern: ${p.modern_name}` : ""].filter(Boolean).join(" · ");
    const thumb = p.thumbnail ? `<img class="place-thumb" src="${escHtml(p.thumbnail.url)}" alt="${escHtml(p.name)}" onerror="this.remove()">` : "";
    const hasCoords = typeof p.lat === "number" && typeof p.lon === "number";
    const map = hasCoords ? placeMapPreviewHTML(p.lat, p.lon, title) : (p.special ? `<div class="dd-empty">${escHtml(p.special)}</div>` : "");
    // Side by side only when there's actually two things to sit side by
    // side — a lone thumb or lone map keeps its previous full-width look.
    const media = (thumb && map) ? `<div class="place-media-row">${thumb}${map}</div>` : (thumb + map);
    return `<div class="place-entry" data-place-id="${p.id}">
      <div class="place-head"><div class="place-name">${escHtml(title)}</div>${meta ? `<div class="place-meta">${escHtml(meta)}</div>` : ""}</div>
      ${media}
      <div class="place-desc" id="placeDesc${p.id}"><div class="spin" style="margin:6px 0"></div></div>
    </div>`;
  }).join("");
  places.forEach(p => loadPlaceShortDescription(p));
}
// Short Easton's-first blurb + "Read More" into the full Atlas place page
// (Explore > Atlas), rather than duplicating that page's full multi-source
// description here — this card is a preview, the Atlas page is the detail
// view. Loaded per place after the list paints so a slow/missing dictionary
// hit for one place doesn't hold up the others.
async function loadPlaceShortDescription(p) {
  const el = document.getElementById(`placeDesc${p.id}`);
  if (!el) return;
  let entry;
  try { const d = await apiJSON(`/dictionaries/easton?q=${encodeURIComponent(p.name)}`); entry = (d.data || [])[0]; }
  catch (e) { entry = null; }
  if (!el.isConnected) return;
  if (!entry || !entry.definition) { el.remove(); return; }
  const def = entry.definition;
  const short = def.length > 200 ? def.slice(0, 200).replace(/\s+\S*$/, "") + "…" : def;
  el.innerHTML = `<div class="dd-def">${await linkifyCitations(short)}</div><button class="prophecy-origin" onclick="goToAtlasPlace(${p.id})">Read More ›</button>`;
}
function goToAtlasPlace(id) {
  closeModal("placesScrim");
  openExplore();
  switchExploreTab("atlas");
  openAtlasPlace(id);
}
// GET /bible-people/{book}/{chapter} lists every TIPNR-classified person
// mentioned in this chapter, in first-appearance order — TIPNR is a real
// per-person classification, not a heuristic, so (unlike the old
// bible-characters/chapter endpoint this replaces) there's nothing left to
// filter client-side.
let currentChapterPeople = [];
async function loadPeopleCard() {
  try {
    const d = await apiJSONCached(`/bible-people/${current.book}/${current.chapter}`);
    const people = d.data || [];
    currentChapterPeople = people;
    if (!people.length) return null;
    const names = people.slice(0, 4).map(p => escHtml(p.name)).join(", ");
    return railCard("People", names + (people.length > 4 ? ` +${people.length - 4} more` : ""), "openPeopleModal()");
  } catch (e) { currentChapterPeople = []; return null; }
}
// Detail view resolves one name via the exact-match GET /bible-characters/{name}
// lookup — that's the real, permanent API path for a person profile (kept
// distinct from /bible-people, which only ever lists; see biblecharacters.go's
// own doc comment), not something to rename along with the UI. Name-keyed,
// not ustrong — TIPNR disambiguation between two same-named individuals is
// out of scope for this endpoint. A name from the chapter list can still
// occasionally 404 here in principle; shown as a plain empty state, not an
// error, since that's honest API behavior rather than a bug.
let personDetailToken = 0;
function openPeopleModal() {
  closeCardsSheet(); // else this modal opens beneath the still-open mobile Chapter Info sheet — see openPlacesModal
  document.getElementById("peopleBackBtn").style.display = "none";
  document.getElementById("peopleTitle").textContent = `People in ${current.bookName} ${current.chapter}`;
  renderPeopleList();
  openModal("peopleScrim");
}
function renderPeopleList() {
  document.getElementById("peopleBackBtn").style.display = "none";
  document.getElementById("peopleTitle").textContent = `People in ${current.bookName} ${current.chapter}`;
  const body = document.getElementById("peopleBody");
  if (!currentChapterPeople.length) { body.innerHTML = `<div class="dd-empty">No people found for this chapter.</div>`; return; }
  body.innerHTML = currentChapterPeople.map(p =>
    `<button class="person-row" onclick="openPersonDetail('${p.name.replace(/'/g, "\\'")}')">${escHtml(p.name)}<span class="person-row-arrow">›</span></button>`
  ).join("");
}
async function openPersonDetail(name) {
  const token = ++personDetailToken;
  document.getElementById("peopleBackBtn").style.display = "flex";
  document.getElementById("peopleTitle").textContent = name;
  const body = document.getElementById("peopleBody");
  body.innerHTML = `<div class="spin"></div>`;
  let d;
  try { d = await apiJSON(`/bible-characters/${encodeURIComponent(name)}`); }
  catch (e) {
    if (token !== personDetailToken) return;
    body.innerHTML = `<div class="dd-empty">No further details on file for "${escHtml(name)}".</div>`;
    return;
  }
  if (token !== personDetailToken) return;
  body.innerHTML = await renderPersonProfile(d);
  ensurePersonDefLinkified(0);
}
// d is the raw { status, data: BibleCharacter } envelope — data (and every
// field on it) is entirely omitempty, so a real profile can legitimately
// have anywhere from zero to all sections below; nothing here is filtered
// or reshaped, just laid out. Layout runs identity block (epithet, summary,
// a small first/last appearance line) → family (inline name chips per
// relationship) → Key Events (collapsed accordion, the one big/messy block)
// → tabbed definitions: the structured
// data stays compact so the dictionary prose (the bulk of the content) sits
// near the top instead of below a long scroll.
// Definitions' prose (and only that — scripture_refs/citations elsewhere are
// already-structured refs, not free text) goes through linkifyCitations per
// CLAUDE.md's citation rule, one tab at a time; key_events/first/last
// appearance use registerCiteId + one batched fetchVersePreviews call, same
// pattern as the Prophecies modal.
// parents/siblings/partners/children (TIPNR, bible_people_relationships)
// carry no per-edge verse citation — the related person's own name is the
// only thing to show, so those rows just drill into that name's own
// profile via openPersonDetail rather than jumping to a verse.
async function renderPersonProfile(d) {
  const c = d && d.data;
  if (!c) return `<div class="dd-empty">No further details on file for this name.</div>`;
  const bookName = usfm => (bookList.find(b => b.usfm === usfm) || {}).name || usfm;

  const refs = [];
  (c.key_events || []).forEach(e => { if (e.verses && e.verses[0]) refs.push(e.verses[0]); });
  if (c.first_appearance) refs.push(c.first_appearance);
  if (c.last_appearance) refs.push(c.last_appearance);
  const previewByRef = await fetchVersePreviews(refs);

  const out = [];

  // Identity block — epithet, one-sentence summary, and a small first/last
  // appearance line. NB the appearance refs come from the API's name-matched
  // Nave/Torrey citation range, not a true narrative first/last mention (see
  // NOTES.md) — rendered as-is, not second-guessed here.
  const eyebrow = c.tribe_nation || (c.gender ? c.gender[0].toUpperCase() + c.gender.slice(1) : "");
  const summaryText = c.brief || c.summary || c.briefest || c.short || c.description || "";
  const appearItem = (label, v) => {
    if (!v) return "";
    const refLabel = `${bookName(v.book)} ${v.chapter}:${v.verse}`;
    const text = previewByRef[`${v.book}.${v.chapter}.${v.verse}`];
    const citeAttr = text ? ` data-cite-id="${registerCiteId(refLabel, text)}"` : "";
    return `<span class="person-appear-item"><span class="person-appear-label">${escHtml(label)}</span> <button class="person-appear-ref"${citeAttr} onclick="closeModal('peopleScrim');jumpToVerse('${v.book}',${v.chapter},${v.verse})">${escHtml(refLabel)}</button></span>`;
  };
  const appearParts = [appearItem("First appearance", c.first_appearance), appearItem("Last appearance", c.last_appearance)].filter(Boolean);
  if (eyebrow || summaryText || appearParts.length) {
    out.push(`<div class="person-id">${eyebrow ? `<div class="person-id-eyebrow">${escHtml(eyebrow)}</div>` : ""}${summaryText ? `<div class="person-id-summary">${escHtml(summaryText)}</div>` : ""}${appearParts.length ? `<div class="person-appear">${appearParts.join(`<span class="person-appear-sep"> · </span>`)}</div>` : ""}</div>`);
  }

  // Family — one group per relationship in a 2-up grid, the names as inline
  // chips that wrap (handles a figure with many children). The per-chip
  // relationship label is dropped when it's just the singular of the group
  // heading ("Siblings" → "sibling") but kept when it adds something
  // ("Parents" → "father" / "mother").
  const relChip = (r, groupSingular) => {
    const showRel = r.relationship && r.relationship.toLowerCase() !== groupSingular;
    return `<span class="person-rel-item">${showRel ? `<span class="person-rel-tag">${escHtml(r.relationship)}</span>` : ""}<button class="prophecy-ref" onclick="openPersonDetail('${r.name.replace(/'/g, "\\'")}')">${escHtml(r.name)}</button></span>`;
  };
  const relGroups = [["Parents", "parent", c.parents], ["Siblings", "sibling", c.siblings], ["Partners", "partner", c.partners], ["Children", "child", c.children]]
    .filter(([, , list]) => list && list.length)
    .map(([label, singular, list]) => `<div class="person-rel-group"><div class="person-section-label">${label}</div><div class="person-rel-names">${list.map(r => relChip(r, singular)).join("")}</div></div>`);
  if (relGroups.length) out.push(`<div class="person-rel-groups">${relGroups.join("")}</div>`);

  // Key Events — often 20+ rows of API topical citations, some mislabelled or
  // cross-entity (see NOTES.md), so it stays folded away and sits last before
  // the definitions rather than pushing everything down.
  if (c.key_events && c.key_events.length) {
    const pills = c.key_events.map(e => {
      const v = e.verses && e.verses[0];
      const text = v && previewByRef[`${v.book}.${v.chapter}.${v.verse}`];
      const citeAttr = text ? ` data-cite-id="${registerCiteId(e.citation, text)}"` : "";
      const jump = v ? ` onclick="closeModal('peopleScrim');jumpToVerse('${v.book}',${v.chapter},${v.verse})"` : "";
      return `<button class="prophecy-ref" style="margin:0 6px 8px 0"${citeAttr}${jump}>${e.label ? escHtml(e.label) + ": " : ""}${escHtml(e.citation)}</button>`;
    }).join("");
    out.push(`<div class="person-section">${personAccordion("Key Events", c.key_events.length, pills)}</div>`);
  }

  // Definitions last but visible without a long scroll — tabbed by source
  // rather than stacked. openPersonDetail linkifies the first tab; the rest
  // go through ensurePersonDefLinkified() on tab-click.
  if (c.definitions && c.definitions.length) out.push(personDefsSection(c.definitions));

  return out.length ? out.join("") : `<div class="dd-empty">No further details on file for "${escHtml(c.name)}".</div>`;
}
function personAccordion(label, count, bodyHtml) {
  return `<details class="bg-accordion person-acc"><summary><span>${escHtml(label)} <span class="person-acc-count">${count}</span></span></summary><div class="bg-accordion-body">${bodyHtml}</div></details>`;
}
// Ordered by DICT_SOURCES (Easton's, Smith's, …) with any unknown source
// appended; a person with one entry skips the tab row. Panels render with
// plain escaped text — ensurePersonDefLinkified() swaps in the citation-linked
// HTML for a tab the first time it's shown. A long entry clamps to 6 lines
// with a "Read more".
let personDefs = [];
let personDefLinkified = {};
function personDefsSection(defs) {
  personDefLinkified = {};
  const ordered = [];
  DICT_SOURCES.forEach(s => { const d = defs.find(x => x.source === s.id); if (d) ordered.push({ name: s.name, def: d }); });
  defs.forEach(d => { if (!ordered.some(o => o.def === d)) ordered.push({ name: d.source, def: d }); });
  personDefs = ordered.map(o => ({ name: o.name, definition: o.def.definition || "" }));
  const multi = personDefs.length > 1;
  const btns = multi
    ? `<div class="dict-tab-btns">${personDefs.map((d, i) => `<button type="button" class="filter-chip dict-tab-btn${i === 0 ? " active" : ""}" data-idx="${i}">${escHtml(d.name)}</button>`).join("")}</div>`
    : "";
  const panels = personDefs.map((d, i) => {
    const long = d.definition.length > 480;
    return `<div class="dict-tab-panel${i === 0 ? " active" : ""}" data-idx="${i}">
      ${multi ? "" : `<div class="person-def-src">${escHtml(d.name)}</div>`}
      <div class="person-def-clamp${long ? " clamp" : ""}">
        <div class="person-def-text" id="personDefBody${i}">${escHtml(d.definition)}</div>
        ${long ? `<button type="button" class="person-def-more" onclick="this.closest('.person-def-clamp').classList.add('open')">Read more</button>` : ""}
      </div></div>`;
  }).join("");
  return `<div class="person-section dict-tabs"><div class="person-section-label">Definitions</div>${btns}${panels}</div>`;
}
async function ensurePersonDefLinkified(idx) {
  if (personDefLinkified[idx] || !personDefs[idx]) return;
  personDefLinkified[idx] = true;
  const token = personDetailToken;
  const html = await linkifyCitations(personDefs[idx].definition);
  if (token !== personDetailToken) return;
  const el = document.getElementById("personDefBody" + idx);
  if (el) el.innerHTML = html;
}
// The generic .dict-tabs switcher (js/main.js) has already toggled .active by
// the time this fires — this only adds the lazy citation-linking.
document.addEventListener("click", e => {
  const btn = e.target.closest("#peopleBody .dict-tab-btn");
  if (btn) ensurePersonDefLinkified(+btn.dataset.idx);
});
function propheciesForChapter(all, book, chapter) {
  return all.filter(p =>
    (p.origin.book === book && p.origin.chapter === chapter) ||
    (p.fulfilled_in || []).some(f => f.book === book && f.chapter === chapter)
  );
}
// Each prophecy already tells us which side of the pairing a chapter is on
// (p.origin vs. p.fulfilled_in) — flattened here into one line per pairing,
// with a static prefix and the actual citation kept separate so the card
// can wrap just the citation in a hover-preview span, not the whole line.
// The fulfillment-side prefix names *which verse in this chapter* fulfills
// it (e.g. "v.14 fulfills"), not just a bare "Fulfills".
function propheciesEntriesForChapter(all, book, chapter) {
  const entries = [];
  all.forEach(p => {
    if (p.origin.book === book && p.origin.chapter === chapter) {
      (p.fulfilled_in || []).forEach(f => entries.push({ prefix: "→ Fulfilled in ", citation: f.citation, ref: f }));
    }
    (p.fulfilled_in || []).forEach(f => {
      if (f.book === book && f.chapter === chapter) {
        entries.push({ prefix: `v.${f.verse}${f.verse_end ? "-" + f.verse_end : ""} fulfills `, citation: p.origin.citation, ref: p.origin });
      }
    });
  });
  return entries;
}
async function loadPropheciesCard() {
  try {
    const all = await getAllProphecies();
    const entries = propheciesEntriesForChapter(all, current.book, current.chapter);
    if (!entries.length) return null;
    const shown = entries.slice(0, 2);
    const previewByRef = await fetchVersePreviews(shown.map(e => e.ref));
    const lines = shown.map(e => {
      const text = previewByRef[`${e.ref.book}.${e.ref.chapter}.${e.ref.verse}`];
      const citeAttr = text ? ` data-cite-id="${registerCiteId(e.citation, text)}"` : "";
      return `<div class="rc-entry">${escHtml(e.prefix)}<span class="citelink"${citeAttr}>${escHtml(e.citation)}</span></div>`;
    }).join("");
    const more = entries.length > 2 ? `<div class="rc-more">+${entries.length - 2} more</div>` : "";
    return railCard("Prophecies", lines + more, "openPropheciesModal()");
  } catch (e) { return null; }
}
async function openPropheciesModal() {
  closeCardsSheet(); // else this modal opens beneath the still-open mobile Chapter Info sheet — see openPlacesModal
  const book = current.book, chapter = current.chapter, label = `${current.bookName} ${chapter}`;
  document.getElementById("propheciesTitle").textContent = `Prophecies in ${label}`;
  const body = document.getElementById("propheciesBody");
  body.innerHTML = `<div class="spin"></div>`;
  openModal("propheciesScrim");
  const all = await getAllProphecies();
  if (current.book !== book || current.chapter !== chapter) return;
  const matches = propheciesForChapter(all, book, chapter);
  if (!matches.length) { body.innerHTML = `<div class="dd-empty">No prophecies found for this chapter.</div>`; return; }
  // Every match's origin *and* every fulfillment, batched into one preview
  // call rather than resolving each button separately.
  const allRefs = [];
  matches.forEach(p => { allRefs.push(p.origin); (p.fulfilled_in || []).forEach(f => allRefs.push(f)); });
  const previewByRef = await fetchVersePreviews(allRefs);
  body.innerHTML = matches.map(p => {
    const originText = previewByRef[`${p.origin.book}.${p.origin.chapter}.${p.origin.verse}`];
    const originCite = originText ? ` data-cite-id="${registerCiteId(p.origin.citation, originText)}"` : "";
    const fulfillments = (p.fulfilled_in || []).map(f => {
      const text = previewByRef[`${f.book}.${f.chapter}.${f.verse}`];
      const citeAttr = text ? ` data-cite-id="${registerCiteId(f.citation, text)}"` : "";
      return `<button class="prophecy-ref"${citeAttr} onclick="closeModal('propheciesScrim');jumpToVerse('${f.book}',${f.chapter},${f.verse})">${escHtml(f.citation)}</button>`;
    }).join("");
    return `<div class="prophecy-entry">
      <button class="prophecy-origin"${originCite} onclick="closeModal('propheciesScrim');jumpToVerse('${p.origin.book}',${p.origin.chapter},${p.origin.verse})">${escHtml(p.origin.citation)}</button>
      <div class="prophecy-desc">${escHtml(p.description)}</div>
      <div class="prophecy-fulfillments"><span class="pf-label">Fulfilled in</span>${fulfillments}</div>
    </div>`;
  }).join("");
}
async function loadTimelineCard() {
  const all = await getAllChronology();
  const matches = chronologyForChapter(all, current.bookName, current.chapter);
  if (!matches.length) {
    return railCard("Timeline", all.length ? `${all.length} curated events` : "Explore biblical chronology", "openTimelineModal()");
  }
  const shown = matches.slice(0, 2);
  const lines = shown.map(e => {
    const refSpan = e.reference
      ? ` <span class="citelink tl-ref" data-ref="${escAttr(e.reference)}" onmouseenter="resolveTimelineRef(this, this.dataset.ref)">${escHtml(e.reference)}</span>`
      : "";
    return `<div class="rc-entry">${e.date ? escHtml(e.date) + " — " : ""}${escHtml(e.event)}${refSpan}</div>`;
  }).join("");
  const more = matches.length > 2 ? `<div class="rc-more">+${matches.length - 2} more</div>` : "";
  return railCard("Timeline", lines + more, "openTimelineModal()");
}
async function openTimelineModal() {
  closeCardsSheet(); // else this modal opens beneath the still-open mobile Chapter Info sheet — see openPlacesModal
  const book = current.book, chapter = current.chapter, bookName = current.bookName;
  const body = document.getElementById("timelineBody");
  body.innerHTML = `<div class="spin"></div>`;
  openModal("timelineScrim");
  const all = await getAllChronology();
  if (current.book !== book || current.chapter !== chapter) return;
  if (!all.length) { body.innerHTML = `<div class="dd-empty">Could not load the timeline.</div>`; return; }
  const re = new RegExp("^" + bookName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+(\\d+)");
  body.innerHTML = all.map(e => {
    const m = e.reference && e.reference.match(re);
    const isCurrent = m && parseInt(m[1], 10) === chapter;
    const refBtn = e.reference
      ? `<button class="prophecy-ref" style="margin-top:6px" data-ref="${escAttr(e.reference)}" onmouseenter="resolveTimelineRef(this, this.dataset.ref)" onclick="jumpFreeTextRef('${e.reference.replace(/'/g, "\\'")}',()=>closeModal('timelineScrim'))">${escHtml(e.reference)}</button>`
      : "";
    return `<div class="timeline-entry${isCurrent ? " tl-current" : ""}" ${isCurrent ? 'id="tlCurrent"' : ""}>
      <div class="timeline-date">${escHtml(e.date)}</div>
      <div class="timeline-event">${escHtml(e.event)}</div>
      ${refBtn}
    </div>`;
  }).join("");
  const current_ = document.getElementById("tlCurrent");
  if (current_) requestAnimationFrame(() => current_.scrollIntoView({ block: "center" }));
}
// Chronology references are free text ("Genesis 23:1-2"), not a resolved
// book/chapter/verse, so hover-preview can't use the batched
// fetchVersePreviews() the structured-ref cases (Prophecies, Bookmarks,
// Cross-refs) use — there's nothing to batch until it's parsed. Resolved
// lazily on first hover instead of eagerly parsing all ~100 curated entries
// every time the card/modal renders; cached per ref text so hovering the
// same entry again is instant, and once resolved the element carries a
// normal data-cite-id so the generic [data-cite-id] hover listener picks it
// up from then on like anything else.
const timelineRefCache = new Map();
async function resolveTimelineRef(el, refText) {
  if (el.dataset.citeId) return;
  if (timelineRefCache.has(refText)) {
    const data = timelineRefCache.get(refText);
    if (data) attachResolvedTimelineCite(el, data);
    return;
  }
  try {
    const d = await apiJSON(`/parse/citations?text=${encodeURIComponent(refText)}&hydrate=true`);
    const m = (d.citations || [])[0];
    const verses = (m && m.data) || [];
    if (!m || !m.verse || !verses.length) { timelineRefCache.set(refText, null); return; }
    const data = { ref: `${m.name_en} ${m.chapter}:${m.verse}${m.verse_end ? "-" + m.verse_end : ""}`, preview: verses.map(v => v.text).join(" ").trim() };
    timelineRefCache.set(refText, data);
    attachResolvedTimelineCite(el, data);
  } catch (e) { timelineRefCache.set(refText, null); }
}
function attachResolvedTimelineCite(el, data) {
  const id = registerCiteId(data.ref, data.preview);
  el.dataset.citeId = id;
  if (el.matches(":hover")) {
    const d = citePreviewData.get(id);
    showFloatingTooltip(el, `<div class="dt-term">${escHtml(d.ref)}</div>${escHtml(d.preview)}`);
  }
}
// Shared by every "click a free-text reference to jump" call site (Timeline,
// Explore > Collections) — resolves separately from the hover cache above
// (not hydrated; a jump only needs book/chapter/verse, not verse text)
// since a click can fire before hover ever populated it. onClose lets each
// caller close whatever container it's jumping out of.
async function jumpFreeTextRef(refText, onClose) {
  if (!refText) return;
  try {
    const d = await apiJSONCached(`/parse/citations?text=${encodeURIComponent(refText)}`);
    const c = (d.citations || [])[0];
    if (!c) { toast("Could not resolve that reference"); return; }
    if (onClose) onClose();
    await jumpToVerse(c.book, c.chapter, c.verse || 1);
  } catch (e) { /* apiJSON already surfaced the error */ }
}
async function loadSidebarCards() {
  const stack = document.getElementById("cardStack");
  if (!stack) return;
  const [places, people, prophecies, timeline] = await Promise.all([
    loadPlacesCard(), loadPeopleCard(), loadPropheciesCard(), loadTimelineCard()
  ]);
  stack.innerHTML = [places, timeline, people, prophecies].filter(Boolean).join("");
}

/* ═══════════════════════════════════════════════════════════════════════
   ILLUSTRATIONS — floated inline near their tagged verse so the reading
   text wraps around them, like an old illustrated Bible plate. Schnorr
   plates carry a real reference.verse (the start of their tagged range),
   so each one is inserted right before that verse. Which artist pack (or
   none) is a Settings pref — see getIllustPack/setIllustPack in api.js. */
async function loadInlineIllustrations() {
  const pack = getIllustPack();
  if (pack === "off") return;
  try {
    const d = await apiJSONCached(`/illustrations/${current.book}/${current.chapter}?artist=${pack}`);
    const raw = d.data || [];
    // Past this many plates in one chapter (a Matthew 17-style chapter under
    // the Sweet pack can carry 15+), showing every single one turns the
    // chapter into more gallery than reading text — keep a spread instead:
    // first two, middle two, last two, so the chapter's overall illustrated
    // arc still comes through without every plate crowding the column.
    const all = raw.length > 9
      ? raw.slice(0, 2).concat(raw.slice(Math.floor(raw.length / 2) - 1, Math.floor(raw.length / 2) + 1), raw.slice(-2))
      : raw;
    const spans = Array.from(document.querySelectorAll(".verse-span"));
    if (!all.length || !spans.length) return;
    // Not every artist resolves to a specific verse — Schnorr's plates do
    // (a real reference.verse, the start of their tagged range), but Sweet
    // Publishing's are only ever resolved to book+chapter (its own filename
    // convention "never encoded verse precision, only chapter" — see
    // cmd/importillustrations in the backend), so `verse` is absent
    // (omitempty) on every single one of them. Rather than pile every
    // verse-less plate at verse 1 (which quietly overstates precision the
    // source data doesn't have), they're spread evenly across the chapter's
    // verses instead — closer to how printed illustrated Bibles actually
    // worked anyway: a full-page plate couldn't interrupt a verse
    // mid-column, so it landed at the nearest natural break, not pinned to
    // an exact one.
    const unresolvedCount = all.filter(img => !(img.reference && img.reference.verse)).length;
    let unresolvedIdx = 0;
    all.forEach((img, i) => {
      const verse = img.reference && img.reference.verse;
      let target;
      if (verse) {
        target = document.querySelector(`.verse-span[data-verse="${verse}"]`) || spans[0];
      } else {
        const slot = Math.min(spans.length - 1, Math.floor((unresolvedIdx + 0.5) * spans.length / unresolvedCount));
        target = spans[slot];
        unresolvedIdx++;
      }
      insertInlineIllust(target, img, i, target === spans[0]);
    });
  } catch (e) { /* no illustrations on file for this chapter — fine, nothing to show */ }
}
// Re-renders inline illustrations for the chapter already on screen, for
// when the illustration-pack Settings pref changes mid-view (a fresh
// chapter load doesn't need this — its readingText is already illust-free).
function refreshInlineIllustrations() {
  document.querySelectorAll(".inline-illust").forEach(el => el.remove());
  loadInlineIllustrations();
}
function insertInlineIllust(target, img, index, afterTarget) {
  if (!target) return;
  const fig = document.createElement("div");
  fig.className = "inline-illust" + (index % 2 === 0 ? " illust-left" : "");
  // A staged work can have a DB row (so it passes the API's own "any
  // illustrations here?" check) without its image object actually having
  // landed in storage yet — onerror removes the whole figure rather than
  // leaving a broken-image icon and an orphaned caption sitting in the
  // reading column.
  fig.innerHTML = `<img src="${escHtml(img.url)}" alt="${escHtml(img.caption || "")}" onerror="this.closest('.inline-illust').remove()"><div class="cap">${escHtml(img.caption || "")}${img.artist ? ` — ${escHtml(img.artist)}` : ""}</div>`;
  // A plate tagged to the chapter's first verse would otherwise land above
  // the dropcap, before any text has rendered at all — insert it after that
  // verse instead so the opening sentence reads before the image does.
  if (afterTarget) target.parentNode.insertBefore(fig, target.nextSibling);
  else target.parentNode.insertBefore(fig, target);
}

/* ═══════════════════════════════════════════════════════════════════════
   STORY TITLES — inline chapter headings for named stories (e.g. "The
   Flood"), inserted right before their resolved starting verse. */
let allStories = null;
async function getAllStories() {
  if (!allStories) {
    try { const d = await apiJSON("/stories"); allStories = d.data || []; }
    catch (e) { allStories = []; }
  }
  return allStories;
}
let storyRefMap = null;
async function resolveStoryRefs(stories) {
  if (storyRefMap) return storyRefMap;
  const cacheKey = "iqb_storyrefs_" + stories.length + "_" + (stories[0] && stories[0].title || "") + "_" + (stories[stories.length - 1] && stories[stories.length - 1].title || "");
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) { storyRefMap = JSON.parse(cached); return storyRefMap; }
  } catch (e) { }

  const map = {};
  const CHUNK = 40;
  for (let i = 0; i < stories.length; i += CHUNK) {
    const chunk = stories.slice(i, i + CHUNK);
    let text = "";
    const offsets = [];
    chunk.forEach(s => { offsets.push({ title: s.title, start: text.length }); text += s.reference + "\n"; });
    try {
      const d = await apiJSON(`/parse/citations?text=${encodeURIComponent(text)}`);
      (d.citations || []).forEach(c => {
        let owner = null;
        for (const o of offsets) { if (o.start <= c.start) owner = o; else break; }
        if (owner && !map[owner.title]) map[owner.title] = { book: c.book, chapter: c.chapter, verse: c.verse || 1 };
      });
    } catch (e) { /* this batch didn't resolve — those stories just get no heading */ }
  }
  storyRefMap = map;
  try { localStorage.setItem(cacheKey, JSON.stringify(map)); } catch (e) { }
  return map;
}
async function loadInlineStoryTitles() {
  try {
    const stories = await getAllStories();
    if (!stories.length) return;
    const refMap = await resolveStoryRefs(stories);
    const spans = Array.from(document.querySelectorAll(".verse-span"));
    if (!spans.length) return;
    stories.forEach(s => {
      const ref = refMap[s.title];
      if (!ref || ref.book !== current.book || ref.chapter !== current.chapter) return;
      const target = document.querySelector(`.verse-span[data-verse="${ref.verse}"]`) || spans[0];
      const h = document.createElement("h3");
      h.className = "story-title-heading";
      h.textContent = s.title;
      target.parentNode.insertBefore(h, target);
    });
    requestAnimationFrame(alignRails);
  } catch (e) { /* stories dataset not available — nothing to insert */ }
}

/* ═══════════════════════════════════════════════════════════════════════
   BOOK ICON — style (or off) is a Settings pref, see getIconStyle/
   setIconStyle in api.js. */
async function loadTopBookIcon() {
  const badge = document.getElementById("chBookIcon");
  const style = getIconStyle();
  if (style === "off") { badge.style.display = "none"; badge.innerHTML = ""; requestAnimationFrame(alignRails); return; }
  badge.style.display = "flex";
  badge.innerHTML = "";
  try {
    const data = await apiJSONCached(`/icons/${current.book}?style=${style}`);
    if (data.url) badge.innerHTML = `<img src="${escHtml(data.url)}" alt="${escHtml(data.name_en || current.bookName)}">`;
  } catch (e) { /* no icon on file for this book — leave the badge blank */ }
  requestAnimationFrame(alignRails);
}

/* ═══════════════════════════════════════════════════════════════════════
   AUDIO — an always-visible inline player (see .inline-audio) rather than
   a toggle button, shown whenever the current version has narration.
   The actual file URL is still only fetched on first Play, not eagerly on
   chapter load, so browsing chapters with no intent to listen costs
   nothing extra. current.version's audio_count (already in the loaded
   catalog) gates whether to show the player at all, cheaply; only when
   that's true do we spend a call finding out how many distinct narrations
   there are, for the voice-picker caret. */
let audioNarrations = [];
// Explicit voice picks, kept per version_id so switching versions doesn't
// carry a stale audio_id over but browsing chapters within the same version
// does — otherwise every chapter change (refreshAudioAvailability runs on
// every loadChapter) would silently reset back to the first narration.
let selectedNarrations = {};
function resetAudioPlayerUI() {
  const el = document.getElementById("audioEl");
  el.pause(); el.removeAttribute("src");
  document.getElementById("audioPlayer").dataset.loaded = "0";
  document.getElementById("scrubFill").style.width = "0%";
  document.getElementById("audioCur").textContent = "0:00";
  document.getElementById("audioDur").textContent = "0:00";
  document.getElementById("playBtn").innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>`;
}
async function refreshAudioAvailability() {
  resetAudioPlayerUI();
  const wrap = document.getElementById("audioPlayer");
  const narrationBtn = document.getElementById("btnPickNarration");
  narrationBtn.style.display = "none";
  audioNarrations = [];
  current.audioId = null;
  const v = (catalog || []).find(x => x.version_id === current.version);
  const hasAudio = v && v.audio_count > 0;
  wrap.style.display = hasAudio ? "flex" : "none";
  if (!hasAudio) return;
  current.audioId = current.version;
  try {
    const d = await apiJSONCached(`/audio?version_id=${current.version}`);
    audioNarrations = d.data || [];
    if (audioNarrations.length) {
      const pref = selectedNarrations[current.version];
      current.audioId = (pref && audioNarrations.some(n => n.audio_id === pref)) ? pref : audioNarrations[0].audio_id;
    }
    if (audioNarrations.length > 1) narrationBtn.style.display = "flex";
  } catch (e) { /* discovery call failed — fall back to the version id itself as the audio id */ }
}
function openNarrationPicker() {
  const list = document.getElementById("narrationList");
  list.innerHTML = audioNarrations.map(n => `
    <div class="vrow${n.audio_id === current.audioId ? " on" : ""}" onclick="selectNarration('${n.audio_id}')">
      <div><div class="vt">${escHtml(n.narrator || n.audio_id)}</div></div>
    </div>`).join("");
  openModal("narrationPickerScrim");
}
function selectNarration(audioId) {
  current.audioId = audioId;
  selectedNarrations[current.version] = audioId;
  closeModal("narrationPickerScrim");
  resetAudioPlayerUI();
}
async function toggleAudio() {
  const el = document.getElementById("audioEl");
  const wrap = document.getElementById("audioPlayer");
  if (wrap.dataset.loaded !== "1") {
    try {
      const data = await apiJSON(`/audio/${current.audioId || current.version}/${current.book}/${current.chapter}`);
      el.src = data.file;
      wrap.dataset.loaded = "1";
      el.ontimeupdate = () => {
        document.getElementById("audioCur").textContent = fmtTime(el.currentTime);
        document.getElementById("scrubFill").style.width = (el.duration ? (el.currentTime / el.duration * 100) : 0) + "%";
      };
      el.onloadedmetadata = () => { document.getElementById("audioDur").textContent = fmtTime(el.duration); };
    } catch (e) {
      if (e.message !== "no_api_key") toast("No narration available for this version/chapter");
      return;
    }
  }
  if (el.paused) { el.play(); document.getElementById("playBtn").innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`; }
  else { el.pause(); document.getElementById("playBtn").innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>`; }
}
function seekAudio(e) {
  const el = document.getElementById("audioEl");
  if (!el.duration) return;
  const rect = document.getElementById("scrubTrack").getBoundingClientRect();
  el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration;
}

/* ═══════════════════════════════════════════════════════════════════════
   DICTIONARY TERMS — subtly underlines chapter words that have a real
   Easton's entry. Checks capitalized words only (proper nouns are the
   overwhelming majority of actual entries, and it keeps the candidate count
   sane) against Easton's alone — the most comprehensive of the five
   sources, not all five — via one GET /dictionaries/easton/bulk?terms=
   call per chapter (below the endpoint's 100-term cap, since candidates are
   already capped at 60) rather than one call per word. Capped at 60
   distinct candidates per chapter as a safety valve against genealogy-heavy
   chapters; results are cached by term for the rest of the session, since
   common words (God, Lord, Israel...) recur across nearly every chapter. */
const termDefCache = new Map();
async function markDictionaryTerms() {
  const root = document.getElementById("readingText");
  if (!root) return;
  // The lookup can still be in flight when the reader moves to a different
  // chapter — book/chapter are snapshotted so a stale result never marks up
  // whatever chapter happens to be on screen by the time it resolves.
  const requestBook = current.book, requestChapter = current.chapter;
  const words = Array.from(new Set((root.textContent || "").match(/\b[A-Z][a-zA-Z']{2,}\b/g) || []));
  const candidates = words.filter(w => !termDefCache.has(w.toLowerCase())).slice(0, 60);
  if (candidates.length) {
    try {
      const d = await apiJSON(`/dictionaries/easton/bulk?terms=${candidates.map(encodeURIComponent).join(",")}`);
      const byTerm = new Map((d.data || []).map(e => [e.term.toLowerCase(), e.definition]));
      candidates.forEach(w => termDefCache.set(w.toLowerCase(), byTerm.get(w.toLowerCase()) ?? null));
    } catch (e) {
      candidates.forEach(w => termDefCache.set(w.toLowerCase(), null));
    }
  }
  if (current.book !== requestBook || current.chapter !== requestChapter) return;
  applyDictionaryMarks(words);
}
function applyDictionaryMarks(words) {
  const hits = new Set(words.map(w => w.toLowerCase()).filter(w => termDefCache.get(w)));
  if (!hits.size) return;
  const re = new RegExp("\\b(" + Array.from(hits).map(h => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b", "gi");
  const root = document.getElementById("readingText");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(node => {
    re.lastIndex = 0;
    if (!re.test(node.nodeValue)) return;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = re.exec(node.nodeValue))) {
      if (m.index > last) frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
      const span = document.createElement("span");
      span.className = "dict-term";
      span.textContent = m[0];
      span.dataset.term = m[0];
      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    if (last < node.nodeValue.length) frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
}

/* ── dictionary tooltip + term modal — hovering a .dict-term shows a
   brand-styled tooltip (replacing the native title attribute) with a
   truncated definition; clicking opens a modal with a tab per dictionary
   source so the reader can compare all five for the same word. The five
   ids/names are fixed data (GET /dictionaries lists the same five sources
   this API has shipped since launch), not worth a network round-trip to
   populate a five-item, essentially-static tab bar. ── */
const DICT_SOURCES = [
  { id: "easton", name: "Easton's" },
  { id: "smith", name: "Smith's" },
  { id: "hastings", name: "Hastings'" },
  { id: "hitchcock", name: "Hitchcock's" },
  { id: "schaff", name: "Schaff's" },
];
// Shared by both the dictionary-term tooltip and the citation-preview
// tooltip below (linkifyCitations) — one floating element, positioned above
// whatever's hovered (or below, if there's no room above).
function showFloatingTooltip(el, html) {
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
function hideFloatingTooltip() { document.getElementById("dictTooltip").classList.remove("show"); }
function showDictTooltip(el) {
  const term = el.dataset.term;
  const def = termDefCache.get(term.toLowerCase()) || "";
  const short = def.length > 160 ? def.slice(0, 160).replace(/\s+\S*$/, "") + "…" : def;
  showFloatingTooltip(el, `<div class="dt-term">${escHtml(term)}</div>${escHtml(short)}<div class="dt-more">Click for full definition</div>`);
}
// [data-cite-id] rather than .citelink specifically — decouples the hover
// mechanic from that one visual style, so it can be reused on differently-
// styled elements too (e.g. the pill-button cross-reference list in Verse
// Tools, which needs its own button look, not a dotted-underline citelink).
document.addEventListener("mouseover", e => {
  const cite = e.target.closest("[data-cite-id]");
  if (cite && cite.dataset.citeId) {
    const d = citePreviewData.get(cite.dataset.citeId);
    if (d) showFloatingTooltip(cite, `<div class="dt-term">${escHtml(d.ref)}</div>${escHtml(d.preview)}`);
    return;
  }
  const el = e.target.closest(".dict-term");
  if (el) showDictTooltip(el);
});
document.addEventListener("mouseout", e => {
  if (e.target.closest("[data-cite-id]") || e.target.closest(".dict-term")) hideFloatingTooltip();
});

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
async function linkifyCitations(text) {
  if (!text || !text.trim()) return escHtml(text || "");
  let matches;
  try {
    const d = await apiJSON(`/parse/citations?text=${encodeURIComponent(text)}&hydrate=true`);
    matches = d.citations || [];
  } catch (e) { return escHtml(text); }
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
    // A bare "Book chapter" match (no verse) or a wide range previews poorly
    // as a hover popup — too much text for "hover to check a verse" to stay
    // useful — so those are left as plain, unlinked text.
    if (!m.verse || !verses.length || verses.length > 6) return;
    html += escHtml(text.slice(last, start));
    const verseText = verses.map(v => v.text).join(" ").trim();
    const ref = `${m.name_en} ${m.chapter}:${m.verse}${m.verse_end ? "-" + m.verse_end : ""}`;
    const id = registerCiteId(ref, verseText);
    html += `<span class="citelink" data-cite-id="${id}">${escHtml(m.raw)}</span>`;
    last = m.end;
  });
  html += escHtml(text.slice(last));
  return html;
}

/* ── notes: a small Markdown subset ─────────────────────────────────────────
   Notes (the drawer and My Library) are written in plain text and stored that
   way — only the read view renders them. Citations are wrapped first
   (linkifyCitations — the one shared path, never a local parser), then this
   pass runs over that HTML with each .citelink span pulled out as an opaque
   token so a stray * or _ beside a verse label can't be read as formatting.
   Deliberately tiny: **bold**, *italic*, `code`, #-headings, - / 1. lists,
   > quotes, --- rules, [text](url). No dependency, no [[wikilinks]] yet. */
function ndMdInline(s) {
  const code = [];
  s = s.replace(/`([^`\n]+?)`/g, (m, c) => { code.push(c); return `\u0001${code.length - 1}\u0001`; });
  s = s.replace(/\[([^\]\n]+?)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    (m, t, u) => `<a href="${u}" target="_blank" rel="noopener nofollow">${t}</a>`);
  s = s.replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/\u0001(\d+)\u0001/g, (m, i) => `<code>${code[+i]}</code>`);
  return s;
}
function ndMarkdownToHtml(escaped, rawText) {
  // escaping and citation-wrapping never touch newlines, so the raw note's
  // lines line up index-for-index with `src` — walk them in parallel to keep
  // data-sl an offset into the *stored* text, not the escaped HTML.
  const rawLines = (rawText != null ? rawText : escaped).split("\n");
  const tok = [];
  const src = escaped.replace(/<span class="citelink"[^>]*>[\s\S]*?<\/span>/g, m => {
    tok.push(m); return `\u0000${tok.length - 1}\u0000`;
  });
  const out = [];
  // para/quote/fence hold {at, lines:[]}; list holds {tag, items:[{at,t}]}.
  // `at` is the source offset the block's first line starts at (data-sl).
  let para = null, list = null, quote = null, fence = null;
  const flushPara = () => { if (para) { out.push(`<p data-sl="${para.at}">${ndMdInline(para.lines.join("<br>"))}</p>`); para = null; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map(it => `<li data-sl="${it.at}">${ndMdInline(it.t)}</li>`).join("")}</${list.tag}>`); list = null; } };
  const flushQuote = () => { if (quote) { out.push(`<blockquote data-sl="${quote.at}">${ndMdInline(quote.lines.join("<br>"))}</blockquote>`); quote = null; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  let at = 0;
  src.split("\n").forEach((raw, i) => {
    const start = at;
    at += (rawLines[i] != null ? rawLines[i].length : raw.length) + 1;
    const line = raw.replace(/\s+$/, "");
    if (fence !== null) {
      if (/^```/.test(line)) { out.push(`<pre data-sl="${fence.at}"><code>${fence.lines.join("\n")}</code></pre>`); fence = null; }
      else fence.lines.push(raw);
      return;
    }
    if (/^```/.test(line)) { flushAll(); fence = { at: start, lines: [] }; return; }
    if (!line.trim()) { flushAll(); return; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flushAll(); const n = h[1].length + 1; out.push(`<h${n} data-sl="${start}">${ndMdInline(h[2])}</h${n}>`); return; }
    if (/^([-*_])(\s*\1){2,}\s*$/.test(line)) { flushAll(); out.push("<hr>"); return; }
    const q = line.match(/^&gt;\s?(.*)$/); // '>' is already escaped by linkifyCitations
    if (q) { flushPara(); flushList(); (quote = quote || { at: start, lines: [] }).lines.push(q[1]); return; }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara(); flushQuote();
      const tag = ul ? "ul" : "ol";
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push({ at: start, t: ul ? ul[1] : ol[1] });
      return;
    }
    flushList(); flushQuote();
    (para = para || { at: start, lines: [] }).lines.push(line);
  });
  if (fence !== null) out.push(`<pre data-sl="${fence.at}"><code>${fence.lines.join("\n")}</code></pre>`);
  flushAll();
  return out.join("").replace(/\u0000(\d+)\u0000/g, (m, i) => tok[+i] || "");
}
async function renderNoteMarkdown(text) {
  if (!text || !text.trim()) return "";
  return ndMarkdownToHtml(await linkifyCitations(text), text);
}
// Flatten the Markdown subset to plain text for a one-line label (launcher
// pill, switcher/list titles) — so a note that opens with "### …" or "- …"
// reads as a sentence, not as raw source.
function stripNoteMarkdown(s) {
  return (s || "")
    .replace(/^\s*#{1,6}\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .replace(/^\s*([-*_])\s*(\1\s*){2,}$/, "")            // hr
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

// Commentary (GET /commentaries/...) and dictionary (GET /dictionaries/{id}
// ?q=...) entries already carry a server-parsed `citations` array over their
// own Text/Definition (same scanCitations engine /parse/citations uses, run
// once at fetch time) — reusing it here means never re-sending that prose
// through /parse/citations, which both avoids a redundant call and sidesteps
// its ?text= length cap entirely (long-form commentary routinely exceeds
// it). Unlike linkifyCitations, hydration isn't included server-side for
// these, so verse text is fetched here via the same batched
// fetchVersePreviews() every other "ref already known" call site uses.
async function linkifyPreParsedCitations(text, citations) {
  if (!text) return escHtml(text || "");
  // Same "too wide to preview usefully" cutoff linkifyCitations applies,
  // plus a bare chapter-only match (no m.verse) has nothing to preview.
  const matches = (citations || []).filter(m => m.verse && (m.verse_end || m.verse) - m.verse + 1 <= 6);
  if (!matches.length) return escHtml(text);

  const refs = [];
  const seen = new Set();
  matches.forEach(m => {
    const end = m.verse_end || m.verse;
    for (let v = m.verse; v <= end; v++) {
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
    const end = m.verse_end || m.verse;
    const verseTexts = [];
    for (let v = m.verse; v <= end; v++) {
      const t = previewByRef[`${m.book}.${m.chapter}.${v}`];
      if (t) verseTexts.push(t);
    }
    if (!verseTexts.length) return;
    html += escHtml(text.slice(last, start));
    const ref = `${m.name_en} ${m.chapter}:${m.verse}${m.verse_end ? "-" + m.verse_end : ""}`;
    const id = registerCiteId(ref, verseTexts.join(" ").trim());
    html += `<span class="citelink" data-cite-id="${id}">${escHtml(m.raw)}</span>`;
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
async function fetchVersePreviews(refs) {
  if (!refs.length) return {};
  const refStrings = refs.map(r => `${r.book}.${r.chapter}.${r.verse}`);
  const out = {};
  try {
    const bd = await apiJSONCached(`/bibles/${current.version}/verses?refs=${refStrings.join(",")}`);
    const notFound = new Set(bd.not_found || []);
    refStrings.filter(r => !notFound.has(r)).forEach((r, i) => { if (bd.data[i]) out[r] = bd.data[i].text; });
  } catch (e) { /* preview text is a nice-to-have; refs still work without it */ }
  return out;
}

const dictTabCache = new Map();
let dictModalTerm = null;
let dictModalToken = 0;
function openDictTermModal(term) {
  hideFloatingTooltip();
  dictModalTerm = term;
  document.getElementById("dictTermTitle").textContent = term;
  const eastonDef = termDefCache.get(term.toLowerCase());
  if (eastonDef) dictTabCache.set("easton:" + term.toLowerCase(), { definition: eastonDef });
  document.getElementById("dictTabs").innerHTML = DICT_SOURCES.map(s =>
    `<button class="dicttab${s.id === "easton" ? " on" : ""}" data-dict="${s.id}" onclick="selectDictTab('${s.id}')">${s.name}</button>`
  ).join("");
  openModal("dictTermScrim");
  loadDictTab("easton");
}
document.addEventListener("click", e => {
  const el = e.target.closest(".dict-term");
  if (el) openDictTermModal(el.dataset.term);
});
function selectDictTab(id) {
  document.querySelectorAll("#dictTabs .dicttab").forEach(b => b.classList.toggle("on", b.dataset.dict === id));
  loadDictTab(id);
}
// Both the search term and the tab can change while a lookup is still in
// flight (fast tab-clicking, or closing and reopening on a different word)
// — token-gated the same way markDictionaryTerms guards its own async gap,
// so a slow response can never overwrite what's now on screen.
async function loadDictTab(id) {
  const term = dictModalTerm;
  const token = ++dictModalToken;
  const body = document.getElementById("dictBody");
  body.innerHTML = `<div class="spin"></div>`;
  const cacheKey = id + ":" + term.toLowerCase();
  let entry = dictTabCache.get(cacheKey);
  if (entry === undefined) {
    try {
      const d = await apiJSON(`/dictionaries/${id}?q=${encodeURIComponent(term)}`);
      entry = (d.data || [])[0] || null;
    } catch (e) { entry = null; }
    dictTabCache.set(cacheKey, entry);
  }
  if (token !== dictModalToken) return;
  if (!entry) {
    body.innerHTML = `<div class="dd-empty">No entry for "${escHtml(term)}" in this dictionary.</div>`;
    return;
  }
  const src = DICT_SOURCES.find(s => s.id === id);
  const defHtml = await linkifyPreParsedCitations(entry.definition || "", entry.citations);
  if (token !== dictModalToken) return;
  body.innerHTML = `<div class="dd-meta">${escHtml(src ? src.name : id)}</div><div class="dd-def">${defHtml}</div>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   VERSE SELECTION + VERSE TOOLS — click a verse number (.vnum, not the verse
   text itself, so this can't interfere with clicking a dict-term inside the
   verse) to select it; shift-click extends a contiguous range from the last
   click. The panel (#verseToolsPanel, a non-blocking floating panel, not a
   modal — see its HTML comment) pops up the instant a selection exists, no
   separate "open" click, with Highlight/Bookmark/Note/Copy/Share acting on
   every selected verse and Original Language/Cross-refs/Commentary/Compare/
   Topics — each a real verse-scoped concept — showing content for the first
   selected verse (the panel title always names the full range). Because the
   panel isn't a blocking modal, the reading text stays clickable while it's
   open, so shift-click can keep extending the range after the panel is
   already showing. */
let selectedVerses = [];
let lastClickedVerse = null;

function verseKey(book, chapter, verse) { return `${book}:${chapter}:${verse}`; }
// Compresses a possibly-disjoint verse-number array into comma-separated
// dash-ranges — [1,2,3,5,6,7] -> "1-3, 5-7", a single verse stays bare.
// Shared by selectionRefLabel() (current selection) and the Notes browser
// (arbitrary stored notes), so the range-label logic only lives once.
function compressVerseRanges(verses) {
  if (!verses.length) return "";
  const sorted = [...verses].sort((a, b) => a - b);
  const parts = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const v = sorted[i];
    if (v === prev + 1) { prev = v; continue; }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    if (v !== undefined) { start = v; prev = v; }
  }
  return parts.join(", ");
}
function selectionRefLabel() {
  if (!selectedVerses.length) return "";
  return `${current.bookName} ${current.chapter}:${compressVerseRanges(selectedVerses)}`;
}
// A plain click toggles that one verse's membership in the selection (add
// if absent, remove if present) — so several separate clicks build up a
// disjoint multi-selection, not just one verse at a time. Shift-click
// extends a contiguous run from the last-clicked verse and unions it into
// whatever's already selected, rather than replacing it, so a range can be
// added on top of an existing scattered selection (click 1, click 5,
// shift-click 7 -> {1,5,6,7}).
function selectVerse(v, extend) {
  if (extend && lastClickedVerse != null) {
    const lo = Math.min(lastClickedVerse, v), hi = Math.max(lastClickedVerse, v);
    for (let n = lo; n <= hi; n++) if (!selectedVerses.includes(n)) selectedVerses.push(n);
  } else {
    const idx = selectedVerses.indexOf(v);
    if (idx >= 0) selectedVerses.splice(idx, 1);
    else selectedVerses.push(v);
  }
  selectedVerses.sort((a, b) => a - b);
  lastClickedVerse = v;
  renderVerseSelectionUI();
  if (selectedVerses.length) openVerseTools();
  else clearVerseSelection();
}
function clearVerseSelection() {
  selectedVerses = [];
  lastClickedVerse = null;
  renderVerseSelectionUI();
  const panel = document.getElementById("verseToolsPanel");
  if (panel) panel.classList.remove("show");
}
function closeVerseTools() { clearVerseSelection(); }
function renderVerseSelectionUI() {
  document.querySelectorAll(".verse-span").forEach(el => {
    el.classList.toggle("vsel", selectedVerses.includes(Number(el.dataset.verse)));
  });
  // Keeps the Notes drawer's "Attach <ref>" footer button in sync with the
  // current selection (both selectVerse and clearVerseSelection route here).
  if (typeof ndUpdateAttachButton === "function") ndUpdateAttachButton();
}
// Clicking anywhere in a verse opens Verse Tools for it, not just the small
// superscript number — except a dict-term/citation click, which already has
// its own handler (open the term modal / just a hover preview), and except
// when the click is really the end of a text-selection drag (so copying
// verse text with the mouse doesn't also toggle a selection).
document.addEventListener("click", e => {
  const span = e.target.closest(".verse-span");
  if (!span) return;
  if (e.target.closest(".dict-term") || e.target.closest("[data-cite-id]")) return;
  if (window.getSelection().toString()) return;
  selectVerse(Number(span.dataset.verse), e.shiftKey);
});

/* ── highlights / bookmarks / notes — all local-only (no accounts, no
   backend of this app's own — see CLAUDE.md), keyed by book:chapter:verse
   rather than per-translation, since "I marked this verse" is naturally
   translation-independent. ── */
// Value is { color, createdAt, groupId } — groupId ties every verse
// highlighted in a single action into one My Library entry (same idea as
// bookmarks below). Older saves stored a bare color string, then a
// groupId-less object; both migrate in place, once, the first time it's read
// (groupId:null = its own singleton entry).
function getHighlights() {
  let m;
  try { m = JSON.parse(localStorage.getItem("iqb_highlights") || "{}"); } catch (e) { m = {}; }
  let migrated = false;
  Object.keys(m).forEach(k => {
    if (typeof m[k] === "string") { m[k] = { color: m[k], createdAt: Date.now(), groupId: null }; migrated = true; }
    else if (m[k] && m[k].groupId === undefined) { m[k].groupId = null; migrated = true; }
  });
  if (migrated) setHighlights(m);
  return m;
}
function setHighlights(m) { localStorage.setItem("iqb_highlights", JSON.stringify(m)); }
// Value is { createdAt, groupId } — groupId ties every verse bookmarked in a
// single action (one contiguous or disjoint selection) into one My Library
// entry instead of one card per verse. Older saves stored a bare timestamp,
// or a bare `true` before that; both migrate to the object shape in place,
// once, the first time this is read (groupId:null = its own singleton entry).
function getBookmarks() {
  let m;
  try { m = JSON.parse(localStorage.getItem("iqb_bookmarks") || "{}"); } catch (e) { m = {}; }
  let migrated = false;
  Object.keys(m).forEach(k => {
    if (typeof m[k] !== "object" || m[k] === null) {
      m[k] = { createdAt: typeof m[k] === "number" ? m[k] : 0, groupId: null };
      migrated = true;
    } else if (m[k].groupId === undefined) {
      m[k].groupId = null; migrated = true;
    }
  });
  if (migrated) setBookmarks(m);
  return m;
}
function setBookmarks(m) { localStorage.setItem("iqb_bookmarks", JSON.stringify(m)); }
// Shared by bookmarks and highlights — a single verse-tools action stamps one
// groupId on every verse it touches, so My Library shows it as one entry.
function newAnnotationGroupId() { return "g_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
// Reading history — chapter-level, capped, clearable. A repeat visit to the
// same chapter updates its timestamp in place instead of piling up
// duplicates, so browsing back and forth doesn't flood the list.
function getHistory() { try { return JSON.parse(localStorage.getItem("iqb_history") || "[]"); } catch (e) { return []; } }
function setHistory(arr) { localStorage.setItem("iqb_history", JSON.stringify(arr)); }
function logHistoryVisit() {
  const hist = getHistory();
  const last = hist[hist.length - 1];
  if (last && last.book === current.book && last.chapter === current.chapter) last.visitedAt = Date.now();
  else hist.push({ book: current.book, bookName: current.bookName, chapter: current.chapter, visitedAt: Date.now() });
  if (hist.length > 200) hist.splice(0, hist.length - 200);
  setHistory(hist);
}
// One unified note shape — a document that may be anchored to zero or more
// verses across the whole Bible:
//   { id, title, text, tags:[], notebookId,        // null notebookId = Unfiled
//     anchors:[{book,chapter,verse}],              // 0..n; drives the reading-view note icon
//     version, versionTitle, createdAt, updatedAt }
// `anchors` is the exact verse set (not just start/end) since a plain click
// (not shift-click) can build a disjoint selection — see selectVerse() below.
function getNotes() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem("iqb_notes") || "[]"); } catch (e) { raw = []; }
  if (!Array.isArray(raw)) {
    // Oldest shape: { "book:chapter:verse": "text" }. Migrate once, in place.
    raw = Object.entries(raw).map(([k, text]) => {
      const [book, chapter, verse] = k.split(":");
      return { id: newNoteId(), book, chapter: Number(chapter), verses: [Number(verse)], text, tags: [], createdAt: Date.now(), updatedAt: Date.now() };
    });
  }
  // Second migration: the old two-shape model (verse-tied `{book,chapter,verses}`
  // vs free `{book:null}`) folds into one — the verse becomes an anchor, so the
  // reading-view icon still shows, and every note is now just a document.
  let changed = false;
  raw.forEach(n => {
    if (!Array.isArray(n.anchors)) {
      n.anchors = n.book && Array.isArray(n.verses)
        ? n.verses.map(v => ({ book: n.book, chapter: Number(n.chapter), verse: Number(v) }))
        : [];
      delete n.book; delete n.chapter; delete n.verses;
      changed = true;
    }
    if (n.notebookId === undefined) { n.notebookId = null; changed = true; }
    if (typeof n.title !== "string") { n.title = ""; changed = true; }
  });
  if (changed) setNotes(raw);
  return raw;
}
function setNotes(arr) { localStorage.setItem("iqb_notes", JSON.stringify(arr)); }
function newNoteId() { return "n_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* ── notebooks: named groups a note can belong to (notebookId), local-only.
   Deleting a notebook never deletes its notes — they fall back to Unfiled. ── */
function getNotebooks() {
  try { const a = JSON.parse(localStorage.getItem("iqb_notebooks") || "[]"); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function setNotebooks(arr) { localStorage.setItem("iqb_notebooks", JSON.stringify(arr)); }
function newNotebookId() { return "nb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function createNotebook(name) {
  name = (name || "").trim();
  if (!name) return null;
  const books = getNotebooks();
  const existing = books.find(b => b.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const nb = { id: newNotebookId(), name, createdAt: Date.now() };
  books.push(nb);
  setNotebooks(books);
  return nb;
}
function renameNotebook(id, name) {
  name = (name || "").trim();
  if (!name) return;
  const books = getNotebooks();
  const nb = books.find(b => b.id === id);
  if (nb) { nb.name = name; setNotebooks(books); }
}
function deleteNotebook(id) {
  setNotebooks(getNotebooks().filter(b => b.id !== id));
  const notes = getNotes();
  let touched = false;
  notes.forEach(n => { if (n.notebookId === id) { n.notebookId = null; n.updatedAt = Date.now(); touched = true; } });
  if (touched) setNotes(notes);
}
function notebookName(id) {
  if (!id) return "";
  const nb = getNotebooks().find(b => b.id === id);
  return nb ? nb.name : "";
}

/* ── DATA BACKUP AWARENESS — this app has no accounts/backend (see
   NOTES.md's "generic per-user data store" gap): notes/bookmarks/highlights
   are gone if a visitor clears their browser data or switches devices, with
   no way for the app to know. Rather than stay silent about that, a
   dismissible banner (#dataBackupBanner, same visual family as #keyBanner)
   surfaces it once the first time something is actually saved, then every
   so often afterward if there's still unexported data — same "surface the
   limitation" spirit as the GOLDEN RULE, applied to storage durability
   instead of an API gap. ── */
const EXPORT_REMINDER_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
function totalSavedItemCount() { return Object.keys(getBookmarks()).length + Object.keys(getHighlights()).length + getNotes().length; }
function showDataBackupBanner(text) {
  document.getElementById("dataBackupBannerText").textContent = text;
  document.getElementById("dataBackupBanner").classList.add("show");
}
function dismissDataBackupBanner() { document.getElementById("dataBackupBanner").classList.remove("show"); }
function maybeShowFirstTimeDataWarning() {
  if (localStorage.getItem("iqb_seen_data_warning") === "1") return;
  localStorage.setItem("iqb_seen_data_warning", "1");
  localStorage.setItem("iqb_last_export_reminder", String(Date.now()));
  showDataBackupBanner("Your notes, bookmarks, and highlights are saved only in this browser — no account, no cloud sync. If you clear your browser data or switch devices, they're gone. Export a backup anytime from My Library.");
}
function maybeShowPeriodicBackupReminder() {
  if (localStorage.getItem("iqb_seen_data_warning") !== "1") return;
  if (!getExportReminderEnabled()) return;
  if (!totalSavedItemCount()) return;
  const last = parseInt(localStorage.getItem("iqb_last_export_reminder"), 10) || 0;
  if (Date.now() - last < EXPORT_REMINDER_INTERVAL_MS) return;
  localStorage.setItem("iqb_last_export_reminder", String(Date.now()));
  showDataBackupBanner("It's been a while — consider exporting a backup of your saved notes, bookmarks, and highlights from My Library.");
}

const BOOKMARK_ICON = `<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" stroke="none"><path d="M6 2h12v20l-6-4-6 4V2Z"/></svg>`;
const NOTE_ICON = `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5V4Z"/><path d="M9 10h6M9 14h6"/></svg>`;
// Re-applies every stored highlight/bookmark/note for the chapter now on
// screen — called after every fresh render (loadChapter) and after any
// change made through Verse Tools, so the reading text stays in sync with
// localStorage without a full re-render.
function applyVerseAnnotations() {
  const highlights = getHighlights(), bookmarks = getBookmarks();
  // verse -> covering note, for the chapter on screen only.
  const noteByVerse = {};
  getNotes().forEach(n => {
    (n.anchors || []).forEach(a => {
      if (a.book === current.book && a.chapter === current.chapter) noteByVerse[a.verse] = n;
    });
  });
  document.querySelectorAll(".verse-span").forEach(span => {
    const v = Number(span.dataset.verse);
    const k = verseKey(current.book, current.chapter, v);
    const note = noteByVerse[v];
    span.classList.remove("hl-yellow", "hl-green", "hl-blue", "hl-pink");
    if (highlights[k]) span.classList.add("hl-" + highlights[k].color);
    let badge = span.querySelector(".verse-badge");
    if (bookmarks[k] || note) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "verse-badge";
        // Always trail the marker at the end of the verse — a leading
        // superscript collides with the first verse's big floated .dropcap,
        // and mixing leading/trailing by verse looked inconsistent.
        span.appendChild(badge);
      }
      badge.innerHTML = (bookmarks[k] ? BOOKMARK_ICON : "") + (note ? NOTE_ICON : "");
      badge.onclick = e => {
        e.stopPropagation();
        if (note) {
          // Open the note itself in the drawer — it's a document now, not a
          // verse-scoped annotation.
          setActiveNoteId(note.id);
          openNotesDrawer();
        } else {
          selectedVerses = [v];
          lastClickedVerse = v;
          renderVerseSelectionUI();
          openVerseTools();
        }
      };
    } else if (badge) {
      badge.remove();
    }
  });
}

function openVerseTools() {
  if (!selectedVerses.length) return;
  document.getElementById("vtTitle").textContent = selectionRefLabel();
  document.getElementById("vtBody").innerHTML = "";
  syncHighlightSwatchState();
  compareSessionExtra = [];
  document.getElementById("verseToolsPanel").classList.add("show");
}
// Marks whichever swatch matches the selection's current highlight color
// (only when every selected verse shares the exact same one) so re-opening
// the panel on an already-highlighted verse shows what's already set,
// rather than the swatches always looking blank/unset.
function syncHighlightSwatchState() {
  const map = getHighlights();
  document.querySelectorAll(".vtswatch").forEach(btn => {
    const color = btn.dataset.color;
    btn.classList.toggle("on", selectedVerses.every(v => (map[verseKey(current.book, current.chapter, v)] || {}).color === color));
  });
}
function applyHighlightColor(color) {
  const map = getHighlights();
  const allSame = selectedVerses.every(v => (map[verseKey(current.book, current.chapter, v)] || {}).color === color);
  const groupId = newAnnotationGroupId(), createdAt = Date.now();
  selectedVerses.forEach(v => {
    const k = verseKey(current.book, current.chapter, v);
    if (allSame) delete map[k]; else map[k] = { color, createdAt, groupId };
  });
  setHighlights(map);
  applyVerseAnnotations();
  syncHighlightSwatchState();
  toast(allSame ? "Highlight removed" : "Highlighted");
  if (!allSame) maybeShowFirstTimeDataWarning();
}
function toggleBookmarkSelection() {
  const map = getBookmarks();
  const allBookmarked = selectedVerses.every(v => map[verseKey(current.book, current.chapter, v)]);
  const groupId = newAnnotationGroupId(), createdAt = Date.now();
  selectedVerses.forEach(v => {
    const k = verseKey(current.book, current.chapter, v);
    if (allBookmarked) delete map[k]; else map[k] = { createdAt, groupId };
  });
  setBookmarks(map);
  applyVerseAnnotations();
  toast(allBookmarked ? "Bookmark removed" : "Bookmarked");
  if (!allBookmarked) maybeShowFirstTimeDataWarning();
}
// Verse Tools ▸ Note — pick where the selected verse's reference + text lands:
// a new note, the current (active) note, or an existing one. The append and
// anchor bookkeeping live in addSelectionToNote() (js/notesdrawer.js).
function openNoteTargetPicker() {
  const body = document.getElementById("vtBody");
  body.innerHTML = `
    <div class="vt-note-pick-head">Add <strong>${escHtml(selectionRefLabel())}</strong> to a note</div>
    <button class="setsave" style="margin-top:10px" onclick="addSelectionToNote('new')">+ New note</button>
    <div id="vtNotePickCurrent"></div>
    <input type="text" id="vtNotePickSearch" class="vt-note-tags" style="margin-top:10px" placeholder="Search your notes…" oninput="renderNotePickList()" autocomplete="off">
    <div id="vtNotePickList" class="vt-note-pick-list"></div>`;
  const active = typeof getActiveNote === "function" ? getActiveNote() : null;
  if (active) {
    document.getElementById("vtNotePickCurrent").innerHTML =
      `<button class="vt-note-pick vt-note-pick-current" onclick="addSelectionToNote('current')">Current note — <span>${escHtml(ndNoteLabel(active))}</span></button>`;
  }
  renderNotePickList();
}
function renderNotePickList() {
  const wrap = document.getElementById("vtNotePickList");
  if (!wrap) return;
  const q = (document.getElementById("vtNotePickSearch").value || "").trim().toLowerCase();
  const activeId = typeof getActiveNoteId === "function" ? getActiveNoteId() : "";
  let notes = [...getNotes()].sort((a, b) => b.updatedAt - a.updatedAt).filter(n => n.id !== activeId);
  if (q) notes = notes.filter(n => (n.title || "").toLowerCase().includes(q) || (n.text || "").toLowerCase().includes(q) || (n.tags || []).some(t => t.includes(q)));
  notes = notes.slice(0, q ? 20 : 6);
  wrap.innerHTML = notes.length
    ? notes.map(n => `<button class="vt-note-pick" onclick="addSelectionToNote('${n.id}')">${escHtml(ndNoteLabel(n))}</button>`).join("")
    : (q ? `<div class="vt-note-pick-empty">No notes match.</div>` : "");
}

// Strips the verse number (and, for the first verse in the selection, the
// paragraph mark) out of a rendered .verse-span's own text rather than
// re-fetching — the exact text is already on screen.
function selectionText() {
  return selectedVerses.map(v => {
    const span = document.querySelector(`.verse-span[data-verse="${v}"]`);
    if (!span) return "";
    const clone = span.cloneNode(true);
    clone.querySelectorAll(".vnum,.paramark,.verse-badge").forEach(el => el.remove());
    return clone.textContent.trim();
  }).join(" ");
}
function verseDeepLink(verse, verseEnd) {
  const span = (verseEnd && verseEnd > verse) ? `${verse}-${verseEnd}` : `${verse}`;
  return location.origin + BASE_PATH + "/" + current.book.toLowerCase() + "/" + current.chapter + "/" + span
    + (current.version ? `?v=${encodeURIComponent(current.version)}` : "");
}
// A contiguous multi-verse selection links as a range (/gal/5/14-16); a
// disjoint one (14, 17) can't be expressed in the path, so it falls back to
// the first verse.
function selectionDeepLink() {
  const lo = selectedVerses[0], hi = selectedVerses[selectedVerses.length - 1];
  const contiguous = selectedVerses.length === hi - lo + 1;
  return verseDeepLink(lo, contiguous ? hi : null);
}
function copySelection() {
  const text = `"${selectionText()}" — ${selectionRefLabel()}`;
  navigator.clipboard.writeText(text).then(() => toast("Copied to clipboard"), () => toast("Could not copy"));
}
function copyVerseLink() {
  navigator.clipboard.writeText(selectionDeepLink()).then(() => toast("Link copied to clipboard"), () => toast("Could not copy"));
}
// Verse Tools' own Share panel — the image/embed capability from Share
// Tools (js/share.js), scoped to the current selection instead of a
// separate book/chapter/verse picker. Reuses shareImageURL()/shareEmbedSrc()
// verbatim by driving the same shareToolRef/shareToolTheme state they read,
// rather than rebuilding those query strings a second time here. Renders
// into its own modal (#vtShareScrim), not #vtBody — the small verseToolsPanel
// is left untouched, so closing this modal reverts to whatever tool was open
// there, and there's room for the full set of share actions.
async function showShareTool() {
  shareToolRef = { book: current.book, chapter: current.chapter, verse: selectedVerses[0] };
  shareToolTheme = getTheme() === "dark" ? "dark" : "light";
  openModal("vtShareScrim");
  renderVtShareTool();
}
function renderVtShareTool() {
  const body = document.getElementById("vtShareBody");
  const ref = selectionRefLabel();
  const url = selectionDeepLink();
  const shareText = `"${selectionText()}" — ${ref}`;
  body.innerHTML = `
    <div class="share-fields" style="margin-bottom:10px">
      <button class="filter-chip${shareToolTheme === "light" ? " active" : ""}" onclick="setVtShareTheme('light')">Light</button>
      <button class="filter-chip${shareToolTheme === "dark" ? " active" : ""}" onclick="setVtShareTheme('dark')">Dark</button>
    </div>
    <img class="share-preview" id="vtSharePreviewImg" src="${shareImageURL()}" alt="Verse image preview" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'dd-empty',textContent:'Could not render a preview for this reference.'}))">
    <div class="share-actions">
      <a href="${shareImageURL()}" target="_blank" rel="noopener">Open Full Image ↗</a>
      <button onclick="downloadShareImage()">Download</button>
      <button onclick="copyShareLink()">Copy Image Link</button>
      <button onclick="copyShareEmbed()">Copy Embed Code</button>
      <button onclick="copyVerseLink()">Copy Link</button>
      <a href="mailto:?subject=${encodeURIComponent(ref)}&body=${encodeURIComponent(shareText + "\n" + url)}">Email</a>
      <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">X / Twitter</a>
      <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + url)}" target="_blank" rel="noopener">WhatsApp</a>
    </div>
    <iframe class="share-embed-frame" src="${shareEmbedSrc()}" title="Verse embed preview"></iframe>`;
}
function setVtShareTheme(t) { shareToolTheme = t; renderVtShareTool(); }

/* ── row 2: Original Language / Cross-refs / Commentary / Compare / Topics
   — each a real verse-scoped lookup, shown for the first selected verse.
   Original Language renders into its own modal (#vtOrigLangScrim), same
   "real modal, not squeezed into the small panel" treatment as Share
   above — the interlinear can run long and reads better with room. ── */
async function showOriginalLanguageTool() {
  const book = current.book, chapter = current.chapter, verse = selectedVerses[0];
  document.getElementById("vtOrigLangTitle").textContent = `Original Language — ${current.bookName} ${chapter}:${verse}`;
  openModal("vtOrigLangScrim");
  const body = document.getElementById("vtOrigLangBody");
  body.innerHTML = `<div class="spin"></div>`;
  try {
    const d = await apiJSONCached(`/original-language/${book}/${chapter}/${verse}`);
    const words = d.words || [];
    if (!words.length) { body.innerHTML = `<div class="dd-empty">No original-language text for this verse.</div>`; return; }
    body.innerHTML = `<div class="dd-meta">${escHtml(d.language === "greek" ? "Greek" : "Hebrew")}</div>
      <div class="lang-words">${words.map(w => `
        <div class="lang-word">
          <div class="lw-orig">${escHtml(w.word)}</div>
          ${w.glossary ? `<div class="lw-gloss">${escHtml(w.glossary)}</div>` : ""}
          ${w.strongs_id ? `<button class="lw-strongs" onclick="closeModal('vtOrigLangScrim');closeVerseTools();openWordStudy('${w.strongs_id.replace(/'/g, "\\'")}')">${escHtml(w.strongs_id)}</button>` : ""}
        </div>`).join("")}</div>`;
  } catch (e) { body.innerHTML = `<div class="dd-empty">Could not load original-language text.</div>`; }
}
async function showCrossRefsTool() {
  const book = current.book, chapter = current.chapter, verse = selectedVerses[0];
  const body = document.getElementById("vtBody");
  body.innerHTML = `<div class="spin"></div>`;
  try {
    const d = await apiJSONCached(`/cross-references/${book}/${chapter}/${verse}`);
    const refs = d.data || [];
    if (!refs.length) { body.innerHTML = `<div class="dd-empty">No cross-references for this verse.</div>`; return; }
    const previewByRef = await fetchVersePreviews(refs.map(r => r.reference));
    body.innerHTML = refs.map(r => {
      const t = r.reference;
      const label = `${t.book} ${t.chapter}:${t.verse}${t.verse_end ? "-" + t.verse_end : ""}`;
      const text = previewByRef[`${t.book}.${t.chapter}.${t.verse}`];
      const citeAttr = text ? ` data-cite-id="${registerCiteId(label, text)}"` : "";
      return `<button class="prophecy-ref"${citeAttr} style="margin:0 6px 8px 0" onclick="closeVerseTools();jumpToVerse('${t.book}',${t.chapter},${t.verse})">${escHtml(label)}</button>`;
    }).join("");
  } catch (e) { body.innerHTML = `<div class="dd-empty">Could not load cross-references.</div>`; }
}
async function showTopicsTool() {
  const book = current.book, chapter = current.chapter, verse = selectedVerses[0];
  const body = document.getElementById("vtBody");
  body.innerHTML = `<div class="spin"></div>`;
  try {
    const d = await apiJSONCached(`/topics/${book}/${chapter}/${verse}`);
    const topics = d.data || [];
    if (!topics.length) { body.innerHTML = `<div class="dd-empty">No topics for this verse.</div>`; return; }
    body.innerHTML = topics.map(t => `<button class="topic-chip" onclick="jumpToTopicDetail('${t.name.replace(/'/g, "\\'")}')">${escHtml(t.name)}</button>`).join("");
  } catch (e) { body.innerHTML = `<div class="dd-empty">Could not load topics.</div>`; }
}
// Reuses Explore > Topics' own detail view (openTopicDetail, js/explore.js)
// rather than re-rendering a topic's citation list a second time here —
// this just gets the visitor there instead of calling switchExploreTab
// first (which would fetch/render the full topic list only to immediately
// replace it).
function jumpToTopicDetail(name) {
  closeVerseTools();
  switchMainView("explore");
  exploreActiveTab = "topics";
  document.querySelectorAll("#exploreTabs .lib-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === "topics"));
  openTopicDetail(name);
}
// mhenry/gill are the two commentaries covering all 66 books (see
// GET /commentaries' own doc comment) — preferred defaults, when the
// current book has commentary at all; not every one of the 324 other
// sources covers every book.
let commentarySources = null;
async function getCommentarySources() {
  if (!commentarySources) {
    try { const d = await apiJSON("/commentaries"); commentarySources = d.data || []; }
    catch (e) { commentarySources = []; }
  }
  return commentarySources;
}
async function showCommentaryTool() {
  const book = current.book;
  const body = document.getElementById("vtBody");
  body.innerHTML = `<div class="spin"></div>`;
  const sources = (await getCommentarySources()).filter(s => !s.books || !s.books.length || s.books.includes(book));
  if (!sources.length) { body.innerHTML = `<div class="dd-empty">No commentary source covers this book.</div>`; return; }
  const preferred = sources.find(s => s.name === "mhenry") || sources.find(s => s.name === "gill") || sources[0];
  body.innerHTML = `<select id="vtCommentarySelect" class="vt-source-select" onchange="loadCommentaryText(this.value)">` +
    sources.map(s => `<option value="${escHtml(s.name)}"${s.name === preferred.name ? " selected" : ""}>${escHtml(s.author_name)}</option>`).join("") +
    `</select><div id="vtCommentaryText" style="margin-top:14px"></div>`;
  loadCommentaryText(preferred.name);
}
async function loadCommentaryText(name) {
  const book = current.book, chapter = current.chapter, verse = selectedVerses[0];
  const el = document.getElementById("vtCommentaryText");
  el.innerHTML = `<div class="spin"></div>`;
  try {
    const d = await apiJSONCached(`/commentaries/${name}/${book}/${chapter}/${verse}`);
    const entries = d.entries || [];
    if (!entries.length) { el.innerHTML = `<div class="dd-empty">No entry from this source for this verse.</div>`; return; }
    const paragraphs = await Promise.all(entries.map(e => linkifyPreParsedCitations(e.text || "", e.citations)));
    el.innerHTML = paragraphs.map(p => `<div class="dd-def" style="margin-bottom:14px">${p}</div>`).join("");
  } catch (e) { el.innerHTML = `<div class="dd-empty">Could not load commentary.</div>`; }
}
// Factory default (used until a visitor customizes it in Settings) — a
// handful of widely-available English versions, intersected with what's
// actually in the loaded catalog.
const COMPARE_DEFAULT_IDS = ["eng_kjv", "eng_asv", "eng_web", "eng_bbe", "eng_ylt"];
function getCompareVersions() {
  try {
    const v = JSON.parse(localStorage.getItem("iqb_compare_versions"));
    return Array.isArray(v) ? v : COMPARE_DEFAULT_IDS;
  } catch (e) { return COMPARE_DEFAULT_IDS; }
}
function setCompareVersions(arr) { localStorage.setItem("iqb_compare_versions", JSON.stringify(arr)); }
// One-off additions made from inside Verse Tools > Compare itself, layered
// on top of the persisted default set for just this selection — reset
// whenever a fresh verse/range is selected (openVerseTools) so an addition
// made for one verse doesn't linger on an unrelated one.
let compareSessionExtra = [];
// Shared by the version picker (js/catalog.js, "compare-default"/
// "compare-session" modes) — which list a picked version should land in.
function compareTargetList(mode) { return mode === "compare-default" ? getCompareVersions() : compareSessionExtra; }
function addCompareVersion(id, mode) {
  if (mode === "compare-default") {
    const arr = getCompareVersions();
    if (!arr.includes(id)) { arr.push(id); setCompareVersions(arr); }
    renderSettingsCompareChips();
  } else {
    if (!compareSessionExtra.includes(id)) compareSessionExtra.push(id);
    showCompareTool();
  }
}
function removeCompareVersion(id) {
  setCompareVersions(getCompareVersions().filter(v => v !== id));
  renderSettingsCompareChips();
}
function renderSettingsCompareChips() {
  const row = document.getElementById("settingsCompareChips");
  if (!row) return;
  row.innerHTML = getCompareVersions().map(id => {
    const v = (catalog || []).find(x => x.version_id === id);
    return `<button class="filter-chip active" onclick="removeCompareVersion('${id}')">${escHtml(v ? shortVersionLabel(v.title) : id)} ×</button>`;
  }).join("");
}
async function showCompareTool() {
  const book = current.book, chapter = current.chapter, verse = selectedVerses[0];
  const body = document.getElementById("vtBody");
  body.innerHTML = `<div class="spin"></div>`;
  await loadCatalog();
  const ids = Array.from(new Set([current.version, ...getCompareVersions(), ...compareSessionExtra].filter(id => (catalog || []).some(v => v.version_id === id)))).slice(0, 6);
  try {
    const d = await apiJSONCached(`/bibles/parallel?v=${ids.join(",")}&book=${book}&ch=${chapter}&v_num=${verse}`);
    const rows = d.compare || [];
    if (!rows.length) { body.innerHTML = `<div class="dd-empty">Could not load a comparison for this verse.</div>`; return; }
    body.innerHTML = rows.map(r => {
      const v = (catalog || []).find(x => x.version_id === r.version);
      return `<div class="compare-row"><div class="compare-label">${escHtml(v ? shortVersionLabel(v.title) : r.version)}</div><div class="compare-text">${escHtml(r.text)}</div></div>`;
    }).join("") + `<button class="setsave" style="margin-top:12px" onclick="openVersionPicker('compare-session')">+ Add Version</button>`;
  } catch (e) { body.innerHTML = `<div class="dd-empty">Could not load a comparison for this verse.</div>`; }
}
