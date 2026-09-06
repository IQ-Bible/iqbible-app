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
function navMenuClick(key, tab) {
  if (key === "read") { switchMainView("read"); return; }
  if (key === "search") { openSearch(); return; }
  if (key === "settings") { openSettings(); return; }
  if (key === "library") { openLibrary(tab); return; }
  if (key === "explore") { openExplore(tab); return; }
  if (key === "study") { openStudy(tab); return; }
  if (key === "share") { openShareTool(); return; }
  if (key === "devotionals") { openDevotionals(); return; }
  if (key === "about") { openAbout(); return; }
  if (key === "accessibility") { openAccessibility(); return; }
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
const MAINVIEW_IDS = { search: "searchOverlay", library: "libraryOverlay", explore: "exploreOverlay", study: "studyOverlay", devotionals: "devotionalsView", share: "shareToolView", settings: "settingsView", about: "aboutView", accessibility: "accessibilityView", plans: "plansView", help: "helpView", progress: "myProgressView" };
// #readMain is the one shared scrollport for the Read view and every other
// mainview (they all render into it too, just below) — leaving Read for one
// of them and coming back would otherwise land wherever that other view's
// own scroll happened to be. Captured on the way out, restored (next frame,
// so Read's markup is laid out again first) on the way back in; a verse-jump
// landing (scrollHighlightVerse, reader.js) still overrides this right after,
// same as it already overrides a fresh chapter's default scroll position.
let savedReadScrollTop = 0;
let mainViewBeforeSwitch = "read";
const MORE_MENU_KEYS = ["library", "progress", "plans", "devotionals", "help", "about", "accessibility", "settings"];
function switchMainView(key) {
  const readMain = document.getElementById("readMain");
  if (mainViewBeforeSwitch === "read" && key !== "read") savedReadScrollTop = readMain.scrollTop;
  Object.entries(MAINVIEW_IDS).forEach(([k, id]) => document.getElementById(id).classList.toggle("open", k === key));
  document.getElementById("readViewGroup").style.display = key === "read" ? "" : "none";
  // [data-nav], not just .navitem — #mobileFooterNav's buttons and
  // #moreMenuSheet's items (below 1180px) key off the same attribute so they
  // stay in sync with #navrail's own active state for free.
  document.querySelectorAll("[data-nav]").forEach(b => b.classList.toggle("active", b.dataset.nav === key));
  // Sub-item highlight follows the current view like the parent does — drop any
  // stale one; if this is a tabbed view, its switch*Tab (right after) re-sets it.
  document.querySelectorAll(".navsubitem.active").forEach(b => b.classList.remove("active"));
  document.getElementById("mfnMoreBtn").classList.toggle("active", MORE_MENU_KEYS.includes(key));
  document.getElementById("mfnDiscoverBtn").classList.toggle("active", key === "explore" || key === "study");
  // Navigating into a tabbed section opens its rail submenu (accordion — closes
  // the others); navigating anywhere else closes whatever was open, so an
  // expanded submenu never lingers under a parent that's lost its active state.
  expandedNavGroup = (key === "explore" || key === "study" || key === "library") ? key : null;
  syncNavGroups();
  if (key !== "read") { closeVerseTools(); closeCardsSheet(); }
  document.body.classList.remove("chrome-hidden"); // don't land on another view with the topbar still tucked away
  const leavingToRead = key === "read" && mainViewBeforeSwitch !== "read";
  mainViewBeforeSwitch = key;
  setMenuHash(key);
  if (key === "read") {
    alignRails(); // re-measure: the rails' offset may be stale from a resize that happened while Read was hidden
    requestAnimationFrame(() => { readMain.scrollTop = savedReadScrollTop; });
    // Coming back from an overlay: land keyboard focus on the reading area,
    // not left orphaned on a now-hidden control.
    if (leavingToRead && !readMain.contains(document.activeElement)) {
      try { readMain.focus({ preventScroll: true }); } catch (e) {}
    }
  } else {
    // Opening an overlay: move focus into it so keyboard/SR users start there.
    const view = document.getElementById(MAINVIEW_IDS[key]);
    if (view && !view.contains(document.activeElement)) {
      const target = view.querySelector(".overlay-title, h1, h2") || view.querySelector(".overlay-close");
      if (target) {
        if (!target.hasAttribute("tabindex") && !/^(A|BUTTON)$/.test(target.tagName)) target.tabIndex = -1;
        requestAnimationFrame(() => { try { target.focus({ preventScroll: true }); } catch (e) {} });
      }
    }
  }
}
// Mark the one rail sub-item matching the open view's current tab .active, and
// reflect that tab in the shareable menu hash (#study-tools/word). Called by
// each tabbed overlay's switch*Tab — it's the only place that knows the tab.
function syncNavSub(view, tab) {
  document.querySelectorAll(`.navsubitem[data-navsub="${view}"]`).forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  if (mainViewBeforeSwitch === view) setMenuHash(view, tab);
}
// Rail submenus (Explore/Study Tools/My Library) are a single-open accordion:
// clicking a caret opens that one and closes the others; navigating into a
// section opens it the same way (see switchMainView). No hover-to-open — it
// made the rail reflow as the pointer just passed through on its way elsewhere.
// A collapsed .navsub is inert so its buttons stay out of the tab order.
let expandedNavGroup = null;
function syncNavGroups() {
  document.querySelectorAll(".navgroup").forEach(g => {
    const on = g.dataset.navgroup === expandedNavGroup;
    g.classList.toggle("expanded", on);
    const sub = g.querySelector(".navsub");
    if (sub) sub.inert = !on;
    const t = g.querySelector(".navsub-toggle");
    if (t) t.setAttribute("aria-expanded", on ? "true" : "false");
  });
}
function toggleNavGroup(key) {
  expandedNavGroup = expandedNavGroup === key ? null : key;
  syncNavGroups();
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
// Sheet ⇄ trigger ARIA + focus. Triggers get aria-controls/aria-expanded/
// aria-haspopup; opening a sheet moves focus to its first control, closing it
// hands focus back to whatever opened it (Esc closes via the global handler).
const SHEET_TRIGGER_MAP = {
  moreMenuSheet: ["mfnMoreBtn"],
  discoverHub: ["mfnDiscoverBtn"],
  profilePanel: ["profileTrigger"],
  rightRail: ["btnCardsSheet"],
};
(function initSheetAria() {
  Object.entries(SHEET_TRIGGER_MAP).forEach(([sheet, trigs]) => trigs.forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.setAttribute("aria-controls", sheet); b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-haspopup", "true"); }
  }));
})();
function markSheet(sheetId, open) {
  (SHEET_TRIGGER_MAP[sheetId] || []).forEach(id => {
    const b = document.getElementById(id);
    if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
  });
  const sheet = document.getElementById(sheetId);
  if (!sheet) return;
  if (open) {
    sheet._returnFocus = document.activeElement;
    requestAnimationFrame(() => {
      const f = sheet.querySelector('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
    });
  } else {
    const r = sheet._returnFocus;
    sheet._returnFocus = null;
    if (r && r.isConnected && r.offsetParent !== null && !r.closest("[inert]")) {
      try { r.focus({ preventScroll: true }); } catch (e) {}
    }
  }
}
function toggleMoreMenu() {
  document.getElementById("moreMenuSheet").classList.contains("show") ? closeMoreMenu() : openMoreMenu();
}
function openMoreMenu(instant) { closeDiscoverHub(); addShowInstant(document.getElementById("moreMenuSheet"), instant); markSheet("moreMenuSheet", true); }
function closeMoreMenu() { const s = document.getElementById("moreMenuSheet"); const was = s.classList.contains("show"); s.classList.remove("show"); if (was) markSheet("moreMenuSheet", false); }
// Discover hub — the mobile stand-in for the (removed) Explore/Study footer
// tabs. Same slide-up mechanics as "More"; each entry opens the existing
// overlay at the chosen tab.
function toggleDiscoverHub() {
  document.getElementById("discoverHub").classList.contains("show") ? closeDiscoverHub() : openDiscoverHub();
}
function openDiscoverHub(instant) { closeMoreMenu(); addShowInstant(document.getElementById("discoverHub"), instant); markSheet("discoverHub", true); }
function closeDiscoverHub() { const s = document.getElementById("discoverHub"); const was = s.classList.contains("show"); s.classList.remove("show"); if (was) markSheet("discoverHub", false); }
function discoverGo(which, tab) {
  closeDiscoverHub();
  if (which === "explore") { openExplore(); switchExploreTab(tab); }
  else { openStudy(); switchStudyTab(tab); }
}
function toggleCardsSheet() {
  document.getElementById("rightRail").classList.contains("show") ? closeCardsSheet() : openCardsSheet();
}
function openCardsSheet(instant) {
  addShowInstant(document.getElementById("rightRail"), instant);
  openModal("cardsSheetScrim"); // focus/trap/inert via the dialog manager (data-dialog-content -> #rightRail)
  (SHEET_TRIGGER_MAP.rightRail || []).forEach(id => document.getElementById(id)?.setAttribute("aria-expanded", "true"));
}
function closeCardsSheet() {
  document.getElementById("rightRail").classList.remove("show");
  closeModal("cardsSheetScrim");
  (SHEET_TRIGGER_MAP.rightRail || []).forEach(id => document.getElementById(id)?.setAttribute("aria-expanded", "false"));
}
// #tourOverlay's own Next/Back/Skip buttons live outside #moreMenuSheet by
// design (see js/tour.js's openMoreMenu(true) before() steps) — without this
// exclusion, tapping Next to advance past a step that opened the sheet would
// immediately close it again as an "outside" click, right after the tour
// spotlighted something inside it.
document.addEventListener("click", e => {
  const sheet = document.getElementById("moreMenuSheet");
  if (sheet.classList.contains("show") && !sheet.contains(e.target) && !e.target.closest("#mfnMoreBtn") && !e.target.closest("#tourOverlay")) closeMoreMenu();
  const disc = document.getElementById("discoverHub");
  if (disc.classList.contains("show") && !disc.contains(e.target) && !e.target.closest("#mfnDiscoverBtn") && !e.target.closest("#tourOverlay")) closeDiscoverHub();
});

// Long-press the "Aa" display button = flip the theme in place, skipping the
// Display sheet. A tap still opens the sheet (openFontSizeModal, in the
// button's onclick); the long-press just cancels that by eating the click.
(function initDisplayBtnLongPress() {
  const btn = document.getElementById("displayBtn");
  if (!btn) return;
  let timer = null, fired = false;
  const start = () => { fired = false; timer = setTimeout(() => { fired = true; toggleTheme(); }, 450); };
  const cancel = () => { clearTimeout(timer); };
  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", cancel);
  btn.addEventListener("pointerleave", cancel);
  btn.addEventListener("click", e => { if (fired) { e.preventDefault(); e.stopImmediatePropagation(); fired = false; } }, true);
})();

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
function openAccessibility() { switchMainView("accessibility"); }
function closeAccessibility() { switchMainView("read"); }
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
  // An inline illustration passes its srcset ladder through so the zoomed view
  // lands on a large WebP rung (sizes:100vw) rather than triggering a separate
  // fetch of the multi-MB JPEG master. Place photos pass no srcset — clear any
  // left over from a previous open.
  if (opts && opts.srcset) { img.srcset = opts.srcset; img.sizes = "100vw"; }
  else { img.removeAttribute("srcset"); img.removeAttribute("sizes"); }
  // Reserves the lightbox's box the same way the inline figure does — see
  // inlineIllustHTML (js/reader.js). Absent for place photos and for
  // illustrations the API hasn't backfilled dimensions for yet.
  if (opts && opts.width && opts.height) { img.width = opts.width; img.height = opts.height; }
  else { img.removeAttribute("width"); img.removeAttribute("height"); }
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
  if (img) {
    const inline = img.closest(".inline-illust");
    // Inline plates carry the full srcset ladder; hand it to the lightbox so the
    // zoomed view uses a large WebP rung at sizes:100vw instead of the JPEG
    // master. currentSrc is whichever rung the inline figure already loaded — a
    // fine src fallback while the browser re-picks for the bigger sizes.
    openImageView(inline ? img.currentSrc : img.src, img.alt || "", {
      grayscale: !!inline,
      srcset: inline ? img.getAttribute("srcset") : null,
      width: inline ? img.getAttribute("width") : null,
      height: inline ? img.getAttribute("height") : null,
    });
    return;
  }
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
/* ═══════════════════════════════════════════════════════════════════════
   KEYBOARD OPERABILITY — this app builds most of its list rows, cards and
   pickers as <div class="vrow" onclick> / <div class="railcard" onclick>
   rather than <button>, plus a few delegated-click targets (inline
   illustrations, place thumbnails/maps) that aren't focusable at all.
   Rather than retrofit dozens of HTML-string templates, one pass makes any
   such element focusable + button-roled, and one keydown handler maps
   Enter/Space onto a real click. A MutationObserver re-runs it for content
   rendered later. Native controls (button/a/input/select/textarea) are
   skipped — they already work. */
const DELEGATED_CLICK_SEL = ".inline-illust img, .place-thumb, .place-map-wrap";
function a11yifyClickables(root) {
  const scope = root && root.nodeType === 1 ? root : document;
  const sel = `[onclick]:not(button):not(a):not(input):not(select):not(textarea), ${DELEGATED_CLICK_SEL}`;
  const list = scope.matches && scope.matches(sel) ? [scope] : [];
  scope.querySelectorAll && scope.querySelectorAll(sel).forEach(el => list.push(el));
  list.forEach(el => {
    if (el.closest("button, a[href]")) return; // don't nest a focusable inside a real control
    // A clickable wrapper that itself contains a button/link/field must not
    // become a button too (nested interactive, WCAG 4.1.2). Those need a real
    // structural fix at the template — leave this one alone rather than make
    // the violation worse.
    if (el.querySelector("button, a[href], input, select, textarea, [tabindex]")) return;
    if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
    if (!el.hasAttribute("role")) el.setAttribute("role", "button");
  });
  // Bare "×" glyph buttons — give screen readers a real accessible name.
  (scope.querySelectorAll ? scope.querySelectorAll(".closebtn, .overlay-close, .panel-close") : []).forEach(b => {
    if (!b.getAttribute("aria-label")) b.setAttribute("aria-label", "Close");
  });
}
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const el = e.target;
  if (!el || !el.matches) return;
  if (el.matches("button, a, input, select, textarea")) return;
  if (el.matches(`[onclick], ${DELEGATED_CLICK_SEL}`) || el.getAttribute("role") === "button") {
    e.preventDefault();
    el.click();
  }
});
if (window.MutationObserver) {
  const obs = new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) a11yifyClickables(n);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
}
a11yifyClickables();

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
    // A visible citation/dictionary preview swallows the first Escape (WCAG
    // 1.4.13 — dismissible without moving focus), so it doesn't also collapse
    // whatever view the user is reading in.
    const tip = document.getElementById("dictTooltip");
    if (tip && tip.classList.contains("show")) { hideFloatingTooltip(); return; }
    switchMainView("read");
    closeProfilePanel();
    closeImageView();
    closeMoreMenu();
    closeDiscoverHub();
    closeCardsSheet();
    if (tourActive) endTour();
    ["navPickerScrim", "versionPickerScrim", "narrationPickerScrim", "sleepTimerScrim", "dictTermScrim", "placesScrim", "propheciesScrim", "timelineScrim", "chapterInfoScrim", "apiErrorScrim", "peopleScrim", "fontSizeScrim", "vtShareScrim", "vtOrigLangScrim", "bookInfoScrim", "dayDrawerScrim", "ndMdHelpScrim", "tourWelcomeScrim", "tourAdvancedOfferScrim"].forEach(closeModal);
    closeVerseTools();
    setMenuHash(null);
    // Escape bypasses closeSettings() (goes straight to switchMainView above),
    // so re-apply its "still no key → re-block the app" check here too.
    if (!IS_HOSTED_INSTANCE && !getApiKey()) showKeyBanner();
  }
});
document.addEventListener("click", e => {
  // #profilePanel is a sibling of #topbar now (not inside #profileWrap), so the
  // "outside" test checks the panel itself, its topbar trigger, and the "More"
  // sheet's row that opens it on mobile.
  const panel = document.getElementById("profilePanel");
  if (!panel.classList.contains("show")) return;
  if (!panel.contains(e.target) && !e.target.closest("#profileTrigger") && !e.target.closest(".mm-profile")) closeProfilePanel();
});

// Reads the live version straight out of CHANGELOG.md's newest `## [x.y.z]`
// heading, so the footer/About display can't silently drift from an
// un-bumped APP_VERSION constant the way it already had (see this file's own
// CHANGELOG entry). Runs unawaited from init() below — the constant is shown
// first so there's no blank flash, and this only overwrites it on success.
// Fails silently offline/on a fetch error, leaving the constant in place.
// One version string shows in three places (left-nav footer, the mobile More
// sheet's footer, the About page), so fan it out by attribute rather than id.
function setAppVersionText(v) {
  document.querySelectorAll("[data-app-version]").forEach(el => el.textContent = v);
}
async function refreshAppVersionFromChangelog() {
  try {
    const text = await (await fetch("CHANGELOG.md")).text();
    const version = text.match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
    if (!version) return;
    setAppVersionText(version);
  } catch { /* offline or CHANGELOG.md unreachable — keep APP_VERSION shown */ }
}

/* ═══════════════════════════════════════════════════════════════════════
   INIT */
(async function init() {
  document.querySelectorAll("[data-app-year]").forEach(el => el.textContent = new Date().getFullYear());
  setAppVersionText(APP_VERSION);
  refreshAppVersionFromChangelog();
  setTheme(getTheme());
  setFontSize(getFontSize());
  setUiFontSize(getUiFontSize());
  setIllustBW(getIllustBW());
  syncNavGroups(); // set the collapsed submenus inert before anything can tab into them
  updateLibraryCounts();
  // The hosted instance never gates on a key — its proxy supplies one.
  if (!IS_HOSTED_INSTANCE && !getApiKey()) { showKeyBanner(); openHashRoute(); return; }
  await Promise.all([loadCatalog(), loadBookAbbreviations()]);
  applyStoredVersion();
  const route = parsePathRoute();
  // A `?v=` on the deep link wins over the stored version — resolved before
  // loadBooks() so the book list matches the version the link asked for.
  if (route && route.version && route.version !== current.version && applyVersionById(route.version)) setLastVersion(route.version);
  await loadBooks();
  if (route) {
    const b = bookList.find(x => x.usfm === route.book);
    if (b) { current.book = b.usfm; current.bookName = b.name; }
  }
  await loadChapter(route ? route.chapter : current.chapter, true, route ? route.verse : null, route ? route.verseEnd : null);
  openHashRoute();
  maybeShowPeriodicBackupReminder();
  maybeShowTourWelcome();
})();

// PWA: register the app-shell service worker (sw.js). It caches only static
// assets and never intercepts API calls — see sw.js. Failures are silent;
// the app works identically without it.
if ("serviceWorker" in navigator &&
    (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* not fatal */ });
  });
}
