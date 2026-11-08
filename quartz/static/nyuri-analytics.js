// 뉴리의창고 방문 분석 (내 구글 시트의 views 탭에 쌓인다, backend/Code.gs 의 track)
// 결정에 쓰는 것만 잰다
// - page_view: 어떤 글을, 어디서 와서(검색, AI 답변, 커뮤니티, SNS, 직접, 사이트 안), 어떤 기기로, 처음 왔는지
// - page_leave: 떠날 때 얼마나 내려 읽었는지(스크롤 %)와 화면에 보이던 시간(초)
// - related_click: '다음에 읽을 글'에서 몇 번째, 어떤 이유 문구를 눌렀는지 (nyuri-related.js 가 부른다)
// 개인정보: 브라우저 정보(User-Agent)는 보내지 않는다. 방문자는 브라우저마다 하나인 임의 ID 의 해시 앞 12자로 구분하고,
//   page_view 에만 공개 IP 를 함께 보내 백엔드가 비밀 소금을 섞은 해시로 바꿔 '같은 사람 한 번' 세기에만 쓴다(원래 IP 는 남기지 않는다)
// 기기: 화면과 User-Agent 로 모바일, 태블릿, PC 중 하나만 보낸다. 검색어: 검색 사이트가 주소에 검색어를 넘겨줄 때만(구글은 넘기지 않는다)
// 보내지 않는 경우: 블로그 주인 브라우저, 추적 거부(DNT, GPC), 자동화 브라우저, 로컬 주소
;(() => {
  if (window.__nyuriAnalytics) return
  window.__nyuriAnalytics = true

  const off = (() => {
    try {
      if (/^(localhost|127\.|192\.168\.)/.test(location.hostname)) return true
      if (navigator.webdriver || /HeadlessChrome|Headless/i.test(navigator.userAgent)) return true
      if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl) return true
      if (localStorage.getItem("nyuri-admin")) return true
    } catch {}
    return false
  })()

  const CHANNELS = [
    ["ai", /(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|you\.com|phind\.com)$/],
    ["search", /(^|\.)(google\.[a-z.]+|bing\.com|naver\.com|daum\.net|duckduckgo\.com|search\.yahoo\.com|ecosia\.org|baidu\.com|zum\.com)$/],
    ["community", /(^|\.)(news\.hada\.io|news\.ycombinator\.com|reddit\.com|dcinside\.com|clien\.net|okky\.kr|velog\.io|disquiet\.io)$/],
    ["social", /(^|\.)(x\.com|twitter\.com|t\.co|threads\.net|facebook\.com|instagram\.com|linkedin\.com|lnkd\.in|kakao\.com|band\.us)$/],
  ]

  const api = () => (window.NYURI && window.NYURI.api) || ""
  let visitorP = null
  const visitor = () => {
    if (!visitorP) {
      visitorP = (async () => {
        try {
          const id = (window.NYURI && window.NYURI.clientId && window.NYURI.clientId()) || ""
          if (!id || !crypto.subtle) return ""
          const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("nyuri:" + id))
          return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12)
        } catch {
          return ""
        }
      })()
    }
    return visitorP
  }
  const firstVisit = (() => {
    try {
      if (localStorage.getItem("nyuri-first-seen")) return false
      localStorage.setItem("nyuri-first-seen", new Date().toISOString())
      return true
    } catch {
      return false
    }
  })()

  const device = (() => {
    const ua = navigator.userAgent
    const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1 // iPadOS 는 데스크톱 주소를 쓴다
    if (touchMac || /iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet"
    if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "mobile"
    return "pc"
  })()
  // 공개 IP 는 1.5초까지만 기다린다(늦으면 IP 없이 보내고, 그 줄은 브라우저 ID 로 센다)
  const ipQuick = () =>
    window.NYURI && window.NYURI.ip ? Promise.race([window.NYURI.ip(), new Promise((r) => setTimeout(() => r(""), 1500))]) : Promise.resolve("")

  async function send(event, extra) {
    if (off || !api()) return
    const body = JSON.stringify({
      action: "track",
      event,
      page: document.body.dataset.slug || location.pathname,
      title: (document.querySelector("h1.article-title")?.textContent || document.title).trim().slice(0, 200),
      device,
      visitor: await visitor(),
      ...(event === "page_view" ? { meta: { ip: await ipQuick() } } : {}),
      ...extra,
    })
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(api(), new Blob([body], { type: "text/plain;charset=utf-8" }))) return
    } catch {}
    try {
      fetch(api(), { method: "POST", mode: "no-cors", keepalive: true, headers: { "Content-Type": "text/plain;charset=utf-8" }, body })
    } catch {}
  }
  window.NYURI_TRACK = send

  // 첫 페이지는 document.referrer 로, 그 뒤 사이트 안 이동은 internal 로 센다
  let firstNav = true
  function source() {
    const u = new URL(location.href)
    const utm = {
      utmSource: u.searchParams.get("utm_source") || "",
      utmMedium: u.searchParams.get("utm_medium") || "",
      utmCampaign: u.searchParams.get("utm_campaign") || "",
    }
    if (!firstNav) return { channel: "internal", refHost: "", ...utm }
    let host = ""
    try {
      host = document.referrer ? new URL(document.referrer).hostname : ""
    } catch {}
    let channel = "direct"
    if (host && host === location.hostname) channel = "internal"
    else if (host) channel = (CHANNELS.find(([, re]) => re.test(host)) || ["other"])[0]
    if (!host && utm.utmSource) channel = /chatgpt|openai|perplexity|claude|gemini|copilot/i.test(utm.utmSource) ? "ai" : "campaign"
    let keyword = ""
    if (channel === "search") {
      try {
        const q = new URL(document.referrer).searchParams
        keyword = (["q", "query", "oquery", "wd", "p", "text", "search_query"].map((k) => q.get(k)).find(Boolean) || "").trim().slice(0, 100)
      } catch {}
    }
    return { channel, refHost: host, keyword, ...utm }
  }

  // ── 읽은 깊이와 시간 ──
  let depth = 0
  let shownMs = 0
  let shownAt = 0
  let sentLeave = true
  const measure = () => {
    const doc = document.documentElement
    const max = Math.max(1, doc.scrollHeight - innerHeight)
    depth = Math.max(depth, Math.min(100, Math.round((scrollY / max) * 100)))
  }
  const pause = () => {
    if (shownAt) shownMs += Date.now() - shownAt
    shownAt = 0
  }
  const resume = () => {
    if (!shownAt && document.visibilityState === "visible") shownAt = Date.now()
  }
  function leave() {
    if (sentLeave) return
    sentLeave = true
    pause()
    measure()
    send("page_leave", { depth, seconds: Math.round(shownMs / 1000) })
  }

  let lastKey = ""
  let lastAt = 0
  function onNav() {
    const key = document.body.dataset.slug || location.pathname
    if (key === lastKey && Date.now() - lastAt < 1500) return // 첫 로드에서 nav 와 직접 호출이 겹치는 경우
    lastKey = key
    lastAt = Date.now()
    const src = source()
    firstNav = false
    depth = 0
    shownMs = 0
    shownAt = 0
    sentLeave = false
    resume()
    measure()
    send("page_view", { ...src, newVisitor: firstVisit && src.channel !== "internal" })
  }

  addEventListener("scroll", measure, { passive: true })
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      leave()
    } else {
      resume()
    }
  })
  addEventListener("pagehide", leave)
  document.addEventListener("prenav", leave)
  document.addEventListener("nav", onNav)
  if (document.readyState !== "loading" && document.body?.dataset.slug) onNav()
  else document.addEventListener("DOMContentLoaded", () => document.body?.dataset.slug && onNav(), { once: true })
})()
