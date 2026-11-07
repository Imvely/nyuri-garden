// 공개 카테고리 첫 화면(IT 트렌드, 논문 노트)의 글 목록
// - 정렬(최신순, 오래된순, 제목순), 이 카테고리 안에서 찾기, 태그로 거르기, 페이지 나누기
// - 상태는 주소(?q=&tag=&sort=&page=)에 남아서 공유와 뒤로 가기가 된다
// - 데이터는 scripts/postbuild.py 가 만드는 static/nyuri-list.json. 비공개 폴더는 그 파일에 없어서 여기서도 손대지 않는다
// - 스크립트가 없으면 원래 목록(최신순)이 그대로 보인다
;(() => {
  if (window.__nyuriList) return
  window.__nyuriList = true

  const PER_PAGE = 8
  const SORTS = [
    ["new", "최신순"],
    ["popular", "인기순"],
    ["old", "오래된순"],
    ["title", "제목순"],
  ]
  const NEW_DAYS = 3 // 이 날수 안에 올린 글은 '새 글'
  let dataPromise = null

  // ── 좋아요, 댓글 수: 글마다 쓰는 댓글 백엔드(thread)를 그대로 부른다 (comments.js 와 같은 키 규칙) ──
  const KEY_ALIASES = [["논문-노트/", "논문/"]]
  const pageKey = (slug) => {
    for (const [now, first] of KEY_ALIASES) if (slug.startsWith(now)) return first + slug.slice(now.length)
    return slug
  }
  const COUNT_TTL = 10 * 60 * 1000
  const counts = new Map() // slug -> { likes, comments, liked }
  const inflight = new Map()
  const readCount = (slug) => {
    if (counts.has(slug)) return counts.get(slug)
    try {
      const c = JSON.parse(sessionStorage.getItem("nyuri-count:" + slug) || "null")
      if (c && Date.now() - c.at < COUNT_TTL) {
        counts.set(slug, c)
        return c
      }
    } catch {}
    return null
  }
  const saveCount = (slug, c) => {
    counts.set(slug, c)
    try {
      sessionStorage.setItem("nyuri-count:" + slug, JSON.stringify(c))
    } catch {}
  }
  // 여러 글을 한 번에 (백엔드 action=counts). 예전 백엔드면 null 을 돌려주고 글마다 부르는 방식으로 넘어간다
  let batchSupported = true
  const fetchMany = async (slugs) => {
    const api = window.NYURI && window.NYURI.api
    if (!api || !batchSupported || !slugs.length) return null
    try {
      const u = new URL(api)
      u.searchParams.set("action", "counts")
      u.searchParams.set("pages", slugs.map(pageKey).join(","))
      try {
        if (window.NYURI.clientId) u.searchParams.set("clientId", window.NYURI.clientId())
      } catch {}
      const j = await (await fetch(u)).json()
      if (!j || !j.ok || !j.counts) {
        batchSupported = false
        return null
      }
      const liked = new Set(j.liked || [])
      const out = {}
      for (const slug of slugs) {
        const k = pageKey(slug)
        const v = j.counts[k] || { likes: 0, comments: 0 }
        out[slug] = { likes: v.likes || 0, comments: v.comments || 0, liked: liked.has(k), at: Date.now() }
        saveCount(slug, out[slug])
      }
      return out
    } catch {
      return null
    }
  }
  window.NYURI_COUNTS = { readCount, fetchMany, fetchCount: (s) => fetchCount(s) } // 관련 글(nyuri-related.js)도 같이 쓴다
  const fetchCount = (slug) => {
    const api = window.NYURI && window.NYURI.api
    if (!api) return Promise.resolve(null)
    if (inflight.has(slug)) return inflight.get(slug)
    const u = new URL(api)
    u.searchParams.set("action", "thread")
    u.searchParams.set("page", pageKey(slug))
    try {
      if (window.NYURI.clientId) u.searchParams.set("clientId", window.NYURI.clientId())
    } catch {}
    const p = fetch(u)
      .then((r) => r.json())
      .then((j) => {
        if (!j || !j.ok) return null
        const c = { likes: j.likes || 0, comments: (j.comments || []).length, liked: !!j.liked, at: Date.now() }
        counts.set(slug, c)
        try {
          sessionStorage.setItem("nyuri-count:" + slug, JSON.stringify(c))
        } catch {}
        return c
      })
      .catch(() => null)
      .finally(() => inflight.delete(slug))
    inflight.set(slug, p)
    return p
  }

  const siteRoot = () => {
    const a = document.querySelector("a.page-title, .page-title a")
    return a ? new URL(a.getAttribute("href"), location.href).href : new URL("./", location.href).href
  }
  const loadData = () => {
    if (!dataPromise)
      dataPromise = fetch(new URL("static/nyuri-list.json", siteRoot()))
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}))
    return dataPromise
  }

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue
      if (k === "class") n.className = v
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v)
      else n.setAttribute(k, v === true ? "" : v)
    }
    for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(String(k)))
    return n
  }
  const svg = (d) => {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    s.setAttribute("viewBox", "0 0 24 24")
    s.setAttribute("aria-hidden", "true")
    s.setAttribute("class", "nyuri-list-icon")
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path")
    p.setAttribute("d", d)
    s.append(p)
    return s
  }
  const ICON_SEARCH = "M10.5 4a6.5 6.5 0 1 0 4.1 11.5l4.2 4.2 1.1-1.1-4.2-4.2A6.5 6.5 0 0 0 10.5 4Zm0 1.6a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Z"
  const ICON_PREV = "M14.6 6.4 9 12l5.6 5.6-1.1 1.1L6.8 12l6.7-6.7Z"
  const ICON_NEXT = "M9.4 6.4 15 12l-5.6 5.6 1.1 1.1 6.7-6.7-6.7-6.7Z"
  // comments.js 와 같은 선 아이콘 (하트, 말풍선)
  const lineIcon = (d) => {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    s.setAttribute("viewBox", "0 0 24 24")
    s.setAttribute("aria-hidden", "true")
    s.setAttribute("class", "nyuri-list-lineicon")
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path")
    p.setAttribute("d", d)
    s.append(p)
    return s
  }
  const D_HEART = "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"
  const D_BUBBLE = "M21 11.5a8.4 8.4 0 0 1-9 8.4 9.3 9.3 0 0 1-3.7-.8L3 21l1.7-4.6A8 8 0 0 1 3 11.5 8.6 8.6 0 0 1 12 3a8.6 8.6 0 0 1 9 8.5z"

  const norm = (s) => String(s || "").toLowerCase().normalize("NFC")
  const fmtDate = (iso) => {
    const d = new Date(iso)
    if (isNaN(d)) return ""
    const p = (n) => String(n).padStart(2, "0")
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
  }

  function readState() {
    const u = new URL(location.href)
    const sort = u.searchParams.get("sort")
    return {
      q: u.searchParams.get("q") || "",
      tag: u.searchParams.get("tag") || "",
      sort: SORTS.some(([k]) => k === sort) ? sort : "new",
      page: Math.max(1, parseInt(u.searchParams.get("page") || "1", 10) || 1),
    }
  }
  function writeState(s) {
    const u = new URL(location.href)
    const set = (k, v, def) => (v && v !== def ? u.searchParams.set(k, v) : u.searchParams.delete(k))
    set("q", s.q.trim(), "")
    set("tag", s.tag, "")
    set("sort", s.sort, "new")
    set("page", String(s.page), "1")
    history.replaceState(history.state, "", u.pathname + u.search + u.hash)
  }

  function build(host, items, base) {
    const state = readState()
    const allTags = new Map()
    for (const it of items) for (const t of it.tags) allTags.set(t, (allTags.get(t) || 0) + 1)
    const tagList = [...allTags.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    if (state.tag && !allTags.has(state.tag)) state.tag = ""

    // ── 도구 줄: 찾기, 정렬 ──
    const input = el("input", {
      type: "search",
      class: "nyuri-list-search",
      placeholder: "이 카테고리에서 찾기",
      "aria-label": "이 카테고리의 글 찾기",
      autocomplete: "off",
      spellcheck: "false",
    })
    input.value = state.q
    const searchWrap = el("label", { class: "nyuri-list-searchwrap" }, svg(ICON_SEARCH), input)

    const sortBtns = SORTS.map(([k, label]) =>
      el("button", { type: "button", class: "nyuri-list-sort", "data-sort": k, onclick: () => update({ sort: k, page: 1 }) }, label),
    )
    const sortGroup = el("div", { class: "nyuri-list-sorts", role: "group", "aria-label": "정렬" }, sortBtns)

    // ── 태그 줄 ──
    const tagBtns = [["", "전체", items.length], ...tagList.map(([t, n]) => [t, "#" + t, n])].map(([t, label, n]) =>
      el(
        "button",
        { type: "button", class: "nyuri-list-tag", "data-tag": t, onclick: () => update({ tag: state.tag === t ? "" : t, page: 1 }) },
        label,
        el("span", { class: "nyuri-list-tag-count" }, n),
      ),
    )
    // 자주 쓴 태그만 먼저 보이고 나머지는 '더 보기'로 펼친다 (고른 태그는 늘 보인다)
    const TAG_LIMIT = 8
    let tagsOpen = false
    const moreBtn = el("button", {
      type: "button",
      class: "nyuri-list-tag nyuri-list-more",
      "aria-expanded": "false",
      onclick: () => {
        tagsOpen = !tagsOpen
        syncTags()
      },
    })
    const syncTags = () => {
      const hiddenCount = Math.max(0, tagBtns.length - TAG_LIMIT)
      tagBtns.forEach((b, i) => (b.hidden = !tagsOpen && i >= TAG_LIMIT && b.dataset.tag !== state.tag))
      moreBtn.hidden = hiddenCount === 0
      moreBtn.setAttribute("aria-expanded", tagsOpen ? "true" : "false")
      moreBtn.textContent = tagsOpen ? "접기" : `태그 ${hiddenCount}개 더 보기`
    }
    const tagRow = el("div", { class: "nyuri-list-tags", role: "group", "aria-label": "태그로 거르기" }, tagBtns, moreBtn)

    const status = el("p", { class: "nyuri-list-status", "aria-live": "polite" })
    const list = el("ol", { class: "nyuri-list-items" })
    const pager = el("nav", { class: "nyuri-list-pager", "aria-label": "목록 페이지" })
    const empty = el(
      "div",
      { class: "nyuri-list-empty", hidden: true },
      el("p", {}, "조건에 맞는 글이 없어요."),
      el("button", { type: "button", class: "nyuri-list-reset", onclick: () => update({ q: "", tag: "", page: 1 }, true) }, "조건 지우기"),
    )

    const root = el(
      "section",
      { class: "nyuri-list", "aria-label": "글 목록" },
      el("div", { class: "nyuri-list-tools" }, searchWrap, sortGroup),
      tagList.length ? tagRow : null,
      status,
      list,
      empty,
      pager,
    )
    host.replaceWith(root)
    root.append(host) // 원래 목록은 숨긴 채 남겨 둔다(검색 엔진, 복사용)
    host.hidden = true

    let timer = null
    input.addEventListener("input", () => {
      clearTimeout(timer)
      timer = setTimeout(() => update({ q: input.value, page: 1 }), 120)
    })
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && input.value) {
        input.value = ""
        update({ q: "", page: 1 })
      }
    })

    function filtered() {
      const words = norm(state.q).split(/\s+/).filter(Boolean)
      let out = items.filter((it) => {
        if (state.tag && !it.tags.includes(state.tag)) return false
        if (!words.length) return true
        const hay = norm([it.title, it.summary, it.venue, ...it.tags].join(" "))
        return words.every((w) => hay.includes(w))
      })
      const byAdded = (a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : 0)
      if (state.sort === "new") out.sort(byAdded)
      else if (state.sort === "popular") {
        const likes = (it) => (counts.get(it.slug) || {}).likes ?? -1
        out.sort((a, b) => likes(b) - likes(a) || byAdded(a, b))
      } else if (state.sort === "old") out.sort((a, b) => -byAdded(a, b))
      else out.sort((a, b) => a.title.localeCompare(b.title, "ko", { numeric: true }))
      return out
    }

    function card(it) {
      const href = new URL(it.slug, base).pathname
      const isNew = Date.now() - new Date(it.added).getTime() < NEW_DAYS * 864e5
      const c = readCount(it.slug)
      const stat = (cls, d, n, label) =>
        el(
          "span",
          { class: "nyuri-list-stat " + cls, "data-slug": it.slug, "aria-label": n == null ? false : `${label} ${n}개` },
          lineIcon(d),
          el("span", { class: "nyuri-list-stat-n" }, n == null ? "" : String(n)),
        )
      const heart = stat("is-likes", D_HEART, c && c.likes, "좋아요")
      if (c && c.liked) heart.classList.add("is-mine")
      const meta = el(
        "p",
        { class: "nyuri-list-meta" },
        isNew ? el("span", { class: "nyuri-list-new" }, "새 글") : null,
        el("time", { datetime: it.added.slice(0, 10) }, fmtDate(it.added)),
        it.venue ? el("span", { class: "nyuri-list-venue" }, it.venue) : null,
        it.minutes ? el("span", { class: "nyuri-list-minutes" }, `${it.minutes}분 읽기`) : null,
        el(
          "span",
          { class: "nyuri-list-stats" + (c ? "" : " is-loading") },
          heart,
          stat("is-comments", D_BUBBLE, c && c.comments, "댓글"),
        ),
      )
      const tags = it.tags.length
        ? el(
            "ul",
            { class: "nyuri-list-cardtags", "aria-label": "태그" },
            it.tags.map((t) =>
              el(
                "li",
                {},
                el(
                  "button",
                  {
                    type: "button",
                    "aria-pressed": state.tag === t ? "true" : "false",
                    onclick: () => update({ tag: state.tag === t ? "" : t, page: 1 }, true),
                  },
                  "#" + t,
                ),
              ),
            ),
          )
        : null
      return el(
        "li",
        { class: "nyuri-list-item" },
        meta,
        el("h3", {}, el("a", { href, class: "internal" }, it.title)),
        it.summary ? el("p", { class: "nyuri-list-summary" }, it.summary) : null,
        tags,
      )
    }

    function pageButton(label, page, opts = {}) {
      return el(
        "button",
        {
          type: "button",
          class: "nyuri-list-page" + (opts.cls ? " " + opts.cls : ""),
          "aria-current": opts.current ? "page" : false,
          "aria-label": opts.aria || false,
          disabled: opts.disabled || false,
          onclick: () => update({ page }, true),
        },
        label,
      )
    }

    function render(scroll) {
      const rows = filtered()
      const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE))
      if (state.page > pages) state.page = pages
      const start = (state.page - 1) * PER_PAGE
      const shown = rows.slice(start, start + PER_PAGE)

      input.value === state.q || (input.value = state.q)
      for (const b of sortBtns) b.setAttribute("aria-pressed", b.dataset.sort === state.sort ? "true" : "false")
      for (const b of tagBtns) b.setAttribute("aria-pressed", b.dataset.tag === state.tag ? "true" : "false")
      syncTags()

      const parts = []
      if (state.q.trim()) parts.push(`'${state.q.trim()}'`)
      if (state.tag) parts.push("#" + state.tag)
      const range = rows.length > PER_PAGE ? ` 중 ${start + 1}~${start + shown.length}번째` : ""
      status.textContent = (parts.length ? parts.join(", ") + " 결과 " : "글 ") + `${rows.length}개${range}`

      list.replaceChildren(...shown.map(card))
      empty.hidden = rows.length > 0
      loadCounts(state.sort === "popular" ? items : shown)

      pager.replaceChildren()
      pager.hidden = pages <= 1
      if (pages > 1) {
        pager.append(pageButton(svg(ICON_PREV), state.page - 1, { disabled: state.page === 1, aria: "이전 페이지", cls: "is-step" }))
        for (let p = 1; p <= pages; p++) {
          const near = Math.abs(p - state.page) <= 1 || p === 1 || p === pages
          if (near) pager.append(pageButton(String(p), p, { current: p === state.page, aria: `${p}페이지` }))
          else if (Math.abs(p - state.page) === 2) pager.append(el("span", { class: "nyuri-list-gap", "aria-hidden": "true" }, "…"))
        }
        pager.append(pageButton(svg(ICON_NEXT), state.page + 1, { disabled: state.page === pages, aria: "다음 페이지", cls: "is-step" }))
      }
      writeState(state)
      if (scroll) root.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
    }

    // 보이는 글(인기순이면 전체)의 좋아요, 댓글 수를 받아 카드에 채운다
    let sortedWithCounts = false
    function paint(slug, c) {
      root.querySelectorAll(`.nyuri-list-stat[data-slug="${CSS.escape(slug)}"]`).forEach((s) => {
        const isLikes = s.classList.contains("is-likes")
        const n = c ? (isLikes ? c.likes : c.comments) : null
        s.querySelector(".nyuri-list-stat-n").textContent = n == null ? "" : String(n)
        if (n != null) s.setAttribute("aria-label", `${isLikes ? "좋아요" : "댓글"} ${n}개`)
        if (isLikes) s.classList.toggle("is-mine", !!(c && c.liked))
        s.parentElement.classList.remove("is-loading")
        if (!c) s.parentElement.classList.add("is-failed")
      })
    }
    function loadCounts(targets) {
      const todo = targets.filter((it) => !readCount(it.slug))
      if (!todo.length) return
      fetchMany(todo.map((it) => it.slug))
        .then((many) =>
          many
            ? todo.forEach((it) => paint(it.slug, many[it.slug]))
            : Promise.all(todo.map((it) => fetchCount(it.slug).then((c) => paint(it.slug, c)))),
        )
        .then(() => {
        if (state.sort === "popular" && !sortedWithCounts) {
          sortedWithCounts = true
          render(false)
        }
      })
    }

    function update(patch, scroll = false) {
      if (patch.sort && patch.sort !== state.sort) sortedWithCounts = false
      Object.assign(state, patch)
      render(scroll)
    }

    render(false)
  }

  async function mount() {
    const slug = document.body.dataset.slug || ""
    if (!slug.endsWith("/index")) return
    const host = document.querySelector("article .markdown-rendered > ul")
    if (!host || host.closest(".nyuri-list")) return
    const data = await loadData()
    const items = data[slug]
    if (!items || !items.length) return
    if (document.body.dataset.slug !== slug || !host.isConnected) return
    build(host, items, siteRoot())
  }
  document.addEventListener("nav", mount)
  if (document.readyState !== "loading") mount()
  else document.addEventListener("DOMContentLoaded", mount)
})()
