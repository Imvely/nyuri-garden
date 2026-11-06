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
    // 페이지 제목: 이름만 남기고 아래에 상태 한 줄
    const h1 = document.querySelector("h1.article-title")
    const hName = h1 ? splitPrivate(h1.textContent) : null
    if (h1 && hName !== null) {
      h1.textContent = hName
      if (!h1.nextElementSibling?.classList.contains("nyuri-private-note")) {
        const note = document.createElement("p")
        note.className = "nyuri-private-note"
        note.innerHTML = `${LOCK}<span>보안 이슈로 비공개</span>`
        h1.after(note)
      }
    }
    // 상단 경로와 폴더 목록
    document.querySelectorAll(".breadcrumb-element a, .breadcrumb-element p, .page-listing a").forEach((a) => {
      const name = splitPrivate(a.textContent)
      if (name === null || a.children.length) return
      a.textContent = name
      if (a.closest(".page-listing")) a.after(badge("is-inline"))
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
