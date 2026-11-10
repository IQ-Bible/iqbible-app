/* ═══════════════════════════════════════════════════════════════════════
   CHAPTER QUIZ — an optional check-your-understanding quiz for the chapter
   being read. Entry points: the "Take a quiz" button beside "Yes, mark as
   read" at the foot of an unread chapter, and a "Quiz yourself" card under an
   already-read one (both rendered from renderChapterReadPrompt, js/plans.js).

   API: GET /quiz/coverage?book=GEN (one small call per book, gives each
   chapter's question count up front) and GET /books/{b}/chapters/{n}/quiz
   (count=10, a fresh random seed per attempt, hydrate=true for the verse text).
   Questions are English-only and follow the KJV's wording; a chapter can have
   as few as 1 question. Both stay visible rather than being papered over: the
   real count is labelled on the entry point and a non-English reader is told
   the questions are in English.

   Finishing a quiz at any score marks the chapter read (markChapterRead) —
   that is the only thing it feeds into the streak. Scores live in
   localStorage under iqb_quiz as { "GEN.1": { best, bestOf, attempts, last } }
   and surface in the chapter's "Read on…" line and in My Progress.

   Used by two pages: the reader (the defaults in quizHost below) and Scroll the
   Bible (/scroll/, which loads this file but none of the reader and overrides
   quizHost in js/scroll.js — it has no chapter-end nav, and marks the chapter
   read through the DOM-free core in js/readstate.js rather than markChapterRead). */
const QUIZ_MAX = 10;
const QUIZ_KEY = "iqb_quiz";
const QUIZ_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`;
const QUIZ_CHECK_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>`;
const QUIZ_CROSS_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const QUIZ_CHEVRON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`;

// Everything the quiz needs from the page around it. The defaults are the
// reader's; scroll.js replaces them.
const quizHost = {
  // Marks the chapter read; returns true if it wasn't already.
  markRead(q) {
    const was = !!getProgress()[`${q.book}.${q.chapter}`];
    // `quiet`: the results panel already says it, so skip the plain "Added to
    // your Progress" toast ("Day N complete!" stays).
    markChapterRead({ book: q.book, chapter: q.chapter, quiet: true });
    if (q.book === current.book && q.chapter === current.chapter) renderChapterReadPrompt(); // markChapterRead returns early if it was already read
    return !was;
  },
  coverageLoaded(book) { if (current.book === book) renderChapterReadPrompt(); }, // repaint the entry point now that the count is known
  // Label for the results screen's "Next" button, "" for none (a plain Done).
  // Only while the reader is still on the quizzed chapter.
  nextLabel(q) {
    if (q.book !== current.book || q.chapter !== current.chapter) return "";
    const btn = quizEl("cenNext"), lbl = quizEl("cenNextLabel");
    return btn && !btn.disabled && lbl ? lbl.textContent.trim() : "";
  },
  goNext() { goAdjacentChapter(1); },
  scoresChanged() {},
  focusAfterClose: "#chapterQuizCard .quiz-btn, #chapterReadPrompt .quiz-btn",
};

/* ── stored scores ── */
function getQuizData() { try { return JSON.parse(localStorage.getItem(QUIZ_KEY) || "{}"); } catch (e) { return {}; } }
function setQuizData(m) { localStorage.setItem(QUIZ_KEY, JSON.stringify(m)); }
function quizBestFor(book, chapter) {
  const r = getQuizData()[`${book}.${chapter}`];
  return r && r.attempts && r.bestOf ? r : null;
}
// "8/10" for the "Read on…" line (renderChapterReadStamp, js/plans.js), or "".
function quizBestLabel(book, chapter) {
  const r = quizBestFor(book, chapter);
  return r ? `${r.best}/${r.bestOf}` : "";
}
function quizStats() {
  const recs = Object.values(getQuizData()).filter(r => r && r.attempts && r.bestOf);
  const avgPct = recs.length ? Math.round(100 * recs.reduce((s, r) => s + r.best / r.bestOf, 0) / recs.length) : null;
  return { taken: recs.length, avgPct };
}
// One My Progress activity entry per quizzed chapter: its best score, how many
// tries it took, stamped with the most recent attempt.
function quizActivityEntries() {
  return Object.entries(getQuizData())
    .filter(([, r]) => r && r.attempts && r.bestOf)
    .map(([key, r]) => {
      const dot = key.indexOf(".");
      return { ts: r.last || 0, type: "quiz", book: key.slice(0, dot), chapter: key.slice(dot + 1), best: r.best, of: r.bestOf, attempts: r.attempts };
    });
}

/* ── coverage: how many questions each chapter has ── */
const quizCoverage = {}; // book -> { chapter: questionCount }, filled once its call lands
const quizCoveragePending = {};
// Resolves to the book's { chapter: count } map, or null if the call failed —
// never rejects, and a failure isn't remembered (the next ask tries again).
function ensureQuizCoverage(book) {
  if (quizCoverage[book]) return Promise.resolve(quizCoverage[book]);
  if (quizCoveragePending[book]) return quizCoveragePending[book];
  return quizCoveragePending[book] = apiJSONCached(`/quiz/coverage?book=${encodeURIComponent(book)}`).then(d => {
    const row = ((d && d.data) || []).find(b => b.book === book);
    const map = {};
    ((row && row.chapters) || []).forEach(c => { map[c.chapter] = c.questions; });
    quizCoverage[book] = map;
    return map;
  }).catch(() => null).finally(() => {
    delete quizCoveragePending[book];
  }).then(map => {
    if (map) quizHost.coverageLoaded(book); // no repaint on failure, or a failing call would loop
    return map;
  });
}
// null until the book's coverage is in (and when this chapter has no questions);
// the quiz is never offered on a guess.
function quizOffer(book = current.book, chapter = current.chapter) {
  const map = quizCoverage[book];
  if (!map) { ensureQuizCoverage(book); return null; }
  const total = map[chapter];
  return total > 0 ? { total, count: Math.min(QUIZ_MAX, total) } : null;
}
function quizCountText(o) {
  return o.total > o.count ? `${o.count} of ${o.total} questions` : `${o.total} question${o.total === 1 ? "" : "s"}`;
}
function quizEnglishNote(lang) {
  return lang && lang !== "en" ? "Questions are in English" : "";
}

/* ── entry points on the chapter page ── */
// The "Take a quiz" half of the unread prompt (plans.js composes it beside
// "Yes, mark as read"); null when this chapter has nothing to offer.
function quizPromptParts() {
  const o = quizOffer();
  if (!o) return null;
  const bits = [`${quizCountText(o)} on ${current.bookName} ${current.chapter}`, "finishing the quiz also marks it read"];
  const en = quizEnglishNote(current.lang);
  if (en) bits.push(en);
  return {
    buttonHtml: `<button type="button" class="quiz-btn" onclick="startQuiz()">${QUIZ_ICON}Take a quiz</button>`,
    noteHtml: `<div class="quiz-prompt-note">${escHtml(bits.join(" · "))}</div>`,
  };
}
// The "Quiz yourself" card under a chapter that's already read.
function renderChapterQuizCard() {
  const el = document.getElementById("chapterQuizCard");
  if (!el) return;
  const read = !!getProgress()[`${current.book}.${current.chapter}`];
  const o = read ? quizOffer() : null;
  if (!o) { el.className = ""; el.innerHTML = ""; return; }
  const rec = quizBestFor(current.book, current.chapter);
  const bits = [o.total > o.count ? `${o.count} of ${o.total} questions, a different mix each time` : quizCountText(o)];
  if (rec) bits.push(`your best is ${rec.best}/${rec.bestOf}`);
  const en = quizEnglishNote(current.lang);
  if (en) bits.push(en);
  el.className = "show";
  el.innerHTML = `<span class="quiz-card-icon" aria-hidden="true">${QUIZ_ICON}</span>`
    + `<div class="quiz-card-text"><span class="quiz-card-title">Quiz yourself on ${escHtml(current.bookName)} ${current.chapter}</span><span class="quiz-card-sub">${escHtml(bits.join(" · "))}</span></div>`
    + `<button type="button" class="quiz-btn" onclick="startQuiz()">${rec ? "Retake quiz" : "Start quiz"}</button>`;
}

/* ── the quiz itself ── */
// Captured when the quiz opens (not read from `current` later) so a chapter
// change underneath it — continuous audio advancing, say — can't redirect the
// score or the read-mark to a different chapter.
let quiz = null;
let quizGen = 0; // bumped per load so a stale response can't overwrite a newer one
const quizEl = id => document.getElementById(id);
const cleanQuizVerse = t => (t || "").replace(/¶\s*/g, "").trim();

function startQuiz(book = current.book, chapter = current.chapter, bookName = current.bookName) {
  if (!quizOffer(book, chapter)) return;
  quiz = { book, bookName, chapter, version: current.version, lang: current.lang };
  openModal("quizScrim");
  loadQuizAttempt();
}
async function loadQuizAttempt() {
  const q = quiz;
  if (!q) return;
  const gen = ++quizGen;
  Object.assign(q, { items: [], total: 0, i: 0, answers: [], score: 0, phase: "loading", error: null });
  renderQuiz();
  try {
    // A fresh seed per attempt: without one the endpoint returns the same first
    // N every time. The chapter endpoint still returns them in verse order.
    const seed = 1 + Math.floor(Math.random() * 2147483646);
    const d = await apiJSON(`/books/${q.book}/chapters/${q.chapter}/quiz?count=${QUIZ_MAX}&seed=${seed}&hydrate=true&version=${encodeURIComponent(q.version)}`);
    if (gen !== quizGen) return;
    q.items = d.data || [];
    q.total = d.total || q.items.length;
    q.error = q.items.length ? null : "none";
  } catch (e) {
    if (gen !== quizGen) return;
    q.error = e.status === 404 ? "none" : "failed";
  }
  q.phase = q.error ? "error" : "question";
  renderQuiz();
}
function closeQuiz() {
  quizGen++;
  closeModal("quizScrim");
  // The button that opened the quiz was re-rendered by the finish (or still
  // exists); either way put focus somewhere sensible instead of on <body>.
  requestAnimationFrame(() => {
    if (document.activeElement && document.activeElement !== document.body) return;
    const b = document.querySelector(quizHost.focusAfterClose);
    if (b) b.focus({ preventScroll: true });
  });
}

function renderQuiz() {
  const q = quiz;
  if (!q) return;
  const body = quizEl("quizBody"), foot = quizEl("quizFoot");
  quizEl("quizTitle").textContent = q.phase === "results" ? `${q.bookName} ${q.chapter} · Results` : `${q.bookName} ${q.chapter}`;
  const asking = q.phase === "question";
  quizEl("quizProgress").hidden = !asking;
  quizEl("quizCount").textContent = asking ? `Question ${q.i + 1} of ${q.items.length}` : "";
  foot.className = "quiz-foot";
  if (q.phase === "loading") {
    body.innerHTML = `<div class="spin" role="status" aria-label="Loading quiz"></div>`;
    foot.innerHTML = "";
  } else if (q.phase === "error") {
    const msg = q.error === "none"
      ? `No quiz questions came back for ${q.bookName} ${q.chapter}.`
      : `Could not load the quiz for ${q.bookName} ${q.chapter}.`;
    body.innerHTML = `<div class="quiz-error" role="alert">${escHtml(msg)}</div>`;
    foot.innerHTML = q.error === "none"
      ? `<button type="button" class="quiz-btn primary" onclick="closeQuiz()">Close</button>`
      : `<button type="button" class="quiz-btn primary" onclick="loadQuizAttempt()">Try again</button>`;
  } else if (asking) {
    renderQuizQuestion();
  } else {
    renderQuizResults();
  }
}

function renderQuizQuestion() {
  const q = quiz, it = q.items[q.i], n = q.items.length;
  const tf = it.type === "true_false";
  const choices = (it.choices || []).map((c, i) =>
    `<button type="button" class="quiz-choice" onclick="answerQuiz(${i})"><span class="quiz-choice-mark" aria-hidden="true"></span><span class="quiz-choice-text">${escHtml(c.text)}</span><span class="quiz-choice-tag"></span></button>`
  ).join("");
  const en = quizEnglishNote(q.lang);
  quizEl("quizBody").innerHTML =
    (tf ? `<span class="quiz-type">True or false</span>` : "")
    + `<p class="quiz-question" id="quizQuestion" tabindex="-1">${escHtml(it.question)}</p>`
    + `<div class="quiz-choices${tf ? " tf" : ""}" id="quizChoices" role="group" aria-labelledby="quizQuestion">${choices}</div>`
    + `<div class="quiz-feedback" id="quizFeedback" role="status" aria-live="polite"></div>`
    + (en ? `<p class="quiz-note">${escHtml(en)}.</p>` : "");
  quizEl("quizBody").scrollTop = 0;
  quizEl("quizFoot").innerHTML =
    `<span class="quiz-summary" id="quizSummary"></span>`
    + `<button type="button" class="quiz-btn primary" id="quizNext" onclick="nextQuizQuestion()" disabled>${q.i === n - 1 ? "See results" : "Next question"}${q.i === n - 1 ? "" : QUIZ_CHEVRON_SVG}</button>`;
  setQuizProgress(false);
  try { quizEl("quizQuestion").focus({ preventScroll: true }); } catch (e) {}
}
function setQuizProgress(answeredThis) {
  const q = quiz, n = q.items.length;
  const done = q.i + (answeredThis ? 1 : 0);
  const bar = quizEl("quizProgress");
  bar.setAttribute("aria-valuemax", n);
  bar.setAttribute("aria-valuenow", done);
  bar.setAttribute("aria-valuetext", `${done} of ${n} answered`);
  quizEl("quizProgressFill").style.width = `${Math.round(100 * done / n)}%`;
  const answered = q.i + (answeredThis ? 1 : 0);
  quizEl("quizSummary").textContent = answered ? `${q.score} of ${answered} correct so far` : "";
}

// The question's citation as a hover/tap-previewable reference (the app-wide
// rule for any verse reference) — its verse text came with the question
// (hydrate=true), so no extra call.
function quizCitationHtml(it, inline) {
  const label = (it.citation || "").replace(/(\d)-(\d)/g, "$1–$2");
  if (!label) return "";
  const verses = (it.verses || []).map(v => cleanQuizVerse(v.text)).filter(Boolean);
  if (!verses.length) return escHtml(label);
  const preview = rangePreviewText(verses, verses.length);
  const html = citelinkHTML(label, it.citation, preview, registerCiteId(it.citation, preview));
  // `inline`: the verse is printed right beside this link (the wrong-answer
  // feedback), so its accessible name is just the reference — otherwise a
  // screen reader reads the verse once in the label and again as text.
  return inline ? html.replace(/aria-label="[^"]*"/, `aria-label="${escAttr(it.citation)}"`) : html;
}
function quizVersesHtml(it) {
  const vs = (it.verses || []).map(v => ({ n: v.verse, t: cleanQuizVerse(v.text) })).filter(v => v.t);
  if (!vs.length) return "";
  return `<p class="quiz-verse-text">${vs.map(v => `<span><sup>${v.n}</sup>${escHtml(v.t)}</span>`).join(" ")}</p>`;
}

function answerQuiz(i) {
  const q = quiz;
  if (!q || q.phase !== "question" || q.answers[q.i]) return;
  const it = q.items[q.i], choices = it.choices || [];
  const right = choices.findIndex(c => c.correct);
  const ok = i === right;
  q.answers[q.i] = { chosen: i, ok };
  if (ok) q.score++;

  quizEl("quizChoices").classList.add("answered");
  [...quizEl("quizChoices").children].forEach((b, bi) => {
    b.setAttribute("aria-disabled", "true");
    if (bi !== i) b.tabIndex = -1;
    const mark = b.querySelector(".quiz-choice-mark"), tag = b.querySelector(".quiz-choice-tag");
    if (bi === i) {
      b.classList.add(ok ? "right" : "wrong");
      mark.innerHTML = ok ? QUIZ_CHECK_SVG : QUIZ_CROSS_SVG;
      tag.textContent = ok ? "Correct" : "Your answer";
    } else if (bi === right) {
      b.classList.add("right");
      mark.innerHTML = QUIZ_CHECK_SVG;
      tag.textContent = "Correct";
    } else {
      b.classList.add("dim");
    }
  });

  // API gives `explanation` only on some questions; shown verbatim when it's
  // there, never invented.
  const expl = it.explanation ? `<p class="quiz-expl">${escHtml(it.explanation)}</p>` : "";
  quizEl("quizFeedback").innerHTML = ok
    ? `<div class="quiz-fb-box ok"><p class="quiz-fb-line">Correct!</p>${expl}</div>`
    : `<div class="quiz-fb-box"><p class="quiz-fb-line">Not quite. The answer is <strong>${escHtml(right >= 0 ? choices[right].text : "—")}</strong>. ${quizCitationHtml(it, true)}</p>${quizVersesHtml(it)}${expl}</div>`;

  quizEl("quizNext").disabled = false;
  setQuizProgress(true);
}
function nextQuizQuestion() {
  const q = quiz;
  if (!q || !q.answers[q.i]) return;
  if (q.i < q.items.length - 1) { q.i++; renderQuiz(); }
  else finishQuiz();
}

function finishQuiz() {
  const q = quiz, n = q.items.length, key = `${q.book}.${q.chapter}`;
  const data = getQuizData();
  const rec = data[key] && data[key].attempts ? data[key] : { attempts: 0 };
  rec.attempts++;
  rec.last = Date.now();
  if (!rec.bestOf || q.score / n > rec.best / rec.bestOf) { rec.best = q.score; rec.bestOf = n; }
  data[key] = rec;
  setQuizData(data);
  q.rec = rec;
  // Any score counts as having read it, on the pages that track reading.
  q.newlyRead = quizHost.markRead(q);
  quizHost.scoresChanged(q);
  q.phase = "results";
  renderQuiz();
}

function renderQuizResults() {
  const q = quiz, n = q.items.length, s = q.score, rec = q.rec;
  const ratio = s / n;
  const msg = s === n ? "Perfect score!" : ratio >= 0.7 ? "Well done!" : ratio >= 0.5 ? "Good effort!" : "Keep at it!";
  const tries = rec.attempts === 1 ? "First attempt" : `Attempt ${rec.attempts}`;
  const missed = q.items.map((it, i) => ({ it, a: q.answers[i] })).filter(x => x.a && !x.a.ok);
  const missedHtml = missed.length
    ? `<h3 class="quiz-sub">Review the ${missed.length} you missed</h3>` + missed.map(({ it, a }) => {
        const right = (it.choices || []).find(c => c.correct);
        return `<div class="quiz-missed"><span class="quiz-missed-q">${escHtml(it.question)}</span>`
          + `<span class="quiz-missed-a">You said <span class="quiz-said">${escHtml(it.choices[a.chosen].text)}</span> · Answer <span class="quiz-answer">${escHtml(right ? right.text : "—")}</span> · ${quizCitationHtml(it)}</span></div>`;
      }).join("")
    : `<p class="quiz-note">You got every question right.</p>`;
  const en = quizEnglishNote(q.lang);
  quizEl("quizBody").innerHTML =
    `<div class="quiz-score" id="quizScore" tabindex="-1">`
    + `<div class="quiz-score-num"><span class="quiz-score-big">${s}</span><span class="quiz-score-of">/ ${n}</span></div>`
    + `<div class="quiz-score-text"><span class="quiz-score-msg">${msg}</span>`
    + (q.newlyRead ? `<span class="quiz-score-line"><svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5l4 4 8-9.5"/></svg>${escHtml(q.bookName)} ${q.chapter} added to your Progress</span>` : "")
    + `<span class="quiz-score-meta">${tries} · best score ${rec.best}/${rec.bestOf}</span></div></div>`
    + missedHtml
    + (en ? `<p class="quiz-note">${escHtml(en)}.</p>` : "");
  quizEl("quizBody").scrollTop = 0;

  // Retake: only a chapter with more questions than one quiz holds gets a
  // different set; otherwise it's the same questions, so it says nothing more.
  const retakeSub = q.total > n ? `<span class="quiz-btn-sub">Different mix of ${q.total} questions</span>` : "";
  const nextLbl = quizHost.nextLabel(q);
  const foot = quizEl("quizFoot");
  foot.className = "quiz-foot two";
  foot.innerHTML = `<button type="button" class="quiz-btn retake" onclick="loadQuizAttempt()"><span>Retake</span>${retakeSub}</button>`
    + (nextLbl
      ? `<button type="button" class="quiz-btn primary" onclick="quizGoNext()">Next: ${escHtml(nextLbl)}${QUIZ_CHEVRON_SVG}</button>`
      : `<button type="button" class="quiz-btn primary" onclick="closeQuiz()">Done</button>`);
  try { quizEl("quizScore").focus({ preventScroll: true }); } catch (e) {}
}
function quizGoNext() {
  closeQuiz();
  quizHost.goNext();
}
