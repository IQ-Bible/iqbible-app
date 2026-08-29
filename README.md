# IQ Bible

A free, open-source Bible reader — and a worked example of building a real app on the [IQ Bible API](https://api.iqbible.com). Version and book/chapter pickers, full-text search, inline illustrations, inline story titles, audio narration, and shareable deep links, all running as a plain static site with **zero backend of its own**.

Every feature here comes from a real API call. There's no server, no build step, and no framework — just `index.html`, `css/styles.css`, and a handful of plain `js/*.js` files loaded in order. If you're looking for a minimal, honest example of what it takes to build on the IQ Bible API, this is it.

## Try it

The hosted instance runs at **[app.iqbible.com](https://app.iqbible.com)** — nothing to set up, just start reading. (It's backed by a shared API key so anonymous visitors don't have to get their own; see ["Deploying for other people"](#if-youre-deploying-for-other-people-to-use-not-just-yourself) for how that works and why your own deployment shouldn't copy it blindly.)

## Running it locally

No build step, no dependencies. Any of these work:

- Double-click `index.html` and open it directly in your browser.
- Or serve it locally with any static file server, e.g. `npx serve .` or `python -m http.server`.

Run locally (or self-hosted anywhere that isn't `app.iqbible.com`) and you'll see a banner asking for an API key the first time you open it — see below.

Deep links (`/gen/1`, `/gen/1/1`, etc.) are resolved client-side by `js/router.js`, so they only work on a fresh page load if the server falls back to `index.html` for unmatched paths — the same thing `404.html`/`_redirects` do in production (see "Deploying your own copy" below). Plain `npx serve .` and VS Code's Live Server extension don't do this, so loading a deep link directly (rather than navigating to it from within the app) 404s. Use `npx serve . -s` (the `-s`/`--single` flag enables that fallback) if you need to test deep links locally.

## Get an API key

The hosted instance at [app.iqbible.com](https://app.iqbible.com) doesn't need one. Everywhere else — running it locally, or self-hosting your own copy — needs its own IQ Bible API key. Get one free at [developer.iqbible.com](https://developer.iqbible.com), then paste it into the app's Settings (the profile icon in the top bar, or Settings in the left-hand menu). It's saved only in your browser's local storage; it's never written anywhere else and never leaves your browser except in requests to the API itself.

## Deploying your own copy

This is a plain static site, so any static host works. Two are pre-configured:

- **GitHub Pages**: enable Pages on your fork (Settings → Pages → deploy from a branch). `404.html` (a copy of `index.html`) makes deep links like `/gen/1/1` work on a fresh page load, which GitHub Pages doesn't otherwise support for a single-page app. The app expects to be served from the domain root — set a custom domain (Pages puts its name in the `CNAME` file and redirects the `username.github.io/reponame` path to it), or if you must serve it from a `/reponame` subpath, set `BASE_PATH` in `js/config.js` and add `<base href="/reponame/">` to `index.html`/`404.html`.
- **Cloudflare Pages**: point it at this repo — `_redirects` already routes every path to `index.html`. Serve from the domain root.

The hosted instance also runs a Cloudflare Worker (`cloudflare/`) in front of the API — see the next section.

### If you're deploying for other people to use, not just yourself

**Do not put your own API key in this app's source code.** This app is entirely client-side — anything in its JavaScript is visible to anyone who opens their browser's dev tools or views the page source. A GitHub Actions secret written into the deployed files is no different: it's downloaded verbatim by every visitor. If you deploy a public copy with your key reachable from the browser, every visitor can read it and use it as their own.

The default behavior — each visitor enters their own key via Settings — is the correct one for most public deployments, and it's why the app works this way out of the box.

If you want anonymous end users to skip that step (a consumer app rather than a developer tool), the key has to live somewhere the browser can't read it: a small server-side proxy that holds the credential and adds it to each request. The hosted instance at `app.iqbible.com` does exactly this with a Cloudflare Worker — see [`cloudflare/`](cloudflare/) for the whole thing (it's about 40 lines). That's a real, separate piece of infrastructure with its own trade-offs (you're now paying for everyone's usage, and a shared key behind a public proxy can still be abused), which is why the app itself still ships zero-backend and key-per-visitor by default.

## What it demonstrates

- Version/book/chapter navigation, including a search-first translation picker across 1,000+ languages
- Full chapter reading with paragraph markers, a drop cap, and inline Schnorr illustrations
- Inline story titles (e.g. "The Flood") resolved from free-text references
- Inline audio narration playback where available, with a narrator picker when a version has more than one recorded
- Full-text search with pagination
- Shareable deep links (`/gen/1/1`) with browser back/forward support
- Per-chapter context: places (with maps), a raw people list with per-person detail lookups,
  prophecy fulfillment pairs, and a curated biblical timeline
- Verse-level study tools: highlights/bookmarks/notes, original-language word data, cross-references,
  commentary, parallel-translation comparison, and topics
- A dockable **Notes drawer** openable from anywhere (the `N` key), with quick-capture of a verse
  from Verse Tools into the active note; notes take a light Markdown subset (bold, italic, headings,
  lists, quotes) rendered on the read view alongside the usual verse hover-previews
- **Explore**: a Gospel-harmony parallel-column viewer, a topic browser, a standalone Bible atlas, a
  traversable genealogy explorer, and a collections browser (parables, miracles, prayers, names of
  God, titles of Jesus, weights & measures)
- **Study Tools**: a multi-lexicon word study (Strong's, BDB, LSJ, Abbott-Smith, with an
  every-occurrence lookup across Scripture), an inline-SVG cross-reference graph, a per-book guide
  with book-level commentary, and NT textual variants
- **Reading Plans**: build a whole-Bible, testament, book-scoped or topical plan, or the M'Cheyne
  one-year calendar, generated by the API and tracked day by day on a month grid; days auto-complete
  as you mark their chapters read, and plans export/import/share as JSON or CSV
- **Devotionals**: Spurgeon's "Morning and Evening," with previous/next-day and jump-to-date browsing
- **Share Tools**: a live verse-image and embeddable-widget generator, using the API's public,
  unauthenticated embed endpoints
- A reading-dashboard popover on the profile icon — streak, counts, and a continue-reading shortcut,
  built entirely from data already tracked locally
- **My Progress**: a full screen for that same local reading data — a streak calendar, confirmed
  chapter/devotional read counts, active-plan completion, and a recent-activity feed
- **Take a Tour**: a guided walkthrough that spotlights the app's main features in place, offered once
  on first visit and re-launchable any time from the new **Help** page (getting-started steps, a
  feature guide, and an FAQ)

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, ship it, build a business on it. If you do something with it we'd love to hear about it, but you don't owe us anything beyond keeping the license notice.

This app is a demonstration of the [IQ Bible API](https://api.iqbible.com), a commercial Bible-content API — Bible text, audio, original-language data, lexicons, cross-references, commentary, and more across 1,000+ translations. The app is free and open source; the API it talks to is a separate product with its own pricing.
