# CHANGELOG for IQ Bible App

All notable changes to this project will be documented in this file. This CHANGELOG follows SemVer, see https://keepachangelog.com/en/1.1.0/

## [Unreleased]

## [1.2.6] - 2026-08-24
- **fixed:** Capped #shell (the flex row holding #navrail, #readMain, #rightRail) at max-width:1600px with margin:0 auto in css/styles.css:73. Previously it stretched full viewport width, so on wide screens #readMain (flex:1) filled all the leftover space and pushed the rails out to the raw viewport edges. Now the whole three-column group stays capped and centered as a unit, keeping the sidebars near the reading column regardless of screen width, while narrower screens (where the shell is already under 1600px) are unaffected.

## [1.2.5] - 2026-08-24
- **fixed:** Typo ('naviagating') in README.md for the word 'navigating.'

## [1.2.4] - 2026-08-24
- **fixed:** The Advanced Tour's My Library steps (Notes, Bookmarks, Highlights, History) opened
  the overlay via `openLibrary()`, which autofocuses its search input on every open — popping the
  mobile keyboard up over the tour tooltip for each of those four steps even though the tour never
  needs the visitor to type there. The autofocus is now skipped while a tour is driving the overlay.

## [1.2.3] - 2026-08-24
- **fixed:** Several mobile-viewport bugs in Take a Tour. (1) The Basic Tour's My Library/My
  Progress/Reading Plans/Devotionals steps open the mobile "More" dropup to spotlight each nav item
  inside it, but a document-level "click outside closes the More menu" handler treated the tour's
  own Next button (outside the dropup by design) as an outside click and closed the menu right after
  it opened — leaving the spotlight stranded over the reading content behind it instead of the nav
  item. The handler now ignores clicks inside the tour overlay. (2) The Chapter Context step
  auto-opened the mobile "Chapter Info" bottom sheet before spotlighting its content, which meant
  mobile users were never shown the button that actually opens it — it now spotlights that button
  directly instead, matching how the tour points at other mobile-only triggers. (3) The Advanced
  Tour's Highlight step measured the Verse Tools panel's position while it was still mid-transition
  (its first open of a tour run), so the spotlight box landed straddling the highlight-color row and
  the Original Language button below it — the panel now opens instantly for that measurement. (4)
  Any Explore/Study Tools/My Library tab scrolled outside its tab strip's visible width (mobile's
  horizontally-scrolling `.lib-tabs`) was spotlighted at its true, off-screen position instead of
  being scrolled into view first, so several tabs (Extrabiblical, Genealogy, Harmony, Topics, and
  the later tabs of Study Tools/My Library) appeared partially or entirely un-highlighted.

## [1.2.2] - 2026-08-24
- **fixed:** The footer/About "vX.Y.Z" version display was a hardcoded constant
  (`APP_VERSION` in `js/config.js`) that had no way to catch itself drifting out
  of sync with this file — it had, showing 1.1.1 while this file was already at
  1.2.1. `js/main.js`'s new `refreshAppVersionFromChangelog()` now reads the
  latest version straight out of this file's newest `## [x.y.z]` heading at
  load time and overwrites the display with it; `APP_VERSION` remains only as
  the offline fallback shown until that fetch resolves (or if it fails), and
  has been corrected to 1.2.2 to match.

## [1.2.1] - 2026-08-24
- **fixed:** Three mobile-viewport bugs. (1) Tapping a Places/People/Prophecies/Timeline card from
  the mobile "Chapter Info" bottom sheet opened that card's detail modal underneath the still-open
  sheet (the sheet's z-index is higher), making it invisible until the sheet was manually closed —
  the sheet now closes itself when any of those modals opens. (2) The book picker's grid rendered up
  to 10 columns across a 660px-wide modal that had no responsive width at all (a hardcoded inline
  style, immune to the existing mobile CSS meant to shrink it) — abbreviations were unreadable and
  much of the grid sat off-screen with no way to reach it. The modal now actually shrinks on mobile,
  and the grid is fixed at 4 columns there regardless of book count. (3) Choose a Book/Translation
  both autofocused their search field on open, popping the keyboard immediately even before the
  reader asked to search, and once typing did happen the keyboard covered the bottom of the results
  list with no compensation — autofocus is now skipped below the mobile breakpoint, and both modals
  track the actual visible (keyboard-shrunk) viewport height so results stay above the keyboard.

## [1.2.0] - 2026-08-24
- **changed:** The Characters rail card, modal, and detail view are now labeled People throughout
  (card label, modal title/heading, empty states, Help/Tour copy), to match the `GET /bible-people`
  endpoint family the chapter list already reads from. Purely a naming change — the detail lookup
  still calls `GET /bible-characters/{name}`, which remains the API's real, permanent path for a
  person profile.

## [1.1.1] - 2026-08-24
- **fixed:** `js/config.js`'s `BASE_PATH`, and `index.html`/`404.html`'s asset paths, had to be
  hand-maintained differently between `main` (GitHub Pages, `/iqbible-app` prefix) and `develop`
  (local dev, unprefixed). Merging `develop` into `main` for the 1.1.0 release silently reverted
  `main`'s prefix, breaking every CSS/JS asset on the live site — patched live with a `main`-only
  hand-hotfix, then fixed properly here: an inline script at the top of `<head>` now detects the
  deploy target from `location.hostname` at runtime and injects a `<base>` tag, so these three files
  are byte-identical between branches and this class of bug can't recur on a merge.

## [1.1.0] - 2026-08-24
- **fixed:** The Characters rail card and detail modal called `GET /bible-characters/chapter/{book}/
  {chapter}`, an endpoint the API removed (2.0.0-beta-37) — every chapter's Characters card was
  silently empty. Switched to `GET /bible-people/{book}/{chapter}`.
- **changed:** Character profiles now read TIPNR data (API beta-37): Parents/Children rows no
  longer cite a specific verse (TIPNR relationship edges carry none) and instead open that
  relative's own profile; two new sections, Siblings and Partners, appear when TIPNR has that data.
- **added:** Character profiles show a short TIPNR-sourced summary (`briefest`/`brief`/`short`
  fallback chain) and tribe/nation, when available.
- **changed:** Dictionary-term underlining now fetches a chapter's candidate words in one
  `GET /dictionaries/easton/bulk` call (API beta-36) instead of one call per word.

## [1.0.0] - 2026-08-23
- **fixed:** `404.html` (served by GitHub Pages for any deep-linked page load) had drifted out of
  sync with `index.html` again — missing the bottom nav bar, the Cards sheet trigger/sheet, the
  "More" dropup, My Progress, and Help entirely. Re-synced.
- **changed:** Deployed to GitHub Pages as a project site
  (`https://jody-pm.github.io/iqbible-app/`) — set `BASE_PATH` (`js/config.js`) to `/iqbible-app`
  and prefixed `index.html`/`404.html`'s root-absolute `css`/`js`/`img` references accordingly, per
  the setup those files already documented for this exact case.
- **added:** A fixed bottom nav bar below 1180px (where the left nav rail has no room) — Read,
  Explore, Study Tools, Share Tools, and a "More" dropup for My Library/My Progress/Reading
  Plans/Devotionals/Help/About/Settings. Search is reachable from the topbar instead, at every width.
- **added:** The per-chapter context cards (places/characters/prophecies/timeline), previously only
  visible in the right rail above 1180px, are now reachable below that width as a tap-to-open bottom
  sheet (the chapter-header icon next to the version picker) — same cards, same data, not duplicated.
- **added:** Swipe left/right on the reading text to move to the next/previous chapter below 1180px,
  where the previous/next chapter buttons have no reading-column edge to sit beside; those buttons
  are now docked at the bottom corners there instead of hidden outright.
- **fixed:** Below ~700px wide, the chapter header had a visible gap above it (the previous chapter's
  text showed through) because of a stray top padding on the reading pane that the header's sticky
  positioning math didn't account for.
- **fixed:** The chapter header's icon/book/chapter/version and the inline audio player fought for
  space on narrow screens; below 1180px the audio player and the cards-sheet trigger button now dock
  in the same fixed bottom row as the previous/next chapter buttons instead, all centered as one
  cluster — the player a fixed-width pill with its own solid background (so it doesn't bleed into the
  reading text scrolling underneath it) sharing the chapter buttons' exact height and vertical
  position, and the trigger stacked just above the next-chapter button.
- **fixed:** Verse Tools could open with its lower half hidden behind the new bottom nav bar below
  1180px; also fixed a toast-notification pill that, chasing the same bottom-nav clearance, ended up
  permanently peeking a sliver of itself up from behind the nav bar even while otherwise idle.
- **changed:** Chapter illustrations are no longer tap-to-zoom on narrow screens — not worth the tap
  target on a small screen, and the reading column has no room to spare there.
- **fixed:** Explore and My Library's tab rows (6 and 4 tabs) didn't wrap and forced the entire page
  to scroll horizontally on narrow screens; the tab row itself now scrolls instead.
- **fixed:** Reading Plans' calendar day cells were tall rectangles rather than squares on narrow
  screens (a fixed min-height in a 7-column grid).
- **fixed:** The Help page's "Advanced Tour" button ran off its card (and off-canvas) on narrow
  screens; the two tour buttons now stack full-width there instead.
- **fixed:** The basic tour silently skipped its per-chapter-cards step and every left-nav step below
  1180px, since their targets live in the (now hidden) rail; it now opens the mobile nav's
  equivalents (the cards sheet, the "More" dropup) first and points at whichever the current width
  actually shows.
- **changed:** Verse Tools is now the last step of the basic tour (was right after Narration) —
  finishing the tour now offers to continue straight into a 10-step Verse Tools deep dive (the same
  steps as the Advanced Tour's first section), right where the tour left off.
- **fixed:** The tour tooltip's step dots and Back/Skip/Next(Done) buttons shared one row, and their
  combined width could exceed the card — most visibly with the Advanced Tour's 23 steps, where the
  dots alone pushed the buttons past the card's own edge. Each now gets its own row.
- **added:** An Advanced Tour (Help page, next to Take a Tour) — an opt-in, deeper walkthrough that
  spotlights each of the 10 individual Verse Tools buttons and every tab in Explore, Study Tools and
  My Library, rather than the one-summary-sentence-per-feature treatment the regular tour gives them.
- **fixed:** Take a Tour never mentioned Verse Tools — clicking into a verse's text, which is how
  highlighting, bookmarking, notes, and every other per-verse tool actually gets reached. Added a
  step for it.
- **changed:** Regrouped the left nav into three sections — Read/Search/Explore/Study Tools/Share
  Tools, then My Library/My Progress/Reading Plans/Devotionals in their own divided section, then
  Help/About/Settings — instead of one long undivided list.
- **changed:** The API nav item (which only ever opened api.iqbible.com in a new tab) is no longer a
  left-nav entry; it's now a small link next to the copyright line at the bottom of the nav rail.
- **changed:** Take a Tour now follows the regrouped nav order and adds three new stops — the inline
  audio player, the narrator picker (when a version has more than one voice recorded), and the
  per-chapter context cards (places/characters/prophecies/timeline) — plus Share Tools and My
  Progress, which the tour never covered before.
- **fixed:** Help's "Explore the Features" grid was missing a My Progress card, and its Explore/Study
  Tools descriptions actually described the per-chapter sidebar cards and the verse tools panel
  rather than what those two left-nav pages contain. Added two FAQ entries covering audio narration
  and the sidebar context cards, which weren't documented anywhere in Help before.
- **added:** A Take a Tour guided walkthrough — offered once in a welcome dialog on first visit (once
  an API key is set), spotlighting the topbar and left-nav features in place rather than opening each
  panel it describes. Re-launchable any time from the new Help page.
- **added:** A Help page (left nav) — getting-started steps, a grid covering every left-nav feature,
  an FAQ, and the Take a Tour entry point. Replaces the old "Coming soon" stub.
- **added:** A My Progress screen (left nav, and the profile popover's "Your Reading" actions) — a
  reading-streak calendar, confirmed chapter/devotional read counts, the active plan's completion,
  and a recent-activity feed. Richer than the profile popover, which stays as the compact version.
- **changed:** Redesigned the About page from a plain stack of paragraphs into a proper branded page —
  a hero, a feature-highlight chip list, and Open Source / Get an API Key callout cards.
- **changed:** The topbar Search button is now icon-only, matching its icon-only siblings
  (font size/theme/profile) instead of standing out as the one bordered icon+label pill.
- **added:** Devotionals now end with a "did you read this devotional?" prompt, same as chapter
  reading, logging to a new local reading Progress (kept separate from chapter progress).
- **fixed:** A reading plan's calendar let you page past the plan's own start/end month into empty
  months with nothing to show — Previous/Next now disable at the plan's actual date range.
- **fixed:** Deleting the plan you were currently viewing on its calendar (via the calendar's ⋮ menu)
  could, in a narrow race on Topic-mode plans, redraw the just-deleted plan's calendar back over the
  My Plans list a moment later instead of leaving you on the list.
- **fixed:** The "did you read this chapter?" prompt could flash the *previous* chapter's prompt (or
  its "done" state) behind the loading spinner for a moment when advancing to a new chapter.
- **changed:** A book's Introduction in the book-info preview (the &#9432; button beside the chapter
  header) now shows in full instead of being truncated to ~260 characters; "Read More in Book Guide"
  still links to the fuller guide for everything else (purpose, structure, themes, etc.).
- **fixed:** The "set your API key to start reading" prompt (shown on a fresh start with no key
  saved, or after clearing one in Settings) was an inline banner in the reading column rather than a
  true modal — the topbar and left nav stayed fully clickable behind it, so a visitor with no key yet
  could still open Search, Explore, Share Tools, etc. and hit dead-end API calls. It's now a
  full-screen centered overlay that blocks the rest of the app until a key is set, and its copy now
  also points to `api.iqbible.com` for visitors who want to see what the API does before getting a
  key. The topbar and nav rail stay locked (dimmed, unclickable) even once "Open Settings" is clicked
  from the dialog, and within Settings itself every field except the API Key input/Save button
  (illustrations, book icons, font sizes, the backup-reminder toggle, compare versions) is locked
  too — the key field is the only thing usable anywhere in the app until a key is actually saved.
  Also stopped Chrome's password manager from offering to generate/save a "strong password" for the
  key field — it isn't a login credential, and `autocomplete="new-password"` was telling Chrome it
  was one.
- **added:** A Reading Plans page (`GET /bibles/{version}/reading-plan`) — build a General
  (testament/book-scoped, with optional daily Psalm/Proverb overlay), Topic, or M'Cheyne plan; check
  days off by hand or by confirming a chapter you just read; download the plan as a PDF. Chapter
  reading now also ends with a "did you read this chapter?" prompt — if it matches a day on your
  active plan, confirming checks that day off; either way it's added to a new local reading Progress
  count (a raw chapter tally, not a fabricated "X of Y" percentage — see NOTES.md on why).
- **added:** A one-time banner the first time a note, bookmark, or highlight is saved, explaining
  that this app has no accounts — everything lives only in this browser's local storage — plus a
  periodic reminder (Settings toggle, on by default) to export a backup once there's something worth
  backing up.
- **added:** Export (Markdown/JSON) and Import for Bookmarks, Highlights, and History in My Library —
  previously only the Notes tab had this.
- **added:** An About page (left nav) — what the app is, links to the API docs and a free key, and
  the GitHub repo.
- **changed:** Reordered the left nav's bottom cluster to API / Help / About / Settings.
- **fixed:** Settings, converted to a full-page mainview in a previous entry below, was left in the
  wrong place in the DOM — a stray sibling of `#shell` instead of nested inside `#readMain` with
  every other mainview. Opening it made it a 3rd flex child of `#app`'s column layout, which
  squeezed `#shell` (nav rail + reading column + right rail) down to a sliver that `#app`'s
  `overflow:hidden` then clipped almost entirely, instead of Settings actually replacing the reading
  column the way Search/Explore/My Library/etc. do. Moved the markup into `#readMain`; no visual or
  behavioral change to Settings itself.
- **reverted:** Chapter illustrations' fixed aspect-ratio box (previous entry below) — cropping every
  source's plates to a uniform 3:4 with `object-fit:cover` looked worse in practice than the layout
  jump it was meant to prevent, since Schnorr/Doré/Sweet aren't all the same orientation to begin
  with. Back to sizing at the image's own natural aspect ratio.
- **changed:** Explore's tabs (Harmony/Topics/Atlas/Genealogy/Collections/Extrabiblical) are now
  listed alphabetically instead of in the order each was added.
- **changed:** My Library > Highlights' "By Color" sort is now 4 individual color swatches (one per
  highlight color) that filter the list down to just that color, instead of one "By Color" chip that
  only grouped all colors together in one list.
- **fixed:** Verse Tools > Topics listed each verse's topics as plain, unclickable text — now each
  one opens that topic's citation list (Explore > Topics' own detail view, reused rather than
  rebuilt here).
- **changed:** Verse Tools > Share dropped the "Share…" button that opened the OS/browser share
  sheet (redundant with the Copy Link/Email/X/WhatsApp options already there); its remaining action
  buttons are now equal width instead of each sized to its own label.
- **changed:** Removed the book-description preview from the Book Picker (added alongside the
  reading header's ⓘ button in a previous entry) — the picker is back to just search + the book
  grid; the ⓘ button's own preview modal is unaffected.
- **removed:** The audio player's "Listen to this chapter" label.
- **fixed:** The left nav rail (and right-rail cards) lost their vertical alignment — landing right
  under the topbar instead of level with the chapter text — whenever the app was opened straight
  into a non-Read view, e.g. a `#devotionals`/`#search`/etc. deep link, or any page refresh other
  than Read. Root cause: `alignRails()`'s offset was computed inside a `requestAnimationFrame`
  callback that ran *after* `init()`'s subsequent `openHashRoute()` had already hidden
  `#readViewGroup`, so it measured a `display:none` tree and collapsed the offset to ~0. Made the
  first computation synchronous (a `getBoundingClientRect()` read already forces its own layout
  flush, so the frame wait was never actually needed) and added a guard so any later call while
  `#readViewGroup` is hidden leaves the last good offset alone instead of overwriting it with zero.
- **fixed:** Verse Tools > Commentary always showed "No entry from this source for this verse",
  regardless of source or verse (including Gen 1:1 in Matthew Henry/Gill, which both cover) — the
  client read the response's array off `d.data`, but `GET /commentaries/{name}/{book}/{chapter}/
  {verse}` returns it as `entries`.
- **fixed:** Search's "All words"/"Exact phrase" mode toggle never actually changed what was sent to
  the API — the request never included the `match=` parameter the search endpoint uses to pick
  between AND-all-words and exact-phrase matching, so every search ran with the server's default
  (all-words) regardless of which mode was selected, and "phrase" mode's own workaround (wrapping
  the query in literal quote characters) did nothing, since the API strips quote characters from a
  plain-mode query before matching. Now sends `match=all`/`match=phrase` and lets the API build the
  actual phrase-quoted expression itself.
- **fixed:** Study Tools > Word Study's LSJ and Abbott-Smith lookups 404ed on every single word —
  both endpoints key their entries by a zero-padded dStrong code (e.g. `G0026`), not the bare
  Strong's number (`G26`) a reader actually types or clicks through with. Fixed client-side (a
  documented key-format fix, confirmed against both endpoints' own error hints) — BDB has no such
  fix available, since its codes are an unrelated internal catalog with no derivable mapping from a
  Strong's number; logged in `NOTES.md`.
- **changed:** Study Tools > Word Study now renders each lexicon source as a card (headword,
  part-of-speech/occurrence-count chips, the gloss/definition prominently) instead of dumping every
  raw field one after another.
- **changed:** Study Tools > Book Guide redesigned — a meta strip (Author/Date/Genre/Chapters/
  Original Language, plus the book icon when Settings has one enabled), an always-visible overview,
  and two collapsible sections (Historical & Literary Context, Theological Themes) instead of
  dumping all 30+ of the API's `book/info` fields one after another.
- **added:** The reading header's book-info (ⓘ) button now opens a lightweight preview modal
  (author/date/canonical significance/a short introduction) instead of jumping straight into the
  full Book Guide — a "Read More" link is still one click from there. Also repositioned the button
  itself, which previously sat between the book title and the chapter number in a way that read as
  part of the chapter number rather than the book. The same preview now also appears in the Book
  Picker, above "Choose a Book", for whichever book is currently open.
- **added:** Explore gets an Extrabiblical tab — browsable historical/apocryphal works (1 Enoch,
  Jubilees, Apocalypse of Abraham, ...) the API tracks as their own standalone "versions" outside
  any Bible translation's book list, via the `GET /extrabiblical` endpoint family this app never
  surfaced before. List → work → chapter, read straight through like the main Reader.
- **changed:** Verse Tools > Share and > Original Language now open as real, wider modals instead of
  being squeezed into the small floating verse-tools panel — closing either now leaves whatever tool
  was previously showing in the small panel untouched, instead of losing it. Share also gained a
  plain Copy Link button (previously only "Share…", which bundles the verse text in) and quick
  Email/X/WhatsApp links.
- **added:** A working Download button for the verse-image preview, in both Share Tools and Verse
  Tools > Share — `GET /image/verse` is public/unauthenticated, but a plain cross-origin `<a
  download>` is silently ignored by the browser, so this fetches the image itself and downloads a
  same-origin blob instead.
- **fixed:** Explore > Atlas's photo and map stacked full-height inside the same narrow floated
  column meant for a description to wrap beside — now lay side by side when a place has no
  description at all (nothing to wrap around), matching the chapter-scoped Places modal's layout.
- **fixed:** The topbar's font-size trigger had no styling of its own (fell back to a stark white
  default button, and didn't respect day/night mode) — brought it in line with the theme/profile
  buttons beside it, and swapped its icon for a more conventional small-A/large-A glyph.
- **added:** A "×" clear button on the Search overlay's input, matching every other search input in
  the app; clearing it (or emptying it below the 3-character search threshold) now also clears any
  stale results left over from the previous query instead of stranding them on screen.
- **changed:** Settings is now a full page (`switchMainView`, like Search/Explore/Devotionals/etc.)
  instead of a modal, for more room — same content, browsable/linkable the same way as the rest of
  the left nav now.
- **fixed:** The audio player's "Listen to this chapter" label competed with the scrub bar for
  horizontal space (and was simply hidden below 640px as a workaround) — now sits on its own line
  above the transport controls at every width.
- **changed:** Place maps (chapter-scoped Places modal, Bible Atlas place page, the right-rail
  Places card thumbnail, and the full-view map lightbox) now render with English/Latin place-name
  labels via Esri's free World Street Map basemap, instead of showing whatever local script
  OpenStreetMap's own tiles carry for a given region. Also fixes the right-rail thumbnail actually
  loading again — OpenStreetMap's own tile servers had started rejecting this app's requests
  outright as automated use outside their volunteer-run usage policy. The small previews are a
  static tile image (was an OSM iframe embed / a now-blocked OSM tile); the full-view lightbox
  became a real interactive Leaflet map — this app's first runtime dependency (loaded via a plain
  `<script>` tag, no npm/bundler), since OSM's own embeddable page has no language option at all.
- **fixed:** Verse Tools > Commentary was silently excluding Matthew Henry and Gill — the two
  whole-Bible sources, and the tool's own preferred defaults — because the client filtered on
  `books.includes(currentBook)`, but the API deliberately ships those two with an *empty* `books`
  list to mean "covers everything." Almost every book hit this, so the tool would just show
  whatever narrower source happened to also cover it, or nothing at all.
- **added:** Verse Tools > Share now renders its own image/embed panel (light/dark preview, Open
  Full Image, Copy Image Link, Copy Embed Code) instead of just a plain link-share action — the
  same capability Share Tools already had, scoped to the current verse selection.
- **added:** A left-nav Book Info button (ⓘ) next to the book title jumps straight to Study Tools
  > Book Guide for the book currently open.
- **added:** The book picker now groups any non-canonical books a version's text includes (e.g.
  KJVA/DRC/CPDV's Tobit, Maccabees, etc.) into their own "Apocrypha / Deuterocanon" section instead
  of lumping them into Old Testament.
- **added:** The chapter-scoped Places modal now lays a place's photo and map side by side (was
  stacked) and adds a short Easton's-first description with a "Read More" link into the full Bible
  Atlas place page (Explore > Atlas).
- **added:** Devotionals now leads with "Today's Devotional" (the date-nav row is de-emphasized
  rather than the focus), shows the full verse text under the heading citation, and splits Morning
  and Night into tabs — defaulting to whichever one matches the time of day.
- **added:** A left-nav footer (copyright + version) and a divider separating Settings/API/About/
  Help from the rest of the menu; About and Help are placeholders for now.
- **added:** A quick font-size popover next to Search/day-night in the topbar — the same two
  sliders as Settings, without a trip through the full modal.
- **added:** Clicking anywhere in a verse (not just its number) now opens Verse Tools for it, except
  on a dictionary term or an embedded citation, which keep their own click behavior.
- **added:** My Library > Highlights can now be sorted by color, in addition to By Book/By Date.
- **added:** A left-nav view (Explore, Share Tools, Search, Study Tools, My Library, Devotionals,
  Settings) can now be linked to directly via a URL hash, e.g. `/gen/38/26#explore` or
  `/gen/38/26#share-tools`.
- **added:** The audio player now has a small "Listen to this chapter" label.
- **fixed:** A verse-jump landing (from Search, cross-references, Explore, etc.) now flashes the
  target verse a few times and then leaves it persistently highlighted until you click elsewhere,
  instead of a highlight that quietly faded on a timer and was easy to lose track of.
- **fixed:** Leaving the Reader for any other view (Explore, Search, Study Tools, My Library, etc.)
  and coming back now restores the exact scroll position you left — previously #readMain (the one
  shared scrollport every view renders into) was left wherever that other view's own scrolling had
  landed.
- **fixed:** Every modal/popup now closes on a click outside it, not just its own × button — this
  was previously wired up ad hoc (only the image viewer had it).
- **added:** A "×" clear button on every search input that didn't already have one: Explore's
  Topics/Atlas/Genealogy searches, Study Tools > Word Study, and My Library's Notes/Bookmarks/
  Highlights/History search.
- **fixed:** Explore > Topics and Atlas now remember your last search (Atlas: its results too, not
  re-fetched) and scroll position when you back out of a topic/place detail view, instead of
  resetting to an empty search every time.
- **fixed:** My Library > Notes' tag-filter row now scrolls horizontally instead of silently
  clipping tags past the right edge for anyone with more than a handful of tags.
- **changed:** Bible Atlas place detail — the description now tabs across dictionary sources
  instead of listing every one consecutively, and the layout floats the photo/map so the
  description flows in beside it (same pattern chapter illustrations already use) rather than
  stacking everything full-width. The photo and embedded map there, and in the chapter-scoped
  Places modal (opened from the Places right-rail card), now open to the same full-view lightbox
  Bible Illustrations already used, on click.
- **added:** Settings > Black & White Illustrations — a plain CSS grayscale toggle for inline
  chapter illustrations (and their full-view lightbox), no different image variant fetched.
- **added:** Settings has a new "Interface Font Size" slider, separate from the existing Reading
  Font Size — scales the whole UI shell (menus, buttons, labels, modals) via the root element's
  font-size, leaving the Bible reading text (pinned to its own `--reading-font-size` variable)
  unaffected.
- **added:** The Characters right-rail card is now clickable, like Places/Prophecies/Timeline before
  it — opens a list of the chapter's characters (still the API's raw, unfiltered heuristic output)
  and, per character, a detail view backed by the exact-match
  `GET /bible-characters/{name}` lookup this app didn't use before: dictionary definitions, key
  events, recorded parents/children, and first/last appearance, every reference hover/click-previewable
  as usual. A name from the chapter's looser heuristic list that doesn't resolve against the exact-match
  lookup shows a plain empty state rather than an error — an honest reflection of the two endpoints
  using different matching strategies, not a bug.
- **added:** Devotionals is live — Spurgeon's "Morning and Evening" for today by default, with
  previous/next-day controls and a jump-to-any-date picker (year is read off the picker and then
  ignored, since the source itself has no year concept and genuinely repeats yearly). There's no
  archive/list endpoint on the API side (logged in `NOTES.md`), so this deliberately stays
  day-at-a-time rather than faking a calendar-grid browse.
- **added:** Share Tools is live — a reference/theme picker driving a live preview from
  `GET /image/verse` (downloadable, copyable link) and a live `<iframe>` preview of `GET /embed/verse`
  with a copyable embed snippet. Both endpoints are deliberately public/unauthenticated in the API, so
  this works with zero setup friction.
- **added:** Explore is live, five tabs surfacing endpoint families this app never used before: a
  **Harmony of the Gospels** browser (A.T. Robertson's 1922 harmony) with a parallel-column detail
  view lining up each Gospel's actual text side by side; **Topics** (curated + Nave/Torrey, ~5,800
  entries); a standalone **Bible Atlas** (place search independent of the current chapter, unlike the
  existing chapter-scoped Places card); a **Genealogy Explorer** (traversable family-tree lookup, plus
  a "find the relationship between two people" path finder); and a **Collections** tab covering
  Parables, Miracles, Prayers, Names of God, Titles of Jesus, Weights & Measures, and Stories (the
  same dataset that already powers inline chapter-heading titles while reading, now browsable as a
  full list too).
- **added:** Study Tools is live, three tabs for serious word/passage study: **Word Study** (Strong's
  lexicon lookup across Strong's/BDB/LSJ/Abbott-Smith plus every occurrence of a lemma across
  Scripture — now cross-linked directly from Verse Tools › Original Language, where a word's Strong's
  id is clickable straight into this); a **Book Guide** (per-book introduction/authorship/themes plus
  which of the 326 commentary sources cover it); and **Textual Variants** (the well-known NT textual
  cruxes, traditional vs. critical readings side by side — the book filter now only lists books that
  actually have a variant on file, instead of the full 66-book list).
- **changed:** The profile icon no longer just opens Settings — it now opens a small reading-dashboard
  popover (chapters read, day streak, notes/bookmarks counts, a "continue reading" shortcut, and a
  today's-devotional teaser), built almost entirely from data this app already tracks locally
  (History/Notes/Bookmarks/Highlights); Settings and My Library are still one click away from it.
- **fixed:** An inline illustration tagged to a chapter's first verse rendered *above* the opening
  sentence (before any text, above the dropcap) instead of alongside it — it now inserts after that
  verse's span instead of before it.
- **fixed:** The translation picker rendered *behind* whatever opened it (Settings, Verse Tools >
  Compare) instead of on top — `.modalscrim` (z-index 90) sat below `#verseToolsPanel` (120), and
  two same-level modals stacking fell back to DOM order. Raised `.modalscrim` to 130 and gave
  `#versionPickerScrim` its own 140, so it now reliably layers above any other open modal.
- **added:** My Library gets a fourth tab, Highlights, alongside Notes/Bookmarks/History — same
  batched-verse-text browsing as Bookmarks, plus each entry's color swatch and a Remove action.
  (Highlight storage upgraded from a bare color string to `{color, createdAt}`, migrated
  transparently, same approach as the earlier Notes migration.)
- **added:** Every My Library tab now shows a save/visit date, and a "By Book" / "By Date" sort
  toggle applies uniformly across all four tabs — including History, which can now be viewed in
  canonical Bible order instead of only chronologically. (Bookmark storage upgraded from a bare
  `true` flag to a save timestamp to make this possible.)
- **changed:** The Prophecies card's fulfillment-side line now names which verse in the current
  chapter does the fulfilling (e.g. "v.14 fulfills Deut 18:15") instead of just "Fulfills Deut
  18:15" with no indication of where in the chapter to look.
- **fixed:** Citation hover-preview was missing from several places that link to a *known* verse
  reference rather than parsing one out of prose — the Prophecies card and modal (including the
  origin verse, which wasn't even clickable before), and the Timeline card and modal. Added two
  shared helpers (`registerCiteId`, `fetchVersePreviews`) for the "already-known ref" case, and a
  lazy resolve-on-first-hover pattern (`resolveTimelineRef`) for Timeline's free-text references,
  which can't be batched the same way. `showCrossRefsTool` and the Bookmarks/Highlights tabs were
  refactored onto the same shared helpers instead of each keeping its own copy of the batch-fetch
  logic.
- **fixed:** `404.html` (served by GitHub Pages for any deep-linked page load) had fallen out of
  sync with `index.html` again (missing the new Highlights tab and sort-toggle markup) — re-synced.
- **added:** The reading version now persists — picking a translation sticks across reloads
  (`localStorage`) instead of always resetting to King James on every load.
- **added:** A note now records which translation was open when it was written (shown as a small
  caption in My Library, e.g. "Written in KJV") — display-only provenance, doesn't affect matching
  or editing.
- **added:** Verse Tools > Compare no longer shows a fixed, hardcoded 5-version English list.
  Settings gets a persisted "Compare Versions" picker (reusing the existing translation-picker
  modal in a new mode, rather than building a second one), and Compare itself gets a "+ Add
  Version" button for a one-off addition scoped to just the verse currently being compared.
- **added:** "My Library" now opens a real overlay with three tabs — Notes (as before), a new
  Bookmarks browser (fetches real verse text for every bookmark in one batched call, not one
  per-verse request), and a new reading History (chapter-level, capped at 200 entries, clearable) —
  this app had no reading-history tracking in any form before now.
- **changed:** The Prophecies rail card shows the actual prophecy/fulfillment pairs for the current
  chapter (e.g. "Fulfills Deut 18:15" or "→ Fulfilled in Matt 1:23") instead of a bare "N in this
  chapter" count — the API's `origin`/`fulfilled_in` fields already say which side of the pairing a
  chapter is on, so this needed no API change.
- **changed:** The Timeline rail card now includes each entry's date and reference alongside its
  event name, and the card itself moved above Characters in the rail order.
- **fixed:** `404.html` (served by GitHub Pages for any deep-linked page load, e.g. a bookmarked or
  shared `/gen/1` URL) had drifted badly out of sync with `index.html` — missing the Verse Tools
  panel, the API error/Places/Timeline/Prophecies modals, and the Library overlay entirely, so all
  of those silently broke for anyone landing on the site via a deep link rather than the homepage.
  Re-synced.
- **fixed:** Citation hover-previews (and toasts) were silently invisible whenever shown over the
  Search or Notes overlay — `.dict-tooltip`/`#toast` were z-index 150/200, below the overlays'
  z-index 500, so the popup/toast rendered and even fired correctly, just stacked behind the
  overlay. Raised both to z-index 600. Surfaced by the new Notes browser (the first place citation
  hover was used inside a full-screen overlay), but it would have hit `#toast` too.
- **added:** Notes can now cover a multi-verse selection instead of exactly one verse, and take
  freeform tags. Notes are stored as objects (`{id, book, chapter, verses, text, tags, ...}`)
  rather than a flat one-verse-per-key map, with a transparent one-time migration of any existing
  notes from the old shape. Clicking a note's badge on any verse it covers reopens it for editing
  pre-filled, without needing to reselect the exact same range. A new "My Notes" browser (wired to
  the previously-unused "My Library" nav item) lists every saved note across the whole Bible,
  filterable by text search or tag, with Edit/Delete per note and Export (Markdown for
  reading/printing, JSON as a full-fidelity backup) / Import — this app has no accounts, so
  `localStorage` is the only copy of a note unless it's exported. Note text is now run through the
  existing `linkifyCitations` helper in the browser view, so a citation typed inside a note (e.g.
  "cf. Rom 5:12") is hover-previewable like everywhere else in the app.
- **removed:** Reverted the Characters card's "of"-phrase filter, its per-candidate `/genealogies/{name}` verification, and the dictionary-term stopword filter — all three were client-side code compensating for an API-side shortcoming (an imprecise person-classifier, a missing bulk lookup). The app now shows the API's raw, unfiltered behavior on purpose — false positives and wasted-call inefficiency included — so those gaps stay visible instead of quietly patched over. See `NOTES.md` for the proposed API-side fixes.
- **changed:** Dictionary-term underlining no longer spends a real API call checking plain sentence-starting function words ("The", "Thou", "Therefore", ...) that can never actually be a dictionary headword — filtered out client-side before the candidate list is built, so a chapter's 60-word lookup budget is spent on words that could actually hit instead of guaranteed misses.
- **changed:** The Characters right-rail card now cross-checks every remaining candidate against `GET /genealogies/{name}` (a real curated lineage dataset, not a heuristic) and drops it if that doesn't confirm a real recorded person — catches single-word false positives (Man/Woman/Famine/Communion/Hospitality) the earlier "X of Y" phrase filter couldn't. Trades away real people with no recorded genealogy (Melchizedek, most foreign kings) for much higher precision; see NOTES.md for the proposed server-side fix.
- **changed:** Verse Tools panel now sits horizontally centered instead of pinned to the right edge (it was landing off-canvas). The 4 highlight-color cells are small circular dots inside a normal button-shaped slot now, not full-bleed color blocks. Dropped the permanent "Choose a tool above" placeholder row — the tool area now only takes up space once a tool actually has content to show.
- **fixed:** Multi-verse selection had regressed to single-verse-only when the Verse Tools panel was rebuilt as non-blocking. Restored: a plain click toggles a verse in/out of the selection (so several clicks build a scattered multi-selection), shift-click unions a contiguous range from the last click into whatever's already selected. The panel title compresses a selection into ranges (`Gen 1:1-3, 5, 7-9`) instead of listing every verse.
- **added:** Cross-references in Verse Tools are now hoverable for a verse preview (and still clickable to jump there) — fetches every reference's text in one batched call (`GET /bibles/{version}/verses?refs=...`), not one call per reference.
- **changed:** Redesigned the Places card preview — the OpenStreetMap iframe embed (kept in the full modal, where it's shown at a real size) doesn't render cleanly at card-thumbnail size, its own attribution/donation footer chrome dominating a box that small. The card now shows the place's real photo when the API has one, falling back to a plain static map tile (not an interactive embed) only when there's coordinates but no photo.
- **changed:** A routine 404 (this app relies on those constantly — "no illustrations/places/characters/dictionary entry/genealogy record for this") no longer raises a toast; it was firing dozens of times per chapter for completely expected outcomes. Genuine client errors (400 and friends) still toast; 429/5xx still get the dismiss-required modal.
- **added:** A dismiss-required API error modal for 429/5xx responses, showing everything the API's own error envelope sends back — message, detail, hint, and (for a 429) the full `X-RateLimit-*`/`Retry-After` picture, distinguishing per-minute vs. monthly vs. audio-stream limits. Turns out the API is genuinely descriptive here (`code`/`message`/`detail`/`hint` on every error, not just 429s) — this app just wasn't reading past `.error.code` before. A routine 404 (this app relies on those constantly for "nothing here") still just toasts, not a blocking modal.
- **added:** The Places card now previews the first place right on the card face — its real map if it has coordinates, its thumbnail if it doesn't, nothing if neither — instead of only being visible after opening the modal.
- **added:** The Timeline card is now functional: `/chronology` has no per-chapter filter server-side, so its ~100 curated entries are matched against the current chapter client-side (via each entry's free-text `reference`) to show what's relevant here, and the card opens a real modal with the full browsable timeline, the current chapter's entries highlighted and scrolled to, and each entry's reference clickable (resolved on click via the free-text citation parser) to jump straight there.
- **fixed:** Both rails could land at a different vertical position depending on the chapter — a story title (present in some chapters, not most) added real height between the chapter header and the first line of text, and the rails' alignment only accounted for that when the *current* chapter happened to have one. The reserved space is now a constant (learned once from the first story title this session renders, e.g. Genesis 23's "The Death and Burial of Sarah") applied to every chapter, so the rails hold one fixed position instead of jumping.
- **added:** Verse Tools — click a verse number to select it (shift-click extends a range) and a non-blocking floating panel pops up immediately, no separate "open" click. A single uniform 5-column grid covers every action: the 4 highlight colors directly (toggle on/off per verse, no separate "Highlight" button), Bookmark, Note, Copy, and Share on the whole selection; and Original Language, Cross-references, Commentary (source picker, defaulting to Matthew Henry/Gill when available), Compare (parallel translations), and Topics for the first selected verse. Not a modal — no backdrop, so the reading text stays clickable underneath it and shift-click can keep extending the range while it's open. Highlights/bookmarks/notes are local-only (`localStorage`, keyed by book:chapter:verse, translation-independent) — this app has no backend or accounts of its own to persist them anywhere else — and render inline as a highlight color or a small badge next to the verse number.
- **fixed:** Sweet Publishing illustrations never appeared under any pack setting. Root cause: that source's plates are only ever resolved to book+chapter — its own filename convention never encoded verse precision (see `cmd/importillustrations` in the backend) — so the API's `reference.verse` field is simply absent from every one of them; `loadInlineIllustrations` (`js/reader.js`) was filtering out anything without a verse, which silently dropped 100% of Sweet's images. A chapter's verse-less plates are now spread evenly across its verses instead of discarded (or all piled at verse 1, which would overstate a precision the source data doesn't actually have) — closer to how printed illustrated Bibles handled full-page plates anyway, landing at the nearest natural break rather than pinned to an exact verse.
- **fixed:** Clicking an underlined dictionary term did nothing — `openDictTermModal` still called `hideDictTooltip()`, a function renamed to `hideFloatingTooltip()` earlier in the same session when the tooltip helper was generalized for citation previews too. The stale reference threw and silently aborted the click handler before the modal could open.
- **changed:** API errors are no longer swallowed silently — every failed `apiJSON` call now also raises a toast with the status/error code, in addition to whatever its own call site does (several already catch errors themselves to degrade gracefully, e.g. a rail card just not rendering, which was making failures invisible). No client-side request pacing or retry either, for now — this app is also a hands-on way to see what building against a free-tier key's actual rate limits is like, so failures need to reach the surface raw rather than get smoothed over.
- **added:** RTL translations (Hebrew, Arabic, ...) now actually render right-to-left — the reading text's `dir`/`direction` follow the picked version's own `text_direction` from the catalog, mirroring the drop cap to match.
- **added:** The Places and Prophecies right-rail cards are now clickable and open a real modal — Places embeds a live map (a plain OpenStreetMap iframe, no new dependency) and thumbnail per place when the API has coordinates/imagery for it; Prophecies lists every match for the chapter with clickable fulfillment references that jump straight there.
- **added:** Any Scripture citation inside API-sourced prose (dictionary definitions and commentary text) is now hoverable for a verse preview, via a new shared `linkifyCitations` helper.
- **fixed:** Settings' "Illustrations" label sat with no gap under the Save button; also made the whole settings panel scroll instead of silently clipping content past the modal's height.
- **changed:** The right-rail Characters card now filters out "Fall of Man"/"Wrath of God"-shaped multi-word phrases, a false-positive class the API's own chapter-characters heuristic is known to admit (it has no real "is this a person" classifier — see that endpoint's doc comment). Single-word false positives (a doctrinal topic like "Man" or "Woman" rather than a specific named person) can still slip through; that would need a real classifier upstream to fix properly.
- **added:** A voice picker (icon-only caret next to the audio player, same style as the book/chapter/version pickers) for chapters with more than one active narration for the current version — only appears when `GET /audio?version_id=` actually returns more than one. A picked voice now sticks across chapter changes within that version instead of resetting to the first narration on every navigation.
- **added:** A manual day/night theme toggle in the topbar (sun/moon icon, replacing the old settings gear there), persisted per browser and applied before first paint. Settings now opens from a profile icon instead.
- **added:** Words in the reading text with a real Easton's Bible Dictionary entry get a subtle dotted underline with a brand-styled tooltip (truncated definition on hover). Clicking a term opens a modal with a tab per dictionary source (Easton's, Smith's, Hastings', Hitchcock's, Schaff's) so the full entry — and how the other four sources define the same word — is one click away. Underlining is still checked against capitalized words only (proper nouns are the large majority of real entries) and against Easton's alone for the hover pass, since the API has no bulk "which words in this text are defined" lookup — only an exact-term-or-search call per word, so checking all five dictionaries for every word in a chapter wasn't practical. Capped at 60 candidate words per chapter and cached per term for the session.
- **added:** A "Has audio" filter in the translation picker, plus a narration indicator on every version row that has one (showing a count when a version has more than one narrator) — both read the catalog's existing per-version narration count, no extra API calls. The picker's language filter also now remembers the reader's last choice (via localStorage) instead of resetting to "All languages" every time it's opened.
- **added:** Lightweight session-lifetime caching (`apiJSONCached` in `js/api.js`) for the handful of GET calls that get re-requested most as a reader browses back and forth — chapter text, chapter/book lists, illustrations, book icons, and the per-chapter places/characters cards. Signed, short-lived URLs (the audio file endpoint) are deliberately left uncached.
- **added:** The left nav's API item now opens `api.iqbible.com` directly instead of a placeholder.
- **added:** The IQ Bible mark now appears in the topbar next to the wordmark and as the favicon, using the project's existing 150×150 brand icon (no SVG source exists for it yet, only PNGs).
- **added:** Settings gained three live-applied display prefs (no Save/reload needed): Illustrations (Off/Schnorr/Doré/Sweet), Book Icons (Off/Color/B&W), and a reading font-size slider.
- **added:** Left nav rail with a Read/Search/Explore/Study Tools/Plans/My Library/Share Tools/Devotionals/Settings/API menu (Read/Search/Settings/API wired to real behavior; the rest are placeholders until those features exist) and a right rail of per-chapter context cards — Places, Characters, and Prophecies (each shown only when the API actually has data for the current chapter), plus an always-shown Timeline card. Both rails are 300px columns with their content fixed at half that width and centered, so there's breathing room on both sides; content is top-aligned at runtime to the first line of the chapter text rather than the top of the page.
- **fixed:** The left rail's nav menu and the right rail's context cards now also account for a chapter's story-title heading (e.g. "The Flood") when aligning to the top of the reading text, so they land level with the chapter's actual first sentence instead of above it when a story title is present.
- **fixed:** `404.html` (the GitHub Pages SPA-fallback copy of `index.html`) had drifted badly out of sync — missing the theme toggle, both rails, the new Settings prefs, and everything else added since the reskin. Regenerated it as an exact copy of `index.html` so a deep-link page load doesn't serve stale markup.
- **removed:** Source/license text from the translation picker's version rows — narrowed to just the language name (plus the new audio-narration indicator).
- **fixed:** Typing in a text search field (e.g. the translation picker's search box) could trigger the browser's "Save password?" prompt — with no `<form>` anywhere on the page, Chrome's password-manager heuristics were treating the whole document as one implicit form and pairing free-text inputs with the Settings API-key field. Wrapped the API key field in its own `<form>` and marked the search inputs `autocomplete="off"` to stop the false pairing.
- **changed:** Switched the app from a dark parchment/gold theme to a light theme (white/`--bg` surfaces, dark ink text) using the brand purple palette (`--brand`/`--brand-2`) for accents, links, and active states. The image viewer and toast intentionally stay dark, matching common lightbox/toast conventions regardless of site theme.
- **fixed:** `index.html`/`404.html` referenced `css/styles.css` and `js/*.js` with relative paths, which resolved incorrectly (and broke styling/scripts entirely) on a fresh load or refresh at a deep link like `/gen/1`. Switched to root-absolute paths (`/css/styles.css`, `/js/*.js`).
- **removed:** The Settings → API Base URL override and README's "Pointing it at your own API server" section. The IQ Bible API is closed-source and commercial, served only at `api.iqbible.com` — there's no "run your own compatible instance" scenario for a fork to configure, so the field only ever misled visitors.

- **changed:** Search, Explore, Study Tools, My Library, Devotionals, and Share Tools now render
  inside the center reading column instead of as full-page takeovers, with the clicked left-nav item
  shown active the same way "Read" always was (`switchMainView`, `js/main.js`) — Settings and the
  small pickers (book/chapter/version/narration) stay as popup modals, since they're quick actions
  rather than something to browse. Each view keeps a close (×) button alongside the nav rail, since
  the rail itself is hidden below 1180px and is otherwise the only other way back to Read.
- **added:** My Library's Notes tab can now create a note that isn't tied to any verse ("+ New Note")
  — a reader's own standalone thought, with an optional title in place of a Scripture reference.
  Sorts into its own group in "By Book" mode and exports/imports alongside verse-tied notes.
- **removed:** Study Tools' Cross-Reference Graph tab — too many concurrent API calls for too little
  reading value.
- **fixed:** Study Tools > Textual Variants' book filter had no brand styling (missing the
  `share-fields` class the rest of the app's selects use) and listed all 66 books even though variant
  entries only exist for a subset — now built from the books actually present in the already-fetched
  data instead of the full book list.
- **fixed:** Devotionals' date picker always showed the year 2000 (a placeholder for a dataset that
  has no real year concept) — now shows the actual current year; the year is still discarded on
  read-back exactly as before, so this is display-only.
- **fixed:** Explore > Atlas's place image and map were stretched into a wide, cropped strip at the
  tab's column width. Resized and centered. Also added a Description section, sourced from the app's
  existing dictionary lookups (Easton's/Smith's/Hastings'/Hitchcock's/Schaff's — Smith's in
  particular covers Bible geography) for a matching place name — the API's own place record has no
  description field of its own (logged in `NOTES.md`), but the dictionary sources it already uses
  elsewhere often do.
- **fixed:** Explore > Genealogy's "Find a relationship" From/To inputs had no brand styling — the
  `.share-fields` input rule only matched `type=number` fields, not the `type=text` ones these are.
- **fixed:** Explore > Collections' Names of God / Titles of Jesus / Weights & Measures (and the new
  Stories entry below) didn't show a verse-hover preview on their reference — they were resolving all
  15-30 items' citations eagerly via `linkifyCitations` on render, firing that many concurrent
  `/parse/citations` calls at once. Switched to the same lazy resolve-on-first-hover pattern Timeline
  already uses (`resolveTimelineRef`), reused as-is; `jumpToTimelineRef` was generalized into
  `jumpFreeTextRef(refText, onClose)` so both Timeline and Collections share one click-to-jump
  implementation instead of near-duplicates.
- **fixed:** Explore > Topics — clicking any topic failed with "Could not load this topic." The
  detail endpoint (`GET /topics/{topic}`) only accepts `?edition=iqbible` or `?edition=nave-torrey`
  (or omitted, which falls back sensibly); the list-only `?edition=all` value was always being sent
  through regardless, 400ing on every click since that's this tab's default filter.
- **added:** Explore > Collections gets a Stories entry — the same `/stories` dataset that already
  powers inline chapter-heading titles while reading, now also browsable as a full list (title,
  summary, reference, era), reusing that existing cache rather than a second fetch.
- **fixed:** `404.html` had drifted out of sync with `index.html` again (missing the center-column
  view changes above) — re-synced.

## [0.1.0] - 2026-08-22
- **added:** Version/book/chapter navigation, including a search-first translation picker across 1,000+ languages, with a language quick-filter row and per-book USFM-driven Old/New Testament grouping.
- **added:** Full chapter reading with real paragraph breaks (`¶` markers rendered as actual `<p>` breaks, not literal characters), a drop cap on each chapter's first verse, and inline Schnorr illustrations floated beside their tagged verse.
- **added:** Inline story titles (e.g. "The Flood") resolved from the `/stories` dataset via the free-text citation parser and inserted as headings at their starting verse.
- **added:** Inline audio narration — an always-visible player shown whenever the current version has narration, fetching the actual file only on first Play.
- **added:** Full-text search overlay (`Cmd/Ctrl+K`) with phrase/boolean mode, debounced-as-you-type triggering, highlighted matches, and cursor-based "load more" pagination.
- **added:** Shareable deep links (`/{book}/{chapter}[/{verse}]`, e.g. `/gen/1/1`) with browser back/forward support via `pushState`/`popstate`.
- **added:** Per-user API key entry (Settings), stored only in `localStorage` — nothing is hardcoded or shipped in source, so a public deployment never leaks a shared credential. `js/config.js`'s `API_BASE` and an in-app Settings override both point the app at any IQ Bible API instance, including a local `go run ./cmd/iqbible` server.
- **added:** Deploy-ready for GitHub Pages (`404.html` fallback for deep links, `BASE_PATH` for project sites) and Cloudflare Pages (`_redirects`) out of the box.
