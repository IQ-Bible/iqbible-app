/* ═══════════════════════════════════════════════════════════════════════
   SHARE TOOLS — GET /embed/verse and GET /image/verse, both deliberately
   public/unauthenticated endpoints (registered outside the API-key-gated
   route group), so previews work with zero setup friction. Defaults to the
   current reading position (and the first selected verse, if Verse Tools
   has an active selection). */
let shareToolRef = { book: null, chapter: 1, verse: 1 };
let shareToolTheme = "light";
function openShareTool() {
  shareToolRef = {
    book: current.book,
    chapter: current.chapter,
    verse: selectedVerses.length ? selectedVerses[0] : 1,
  };
  shareToolTheme = getTheme() === "dark" ? "dark" : "light";
  renderShareTool();
  switchMainView("share");
}
function shareToolRefString() {
  return `${shareToolRef.book}.${shareToolRef.chapter}.${shareToolRef.verse}`;
}
// API_PUBLIC_BASE, not API_BASE: these endpoints are unauthenticated and the
// URLs get copied out / embedded on other sites, so they point straight at
// the API even on the hosted instance (whose API_BASE is a same-origin proxy
// path that only makes sense from within this app).
function shareImageURL() {
  return `${API_PUBLIC_BASE}/image/verse?ref=${encodeURIComponent(shareToolRefString())}&version=${encodeURIComponent(current.version)}&style=${shareToolTheme}&format=png`;
}
function shareEmbedSrc() {
  return `${API_PUBLIC_BASE}/embed/verse?ref=${encodeURIComponent(shareToolRefString())}&version=${encodeURIComponent(current.version)}&theme=${shareToolTheme}`;
}
function renderShareTool() {
  const body = document.getElementById("shareToolBody");
  const books = bookList.length ? bookList : [{ usfm: shareToolRef.book, name: current.bookName }];
  const embedCode = `<iframe src="${shareEmbedSrc()}" width="600" height="315" frameborder="0"></iframe>`;
  body.innerHTML = `
    <div class="share-fields">
      <select id="shareBookSelect" onchange="onShareFieldChange()">
        ${books.map(b => `<option value="${escAttr(b.usfm)}"${b.usfm === shareToolRef.book ? " selected" : ""}>${escHtml(b.name)}</option>`).join("")}
      </select>
      <input type="number" id="shareChapterInput" min="1" value="${shareToolRef.chapter}" onchange="onShareFieldChange()">
      <input type="number" id="shareVerseInput" min="1" value="${shareToolRef.verse}" onchange="onShareFieldChange()">
      <button class="filter-chip${shareToolTheme === "light" ? " active" : ""}" onclick="setShareTheme('light')">Light</button>
      <button class="filter-chip${shareToolTheme === "dark" ? " active" : ""}" onclick="setShareTheme('dark')">Dark</button>
    </div>
    <img class="share-preview" id="sharePreviewImg" src="${shareImageURL()}" alt="Verse image preview" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'dd-empty',textContent:'Could not render a preview for this reference.'}))">
    <div class="share-actions">
      <a href="${shareImageURL()}" target="_blank" rel="noopener">Open Full Image ↗</a>
      <button onclick="downloadShareImage()">Download</button>
      <button onclick="copyShareLink()">Copy Image Link</button>
      <button onclick="copyShareEmbed()">Copy Embed Code</button>
    </div>
    <div class="share-embed-code">${escHtml(embedCode)}</div>
    <iframe class="share-embed-frame" src="${shareEmbedSrc()}" title="Verse embed preview"></iframe>`;
}
function onShareFieldChange() {
  shareToolRef.book = document.getElementById("shareBookSelect").value;
  shareToolRef.chapter = parseInt(document.getElementById("shareChapterInput").value, 10) || 1;
  shareToolRef.verse = parseInt(document.getElementById("shareVerseInput").value, 10) || 1;
  renderShareTool();
}
function setShareTheme(t) { shareToolTheme = t; renderShareTool(); }
function copyShareLink() {
  navigator.clipboard.writeText(shareImageURL()).then(() => toast("Image link copied"), () => toast("Could not copy"));
}
function copyShareEmbed() {
  const code = `<iframe src="${shareEmbedSrc()}" width="600" height="315" frameborder="0"></iframe>`;
  navigator.clipboard.writeText(code).then(() => toast("Embed code copied"), () => toast("Could not copy"));
}
// GET /image/verse is public/unauthenticated (see the header comment above),
// so a plain fetch works with no key — but a cross-origin <a download> is
// silently ignored by the browser (it only honors `download` same-origin),
// which is why this fetches the image itself and downloads a same-origin
// blob: URL instead, rather than linking straight at api.iqbible.com.
async function downloadShareImage() {
  try {
    const res = await fetch(shareImageURL());
    if (!res.ok) throw new Error("bad response");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${shareToolRefString().replace(/\./g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { toast("Could not download image"); }
}
