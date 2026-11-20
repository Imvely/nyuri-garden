// 연재 글 제목 맨 앞의 "7편" 을 작은 표지로 바꿔 그린다 (글 제목, 탐색기, 목록, 관련 글)
// 제목 글자 자체는 "7편 Batch Normalization: ..." 그대로라 검색과 공유에는 영향이 없다
;(() => {
  if (window.__nyuriEpisode) return
  window.__nyuriEpisode = true
  const SEL = "h1.article-title, .explorer a.nav-file-title, .nyuri-list h3 a, .nyuri-related-title, .backlinks li a, article .markdown-rendered > ul > li > a"
  const RE = /^(\d{1,3}편)\s+/
  function mark(el) {
    if (el.dataset.ep) return
    const node = el.firstChild
    if (!node || node.nodeType !== 3) return
    const m = RE.exec(node.nodeValue)
    if (!m) return
    el.dataset.ep = "1"
    const badge = document.createElement("span")
    badge.className = "nyuri-ep"
    badge.textContent = m[1]
    node.nodeValue = node.nodeValue.slice(m[0].length)
    el.insertBefore(badge, node)
    el.insertBefore(document.createTextNode(" "), node)
  }
  let queued = false
  function run() {
    queued = false
    document.querySelectorAll(SEL).forEach(mark)
  }
  function schedule() {
    if (queued) return
    queued = true
    requestAnimationFrame(run)
  }
  document.addEventListener("nav", schedule)
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true })
  schedule()
})()
