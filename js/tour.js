/* ═══════════════════════════════════════════════════════════════════════
   TAKE A TOUR — a first-visit welcome dialog (maybeShowTourWelcome, called
   once from main.js's init(), once the app is usable — a key is set, or
   it's the hosted instance where none is needed) plus a dynamic
   step-by-step walkthrough that spotlights real topbar/nav-rail elements
   in place, rather than opening each panel it describes. Re-launchable any
   time from the Help page. No API calls, no persisted state beyond the
   one "have we shown the welcome dialog" flag.

   A second, opt-in ADVANCED_TOUR_STEPS (startAdvancedTour, launched only
   from Help) goes one level deeper — the individual Verse Tools buttons and
   every Explore/Study/Library tab — which means it (unlike the steps below)
   has to actually open those panels/tabs before it can spotlight something
   inside them. Each step can carry an optional before() setup callback for
   that; see the engine notes above renderTourStep(). */
const TOUR_SEEN_KEY = "iqb_tour_seen";
// Shared by every basic/advanced step that targets something inside Verse
// Tools: reuses whatever's already selected (so re-entering this step going
// backward doesn't fight a selection made elsewhere) or falls back to
// whichever verse happens to be on screen first.
function openVerseToolsForTour() {
  switchMainView("read");
  if (!selectedVerses.length) {
    const span = document.querySelector(".verse-span");
    if (span) selectVerse(Number(span.dataset.verse), false);
  } else openVerseTools();
  // The panel's first open of a tour run is otherwise mid-transition (still
  // sliding/fading in, css/styles.css) at the exact moment renderTourStep
  // measures it right after this returns — same "instant" bypass
  // addShowInstant (main.js) uses for #moreMenuSheet/#rightRail, just applied
  // post-hoc since selectVerse/openVerseTools already added the "show" class.
  const panel = document.getElementById("verseToolsPanel");
  panel.style.transition = "none";
  void panel.offsetHeight;
  panel.style.transition = "";
}
// Verse Tools is last, not right after Narration: it's the one step with a
// natural follow-up (see ADVANCED_VERSE_TOOLS_STEPS/tourNext below — landing
// on it right before the tour ends is what lets finishing the tour offer to
// keep going with a per-button breakdown of the same panel, still open).
const TOUR_STEPS = [
  { selector: "#readCol .chhead", title: "Reading", body: "Pick a version, book and chapter up here, then just start reading." },
  { selector: "#audioPlayer", title: "Audio Narration", body: "Versions with narration available show a player — tap play to hear the chapter read aloud." },
  { selector: "#btnPickNarration", title: "Choose a Voice", body: "Some versions have more than one narrator recorded — pick whichever you like." },
  // #cardStack itself (desktop's always-visible sidebar) or #btnCardsSheet
  // (its mobile trigger, css/styles.css) — never both at once, so this
  // doesn't auto-open the sheet the way library/progress/plans/devotionals
  // below open #moreMenuSheet: those reveal a nav item that's the same kind
  // of thing either width, but auto-opening the cards sheet here would hide
  // the one thing mobile users actually need to learn — the button.
  { selector: "#cardStack, #btnCardsSheet", title: "Chapter Context", body: "Places (with maps), people, prophecy fulfillments and a timeline for whatever chapter you're reading. On a phone, tap this button or swipe in from the right edge.", before: () => switchMainView("read") },
  { selector: "#searchTrigger", title: "Search", body: "Tap here any time to search the whole Bible instantly." },
  // Bare [data-nav] (not .navitem) — below 1180px this is #mobileFooterNav's
  // .mfn-item instead of #navrail's (hidden) .navitem, a different class;
  // renderTourStep's target resolution below picks whichever candidate is
  // actually visible.
  { selector: '[data-nav="explore"]', title: "Explore", body: "A Gospel harmony, topic browser, Bible atlas, genealogy explorer and curated collections to wander through." },
  { selector: '[data-nav="study"]', title: "Study Tools", body: "Per-book guides, a Bible-dictionary lookup, a Strong's word study, verse-by-verse commentary and NT textual variants." },
  { selector: '[data-nav="share"]', title: "Share Tools", body: "Turn any verse into a shareable image, link or embeddable widget." },
  // library/progress/plans/devotionals live in both #navrail and (below
  // 1180px) #moreMenuSheet, both as .navitem — opening the "More" dropup
  // first is what makes the mobile copy the visible one of the two.
  { selector: '.navitem[data-nav="library"]', title: "My Library", body: "Every note, bookmark, highlight and visit you make lives here.", before: () => openMoreMenu(true) },
  { selector: '.navitem[data-nav="progress"]', title: "My Progress", body: "A streak calendar, read counts and your active plan's progress, all in one place.", before: () => openMoreMenu(true) },
  { selector: '.navitem[data-nav="plans"]', title: "Reading Plans", body: "Build or import a reading plan, then track it day by day on a calendar.", before: () => openMoreMenu(true) },
  { selector: '.navitem[data-nav="devotionals"]', title: "Devotionals", body: "A new reading each morning and evening, with its own progress tracking.", before: () => openMoreMenu(true) },
  { selector: "#profileTrigger", title: "Your Reading", body: "Streaks and quick stats live here too, with a shortcut back to Settings." },
  // #notesLauncher is display:none while the drawer itself is open — close it
  // first so the step has something to spotlight.
  { selector: "#notesLauncher", title: "Notes", body: "Jot a thought from anywhere — press N or tap here to open the Notes drawer. It autosaves as you type, takes light Markdown (bold, lists, quotes), groups notes into notebooks, and “Note” in Verse Tools drops a verse straight in.", before: () => { switchMainView("read"); if (typeof closeNotesDrawer === "function") closeNotesDrawer(); } },
  // .show (not just #verseToolsPanel) matters: the panel is always in the
  // layout (opacity:0 when closed, css/styles.css), so a bare id selector
  // would report a nonzero rect and get spotlighted even while closed.
  { selector: "#verseToolsPanel.show", title: "Verse Tools", body: "Click anywhere in a verse to open Verse Tools — highlight it, bookmark it, add a note, compare translations, look up the original language, and more.", before: openVerseToolsForTour },
];
// None of these steps click the tool itself — that would fire commentary/
// cross-ref API calls, or actually bookmark/highlight the demo verse, on
// every tour run. Same "point at it, describe it" restraint TOUR_STEPS
// already uses for nav items, just one level deeper. Selectors key off each
// button's existing onclick handler rather than adding data-tool attributes
// nothing else needs. Split into its own array (rather than folded into
// ADVANCED_TOUR_STEPS below) so finishing the basic tour can offer to
// continue with just this slice — see acceptAdvancedOffer().
const ADVANCED_VERSE_TOOLS_STEPS = [
  { selector: "#verseToolsPanel.show .vtcolors", title: "Highlight", body: "Tap a color — yellow, green, blue or pink — to highlight the verse right in the reading text.", before: openVerseToolsForTour },
  { selector: '.vtcell[onclick^="toggleBookmarkSelection"]', title: "Bookmark", body: "Save this verse to My Library so it's easy to find again later.", before: openVerseToolsForTour },
  { selector: '.vtcell[onclick^="openNoteTargetPicker"]', title: "Note", body: "Drop this verse — reference and text — into a note: a new one, the note you're currently working in, or one you pick. It opens in the Notes drawer, and the verse gets a note icon in the margin. Keep going to gather a whole passage into one note.", before: openVerseToolsForTour },
  { selector: '.vtcell[onclick^="copySelection"]', title: "Copy", body: "Copy the verse text, with its reference, straight to your clipboard.", before: openVerseToolsForTour },
  { selector: '.vtcell[onclick^="showShareTool"]', title: "Share", body: "Turn the verse into a shareable image, link or embeddable card.", before: openVerseToolsForTour },
  { selector: '.vtcell[onclick^="showOriginalLanguageTool"]', title: "Original Language", body: "See the underlying Hebrew or Greek for each word, with Strong's numbers you can jump into for a full word study.", before: openVerseToolsForTour },
  { selector: '.vtcell[onclick^="showCrossRefsTool"]', title: "Cross-refs", body: "Pull up other verses this one connects to across the Bible.", before: openVerseToolsForTour },
  { selector: '.vtcell[onclick^="showCommentaryTool"]', title: "Commentary", body: "Read commentary on this verse from the API's commentary sources.", before: openVerseToolsForTour },
  { selector: '.vtcell[onclick^="showCompareTool"]', title: "Compare", body: "Line this verse up side-by-side across multiple translations.", before: openVerseToolsForTour },
  { selector: '.vtcell[onclick^="showTopicsTool"]', title: "Topics", body: "See which topics this verse is tagged under, and browse others tagged the same way.", before: openVerseToolsForTour },
];
const ADVANCED_EXPLORE_STUDY_LIBRARY_STEPS = [
  { selector: '#exploreTabs .lib-tab[data-tab="atlas"]', title: "Explore: Atlas", body: "Every place in the Bible, independent of whatever chapter you're reading, each with its own map.", before: () => { openExplore(); switchExploreTab("atlas"); } },
  { selector: '#exploreTabs .lib-tab[data-tab="collections"]', title: "Explore: Collections", body: "Curated groupings — parables, miracles, prayers, names of God, titles of Jesus, weights & measures, and notable stories.", before: () => { openExplore(); switchExploreTab("collections"); } },
  { selector: '#exploreTabs .lib-tab[data-tab="extrabiblical"]', title: "Explore: Extrabiblical", body: "Historical and cultural context from outside the biblical text itself.", before: () => { openExplore(); switchExploreTab("extrabiblical"); } },
  { selector: '#exploreTabs .lib-tab[data-tab="genealogy"]', title: "Explore: Genealogy", body: "Trace family lines through scripture with an interactive genealogy explorer.", before: () => { openExplore(); switchExploreTab("genealogy"); } },
  { selector: '#exploreTabs .lib-tab[data-tab="harmony"]', title: "Explore: Harmony", body: "The four Gospels laid out side-by-side, matched up event by event.", before: () => { openExplore(); switchExploreTab("harmony"); } },
  { selector: '#exploreTabs .lib-tab[data-tab="topics"]', title: "Explore: Topics", body: "Browse the Bible by topic instead of by book and chapter.", before: () => { openExplore(); switchExploreTab("topics"); } },
  { selector: '#studyTabs .lib-tab[data-tab="book"]', title: "Study: Book Guide", body: "A per-book overview — author, setting, structure and themes — plus book-level commentary from the historic sources.", before: () => { openStudy(); switchStudyTab("book"); } },
  { selector: '#studyTabs .lib-tab[data-tab="dictionary"]', title: "Study: Dictionary", body: "Look up any word or name across all five classic Bible dictionaries at once — Easton's, Smith's, Hastings', Hitchcock's and Schaff's.", before: () => { openStudy(); switchStudyTab("dictionary"); } },
  { selector: '#studyTabs .lib-tab[data-tab="word"]', title: "Study: Word Study", body: "A Strong's-numbered word study across several lexicons — Strong's, BDB, LSJ, Abbott-Smith — plus every other place a word appears.", before: () => { openStudy(); switchStudyTab("word"); } },
  { selector: '#studyTabs .lib-tab[data-tab="commentaries"]', title: "Study: Commentaries", body: "Read verse-by-verse commentary for any chapter — pick the book, chapter, verse and source, from Matthew Henry and Gill to hundreds of others.", before: () => { openStudy(); switchStudyTab("commentaries"); } },
  { selector: '#studyTabs .lib-tab[data-tab="variants"]', title: "Study: Textual Variants", body: "Where New Testament manuscripts differ, verse by verse.", before: () => { openStudy(); switchStudyTab("variants"); } },
  { selector: '#libraryOverlay .lib-tab[data-tab="notes"]', title: "My Library: Notes", body: "Every note you've written — searchable, taggable, and grouped into notebooks. Editing opens the Notes drawer.", before: () => { openLibrary(); switchLibraryTab("notes"); } },
  { selector: '#libraryOverlay .lib-tab[data-tab="bookmarks"]', title: "My Library: Bookmarks", body: "Every verse you've bookmarked, in one list.", before: () => { openLibrary(); switchLibraryTab("bookmarks"); } },
  { selector: '#libraryOverlay .lib-tab[data-tab="highlights"]', title: "My Library: Highlights", body: "Every verse you've highlighted, filterable by color.", before: () => { openLibrary(); switchLibraryTab("highlights"); } },
  { selector: '#libraryOverlay .lib-tab[data-tab="history"]', title: "My Library: History", body: "Every chapter you've visited, most recent first.", before: () => { openLibrary(); switchLibraryTab("history"); } },
];
const ADVANCED_TOUR_STEPS = ADVANCED_VERSE_TOOLS_STEPS.concat(ADVANCED_EXPLORE_STUDY_LIBRARY_STEPS);
let tourActive = false;
let tourStepIndex = 0;
let activeTourSteps = TOUR_STEPS;
// Tracks which step index the last before() ran for, so a resize-triggered
// renderTourStep() (same step, just repositioning) doesn't re-run before()
// and re-trigger whatever it does — e.g. re-switching an Explore tab would
// otherwise refetch that tab's data on every window resize.
let tourRenderedIndex = -1;

function markTourSeen() { localStorage.setItem(TOUR_SEEN_KEY, "1"); }
function maybeShowTourWelcome() {
  if ((!IS_HOSTED_INSTANCE && !getApiKey()) || localStorage.getItem(TOUR_SEEN_KEY)) return;
  // Marked seen the moment it's shown, not on a specific dismiss button —
  // so a backdrop click or Escape (both close it generically, see main.js)
  // suppresses the nag next visit exactly the same as either real button.
  markTourSeen();
  openModal("tourWelcomeScrim");
}
function dismissTourWelcome() { markTourSeen(); closeModal("tourWelcomeScrim"); }
function startTourFromWelcome() { closeModal("tourWelcomeScrim"); startTour(); }

function startTour(steps) {
  activeTourSteps = steps || TOUR_STEPS;
  markTourSeen();
  closeProfilePanel();
  switchMainView("read");
  tourActive = true;
  tourStepIndex = 0;
  tourRenderedIndex = -1;
  document.getElementById("tourOverlay").classList.add("show");
  renderTourStep();
}
function startAdvancedTour() { startTour(ADVANCED_TOUR_STEPS); }
function acceptAdvancedOffer() {
  closeModal("tourAdvancedOfferScrim");
  startTour(ADVANCED_VERSE_TOOLS_STEPS);
}
function endTour() {
  tourActive = false;
  document.getElementById("tourOverlay").classList.remove("show");
  switchMainView("read"); // no-op for the basic tour; cleans up after the advanced one
}
function tourSkip() { endTour(); }
function tourNext() {
  if (tourStepIndex >= activeTourSteps.length - 1) {
    // Only the basic tour offers to continue — the Advanced Tour (already
    // this same 10-step Verse Tools section, plus more) must never re-offer
    // into itself.
    const wasBasicTour = activeTourSteps === TOUR_STEPS;
    endTour();
    if (wasBasicTour) openModal("tourAdvancedOfferScrim");
    return;
  }
  tourStepIndex++;
  renderTourStep();
}
function tourBack() {
  if (tourStepIndex <= 0) return;
  tourStepIndex--;
  renderTourStep();
}
function positionTourSpotlight(rect) {
  const el = document.getElementById("tourSpotlight");
  const pad = 6;
  el.style.left = (rect.left - pad) + "px";
  el.style.top = (rect.top - pad) + "px";
  el.style.width = (rect.width + pad * 2) + "px";
  el.style.height = (rect.height + pad * 2) + "px";
}
function positionTourTooltip(rect) {
  const tooltip = document.getElementById("tourTooltip");
  const margin = 14, tw = tooltip.offsetWidth || 280, th = tooltip.offsetHeight || 160;
  let left = rect.left;
  let top = rect.bottom + margin;
  if (top + th > window.innerHeight - margin) top = rect.top - th - margin;
  if (top < margin) top = margin;
  if (left + tw > window.innerWidth - margin) left = window.innerWidth - tw - margin;
  if (left < margin) left = margin;
  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
}
// A step's target can be legitimately absent right now — the nav rail
// hides below ~1180px wide (css/styles.css) — so a hidden/zero-size target
// is skipped rather than spotlighting nothing. skipDepth caps the recursion
// so a run of hidden steps can't loop forever.
function renderTourStep(skipDepth) {
  if (!tourActive) return;
  const step = activeTourSteps[tourStepIndex];
  // Only run a step's setup once per visit to that index — a resize firing
  // this same function to reposition mid-step must not re-run it too.
  if (tourStepIndex !== tourRenderedIndex) {
    // Neither of these has any effect above 1180px (see their own CSS) —
    // reset unconditionally so a step that doesn't ask for one of them
    // (via its own before()) never inherits it left open from the step
    // before.
    closeMoreMenu();
    closeCardsSheet();
    if (step && step.before) step.before();
    tourRenderedIndex = tourStepIndex;
  }
  // A step's selector can match more than one real element (e.g. a nav item
  // that exists in both #navrail and its mobile #mobileFooterNav/
  // #moreMenuSheet equivalent) — only one of them is actually on-screen at
  // any given viewport width, so pick whichever has a non-zero rect rather
  // than always the first in DOM order.
  const el = step && Array.from(document.querySelectorAll(step.selector)).find(e => {
    const r = e.getBoundingClientRect();
    // width/height alone isn't enough: #moreMenuSheet/#rightRail stay
    // display:block below 1180px even while closed (slid off-screen with a
    // transform, not display:none), so a closed one would otherwise still
    // report a real box size.
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  });
  let rect = el ? el.getBoundingClientRect() : null;
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    if ((skipDepth || 0) >= activeTourSteps.length || tourStepIndex >= activeTourSteps.length - 1) { endTour(); return; }
    tourStepIndex++;
    renderTourStep((skipDepth || 0) + 1);
    return;
  }
  // The vertical check above only rules out scrolled-off-screen candidates —
  // a target can still be horizontally scrolled out of view inside something
  // like .lib-tabs (Explore/Study/My Library's tab strip, css/styles.css,
  // overflow-x:auto below 1180px), which getBoundingClientRect alone doesn't
  // catch. "instant" avoids measuring a rect that's still mid-flight from
  // html's global scroll-behavior:smooth (css/styles.css).
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  rect = el.getBoundingClientRect();
  positionTourSpotlight(rect);
  document.getElementById("tourTooltipText").innerHTML = `<div class="tour-tooltip-title">${escHtml(step.title)}</div><p>${escHtml(step.body)}</p>`;
  document.getElementById("tourDots").innerHTML = activeTourSteps.map((_, i) => `<span class="tour-dot${i === tourStepIndex ? " active" : ""}"></span>`).join("");
  document.getElementById("tourBackBtn").style.visibility = tourStepIndex === 0 ? "hidden" : "visible";
  document.getElementById("tourNextBtn").textContent = tourStepIndex === activeTourSteps.length - 1 ? "Done" : "Next";
  positionTourTooltip(rect);
}
window.addEventListener("resize", () => { if (tourActive) renderTourStep(); });
