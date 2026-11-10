/* ═══════════════════════════════════════════════════════════════════════
   ANNOUNCEMENTS — a short, dismissible "what's new" note for a feature worth
   telling people about, plus a "What's new" list in Help. The content is a
   plain static file, announcements.json at the repo root (newest first), not
   an API call: forks inherit it and can blank it to "[]". Each entry:
     id        stable string, never reused (it is what "seen" is keyed on)
     date      ISO date (YYYY-MM-DD)
     title     short heading
     body      one or two sentences, plain text — rendered as text, never HTML
     cta       optional { label, route }: an https link, a site path like
               "/scroll/", or a "#hash" route the app already understands
     hostedOnly  optional true: show only on app.iqbible.com (IS_HOSTED_INSTANCE)
     expires   optional ISO date: no banner after it (still listed in Help)

   Seen ids live in localStorage "iqb_seen_announcements". A brand-new visitor
   (no seen-list yet and no iqb_tour_seen) gets every current entry marked seen
   and sees nothing — they get the welcome tour instead; a returning visitor
   who has never had this feature sees the newest entry once.

   One banner at a time, never stacked with the other nudges: it only shows on
   a load where the API-key gate, the tour welcome and the backup reminder are
   all absent (it shows on a later load instead), and the backup banner hides
   it if that appears mid-session. Not on /scroll/, which stays isolated. */
const ANN_SEEN_KEY = "iqb_seen_announcements";
let annLoad = null;          // Promise of the entries that apply to this instance, newest first
let annIsNewVisitor = false;

function annSeenIds() {
  try { const a = JSON.parse(localStorage.getItem(ANN_SEEN_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function annMarkSeen(ids) {
  try { localStorage.setItem(ANN_SEEN_KEY, JSON.stringify([...new Set([...annSeenIds(), ...ids])])); } catch (e) { }
}
function annExpired(e) {
  const t = Date.parse(e.expires);
  return !isNaN(t) && Date.now() > t + 24 * 60 * 60 * 1000; // an expiry date runs through the end of that day
}

// Called first thing in init(), before anything can set iqb_tour_seen — the
// new-visitor test has to see the storage as the visit began.
function startAnnouncements() {
  annIsNewVisitor = localStorage.getItem(ANN_SEEN_KEY) === null && localStorage.getItem(TOUR_SEEN_KEY) === null;
  // Our own static file, not an API call: if it can't be had, say nothing.
  annLoad = fetch(`announcements.json?v=${encodeURIComponent(APP_VERSION)}`)
    .then(r => r.ok ? r.json() : [])
    .then(list => (Array.isArray(list) ? list : []).filter(e => e && typeof e.id === "string" && e.title && (!e.hostedOnly || IS_HOSTED_INSTANCE)))
    .catch(() => []);
  annLoad.then(renderWhatsNew);
}

// Last step of init(): decide whether this load gets a banner.
async function maybeShowAnnouncement() {
  if (!annLoad) return;
  const list = await annLoad;
  if (!list.length) return;
  if (annIsNewVisitor) { annMarkSeen(list.map(e => e.id)); return; }
  const showing = id => { const el = document.getElementById(id); return !!el && el.classList.contains("show"); };
  if (showing("keyBanner") || showing("tourWelcomeScrim") || showing("dataBackupBanner")) return;
  const seen = new Set(annSeenIds());
  const e = list.find(x => !seen.has(x.id) && !annExpired(x));
  if (e) showAnnouncement(e);
}

function annCtaHtml(cta) {
  if (!cta || typeof cta.label !== "string" || typeof cta.route !== "string") return "";
  const r = cta.route;
  // A bare "#hash" can't be an href here: <base href="/"> would turn it into a
  // jump to the site root, so hash routes go through a button that sets location.hash.
  if (r.startsWith("#")) return `<button type="button" class="ann-cta" data-ann-hash="${escHtml(r.slice(1)).replace(/"/g, "&quot;")}">${escHtml(cta.label)}</button>`;
  if (/^https?:\/\//i.test(r)) return `<a class="ann-cta" href="${escHtml(r).replace(/"/g, "&quot;")}" target="_blank" rel="noopener">${escHtml(cta.label)}</a>`;
  if (r.startsWith("/")) return `<a class="ann-cta" href="${escHtml(r).replace(/"/g, "&quot;")}">${escHtml(cta.label)}</a>`;
  return "";
}

function showAnnouncement(e) {
  const host = document.getElementById("announcementBanner");
  if (!host) return;
  host.innerHTML = `<div class="ann-card" data-ann-id="${escHtml(e.id).replace(/"/g, "&quot;")}">
    <div class="ann-text"><strong class="ann-title"></strong><p class="ann-body"></p>${annCtaHtml(e.cta)}</div>
    <button type="button" class="ann-close" aria-label="Dismiss announcement">&times;</button></div>`;
  // Content as text, not markup, so a title/body can never inject HTML.
  host.querySelector(".ann-title").textContent = e.title;
  host.querySelector(".ann-body").textContent = e.body || "";
  host.querySelector(".ann-close").addEventListener("click", () => { annMarkSeen([e.id]); hideAnnouncement(); });
  const cta = host.querySelector(".ann-cta");
  if (cta) cta.addEventListener("click", () => {
    annMarkSeen([e.id]);
    hideAnnouncement();
    if (cta.dataset.annHash !== undefined) location.hash = cta.dataset.annHash;
  });
}
function hideAnnouncement() {
  const host = document.getElementById("announcementBanner");
  if (host) host.innerHTML = "";
}

// Help's "What's new": every entry, newest first, so a dismissed one can be found again.
function renderWhatsNew(list) {
  const sec = document.getElementById("helpWhatsNew"), out = document.getElementById("helpWhatsNewList");
  if (!sec || !out) return;
  out.innerHTML = "";
  list.forEach(e => {
    const item = document.createElement("div");
    item.className = "help-faq-item ann-help-item";
    const d = new Date(e.date);
    const when = isNaN(d) ? "" : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
    item.innerHTML = `<div class="help-faq-q"><span class="ann-help-title"></span>${when ? ` <time class="ann-help-date" datetime="${escHtml(String(e.date)).replace(/"/g, "&quot;")}"></time>` : ""}</div><div class="help-faq-a"><span class="ann-help-body"></span>${annCtaHtml(e.cta) ? " " + annCtaHtml(e.cta) : ""}</div>`;
    item.querySelector(".ann-help-title").textContent = e.title;
    item.querySelector(".ann-help-body").textContent = e.body || "";
    const t = item.querySelector("time");
    if (t) t.textContent = when;
    const cta = item.querySelector(".ann-cta");
    if (cta && cta.dataset.annHash !== undefined) cta.addEventListener("click", () => { location.hash = cta.dataset.annHash; });
    out.appendChild(item);
  });
  sec.hidden = !list.length;
}
