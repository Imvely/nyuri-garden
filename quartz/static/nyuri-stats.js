// 뉴리의창고 주인 전용 방문 통계 (backend/Code.gs 의 stats)
// - 주인 모드 브라우저(#nyuri-admin=키 로 한 번 들어온 브라우저)에서만 그린다. 키가 없으면 아무 요청도 하지 않는다
// - 백엔드는 관리자 키가 맞을 때만 숫자를 준다. 화면만 숨기는 것이 아니라 키 없이는 데이터 자체를 받을 수 없다
// - 글 페이지: 날짜 줄 아래 한 줄(조회, 방문자, 오늘). 다른 페이지: 블로그 오늘, 누적 한 줄. 어디서나 '통계'로 전체 패널을 연다
// - 방문자는 IP 해시로 한 번만 센다(예전 기록은 브라우저 ID). 주인 자신의 방문은 세지 않는다
;(() => {
  if (window.__nyuriStats) return
  window.__nyuriStats = true

  const store = {
    get: (k) => {
      try {
        return localStorage.getItem(k)
      } catch {
        return null
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v)
      } catch {}
    },
  }
  const m = location.hash.match(/nyuri-admin=([^&]+)/)
  if (m) store.set("nyuri-admin", decodeURIComponent(m[1]))
  const key = () => store.get("nyuri-admin") || ""
  const api = () => (window.NYURI && window.NYURI.api) || ""
  if (!key() || !api()) return

  const CHANNEL = { search: "검색", ai: "AI 답변", community: "커뮤니티", social: "SNS", direct: "직접 들어옴", campaign: "RSS, 캠페인", other: "다른 사이트" }
  const DEVICE = [
    ["mobile", "모바일"],
    ["tablet", "태블릿"],
    ["pc", "PC"],
  ]
  const ICON_CHART =
    '<svg class="nyuri-owner-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>'
  const ICON_CLOSE = '<svg class="nyuri-owner-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
  const n = (x) => Number(x || 0).toLocaleString("ko-KR")
  const root = () => {
    const s = document.querySelector('script[src*="static/nyuri-stats.js"]')?.getAttribute("src") || ""
    return s.replace(/static\/nyuri-stats\.js.*$/, "")
  }
  const slug = () => document.body?.dataset.slug || ""

  // nyuri-analytics.js 와 같은 방문자 해시 (브라우저 임의 ID 의 SHA-256 앞 12자)
  async function visitor() {
    try {
      const id = (window.NYURI && window.NYURI.clientId && window.NYURI.clientId()) || ""
      if (!id || !crypto.subtle) return ""
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("nyuri:" + id))
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12)
    } catch {
      return ""
    }
  }
  const ipQuick = () =>
    window.NYURI && window.NYURI.ip ? Promise.race([window.NYURI.ip(), new Promise((r) => setTimeout(() => r(""), 2000))]) : Promise.resolve("")

  let data = null
  let loadedAt = 0
  let pending = null
  async function load(force) {
    if (!force && data && Date.now() - loadedAt < 60000) return data
    if (pending) return pending
    pending = (async () => {
      // 이 브라우저의 방문자 ID(분석과 같은 해시)와 공개 IP 를 함께 보내 '주인 기기'로 등록한다.
      // 백엔드는 이후 이 기기의 방문을 views 탭에 쓰지 않고, 예전에 쌓인 줄도 집계에서 뺀다
      const r = await fetch(api(), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "stats", adminKey: key(), visitor: await visitor(), meta: { ip: await ipQuick() } }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || "failed")
      data = j
      loadedAt = Date.now()
      return j
    })().finally(() => (pending = null))
    return pending
  }

  // ── 제목 아래 한 줄 ──
  function mountLine() {
    document.querySelectorAll(".nyuri-owner").forEach((el) => el.remove())
    const anchor =
      document.querySelector(".nyuri-meta-row") ||
      document.querySelector("article .content-meta, .page-header .content-meta") ||
      document.querySelector("h1.article-title")
    if (!anchor) return
    const line = document.createElement("div")
    line.className = "nyuri-owner is-loading"
    line.setAttribute("role", "group")
    line.setAttribute("aria-label", "주인에게만 보이는 방문 통계")
    line.innerHTML = `<span class="nyuri-owner-badge">주인</span><span class="nyuri-owner-nums" aria-live="polite">통계 불러오는 중</span>
      <button type="button" class="nyuri-owner-open" aria-haspopup="dialog" aria-controls="nyuri-owner-panel">${ICON_CHART}통계</button>`
    anchor.after(line)
    line.querySelector(".nyuri-owner-open").addEventListener("click", openPanel)
    load()
      .then((d) => paintLine(line, d))
      .catch(() => {
        line.classList.remove("is-loading")
        line.querySelector(".nyuri-owner-nums").textContent = "통계를 불러오지 못했어요"
      })
  }

  function paintLine(line, d) {
    line.classList.remove("is-loading")
    // 아직 기록이 없는 글은 0 으로 보인다 (블로그 전체 줄로 바뀌지 않게)
    const p = d.pages.find((x) => x.page === slug()) || { views: 0, visitors: 0, today: 0 }
    const nums = line.querySelector(".nyuri-owner-nums")
    const isPost = !!document.querySelector("h1.article-title") && slug() !== "index" && !slug().endsWith("/index")
    nums.innerHTML = isPost
      ? `<span>조회 <b>${n(p.views)}</b></span><span>방문자 <b>${n(p.visitors)}</b></span><span>오늘 <b>${n(p.today)}</b></span>`
      : `<span>오늘 방문자 <b>${n(d.today.visitors)}</b></span><span>오늘 조회 <b>${n(d.today.views)}</b></span><span>누적 방문자 <b>${n(d.total.visitors)}</b></span>`
  }

  // ── 전체 패널 ──
  let panel = null
  function ensurePanel() {
    if (panel && document.body.contains(panel)) return panel
    panel = document.createElement("aside")
    panel.id = "nyuri-owner-panel"
    panel.className = "nyuri-owner-panel"
    panel.setAttribute("role", "dialog")
    panel.setAttribute("aria-labelledby", "nyuri-owner-title")
    if ("popover" in HTMLElement.prototype) panel.setAttribute("popover", "")
    panel.innerHTML = `<header class="nop-head">
        <div><h2 id="nyuri-owner-title">방문 통계</h2><p class="nop-sub">주인에게만 보여요. 주인 방문은 세지 않아요.</p></div>
        <button type="button" class="nop-close" aria-label="통계 닫기">${ICON_CLOSE}</button>
      </header><div class="nop-body" aria-live="polite"></div>`
    document.body.append(panel)
    panel.querySelector(".nop-close").addEventListener("click", closePanel)
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-retry]")
      if (b) fill(true)
    })
    if (!panel.hasAttribute("popover")) {
      document.addEventListener("keydown", (e) => e.key === "Escape" && panel.classList.contains("is-open") && closePanel())
    }
    return panel
  }

  function openPanel() {
    const p = ensurePanel()
    if (p.hasAttribute("popover")) p.showPopover()
    else p.classList.add("is-open")
    p.querySelector(".nop-close").focus({ preventScroll: true })
    fill(false)
  }

  function closePanel() {
    if (!panel) return
    if (panel.hasAttribute("popover")) panel.hidePopover()
    else panel.classList.remove("is-open")
    document.querySelector(".nyuri-owner-open")?.focus({ preventScroll: true })
  }

  async function fill(force) {
    const body = ensurePanel().querySelector(".nop-body")
    body.innerHTML = `<p class="nop-empty">불러오는 중</p>`
    try {
      body.innerHTML = render(await load(force))
    } catch {
      body.innerHTML = `<p class="nop-empty">통계를 불러오지 못했어요. 백엔드를 새 코드로 다시 배포했는지 확인해 주세요.</p>
        <button type="button" class="nop-retry" data-retry>다시 불러오기</button>`
    }
  }

  // 2026-11-08 을 11.08 일 로 (한국 시각 정오는 UTC 로도 같은 날이라 요일이 어긋나지 않는다)
  const day = (d) => `${d.slice(5).replace("-", ".")} ${"일월화수목금토"[new Date(d + "T12:00:00+09:00").getUTCDay()]}`

  function render(d) {
    const pct = (x, t) => (t ? Math.round((x / t) * 100) : 0)
    const devTotal = DEVICE.reduce((s, [k]) => s + (d.devices[k] || 0), 0)
    const chTotal = Object.values(d.channels).reduce((s, x) => s + x, 0)
    const channels = Object.entries(d.channels).sort((a, b) => b[1] - a[1])
    const href = (page) => `${root()}${page.split("/").map(encodeURIComponent).join("/")}`
    return `
      <section class="nop-sec">
        <h3>블로그 전체</h3>
        <table class="nop-table"><thead><tr><th scope="col"></th><th scope="col">방문자</th><th scope="col">조회</th></tr></thead><tbody>
          <tr><th scope="row">오늘</th><td>${n(d.today.visitors)}</td><td>${n(d.today.views)}</td></tr>
          <tr><th scope="row">지금까지</th><td>${n(d.total.visitors)}</td><td>${n(d.total.views)}</td></tr>
        </tbody></table>
        <p class="nop-note">방문자는 같은 IP를 한 번만 셌고, 조회는 중복을 빼지 않은 전체예요.</p>
      </section>
      <section class="nop-sec">
        <h3>최근 7일</h3>
        <table class="nop-table"><thead><tr><th scope="col">날짜</th><th scope="col">방문자</th><th scope="col">조회</th></tr></thead><tbody>
          ${d.days
            .slice()
            .reverse()
            .map((x) => `<tr><th scope="row">${esc(day(x.day))}</th><td>${n(x.visitors)}</td><td>${n(x.views)}</td></tr>`)
            .join("")}
        </tbody></table>
      </section>
      <section class="nop-sec">
        <h3>글별</h3>
        ${
          d.pages.length
            ? `<table class="nop-table nop-pages"><thead><tr><th scope="col">글</th><th scope="col">방문자</th><th scope="col">조회</th><th scope="col">오늘</th></tr></thead><tbody>
          ${d.pages
            .map(
              (p) =>
                `<tr${p.page === slug() ? ' class="is-here"' : ""}><th scope="row"><a href="${esc(href(p.page))}">${esc(p.title || p.page)}</a></th><td>${n(p.visitors)}</td><td>${n(p.views)}</td><td>${n(p.today)}</td></tr>`,
            )
            .join("")}
        </tbody></table>`
            : `<p class="nop-empty">아직 기록된 조회가 없어요.</p>`
        }
      </section>
      <section class="nop-sec">
        <h3>검색어</h3>
        ${
          d.keywords.length
            ? `<table class="nop-table"><thead><tr><th scope="col">검색어</th><th scope="col">어디서</th><th scope="col">횟수</th></tr></thead><tbody>
          ${d.keywords.map((k) => `<tr><th scope="row">${esc(k.keyword)}</th><td class="nop-from">${esc(k.from.replace(/^www\./, ""))}</td><td>${n(k.n)}</td></tr>`).join("")}
        </tbody></table>`
            : `<p class="nop-empty">아직 검색어가 넘어온 방문이 없어요.</p>`
        }
        <p class="nop-note">구글은 검색어를 넘겨주지 않아서, 구글 검색어는 <a href="https://search.google.com/search-console/performance/search-analytics?resource_id=${encodeURIComponent((window.NYURI && window.NYURI.site) || "")}" target="_blank" rel="noopener">Search Console 실적</a>에서 봐야 해요.</p>
      </section>
      <section class="nop-sec">
        <h3>기기</h3>
        <dl class="nop-split">
          ${DEVICE.map(([k, label]) => `<div><dt>${label}</dt><dd><b>${n(d.devices[k])}</b><span>${pct(d.devices[k], devTotal)}%</span></dd></div>`).join("")}
        </dl>
      </section>
      <section class="nop-sec">
        <h3>어디서 왔나</h3>
        ${
          channels.length
            ? `<table class="nop-table"><tbody>${channels.map(([c, x]) => `<tr><th scope="row">${esc(CHANNEL[c] || c)}</th><td>${n(x)}</td><td class="nop-pct">${pct(x, chTotal)}%</td></tr>`).join("")}</tbody></table>`
            : `<p class="nop-empty">아직 기록이 없어요.</p>`
        }
      </section>
      <p class="nop-updated">${esc(d.updated)} 기준. 1분마다 새로 계산해요.${d.ownerExcluded ? ` 주인 기기 방문 ${n(d.ownerExcluded)}회는 뺐어요.` : ""}</p>`
  }

  function onNav() {
    if (panel && !panel.hasAttribute("popover")) panel.classList.remove("is-open")
    mountLine()
  }
  document.addEventListener("nav", onNav)
  if (document.readyState !== "loading") onNav()
  else document.addEventListener("DOMContentLoaded", onNav, { once: true })
})()
