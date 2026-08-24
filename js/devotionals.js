/* ═══════════════════════════════════════════════════════════════════════
   DEVOTIONALS — Spurgeon's "Morning and Evening" (GET /devotionals/today,
   GET /devotionals/{month}/{day}). Calendar-date only, no year concept (the
   source genuinely repeats yearly — correct fidelity, not a gap) and, per
   NOTES.md, no archive/list/range endpoint at all, so this deliberately
   stays day-at-a-time: today by default, prev/next day, or jump to any
   date (year is read off the date picker and then ignored). */
let devotionalDate = new Date();
let devotionalToken = 0;
let todayDevotionalCache = null;
// Which of Spurgeon's two daily readings is showing. Defaults to whichever
// side of noon it actually is each time Devotionals is opened fresh (a
// visitor reading at 9pm almost certainly wants tonight's reading, not this
// morning's), but a manual tab click while browsing sticks until the next
// fresh open.
let devotionalActiveTab = null;
let devotionalSections = {};
function defaultDevotionalTab() { return new Date().getHours() >= 12 ? "evening" : "morning"; }
async function getTodayDevotionalCached() {
  if (todayDevotionalCache) return todayDevotionalCache;
  const d = await apiJSONCached("/devotionals/today");
  todayDevotionalCache = d.data || null;
  return todayDevotionalCache;
}
function openDevotionals() {
  devotionalDate = new Date();
  devotionalActiveTab = defaultDevotionalTab();
  syncDevotionalDateInput();
  renderDevotionals();
  switchMainView("devotionals");
}
function syncDevotionalDateInput() {
  const mm = String(devotionalDate.getMonth() + 1).padStart(2, "0");
  const dd = String(devotionalDate.getDate()).padStart(2, "0");
  // Year is a display-only placeholder — the API has no year concept for
  // this dataset (see onDevotionalDatePick, which discards it), but there's
  // no reason to show a fake one when the real current year works fine.
  document.getElementById("devotionalDateInput").value = `${devotionalDate.getFullYear()}-${mm}-${dd}`;
}
function shiftDevotionalDay(delta) {
  devotionalDate = new Date(devotionalDate.getTime() + delta * 86400000);
  syncDevotionalDateInput();
  renderDevotionals();
}
function goDevotionalToday() {
  devotionalDate = new Date();
  syncDevotionalDateInput();
  renderDevotionals();
}
function onDevotionalDatePick() {
  const val = document.getElementById("devotionalDateInput").value;
  if (!val) return;
  const [, mm, dd] = val.split("-").map(Number);
  const d = new Date();
  d.setMonth(mm - 1, dd);
  devotionalDate = d;
  renderDevotionals();
}
/* ── "did you read this devotional?" — parallels js/plans.js's chapter-end
   prompt, but keyed on month-day-tab (Spurgeon's readings have no year, and
   repeat on the same calendar date every year — see the file header) rather
   than a book/chapter ref. ── */
function getDevoProgress() { try { return JSON.parse(localStorage.getItem("iqb_devo_progress") || "{}"); } catch (e) { return {}; } }
function setDevoProgress(m) { localStorage.setItem("iqb_devo_progress", JSON.stringify(m)); }
function devoProgressKey(tab) { return `${devotionalDate.getMonth() + 1}-${devotionalDate.getDate()}-${tab}`; }
function renderDevoReadPrompt() {
  const el = document.getElementById("devoReadPrompt");
  if (!el || !devotionalActiveTab || !devotionalSections[devotionalActiveTab]) { if (el) el.className = ""; return; }
  const key = devoProgressKey(devotionalActiveTab);
  if (getDevoProgress()[key]) {
    el.className = "show done";
    el.innerHTML = `<p>&#10003; Marked as read</p><button class="vt-note-delete" onclick="unmarkDevoRead()">Undo</button>`;
    return;
  }
  el.className = "show";
  el.innerHTML = `<p>Did you read this devotional? We'll add it to your Progress.</p><button class="setsave" onclick="markDevoRead()">Yes, mark as read</button>`;
}
function markDevoRead() {
  const progress = getDevoProgress();
  progress[devoProgressKey(devotionalActiveTab)] = Date.now();
  setDevoProgress(progress);
  toast("Added to your Progress");
  renderDevoReadPrompt();
}
function unmarkDevoRead() {
  const progress = getDevoProgress();
  delete progress[devoProgressKey(devotionalActiveTab)];
  setDevoProgress(progress);
  renderDevoReadPrompt();
}
async function renderDevotionals() {
  const body = document.getElementById("devotionalsBody");
  body.innerHTML = `<div class="spin"></div>`;
  // Otherwise the previous date's prompt (or its "done" state) stays visible
  // behind the spinner until renderDevoReadPrompt() below re-runs.
  document.getElementById("devoReadPrompt").className = "";
  const token = ++devotionalToken;
  const month = devotionalDate.getMonth() + 1, day = devotionalDate.getDate();
  const now = new Date();
  const isToday = month === now.getMonth() + 1 && day === now.getDate();
  let data;
  try {
    data = isToday ? await getTodayDevotionalCached() : (await apiJSON(`/devotionals/${month}/${day}`)).data;
  } catch (e) {
    if (token !== devotionalToken) return;
    body.innerHTML = `<div class="dd-empty">Could not load a devotional for this date.</div>`;
    return;
  }
  if (token !== devotionalToken) return;
  if (!data || (!data.morning && !data.evening)) {
    body.innerHTML = `<div class="dd-empty">No devotional on file for this date.</div>`;
    return;
  }
  const sections = {};
  await Promise.all(["morning", "evening"].map(async key => {
    const r = data[key];
    if (!r) return;
    const bodyHtml = await linkifyCitations(r.body || "");
    const previewByRef = await fetchVersePreviews([{ book: r.book, chapter: r.chapter, verse: r.verse }]);
    const text = previewByRef[`${r.book}.${r.chapter}.${r.verse}`];
    const citeAttr = text ? ` data-cite-id="${registerCiteId(r.heading_citation, text)}"` : "";
    sections[key] = `<div class="devo-section">
      <div class="devo-heading">${escHtml(r.heading_text)}</div>
      <div class="devo-citation"><button class="prophecy-origin"${citeAttr} onclick="switchMainView('read');jumpToVerse('${r.book}',${r.chapter},${r.verse})">${escHtml(r.heading_citation)}</button></div>
      ${text ? `<div class="devo-verse-text">${escHtml(text)}</div>` : ""}
      <div class="devo-body">${bodyHtml}</div>
    </div>`;
  }));
  if (token !== devotionalToken) return;
  devotionalSections = sections;
  const available = ["morning", "evening"].filter(k => sections[k]);
  if (!available.includes(devotionalActiveTab)) devotionalActiveTab = available[0];
  const tabsHtml = available.length > 1 ? `<div class="devo-tabs">${available.map(k =>
    `<button class="filter-chip devo-tab${k === devotionalActiveTab ? " active" : ""}" data-tab="${k}" onclick="switchDevotionalTab('${k}')">${k === "morning" ? "Morning" : "Night"}</button>`
  ).join("")}</div>` : "";
  const title = isToday ? "Today's Devotional" : devotionalDate.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  body.innerHTML = `<div class="devo-title">${escHtml(title)}</div>${tabsHtml}` +
    `<div id="devotionalTabBody">${sections[devotionalActiveTab] || ""}</div>` +
    `<div class="devo-note">Morning &amp; Evening repeats on the same calendar date every year — there's no year-specific archive, just today's (or any month/day's) reading.</div>`;
  renderDevoReadPrompt();
}
function switchDevotionalTab(key) {
  devotionalActiveTab = key;
  document.querySelectorAll(".devo-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === key));
  document.getElementById("devotionalTabBody").innerHTML = devotionalSections[key] || "";
  renderDevoReadPrompt();
}
