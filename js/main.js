/* ═══════════════════════════════════════════════════════════════════════
   GLOBAL WIRING — event listeners that don't belong to any one feature,
   plus the actual init call. Loaded last so every function above already
   exists. */
/* ═══════════════════════════════════════════════════════════════════════
   LEFT NAV MENU — Search/Explore/Study Tools/My Library/Devotionals/Share
   Tools all render inside #readMain as one of #readViewGroup's siblings
   (switchMainView below) rather than a full-page overlay, with the clicked
   item shown .active the same way "Read" always was — Settings included,
   now that it's a full page instead of a modal. The one-off pickers
   (book/chapter/version/etc.) stay as modals — those are quick actions, not
   something to browse. */
function navMenuClick(key) {
  if (key === "read") { switchMainView("read"); return; }
  if (key === "search") { openSearch(); return; }
  if (key === "settings") { openSettings(); return; }
  if (key === "library") { openLibrary(); return; }
  if (key === "explore") { openExplore(); return; }
  if (key === "study") { openStudy(); return; }
  if (key === "share") { openShareTool(); return; }
  if (key === "devotionals") { openDevotionals(); return; }
  if (key === "about") { openAbout(); return; }
  if (key === "plans") { openPlans(); return; }
  if (key === "help") { openHelp(); return; }
  if (key === "progress") { openMyProgress(); return; }
  toast("Coming soon");
}
// The one place that actually shows/hides a .mainview — every openX()/
// closeX() (openSearch/closeSearch, openExplore/closeExplore, etc., one per
// feature file) is a thin wrapper around this plus whatever tab/state setup
// that feature needs on open. Closing Verse Tools on the way out avoids a
// stale panel floating over whatever view comes next — it only ever makes
// sense while the reading text underneath it is visible.
const MAINVIEW_IDS = { search: "searchOverlay", library: "libraryOverlay", explore: "exploreOverlay", study: "studyOverlay", devotionals: "devotionalsView", share: "shareToolView", settings: "settingsView", about: "aboutView", plans: "plansView", help: "helpView", progress: "myProgressView" };
// #readMain is the one shared scrollport for the Read view and every other
// mainview (they all render into it too, just below) — leaving Read for one
// of them and coming back would otherwise land wherever that other view's
// own scroll happened to be. Captured on the way out, restored (next frame,
// so Read's markup is laid out again first) on the way back in; a verse-jump
// landing (scrollHighlightVerse, reader.js) still overrides this right after,
// same as it already overrides a fresh chapter's default scroll position.
let savedReadScrollTop = 0;
let mainViewBeforeSwitch = "read";
const MORE_MENU_KEYS = ["library", "progress", "plans", "devotionals", "help", "about", "settings"];
function switchMainView(key) {
  const readMain = document.getElementById("readMain");
  if (mainViewBeforeSwitch === "read" && key !== "read") savedReadScrollTop = readMain.scrollTop;
  Object.entries(MAINVIEW_IDS).forEach(([k, id]) => document.getElementById(id).classList.toggle("open", k === key));
  document.getElementById("readViewGroup").style.display = key === "read" ? "" : "none";
  // [data-nav], not just .navitem — #mobileFooterNav's buttons and
  // #moreMenuSheet's items (below 1180px) key off the same attribute so they
  // stay in sync with #navrail's own active state for free.
  document.querySelectorAll("[data-nav]").forEach(b => b.classList.toggle("active", b.dataset.nav === key));
  document.getElementById("mfnMoreBtn").classList.toggle("active", MORE_MENU_KEYS.includes(key));
  if (key !== "read") { closeVerseTools(); closeCardsSheet(); }
  mainViewBeforeSwitch = key;
  setMenuHash(key);
  if (key === "read") {
    alignRails(); // re-measure: the rails' offset may be stale from a resize that happened while Read was hidden
    requestAnimationFrame(() => { readMain.scrollTop = savedReadScrollTop; });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   MOBILE NAV (below 1180px) — #mobileFooterNav replaces #navrail;
   #moreMenuSheet is its "More" dropup for the items that don't fit in the
   footer; #rightRail becomes a slide-up sheet (toggled here) instead of a
   static column, reusing the same #cardStack content loadSidebarCards
   (js/reader.js) already fills for the desktop rail. */
// instant skips the slide-in transition (its transform is still mid-flight
// toward "closed" on the very frame a class change lands, so a caller that
// needs to measure the sheet's real position synchronously — the tour, see
// js/tour.js — would otherwise read a stale mid-transition rect). Real user
// interaction never passes it, so opening one by tapping still animates.
function addShowInstant(el, instant) {
  if (!instant) { el.classList.add("show"); return; }
  el.style.transition = "none";
  el.classList.add("show");
  void el.offsetHeight; // force layout before restoring the transition
  el.style.transition = "";
}
function toggleMoreMenu() {
  document.getElementById("moreMenuSheet").classList.contains("show") ? closeMoreMenu() : openMoreMenu();
}
function openMoreMenu(instant) { addShowInstant(document.getElementById("moreMenuSheet"), instant); }
function closeMoreMenu() { document.getElementById("moreMenuSheet").classList.remove("show"); }
function toggleCardsSheet() {
  document.getElementById("rightRail").classList.contains("show") ? closeCardsSheet() : openCardsSheet();
}
function openCardsSheet(instant) {
  addShowInstant(document.getElementById("rightRail"), instant);
  openModal("cardsSheetScrim");
}
function closeCardsSheet() {
  document.getElementById("rightRail").classList.remove("show");
  closeModal("cardsSheetScrim");
}
document.addEventListener("click", e => {
  const sheet = document.getElementById("moreMenuSheet");
  if (sheet.classList.contains("show") && !sheet.contains(e.target) && !e.target.closest("#mfnMoreBtn")) closeMoreMenu();
});

// Keeps --vvh (css/styles.css :root) in sync with the actual visible height
// so mobile modals with a search field (Choose a Translation/Book) can size
// themselves to what's left once the on-screen keyboard opens, instead of a
// plain vh unit that ignores the keyboard and lets content render behind it.
if (window.visualViewport) {
  const syncVVH = () => document.documentElement.style.setProperty("--vvh", window.visualViewport.height + "px");
  syncVVH();
  window.visualViewport.addEventListener("resize", syncVVH);
}

/* About / Help — static mainviews, same shell/pattern as Settings (js/api.js
   openSettings/closeSettings), just no form to save. */
function openAbout() { switchMainView("about"); }
function closeAbout() { switchMainView("read"); }
function openHelp() { switchMainView("help"); }
function closeHelp() { switchMainView("read"); }
/* My Progress — dynamic, see js/progress.js's renderMyProgress(). */
function openMyProgress() { switchMainView("progress"); renderMyProgress(); }
function closeMyProgress() { switchMainView("read"); }

/* Full-view image/map lightbox — shared by inline chapter illustrations
   (Reader) and place photos/maps (Places modal, Explore > Atlas). Only the
   illustration case picks up Settings > Black & White Illustrations (the
   .illust-view class), never a place photo opened the same way. */
function openImageView(url, caption, opts) {
  document.getElementById("imageViewMap").style.display = "none";
  const img = document.getElementById("imageViewImg");
  img.style.display = "";
  img.src = url;
  img.alt = caption || "";
  img.classList.toggle("illust-view", !!(opts && opts.grayscale));
  document.getElementById("imageViewCap").textContent = caption || "";
  openModal("imageViewScrim");
}
// A click inside an <iframe> fires in that frame's own browsing context and
// never bubbles to this document, so the small embedded map preview
// (pointer-events:none, see .place-map-wrap in css/styles.css) can't itself
// be the click target — this opens a larger, real interactive map of the
// same place instead. Leaflet (not OpenStreetMap's own iframe embed, which
// has no language option) so the tile layer can request English place-name
// labels — see leafletPlaceMap below.
let leafletPlaceMap = null;
function openMapView(lat, lon, label) {
  const img = document.getElementById("imageViewImg");
  img.style.display = "none";
  img.src = "";
  const mapEl = document.getElementById("imageViewMap");
  mapEl.style.display = "";
  document.getElementById("imageViewCap").textContent = label || "";
  openModal("imageViewScrim");
  // The modal is display:none up to this point, so Leaflet can't measure
  // the container until it's actually visible — invalidateSize (next frame)
  // is Leaflet's own fix for exactly this "sized while hidden" case.
  if (!leafletPlaceMap) leafletPlaceMap = L.map(mapEl);
  leafletPlaceMap.eachLayer(l => leafletPlaceMap.removeLayer(l));
  // Esri's free World Street Map basemap, not OpenStreetMap's own tiles —
  // see the long comment on staticMapTileURL (js/reader.js) for why: OSM's
  // volunteer tile servers now reject this app's requests outright, and
  // Esri's basemap renders English/Latin place names worldwide instead of
  // whatever script OSM's own data carries for a given region.
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    attribution: 'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>',
    maxZoom: 19,
  }).addTo(leafletPlaceMap);
  L.marker([lat, lon]).addTo(leafletPlaceMap);
  leafletPlaceMap.setView([lat, lon], 8);
  requestAnimationFrame(() => leafletPlaceMap.invalidateSize());
}
function closeImageView() {
  closeModal("imageViewScrim");
}
document.addEventListener("click", e => {
  const img = e.target.closest(".inline-illust img, .place-thumb");
  if (img) { openImageView(img.src, img.alt || "", { grayscale: !!img.closest(".inline-illust") }); return; }
  const mapWrap = e.target.closest(".place-map-wrap");
  if (mapWrap) openMapView(parseFloat(mapWrap.dataset.lat), parseFloat(mapWrap.dataset.lon), mapWrap.dataset.label || "");
});
// Description tabs (Explore > Atlas place detail, one tab per dictionary
// source that had an entry) — a generic delegated switcher so any future
// .dict-tabs widget gets the same behavior for free.
document.addEventListener("click", e => {
  const btn = e.target.closest(".dict-tab-btn");
  if (!btn) return;
  const wrap = btn.closest(".dict-tabs");
  wrap.querySelectorAll(".dict-tab-btn").forEach(b => b.classList.toggle("active", b === btn));
  wrap.querySelectorAll(".dict-tab-panel").forEach(p => p.classList.toggle("active", p.dataset.idx === btn.dataset.idx));
});
// Every search-style input's "×" clear button (see .mclear, css/styles.css)
// routes here rather than each feature file writing its own — clearing just
// means "empty the field and re-fire whatever it already does on input."
function clearSearchInput(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.value = "";
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
}
// Clicking a modal/popup's own backdrop closes it — every .modalscrim gets
// this for free instead of each one wiring its own onclick. Only a direct
// click on the backdrop itself (not something bubbling up from the modal
// content) counts, same test the version/image pickers already used.
document.addEventListener("click", e => {
  if (!e.target.classList.contains("modalscrim")) return;
  if (e.target.id === "imageViewScrim") closeImageView();
  else if (e.target.id === "cardsSheetScrim") closeCardsSheet();
  else closeModal(e.target.id);
});
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); openSearch(); }
  if (e.key === "Escape") {
    switchMainView("read");
    closeProfilePanel();
    closeImageView();
    closeMoreMenu();
    closeCardsSheet();
    if (tourActive) endTour();
    ["bookPickerScrim", "chapterPickerScrim", "versionPickerScrim", "narrationPickerScrim", "dictTermScrim", "placesScrim", "propheciesScrim", "timelineScrim", "apiErrorScrim", "peopleScrim", "fontSizeScrim", "vtShareScrim", "vtOrigLangScrim", "bookInfoScrim", "dayDrawerScrim", "tourWelcomeScrim", "tourAdvancedOfferScrim"].forEach(closeModal);
    closeVerseTools();
    setMenuHash(null);
    // Escape bypasses closeSettings() (goes straight to switchMainView above),
    // so re-apply its "still no key → re-block the app" check here too.
    if (!getApiKey()) showKeyBanner();
  }
});
document.addEventListener("click", e => {
  const wrap = document.getElementById("profileWrap");
  if (wrap && !wrap.contains(e.target)) closeProfilePanel();
});

// Reads the live version straight out of CHANGELOG.md's newest `## [x.y.z]`
// heading, so the footer/About display can't silently drift from an
// un-bumped APP_VERSION constant the way it already had (see this file's own
// CHANGELOG entry). Runs unawaited from init() below — the constant is shown
// first so there's no blank flash, and this only overwrites it on success.
// Fails silently offline/on a fetch error, leaving the constant in place.
async function refreshAppVersionFromChangelog() {
  try {
    const text = await (await fetch("CHANGELOG.md")).text();
    const version = text.match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
    if (!version) return;
    document.getElementById("navVersion").textContent = version;
    document.getElementById("aboutVersion").textContent = version;
  } catch { /* offline or CHANGELOG.md unreachable — keep APP_VERSION shown */ }
}

/* ═══════════════════════════════════════════════════════════════════════
   INIT */
(async function init() {
  document.getElementById("navYear").textContent = new Date().getFullYear();
  document.getElementById("navVersion").textContent = APP_VERSION;
  document.getElementById("aboutVersion").textContent = APP_VERSION;
  refreshAppVersionFromChangelog();
  setTheme(getTheme());
  setFontSize(getFontSize());
  setUiFontSize(getUiFontSize());
  setIllustBW(getIllustBW());
  if (!getApiKey()) { showKeyBanner(); openHashRoute(); return; }
  await Promise.all([loadCatalog(), loadBookAbbreviations()]);
  applyStoredVersion();
  await loadBooks();
  const route = parsePathRoute();
  if (route) {
    const b = bookList.find(x => x.usfm === route.book);
    if (b) { current.book = b.usfm; current.bookName = b.name; }
  }
  await loadChapter(route ? route.chapter : current.chapter, true, route ? route.verse : null);
  openHashRoute();
  maybeShowPeriodicBackupReminder();
  maybeShowTourWelcome();
})();
