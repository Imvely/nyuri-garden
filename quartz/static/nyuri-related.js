// 글 페이지의 백링크 칸을 두 칸으로 바꿔 그린다: '이 글을 언급한 글'과 '다음에 읽을 글'
// - 데이터는 scripts/postbuild.py 가 만드는 static/nyuri-related.json (공개 글만). 없는 글(비공개, 카테고리 첫 화면)은 원래 칸을 그대로 둔다
// - 점수: 빌드 때 계산한 기본 점수 + 인기(좋아요, 댓글, 상한 8). 같은 주제는 2개까지, 다른 분야 글이 있으면 한 자리
// - 클릭은 방문 분석(related_click)에 몇 번째, 어떤 이유였는지 남긴다
// 기획: 볼트 00 수신함/reports/블로그 백링크와 관련 글 노출 기획.md
;(() => {
  if (window.__nyuriRelated) return
  window.__nyuriRelated = true

  const SHOW = 4
  const PER_PILLAR = 2
  const REASON_TEXT = {
    mention: "이 글을 언급",
    series: "같은 시리즈",
    pillar: "같은 주제",
    tags: "비슷한 태그",
    hub: "모아 보는 글",
    popular: "많이 읽은 글",
    cross: "다른 분야",
    fresh: "새 글",
  }
  // 이유 문구 고르는 순서: 관계가 분명한 것부터
  const REASON_ORDER = ["mention", "series", "pillar", "tags", "hub", "popular", "cross", "fresh"]

  let dataPromise = null
  const siteRoot = () => {
    const a = document.querySelector("a.page-title, .page-title a")
    return a ? new URL(a.getAttribute("href"), location.href).href : new URL("./", location.href).href
  }
  const load = () => {
    if (!dataPromise)
      dataPromise = fetch(new URL("static/nyuri-related.json", siteRoot()))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    return dataPromise
  }

  const shortTitle = (t) => {
    const k = t.indexOf(":")
    return k > 0 ? t.slice(0, k).trim() : t
  }
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue
      if (k === "class") n.className = v
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v)
      else n.setAttribute(k, v)
    }
    for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(String(k)))
    return n
  }

  function reasonOf(why) {
    // 신선도와 다른 분야는 늘 붙으므로, 다른 이유가 없을 때만 문구로 쓴다
    const strong = REASON_ORDER.filter((r) => why[r] && !(r === "fresh" && why[r] < 9))
    return strong[0] || "tags"
  }

  function pick(rel, posts, countsBy) {
    const scored = rel.cands.map((c) => {
      const why = { ...c.why }
      const n = countsBy && countsBy[c.slug]
      if (n) {
        const pop = Math.min(8, 3 * Math.log1p(n.likes || 0) + 2 * Math.log1p(n.comments || 0))
        if (pop >= 2) why.popular = Math.round(pop * 10) / 10
      }
      const score = c.base + (why.popular || 0)
      return { ...c, why, score, pillar: posts[c.slug]?.pillar, cat: posts[c.slug]?.cat }
    })
    scored.sort((a, b) => b.score - a.score)
    const out = []
    const perPillar = {}
    for (const c of scored) {
      if (out.length >= SHOW) break
      if ((perPillar[c.pillar] || 0) >= PER_PILLAR && c.pillar !== "other") continue
      if (c.cat !== rel.cat && out.some((o) => o.cat !== rel.cat)) continue // 다른 분야는 한 자리만
      perPillar[c.pillar] = (perPillar[c.pillar] || 0) + 1
      out.push(c)
    }
    // 다른 분야 글이 후보에 있는데 하나도 안 뽑혔으면 마지막 자리를 그 글로
    if (!out.some((c) => c.cat !== rel.cat)) {
      const cross = scored.find((c) => c.cat !== rel.cat && !out.includes(c))
      if (cross) {
        if (out.length >= SHOW) out.pop()
        out.push(cross)
      }
    }
    return out
  }

  function item(slug, posts, base, reason, pos) {
    const p = posts[slug]
    const href = new URL(slug, base).pathname
    return el(
      "li",
      {},
      el(
        "a",
        {
          href,
          class: "internal nyuri-related-link",
          onclick: () => window.NYURI_TRACK && window.NYURI_TRACK("related_click", { target: slug, position: pos, reason }),
        },
        el("span", { class: "nyuri-related-title" }, shortTitle(p.title)),
        el(
          "span",
          { class: "nyuri-related-meta" },
          el("span", { class: "nyuri-related-reason" }, REASON_TEXT[reason] || ""),
          p.minutes ? el("span", { class: "nyuri-related-min" }, `${p.minutes}분 읽기`) : null,
        ),
      ),
    )
  }

  function render(box, data, slug, countsBy) {
    const rel = data.related[slug]
    const base = siteRoot()
    const chosen = pick(rel, data.posts, countsBy)
    const parts = []
    if (rel.mentions.length) {
      parts.push(
        el("h3", {}, "이 글을 언급한 글"),
        el("ul", { class: "nyuri-related-list" }, rel.mentions.map((s, i) => item(s, data.posts, base, "mention", i + 1))),
      )
    }
    if (chosen.length) {
      parts.push(
        el("h3", {}, "다음에 읽을 글"),
        el("ul", { class: "nyuri-related-list" }, chosen.map((c, i) => item(c.slug, data.posts, base, reasonOf(c.why), i + 1))),
      )
    }
    if (!parts.length) return
    box.classList.add("nyuri-related")
    box.replaceChildren(...parts)
  }

  async function mount() {
    const slug = document.body.dataset.slug || ""
    const box = document.querySelector(".backlinks")
    if (!box || !slug) return
    const data = await load()
    if (!data || !data.related[slug] || document.body.dataset.slug !== slug || !box.isConnected) return
    render(box, data, slug, null)
    // 인기 점수: 카테고리 목록과 같은 캐시와 한꺼번에 받기 (nyuri-list.js 의 NYURI_COUNTS)
    const C = window.NYURI_COUNTS
    if (!C) return
    const cands = data.related[slug].cands.map((c) => c.slug)
    const known = {}
    const todo = []
    for (const s of cands) {
      const c = C.readCount(s)
      c ? (known[s] = c) : todo.push(s)
    }
    const fetched = todo.length ? await C.fetchMany(todo) : {}
    const countsBy = { ...known, ...(fetched || {}) }
    if (document.body.dataset.slug === slug && box.isConnected && Object.keys(countsBy).length) render(box, data, slug, countsBy)
  }
  document.addEventListener("nav", mount)
  if (document.readyState !== "loading") mount()
  else document.addEventListener("DOMContentLoaded", mount)
})()
