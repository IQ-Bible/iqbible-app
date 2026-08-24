/* ═══════════════════════════════════════════════════════════════════════
   PROFILE / READING DASHBOARD — replaces the old bare "open Settings"
   shortcut on the topbar's profile icon with a small non-blocking popover
   (#profilePanel, positioned under #profileWrap), built almost entirely
   from data this app already tracks locally — getHistory/getNotes/
   getBookmarks/getHighlights (js/api.js, js/reader.js). The one live API
   call is a cached today's-devotional teaser (js/devotionals.js). */
function toggleProfilePanel() {
  const panel = document.getElementById("profilePanel");
  if (panel.classList.contains("show")) { closeProfilePanel(); return; }
  renderProfilePanel();
  panel.classList.add("show");
}
function closeProfilePanel() {
  document.getElementById("profilePanel").classList.remove("show");
}
// Consecutive-day streak (local calendar days) off History's visitedAt
// timestamps, most-recent-first — a streak that ended yesterday still counts
// as N, just isn't "today"; no visit in either of the last two days is 0.
function readingStreak() {
  const days = new Set(getHistory().map(h => new Date(h.visitedAt).toDateString()));
  let cursor = new Date();
  if (!days.has(cursor.toDateString())) {
    cursor = new Date(Date.now() - 86400000);
    if (!days.has(cursor.toDateString())) return 0;
  }
  let streak = 0;
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}
function renderProfilePanel() {
  const hist = getHistory();
  const chaptersRead = new Set(hist.map(h => `${h.book}:${h.chapter}`)).size;
  document.getElementById("ppStats").innerHTML = `
    <div class="pp-stat"><div class="pp-stat-num">${chaptersRead}</div><div class="pp-stat-label">Chapters Read</div></div>
    <div class="pp-stat"><div class="pp-stat-num">${readingStreak()}</div><div class="pp-stat-label">Day Streak</div></div>
    <div class="pp-stat"><div class="pp-stat-num">${getNotes().length}</div><div class="pp-stat-label">Notes</div></div>
    <div class="pp-stat"><div class="pp-stat-num">${Object.keys(getBookmarks()).length}</div><div class="pp-stat-label">Bookmarks</div></div>`;

  const last = hist[hist.length - 1];
  const continueEl = document.getElementById("ppContinue");
  continueEl.innerHTML = (last && !(last.book === current.book && last.chapter === current.chapter))
    ? `<button onclick="closeProfilePanel();jumpToVerse('${last.book}',${last.chapter},null)">Continue reading — ${escHtml(last.bookName)} ${last.chapter} →</button>`
    : "";
  renderProfileDevotionalTeaser();
}
async function renderProfileDevotionalTeaser() {
  const el = document.getElementById("ppDevo");
  el.innerHTML = `<div class="pp-devo-label">Today's Devotional</div><div class="pp-devo-btn" style="opacity:.6">Loading…</div>`;
  let d;
  try { d = await getTodayDevotionalCached(); } catch (e) { el.innerHTML = ""; return; }
  if (!d) { el.innerHTML = ""; return; }
  const teaser = (d.morning && d.morning.heading_text) || "";
  el.innerHTML = `<div class="pp-devo-label">Today's Devotional</div><button class="pp-devo-btn" onclick="closeProfilePanel();openDevotionals()">${escHtml(teaser || "Read today's devotional")}</button>`;
}
