// 뉴리의창고: 글마다 좋아요와 댓글
// - 좋아요: 공유 줄 맨 앞 하트 버튼 (방문자마다 한 번, 다시 누르면 취소)
// - 댓글: 닉네임(비우면 귀여운 랜덤 이름), 비밀번호(수정·삭제용), 답글 한 단계
// - 주인 모드: 주소 끝에 #nyuri-admin=관리자키 로 한 번 들어오면 이 브라우저에 저장되고,
//   이후 남기는 댓글은 "뉴리" 이름과 캐릭터 얼굴로 표시된다
// 백엔드: window.NYURI.api (구글 앱스 스크립트). 비어 있으면 아무것도 그리지 않는다.
(() => {
  if (window.__nyuriComments) return
  window.__nyuriComments = true

  const ADJ = ["졸린", "수줍은", "배고픈", "말랑한", "반짝이는", "꼬질꼬질한", "용감한", "느긋한", "호기심 많은", "동글동글한", "부지런한", "엉뚱한", "다정한", "깜찍한", "새침한", "꿈꾸는"]
  const NOUN = ["감자", "고구마", "다람쥐", "펭귄", "쿼카", "수달", "붕어빵", "떡볶이", "마카롱", "고양이", "햄스터", "해달", "주먹밥", "젤리곰", "도토리", "부엉이"]
  const store = {
    get(k) {
      try {
        return localStorage.getItem(k)
      } catch {
        return null
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v)
      } catch {}
    },
  }

  // 방문자 식별값 (nyuri-config.js 공통)
  const clientId = (window.NYURI && window.NYURI.clientId && window.NYURI.clientId()) || ""

  // 닉네임은 쓸 때마다 새로 뽑는다 (같은 이름이 반복돼 한 사람처럼 보이지 않게)
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)]
  let lastNick = ""
  function makeNick() {
    let n = ""
    do n = `${pickOne(ADJ)} ${pickOne(NOUN)}`
    while (n === lastNick)
    lastNick = n
    return n
  }

  // 주인 모드 키: #nyuri-admin=KEY 로 들어오면 저장하고 주소에서 지운다
  const m = location.hash.match(/nyuri-admin=([^&]+)/)
  if (m) {
    store.set("nyuri-admin", decodeURIComponent(m[1]))
    history.replaceState(null, "", location.pathname + location.search)
  }
  const adminKey = () => store.get("nyuri-admin") || ""

  const api = () => (window.NYURI && window.NYURI.api) || ""
  // 폴더 이름을 바꿔도 댓글 · 좋아요가 이어지게: 지금 주소 앞부분 → 처음 저장할 때의 앞부분
  const KEY_ALIASES = [["논문-노트/", "논문/"]]
  const pageKey = () => {
    const k = document.body.dataset.slug || location.pathname
    for (const [now, first] of KEY_ALIASES) if (k.startsWith(now)) return first + k.slice(now.length)
    return k
  }
  const pageTitle = () => (document.querySelector("h1.article-title")?.textContent || document.title).trim()

  async function get(params) {
    const u = new URL(api())
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v))
    const r = await fetch(u, { method: "GET" })
    const j = await r.json()
    if (!j.ok) throw new Error(j.error || "failed")
    return j
  }
  async function post(body) {
    const meta = window.NYURI && window.NYURI.meta ? await window.NYURI.meta() : {}
    body = { ...body, meta }
    const r = await fetch(api(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // CORS 사전 요청 없이
      body: JSON.stringify(body),
      keepalive: true, // 보내는 중에 다른 글로 넘어가도 끝까지 간다
    })
    const j = await r.json()
    if (!j.ok) throw new Error(j.error || "failed")
    return j
  }

  const ERR = {
    password: "비밀번호가 맞지 않아요.",
    empty: "내용을 적어 주세요.",
    too_long: "너무 길어요. 2000자 안으로 줄여 주세요.",
    short_password: "비밀번호는 4자 이상으로 정해 주세요.",
    not_found: "이미 지워진 댓글이에요.",
    rate: "조금 천천히 남겨 주세요. 잠시 뒤 다시 시도해 주세요.",
  }
  const errText = (e) => ERR[e.message] || "지금은 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요."

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

  // 작성 시각: 한국 시간 기준 2026.11.06 13:05:42
  function stamp(iso) {
    const d = new Date(iso)
    if (isNaN(d)) return ""
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(d)
        .map((x) => [x.type, x.value]),
    )
    return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}:${p.second}`
  }

  const HEART =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>'

  const root = () => {
    const a = document.querySelector("a.page-title, .page-title a")
    return a ? new URL(a.getAttribute("href"), location.href).href : location.origin + "/"
  }

  // ── 좋아요 ──────────────────────────────────────────────────
  // 아래 공유 줄의 버튼과 위 반응 줄의 하트가 같은 상태를 쓴다
  const like = { likes: 0, liked: false, known: false, seq: 0 }
  const likeLabel = () => (like.liked ? `좋아요 취소, 지금 ${like.likes}명` : `좋아요, 지금 ${like.likes}명`)

  function paintLikes() {
    document.querySelectorAll(".nyuri-like").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(like.liked))
      btn.setAttribute("aria-label", likeLabel())
      btn.querySelector(".nyuri-like-count").textContent = like.known ? String(like.likes) : ""
    })
  }

  function pop() {
    document.querySelectorAll(".nyuri-like").forEach((btn) => {
      btn.classList.remove("is-pop")
      void btn.offsetWidth
      btn.classList.add("is-pop")
    })
  }

  async function toggleLike() {
    // 먼저 화면을 바꾸고(즉시 반응), 서버 결과로 맞춘다. 연달아 눌러도 마지막 것만 반영.
    const prev = { likes: like.likes, liked: like.liked }
    like.liked = !like.liked
    like.likes = Math.max(0, like.likes + (like.liked ? 1 : -1))
    like.known = true
    const mine = ++like.seq
    paintLikes()
    saveCache()
    if (like.liked) {
      pop()
      window.dispatchEvent(new CustomEvent("nyuri:liked"))
    }
    try {
      const j = await post({
        action: "like",
        page: pageKey(),
        title: pageTitle(),
        url: location.href.split("#")[0],
        clientId,
        like: like.liked,
      })
      if (mine !== like.seq) return
      like.likes = j.likes
      like.liked = j.liked
    } catch {
      if (mine !== like.seq) return
      Object.assign(like, prev)
    }
    paintLikes()
    saveCache()
  }

  function mountLike(row) {
    row.querySelector(".nyuri-like")?.remove()
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "nyuri-like"
    btn.innerHTML = `${HEART}<span>좋아요</span><span class="nyuri-like-count"></span>`
    row.prepend(btn)
    btn.addEventListener("click", toggleLike)
    paintLikes()
  }

  // ── 글 머리의 반응 줄: 하트(바로 누르기) + 댓글 수(누르면 댓글로 내려가기) ──
  const BUBBLE =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.3 9.3 0 0 1-3.7-.8L3 21l1.7-4.6A8 8 0 0 1 3 11.5 8.6 8.6 0 0 1 12 3a8.6 8.6 0 0 1 9 8.5z"/></svg>'

  function mountTop() {
    document.querySelectorAll(".nyuri-react").forEach((el) => el.remove())
    // 날짜 줄과 같은 줄 오른쪽 끝에 둔다 (제목 아래 줄이 하나 더 늘지 않게)
    const meta = document.querySelector("article .content-meta, .page-header .content-meta")
    let row = meta?.parentElement?.classList.contains("nyuri-meta-row") ? meta.parentElement : null
    if (meta && !row) {
      row = document.createElement("div")
      row.className = "nyuri-meta-row"
      meta.before(row)
      row.append(meta)
    }
    const anchor = meta || document.querySelector("h1.article-title")
    if (!anchor) return
    const bar = document.createElement("div")
    bar.className = "nyuri-react"
    bar.setAttribute("role", "group")
    bar.setAttribute("aria-label", "이 노트의 반응")
    bar.innerHTML = `
      <button type="button" class="nyuri-like nyuri-react-btn">${HEART}<span class="nyuri-like-count"></span></button>
      <a class="nyuri-react-btn nyuri-react-comments" href="#nc-title" data-router-ignore>${BUBBLE}<span class="nyuri-react-count"></span></a>`
    if (row) row.append(bar)
    else anchor.after(bar)
    bar.querySelector(".nyuri-like").addEventListener("click", toggleLike)
    bar.querySelector(".nyuri-react-comments").addEventListener("click", (e) => {
      e.preventDefault()
      goToComments()
    })
    paintLikes()
    paintCount()
  }

  function paintCount() {
    const link = document.querySelector(".nyuri-react-comments")
    if (!link) return
    const n = data.comments.filter((c) => !c.deleted).length
    link.querySelector(".nyuri-react-count").textContent = loaded ? String(n) : ""
    link.setAttribute("aria-label", loaded ? (n ? `댓글 ${n}개 보러 가기` : "댓글 남기러 가기") : "댓글로 가기")
  }

  function goToComments() {
    if (!section) return
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
    // 댓글이 있으면 제목에, 없으면 바로 쓸 수 있게 입력칸에 초점
    const hasAny = data.comments.some((c) => !c.deleted)
    const target = hasAny ? section.querySelector("#nc-title") : section.querySelector(".nc-composer textarea")
    target?.focus({ preventScroll: true })
    history.replaceState(history.state, "", "#nc-title")
  }

  // ── 댓글 ────────────────────────────────────────────────────
  // 얼굴은 주인(뉴리)만. 방문자는 닉네임만 보여 준다.
  function avatar(c) {
    return c.isOwner ? `<img class="nc-avatar is-owner" src="${root()}static/nyuri.svg" alt="">` : ""
  }

  function itemHTML(c, isReply) {
    const name = c.isOwner ? "뉴리" : c.nickname
    const actions = c.deleted || c.pending
      ? ""
      : `<div class="nc-actions">
          ${isReply ? "" : `<button type="button" data-act="reply" aria-expanded="false">답글</button>`}
          ${c.isOwner && !adminKey() ? "" : `<button type="button" data-act="edit" aria-expanded="false">수정</button><button type="button" data-act="delete" aria-expanded="false">삭제</button>`}
        </div>`
    return `<li class="nc-item${c.isOwner ? " is-owner" : ""}${c.deleted ? " is-deleted" : ""}${c.pending ? " is-pending" : ""}" data-id="${esc(c.id)}"${c.pending ? ' aria-busy="true"' : ""}>
      <article class="nc-card${c.isOwner ? " has-face" : ""}">
        ${avatar(c)}
        <div class="nc-main">
          <header class="nc-meta">
            <span class="nc-name">${esc(name)}</span>
            ${c.isOwner ? '<span class="nc-badge">주인</span>' : ""}
            <span class="nc-info">
              <time datetime="${esc(c.createdAt)}">${stamp(c.createdAt)}</time>
              ${c.ip && !c.isOwner ? `<span class="nc-ip" title="IP 앞 두 자리">${esc(c.ip)}</span>` : ""}
              ${c.edited ? '<span class="nc-edited">수정됨</span>' : ""}
            </span>
          </header>
          <p class="nc-body">${c.deleted ? "삭제된 댓글이에요." : esc(c.body)}</p>
          ${c.pending ? '<p class="nc-sending">올리는 중이에요</p>' : actions}
          <div class="nc-slot"></div>
        </div>
      </article>
      ${isReply ? "" : '<ol class="nc-replies"></ol>'}
    </li>`
  }

  const EYE =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
  const EYE_OFF =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19c-6.4 0-10-7-10-7a18.5 18.5 0 0 1 5.1-5.9"/><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6.4 0 10 7 10 7a18.6 18.6 0 0 1-2.2 3.2"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="m2 2 20 20"/></svg>'

  let fieldSeq = 0
  // 이름표가 붙은 입력칸 (이름표 + 도움말 + 칸)
  function field({ label, hint, input }) {
    return `<label class="nc-field">
      <span class="nc-label">${label}${hint ? ` <em>${hint}</em>` : ""}</span>
      ${input}
    </label>`
  }
  // 비밀번호 칸 + 오른쪽 눈 아이콘(누르면 보이기/가리기)
  function passwordInput({ autocomplete, placeholder }) {
    const id = `nc-pw-${++fieldSeq}`
    return `<span class="nc-pw">
      <input id="${id}" type="password" name="password" minlength="4" autocomplete="${autocomplete}" placeholder="${placeholder}" required>
      <button type="button" class="nc-eye" data-eye aria-controls="${id}" aria-pressed="false" aria-label="비밀번호 보기">${EYE}</button>
    </span>`
  }

  function formHTML({ kind, value = "" }) {
    const owner = !!adminKey()
    const nick = makeNick()
    const isEdit = kind === "edit"
    const isDelete = kind === "delete"
    const existingPw = () =>
      field({
        label: "비밀번호",
        hint: "댓글을 남길 때 정한 비밀번호",
        input: passwordInput({ autocomplete: "current-password", placeholder: "비밀번호 입력" }),
      })
    if (isDelete) {
      return `<form class="nc-inline nc-delete" novalidate>
        <p class="nc-confirm">이 댓글을 지울까요?</p>
        <div class="nc-row nc-row-end">
          ${owner ? "" : existingPw()}
          <div class="nc-buttons">
            <button type="button" class="nc-ghost" data-act="cancel">취소</button>
            <button type="submit" class="nc-danger">삭제</button>
          </div>
        </div>
        <p class="nc-status" role="status" aria-live="polite"></p>
      </form>`
    }
    const who = isEdit
      ? owner
        ? ""
        : existingPw()
      : owner
        ? `<span class="nc-as-owner"><img src="${root()}static/nyuri.svg" alt="">뉴리로 남겨요</span>`
        : field({
            label: "닉네임",
            hint: "선택",
            input: `<input type="text" name="nickname" maxlength="20" autocomplete="nickname" data-nick="${esc(nick)}" placeholder="비워 두면 ‘${esc(nick)}’(으)로 남겨져요">`,
          }) +
          field({
            label: "비밀번호",
            hint: "나중에 고치거나 지울 때 필요해요",
            input: passwordInput({ autocomplete: "new-password", placeholder: "4자 이상" }),
          })
    return `<form class="nc-form${kind === "reply" ? " nc-inline" : ""}${isEdit ? " nc-inline" : ""}" novalidate>
      <label class="nc-sr" for="nc-${kind}-body">${isEdit ? "고칠 내용" : kind === "reply" ? "답글" : "댓글"}</label>
      <textarea id="nc-${kind}-body" name="body" rows="${kind === "new" ? 3 : 2}" maxlength="2000" placeholder="${
        kind === "reply" ? "답글을 적어 주세요" : isEdit ? "" : "한마디 남겨 주세요"
      }"${kind === "new" ? ' data-full="이 노트에 대한 생각이나 궁금한 점을 적어 주세요"' : ""} required>${esc(value)}</textarea>
      <div class="nc-row nc-row-end">
        ${who}
        <div class="nc-buttons">
          ${kind === "new" ? "" : `<button type="button" class="nc-ghost" data-act="cancel">취소</button>`}
          <button type="submit" class="nc-submit">${isEdit ? "저장" : kind === "reply" ? "답글 남기기" : "댓글 남기기"}</button>
        </div>
      </div>
      <p class="nc-status" role="status" aria-live="polite"></p>
    </form>`
  }

  // 눈 아이콘: 누르면 비밀번호 보이기/가리기 (모든 폼에 공통)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".nyuri-comments [data-eye]")
    if (!btn) return
    e.preventDefault()
    const input = document.getElementById(btn.getAttribute("aria-controls"))
    if (!input) return
    const show = input.type === "password"
    input.type = show ? "text" : "password"
    btn.setAttribute("aria-pressed", String(show))
    btn.setAttribute("aria-label", show ? "비밀번호 가리기" : "비밀번호 보기")
    btn.innerHTML = show ? EYE_OFF : EYE
    input.focus({ preventScroll: true })
  })

  function setStatus(form, text, isError) {
    const el = form.querySelector(".nc-status")
    el.textContent = text || ""
    el.classList.toggle("is-error", !!isError)
  }

  let data = { comments: [] }
  let loaded = false
  let section = null
  let readingObserver = null

  // 이 브라우저에 지난번 목록을 담아 두고, 다음 방문 땐 그걸 먼저 보여 준다
  const cacheKey = () => "nyuri-thread:" + pageKey()
  function saveCache() {
    if (!loaded) return
    store.set(
      cacheKey(),
      JSON.stringify({
        comments: data.comments.filter((c) => !c.pending),
        likes: like.likes,
        liked: like.liked,
      }),
    )
  }
  function readCache() {
    try {
      return JSON.parse(store.get(cacheKey()) || "null")
    } catch {
      return null
    }
  }

  function render() {
    // 열려 있던 칸 기억
    const open = section.querySelector(".nc-slot form")
    let keep = null
    if (open) {
      const slot = open.closest(".nc-slot")
      keep = {
        id: open.closest(".nc-item")?.dataset.id,
        kind: slot.dataset.kind,
        values: [...open.querySelectorAll("textarea, input:not([type=hidden])")].map((el) => el.value),
        focus: open.contains(document.activeElement) ? [...open.querySelectorAll("textarea, input")].indexOf(document.activeElement) : -1,
      }
    }
    drawList()
    paintCount()
    if (keep && keep.id) {
      const li = section.querySelector(`li[data-id="${CSS.escape(keep.id)}"]`)
      const trigger = li?.querySelector(`:scope > .nc-card .nc-actions [data-act="${keep.kind}"]`)
      if (li && trigger) {
        openInline(li, keep.kind, trigger, true)
        const form = li.querySelector(":scope > .nc-card .nc-slot form")
        const els = [...form.querySelectorAll("textarea, input:not([type=hidden])")]
        keep.values.forEach((v, i) => els[i] && (els[i].value = v))
        if (keep.focus >= 0) form.querySelectorAll("textarea, input")[keep.focus]?.focus({ preventScroll: true })
      }
    }
  }

  function drawList() {
    const list = section.querySelector(".nc-list")
    const tops = data.comments.filter((c) => !c.parentId)
    const visible = data.comments.filter((c) => !c.deleted).length
    section.querySelector(".nc-count").textContent = visible ? String(visible) : ""
    if (!tops.length) {
      list.innerHTML = `<li class="nc-empty">아직 댓글이 없어요. 첫 댓글을 남겨 주세요.</li>`
      return
    }
    list.innerHTML = tops.map((c) => itemHTML(c, false)).join("")
    tops.forEach((c) => {
      const ol = list.querySelector(`li[data-id="${CSS.escape(c.id)}"] > .nc-replies`)
      const replies = data.comments.filter((r) => r.parentId === c.id)
      ol.innerHTML = replies.map((r) => itemHTML(r, true)).join("")
    })
  }

  async function submitForm(form, kind, target) {
    const fd = new FormData(form)
    const body = String(fd.get("body") || "").trim()
    const password = String(fd.get("password") || "")
    const nickInput = form.querySelector('input[name="nickname"]')
    const nickname = String(fd.get("nickname") || "").trim() || nickInput?.dataset.nick || makeNick()
    const owner = adminKey()

    if (kind !== "delete" && !body) return setStatus(form, ERR.empty, true)
    if (!owner && kind !== "edit" && kind !== "delete" && password.length < 4)
      return setStatus(form, ERR.short_password, true)
    if (!owner && (kind === "edit" || kind === "delete") && !password)
      return setStatus(form, "비밀번호를 적어 주세요.", true)

    // 실패하면 이 글을 다시 열어 쓰던 내용과 이유를 보여 준다
    const fail = (e, snapshot) => {
      data.comments = snapshot
      render()
      if (kind === "new") {
        const f = section.querySelector(".nc-composer .nc-form")
        f.classList.add("is-open")
        f.querySelector("textarea").value = body
        const n = f.querySelector('input[name="nickname"]')
        if (n && nickInput && nickInput.value) n.value = nickInput.value
        setStatus(f, errText(e), true)
        f.querySelector("textarea").focus({ preventScroll: true })
        return
      }
      const li = section.querySelector(`li[data-id="${CSS.escape(target)}"]`)
      const trigger = li?.querySelector(`:scope > .nc-card .nc-actions [data-act="${kind}"]`)
      if (!li || !trigger) return
      openInline(li, kind, trigger, true)
      const f = li.querySelector(":scope > .nc-card .nc-slot form")
      const ta = f.querySelector("textarea")
      if (ta) ta.value = body
      setStatus(f, errText(e), true)
      ;(f.querySelector('input[name="password"]') || ta)?.focus({ preventScroll: true })
    }

    const snapshot = data.comments.map((c) => ({ ...c }))

    if (kind === "new" || kind === "reply") {
      const ip = (await Promise.race([window.NYURI?.ip?.() || "", new Promise((r) => setTimeout(() => r(""), 0))])) || ""
      const temp = {
        id: "tmp-" + Math.random().toString(36).slice(2),
        parentId: kind === "reply" ? target : "",
        nickname: owner ? "뉴리" : nickname.slice(0, 20),
        isOwner: !!owner,
        body,
        createdAt: new Date().toISOString(),
        edited: false,
        deleted: false,
        ip: owner ? "" : maskIp(ip),
        pending: true,
      }
      data.comments.push(temp)
      if (kind === "new") {
        form.reset()
        form.classList.remove("is-open")
        setStatus(form, "")
        // 다음 댓글은 또 다른 이름으로
        const n = form.querySelector('input[name="nickname"]')
        if (n) {
          const next = makeNick()
          n.dataset.nick = next
          n.placeholder = `비워 두면 ‘${next}’(으)로 남겨져요`
        }
      } else closeInline()
      render()
      try {
        const j = await post({
          action: "comment",
          page: pageKey(),
          title: pageTitle(),
          url: location.href.split("#")[0],
          parentId: temp.parentId,
          nickname,
          body,
          password,
          adminKey: owner,
        })
        // 그 사이 목록을 새로 받아 이미 들어와 있으면 임시 댓글만 뺀다
        if (data.comments.some((c) => c.id === j.comment.id)) data.comments = data.comments.filter((c) => c.id !== temp.id)
        else {
          const i = data.comments.findIndex((c) => c.id === temp.id)
          if (i >= 0) data.comments[i] = j.comment
          else data.comments.push(j.comment)
        }
        render()
        saveCache()
      } catch (e) {
        fail(e, snapshot)
      }
      return
    }

    const c = data.comments.find((x) => x.id === target)
    if (!c) return
    closeInline()
    if (kind === "edit") {
      Object.assign(c, { body, edited: true, pending: true })
      render()
      try {
        const j = await post({ action: "edit", id: target, body, password, adminKey: owner })
        Object.assign(data.comments.find((x) => x.id === target) || c, j.comment, { pending: false })
        render()
        saveCache()
      } catch (e) {
        fail(e, snapshot)
      }
      return
    }

    // 삭제: 답글이 남아 있으면 자리만 남기고, 아니면 바로 목록에서 뺀다
    const hasReplies = data.comments.some((r) => r.parentId === target && !r.deleted)
    if (hasReplies) Object.assign(c, { deleted: true, body: "" })
    else data.comments = data.comments.filter((x) => x.id !== target && x.parentId !== target)
    render()
    try {
      const j = await post({ action: "delete", id: target, password, adminKey: owner })
      if (j.removed) data.comments = data.comments.filter((x) => x.id !== target)
      else {
        const cur = data.comments.find((x) => x.id === target)
        if (cur) Object.assign(cur, { deleted: true, body: "" })
        else data.comments = snapshot.map((x) => (x.id === target ? { ...x, deleted: true, body: "" } : x))
      }
      render()
      saveCache()
    } catch (e) {
      fail(e, snapshot)
    }
  }

  // 화면에 미리 보여 줄 때 쓰는 IP 가리기 (서버와 같은 규칙)
  function maskIp(raw) {
    const s = String(raw || "")
    const v4 = s.match(/^(\d{1,3})\.(\d{1,3})\./)
    if (v4) return `${v4[1]}.${v4[2]}.xx.xx`
    const v6 = s.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4}):/i)
    return v6 ? `${v6[1]}:${v6[2]}:xx:xx` : ""
  }

  function closeInline() {
    section.querySelectorAll(".nc-slot").forEach((s) => (s.innerHTML = ""))
    section.querySelectorAll(".nc-actions [aria-expanded]").forEach((b) => b.setAttribute("aria-expanded", "false"))
  }

  function openInline(li, kind, trigger, restoring) {
    const already = !restoring && trigger && trigger.getAttribute("aria-expanded") === "true"
    closeInline()
    if (already) return // 같은 버튼을 다시 누르면 닫기
    const id = li.dataset.id
    const c = data.comments.find((x) => x.id === id)
    const slot = li.querySelector(":scope > .nc-card .nc-slot")
    slot.innerHTML = formHTML({ kind, value: kind === "edit" ? c.body : "" })
    slot.dataset.kind = kind
    trigger?.setAttribute("aria-expanded", "true")
    const form = slot.querySelector("form")
    form.addEventListener("submit", (e) => {
      e.preventDefault()
      submitForm(form, kind, id)
    })
    form.querySelector('[data-act="cancel"]').addEventListener("click", () => {
      closeInline()
      trigger?.focus()
    })
    if (!restoring) (form.querySelector("textarea") || form.querySelector("input"))?.focus()
  }

  // 새 댓글 입력칸: 처음엔 한 줄로 접혀 있다가, 누르면 닉네임·비밀번호까지 펼친다
  function wireComposer(form) {
    const ta = form.querySelector("textarea")
    // 접혀 있을 땐 짧은 안내, 펼치면 자세한 안내 (좁은 화면에서 잘리지 않게)
    const short = ta.placeholder
    const open = () => {
      form.classList.add("is-open")
      if (ta.dataset.full) ta.placeholder = ta.dataset.full
    }
    form.addEventListener("focusin", open)
    form.addEventListener("focusout", () => {
      setTimeout(() => {
        if (!form.contains(document.activeElement) && !ta.value.trim()) {
          form.classList.remove("is-open")
          ta.placeholder = short
        }
      }, 120)
    })
  }

  async function build() {
    document.querySelectorAll(".nyuri-comments").forEach((el) => el.remove())
    if (!api()) return
    const share = document.querySelector(".nyuri-share")
    if (!share) return // 노트 페이지가 아니면(공유 줄이 없으면) 그리지 않음

    section = document.createElement("section")
    section.className = "nyuri-comments"
    section.setAttribute("aria-labelledby", "nc-title")
    // 대화를 먼저, 입력칸은 그 아래에
    section.innerHTML = `
      <header class="nc-head">
        <h2 id="nc-title" class="nc-title" tabindex="-1">댓글</h2>
        <span class="nc-count" aria-label="댓글 수"></span>
      </header>
      <ol class="nc-list" aria-live="polite"><li class="nc-empty">댓글을 불러오는 중이에요…</li></ol>
      <div class="nc-composer">
        <img class="nc-composer-face" src="${root()}static/nyuri.svg" alt="">
        ${formHTML({ kind: "new" })}
      </div>`
    share.after(section)

    const form = section.querySelector(".nc-form")
    wireComposer(form)
    form.addEventListener("focusin", () => window.NYURI?.ip?.(), { once: true }) // 남기기 전에 미리 받아 둔다
    form.addEventListener("submit", (e) => {
      e.preventDefault()
      submitForm(form, "new")
    })
    section.querySelector(".nc-list").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]")
      if (!b || b.closest("form")) return
      openInline(b.closest(".nc-item"), b.dataset.act, b)
    })

    // 댓글을 보는 동안엔 뉴리펫이 한쪽으로 비켜선다
    readingObserver?.disconnect()
    readingObserver = new IntersectionObserver(
      ([entry]) => document.documentElement.classList.toggle("nyuri-reading-comments", entry.isIntersecting),
      { rootMargin: "-20% 0px -10% 0px" },
    )
    readingObserver.observe(section)

    const page = pageKey()
    window.NYURI?.ip?.() // 글을 남길 때 기다리지 않게 미리 받아 둔다
    loaded = false
    like.known = false
    like.seq = 0
    data = { comments: [] }
    mountLike(share.querySelector(".nyuri-share-row"))
    mountTop()
    const cached = readCache()
    if (cached) {
      data = { comments: cached.comments || [] }
      Object.assign(like, { likes: cached.likes || 0, liked: !!cached.liked, known: true })
      loaded = true
      render()
      paintLikes()
    }
    try {
      const j = await get({ action: "thread", page, clientId })
      if (page !== pageKey()) return // 그 사이 다른 페이지로 이동
      // 그 사이 남긴(아직 올리는 중인) 댓글은 지우지 않는다
      const pending = data.comments.filter((c) => c.pending && String(c.id).startsWith("tmp-"))
      data = { comments: (j.comments || []).concat(pending) }
      loaded = true
      if (!like.seq) Object.assign(like, { likes: j.likes || 0, liked: !!j.liked, known: true })
      render()
      paintLikes()
      saveCache()
    } catch {
      if (!cached)
        section.querySelector(".nc-list").innerHTML =
          '<li class="nc-empty">댓글을 불러오지 못했어요. 새로고침해 주세요.</li>'
    }
  }

  // share.js 가 공유 줄을 붙인 뒤에 그린다
  const run = () => setTimeout(build, 0)
  document.addEventListener("nav", run)
  if (document.readyState !== "loading") run()
  else document.addEventListener("DOMContentLoaded", run)
})()
