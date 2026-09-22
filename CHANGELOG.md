# CHANGELOG for IQ Bible App

All notable changes to this project will be documented in this file. This CHANGELOG follows SemVer, see https://keepachangelog.com/en/1.1.0/

## [Unreleased]

## [1.24.1] - 2026-09-22
- **removed:** `ACCESSIBILITY.md` — the WCAG 2.2 AA remediation log it kept is no longer needed
  now that the pass it tracked (2026-09-05) is done; its five remaining follow-ups are now
  individual GitHub issues instead of a standing notes file.

## [1.24.0] - 2026-09-22
- **changed:** Cross-references (Verse Tools) now lead with the verse actually being
  cross-referenced, then a numbered list of each reference with its full verse text over its
  right-aligned citation pill — reading a cross-reference no longer means hovering the pill or
  leaving the chapter to see what it says, and the Cross-refs button itself now shows how many
  there are before you even open it. The Prophecies modal was redesigned the same way: each
  prophecy is now numbered and titled (from its own description), followed by the scripture in this
  chapter and its fulfillment(s), each with the same text-over-pill treatment; its header now reads
  "13 Prophecies in John 12" rather than "Prophecies in John 12 (13)", and the chapter card shows
  the same count as a badge. The audio voice picker labels an unnamed narration "Voice 1", "Voice
  2", etc. instead of its raw internal id (e.g. `eng_kjv_2`). On mobile, the chapter-context icon
  row (Places, People, Prophecy, Timeline, About) now shows a small title under each icon and
  spreads them evenly across the row instead of clustering left; the right-rail card sheet's
  preview text is smaller than the desktop rail's (the
  modals it opens are unchanged).


## [1.23.1] - 2026-09-06
- **fixed:** Link-preview card follow-ups. A shared verse whose text contains a quotation mark no
  longer breaks its own preview card. A link to a verse or chapter that doesn't exist (past the end
  of the book) now returns a normal 404 instead of a card with a missing image. A link carrying a
  translation code the API doesn't recognise no longer falls back to a preview in an unrelated
  translation.

## [1.23.0] - 2026-09-06
- **added:** Sharing a link to a chapter or verse (`app.iqbible.com/gen/32`, `/jhn/3/16`,
  `/gal/5/14-16`) now unfurls a proper preview on LinkedIn, Slack, iMessage, Discord and anywhere
  else that shows link previews — the reference as the title, the verse text, and a verse-card
  image — instead of nothing. Hosted instance only; a self-hosted copy would need its own proxy in
  front (as it already does for the API key).
- **changed:** The translation picker's language button now carries a small "Filter by language"
  caption above it, so its purpose is clear before you open it, and its screen-reader name leads
  with that verb instead of just reading out the current language.

## [1.22.0] - 2026-09-06
- **changed:** The translation picker's language filter is now one always-visible button at the top
  of the panel — showing the current language and how many versions it has — instead of a strip of
  language chips that scrolled sideways. Tapping it opens a dedicated language screen with its own
  filter box and the full list of languages (not just ten presets), each with a version count.
  Previously the selected language could sit scrolled out of view, so a filtered list looked
  unfiltered and a search for another language turned up nothing; the search box now also names
  what it's searching ("Search Spanish versions…"), and both search boxes got a clear (×) button.

## [1.21.0] - 2026-09-06
- **fixed:** A place the historical data can't pin to a modern location (Nod, and a handful of
  others) showed its status as a raw code — `unknown_place` — which read like an error. It's now
  written plainly ("Unknown place"), in the chapter Places view and the Bible Atlas alike.
- **fixed:** On a version that narrates only part of the canon — a Greek New Testament with no Old
  Testament audio, say — pressing Play on a chapter it doesn't cover used to leave the player
  stuck retrying a missing file. It now shows a short "Narration isn't available for this chapter"
  line in the player instead, and clears it as soon as you move to a chapter that does have audio.
- **fixed:** A chapter illustration that landed on the same verse as a section heading (Genesis 9's
  Sweet Publishing plate at "The New Covenant") no longer wedges between the heading and its first
  verse — it now sits just below that verse, so the heading stays with the text it introduces.
- **changed:** A Scripture reference that spans a longer passage (John 3:1-10) is now hover- and
  click-previewable like any other — the popup shows the opening verses with a "+N more" note
  rather than being left as plain text because the range was too long.
- **fixed:** Hovering a deuterocanonical reference (1 Maccabees, Sirach…) while reading a
  66-book translation now shows the verse text. The preview lookup falls back to the citation
  resolver — which finds an apocrypha-carrying edition — for any reference the reading version
  can't itself resolve. Affects cross-references, prophecy fulfilments, and the My Library tabs.
- **fixed:** Study Tools › Commentaries now lists only the sources that actually have an entry for
  the chapter (or verse) you're looking at, instead of every source that touches the book
  anywhere. Picking a book with sparse coverage no longer shows a long list that's mostly dead ends.
- **changed:** Sharpened the page title and the link-preview (Open Graph) card copy — a social
  unfurl of app.iqbible.com now leads with "read Scripture in 1,400+ translations" and a real
  description rather than a bare site name. (An existing LinkedIn/Slack/etc. preview may need a
  manual re-scrape to pick up the change.)
- **changed:** Continuous play ("Keep playing narration into the next chapter") now carries on
  across a book boundary too — the end of Malachi rolls into Matthew, Titus into Philemon — and
  stops only at the last chapter of the canon rather than at the end of each book.
- **added:** README now has a "Working on the code" section — architecture, a file-by-file map of
  the `js/*.js` layout, the script load-order gotcha, and the doc-sync / verse-preview /
  accessibility conventions — for anyone forking or extending the app.
- **changed:** On a phone, the ⓘ next to the chapter title is replaced by a small row of muted
  icons just below it — Places, People, Prophecy, Timeline (each with a count of what the chapter
  holds) and About. Each opens its view directly; About opens the full Chapter Info sheet. The
  swipe-in-from-the-right gesture still opens that sheet too.
- **fixed:** That icon row no longer makes the page jump when you swipe to a chapter you haven't
  read yet — it now holds its place from the moment the chapter loads instead of appearing a beat
  later.
- **added:** Book Icons now offers a "Lettered" style — every book shown as its abbreviation
  (GEN, 1CO, REV…) — alongside the existing Overview Bible artwork. The Color / Black & White
  choice applies to both: Overview Bible art, and the lettered tiles (brand purple vs greyscale).
  Books the Overview Bible set doesn't cover already used the lettered tile as a fallback.
- **changed:** The book icon in the reading header is now tappable — it opens the book picker,
  the same as tapping the book name.
- **changed:** The right-side context rail now leads with what's specific to the chapter you're
  reading (About Chapter, Places, Timeline, People, Prophecies); the book overview, which is the
  same across a whole book and is also in the book/chapter picker's Intro, moves to the end as a
  one-line card. Each card now carries a small icon matching the mobile row.
- **added:** The desktop left nav now discloses sub-items for the three sections that open a
  tabbed view — Explore (Atlas, Collections, Extrabiblical, Genealogy, Harmony, Topics), Study
  Tools (Book Guide, Dictionary, Word Study, Commentaries, Textual Variants) and My Library (Notes,
  Bookmarks, Highlights, History). Click the caret to expand a section — a single-open accordion:
  opening one (or navigating into it) closes the rest, and leaving for a view without sub-items
  closes it too. Clicking a sub-item opens that view straight to its tab, and each tab is now
  linkable (e.g. `#study-tools/word`). Mobile is unchanged — the Discover sheet already covers this.
- **added:** My Library shows a quiet count next to each of Notes / Bookmarks / Highlights in the
  left nav, and a total on "My Library" itself (capped at 9+). They update live as you save or
  remove items. History isn't counted (it's a recent-activity list, not saved content).
- **fixed:** The reading header no longer jerks sideways when you change chapter or book — the
  column was taking its width from the loading spinner rather than the verses, and a reserved
  scrollbar gutter now keeps it from shifting between short and long chapters too.
- **changed:** Dropped the small ⓘ button next to the book/chapter title on desktop. The book
  overview it opened is in the right rail (and the book/chapter picker's Intro); the mobile Chapter
  Info sheet already showed it.
- **changed:** The "About Chapter" (was "About This Chapter") rail card now shows a two-line taste
  of the actual overview text with an ellipsis, instead of a fixed teaser line / a five-line block.
  Tap through for the full text as before.
- **changed:** On a phone, swiping between chapters is now a real page drag — the next (or
  previous) chapter's verses follow your finger in from the edge, so you see where you're going
  before you commit; release past about a third of the way to turn, or let go to snap back.
  Resists at the first and last chapter of the Bible. (At a book boundary it falls back to a
  slide-and-fade, and the preview reuses the same fetch the turn needs — no extra API calls.)
- **fixed:** The right-rail "Places" card no longer shows a big blank square when the chapter's
  first place has no photo or map (e.g. Exodus 31's "the Holy Place"). It now uses the first place
  in the chapter that *does* have imagery; if none do, the card shrinks to a one-line list the
  size of the People and Prophecies cards.
- **fixed:** The right-rail "Places" card's image is no longer squashed to a thin sliver when the
  chapter has a long list of places (Genesis 14). The photo (or map) now keeps a proper 4:3 shape
  and the card grows to fit; the caption under it is one line — the first place plus a "+N more"
  count.
- **fixed:** On a narrow phone (iPhone SE, Galaxy Z Fold cover screen), the "Copy" and "Compare"
  buttons in the verse Tools panel ran off the right edge of the screen. The tool grid now fits
  the panel at every width, dropping to three columns on the smallest phones.
- **changed:** On a phone, the tab rows in Explore, Study Tools and My Library now wrap onto as
  many rows as they need instead of scrolling sideways. Jumping straight to a tab near the end
  (Discover › Harmony) no longer lands you on an active tab that's scrolled out of view.
- **fixed:** Chapter section headings (e.g. Exodus 35, "An Offering for the Tabernacle") and inline
  illustrations no longer render a beat after the verses and jolt them down — both are now placed
  as the chapter renders, in one pass. This also means the swipe pager's preview shows the headings
  and plates and stays aligned, to the word, with the page it turns to.
- **changed:** The audio player's sleep-timer button only appears when "Keep playing narration into
  the next chapter" is on. Without it a chapter is just a few minutes of audio, so the minute
  options never applied and stopping at the chapter's end was already the default.
- **changed:** On a phone, the audio player now fades in and out when narration starts or stops,
  instead of appearing and disappearing instantly.
- **fixed:** On a narrow phone, the playing audio bar's voice picker and sleep-timer button could
  be pushed off the right edge of the screen (the sleep timer often not visible at all). The
  controls now stay on-screen down to the smallest phones; the bar drops its elapsed-time readout
  to make room at those widths.
- **fixed:** On a phone, pausing narration from the expanded player also hid the bottom bars (as
  if you'd scrolled down). Pausing now just collapses the player and leaves the bars in place.
- **fixed:** On a phone, the cards in the Chapter Info sheet (Places, People, Prophecies, Timeline,
  About) did nothing when tapped — the sheet's own contents were being frozen along with the page
  behind it.
- **fixed:** Narration that was paused and returned to much later (after the audio link had
  expired) would silently refuse to play until a page reload. The app now fetches a fresh link on
  the fly and picks up where you left off.
- **changed:** A book with no icon on file (most of the deuterocanon — 2 Maccabees, Tobit, Sirach…)
  now shows a small text tile with its abbreviation ("2MA", "TOB") in the reading header, the same
  size as a real icon, instead of an empty box.
- **added:** Settings option "Mark a chapter read when I finish listening to it" (off by default) —
  when a chapter's narration plays to the end it's added to your Progress, unless a sleep timer is
  running (chapters that play out while you're dozing off don't count).
- **fixed:** The "Next" button at the foot of a chapter had its › chevron before the label instead
  of after it.
- **added:** Accessibility — the app now targets WCAG 2.2 AA (issue #250).
  - Keyboard: a "Skip to reading" link, a visible focus outline everywhere, verse numbers are real
    buttons (Verse Tools without a mouse), dictionary words and Scripture references in prose are
    focusable and preview on focus (Esc to dismiss, and the popup no longer vanishes when you reach
    for it), every list row / card / picker responds to Enter and Space, and the audio progress bar
    is a real slider (arrow keys, with the current time announced).
  - Dialogs: every modal now traps focus while open, returns focus to what opened it on close,
    hides the rest of the page from assistive tech, and is announced with its title. The "add an
    API key" screen and the guided tour get the same treatment.
  - Announcements: status messages (the little toast) are now read aloud by screen readers.
  - Reading: the chapter has a proper page heading and title, and its text carries the correct
    language for the translation you're reading.
  - Visuals: secondary text was darkened to meet contrast in both light and dark themes; selected
    filter/tab chips now show a weight change, not just colour; small controls (highlight
    swatches, the tag "×") were enlarged to a comfortable tap size; all motion respects the
    "reduce motion" system setting and the UI adapts to Windows High Contrast.
- **added:** An **Accessibility** page (linked from the left-nav footer, the About page, and Help)
  — the standard it targets, what's been tested, the known gaps, and how to report a problem.

## [1.20.0] - 2026-09-05
- **changed:** The reading header reads the same on desktop and mobile now — book and chapter as
  one flush "Book Chapter" title (still two separate click targets, just no caret chevrons). On
  desktop the translation pick sits right after it; on a phone it's the pill in the top bar next
  to Search (the slim header has no room).
- **added:** Continuous play — a Settings toggle ("Keep playing narration into the next chapter").
  When a chapter's narration ends it loads the next chapter and keeps playing; stops at the end of
  the book. Off by default.
- **added:** A sleep timer in the audio player (the clock button) — Off / 15 / 30 / 45 / 60 minutes
  / End of chapter. While it runs the button shows the time remaining; at zero it eases the volume
  down over a few seconds and pauses. Per session, not saved.
- **changed:** The book picker and chapter picker are now one navigator — pick a book and its
  chapters appear in the same panel, with a back arrow to the book list. Choosing a book no longer
  drops you straight onto chapter 1 (single-chapter books — Obadiah, Philemon, Jude, 2–3 John —
  still open directly); the reading header's chapter button opens straight to that book's chapters
  with the book list one tap back. Applies on desktop and mobile.
- **added:** The navigator shows an "Intro" row above the numbered chapters when the API has
  introduction text for that book (`GET /books/{book}/info`). It opens the same lightweight book
  overview as the reading header's (i) button (author/date, Canonical Significance, Introduction,
  with a link through to the full Book Guide). Hidden for books the API carries no intro text for.
- **changed:** The mobile bottom nav is four fixed tabs — Read, Discover, Notes, More — instead of
  five. Explore and Study Tools are no longer tabs; "Discover" opens a sheet listing both (Atlas,
  Collections, Genealogy, Harmony, Topics, Extrabiblical; Book Guide, Dictionary, Word Study,
  Commentaries, Textual Variants), each opening the existing overlay at that tab. The desktop left
  rail is unchanged.
- **changed:** On a phone the translation pill now lives in the top bar next to Search, and the
  separate font-size and day/night buttons collapse into one "Aa" control that opens a Display
  sheet (both font sliders plus a Light/Dark toggle); long-pressing "Aa" flips the theme directly.
  The reading dashboard (streak/counts) moves to a row at the top of the "More" sheet. Desktop's
  top bar is unchanged.
- **changed:** The mobile reading chrome is rebuilt around a bottom control row (`#readNavRow`),
  docked just above the nav where a thumb reaches it: prev/next as a left-aligned pair, then a
  single "Book Chapter" button that opens the navigator. The chapter header collapses to a slim
  one-line label (book · chapter · a single ⓘ for chapter context — its sheet now leads with the
  book's own overview). The old chip row under the pickers is gone.
- **changed:** Audio narration on a phone is a round play button at the end of that row, shown only
  when the chapter has narration, with a ring that tracks position. Pressing it turns the row into
  the full player (scrubber, time, voice picker) in place; pausing brings the picker back. The
  separate full-width docked audio bar is gone, and the bar no longer reserves height whether or
  not there's narration — so the reading column is the same length either way.
- **changed:** Take a Tour and the Help page were updated for the new mobile navigation (Discover,
  the bottom control row, the ⓘ chapter-context button, the profile row in "More").
- **changed:** On a phone the "Read on …" stamp now sits inline at the right of the chapter header
  (a condensed "Read MM/DD/YY") instead of on its own line below it.
- **fixed:** The book overview modal (the ⓘ) no longer scrolls sideways on a phone when the
  author/date line is long, and — when opened from the mobile Chapter Info sheet's "About this
  book" card — it now opens on top of that sheet instead of behind it.
- **fixed:** The round audio button's progress ring is cleared when you move to another chapter,
  so it no longer briefly shows the previous chapter's position. Changing the narration voice no
  longer collapses the player back to the picker.
  - **fixed:** After the audio sleep timer's fade-out ran (or two overlapping fades did), the
  narration volume stayed turned down for the rest of the session — so "Keep playing narration into
  the next chapter" appeared to stop working and only a page reload brought the sound back. The
  fade now always restores full volume, and a chapter change cancels any fade still in progress.
- **fixed:** Closing Settings could trigger Chrome's "Update password?" prompt. The API-key field
  is no longer a password input (it's the visitor's own key, not a site credential) — it stays
  visually masked in Chrome/Edge/Safari, and Chrome's password manager leaves it alone.
- **fixed:** A chapter that opens with a story-title heading (e.g. Genesis 4) and one that opens
  straight into verse 1 (e.g. Genesis 5) now start their first line at the same height — the two
  were off by the heading's top margin.

## [1.19.0] - 2026-09-05
- **added:** Chapter navigation is now consistent across breakpoints instead of each having only
  half of it. The fixed, vertically-centered prev/next arrows (desktop-only before) now also show
  on mobile, docked to the screen edges and riding the same scroll-hide chrome as the topbar/footer
  (hidden on scroll-down, back on scroll-up). The descriptive end-of-chapter buttons — "Previous" /
  "Next [book/chapter name]" (mobile-only before) — now also show on desktop, at the foot of the
  chapter alongside "Mark as read". Neither is a replacement for the other: the fixed arrows work
  mid-scroll, the end-of-chapter pair tells you by name where you're headed.
- **changed:** The mobile chip row under the chapter pickers dropped its "About Ch." chip — it was
  a shortcut to a shortcut, opening the same chapter-overview modal that's already the first card
  inside "Ch. Info" (now relabeled "Chapter Info"). Two chips instead of three, no functionality
  lost. Updated the Take a Tour step and two Help page mentions that referenced the old chip/label.
- **fixed:** The PWA's maskable icon (`img/icon-maskable-512.png`, what Android actually uses for
  the home-screen icon, cropped into a circle/squircle) had a solid `--brand` purple background
  with the flower mark drawn in a barely-different purple on top — low contrast, and inconsistent
  with every other icon/favicon in the app, which use a light background (matching
  `apple-touch-icon.png`'s `#f7f6fc`) with the mark in its normal vivid purple. Regenerated from
  `icon-512.png`, scaled into the safe zone so it survives OS mask-cropping. Bumped `sw.js`'s
  `CACHE_VERSION` so installed visitors actually pick up the new icon.
- **added:** The reading page's version button, Compare Versions chips, and the compare-row labels
  now carry a native tooltip with the full version title — `shortVersionLabel`'s abbreviation is
  necessarily lossy (KJV/KJVO/KJVA all look similar at a glance), so hovering shows exactly which
  edition it is.
- **changed:** The no-results fallback dropped its curated ~5-version shortlist (deciding which
  handful of a language's editions count as "common enough" is an arbitrary call, and it already
  missed real hits — an archaic-spelling word only in the Geneva/1611/Tyndale editions, a
  Deuterocanon name only in CPDV/Douay-Rheims) in favor of an explicit "Search all N other
  [language] versions" button that checks every version sharing the searched version's language,
  throttled to 8 concurrent requests with a live "Checked X of N…" progress line, and honest
  reporting if the API starts rate-limiting partway through instead of silently under-reporting
  hits. New `FEATURE_SEARCH_ALL_VERSIONS` constant in `js/config.js` lets a self-hoster running a
  shared/proxied key disable this fan-out entirely.
- **fixed:** Clicking a search result from a version other than your current reading version
  (via the "Searching in" selector or the version-fallback prompt) could silently open the
  reference in your *current* version instead — `jumpToVerse`'s "does the current version have
  this reference at all" check is correct for a citation link (any version showing the passage is
  fine), but not for a search result, whose text belongs specifically to the version it was found
  in. A book both versions share (e.g. Nehemiah) passed that check and navigated in the wrong
  version with no prompt at all. Search results now always offer to switch when the result's
  version differs from the current one, regardless of whether the current version also happens to
  contain that reference.
- **fixed:** `shortVersionLabel` (the abbreviated version label used on the reading page's version
  button, Compare Versions, the favorites row, and search's results meta line) stripped *any*
  parenthetical content before abbreviating, meant to stop a source citation like
  "(wordproject.org)" from contributing a stray "(" to the acronym — but the per-word filter
  already handles that case on its own, and the blanket strip also swallowed real distinguishing
  edition text, collapsing "King James Version (1611 Original)" to the same "KJV" as plain KJV.
  Removed the blanket strip; both cases now resolve correctly ("KJVO" vs "KJV").
- **fixed:** A search result's number badge sat directly against the reference with no visual
  separation, reading like part of the reference itself. Now a distinct small pill.

## [1.18.0] - 2026-09-05
- **added:** "Choose a translation" picker can now favorite a version (★ toggle on each row) — a
  small chip row above the language filter gives one-tap access to your favorites regardless of
  whatever language/audio/search filter is currently active in the list below, so a favorite never
  goes missing just because an unrelated filter is still on. Client-side only, shared across every
  picker mode (reading, search, plans, compare).
- **fixed:** Search's Verses/People tab row had no gap from the search input above it (`.lib-tabs`
  elsewhere always relies on its parent's padding for that, since it's normally the first thing in
  the overlay — here it isn't). The Mode chip row also had no `flex-wrap`, so on a narrow viewport
  "Starts with"/"Advanced" ran off-canvas with no way to reach them.
- **fixed:** The no-results "Search other versions" fallback checked candidate versions without the
  active Testament/Book/Chapter/Verse filters, so it could report a version as a match purely
  because the *unfiltered* phrase existed there, then re-run the real search with the filter still
  on and (correctly, but confusingly) find nothing. The fallback now checks under the same scope as
  the search that just missed.

## [1.17.0] - 2026-09-05
- **added:** Search overhaul (issue #290). The Verses search overlay now exposes all five match
  modes (All/Any/Exact phrase/Starts with/Advanced boolean), an Exclude-words field, Testament and
  multi-select Book filters, Chapter/Verse-range filters, and a Verse-order/Best-match sort — all
  of it wired to `GET /bibles/{version}/search` params the app wasn't using yet. Highlighting now
  uses the API's own `highlight=1` field instead of a client-side regex reimplementation. A new
  "Searching in" version selector lets a search target a different translation than the one you're
  reading, reusing the existing translation picker and the existing "switch & read" prompt when you
  open a result that isn't in your current version. A new **People** tab searches the API's
  disambiguated Bible-person index (`GET /bible-people`) instead of verse text — the actual fix for
  "'Lot' (person) brings up 'lot' (noun)", with a "Looking for a person?" nudge on an exact name
  match from the Verses tab. Also added: Saved/Recent search history, and an opt-in "Search other
  versions" prompt on a zero-result search.

## [1.16.4] - 2026-09-05
- **fixed:** The 1.16.3 lightbox fix set the `<img>`'s `width`/`height` attributes but the
  `#imageViewScrim img` rule only had `max-width`/`max-height` — with no `width:auto; height:auto`
  to override the resulting fixed-pixel box, the two max- constraints clamped each axis
  independently instead of scaling together, visibly stretching plates whose aspect ratio didn't
  match the viewport's. Added `width:auto; height:auto` so the box scales proportionally again,
  matching the pattern `.inline-illust img` already used.

## [1.16.3] - 2026-09-05
- **fixed:** Inline chapter illustrations (and their lightbox) now use the API's per-image
  `width`/`height` to reserve their exact box via computed `aspect-ratio` before the plate loads —
  zero reading-column shift on any connection, superseding the 1.16.2 hidden-then-batch-reveal
  mitigation (removed). Falls back to today's small residual shift for a plate the API hasn't
  backfilled dimensions for yet.

## [1.16.2] - 2026-09-04
- **fixed:** Inline chapter illustrations no longer make the reading column jump around as they
  load. Two causes: the plate data came from a second API call fired *after* the chapter text had
  already painted, and each `<img>` reserved no height so it snapped from nothing to full size on
  load — several plates doing that at staggered times read as choppy. Now the illustrations fetch
  runs concurrently with the chapter-text fetch, and the figures are held hidden until their
  images have decoded, then revealed together — so the column settles once instead of once per
  plate. Off-screen plates still reveal immediately (the reader isn't looking, and scroll
  anchoring holds their place). Exact space reservation needs per-image dimensions the API doesn't
  return yet — logged as an API gap (`NOTES.md`); until then a single small settle remains.

## [1.16.1] - 2026-09-04
- **fixed:** The full-view illustration lightbox pulled `image.full` — the untouched 1–3 MB JPEG
  master — on every zoom tap. It now reuses the inline figure's own `srcset` ladder at
  `sizes="100vw"`, so a zoom tap lands on a large WebP rung (~200–400 KB, browser-picked for the
  device) instead. Indistinguishable on screen; `image.full` stays the right source only for a
  future "download this plate" affordance.

## [1.16.0] - 2026-09-04
- **changed:** A `401`/`403` from the API now opens the same descriptive error modal that `429`
  and `5xx` already did (code, message, hint), instead of a bare toast + an errnote showing only
  the raw error code. This matters most for a refused API key: the API returns `api_key_required`
  for an *unrecognized* key, not only a missing one, so a stale or mistyped key used to surface as
  "Could not load Genesis 1. api_key_required" — which reads like "no key set" when a key is in
  fact set. The modal's Message/Hint rows now make "your key was refused" unambiguous. Shown once
  per page load so a bad key failing several calls in a row doesn't stack modals. The reader's
  own inline error for a refused key now says so in plain language, with a link to Settings,
  instead of echoing the raw `api_key_required` code.
- **docs:** `README.md`'s "Running it locally" section no longer claims you can double-click
  `index.html` and open it via `file://` — that stopped working when `<base href="/">` was added
  (assets resolve against the filesystem root and don't load). It now lists concrete static-server
  commands (`npx serve .`, `python -m http.server`, `php -S`, VS Code Live Server) instead.
- **changed:** Inline chapter illustrations now use the API's responsive image bundle. Every
  `/illustrations` entry carries an `image` object with a pre-formatted `srcset` ladder
  (320–1920w, served as WebP or JPEG per the request's `Accept`) plus `full`, the untouched
  master. The inline `<img>` now ships `srcset` + `sizes` so the browser paints the 320w/640w rung
  (WebP-negotiated) for the ~260px figure instead of the 1–3 MB master it pulled before, and keeps
  `loading="lazy"` + `decoding="async"` so below-the-fold plates don't load or decode on first
  paint. The full-view lightbox loads `image.full` when a plate is tapped to zoom. The `?size=`
  request param (and the earlier client-side `/medium/`→`/high/` URL swap) are gone. Falls back to
  the old master URL if `image` is absent.

## [1.15.0] - 2026-09-03
- **added:** Open Graph / Twitter card metadata in `index.html` and `404.html`, so a
  shared `app.iqbible.com` link unfurls as a real 1,200×630 card (the IQ Bible lockup, the
  "Raise your Bible IQ" line, and the study feature set) instead of a bare favicon. New asset
  `img/iqbible-og-card.png`. The `?v=` on the image URL is a manual cache-buster — bump it when
  the card art changes, since social scrapers cache by URL and ignore `ETag`.

## [1.14.0] - 2026-08-31
- **added:** About page now has a prominent "Learn more about what IQ Bible is" button linking
  out to iqbible.com, under the top description.
- **changed:** The "IQ Bible" wordmark in the left-rail footer, the mobile "More" menu footer, and
  the About page version line is now a link to iqbible.com (no underline, to keep the wordmark
  clean). The left-rail footer's "© <year> IQ Bible" line is also slightly larger.
- **changed:** The translation picker's audio filter is now a labelled checkbox ("Only
  translations with audio narration") instead of a "Has audio" chip that didn't read as a toggle.

## [1.13.1] - 2026-08-31
- **fixed:** On the hosted instance, running a search fired the "set your API key in Settings"
  gate — the one gate that checked only for a missing key without the `IS_HOSTED_INSTANCE`
  exemption every other gate has. Because the gate's lockdown only lifts on a fresh load after a
  key is saved, and there's no key to save there, the app stayed blocked. Search now honours the
  hosted-instance exemption like the rest of the app.

## [1.13.0] - 2026-08-31
- **changed:** The mobile bottom bar is reworked (issue #247). **Notes** is now one of the five
  nav tabs — Read · Explore · Study · Notes · More — instead of a slim pull-tab that was easy to
  miss; **Share Tools** moves into the "More" menu.
- **changed:** On a phone the audio-narration player is a bar docked above the nav (it slides
  away with the rest of the chrome as you scroll and comes back on scroll-up), its play button
  lined up over the Read tab, and with a labelled **Voice** button — showing the narrator's name
  where the source provides one — whenever a version has more than one recording.
- **changed:** The chapter-context cards (places, people, prophecies, timeline) are reached on a
  phone from three plain chips under the book/chapter pickers — **About <book>**, **About Ch.**,
  **Ch. Info** — replacing an unlabelled grid icon and a separate "about this book" button. The
  chips are part of the sticky header, so they slide away and return with the pickers as you
  scroll.
- **changed:** *(dev)* The service worker is a pure pass-through when the site is served from
  `localhost` / `127.0.0.1`, so a local checkout picks up every edit on the next reload instead of
  one reload later; added `serve.py`, a zero-dependency static server with the SPA fallback
  deep links need. No change to the hosted/deployed behaviour.

## [1.12.0] - 2026-08-30
- **added:** "About This Chapter" — a new context card beside the reading column with a short
  overview of what the chapter is about (the "argument of the chapter" from a classic
  public-domain commentary), the commentator credited, and every reference in it hover-previewable.
  Where more than one commentary wrote one, a switcher lets you compare. Not available for the
  deuterocanonical books.
- **changed:** The context cards beside the reading column are now sized so all of them fit
  without the column scrolling or tucking under the Notes button — "About This Chapter" and
  "Places" are square, Timeline / People / Prophecies are one-line teasers that open the full
  view on click.
- **changed:** The Timeline now marks the chapter you're reading *in the timeline itself* — a
  "You're reading" marker slotted at the chapter's place among the events (its own event when it
  has a dated one, otherwise its story title and era at the chapter's chronological position,
  flagged approximate), scrolled into view on open. It was previously only a line of text above
  the list that scrolled out of sight. The Timeline card beside the reading column shows the same
  placement instead of a bare event count. The full timeline is now canon-aware: on a translation
  with the deuterocanon the Maccabean-era events carry their 1–2 Maccabees references, and a set
  of secular world-history anchors (Rome founded, Vesuvius, …) is woven in for a feel of the
  period, shown in a lighter style.
- **changed:** In the People card, tapping a person — or one of their family chips — now opens the
  exact individual, not whichever namesake happens to come first. Genesis 8 → Noah → "Naamah" now
  opens Naamah the daughter of Lamech (Genesis 4:22), not the later Ammonite queen; Revelation 12
  → "Michael" opens the archangel, not the Numbers 13 spy. When a name is shared and the lookup
  can't tell which is meant, an "other people named …" row lists the alternatives.
- **added:** People cards now populate for the deuterocanonical books — Tobit, Judith, 1–2
  Maccabees, Sirach, Susanna, Bel and the Dragon and the rest — on a translation whose canon
  includes them. People sourced from those books are marked "Deuterocanonical" in their detail
  view.
- **changed:** A person's "first appearance" / "last appearance" are now their actual first and
  last mention in Scripture. The "Key Events" list has been removed — it was built by matching the
  bare name against a topical index, which merged different people who share a name and carried
  garbled labels; there's no reliable per-person source for it yet.
- **changed:** Verse-by-verse commentary pickers (Verse Tools ▸ Commentary, and Study Tools ▸ Book
  Guide) now list only the sources that actually have something for the verse — or, for a book
  introduction, the sources that actually wrote one — instead of every source that touches the
  book and an empty panel when you pick the wrong one.
- **changed:** Bible Atlas place descriptions now come from a dictionary entry matched to the place
  by its own Scripture citations — so "Ai" resolves to the Canaanite city of Joshua, not the
  village in Jeremiah — rather than an exact-name lookup that missed anything not spelled as a
  19th-century headword. Places with no matching entry (a handful of minor or extra-biblical
  names) simply show no description.
- **fixed:** Following a Scripture reference the current translation can't show — a note anchored
  to a deuterocanonical verse (1 Maccabees, Wisdom, …), or to an extra chapter or verse a larger
  canon adds (Daniel 13-14, the Prayer of Azariah at Daniel 3:24-90, the Greek additions to
  Esther) — followed while reading a translation without it, no longer drops the reader on an
  error or a silently empty chapter. Instead a dialog offers to switch, and now **names a
  translation that has the reference** ("King James Version + Apocrypha includes Wisdom. Switch to
  it and go to Wisdom 3:1?") — preferring the one the reference was captured in when a note
  recorded it. Landing on such a chapter by a deep link or the Back button shows the same "isn't
  in this translation" note.
- **added:** A verse added to a note from Verse Tools now remembers the translation it was taken
  from. Where that differs from what you're reading, the note's reference chip shows it (e.g.
  "Wisdom 3:1 · DRC"), its hover-preview and its Markdown export are labelled with it, and its
  preview text loads from that translation even when you're reading another — so a note that
  gathers verses across canons stays coherent.
- **changed:** Verse hover-previews inside prose (dictionary and commentary entries, the Timeline
  card) now resolve against the translation you're reading rather than always the King James
  Version — so the preview matches your version, and a deuterocanonical citation can preview when
  your version carries that book. A deuterocanonical book written out by name in prose — "1
  Maccabees 1:1", "Wisdom 3:1", "Sirach 2:4" — is now recognised and previewable too, not only its
  short code.
- **changed:** Citations in a note's own text and title now preview against the note's translation,
  not whatever you're currently reading — so a reference you typed into a note written against a
  Catholic version (e.g. "Daniel 14:1", or "1 Maccabees 1:1") stays previewable after you've
  switched to a 66-book version. New notes record the translation in play when they're created.
  Very long notes now have their references detected all the way through, not only in the first
  several thousand characters.
- **changed:** A full-text search whose words include a term the index can't match — a very short
  word, or a common stop-word like "the", "is", "of" — now says so, and an exact-phrase search
  still holds the exact wording rather than quietly matching on only some of the words.

## [1.11.0] - 2026-08-30
- **added:** Study Tools ▸ Dictionary — look up any word or name across all five Bible dictionaries
  (Easton's, Smith's, Hastings', Hitchcock's, Schaff's) at once, without having to find it already
  underlined in the chapter text. An exact headword returns that entry; anything else runs as a
  keyword search.
- **added:** Study Tools ▸ Commentaries — read verse-by-verse commentary for any chapter (or a
  single verse) from Matthew Henry, Gill and hundreds of other classic sources, picking the book,
  chapter, verse and source directly instead of going through Verse Tools one verse at a time.
- **changed:** The book picker no longer separates a version's deuterocanonical books (Tobit,
  Maccabees, Sirach, …) into an "Apocrypha / Deuterocanon" section. On a version whose canon
  includes them (CPDV, DRC, KJVA, …) they now sit under Old Testament in that version's own order,
  matching how that tradition reads them.
- **changed:** The "IQ Bible" wordmark now uses the brand's purple-"IQ" / ink-"Bible" treatment
  everywhere it appears as a name — the welcome dialog, the About page, and the nav footer — not
  only in the top bar.
- **changed:** On very wide screens the Notes launcher button now sits centred under the chapter
  cards on the right instead of drifting out to the far edge of the window.
- **fixed:** A Scripture reference at the very start of a piece of text — a note whose whole first
  line is a reference, a dictionary entry that opens with one — is now hover-previewable like any
  other. It was silently skipped before.
- **fixed:** A note's title (including the auto-title taken from a one-line note's text) now makes
  any reference in it hover-previewable, in both My Library and the notes drawer's list.
- **changed:** The copyright line in the left-nav footer is now the same small size as the version
  line beneath it.
- **added:** The app is now an installable PWA. Browsers offer "Install" / "Add to Home Screen";
  once installed it opens in its own window and the app shell loads offline (Bible text still needs
  a connection — the service worker never caches API responses, so rate limits and errors stay
  visible as before).
- **fixed:** Changing the translation now keeps your place — same book, chapter and verse — instead
  of jumping back to the start.
- **fixed:** Turning to another chapter on mobile (swipe or the Prev/Next buttons) now starts at
  the top of the chapter instead of keeping the previous scroll position.
- **fixed:** Bookmarking or highlighting several verses in one action now creates a single entry in
  My Library (e.g. "John 3:16-18" or "John 3:16, 18, 20") rather than one per verse. The reference
  on each Bookmark and Highlight card is now hover-previewable.
- **fixed:** The Remove button on Bookmark and Highlight cards in My Library is now styled to match
  the rest of the app.
- **fixed:** My Library ▸ Notes — the "Search notes" field and "New note" button no longer overflow
  the screen on narrow phones.

## [1.10.0] - 2026-08-29
- **changed:** Every "are you sure?" and "name this…" step — deleting a notebook, note, plan or
  your history; creating or renaming a notebook or plan — now uses an in-app dialog styled like
  the rest of the app instead of the browser's grey system prompt.
- **added:** Previous / Next chapter buttons at the foot of the reading column on mobile, each
  showing where it leads (e.g. "Exodus 1") — the visible counterpart to the swipe gesture now that
  the phone layout has no chapter arrows. (Desktop keeps its center-edge arrows.)
- **changed:** Mobile reading chrome now gets out of the way. Scrolling down tucks the topbar, the
  chapter-picker header, the bottom nav bar and the audio bar off-screen; scrolling back up — or
  tapping an empty part of the page — brings them back.
- **changed:** The mobile audio player is a single full-width bar above the nav bar. Its previous
  and next chapter arrows are gone (swipe the page left/right to turn the chapter, as before).
- **changed:** On mobile, an inward swipe from the right edge of the screen opens the Chapter Info
  cards; the grid button also moves back up into the chapter-picker row.
- **changed:** The mobile Notes button is now a slim pull-tab centred on the bottom nav bar — tap
  it or swipe up on it to open the drawer.

## [1.9.0] - 2026-08-29
- **added:** Notebooks — notes can be grouped into named notebooks. Assign one from the Notes
  drawer footer; filter by notebook (and by tag) in My Library and in the drawer's note switcher;
  Markdown export is grouped by notebook. Deleting a notebook keeps its notes (they become Unfiled).
- **changed:** One note model. Verse-tied notes and free-standing notes are now the same thing — a
  document that can carry verse *anchors*. Existing notes migrate automatically on first load: a
  verse-tied note's verse becomes an anchor, so it still shows the margin note icon and can be
  jumped to, but it's edited like any other note.
- **changed:** Verse Tools ▸ **Note** now asks where the verse should go — a new note, the note
  you're currently in, or one you search for and pick — then drops its reference and text in and
  opens the Notes drawer on it. The separate "Add to Note" button is gone (it's the "current note"
  choice now).
- **changed:** My Library's notes are edited in the Notes drawer now, same as everywhere else —
  "+ New Note" and a note card's Edit both open it. The separate plain inline composer (which had
  no Markdown) is gone.
- **changed:** My Library ▸ Notes is a two-pane workspace — a notebook rail on the left (notebooks
  with per-notebook counts, inline rename, delete, "New notebook", and a Tags list below) and a
  card grid on the right, each card showing the title, a short preview, its reference and notebook,
  and its tags. Search and sort now sit in the workspace itself, so the tab's header is just the
  description and the export buttons. Sort defaults to most-recently-edited.
- **added:** Move a note to another notebook without opening it — drag its card onto a notebook in
  the rail, or use the card's move button.
- **added:** The Notes drawer's read view shows the note's verse anchors as a chip row — each
  chip hover-previews and jumps to the verse, and its × detaches that reference (which also clears
  the verse's margin note icon). Deleting the note clears its icons too.
- **changed:** Editing a note from My Library opens the Notes drawer over the library view instead
  of dropping back to the reader behind it. The drawer's "Open in My Library" link is gone (the
  left nav already goes there).
- **fixed:** A note's one-line label (the bottom-right Notes button, the switcher list) no longer
  shows raw Markdown like "### …" — the marks are stripped for the label.
- **changed:** The margin note/bookmark marker now always trails its verse's text, rather than
  leading on most verses but trailing on the first (which has the drop cap).
- **fixed:** The Notes drawer now stands out from the page in dark mode — it was rendering at
  nearly the same near-black as everything behind it.
- **fixed:** Clicking a verse chip in the Notes drawer now returns to the reader (and closes the
  drawer) from wherever you were — it previously stayed in Study Tools / My Library, and left the
  chapter's prev/next buttons stranded because they were positioned against a hidden layout.

## [1.8.0] - 2026-08-29
- **added:** Notes now take a light Markdown subset — `**bold**`, `*italic*`, `` `code` ``,
  `#` headings, `-` / `1.` lists, `>` quotes, `---` rules and `[text](url)` links — rendered on the
  read view (in the drawer and on My Library's note cards) alongside the usual verse
  hover-previews. The drawer's edit mode gains a small formatting toolbar and Ctrl/Cmd+B / +I.
  Notes are still stored as plain text.
- **changed:** On desktop the Notes drawer is now a floating panel aligned to the reading column
  rather than a full-width dock spanning both nav rails — it sits just off the bottom edge with
  rounded corners, so it reads as a panel over the page instead of browser chrome.
- **changed:** The app version in the left-nav footer is now a small tracked-caps line under the
  copyright credit instead of a same-size second line.
- **fixed:** The app version (and copyright credit) now also show on mobile, in the footer of the
  "More" menu sheet — the left nav that carried them is hidden on narrow screens, so they had been
  invisible there.
- **fixed:** Clicking into a Notes-drawer note to edit it no longer occasionally jumps the text to
  the top — the textarea now inherits the read view's scroll position, and a click that lands in
  the top padding no longer drops the cursor at the very start.

## [1.7.1] - 2026-08-29
- **fixed:** On narrow screens, opening the Notes drawer's "All notes" list no longer left it
  crammed into a short strip above the current note — the list now takes over the whole sheet (and
  the sheet pops to full height) so the other notes are actually visible to pick from. Selecting a
  note brings the editor back.

## [1.7.0] - 2026-08-29
- **changed:** On narrow screens the Notes drawer's bottom sheet no longer blocks the page behind
  it — there's no scrim, so the passage still scrolls and verses can still be selected for **Add to
  Note** while the sheet is open. Dismiss it with the header's collapse chevron or by dragging the
  grip down and off.
- **added:** The Notes drawer's bottom sheet is now resizable — drag the grip to snap it between a
  peek and a full height; the choice is remembered. (The docked desktop panel was already
  drag-resizable.)

## [1.6.0] - 2026-08-29
- **added:** A Notes drawer — a dockable notes surface that opens from any screen with the `N` key
  or the Notes button at the bottom-right. It edits free-standing notes (the same ones "+ New Note"
  in My Library makes), autosaves as you type, and keeps one note "active" at a time. Verse Tools
  has a new **Add to Note** action that appends the selected verse — reference and text — to the
  active note, so a passage can be gathered into one note without leaving the page. The drawer has
  an inline note switcher (search + recent notes), resizes by dragging its top edge, and drops to a
  bottom sheet on narrow screens. It has two modes: a **read view** (the default — opening the
  drawer or picking a note shows the note rendered, with every Scripture reference in it
  hover-previewable) and an **edit** text box, toggled by the header's Edit / Done button, by
  Esc, or by clicking into the text. Pressing `N` opens straight into editing for a quick
  capture. Verse-tied notes are unchanged (still Verse Tools ▸ Note); My Library stays the place
  to browse, tag and export everything.
- **changed:** The per-chapter context cards in the right rail (People, Prophecies, Timeline) now
  size to their content instead of all being fixed squares — denser, less scrolling, and a Timeline
  or Prophecies card with two long entries is no longer clipped. The Places card keeps its square
  since it's filled by a map/photo thumbnail. The rail also scrolls properly now when its cards are
  taller than the window, and its last card stays clear of the Notes launcher / open drawer.
- **added:** The reading URL now carries the translation as a `?v=` query param (e.g.
  `/gen/1/1?v=eng_kjv`), so a copied or shared link reopens in the same version instead of the
  recipient's own default. It's kept on every navigation URL, added the moment you switch
  translation, and Back/Forward restores the version each history entry was viewed in. "Copy verse
  link" (Verse Tools) includes it too.
- **added:** Once a chapter is marked read, a compact line below the chapter header shows when —
  a light-green check plus "Read on Mon. 09/01/2026 at 6:42 pm"; clicking the check undoes it. It
  replaces the "Marked as read" confirmation that used to sit at the foot of the chapter, so the
  end-of-chapter prompt now only appears while a chapter is still unread. A new Settings toggle
  ("Show when I read a chapter, under the title") turns the line off, which restores the old
  end-of-chapter confirmation and its Undo.
- **fixed:** A reading-plan day is now auto-completed only once *every* chapter it schedules has
  been marked read. Marking a single chapter of a multi-chapter day (M'Cheyne days especially, but
  any General day covering more than one chapter) no longer checks the whole day off — the
  chapter-end prompt reports how many chapters are left to finish the day instead. Verse-only
  (Topic) plans are unaffected.
- **changed:** Reading Plans > ticking "Mark day complete" in the day drawer now also records that
  day's chapters as read in your Progress (General and M'Cheyne plans). Previously only reading each
  chapter through the reader's own prompt counted, so a plan tracked mainly from the calendar left
  the Bible-wide "chapters marked read" count and the reader's chapter-end prompt out of step with
  the calendar. Unchecking a day leaves those chapter marks in place — clear an individual chapter
  from the reader if you need to. Verse-only (Topic) plans are unaffected.
- **added:** Reading Plans > the plan overflow menu has a Share Plan option. It hands off the
  plan's JSON export as a file (the recipient re-creates it with Import Plan) plus a short text
  summary via the system share sheet where available, and copies the summary to the clipboard on
  browsers without the Web Share API.
- **added:** Study Tools > Word Study now covers every lexicon, not just Strong's. A tab row sits
  above the entry: Strong's first, then BDB (Hebrew) or LSJ and Abbott-Smith (Greek) for any that
  have an entry, plus a Crosswalk tab showing the raw Strong's-number → native-key mapping. The
  other sources are resolved through the API's lexicon crosswalk rather than a guessed key, so BDB
  (which has no Strong's-shaped key) now resolves too.
- **changed:** Study Tools tabs are reordered — Book Guide is now first, then Word Study, then
  Textual Variants. Study Tools opens on Book Guide by default.
- **added:** Study Tools > Book Guide now shows book-level commentary. Below the book overview,
  accordions and meta strip, a dropdown lists every commentary source that covers the book (Matthew
  Henry and Gill first, then the historic sources); picking one loads that source's book
  introduction (the API's "chapter 0" entry) with its Scripture citations made hover-previewable.
  A source with no book-level introduction just says so. This replaces the old passive "Commentary
  Coverage" chip list, which only named the sources.
- **changed:** Study Tools > Book Guide now always opens on the book you're currently reading. It
  previously kept whatever book you last looked at, even after you'd moved on in the reader.

## [1.5.0] - 2026-08-29
- **changed:** The People card's person detail view was reworked. It opens with a compact identity
  block — epithet, a one-sentence summary, and a small first/last appearance line — then the family
  relationships as one line each with the related names as inline chips, and the long Key Events
  list folded into a collapsed accordion just above the definitions. The dictionary definitions now
  sit near the top of the panel instead of below a long scroll, and are shown one source at a time
  via a tab row (Easton's, Smith's, Hastings', …) rather than stacked, with long entries clamped
  behind a "Read more". Only the visible definition tab is scanned for verse citations — the rest
  when you switch to them — instead of all of them up front.

## [1.4.0] - 2026-08-29
- **added:** Each menu page now carries a one-line description of what it's for. The tabbed pages
  (Explore, Study Tools, My Library) show a blurb that changes with the active tab; Reading Plans,
  Devotionals and My Progress each have their own under the title.
- **changed:** The copyright/version line in the left nav footer is a little larger and less faded,
  and `404.html`'s copy of it now matches `index.html` (they had drifted).
- **fixed:** The short version label in the reading header (e.g. "KJV") no longer picks up a stray
  "(" from a translation whose title ends in a parenthetical like "(wordproject.org)" — the
  parenthetical is dropped before the acronym is built, and only letter/digit-initial words feed it.
- **added:** Deep links can now point at a verse range, not just a single verse — `/gal/5/14-16`
  scrolls to verse 14 and rings the whole span (14 through 16), the same treatment a single-verse
  link already got. Verse Tools' "Copy Link" emits a range URL when the selection is contiguous
  (a disjoint selection still falls back to its first verse, since a path can't express a gap).
- **changed:** New-visitor defaults now match the app's intended out-of-the-box look: black &
  white illustrations, black & white book icons, reading font size 20 and interface font size 17.
  Schnorr illustrations and day mode were already the defaults. Anyone who has already set these
  preferences keeps their own choices — only a browser that never touched them is affected.
- **added:** The reading-plan builder now has a Version field. It starts on whatever translation
  you're reading, but you can pick another — the plan is then generated and saved against that
  version, and the "Specific Books" list only offers books in that version's canon (so a
  Catholic/Orthodox translation exposes Tobit, Maccabees and the rest; a Protestant one doesn't).
  The Specific Books input was also restyled to match the rest of the form.

## [1.3.0] - 2026-08-28
- **changed:** The app chrome now follows the IQ Bible brand guide. The wordmark uses the shared
  construction (sentence-case "IQ Bible", weight 900, tight tracking, "IQ" in brand purple and
  "Bible" in ink) instead of the old uppercase serif treatment; Inter replaces Cormorant Garamond
  and Josefin Sans across all UI — nav, labels, buttons, headings, modal titles, pickers — via a
  new `--font-ui` token; nav items and buttons drop the all-caps/wide-tracking treatment for
  sentence case (small eyebrow labels stay uppercase, as the brand allows); and corner radii are
  consolidated onto a brand-aligned scale (`--r-pill`/`--r-card`/`--r-control`/`--r-sm`) — chips
  and tabs become true pills. The Scripture reading column and verse-quote text stay a reading
  serif (`--font-reading`, Crimson Pro) on purpose — a documented, intentional exception rather
  than drift.
- **added:** Official hosted instance at `app.iqbible.com` — the app now runs there with no API
  key required. A small Cloudflare Worker (`cloudflare/`) sits in front of the authenticated API
  endpoints and injects a shared key server-side; the key never reaches the browser. A visitor who
  still enters their own key in Settings is passed straight through to their own quota. Forks and
  self-hosted copies are unchanged — they call the API directly with each visitor's own key, which
  is still the only correct model for a deployment you don't control the API billing for.
- **changed:** The app is now served from the domain root on every deployment, so the per-branch
  `/iqbible-app` GitHub Pages project-site prefix is gone. `BASE_PATH` is always `""`; `index.html`/
  `404.html` use a plain `<base href="/">` instead of the old runtime hostname check; `main` and
  `develop` no longer diverge on those lines.
- **changed:** Share Tools (`GET /image/verse`, `/embed/verse` — both public/unauthenticated) now
  always point straight at `api.iqbible.com` via the new `API_PUBLIC_BASE`, so copied image links
  and embed codes don't depend on the hosted instance's proxy path.
- **changed:** About and Help copy updated for the hosted instance (an API key is only needed when
  self-hosting); repository moved to `github.com/IQ-Bible/iqbible-app`.

## [1.2.7] - 2026-08-24
- **fixed:** Commentary and dictionary entries could silently lose their verse-citation hover links on long-form text (e.g. Matthew Henry's characteristically long entries) because `linkifyCitations` re-sent the whole entry text through a citation-parsing call that has an input-length limit. Commentary and dictionary lookups already come back from the API with their citations pre-parsed, so those two call sites now consume that directly instead of re-parsing — fixes the long-entry case and drops a redundant API call on every dictionary/commentary render.

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
