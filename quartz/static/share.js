// 뉴리의창고: 글 끝에 공유 줄(공유하기 · 링크 복사 · X · 페이스북 · RSS)을 붙인다.
// Quartz 는 페이지 이동을 SPA 로 처리하므로 "nav" 이벤트마다 다시 붙인다.
(() => {
  const ICON = {
    share:
      '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>',
    link:
      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    x: '<path d="M4 4l16 16"/><path d="M20 4L4 20"/>',
    facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    rss: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
  }
  const svg = (name) =>
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`

  const siteRoot = () => {
    const a = document.querySelector(".page-title a")
    return a ? new URL(a.getAttribute("href"), location.href).href : location.origin + "/"
  }

  async function copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const t = document.createElement("textarea")
      t.value = text
      document.body.appendChild(t)
      t.select()
      document.execCommand("copy")
      t.remove()
    }
    const label = btn.querySelector("span")
    const old = label.textContent
    btn.dataset.done = "true"
    btn.querySelector("svg").outerHTML = svg("check")
    label.textContent = "복사했어요"
    setTimeout(() => {
      btn.dataset.done = "false"
      btn.querySelector("svg").outerHTML = svg(btn.dataset.icon)
      label.textContent = old
    }, 1800)
  }

  function build() {
    document.querySelectorAll(".nyuri-share").forEach((el) => el.remove())
    if (document.body.dataset.slug === "index") return
    if (!document.querySelector("h1.article-title")) return
    const article = document.querySelector(".center > article")
    if (!article || !article.textContent.trim()) return // 본문 없는 뼈대 페이지엔 붙이지 않음

    const url = location.href.split("#")[0]
    const title = (document.querySelector("h1.article-title")?.textContent || document.title).trim()
    const enc = encodeURIComponent
    const rss = siteRoot() + "static/rss.html"

    const bar = document.createElement("aside")
    bar.className = "nyuri-share"
    bar.setAttribute("aria-label", "이 글 공유하기")
    bar.innerHTML = `
      <p class="nyuri-share-label">이 노트가 도움이 됐다면</p>
      <div class="nyuri-share-row">
        <button type="button" data-act="share" data-icon="share">${svg("share")}<span>공유하기</span></button>
        <button type="button" data-act="copy" data-icon="link">${svg("link")}<span>링크 복사</span></button>
        <a href="https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}" target="_blank" rel="noopener" data-router-ignore>${svg("x")}<span>X</span></a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${enc(url)}" target="_blank" rel="noopener" data-router-ignore>${svg("facebook")}<span>페이스북</span></a>
        <a href="${rss}" target="_blank" rel="noopener" data-router-ignore class="rss">${svg("rss")}<span>RSS 구독</span></a>
      </div>`
    article.after(bar)

    bar.querySelector('[data-act="copy"]').addEventListener("click", (e) => copy(url, e.currentTarget))
    const shareBtn = bar.querySelector('[data-act="share"]')
    shareBtn.addEventListener("click", async (e) => {
      if (navigator.share) {
        try {
          await navigator.share({ title, url })
        } catch {}
      } else {
        copy(url, e.currentTarget)
      }
    })
  }

  // 탐색기: 한 줄로 줄인 제목은 마우스를 올리면 전체 제목이 보이게
  // 비공개 프로젝트: 제목 끝 "(보안 이슈로 비공개)" 를 떼고 작은 표시로 바꾼다
  const PRIVATE = "(보안 이슈로 비공개)"
  const LOCK =
    '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  const splitPrivate = (t) => {
    t = (t || "").trim()
    return t.endsWith(PRIVATE) ? t.slice(0, -PRIVATE.length).trim() : null
  }
  const badge = (cls) => {
    const b = document.createElement("span")
    b.className = "nyuri-private" + (cls ? " " + cls : "")
    b.title = "보안 이슈로 비공개"
    b.innerHTML = `${LOCK}<span>비공개</span>`
    return b
  }
  function privateLabels() {
    // 탐색기 폴더: 이름은 한 줄(넘치면 말줄임), 표시는 늘 보이게 옆에
    document.querySelectorAll(".explorer .folder-title").forEach((el) => {
      const name = splitPrivate(el.textContent)
      if (name === null) return
      el.textContent = name
      el.parentElement.classList.add("has-private")
      el.parentElement.title = name + " (보안 이슈로 비공개)"
      // 메뉴는 폭이 좁아 자물쇠만 (글자는 툴팁과 스크린리더로)
      const b = badge("is-icon")
      b.setAttribute("aria-label", "보안 이슈로 비공개")
      b.querySelector("span").remove()
      el.after(b)
    })
    // 비공개 프로젝트 안의 페이지인지: 제목이나 상단 경로에 표시가 있으면 (바꾸기 전에 본다)
    const h1 = document.querySelector("h1.article-title")
    const crumbs = [...document.querySelectorAll(".breadcrumb-element a, .breadcrumb-element p")]
    if ((h1 && splitPrivate(h1.textContent) !== null) || crumbs.some((c) => splitPrivate(c.textContent) !== null))
      document.body.dataset.private = "1"

    // 페이지 제목: 이름만 남긴다 (상태는 아래 안내 화면이 알린다)
    const hName = h1 ? splitPrivate(h1.textContent) : null
    if (h1 && hName !== null) h1.textContent = hName
    // 상단 경로와 폴더 목록
    document.querySelectorAll(".breadcrumb-element a, .breadcrumb-element p, .page-listing a").forEach((a) => {
      const name = splitPrivate(a.textContent)
      if (name === null || a.children.length) return
      a.textContent = name
      if (a.closest(".page-listing")) a.after(badge("is-inline"))
    })
    if (document.body.dataset.private) mountLocked()
    mountLost()
    polishListing()
  }

  // 404: 기본 안내 대신 길 잃은 상자 뉴리와 처음으로 가는 버튼
  function mountLost() {
    if (document.body.dataset.slug !== "404" || document.querySelector(".nyuri-lost")) return
    const article = document.querySelector(".center article") || document.querySelector("article")
    if (!article) return
    const box = document.createElement("section")
    box.className = "nyuri-locked nyuri-lost"
    box.innerHTML = `
      <div class="nyuri-locked-art" aria-hidden="true"><img src="${siteRoot()}static/nyuri.svg" alt=""></div>
      <h2 class="nyuri-locked-title">찾는 페이지가 없어요</h2>
      <p class="nyuri-locked-sub">주소가 바뀌었거나 지워진 글이에요.</p>
      <a class="nyuri-lost-home" href="${siteRoot()}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>뉴리의창고 처음으로</a>`
    article.querySelectorAll(":scope > :not(script)").forEach((e) => e.remove())
    article.append(box)
  }

  // 비공개 안내 화면: 잠긴 상자 뉴리 + 한 줄 설명. 본문 자리에 놓는다
  function mountLocked() {
    if (document.querySelector(".nyuri-locked")) return
    const article = document.querySelector(".center article")
    if (!article) return
    const box = document.createElement("section")
    box.className = "nyuri-locked"
    box.setAttribute("aria-label", "보안 이슈로 비공개")
    box.innerHTML = `
      <div class="nyuri-locked-art" aria-hidden="true">
        <img src="${siteRoot()}static/nyuri.svg" alt="">
        <span class="nyuri-locked-lock"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span>
      </div>
      <h2 class="nyuri-locked-title">보안 이슈로 비공개</h2>
      <p class="nyuri-locked-sub">공개 전 연구 결과라 잠시 닫아 두었어요.</p>`
    const listing = document.querySelector(".center .page-listing")
    if (listing) {
      // 항목이 하나도 없는 폴더는 "0건" 목록 대신 안내만
      if (!listing.querySelector("li")) listing.classList.add("is-empty")
      listing.before(box)
    } else article.after(box)
  }

  // 폴더 목록: 날짜는 한 줄(2026.11.06), 폴더와 글을 아이콘으로 구분
  const ICON_FOLDER =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'
  const ICON_NOTE =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>'
  function polishListing() {
    document.querySelectorAll(".page-listing .section-li > .section").forEach((sec) => {
      if (sec.dataset.polished) return
      sec.dataset.polished = "1"
      const t = sec.querySelector("time")
      if (t?.getAttribute("datetime")) {
        const d = new Date(t.getAttribute("datetime"))
        if (!isNaN(d)) t.textContent = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
      }
      const a = sec.querySelector(".desc h3 a")
      if (!a) return
      const isFolder = /\/$/.test(a.getAttribute("href") || "")
      sec.classList.add(isFolder ? "is-folder" : "is-note")
      const ic = document.createElement("span")
      ic.className = "nyuri-row-icon"
      ic.innerHTML = isFolder ? ICON_FOLDER : ICON_NOTE
      a.before(ic)
    })
  }

  function titleExplorer() {
    privateLabels()
    document.querySelectorAll(".explorer a.nav-file-title").forEach((a) => {
      if (!a.title) a.title = a.textContent.trim()
    })
  }
  // 탐색기는 Quartz 가 나중에(또는 다시) 그리므로, 페이지 변화를 지켜보다가 붙인다
  let titleTimer = 0
  const explorerTitles = () => {
    if (titleTimer) return
    titleTimer = setTimeout(() => {
      titleTimer = 0
      titleExplorer()
    }, 60)
  }
  new MutationObserver(explorerTitles).observe(document.documentElement, { childList: true, subtree: true })

  // 마인드맵 뷰어 링크는 언제나 새 창으로
  const viewerLinksNewTab = () =>
    document.querySelectorAll('a[href*="static/viewer.html"]').forEach((a) => {
      a.target = "_blank"
      a.rel = "noopener"
      a.setAttribute("data-router-ignore", "")
    })
  document.addEventListener("nav", viewerLinksNewTab)
  document.addEventListener("nav", explorerTitles)
  document.addEventListener("nav", build)
  if (document.readyState !== "loading") {
    build()
    explorerTitles()
  } else
    document.addEventListener("DOMContentLoaded", () => {
      build()
      explorerTitles()
    })
})()
