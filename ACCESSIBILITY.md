# Accessibility — WCAG 2.2 Level AA

Target: **WCAG 2.2 Level AA** (the ADA / Section 508 / EAA de-facto bar; AAA is not a realistic
site-wide goal for a text-heavy reading app). This file tracks the audit and the remediation plan
for issue #250. Update it as items land; move finished phases to a "Done" list.

Status: **2026-09-05 — Phases 1–5 done. axe-core 4.10 clean across every view (headless
Chrome), keyboard walkthrough passed. Remaining: a manual screen-reader pass on real AT.**

## Remediation log (2026-09-05)

**Done — Phase 1 (keyboard):** skip link → `#readMain`; global `:focus-visible` ring (+ inputs
re-get an outline); verse numbers are real `<button>` (`aria-label`, `aria-pressed`) so Verse
Tools is fully keyboard-operable; dictionary words are `<button>`; citations `tabindex=0
role=note` with the ref+verse text in `aria-label`, preview on focus, Esc-dismiss, hoverable
tooltip (200 ms grace); a global Enter/Space handler + MutationObserver make every `<div onclick>`
row/card/picker and the delegated illustration/map targets operable and button-roled; audio
scrubber replaced with a native `<input type=range>` (`aria-valuetext` = timecode).

**Done — Phase 2 (dialogs):** `openModal`/`closeModal` now set `role=dialog` + `aria-modal` +
`aria-labelledby` (from the modal's heading), push/pop a focus stack (focus in on open, back to
trigger on close), trap Tab within the top modal, and `inert` the page regions + lower modals.
`#cardsSheetScrim` resolves its content via `data-dialog-content="rightRail"`. Key gate: `inert`
+ focus-in + a real `<h2>` heading + `role=dialog`. Mainviews move focus to their heading on
open, back to `#readMain` on close. Sheet triggers get `aria-controls`/`aria-expanded`/
`aria-haspopup` and focus management (`markSheet`). API-error modal → `role=alertdialog`.

**Done — Phase 3 (visibility & semantics):** `#toast` → `role=status aria-live=polite`;
`prefers-reduced-motion` block (CSS) + JS short-circuits (swipe-pager commit); every `×` close
button gets `aria-label="Close"`; reading view has an `<h1>` kept in sync (+ `document.title`),
story headings → `<h2>`, overlay titles → `<h2 class=overlay-title>`; `#readingText` gets a
BCP-47 `lang` (ISO 639-3 → 639-1 map in `js/catalog.js`, `bcp47()`); `.filter-chip`/`.lib-tab`/
`.dicttab` active state adds a weight cue and is now distinct from `:hover` (1.4.1); `--muted2`
darkened (#a09bb3 → #6a6382 light, #736a90 → #9188ad dark) — all text tokens now ≥ 4.5:1 in both
themes (verified).

**Done — Phase 4 (WCAG 2.2 specifics):** target-size bumps — highlight swatches 13→22 px + 8 px
gap, tag-remove × to a 24 px hit area, `.msearch .mclear` 18→24 px; `@media (forced-colors:
active)` block (focus ring, modal/scrim separation, chip borders); tour gets `inert` +
focus-trap in `#tourTooltip` + focus restore + per-step `aria-live` announce +
`role=dialog`. `#playBtn` given an `aria-label` (toggles Play/Pause); decorative SVGs
`aria-hidden`.

**axe-core (wcag2a / wcag2aa / wcag21a / wcag21aa / wcag22aa) — full sweep, all views clean.**

Iterative runs surfaced and fixed:
- `button-name` — `#playBtn` had no name → `aria-label` (toggles Play/Pause).
- `color-contrast` — nav footer (`opacity:.85` on `--muted`), `.rc-dim` (`opacity:.6`),
  `.tl-context` (`opacity:.72`), `.devo-daynav` (`opacity:.7`) → opacity washes removed, colours
  set explicitly.
- `valid-lang` — `#readingText` `lang="eng"` → `bcp47()` ISO 639-3→639-1 map (`js/catalog.js`).
- `aria-tooltip-name` — a `role="tooltip"` I'd added to `#dictTooltip` with no name → removed.
- `target-size` (320 px) — `#btnPickChapter` / `#btnChapterCtx` under 24 px → bumped.
- `nested-interactive` (200 nodes) — the a11yify pass had made `<div class="vrow" onclick>`
  version rows `role="button"` while they contained a favourite-star `<button>`. Restructured:
  `.vrow` is now a plain container with a `.vrow-main` button + a sibling `.fav-star` button.
  Same fix applied to search history chips (`.history-chip-main` + `.history-star`) and reading-
  plan calendar cells (`.cal-daycell` is now a `<button>`; inline refs are plain text +
  hover-preview, the day drawer carries them as real controls). a11yify now refuses to
  button-role any wrapper that contains an interactive descendant.
- `select-name` / `label` — unlabelled `<select>`s (commentary source/book/chapter/verse, book
  guide, variants, share, verse-tools) and `#devotionalDateInput` / search filter inputs →
  `aria-label` / `<label for>`.

**Views verified at zero violations:** reading (1400 + 320 px), version picker, book picker,
search + history, reading-plans list, study (commentaries / word / variants), timeline modal,
devotionals, verse-tools cross-refs, settings, explore (collections / genealogy / harmony),
My Library (bookmarks / history), My Progress, About, Help, Share Tools, Notes drawer, People
modal. No horizontal overflow at 320 px. No console errors across the flow.

Also confirmed functionally by keyboard: verse-number → Verse Tools, dict-term focus preview +
Esc, version-row select, modal focus trap + restore + background `inert`, audio arrow-key seek.

**Still needs a human:** a real assistive-technology pass (NVDA / JAWS / VoiceOver / TalkBack) —
axe + keyboard automation is done, AT testing is not something this can substitute for.

## Later changes

**2026-09-06 — translation picker language selector.** The version picker's language filter went
from a scrolling `#langRow` chip strip to one always-visible `<button class="langsel">` that opens
a language sub-screen (`#versionLangList`), same back-arrow two-screen pattern as the book/chapter
navigator. New interactive elements: the `.langsel` button (text-labelled, global focus ring, ~39 px
tall), the reused `.closebtn.npk-back` back button (`aria-label`), `.langlist-row` buttons
(text-labelled, `aria-current="true"` on the active language, ~42 px tall), and a `.mclear` (×) on
both search inputs (existing 24 px pattern, `aria-label`). Decorative SVGs (`.langsel-globe`,
`.langsel-chev`, `.langlist-tick`) are `aria-hidden`. axe-core 4.10 (wcag2a/2aa, wcag21a/21aa,
wcag22aa) clean on `#versionPickerScrim` in both screens, light + dark, desktop + 390 px. Keyboard:
selector → sub-screen → filter → pick → back, all operable; modal focus trap unaffected.

## Accessibility statement page

`#accessibilityView` (in `index.html` / `404.html`, wired through `js/main.js` +
`js/router.js`, hash `#accessibility`). Linked from the left-nav footer, the About page, and
Help's keyboard/screen-reader FAQ. Static content — no API calls. axe-clean in light, dark, and
at 320 px.

Keep honest as testing progresses:
- **"Last reviewed"** date — bump it whenever the app is re-tested.
- The **"substantially conformant"** wording and the screen-reader caveat in *Known limitations*
  should only be softened once a real AT pass (or an independent audit) is done.
- If nav features change, re-check the "Adjusting the app to suit you" shortcuts and the map
  caveat.

## Known remaining / follow-up

- Per-view `<h1>` for the dynamically-rendered overlays (Search, Library, Explore, Study, Plans,
  Progress) — they currently lead with an `<h2>`; not an SC failure, but nicer for heading nav.
- Full `role=tablist`/`tab`/`tabpanel` semantics on the tab strips (they work as buttons + the
  1.4.1 weight cue is in; ARIA tab pattern is the polish on top).
- `bcp47()` map covers ~90 languages; rarer catalog languages fall back to the 639-3 code (valid
  BCP-47, but axe's `valid-lang` may still flag a handful). Extend the map as needed.
- Screen-reader pass on real AT (NVDA/JAWS/VoiceOver/TalkBack) — automated + keyboard done, human
  AT testing is Phase 5.
- `dropcap` splits the first letter into its own span — verify SR reads the first word whole.

<hr>

Original audit follows.

---

## Audit findings

Severity key: **A** = fails a Level A success criterion (blocks a group of users outright) ·
**AA** = fails a Level AA criterion · **best-practice** = not a 2.2 AA requirement but worth doing.

### A — keyboard operability (the app is substantially mouse-only today)

| # | Area | SC | Detail |
|---|---|---|---|
| A1 | **Verse selection / Verse Tools** | 2.1.1 | `.verse-span` is a `<span>` with a delegated `click` handler and no `tabindex`/`role`/key handler (`js/reader.js` ~line 171, 2228). Nothing that hangs off selecting a verse — highlight, bookmark, note, copy, share, cross-refs, commentary, compare, original-language — is reachable without a mouse. Single biggest gap. |
| A2 | **Citation previews + jump** | 2.1.1, 1.4.13 | `.citelink` / `[data-cite-id]` are `<span>`s; the preview fires from a document `mouseover` listener only (`js/reader.js` ~1827), and the click-to-jump is mouse-only. Applies to every prose surface: commentary, dictionary, character bios, Notes, timeline refs. |
| A3 | **Dictionary terms** | 2.1.1 | `.dict-term` spans (`js/reader.js` ~1775) — same pattern: hover tooltip + click-to-open-modal, no keyboard path. |
| A4 | **Audio scrub bar** | 2.1.1, 4.1.2 | `#scrubTrack` is a `<div onclick="seekAudio(event)">` with a child fill div — not focusable, no `slider` role, no `aria-valuenow`. Play/pause are real `<button>`s and are fine. |
| A5 | **Image / map lightbox** | 2.1.1 | Inline illustration `<img>` and `.place-map-wrap` open the lightbox via delegated `click` (`js/main.js` ~257) with no focusable trigger. |
| A6 | **No skip link** | 2.4.1 | The left nav / topbar precede the reading column on every view with no "skip to reading" bypass. |

### AA

| # | Area | SC | Detail |
|---|---|---|---|
| AA1 | **No focus-visible design** | 2.4.7, 2.4.13* | No global `:focus-visible` style. Buttons/links keep the UA default ring (inconsistent, low-contrast on the purple chrome); inputs set `outline:none` and signal focus only with a 1px `border-color` swap. (*2.4.13 Focus Appearance is AAA in 2.2 — noted for quality, not required.) |
| AA2 | **Focus can be obscured** | 2.4.11 | Sticky `#topbar` and fixed `#mobileFooterNav` can cover a control that receives focus while tab-scrolling. Needs `scroll-padding-top/bottom` on the scrollport + testing. |
| AA3 | **Modals have no dialog semantics or focus management** | 4.1.2, 2.4.3, 1.3.1 | `openModal`/`closeModal` (`js/api.js` 52–53) just toggle a class. ~25 `.modalscrim` modals: no `role="dialog"`, no `aria-modal`, no `aria-labelledby`, focus is not moved in, not trapped, not restored on close, and the background is not `inert`. Only `#uiDialogScrim` has the ARIA. Same gaps on the `.mainview` overlays and the mobile sheets (`#moreMenuSheet`, `#discoverHub`, `#profilePanel`, `#rightRail` sheet). Escape-to-close is wired globally (`js/main.js` 306) — that part is fine. |
| AA4 | **Status messages not announced** | 4.1.3 | `#toast` has no `role="status"` / `aria-live`. The API-error modal appears without moving focus or `role="alertdialog"`. |
| AA5 | **Colour contrast** | 1.4.3 | `--muted2` ≈ 2.5:1 on `--bg` (light) — fails for text; used for placeholder-style and secondary labels. `--muted` ≈ 5.2:1 (passes). Dark-theme `--muted2` ≈ 3:1 (fails for normal text). Every token pairing needs a checker pass in **both** themes, plus placeholder text and `.hint`. |
| AA6 | **Language of parts** | 3.1.1, 3.1.2 | `<html lang="en">` never updates; `#readingText` gets `dir` (good) but never `lang`. Hebrew/Greek in the original-language tool has neither `lang` nor `dir`. Matters a lot for a reader serving 1,000+ languages. |
| AA7 | **Heading structure** | 1.3.1, 2.4.6 | No `<h1>` on the Read view; story titles render as `<h3>` with no `<h2>`/`<h1>` above them; overlay titles are `<span class="overlay-title">`, not headings. |
| AA8 | **Close buttons** | 4.1.2, 1.1.1 | Bare `&times;` glyph; most `.closebtn` / `.overlay-close` have only `title` (some have `aria-label`, most don't). Need a consistent `aria-label="Close"` with the glyph `aria-hidden`. |
| AA9 | **Selected state is colour-only** | 1.4.1 | `.filter-chip`, sort chips, `.lib-tab`, `.navsubitem` show the active choice with an `.active` class that changes colour only — no `aria-pressed` / `aria-selected` / non-colour cue. |
| AA10 | **Sheet triggers** | 4.1.2 | `#mfnMoreBtn`, `#mfnDiscoverBtn`, `#profileTrigger`, `#btnCardsSheet` toggle panels with no `aria-expanded` / `aria-controls` and no focus move into the opened sheet. (The nav-rail caret toggles *do* have `aria-expanded` — good.) |
| AA11 | **Target size** | 2.5.8 | New in 2.2. Audit small controls: `.nd-tag button` (15×15 — fails), tour dots, nav caret toggles, `.vnum`, highlight swatches. Minimum 24×24 CSS px (or adequate spacing). |
| AA12 | **Tour focus** | 2.4.3, 2.1.2 | `js/tour.js` has no keyboard handling: focus isn't moved into `#tourTooltip` on step change, isn't trapped, and isn't restored on exit; `#tourClickBlock` can strand focus on an element behind it. Back/Skip/Next are real buttons (reachable once found). Esc ends the tour (fine). |
| AA13 | **Key-gate focus** | 2.4.3 | `#keyBanner` is an intentional blocking gate with a forward path (acceptable), but focus should move into it and stay trapped until a key is saved / on the hosted instance it never shows. |

### best-practice (not required for AA, recommended)

- `prefers-reduced-motion`: nothing honours it. Gate `scroll-behavior:smooth`, the mobile swipe
  pager's page-drag animation, `fadeUp` on result cards, sheet slide transitions, `ndPulse`,
  `verseJumpFlash`. (2.3.3 Animation from Interactions is AAA; `verseJumpFlash` is ~1.8 Hz and a
  low-amplitude background-alpha change, so 2.3.1 is not implicated — but confirm.)
- `forced-colors` / Windows High Contrast spot-check (SVG `currentColor` icons, focus ring, the
  `-webkit-text-security` key field).
- `.mainview` overlays could move focus to their (new) heading on open for parity with the modal
  fix.
- ARIA `tablist`/`tab`/`tabpanel` semantics for the tab rows (they work as buttons today; this is
  polish on top of AA9's `aria-selected`).

## Already compliant / not a gap

- **1.2.1 (audio-only alternative):** the full chapter text is co-present on the page, so the
  narration audio already has a complete text alternative — nothing to add.
- **1.4.4 / 1.4.10:** `<meta viewport>` has no `maximum-scale`/`user-scalable=no`; layout is
  responsive. Still needs a 400% zoom / 320px reflow spot-check for horizontal scroll.
- **2.1.2 (no keyboard trap):** global Escape handler closes every modal/overlay/sheet.
- **Forms:** every `<input>` / `<select>` / checkbox / range / date control has an associated
  `<label for>`.
- **3.3.x:** minimal form surface (API key field only); errors are toasted (see AA4 for the
  announce gap).
- Collapsed nav submenus are set `inert` so they stay out of the tab order.
- `<html lang="en">`, charset, viewport meta all present and correct for the default case.

## GOLDEN-RULE intersection

Some accessibility metadata can only be as good as what the API returns:

- **Illustration `alt` text** — if `GET` for an illustration carries no description/caption, we
  render a reasonable generic `alt` (artist + subject if known) but must not fabricate a detailed
  description. Log the quality gap in `NOTES.md`; don't build a client-side image-captioner.
- **`lang` for a translation** — needs a BCP-47 tag per version. If the catalog doesn't expose
  one cleanly, derive from the version id's language prefix and note the imprecision; don't ship a
  language-detection library.

---

## Remediation plan

### Phase 0 — baseline (no code)
Run axe DevTools + Lighthouse on each view; full keyboard-only walkthrough; NVDA/Chrome +
VoiceOver/Safari smoke test. Record the starting state here.

### Phase 1 — keyboard parity (clears A1–A6)
- Skip link as the first focusable element ("Skip to reading" → `#readCol`).
- `.verse-span`: make the `.vnum` a real `<button>` (one tab stop per verse) or the span
  `tabindex="0" role="button"` with a roving tabindex across the chapter; Enter/Space → `selectVerse`.
- `.citelink` / `[data-cite-id]` / `.dict-term`: render as `<button>` (or `tabindex=0` + role);
  add `focusin`/`focusout` alongside `mouseover` in the tooltip listener; Enter activates the
  jump / opens the modal. Make the tooltip Esc-dismissible and hoverable (1.4.13).
- Audio: replace `#scrubTrack` with a styled `<input type="range">` (`aria-label`, `aria-valuetext`
  = timecode), or `role="slider"` + arrow-key handling.
- Wrap inline-illustration and place-map thumbnails in `<button>`.

### Phase 2 — dialogs (systematic, one shared upgrade)
Extend `openModal`/`closeModal` into a real dialog manager:
- add `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (give each modal's title an id;
  promote `.overlay-title` spans to `<h2>`);
- store `document.activeElement` on open, move focus into the dialog, trap Tab, restore focus on
  close;
- `inert` the rest of `#app` while any modal / overlay / sheet is open.
Apply to all `.modalscrim`, the `.mainview` overlays, and the mobile sheets. `#uiDialogScrim` is
the reference. Fold in AA13 (key-gate) and AA12 (tour) with the same helpers.

### Phase 3 — visibility & semantics
- Global `:focus-visible` treatment (2px `--brand` outline + offset; a light halo variant for
  dark surfaces); drop bare `outline:none` or pair it with a real focus style; `scroll-padding` so
  the sticky bars don't obscure it (AA1, AA2).
- `#toast` → `role="status" aria-live="polite"`; API-error modal → `role="alertdialog"` + focus
  (AA4).
- Heading pass: one `<h1>` per view (visually-hidden where the design has no visible title), fix
  the story-heading level, overlay/modal titles → headings (AA7).
- `lang` on `#readingText` (version → BCP-47) and `<html>`; `lang` + `dir` on Hebrew/Greek spans
  (AA6).
- Consistent `aria-label="Close"`, glyph `aria-hidden` (AA8).
- `aria-pressed` on filter/sort chips; `aria-selected` (or full `tablist`) on tab rows (AA9).
- `aria-expanded` / `aria-controls` + focus move on the sheet triggers (AA10).

### Phase 4 — 2.2 specifics & polish
- Target-size sweep → bump anything < 24×24 (AA11).
- `prefers-reduced-motion` gating (best-practice list).
- Tour focus management (AA12).
- 400% zoom / 320px reflow pass; `forced-colors` spot-check.
- Contrast: finalise token values that fail (AA5) — likely darken `--muted2` in both themes.

### Phase 5 — verification & docs
Re-test matrix: keyboard-only · NVDA/Chrome · VoiceOver/Safari · iOS VoiceOver · Android TalkBack,
per view. Update the Help page's FAQ with an accessibility note, add a line to `README.md`, log
residual API-driven gaps in `NOTES.md`. Add a CHANGELOG `[Unreleased]` entry when the
user-visible parts land.
