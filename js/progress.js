/* ═══════════════════════════════════════════════════════════════════════
   MY PROGRESS — a full screen built entirely from local reading Progress
   this app already tracks: chapter reads (iqb_progress, js/plans.js) and
   devotional reads (iqb_devo_progress, js/devotionals.js), plus whichever
   plan is active (js/plans.js). No API calls of its own. Richer than the
   profile popover's "Your Reading" quick-glance stats (js/profile.js),
   which stays as the compact version. */
let progressActivityFilter = "all"; // "all" | "chapter" | "devo"

function confirmedReadDaySet() {
  const set = new Set();
  Object.values(getProgress()).forEach(ts => set.add(new Date(ts).toDateString()));
  Object.values(getDevoProgress()).forEach(ts => set.add(new Date(ts).toDateString()));
  return set;
}
// Consecutive-day streak off confirmed chapter/devotional reads — a
// deliberately different question from profile.js's readingStreak (which
// counts page visits, not confirmed reads). See the module comment above.
function confirmedReadStreak() {
  const days = confirmedReadDaySet();
  let cursor = new Date();
  if (!days.has(cursor.toDateString())) {
    cursor = new Date(Date.now() - 86400000);
    if (!days.has(cursor.toDateString())) return 0;
  }
  let streak = 0;
  while (days.has(cursor.toDateString())) { streak++; cursor = new Date(cursor.getTime() - 86400000); }
  return streak;
}
// A rolling 35-day window ending today, padded out to full Sun-Sat weeks
// (same "pad to full weeks" approach as plans.js's monthGridDates) so the
// grid always renders 5 or 6 clean rows instead of a ragged partial week.
function streakGridCells() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - 34 * 86400000);
  const gridStart = new Date(start.getTime() - start.getDay() * 86400000);
  const daySpan = Math.round((today - gridStart) / 86400000) + 1;
  const totalCells = Math.ceil(daySpan / 7) * 7;
  const cells = [];
  for (let i = 0; i < totalCells; i++) cells.push(new Date(gridStart.getTime() + i * 86400000));
  return cells;
}
function renderStreakCalendarHtml() {
  const readDays = confirmedReadDaySet();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const head = ["S", "M", "T", "W", "T", "F", "S"].map(d => `<div class="progress-cal-dow">${d}</div>`).join("");
  const body = streakGridCells().map(d => {
    if (d > today) return `<div class="progress-cal-cell future"></div>`;
    const read = readDays.has(d.toDateString());
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `<div class="progress-cal-cell${read ? " read" : ""}" title="${escHtml(label)}"></div>`;
  }).join("");
  return `<div class="progress-cal-grid head">${head}</div><div class="progress-cal-grid">${body}</div>`;
}

function buildActivityEntries() {
  const entries = [];
  Object.entries(getProgress()).forEach(([key, ts]) => {
    const dot = key.indexOf(".");
    entries.push({ ts, type: "chapter", book: key.slice(0, dot), chapter: key.slice(dot + 1) });
  });
  Object.entries(getDevoProgress()).forEach(([key, ts]) => {
    const parts = key.split("-");
    const tab = parts.pop();
    entries.push({ ts, type: "devo", month: Number(parts[0]), day: Number(parts[1]), tab });
  });
  entries.sort((a, b) => b.ts - a.ts);
  return entries;
}
function formatActivityTime(ts) {
  const d = new Date(ts), now = new Date();
  const startOfDay = x => { const y = new Date(x); y.setHours(0, 0, 0, 0); return y; };
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
const CHAPTER_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
const DEVO_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c-1 4-5 5-5 10a5 5 0 0 0 10 0c0-2-1-3-2-4 .5 2-1 3-2 2-1.5-1-1-3-1-3s-1 1-1 3c0-3 2-4 1-8z"/></svg>`;
function openDevotionalAtKey(month, day, tab) {
  const d = new Date();
  d.setMonth(month - 1, day);
  devotionalDate = d;
  devotionalActiveTab = tab;
  switchMainView("devotionals");
  syncDevotionalDateInput();
  renderDevotionals();
}
// Chapter entries are a "browser-list row" pointing at an already-known
// book/chapter — CLAUDE.md's citation-hover rule applies even though this
// was never free text, just via the lighter registerCiteId path, previewing
// verse 1 as the chapter's natural entry point (jumpToVerse below lands
// there too when no verse is specified).
function activityRowHtml(e, citeIdByChapterKey) {
  const time = formatActivityTime(e.ts);
  if (e.type === "chapter") {
    const title = `${notesBookName(e.book)} ${e.chapter}`;
    const citeId = citeIdByChapterKey[`${e.book}.${e.chapter}`];
    const citeAttr = citeId ? ` data-cite-id="${citeId}"` : "";
    return `<div class="progress-activity-row" style="cursor:pointer" onclick="switchMainView('read');jumpToVerse('${e.book}',${e.chapter},null)">
      <div class="progress-activity-icon">${CHAPTER_ICON}</div>
      <div class="progress-activity-title"${citeAttr}>${escHtml(title)}</div>
      <span class="progress-activity-time">${escHtml(time)}</span>
    </div>`;
  }
  const monthName = new Date(2000, e.month - 1, 1).toLocaleDateString(undefined, { month: "short" });
  const title = `Devotional — ${e.tab === "morning" ? "Morning" : "Night"}, ${monthName} ${e.day}`;
  return `<div class="progress-activity-row" style="cursor:pointer" onclick="openDevotionalAtKey(${e.month},${e.day},'${e.tab}')">
    <div class="progress-activity-icon">${DEVO_ICON}</div>
    <div class="progress-activity-title">${escHtml(title)}</div>
    <span class="progress-activity-time">${escHtml(time)}</span>
  </div>`;
}
function setProgressFilter(f) { progressActivityFilter = f; renderMyProgress(); }

// Bumped on every call and checked again after the one await below, so a
// stale in-flight render (e.g. rapid filter-chip clicks) can't overwrite a
// newer one — same race plans.js's renderPlanCalendarView had to guard
// against.
let progressRenderGen = 0;
async function renderMyProgress() {
  const myGen = ++progressRenderGen;
  const body = document.getElementById("myProgressBody");
  const chapterCount = Object.keys(getProgress()).length;
  const devoCount = Object.keys(getDevoProgress()).length;
  const activePlan = getActivePlan();
  const planStatHtml = activePlan
    ? `${(activePlan.completedDays || []).length}<small>/${activePlan.days.length}</small>`
    : `<small style="font-size:.7rem">No active plan</small>`;

  const allEntries = buildActivityEntries();
  const entries = progressActivityFilter === "all" ? allEntries : allEntries.filter(e => e.type === progressActivityFilter);
  const visible = entries.slice(0, 30);

  const chapterRefs = visible.filter(e => e.type === "chapter").map(e => ({ book: e.book, chapter: Number(e.chapter), verse: 1 }));
  const previewByRef = await fetchVersePreviews(chapterRefs);
  const citeIdByChapterKey = {};
  chapterRefs.forEach(r => {
    const text = previewByRef[`${r.book}.${r.chapter}.1`];
    if (text) citeIdByChapterKey[`${r.book}.${r.chapter}`] = registerCiteId(`${notesBookName(r.book)} ${r.chapter}`, text);
  });
  if (myGen !== progressRenderGen) return;

  const filtersHtml = `<div class="progress-activity-filters">
    <button class="filter-chip${progressActivityFilter === "all" ? " active" : ""}" onclick="setProgressFilter('all')">All</button>
    <button class="filter-chip${progressActivityFilter === "chapter" ? " active" : ""}" onclick="setProgressFilter('chapter')">Chapters</button>
    <button class="filter-chip${progressActivityFilter === "devo" ? " active" : ""}" onclick="setProgressFilter('devo')">Devotionals</button>
  </div>`;

  const activityHtml = allEntries.length === 0
    ? `<div class="progress-empty">Confirm a chapter or devotional as read and it'll show up here.</div>`
    : entries.length === 0
    ? `<div class="progress-activity-list"><div class="progress-empty">Nothing in this filter yet.</div></div>`
    : `<div class="progress-activity-list">${visible.map(e => activityRowHtml(e, citeIdByChapterKey)).join("")}</div>`;

  body.innerHTML = `
    <div class="progress-stats">
      <div class="progress-stat">
        <div class="progress-stat-num">${confirmedReadStreak()}</div>
        <div class="progress-stat-label">Day Streak</div>
      </div>
      <div class="progress-stat">
        <div class="progress-stat-num">${chapterCount}</div>
        <div class="progress-stat-label">Chapters Read</div>
      </div>
      <div class="progress-stat">
        <div class="progress-stat-num">${devoCount}</div>
        <div class="progress-stat-label">Devotionals Read</div>
      </div>
      <div class="progress-stat">
        <div class="progress-stat-num">${planStatHtml}</div>
        <div class="progress-stat-label">${activePlan ? escHtml(planModeLabel(activePlan.mode)) + " Days" : "Reading Plan"}</div>
      </div>
    </div>

    <div class="about-section-label" style="text-align:left">Last 5 Weeks</div>
    <div class="progress-cal-card">${renderStreakCalendarHtml()}</div>

    <div class="progress-activity-head">
      <div class="about-section-label" style="text-align:left;margin:0">Recent Activity</div>
      ${filtersHtml}
    </div>
    ${activityHtml}`;
}
