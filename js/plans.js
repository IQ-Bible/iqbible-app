/* ═══════════════════════════════════════════════════════════════════════
   PLANS — GET /bibles/{version}/reading-plan, one endpoint covering three
   modes (General: a testament/book-scoped chapter schedule; Topic: a
   verse-by-verse schedule through a topic's citations; M'Cheyne: a fixed
   365-day historical calendar). A created plan is generated once and cached
   verbatim (its planInfo/days never refetched) as one entry in iqb_plans, a
   list — a visitor can hold several plans at once, with at most one flagged
   "active" (the one findMatchingPlanDay/markChapterRead below check against
   for the reader's "did you read this chapter?" prompt). Each plan carries
   its own completedDays, so switching or deactivating never loses another
   plan's check-offs.

   iqb_progress (every chapter ever confirmed "read" via the chapter-end
   prompt at the bottom of this file) stays global across every plan and
   plain unplanned reading — a different question ("have I ever read Genesis
   4") from "is this plan's Day 4 done", deliberately shown as a raw chapter
   count rather than "X of Y": a trustworthy Bible-wide chapter total isn't
   available without either hardcoding per-version canon data or a real bulk
   fetch across every book's meta, and this app doesn't fabricate precision
   it can't back up (see NOTES.md). */
let planBuilderMode = "general";
// The version a new plan is being built for. null = "whatever's being read"
// (current.version); set non-null once the reader picks a different one in the
// builder. Drives both the version the plan is generated + stored against and
// the canon the "Specific Books" list offers — a Catholic version exposes
// Tobit/Maccabees/etc., a Protestant one doesn't. planBuilderBookList caches
// that chosen version's GET /bibles/{id}/books so the datalist can refresh
// without a full builder re-render (which would drop half-entered fields).
let planBuilderVersion = null;   // { id, title } | null
let planBuilderBookList = null;  // that version's books | null → use bookList
let plansViewState = "list"; // "list" | "builder" | "calendar"
let plansOpenPlanId = null;
let calendarCursor = null; // {year, month(0-indexed)} for the open plan's calendar
let dayDrawerDay = null;   // day number the drawer is currently showing, or null
let planExportMenuOpen = false;
// Bumped by every renderPlansView() call; renderPlanCalendarView snapshots
// it and checks again after its one await (topic mode's verse-preview
// fetch) so a stale in-flight render can't overwrite a newer one — e.g.
// deleting the open plan from the calendar's export menu used to race this:
// the calendar's own re-render (menu-close) was still awaiting that fetch
// when the delete's list re-render landed, and the calendar render finished
// last and clobbered it, leaving the deleted plan's calendar on screen.
let plansRenderGen = 0;

function openPlans() { switchMainView("plans"); renderPlansView(); }
function closePlans() { switchMainView("read"); }

/* ── storage — a list of plans, each independently completable/deletable,
   at most one active at a time (zero is a valid state: no plan feeds the
   reader's chapter-end prompt). ── */
function getPlans() { try { return JSON.parse(localStorage.getItem("iqb_plans") || "[]"); } catch (e) { return []; } }
function setPlans(plans) { localStorage.setItem("iqb_plans", JSON.stringify(plans)); }
function getActivePlan() { return getPlans().find(p => p.active) || null; }
function setPlanCompletedDays(planId, arr) {
  const plans = getPlans();
  const p = plans.find(x => x.id === planId);
  if (!p) return;
  p.completedDays = arr;
  setPlans(plans);
}
function getProgress() { try { return JSON.parse(localStorage.getItem("iqb_progress") || "{}"); } catch (e) { return {}; } }
function setProgress(m) { localStorage.setItem("iqb_progress", JSON.stringify(m)); }

// One-time migration from the old single-plan storage (iqb_active_plan +
// iqb_plan_completed_days) into iqb_plans, so a visitor who already had a
// plan running doesn't lose it when this ships. Runs once at load — once
// iqb_plans exists (even as "[]"), it's the source of truth and this is a
// no-op forever after.
(function migrateLegacyPlanStorage() {
  if (localStorage.getItem("iqb_plans") != null) return;
  let legacy = null;
  try { legacy = JSON.parse(localStorage.getItem("iqb_active_plan")); } catch (e) { /* not JSON — treat as absent */ }
  if (!legacy) { setPlans([]); return; }
  let completedDays = [];
  try { completedDays = JSON.parse(localStorage.getItem("iqb_plan_completed_days") || "[]"); } catch (e) { /* keep [] */ }
  const migrated = {
    id: "plan_" + Date.now().toString(36),
    name: defaultPlanName(legacy.mode, legacy.params || {}, legacy.planInfo || {}),
    mode: legacy.mode, versionCode: legacy.versionCode, versionTitle: legacy.versionTitle,
    params: legacy.params || {}, planInfo: legacy.planInfo || {}, days: legacy.days || [],
    completedDays, active: true, createdAt: legacy.createdAt || Date.now(),
  };
  setPlans([migrated]);
  localStorage.removeItem("iqb_active_plan");
  localStorage.removeItem("iqb_plan_completed_days");
})();

/* ── naming/formatting helpers ── */
function formatShortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  const opts = { month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}
function defaultPlanName(mode, params, planInfo) {
  const start = formatShortDate(planInfo && planInfo.start_date);
  if (mode === "topic") return `Topic: ${(params && params.topic) || "?"}`;
  if (mode === "mcheyne") return `M'Cheyne — started ${start}`;
  return `General — started ${start}`;
}
function planModeLabel(mode) { return { general: "General Plan", topic: "Topic Plan", mcheyne: "M'Cheyne Plan" }[mode] || mode; }
// USFM codes (GEN, 1CO, MAT, ...) are already the compact form a calendar
// day box needs — bookAbbrev (js/catalog.js, from the API's own
// /books/abbreviations) is the same source the book-picker grid uses for
// the same "full name doesn't fit" reason, not a made-up abbreviation
// scheme. Falls back to the full name if abbreviations haven't loaded yet.
function dayRefBookLabel(usfm) { return bookAbbrev[usfm] || notesBookName(usfm); }
function localDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

/* ── top-level render — dispatches on plansViewState ── */
async function renderPlansView() {
  plansRenderGen++;
  const body = document.getElementById("plansBody");
  if (plansViewState === "builder") {
    body.innerHTML = `<div class="tool-back-row"><button onclick="backToPlansList()">&lsaquo; My Plans</button></div>` + renderPlanBuilderHtml();
    return;
  }
  if (plansViewState === "calendar") {
    body.innerHTML = `<div class="spin"></div>`;
    await renderPlanCalendarView();
    return;
  }
  renderPlansListView();
}
function backToPlansList() {
  plansViewState = "list"; plansOpenPlanId = null; calendarCursor = null;
  dayDrawerDay = null; planExportMenuOpen = false;
  renderPlansView();
}
function startNewPlan() {
  planBuilderVersion = null; planBuilderBookList = null;
  plansViewState = "builder"; renderPlansView();
}
// The version/canon a new plan targets — the reader's current translation
// unless they've picked another in the builder.
function planTargetVersion() { return planBuilderVersion || { id: current.version, title: current.versionTitle }; }
function planBuilderBooks() { return (planBuilderVersion && planBuilderBookList) ? planBuilderBookList : bookList; }
function planBookOptionsHtml() {
  return planBuilderBooks().map(b => `<option value="${escAttr(b.usfm)}">${escHtml(b.name)}</option>`).join("");
}
// Called from the shared version picker in its "plan" mode (js/catalog.js).
// Updates the builder in place rather than re-rendering it, so a partly
// filled-in form survives a version change.
async function setPlanBuilderVersion(id) {
  closeModal("versionPickerScrim");
  const v = (catalog || []).find(x => x.version_id === id);
  if (!v) return;
  planBuilderVersion = { id, title: v.title || id };
  planBuilderBookList = null;
  const btn = document.getElementById("planVersionBtn");
  if (btn) btn.textContent = planBuilderVersion.title;
  try {
    const d = await apiJSONCached(`/bibles/${id}/books`);
    planBuilderBookList = d.data || [];
  } catch (e) { if (e.message !== "no_api_key") toast("Could not load that version's books"); }
  const dl = document.getElementById("planBookList");
  if (dl) dl.innerHTML = planBookOptionsHtml();
  // Drop any typed book code that isn't in the new canon.
  const inp = document.getElementById("planBooksInput");
  if (inp && inp.value.trim()) {
    const valid = new Set(planBuilderBooks().map(b => b.usfm.toUpperCase()));
    inp.value = inp.value.split(",").map(s => s.trim()).filter(s => s && valid.has(s.toUpperCase())).join(",");
  }
}

/* ── "My Plans" home — a grid of every saved plan ── */
function pctComplete(plan) {
  const total = (plan.days || []).length;
  if (!total) return 0;
  return Math.round(((plan.completedDays || []).length / total) * 100);
}
function progressRingSvg(pct) {
  const c = 163.36; // 2*pi*26, the ring's circumference at r=26
  const dash = Math.max(0, Math.min(c, (pct / 100) * c)).toFixed(2);
  return `<svg width="56" height="56" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="26" fill="none" stroke="var(--surface-2)" stroke-width="6"/>
    <circle cx="32" cy="32" r="26" fill="none" stroke="var(--brand)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${dash} ${c}" transform="rotate(-90 32 32)"/>
    <text x="32" y="37" text-anchor="middle" font-family="var(--font-ui)" font-weight="700" font-size="13" fill="var(--ink)">${pct}%</text>
  </svg>`;
}
function planCardHtml(plan) {
  const pct = pctComplete(plan);
  const total = (plan.days || []).length;
  const done = (plan.completedDays || []).length;
  const start = formatShortDate(plan.planInfo && plan.planInfo.start_date);
  return `<div class="plan-card">
    ${plan.active ? `<div class="plan-card-badge">Active</div>` : ""}
    <button class="plan-card-del" title="Delete plan" aria-label="Delete plan" onclick="event.stopPropagation();deletePlanConfirm('${plan.id}')">&times;</button>
    <div class="plan-card-mode">${escHtml(planModeLabel(plan.mode))}</div>
    <div class="plan-card-title">${escHtml(plan.name)}</div>
    <div class="plan-card-mid">
      ${progressRingSvg(pct)}
      <div>
        <div class="plan-card-stat">${done} of ${total} days</div>
        <div class="plan-card-started">Started ${escHtml(start)}</div>
      </div>
    </div>
    <div class="plan-card-actions">
      <button class="plan-card-btn primary" onclick="openPlanCalendar('${plan.id}')">Open</button>
      <button class="plan-card-btn ${plan.active ? "muted" : "outline"}" onclick="toggleActivePlan('${plan.id}')">${plan.active ? "Deactivate" : "Set Active"}</button>
    </div>
  </div>`;
}
function renderPlansListView() {
  const body = document.getElementById("plansBody");
  const plans = getPlans();
  const progressCount = Object.keys(getProgress()).length;
  const head = `<div class="plans-home-head">
      <div>
        <div class="plans-home-title">My Plans</div>
        <div style="font-size:.78rem;color:var(--muted);margin-top:6px">${progressCount} chapter${progressCount === 1 ? "" : "s"} marked read, across every plan and chapter you've confirmed.</div>
      </div>
      <div class="plans-home-actions">
        <button class="plan-import-btn" onclick="triggerPlanImport()">Import Plan</button>
        <button class="plan-new-btn" onclick="startNewPlan()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          New Plan
        </button>
      </div>
    </div>`;
  if (!plans.length) { body.innerHTML = head + `<div class="dd-empty">No reading plans yet — create one to get started.</div>`; return; }
  const sorted = plans.slice().sort((a, b) => b.createdAt - a.createdAt);
  body.innerHTML = head + `<div class="plans-grid">${sorted.map(planCardHtml).join("")}</div>`;
}
function toggleActivePlan(id) {
  const plans = getPlans();
  const target = plans.find(p => p.id === id);
  if (!target) return;
  const wasActive = target.active;
  plans.forEach(p => { p.active = false; });
  if (!wasActive) target.active = true;
  setPlans(plans);
  renderPlansView();
  toast(wasActive ? "Plan deactivated" : "Plan set active");
}
function deletePlanConfirm(id) {
  const plans = getPlans();
  const target = plans.find(p => p.id === id);
  if (!target) return;
  if (!confirm(`Delete "${target.name}"? This can't be undone.`)) return;
  setPlans(plans.filter(p => p.id !== id));
  if (plansOpenPlanId === id) { plansOpenPlanId = null; plansViewState = "list"; planExportMenuOpen = false; }
  renderPlansView();
  toast("Plan deleted");
}
function renamePlanPrompt() {
  const plan = getPlans().find(p => p.id === plansOpenPlanId);
  if (!plan) return;
  const name = prompt("Rename this plan", plan.name);
  if (name == null) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const plans = getPlans();
  plans.find(p => p.id === plan.id).name = trimmed;
  setPlans(plans);
  renderPlansView();
}

/* ── builder (create a new plan) — all three modes' fields are rendered at
   once and shown/hidden by selectPlanMode(), rather than regenerated, so
   switching modes never loses whatever the visitor already typed. ── */
function dowChipsHtml() {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map(d =>
    `<button type="button" class="filter-chip plan-dow-chip" data-dow="${d}" onclick="this.classList.toggle('active')">${d[0].toUpperCase() + d.slice(1)}</button>`
  ).join("");
}
function selectedDow(containerId) {
  return [...document.querySelectorAll(`#${containerId} .plan-dow-chip.active`)].map(b => b.dataset.dow).join(",");
}
function renderPlanBuilderHtml() {
  const bookOptions = planBookOptionsHtml();
  const tv = planTargetVersion();
  return `
    <div class="setfield">
      <label>Build a Reading Plan</label>
      <div class="overlay-filters">
        <button class="filter-chip plan-mode-chip active" data-mode="general" onclick="selectPlanMode('general')">General</button>
        <button class="filter-chip plan-mode-chip" data-mode="topic" onclick="selectPlanMode('topic')">Topic</button>
        <button class="filter-chip plan-mode-chip" data-mode="mcheyne" onclick="selectPlanMode('mcheyne')">M'Cheyne</button>
      </div>
    </div>
    <div class="setfield">
      <label for="planVersionBtn">Version</label>
      <button type="button" class="setfield-picker" id="planVersionBtn" onclick="openVersionPicker('plan')">${escHtml(tv.title || tv.id)}</button>
      <div class="hint">The plan is built for this translation, and “Specific Books” follows its canon. Defaults to what you’re reading now.</div>
    </div>
    <div id="planFieldsGeneral">
      <div class="setfield"><label for="planDays">Days</label><input type="number" id="planDays" min="1" max="730" value="365"></div>
      <div class="setfield"><label for="planStartDate">Start Date</label><input type="date" id="planStartDate"></div>
      <div class="setfield">
        <label>Scope</label>
        <div class="overlay-filters">
          <label><input type="radio" name="planScope" value="whole" checked onchange="updatePlanScopeFields()"> Whole Bible</label>
          <label><input type="radio" name="planScope" value="testament" onchange="updatePlanScopeFields()"> Testament</label>
          <label><input type="radio" name="planScope" value="books" onchange="updatePlanScopeFields()"> Specific Books</label>
        </div>
        <select id="planTestamentSelect" class="plan-scope-sub" style="display:none">
          <option value="ot">Old Testament</option>
          <option value="nt">New Testament</option>
        </select>
        <div id="planBooksField" class="plan-scope-sub" style="display:none">
          <input type="text" id="planBooksInput" list="planBookList" placeholder="Start typing a book name…">
          <div class="hint">Pick from the list or type book codes separated by commas (e.g. GEN, EXO, MAT). Only books in the selected version’s canon are offered.</div>
        </div>
        <datalist id="planBookList">${bookOptions}</datalist>
      </div>
      <div class="setfield"><label>Days of Week <span class="hint" style="display:inline">— leave blank for every day</span></label><div class="overlay-filters" id="planDowGeneral">${dowChipsHtml()}</div></div>
      <div class="setfield-check"><input type="checkbox" id="planIncludePsalms"><label for="planIncludePsalms">Include a daily Psalm</label></div>
      <div class="setfield-check"><input type="checkbox" id="planIncludeProverbs"><label for="planIncludeProverbs">Include a daily Proverb</label></div>
      <div class="setfield"><label for="planAge">Reader's Age <span class="hint" style="display:inline">— for the reading-time estimate</span></label><input type="number" id="planAge" min="1" value="18"></div>
    </div>
    <div id="planFieldsTopic" style="display:none">
      <div class="setfield"><label for="planTopicInput">Topic Name</label><input type="text" id="planTopicInput" placeholder="e.g. faith, love, prayer"></div>
      <div class="setfield"><label for="planTopicDays">Days</label><input type="number" id="planTopicDays" min="1" max="730" value="30"></div>
      <div class="setfield"><label for="planTopicStart">Start Date</label><input type="date" id="planTopicStart"></div>
      <div class="setfield"><label for="planTopicTestament">Testament <span class="hint" style="display:inline">(optional)</span></label>
        <select id="planTopicTestament"><option value="">Either</option><option value="ot">Old Testament</option><option value="nt">New Testament</option></select>
      </div>
    </div>
    <div id="planFieldsMcheyne" style="display:none">
      <div class="setfield"><label for="planMcheyneStart">Start Date</label><input type="date" id="planMcheyneStart"></div>
      <div class="setfield"><label>Days of Week <span class="hint" style="display:inline">— leave blank for every day</span></label><div class="overlay-filters" id="planDowMcheyne">${dowChipsHtml()}</div></div>
      <div class="hint">M'Cheyne's classic calendar always runs 365 days, with a Family and a Secret/personal reading each day.</div>
    </div>
    <button class="setsave" onclick="createPlan()">Create Plan</button>`;
}
function selectPlanMode(mode) {
  planBuilderMode = mode;
  document.querySelectorAll(".plan-mode-chip").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  document.getElementById("planFieldsGeneral").style.display = mode === "general" ? "" : "none";
  document.getElementById("planFieldsTopic").style.display = mode === "topic" ? "" : "none";
  document.getElementById("planFieldsMcheyne").style.display = mode === "mcheyne" ? "" : "none";
}
function updatePlanScopeFields() {
  const scope = document.querySelector('input[name="planScope"]:checked').value;
  document.getElementById("planTestamentSelect").style.display = scope === "testament" ? "" : "none";
  document.getElementById("planBooksField").style.display = scope === "books" ? "" : "none";
}
function buildPlanParams(mode) {
  if (mode === "general") {
    const params = { days: document.getElementById("planDays").value || "365" };
    const start = document.getElementById("planStartDate").value; if (start) params.start_date = start;
    const scope = document.querySelector('input[name="planScope"]:checked').value;
    if (scope === "testament") params.testament = document.getElementById("planTestamentSelect").value;
    else if (scope === "books") { const books = document.getElementById("planBooksInput").value.trim(); if (books) params.books = books; }
    const dow = selectedDow("planDowGeneral"); if (dow) params.days_of_week = dow;
    if (document.getElementById("planIncludePsalms").checked) params.include_psalms = "true";
    if (document.getElementById("planIncludeProverbs").checked) params.include_proverbs = "true";
    const age = document.getElementById("planAge").value.trim(); if (age) params.age = age;
    return params;
  }
  if (mode === "topic") {
    const params = { topic: document.getElementById("planTopicInput").value.trim(), days: document.getElementById("planTopicDays").value || "30" };
    const start = document.getElementById("planTopicStart").value; if (start) params.start_date = start;
    const testament = document.getElementById("planTopicTestament").value; if (testament) params.testament = testament;
    return params;
  }
  const params = { plan: "mcheyne" };
  const start = document.getElementById("planMcheyneStart").value; if (start) params.start_date = start;
  const dow = selectedDow("planDowMcheyne"); if (dow) params.days_of_week = dow;
  return params;
}
function planQueryString(params, extra) {
  const all = { ...params, ...(extra || {}) };
  return Object.entries(all).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}
async function createPlan() {
  const mode = planBuilderMode;
  if (mode === "topic" && !document.getElementById("planTopicInput").value.trim()) { toast("Enter a topic name"); return; }
  const params = buildPlanParams(mode);
  const tv = planTargetVersion();
  try {
    const d = await apiJSON(`/bibles/${tv.id}/reading-plan?${planQueryString(params)}`);
    const plans = getPlans();
    plans.forEach(p => { p.active = false; });
    const plan = {
      id: "plan_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: defaultPlanName(mode, params, d.plan_info),
      mode, versionCode: tv.id, versionTitle: tv.title || tv.id,
      params, planInfo: d.plan_info, days: d.days,
      completedDays: [], active: true, createdAt: Date.now(),
    };
    plans.push(plan);
    setPlans(plans);
    toast("Plan created");
    plansOpenPlanId = plan.id;
    calendarCursor = null;
    plansViewState = "calendar";
    renderPlansView();
  } catch (e) {
    if (e.message === "no_api_key") return;
    // apiJSON already toasts every non-404 error; 404 (bad topic, no
    // chapters in scope, ...) is otherwise silent since it's routine
    // control flow elsewhere in this app — not here, this is the one call
    // whose 404 really does mean "that input didn't work."
    if (e.status === 404) toast("No matching content for that plan — check the topic name or book scope.");
  }
}

/* ── chapter/verse reference rendering, shared by the calendar's compact
   inline text and the day drawer's full list. Verse-level refs (Topic mode)
   get the hover-preview treatment per CLAUDE.md's citation rule; chapter-
   level refs don't — a whole chapter has no single verse to preview, same
   reasoning as the My Library History tab. ── */
function chapterRefsHtml(refs) {
  return refs.map(r => `<a href="javascript:void(0)" class="plan-ref" data-book="${escAttr(r.book)}" data-chapter="${r.chapter}">${escHtml(notesBookName(r.book))} ${r.chapter}</a>`).join(", ");
}
async function verseRefsHtml(verses) {
  if (!verses.length) return "";
  const previewByRef = await fetchVersePreviews(verses);
  return verses.map(v => {
    const label = `${notesBookName(v.book)} ${v.chapter}:${v.verse}`;
    const text = previewByRef[`${v.book}.${v.chapter}.${v.verse}`];
    const citeAttr = text ? ` data-cite-id="${registerCiteId(label, text)}"` : "";
    return `<a href="javascript:void(0)" class="plan-ref${text ? " citelink" : ""}"${citeAttr} data-book="${escAttr(v.book)}" data-chapter="${v.chapter}" data-verse="${v.verse}">${escHtml(label)}</a>`;
  }).join(", ");
}
// Compact form for a calendar day box: abbreviated book names, capped at 3
// refs with a "+N more" tail so a busy General/Topic day never blows out
// the box (the backend's own PDF calendar generator hits this exact
// constraint — see NOTES.md/readingplans.go — and solves it the same way).
function jumpFromCalendar(book, chapter, verse) { closePlans(); jumpToVerse(book, chapter, verse); }
function truncatedRefLinks(refs, previewByRef) {
  if (!refs || !refs.length) return `<span class="cal-ref-empty">&mdash;</span>`;
  const max = 3;
  const shown = refs.slice(0, max);
  const extra = refs.length - shown.length;
  const links = shown.map(r => {
    const hasVerse = r.verse != null;
    const label = `${dayRefBookLabel(r.book)} ${r.chapter}${hasVerse ? ":" + r.verse : ""}`;
    let citeAttr = "";
    if (hasVerse && previewByRef) {
      const text = previewByRef[`${r.book}.${r.chapter}.${r.verse}`];
      if (text) citeAttr = ` data-cite-id="${registerCiteId(label, text)}"`;
    }
    return `<a href="javascript:void(0)" class="cal-ref${citeAttr ? " citelink" : ""}"${citeAttr} onclick="event.stopPropagation();jumpFromCalendar('${escAttr(r.book)}',${r.chapter}${hasVerse ? "," + r.verse : ""})">${escHtml(label)}</a>`;
  });
  let html = links.join(", ");
  if (extra > 0) html += ` <span class="cal-ref-more">+${extra} more</span>`;
  return html;
}

/* ── plan calendar — a traditional month grid replacing the old flat
   Day-1/Day-2/... card list, so a 365-730 day plan pages by month instead
   of rendering every day at once. Each box shows the actual readings
   (abbreviated/truncated), a status mark, and opens the day drawer on
   click for the checkbox + full reference list. ── */
function monthGridDates(year, month) {
  const startDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startDow + 1;
    const d = new Date(year, month, dayOffset);
    cells.push({ date: localDateStr(d), inMonth: dayOffset >= 1 && dayOffset <= daysInMonth, dayNum: d.getDate() });
  }
  return cells;
}
function defaultCalendarCursor(plan) {
  const today = new Date();
  const todayStr = localDateStr(today);
  if (plan.days.some(d => d.date === todayStr)) return { year: today.getFullYear(), month: today.getMonth() };
  const first = plan.days[0];
  if (first) { const d = new Date(first.date + "T00:00:00"); return { year: d.getFullYear(), month: d.getMonth() }; }
  return { year: today.getFullYear(), month: today.getMonth() };
}
// {year*12+month} lets first/last-month bounds compare with a single
// subtraction instead of juggling year and month separately.
function planMonthBounds(plan) {
  if (!plan || !plan.days.length) return null;
  const first = new Date(plan.days[0].date + "T00:00:00");
  const last = new Date(plan.days[plan.days.length - 1].date + "T00:00:00");
  return { firstYM: first.getFullYear() * 12 + first.getMonth(), lastYM: last.getFullYear() * 12 + last.getMonth() };
}
function shiftCalendarMonth(delta) {
  if (!calendarCursor) return;
  let { year, month } = calendarCursor;
  month += delta;
  if (month < 0) { month = 11; year--; } else if (month > 11) { month = 0; year++; }
  const bounds = planMonthBounds(getPlans().find(p => p.id === plansOpenPlanId));
  if (bounds) {
    const ym = year * 12 + month;
    if (ym < bounds.firstYM || ym > bounds.lastYM) return;
  }
  calendarCursor = { year, month };
  renderPlansView();
}
function jumpCalendarToday() {
  const today = new Date();
  calendarCursor = { year: today.getFullYear(), month: today.getMonth() };
  renderPlansView();
}
function planDayCellHtml(cell, plan, completedSet, todayStr, previewByRef) {
  if (!cell.inMonth) return `<div class="cal-daycell cal-outside"><span class="cal-daynum cal-outside">${cell.dayNum}</span></div>`;
  const dayObj = plan.days.find(d => d.date === cell.date);
  if (!dayObj) return `<div class="cal-daycell"><span class="cal-daynum">${cell.dayNum}</span></div>`;
  const done = completedSet.has(dayObj.day);
  const isToday = cell.date === todayStr;
  const missed = !done && !isToday && cell.date < todayStr;
  const stateClass = done ? "cal-done" : missed ? "cal-missed" : isToday ? "cal-today" : "";
  const icon = done
    ? `<svg width="16" height="16" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="var(--brand)"/><path d="M6 10l2.5 2.5L14.5 6.5" stroke="var(--on-brand)" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : missed
    ? `<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#d97706" stroke-width="2"/></svg>`
    : `<svg width="12" height="12" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--muted2)" stroke-width="1.5"/></svg>`;
  let refsHtml;
  if (plan.mode === "mcheyne") {
    refsHtml = `<div class="cal-refline"><b>F</b> ${truncatedRefLinks(dayObj.family || [])}</div><div class="cal-refline"><b>S</b> ${truncatedRefLinks(dayObj.secret || [])}</div>`;
  } else if (plan.mode === "topic") {
    refsHtml = `<div class="cal-refline">${truncatedRefLinks(dayObj.verses || [], previewByRef)}</div>`;
  } else {
    refsHtml = `<div class="cal-refline">${truncatedRefLinks(dayObj.chapters || [])}</div>`;
  }
  return `<div class="cal-daycell ${stateClass}" onclick="openDayDrawer(${dayObj.day})">
    <div class="cal-cellhead"><span class="cal-daynum${isToday ? " cal-daynum-today" : ""}">${cell.dayNum}</span>${icon}</div>
    ${refsHtml}
  </div>`;
}
function togglePlanExportMenu() { planExportMenuOpen = !planExportMenuOpen; renderPlansView(); }
function closePlanExportMenu() { planExportMenuOpen = false; renderPlansView(); }
function planExportMenuHtml(plan) {
  // PDF/iCal are generated live by the API from the plan's own creation
  // params (format=pdf/ical) — a plan imported from a CSV file has no
  // params to regenerate from (CSV never carried them, see
  // parseImportedPlanCSV), so those two options are honestly left off
  // rather than calling the API with the wrong params and downloading a
  // different plan than the one on screen.
  const hasParams = Object.keys(plan.params || {}).length > 0;
  return `<div class="plan-menu-wrap">
      <button class="plan-menu-btn" onclick="event.stopPropagation();togglePlanExportMenu()" title="Export &amp; more" aria-label="Export and more">&#8942;</button>
      <div class="plan-menu${planExportMenuOpen ? " show" : ""}" onclick="event.stopPropagation()">
        <button class="plan-menu-row" onclick="sharePlan();closePlanExportMenu()">Share Plan</button>
        <div class="plan-menu-divider"></div>
        ${hasParams ? `<button class="plan-menu-row" onclick="closePlanExportMenu();downloadPlanRemote('pdf')">Download PDF</button>
        <button class="plan-menu-row" onclick="closePlanExportMenu();downloadPlanRemote('ical')">Download iCal</button>` : ""}
        <button class="plan-menu-row" onclick="closePlanExportMenu();downloadPlanCSV()">Download CSV</button>
        <button class="plan-menu-row" onclick="closePlanExportMenu();downloadPlanJSON()">Download JSON</button>
        <div class="plan-menu-divider"></div>
        <button class="plan-menu-row" onclick="closePlanExportMenu();renamePlanPrompt()">Rename Plan</button>
        <button class="plan-menu-row plan-menu-row-danger" onclick="closePlanExportMenu();deletePlanConfirm(plansOpenPlanId)">Delete Plan</button>
      </div>
    </div>`;
}
function openPlanCalendar(id) {
  plansOpenPlanId = id; calendarCursor = null; dayDrawerDay = null; planExportMenuOpen = false;
  plansViewState = "calendar";
  renderPlansView();
}
async function renderPlanCalendarView() {
  const myGen = ++plansRenderGen;
  const plan = getPlans().find(p => p.id === plansOpenPlanId);
  const body = document.getElementById("plansBody");
  if (!plan) { plansViewState = "list"; renderPlansListView(); return; }
  if (!calendarCursor) calendarCursor = defaultCalendarCursor(plan);
  const completedSet = new Set(plan.completedDays || []);
  const todayStr = localDateStr(new Date());
  const cells = monthGridDates(calendarCursor.year, calendarCursor.month);

  let previewByRef = {};
  if (plan.mode === "topic") {
    const refsToPreview = [];
    cells.forEach(c => {
      if (!c.inMonth) return;
      const d = plan.days.find(x => x.date === c.date);
      if (d) (d.verses || []).slice(0, 3).forEach(v => refsToPreview.push(v));
    });
    if (refsToPreview.length) previewByRef = await fetchVersePreviews(refsToPreview);
  }
  // A newer render (e.g. this plan got deleted while the fetch above was
  // in flight) has already replaced #plansBody — don't clobber it.
  if (myGen !== plansRenderGen) return;

  const total = plan.days.length;
  const doneCount = completedSet.size;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const monthLabel = new Date(calendarCursor.year, calendarCursor.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const bounds = planMonthBounds(plan);
  const cursorYM = calendarCursor.year * 12 + calendarCursor.month;
  const atFirstMonth = bounds && cursorYM <= bounds.firstYM;
  const atLastMonth = bounds && cursorYM >= bounds.lastYM;

  body.innerHTML = `
    <div class="tool-back-row"><button onclick="backToPlansList()">&lsaquo; My Plans</button></div>
    <div class="cal-header-row">
      <div>
        <div class="cal-plan-title">${escHtml(plan.name)}</div>
        <div class="plan-card-mode" style="margin-top:4px">${escHtml(planModeLabel(plan.mode))}</div>
      </div>
      ${planExportMenuHtml(plan)}
    </div>
    <div class="cal-progress-line">${doneCount} of ${total} days complete &middot; ${pct}%</div>
    <div class="plan-progress-wrap"><div class="plan-progress-fill" style="width:${pct}%"></div></div>
    <div class="cal-nav-row">
      <button class="cal-nav-btn" ${atFirstMonth ? "disabled" : ""} onclick="shiftCalendarMonth(-1)" aria-label="Previous month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>
      <span class="cal-month-label">${escHtml(monthLabel)}</span>
      <button class="cal-nav-btn" ${atLastMonth ? "disabled" : ""} onclick="shiftCalendarMonth(1)" aria-label="Next month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>
      <button class="filter-chip" onclick="jumpCalendarToday()">Today</button>
    </div>
    <div class="cal-weekday-row">${["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(w => `<div class="cal-weekday">${w}</div>`).join("")}</div>
    <div class="cal-grid">${cells.map(c => planDayCellHtml(c, plan, completedSet, todayStr, previewByRef)).join("")}</div>
    <div class="cal-legend">
      <div class="cal-legend-item"><svg width="13" height="13" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="var(--brand)"/><path d="M6 10l2.5 2.5L14.5 6.5" stroke="var(--on-brand)" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Complete</div>
      <div class="cal-legend-item"><svg width="11" height="11" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#d97706" stroke-width="2"/></svg> Missed</div>
      <div class="cal-legend-item"><svg width="10" height="10" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--muted2)" stroke-width="1.5"/></svg> Open</div>
      <div class="cal-legend-item"><span class="cal-legend-today"></span> Today</div>
    </div>`;
}

/* ── day drawer — the checkbox + full reference list, opened from a
   calendar day cell. A static .modalscrim (index.html), unlike the rest of
   this file's content which lives inside #plansBody. ── */
function openDayDrawer(day) {
  const plan = getPlans().find(p => p.id === plansOpenPlanId);
  if (!plan) return;
  dayDrawerDay = day;
  renderDayDrawerContent();
  document.getElementById("dayDrawerScrim").classList.add("show");
}
function closeDayDrawer() {
  document.getElementById("dayDrawerScrim").classList.remove("show");
  dayDrawerDay = null;
}
async function renderDayDrawerContent() {
  const plan = getPlans().find(p => p.id === plansOpenPlanId);
  const body = document.getElementById("dayDrawerBody");
  if (!plan || dayDrawerDay == null) return;
  const dayObj = plan.days.find(d => d.day === dayDrawerDay);
  if (!dayObj) { closeDayDrawer(); return; }
  body.innerHTML = `<div class="spin"></div>`;
  const done = new Set(plan.completedDays || []).has(dayDrawerDay);
  let refsHtml;
  if (plan.mode === "mcheyne") {
    refsHtml = `<div class="dd-drawer-row"><span class="dd-drawer-label">Family</span><div>${chapterRefsHtml(dayObj.family || [])}</div></div>
      <div class="dd-drawer-row"><span class="dd-drawer-label">Secret</span><div>${chapterRefsHtml(dayObj.secret || [])}</div></div>`;
  } else if (plan.mode === "topic") {
    refsHtml = `<div class="dd-drawer-row"><div>${await verseRefsHtml(dayObj.verses || [])}</div></div>`;
  } else {
    refsHtml = `<div class="dd-drawer-row"><div>${chapterRefsHtml(dayObj.chapters || [])}</div></div>`;
  }
  // dayDrawerDay may have changed (a fast double-click on another cell)
  // while the verse-preview fetch above was in flight — bail rather than
  // paint a stale day's content into the now-current one.
  if (dayDrawerDay !== dayObj.day) return;
  body.innerHTML = `
    <div class="dd-drawer-head">
      <div class="dd-drawer-title">Day ${dayObj.day} &mdash; ${escHtml(formatShortDate(dayObj.date) || dayObj.date)}</div>
      <button class="closebtn" onclick="closeDayDrawer()" aria-label="Close">&times;</button>
    </div>
    ${refsHtml}
    <label class="setfield-check" style="margin-top:14px">
      <input type="checkbox" ${done ? "checked" : ""} onchange="toggleDrawerDayComplete(this.checked)">
      <span>Mark day complete</span>
    </label>
    ${plan.mode === "topic" ? "" : `<div class="hint">Also counts this day's chapters as read in your Progress. Unchecking leaves them — clear a chapter from the reader if you need to.</div>`}`;
}
function toggleDrawerDayComplete(checked) {
  const plan = getPlans().find(p => p.id === plansOpenPlanId);
  if (!plan || dayDrawerDay == null) return;
  let completed = plan.completedDays || [];
  if (checked) {
    if (!completed.includes(dayDrawerDay)) completed.push(dayDrawerDay);
    const added = markPlanDayChaptersRead(plan, dayDrawerDay);
    if (added) {
      toast(`Day ${dayDrawerDay} complete — ${added} chapter${added === 1 ? "" : "s"} added to your Progress`);
      // The reader may be sitting on one of the chapters just marked — repaint
      // its chapter-end prompt so it flips to "Marked as read" without a reload.
      renderChapterReadPrompt();
    }
  } else {
    completed = completed.filter(d => d !== dayDrawerDay);
  }
  setPlanCompletedDays(plan.id, completed);
  if (plansViewState === "calendar") renderPlanCalendarView(); // refresh the grid behind the drawer
}
// Checking a day off by hand ("Mark day complete" in the drawer) is the
// same statement as reading each of its chapters through the reader prompt,
// so it writes the same iqb_progress entries — otherwise the reader would
// keep asking "did you read this chapter?" for a day you've completed, and
// the Bible-wide "chapters marked read" count would undercount for anyone
// who tracks a plan mainly from the calendar. Chapter-level plans only
// (General/M'Cheyne); Topic mode's days are verse-level and this app keeps
// no verse-level progress record. Unchecking a day deliberately leaves the
// chapter entries in place — reversing them safely would need per-day
// bookkeeping of which keys this added (a chapter can recur across M'Cheyne
// days, or have been read independently first), and quietly deleting
// read-history on a mis-click is worse than a checkmark the reader's own
// per-chapter Undo can clear.
function markPlanDayChaptersRead(plan, day) {
  if (plan.mode !== "general" && plan.mode !== "mcheyne") return 0;
  const dayObj = plan.days.find(d => d.day === day);
  if (!dayObj) return 0;
  const progress = getProgress();
  let added = 0;
  planDayChapterRefs(plan, dayObj).forEach(r => {
    const k = `${r.book}.${r.chapter}`;
    if (!progress[k]) { progress[k] = Date.now(); added++; }
  });
  if (added) setProgress(progress);
  return added;
}

/* ── export — PDF/iCal stay live API calls (format=pdf/ical), the same
   endpoint the plan was created from; CSV/JSON are built straight from the
   already-cached plan (no network call, and unlike the live-fetched
   formats they can carry this app's own completedDays, which is what makes
   them round-trippable through Import below). The endpoint is key-gated
   (same auth-required route group as everything else), so — same reasoning
   NOTES.md documents for GET /image/verse — a bare link can't work; fetch
   with the key already in hand and hand the visitor the resulting blob,
   mirroring js/share.js's downloadShareImage(). ── */
function triggerBlobDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function downloadPlanRemote(format) {
  const plan = getPlans().find(p => p.id === plansOpenPlanId);
  if (!plan) return;
  const label = format === "ical" ? "iCal" : "PDF";
  try {
    const qs = planQueryString(plan.params, { format });
    const res = await apiFetch(`${API_BASE}/bibles/${plan.versionCode}/reading-plan?${qs}`);
    if (!res.ok) { toast(`Could not download the ${label}`); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.mode}-reading-plan.${format === "ical" ? "ics" : "pdf"}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { toast(`Could not download the ${label}`); }
}
function planExportObject(plan) {
  const { id, active, ...rest } = plan;
  return rest;
}
function downloadPlanJSON() {
  const plan = getPlans().find(p => p.id === plansOpenPlanId);
  if (!plan) return;
  triggerBlobDownload(JSON.stringify(planExportObject(plan), null, 2), `${plan.mode}-reading-plan.json`, "application/json");
}
// Share a plan with someone so they can follow it too. There's no backend
// to host a shareable link, so the share carries the plan's own JSON export
// as a file (the recipient re-creates it with Reading Plans → Import Plan)
// plus a plain-text summary. Falls through file-share → text-share →
// clipboard: desktop browsers mostly reject file shares (and .json isn't an
// allowed share type in Chrome), and some have no navigator.share at all,
// so each rung that isn't a real user-cancel drops to the next.
function planShareSummary(plan) {
  const total = (plan.days || []).length;
  const done = (plan.completedDays || []).length;
  const start = plan.planInfo && plan.planInfo.start_date;
  const end = plan.planInfo && plan.planInfo.end_date;
  const range = [start, end].filter(Boolean).map(formatShortDate).join(" – ");
  const pctLine = total && done ? `, ${Math.round((done / total) * 100)}% complete` : "";
  return `${plan.name} — a ${planModeLabel(plan.mode)} on IQ Bible\n`
    + `${total} day${total === 1 ? "" : "s"}${range ? ` (${range})` : ""}${pctLine}\n\n`
    + `Follow along: open https://app.iqbible.com and use Reading Plans → Import Plan with the attached file.`;
}
const isShareCancel = e => e && e.name === "AbortError";
async function sharePlan() {
  const plan = getPlans().find(p => p.id === plansOpenPlanId);
  if (!plan) return;
  const summary = planShareSummary(plan);
  const json = JSON.stringify(planExportObject(plan), null, 2);
  const file = new File([json], `${plan.mode}-reading-plan.json`, { type: "application/json" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: plan.name, text: summary });
      return;
    } catch (e) {
      if (isShareCancel(e)) return; // visitor dismissed the sheet
      // desktop OSes routinely can't take a file share — fall through to text
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: plan.name, text: summary });
      return;
    } catch (e) {
      if (isShareCancel(e)) return;
      // fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(summary);
    toast("Plan summary copied — use Download JSON to send the file");
  } catch (e) {
    toast("Sharing isn't supported here — use Download JSON to send the plan");
  }
}
function csvEscape(v) { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function downloadPlanCSV() {
  const plan = getPlans().find(p => p.id === plansOpenPlanId);
  if (!plan) return;
  const completed = new Set(plan.completedDays || []);
  let header, rows = [];
  if (plan.mode === "mcheyne") {
    header = ["day", "date", "track", "book", "chapter", "completed"];
    plan.days.forEach(d => {
      (d.family || []).forEach(r => rows.push([d.day, d.date, "family", r.book, r.chapter, completed.has(d.day)]));
      (d.secret || []).forEach(r => rows.push([d.day, d.date, "secret", r.book, r.chapter, completed.has(d.day)]));
    });
  } else if (plan.mode === "topic") {
    header = ["day", "date", "book", "chapter", "verse", "completed"];
    plan.days.forEach(d => (d.verses || []).forEach(r => rows.push([d.day, d.date, r.book, r.chapter, r.verse, completed.has(d.day)])));
  } else {
    header = ["day", "date", "book", "chapter", "completed"];
    plan.days.forEach(d => (d.chapters || []).forEach(r => rows.push([d.day, d.date, r.book, r.chapter, completed.has(d.day)])));
  }
  const csv = [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\r\n");
  triggerBlobDownload(csv, `${plan.mode}-reading-plan.csv`, "text/csv");
}

/* ── import — round-trips this app's own JSON/CSV exports (above) only.
   A file that doesn't match either shape is rejected with a plain error
   rather than guessed at (heuristic column-guessing on a foreign file is
   the same kind of workaround CLAUDE.md's GOLDEN RULE rules out for API
   data — here it'd just be a foreign file format instead). ── */
function triggerPlanImport() { document.getElementById("planImportFile").click(); }
function parseImportedPlanJSON(text) {
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== "object") return null;
  if (!["general", "topic", "mcheyne"].includes(obj.mode)) return null;
  if (!Array.isArray(obj.days) || !obj.days.length) return null;
  if (!obj.params || !obj.planInfo || !obj.versionCode) return null;
  return {
    name: obj.name || defaultPlanName(obj.mode, obj.params, obj.planInfo),
    mode: obj.mode, versionCode: obj.versionCode, versionTitle: obj.versionTitle || obj.versionCode,
    params: obj.params, planInfo: obj.planInfo, days: obj.days,
    completedDays: Array.isArray(obj.completedDays) ? obj.completedDays : [],
  };
}
function parseCSVLine(line) {
  const out = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
function parseImportedPlanCSV(text) {
  const lines = text.split(/\r\n|\n/).filter(l => l.trim().length);
  if (lines.length < 2) return null;
  const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const idx = name => header.indexOf(name);
  const dayIdx = idx("day"), dateIdx = idx("date"), bookIdx = idx("book"), chapterIdx = idx("chapter"), verseIdx = idx("verse"), trackIdx = idx("track"), completedIdx = idx("completed");
  if (dayIdx < 0 || dateIdx < 0 || bookIdx < 0 || chapterIdx < 0) return null;
  const mode = trackIdx >= 0 ? "mcheyne" : verseIdx >= 0 ? "topic" : "general";
  const byDay = {};
  const completedDays = new Set();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const day = Number(cols[dayIdx]);
    if (!day) continue;
    const ref = { book: cols[bookIdx], chapter: Number(cols[chapterIdx]) };
    if (verseIdx >= 0) ref.verse = Number(cols[verseIdx]);
    if (!byDay[day]) byDay[day] = { day, date: cols[dateIdx], chapters: [], verses: [], family: [], secret: [] };
    if (mode === "mcheyne") (cols[trackIdx] === "secret" ? byDay[day].secret : byDay[day].family).push(ref);
    else if (mode === "topic") byDay[day].verses.push(ref);
    else byDay[day].chapters.push(ref);
    if (completedIdx >= 0 && String(cols[completedIdx]).toLowerCase() === "true") completedDays.add(day);
  }
  const days = Object.values(byDay).sort((a, b) => a.day - b.day);
  if (!days.length) return null;
  const modeLabel = mode === "mcheyne" ? "M'Cheyne" : mode === "topic" ? "Topic" : "General";
  return {
    name: `Imported ${modeLabel} Plan`,
    mode, versionCode: current.version, versionTitle: current.versionTitle,
    // No generation params to recover from a CSV (it never carried them) —
    // planExportMenuHtml hides PDF/iCal for a plan with none, rather than
    // regenerating a different plan than the one that was imported.
    params: {}, planInfo: { start_date: days[0].date, end_date: days[days.length - 1].date },
    days, completedDays: [...completedDays],
  };
}
async function handlePlanImportFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const text = await file.text();
  let plan = null;
  try {
    if (file.name.toLowerCase().endsWith(".json")) plan = parseImportedPlanJSON(text);
    else if (file.name.toLowerCase().endsWith(".csv")) plan = parseImportedPlanCSV(text);
    else { toast("Choose a .json or .csv file exported from Reading Plans"); return; }
  } catch (e) { plan = null; }
  if (!plan) { toast("That file doesn't look like a reading plan exported from this app"); return; }
  const plans = getPlans();
  plans.forEach(p => { p.active = false; });
  plan.id = "plan_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  plan.active = true;
  plan.createdAt = Date.now();
  plans.push(plan);
  setPlans(plans);
  toast("Plan imported");
  plansOpenPlanId = plan.id;
  calendarCursor = null;
  plansViewState = "calendar";
  renderPlansView();
}

/* ── click delegation for .plan-ref links — the calendar-cell versions
   handle their own click inline (truncatedRefLinks), but chapterRefsHtml/
   verseRefsHtml (used by the day drawer) render plain data-book/data-
   chapter/data-verse anchors, same as before; #plansBody and #dayDrawerBody
   each need their own listener since the drawer lives outside #plansBody
   (it's a top-level .modalscrim, like every other detail popup). ── */
async function onPlanRefClick(e) {
  const ref = e.target.closest(".plan-ref");
  if (!ref) return;
  const book = ref.dataset.book, chapter = Number(ref.dataset.chapter), verse = ref.dataset.verse ? Number(ref.dataset.verse) : null;
  closePlans();
  closeDayDrawer();
  await jumpToVerse(book, chapter, verse);
}
document.getElementById("plansBody") && document.getElementById("plansBody").addEventListener("click", onPlanRefClick);
document.getElementById("dayDrawerBody") && document.getElementById("dayDrawerBody").addEventListener("click", onPlanRefClick);
// Outside-click closes the export/import overflow menu, same pattern as
// #profileWrap's listener (js/main.js) for #profilePanel.
document.addEventListener("click", e => {
  if (!planExportMenuOpen) return;
  if (e.target.closest(".plan-menu-wrap")) return;
  closePlanExportMenu();
});

/* ── reader hook: "did you read this chapter?" — loadChapter (reader.js)
   calls renderChapterReadPrompt() after every chapter render. Only the
   active plan (if any) is checked — a visitor can hold several plans, but
   only one at a time feeds this prompt. ── */
function findMatchingPlanDay(book, chapter) {
  const plan = getActivePlan();
  // Topic mode's days are verse-level (no single chapter they "cover"), so
  // there's no clean chapter-level match to offer there.
  if (!plan || (plan.mode !== "general" && plan.mode !== "mcheyne")) return null;
  const completed = new Set(plan.completedDays || []);
  for (const d of plan.days) {
    if (completed.has(d.day)) continue;
    const refs = plan.mode === "mcheyne" ? [...(d.family || []), ...(d.secret || [])] : (d.chapters || []);
    if (refs.some(r => r.book === book && r.chapter === chapter)) return d.day;
  }
  return null;
}
// Compact "you've read this" line below the chapter header (#chapterReadStamp
// in index.html — its own row, so it never resizes .chhead or the audio
// player). Shown only once the chapter's been read and only when the Settings
// toggle is on; the unread call-to-action stays #chapterReadPrompt's job at
// the foot of the text.
function formatReadStamp(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return "Read";
  const wd = d.toLocaleDateString("en-US", { weekday: "short" });
  const date = d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return `Read on ${wd}. ${date} at ${time}`;
}
function renderChapterReadStamp() {
  const el = document.getElementById("chapterReadStamp");
  if (!el) return;
  const ts = getReadStampEnabled() ? getProgress()[`${current.book}.${current.chapter}`] : null;
  if (!ts) { el.className = ""; el.innerHTML = ""; return; }
  const text = typeof ts === "number" ? formatReadStamp(ts) : "Read";
  el.className = "show";
  // A light-green check, clickable to undo the read mark (there's no
  // bottom "Undo" while the stamp is showing — see renderChapterReadPrompt).
  el.innerHTML = `<button type="button" class="read-check" onclick="unmarkChapterRead()" title="Mark chapter unread" aria-label="Mark chapter unread"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l4 4 8-9.5"/></svg></button>`
    + `<span class="read-label">${escHtml(text)}</span>`;
}
function renderChapterReadPrompt() {
  renderChapterReadStamp();
  const el = document.getElementById("chapterReadPrompt");
  if (!el) return;
  const key = `${current.book}.${current.chapter}`;
  if (getProgress()[key]) {
    // When the read-status line is on, it owns the "you've read this" state
    // (with its own undo) and this bottom box is only the unread nudge. With
    // it switched off in Settings, fall back to the original inline
    // confirmation + Undo here so there's still a way to unmark.
    if (getReadStampEnabled()) { el.className = ""; el.innerHTML = ""; return; }
    el.className = "show done";
    el.innerHTML = `<p>&#10003; Marked as read</p><button class="vt-note-delete" onclick="unmarkChapterRead()">Undo</button>`;
    return;
  }
  const dayMatch = findMatchingPlanDay(current.book, current.chapter);
  const text = dayMatch != null
    ? "Did you read this chapter? We'll count it toward your reading plan and add it to your Progress."
    : "Did you read this chapter? We'll add it to your Progress.";
  el.className = "show";
  el.innerHTML = `<p>${escHtml(text)}</p><button class="setsave" onclick="markChapterRead()">Yes, mark as read</button>`;
}
// Every chapter a given plan day schedules (Family + Secret merged for
// M'Cheyne). Topic mode's verse-level days never reach here.
function planDayChapterRefs(plan, dayObj) {
  return plan.mode === "mcheyne"
    ? [...(dayObj.family || []), ...(dayObj.secret || [])]
    : (dayObj.chapters || []);
}
// A day only auto-completes once *every* chapter it lists has been
// confirmed read — marking one chapter of a multi-chapter day (or one
// that isn't the last) must not check the whole day off.
function planDayFullyRead(plan, dayObj) {
  const progress = getProgress();
  const refs = planDayChapterRefs(plan, dayObj);
  return refs.length > 0 && refs.every(r => progress[`${r.book}.${r.chapter}`]);
}
function markChapterRead() {
  const key = `${current.book}.${current.chapter}`;
  const progress = getProgress();
  progress[key] = Date.now();
  setProgress(progress);
  const dayMatch = findMatchingPlanDay(current.book, current.chapter);
  if (dayMatch != null) {
    const plan = getActivePlan();
    const dayObj = plan.days.find(d => d.day === dayMatch);
    if (dayObj && planDayFullyRead(plan, dayObj)) {
      const completed = plan.completedDays || [];
      if (!completed.includes(dayMatch)) completed.push(dayMatch);
      setPlanCompletedDays(plan.id, completed);
      toast(`Day ${dayMatch} marked complete!`);
    } else {
      const remaining = dayObj ? planDayChapterRefs(plan, dayObj).filter(r => !progress[`${r.book}.${r.chapter}`]).length : 0;
      toast(remaining ? `Checked off — ${remaining} more chapter${remaining === 1 ? "" : "s"} to finish Day ${dayMatch}` : "Added to your Progress");
    }
  } else {
    toast("Added to your Progress");
  }
  renderChapterReadPrompt();
}
function unmarkChapterRead() {
  const key = `${current.book}.${current.chapter}`;
  const progress = getProgress();
  delete progress[key];
  setProgress(progress);
  renderChapterReadPrompt();
}
