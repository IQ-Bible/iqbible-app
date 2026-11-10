/* ═══════════════════════════════════════════════════════════════════════
   READ STATE — the DOM-free core of "this chapter has been read": the
   iqb_progress map (every chapter ever confirmed read, global across plans
   and plain unplanned reading), the stored reading plans, and the one
   operation that ties them together, recordChapterRead(). Shared by the
   reader (markChapterRead in js/plans.js adds the toasts and the chapter-end
   prompt on top) and Scroll the Bible (/scroll/), which loads this file but
   none of plans.js. Nothing here touches the page.

   iqb_plans is a list of plans, each independently completable/deletable, at
   most one active at a time (zero is a valid state: no plan feeds the
   reader's chapter-end prompt). */
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
// "Read on Mon. 11/09/2026 at 3:12 pm" — the line under a chapter's heading in the
// reader and on a chapter's title card in Scroll. ts is the iqb_progress timestamp.
function formatReadStamp(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return "Read";
  const wd = d.toLocaleDateString("en-US", { weekday: "short" });
  const date = d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return `Read on ${wd}. ${date} at ${time}`;
}
// Marks a chapter read and completes the active plan's day if that was its
// last unread chapter. Returns null if the chapter was already read, else
// { dayMatch, dayComplete, remaining }: the plan day it counted toward (or
// null), whether that finished the day, and how many of the day's chapters are
// still unread — for the caller to turn into whatever feedback suits its page.
function recordChapterRead(book, chapter) {
  const key = `${book}.${chapter}`;
  const progress = getProgress();
  if (progress[key]) return null;
  progress[key] = Date.now();
  setProgress(progress);
  const dayMatch = findMatchingPlanDay(book, chapter);
  const result = { dayMatch, dayComplete: false, remaining: 0 };
  if (dayMatch == null) return result;
  const plan = getActivePlan();
  const dayObj = plan.days.find(d => d.day === dayMatch);
  if (dayObj && planDayFullyRead(plan, dayObj)) {
    const completed = plan.completedDays || [];
    if (!completed.includes(dayMatch)) completed.push(dayMatch);
    setPlanCompletedDays(plan.id, completed);
    result.dayComplete = true;
  } else if (dayObj) {
    result.remaining = planDayChapterRefs(plan, dayObj).filter(r => !progress[`${r.book}.${r.chapter}`]).length;
  }
  return result;
}
