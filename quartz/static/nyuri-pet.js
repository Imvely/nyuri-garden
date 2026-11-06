// 뉴리펫: 화면 위에 사는 작은 창고 친구
// - 숨쉬듯 통통, 눈 깜빡임, 가끔 날개 파닥, 오래 가만두면 졸기
// - 끌어서 옮기기(1:1 추적, 놓으면 속도를 이어받아 가까운 가장자리로 스프링), 위치 기억
// - 랜덤 말풍선(인사 · 실제 날씨 · 안내)
// - 누르면 뉴리에게서 채팅창이 열리고, 보낸 메시지는 주인에게 메일로 전달
(() => {
  if (window.__nyuriPet) return
  window.__nyuriPet = true

  const OWNER_EMAIL = "dayeong.comp@gmail.com"
  // 백엔드(구글 앱스 스크립트) 주소는 static/nyuri-config.js 의 window.NYURI.api
  const STORE_KEY = "nyuri-pet-pos"
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")

  // ── 캐릭터 (부위별로 움직이도록 SVG 를 직접 넣음) ─────────────────
  const SVG = `
<svg viewBox="0 0 512 512" aria-hidden="true">
  <g stroke="#4a3322" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
    <ellipse class="np-shadow" cx="258" cy="462" rx="150" ry="15" fill="#4a3322" fill-opacity="0.18" stroke="none"/>
    <g class="np-body">
      <g transform="rotate(24 360 120)">
        <rect x="340" y="40" width="34" height="150" rx="6" fill="#f2c14e"/>
        <path d="M340 40 L357 6 L374 40 Z" fill="#f6dfb8"/>
        <path d="M351 18 L357 6 L363 18 Z" fill="#4a3322" stroke-width="5"/>
      </g>
      <g class="np-note" transform="rotate(-6 252 120)">
        <path d="M196 196 L202 62 Q252 52 304 60 L312 196 Z" fill="#fffaf0"/>
        <path d="M222 92 L284 90 M218 140 L270 139" stroke="#d9c7a8" stroke-width="7"/>
        <path d="M220 115 L284 113" stroke="#f2c46d" stroke-width="13" stroke-opacity="0.8"/>
      </g>
      <path d="M100 206 L152 168 L362 168 L414 206 Z" fill="#a8743f"/>
      <path class="np-flap-l" d="M100 206 L152 168 L118 108 L54 150 Z" fill="#e2b47a"/>
      <path class="np-flap-r" d="M414 206 L362 168 L396 104 L462 144 Z" fill="#e2b47a"/>
      <path d="M100 206 Q256 198 414 206 L404 440 Q256 448 110 440 Z" fill="#eec48b"/>
      <path d="M232 202 L282 202 L280 246 L234 246 Z" fill="#f8e6c8" stroke-width="6"/>
      <ellipse cx="168" cy="344" rx="26" ry="15" fill="#f2a08f" fill-opacity="0.75" stroke="none"/>
      <ellipse cx="346" cy="344" rx="26" ry="15" fill="#f2a08f" fill-opacity="0.75" stroke="none"/>
      <g class="np-eyes">
        <g class="np-eye"><ellipse cx="204" cy="306" rx="17" ry="23" fill="#4a3322" stroke="none"/><circle cx="210" cy="296" r="6.5" fill="#fffaf0" stroke="none"/></g>
        <g class="np-eye"><ellipse cx="310" cy="306" rx="17" ry="23" fill="#4a3322" stroke="none"/><circle cx="316" cy="296" r="6.5" fill="#fffaf0" stroke="none"/></g>
      </g>
      <g class="np-sleep-eyes" fill="none" stroke-width="8">
        <path d="M188 308 Q204 318 220 308"/><path d="M294 308 Q310 318 326 308"/>
      </g>
      <g class="np-happy-eyes" fill="none" stroke-width="8">
        <path d="M188 314 Q204 292 220 314"/><path d="M294 314 Q310 292 326 314"/>
      </g>
      <path class="np-mouth" d="M236 342 Q257 364 278 342" fill="none" stroke-width="8"/>
    </g>
  </g>
</svg>`

  const ICON_SEND =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>'
  const ICON_CLOSE =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'

  // ── DOM ───────────────────────────────────────────────────────
  const root = document.createElement("div")
  root.className = "nyuri-pet"
  root.setAttribute("data-persist", "")
  root.innerHTML = `
    <div class="np-bubble" role="status" aria-live="polite"></div>
    <button type="button" class="np-avatar" aria-label="뉴리에게 말 걸기 (끌어서 옮길 수 있어요)" aria-expanded="false" aria-controls="np-chat">
      <span class="np-float">${SVG}</span>
      <span class="np-zzz" aria-hidden="true">z</span>
    </button>
    <section class="np-chat" id="np-chat" role="dialog" aria-modal="false" aria-labelledby="np-chat-title" hidden>
      <header class="np-chat-head">
        <span class="np-chat-face">${SVG}</span>
        <h2 id="np-chat-title">뉴리에게 쪽지 남기기</h2>
        <button type="button" class="np-close" aria-label="닫기">${ICON_CLOSE}</button>
      </header>
      <div class="np-chat-body">
        <p class="np-guide"><span class="np-guide-hi">무엇이 궁금하세요? 적어 주시면 주인에게 메일로 전해 드려요.</span> 답장은 적어 주신 이메일로 가요.</p>
        <form class="np-form" novalidate>
          <input class="np-hp" type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">
          <label class="np-field">
            <span>메시지</span>
            <textarea name="message" rows="4" maxlength="2000" placeholder="예: I-FAS 노트에서 GAC 부분이 궁금해요" required></textarea>
          </label>
          <label class="np-field">
            <span>답장 받을 이메일</span>
            <input type="email" name="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required>
          </label>
          <p class="np-status" role="status" aria-live="polite"></p>
          <button type="submit" class="np-send">${ICON_SEND}<span>메일 보내기</span></button>
        </form>
        <div class="np-done" hidden>
          <p class="np-done-title">메일을 보냈어요</p>
          <p class="np-done-text"></p>
          <button type="button" class="np-again">하나 더 보내기</button>
        </div>
      </div>
    </section>`
  document.body.appendChild(root)

  const avatar = root.querySelector(".np-avatar")
  const bubble = root.querySelector(".np-bubble")
  const chat = root.querySelector(".np-chat")
  // 채팅창은 root(transform 으로 움직임) 밖에 둬야 모바일 하단 시트가 화면 기준으로 붙는다
  chat.setAttribute("data-persist", "")
  document.body.appendChild(chat)

  // 글을 옮겨 다닐 때 사이트가 body 내용을 새 페이지로 바꿔 끼우면서 뉴리펫도 같이 빠진다.
  // 빠지는 즉시 다시 붙여서 어느 페이지에서든 계속 보이게 한다 (위치·상태는 그대로).
  const keepMounted = () => {
    if (!root.isConnected) document.body.appendChild(root)
    if (!chat.isConnected) document.body.appendChild(chat)
  }
  new MutationObserver(keepMounted).observe(document.body, { childList: true })
  document.addEventListener("nav", keepMounted)
  const form = chat.querySelector(".np-form")
  const done = chat.querySelector(".np-done")
  const statusEl = chat.querySelector(".np-status")
  const textarea = form.querySelector("textarea")
  const emailInput = form.querySelector('input[type="email"]')

  // ── 위치: transform 으로만 움직인다 ──────────────────────────
  const MARGIN = 16
  const size = () => avatar.getBoundingClientRect().width || 84
  const bounds = () => ({
    minX: MARGIN,
    maxX: window.innerWidth - size() - MARGIN,
    minY: MARGIN,
    maxY: window.innerHeight - size() - MARGIN,
  })
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
  let pos = { x: 0, y: 0 }

  function apply() {
    root.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
    const b = bounds()
    // 화면 왼쪽 절반이면 말풍선·채팅창을 오른쪽으로 펼친다
    root.dataset.side = pos.x + size() / 2 < window.innerWidth / 2 ? "left" : "right"
    root.dataset.vert = pos.y + size() / 2 < window.innerHeight / 2 ? "top" : "bottom"
    void b
    if (!chat.hidden) placeChat()
  }

  // 채팅창을 뉴리 옆에 놓고, 뉴리 쪽 모서리에서 커지도록 transform-origin 을 맞춘다
  // 폭이 좁거나 높이가 낮은 화면(휴대폰 가로)은 아래에서 올라오는 시트
  const SHEET = window.matchMedia("(max-width: 800px), (max-height: 560px)")
  function placeChat() {
    const s = size()
    if (SHEET.matches) {
      chat.classList.add("is-sheet")
      chat.style.left = chat.style.top = ""
      chat.style.transformOrigin = ""
      return
    }
    chat.classList.remove("is-sheet")
    const w = chat.offsetWidth || 360
    const h = chat.offsetHeight || 480
    const gap = 12
    let left = root.dataset.side === "right" ? pos.x + s - w : pos.x
    let top = root.dataset.vert === "bottom" ? pos.y - gap - h : pos.y + s + gap
    left = clamp(left, MARGIN, window.innerWidth - w - MARGIN)
    top = h > window.innerHeight - MARGIN * 2 ? MARGIN : clamp(top, MARGIN, window.innerHeight - h - MARGIN)
    chat.style.left = left + "px"
    chat.style.top = top + "px"
    const ox = clamp(pos.x + s / 2 - left, 0, w)
    const oy = clamp(pos.y + s / 2 - top, 0, h)
    chat.style.transformOrigin = `${ox}px ${oy}px`
  }

  function restore() {
    const b = bounds()
    let saved = null
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null")
    } catch {}
    if (saved && typeof saved.rx === "number") {
      pos.x = clamp(saved.rx * window.innerWidth - size() / 2, b.minX, b.maxX)
      pos.y = clamp(saved.ry * window.innerHeight, b.minY, b.maxY)
    } else {
      pos.x = b.maxX
      pos.y = b.maxY - 8
    }
    apply()
  }

  function save() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ rx: (pos.x + size() / 2) / window.innerWidth, ry: pos.y / window.innerHeight }),
      )
    } catch {}
  }

  // ── 스프링: 현재 값과 속도에서 출발, 언제든 다시 잡을 수 있음 ────
  let springRaf = 0
  function springTo(target, velocity = { x: 0, y: 0 }) {
    cancelAnimationFrame(springRaf)
    if (reduce.matches) {
      pos = { ...target }
      apply()
      save()
      return
    }
    // 던졌을 때만 살짝 튕김(감쇠비 ~0.8), 아니면 거의 임계 감쇠
    const thrown = Math.hypot(velocity.x, velocity.y) > 400
    const stiffness = 260
    const damping = thrown ? 2 * 0.8 * Math.sqrt(stiffness) : 2 * 1.0 * Math.sqrt(stiffness)
    let v = { ...velocity }
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      for (const k of ["x", "y"]) {
        const f = -stiffness * (pos[k] - target[k]) - damping * v[k]
        v[k] += f * dt
        pos[k] += v[k] * dt
      }
      apply()
      const done =
        Math.abs(pos.x - target.x) < 0.5 &&
        Math.abs(pos.y - target.y) < 0.5 &&
        Math.abs(v.x) < 8 &&
        Math.abs(v.y) < 8
      if (done) {
        pos = { ...target }
        apply()
        save()
      } else springRaf = requestAnimationFrame(step)
    }
    springRaf = requestAnimationFrame(step)
  }

  // Apple 의 관성 투사: 손을 놓은 속도로 어디까지 갈지 계산
  const project = (v, rate = 0.998) => ((v / 1000) * rate) / (1 - rate)
  // 경계 밖으로 끌면 점점 덜 따라온다
  const rubber = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over))

  // ── 끌기 / 탭 ────────────────────────────────────────────────
  let drag = null
  let taps = []
  let secretTimer = 0
  avatar.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return
    cancelAnimationFrame(springRaf)
    try {
      try {
        avatar.setPointerCapture(e.pointerId)
      } catch {}
    } catch {}
    drag = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: e.clientX - pos.x, // 잡은 지점 유지
      oy: e.clientY - pos.y,
      moved: false,
      hist: [{ x: e.clientX, y: e.clientY, t: performance.now() }],
    }
    root.classList.add("is-pressed")
    walking = false
    convoTimers.forEach(clearTimeout)
    wake()
  })

  avatar.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return
    if (!drag.moved) {
      drag.moved = true
      root.classList.add("is-dragging")
      hideBubble()
      if (!chat.hidden) closeChat(false)
      if (Math.random() < 0.5) say(pick(LINES.act.lift), 1800, true)
    }
    const b = bounds()
    let x = e.clientX - drag.ox
    let y = e.clientY - drag.oy
    if (x < b.minX) x = b.minX - rubber(b.minX - x, window.innerWidth)
    if (x > b.maxX) x = b.maxX + rubber(x - b.maxX, window.innerWidth)
    if (y < b.minY) y = b.minY - rubber(b.minY - y, window.innerHeight)
    if (y > b.maxY) y = b.maxY + rubber(y - b.maxY, window.innerHeight)
    pos = { x, y }
    apply()
    drag.hist.push({ x: e.clientX, y: e.clientY, t: performance.now() })
    if (drag.hist.length > 6) drag.hist.shift()
  })

  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return
    root.classList.remove("is-pressed", "is-dragging")
    const wasDrag = drag.moved
    const h = drag.hist
    drag = null
    if (!wasDrag) {
      if (cancelled) return
      // 짧은 시간에 여러 번 누르면 채팅 대신 투정
      const t = Date.now()
      taps = taps.filter((x) => t - x < 2500)
      taps.push(t)
      clearTimeout(secretTimer)
      if (taps.length >= 5) {
        closeChat(false)
        setTimeout(() => talk(pick(LINES.act.tease)), 340)
        // 정말 그만 누르면 비밀을 알려 준다
        if (!quietDay())
          secretTimer = setTimeout(() => {
            taps = []
            talk(pick(LINES.act.secret))
          }, 4500)
        return
      }
      if (taps.length >= 3) {
        closeChat(false)
        setTimeout(() => talk(pick(LINES.act.dizzy)), 340)
        return
      }
      toggleChat()
      return
    }
    // 놓는 순간의 속도: 직전 90ms 안의 움직임만 본다.
    // 손을 멈췄다가 놓으면(마지막 움직임이 70ms 넘게 지났으면) 속도 0 → 놓은 자리에 그대로.
    const now = performance.now()
    const recent = h.filter((p) => now - p.t < 90)
    const last = h[h.length - 1]
    let vel = { x: 0, y: 0 }
    if (recent.length >= 2 && now - last.t < 70) {
      const a = recent[0]
      const z = recent[recent.length - 1]
      const dt = Math.max(16, z.t - a.t) / 1000
      vel = { x: (z.x - a.x) / dt, y: (z.y - a.y) / dt }
    }
    placedAt = Date.now()
    const speed = Math.hypot(vel.x, vel.y)
    const thrown = speed > 650 // 휙 던졌을 때만 관성으로 날아간다
    const b = bounds()
    const cap = (v) => clamp(project(v, 0.997), -360, 360)
    const px = thrown ? pos.x + cap(vel.x) : pos.x
    const py = thrown ? pos.y + cap(vel.y) : pos.y
    // 화면 밖으로 끌어 놓았으면 화면 안으로만 살짝 돌아온다
    const target = { x: clamp(px, b.minX, b.maxX), y: clamp(py, b.minY, b.maxY) }
    springTo(target, thrown ? vel : { x: 0, y: 0 })
    const fast = speed > 900 && !quietDay()
    // 구석에 두면 아늑, 글 위에 두면 비켜 줄게요
    const inCorner =
      (target.x - b.minX < 6 || b.maxX - target.x < 6) && (target.y - b.minY < 6 || b.maxY - target.y < 6)
    const art = document.querySelector(".center article")?.getBoundingClientRect()
    const s = size()
    const cx = target.x + s / 2
    const cy = target.y + s / 2
    const overText = art && cx > art.left && cx < art.right && cy > Math.max(0, art.top) && cy < Math.min(window.innerHeight, art.bottom)
    const A = LINES.act
    const line = fast ? pick(A.thrown) : inCorner ? pick(A.corner) : overText && Math.random() < 0.6 ? pick(A.overText) : pick(A.drop)
    setTimeout(() => talk(line), 450)
  }
  avatar.addEventListener("pointerup", (e) => endDrag(e, false))
  avatar.addEventListener("pointercancel", (e) => endDrag(e, true))
  avatar.addEventListener("lostpointercapture", () => {
    if (drag) {
      root.classList.remove("is-pressed", "is-dragging")
      drag = null
    }
  })
  // 키보드: Enter/Space 는 button 기본 동작(click)으로 처리
  avatar.addEventListener("click", (e) => {
    if (e.detail === 0) toggleChat() // 키보드로 누른 경우만 (포인터는 pointerup 에서 처리)
  })

  // 창 크기, 화면 돌림, 휴대폰 키보드: 늘 화면 안으로 다시 들인다
  const keepInside = () => {
    const b = bounds()
    pos.x = clamp(pos.x, b.minX, b.maxX)
    pos.y = clamp(pos.y, b.minY, b.maxY)
    apply()
  }
  window.addEventListener("resize", keepInside)
  window.addEventListener("orientationchange", () => setTimeout(keepInside, 250))
  window.visualViewport?.addEventListener("resize", keepInside)

  // ── 살아 있는 느낌: 깜빡임 · 날개 · 졸기 ──────────────────────
  function schedule(fn, min, max) {
    const t = setTimeout(
      () => {
        fn()
        schedule(fn, min, max)
      },
      min + Math.random() * (max - min),
    )
    return t
  }
  const pulse = (cls, ms) => {
    if (reduce.matches || root.classList.contains("is-sleeping")) return
    root.classList.add(cls)
    setTimeout(() => root.classList.remove(cls), ms)
  }
  schedule(() => pulse("is-blinking", 180), 2800, 6200)
  schedule(() => pulse("is-flapping", 700), 14000, 30000)

  let idleTimer = 0
  let dozeTimer = 0
  function wake() {
    const wasAsleep = root.classList.contains("is-sleeping")
    root.classList.remove("is-sleeping")
    clearTimeout(idleTimer)
    clearTimeout(dozeTimer)
    if (wasAsleep) setTimeout(() => talk(pick(LINES.self.wake)), 300)
    // 한참 아무것도 안 하면: 하품 → 쿨쿨 → 잠
    dozeTimer = setTimeout(() => {
      if (chat.hidden && !drag) talk(pick(LINES.self.doze))
    }, 80000)
    idleTimer = setTimeout(() => {
      if (!chat.hidden || drag) return
      convoTimers.forEach(clearTimeout)
      say(pick(LINES.self.sleep), 2200)
      idleTimer = setTimeout(() => {
        if (!chat.hidden) return
        root.classList.add("is-sleeping")
        hideBubble()
      }, 2400)
    }, 90000)
  }
  ;["pointermove", "keydown", "scroll", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, wake, { passive: true }),
  )
  wake()

  // ── 말풍선 ──────────────────────────────────────────────────
  let bubbleTimer = 0
  function say(text, ms = 5200, force = false) {
    if (!chat.hidden || (!force && (root.classList.contains("is-sleeping") || drag))) return
    bubble.textContent = text
    root.classList.add("has-bubble")
    clearTimeout(bubbleTimer)
    bubbleTimer = setTimeout(hideBubble, ms)
  }
  function hideBubble() {
    root.classList.remove("has-bubble")
    clearTimeout(bubbleTimer)
  }
  bubble.addEventListener("click", () => {
    hideBubble()
    openChat()
  })

  const WEATHER = [
    [[0], "맑아요"],
    [[1, 2], "구름이 조금 있어요"],
    [[3], "흐려요"],
    [[45, 48], "안개가 꼈어요"],
    [[51, 53, 55, 56, 57], "이슬비가 내려요"],
    [[61, 63, 65, 66, 67], "비가 와요"],
    [[71, 73, 75, 77], "눈이 와요"],
    [[80, 81, 82], "소나기가 와요"],
    [[85, 86], "눈발이 날려요"],
    [[95, 96, 99], "천둥번개가 쳐요"],
  ]
  let weatherLine = null
  const weatherNow = { code: -1, temp: 15 }
  // 방문자가 있는 도시: IP 로 대략 짐작한다(권한 창 없음, 시 단위). 실패하면 서울.
  // 한 번 찾은 곳은 이 탭에서 한 시간 동안 다시 묻지 않는다.
  async function locate() {
    try {
      const c = JSON.parse(sessionStorage.getItem("nyuri-place") || "null")
      if (c && Date.now() - c.t < 3600e3) return c
    } catch {}
    let p = { name: "서울", lat: 37.5665, lon: 126.978 }
    try {
      const r = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=ko")
      const j = await r.json()
      const name = String(j.city || j.principalSubdivision || j.locality || "")
        .replace(/(특별자치시|특별자치도|특별시|광역시)$/, "")
        .trim()
      if (name && Number.isFinite(j.latitude) && Number.isFinite(j.longitude))
        p = { name, lat: j.latitude, lon: j.longitude }
    } catch {}
    p.t = Date.now()
    try {
      sessionStorage.setItem("nyuri-place", JSON.stringify(p))
    } catch {}
    return p
  }
  // 받침이 있으면 "은", 없으면 "는"
  const topic = (w) => {
    const c = w.charCodeAt(w.length - 1) - 0xac00
    return c >= 0 && c < 11172 && c % 28 ? `${w}은` : `${w}는`
  }
  async function loadWeather() {
    try {
      const p = await locate()
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(3)}&longitude=${p.lon.toFixed(3)}&current=temperature_2m,weather_code&timezone=auto`,
      )
      const j = await r.json()
      const c = j.current
      const desc = (WEATHER.find(([codes]) => codes.includes(c.weather_code)) || [null, "날씨가 궁금하네요"])[1]
      weatherNow.code = c.weather_code
      weatherNow.temp = c.temperature_2m
      weatherLine = `오늘 ${topic(p.name)} ${desc}. 지금 ${Math.round(c.temperature_2m)}°C예요`
    } catch {
      weatherLine = null
    }
  }
  loadWeather()
  // 오래 머무는 동안에도 날씨가 맞도록 30분마다 새로 받는다
  setInterval(loadWeather, 30 * 60e3)

  // ── 대사 묶음 (기획: 50 아이디어/뉴리펫 대사 기획) ─────────────────
  // 한 줄은 문자열, 이어서 말할 두 줄은 배열. 특수기호(물결, 말줄임, 이모지)는 쓰지 않는다.
  const LINES = {
    greet: {
      first: [
        ["안녕하세요, 뉴리예요!", "여기 노트들을 지키는 창고 친구예요"],
        ["반가워요, 저는 상자 뉴리예요", "궁금한 건 저를 눌러 물어보세요"],
      ],
      again: ["또 왔네요! 반가워요", "어서 와요, 기다렸어요!", "오늘도 놀러 와 줬네요"],
      today: ["또 보네요, 오늘 바쁘시구나", "금방 다시 왔네요!"],
      week: ["오랜만이에요! 보고 싶었어요", "그동안 창고 잘 지키고 있었어요"],
      month: [["우와, 정말 오랜만이에요", "새 노트가 있는지 볼까요?"]],
    },
    time: {
      dawn: [["이 시간까지 공부 중이세요?", "너무 무리하지는 마요"], "다들 자는 시간인데 같이 깨어 있네요", "조금만 보고 꼭 자기로 약속해요"],
      morning: ["좋은 아침이에요!", "아침에 읽는 논문이 제일 잘 들어온대요", "출근길이세요? 오늘도 힘내요"],
      forenoon: ["오전 공부 화이팅이에요!", "커피 한 잔 하면서 천천히 읽어요"],
      lunch: [["점심은 맛있게 드셨어요?", "저는 종이 상자라 쪽지를 먹어요"], "밥 먹고 잠깐 산책하는 것도 좋아요"],
      afternoon: [["오후엔 졸리죠?", "저도 가끔 꾸벅꾸벅 졸아요"], "기지개 한 번 켜고 이어서 해요", "간식 시간이에요. 뭐 드세요?"],
      evening: ["오늘 하루도 수고 많았어요", "저녁 먹고 가볍게 한 편 읽어 볼까요?"],
      night: [["밤이 깊었네요", "읽던 건 저장해 두고 푹 자요"], "오늘 읽은 것 중에 하나만 기억해도 충분해요"],
    },
    // 0 일요일 ~ 6 토요일
    weekday: [
      ["일요일 오후는 늘 짧아요", "내일 걱정은 내일 해요"],
      ["월요일이에요. 천천히 시동 걸어요", "한 주의 첫날, 같이 힘내요"],
      ["화요일은 의외로 집중이 잘 되는 날이래요"],
      ["벌써 한 주의 반이에요", "수요일, 반은 왔어요!"],
      ["목요일이에요. 조금만 더 버텨요"],
      ["금요일이다! 이번 주도 고생 많았어요", "주말 계획 있으세요?"],
      ["주말에도 공부하러 왔어요? 대단해요", "오늘은 느긋하게 한 편만 읽어요"],
    ],
    season: {
      spring: ["봄바람이 상자 안까지 들어와요", "꽃 피는 계절이에요. 창밖 한 번 봐요"],
      summer: ["더운 날엔 시원한 물 자주 마셔요"],
      rainy: ["상자가 눅눅해지는 장마철이에요"],
      autumn: ["책 읽기 좋은 계절이에요", "낙엽 소리 들으면서 노트 정리해요"],
      winter: ["손 시리죠? 따뜻하게 하고 읽어요", "상자 안이 제일 따뜻해요"],
    },
    month: {
      1: ["새해 다짐 잘 지키고 있어요?"],
      3: ["새 학기 시작이에요. 다시 출발해요"],
      9: ["다시 공부하기 좋은 9월이에요"],
      12: ["올해도 거의 다 왔어요", "올해 쓴 노트, 한 번 돌아볼까요?"],
    },
    special: {
      "1-1": ["새해 복 많이 받으세요!", "올해도 창고 잘 지킬게요"],
      seol: ["떡국 드셨어요? 한 살 더 먹었네요", "명절에도 들러 줘서 고마워요"],
      "2-14": ["오늘은 초콜릿 대신 쪽지를 주세요"],
      "4-1": ["오늘 저는 상자가 아니에요. 사실 상자예요"],
      "5-5": ["어린이날이에요. 마음만은 다 어린이죠"],
      "5-15": ["스승의 날이에요. 고마운 분 떠오르세요?"],
      "6-6": ["오늘은 조용히 지낼게요"],
      "8-15": ["광복절이에요. 태극기 다셨어요?"],
      chuseok: ["송편 드셨어요? 보름달 꼭 봐요", "연휴엔 푹 쉬어도 괜찮아요"],
      "10-9": ["한글날이에요. 오늘은 더 예쁜 말만 할게요"],
      "10-31": ["오늘은 유령 상자로 변장했어요"],
      "11-11": ["빼빼로 대신 노트 한 편 어때요?"],
      "12-24": ["산타가 상자에 선물 넣어 줄까요?"],
      "12-25": ["메리 크리스마스!"],
      "12-31": ["올해도 같이해 줘서 고마워요", "내년에도 잘 부탁해요"],
    },
    weather: {
      clear: ["산책하기 좋은 날이에요"],
      cloud: ["해가 숨바꼭질하네요"],
      rain: ["우산 챙기셨어요?", "빗소리 들으면서 읽기 좋아요"],
      snow: ["눈 오는 날엔 상자 안이 최고예요"],
      fog: ["길이 뿌옇대요. 조심히 다녀요"],
      thunder: ["우르릉, 저 조금 무서워요"],
      freezing: ["꽁꽁 언 날이에요. 장갑 꼭 끼어요"],
      hot: ["너무 더워요. 상자가 녹을 것 같아요"],
    },
    page: {
      home: ["점을 누르면 그 노트로 가요", "그래프 점을 끌어서 흔들어 봐요", "가운데 상자가 저예요!"],
      paperList: ["논문 노트가 모여 있는 칸이에요"],
      tag: ["같은 태그끼리 모아 봤어요"],
      empty: ["여긴 아직 비어 있어요. 곧 채울게요"],
      lost: [["어라, 길을 잃었나 봐요", "아래 버튼 누르면 처음으로 데려다줄게요"]],
      mobile: ["손가락으로 저를 끌어서 옮겨 봐요"],
    },
    act: {
      // 채팅창을 열 때 안내 첫 문장
      open: ["무엇이 궁금하세요? 적어 주시면 주인에게 메일로 전해 드려요.", "쪽지 남겨 주면 주인에게 전할게요."],
      dizzy: ["어지러워요, 살살 눌러 줘요"],
      tease: ["그만 누르면 비밀 하나 알려 줄게요"],
      secret: [["비밀인데요", "저 사실 상자 안이 조금 좁아요"], ["비밀인데요", "제일 좋아하는 건 새 테이프예요"]],
      hover: ["안녕하세요!", "불렀어요?"],
      tickle: ["히히 간지러워요!", "꺄르르, 그만", "앗 간지러!", "헤헤헤 간질간질"],
      pet: ["기분 좋아요", "쓰담쓰담 좋아요", "헤헤, 따뜻해요"],
      lift: ["어디 가요?", "우와, 들렸다!"],
      drop: ["여기로 이사!", "고마워요", "자리 좋네요"],
      thrown: ["우와 날았다!", "어지러워요", "슝!"],
      corner: ["구석이 아늑해요"],
      overText: ["글 가리면 말해 줘요, 비켜 줄게요"],
      like: ["고마워요!", "우와, 좋아요 받았다!", "힘이 나요!"],
      unlike: ["앗, 마음이 바뀌었군요"],
      comment: ["댓글 고마워요! 주인이 꼭 읽을 거예요"],
      reply: ["이야기가 이어지네요"],
      edit: ["고쳤어요. 이제 딱 좋네요"],
      remove: ["지웠어요. 언제든 다시 써 주세요"],
      mailSent: ["쪽지 잘 전할게요!"],
      mailFail: ["앗, 쪽지가 길을 잃었어요"],
      copied: ["링크 복사했어요. 어디에 붙일 거예요?"],
      shared: ["널리 알려 줘서 고마워요"],
      dark: ["불 껐다! 눈이 편해요"],
      light: ["불 켰다! 환해요"],
      search: ["뭘 찾으세요? 같이 찾아요"],
      hub: ["저 여기 있어요!"],
      fastScroll: ["천천히 읽어요, 어디 안 가요"],
      back: [["어디 갔다 왔어요?", "보고 싶었어요"], "돌아왔네요! 이어서 읽어요"],
      end: [["끝까지 다 읽으셨네요!", "도움이 됐다면 아래에서 공유해 주세요"], ["다 읽었다!", "수고했어요, 짝짝짝"]],
      endFirst: [["다 읽었다!", "첫 댓글의 주인공이 되어 볼래요?"]],
    },
    self: {
      walkStart: ["잠깐 산책 다녀올게요", "영차영차"],
      walkEnd: ["여기가 좋겠다!", "영차영차", "산책 끝!", "이 자리 마음에 들어요"],
      hop: ["깡충!"],
      doze: ["하암, 조금 졸려요"],
      sleep: ["쿨쿨"],
      wake: ["앗, 졸았어요!", "깼어요, 다시 놀아요"],
    },
    chat: {
      keeper: [["사실 저는 이 사이트 창고지기예요", "노트들이 다 제 안에 들어 있어요"], "오늘 쪽지 정리했어요", "상자 안에서 노트 냄새가 나요", "테이프 다시 붙이는 중이에요"],
      cheer: ["오늘은 어떤 걸 공부하세요?", "하나씩 하다 보면 금방이에요", "모르는 건 부끄러운 게 아니에요"],
      health: ["물 한 잔 마시고 와요", "어깨 한 번 쭉 펴 볼까요?", "눈도 잠깐 쉬어 줘요", "오래 앉아 있었죠? 일어나 걸어 봐요"],
      monologue: ["흠흠, 콧노래 중", "조금 심심하다", "여기 따뜻하다", "상자 모서리가 간지러워요"],
      tips: [
        ["궁금한 건 뭐든 저에게 물어보세요", "주인에게 메일로 전해 드릴게요"],
        "저를 끌어서 원하는 곳에 둘 수 있어요",
        "새 노트가 올라오면 RSS로 받아볼 수 있어요",
        "왼쪽 메뉴에서 다른 노트도 둘러봐요",
        "마음에 드는 글엔 하트를 눌러 주세요",
      ],
    },
  }

  // ── 대사 고르기: 최근에 한 말 10개는 다시 고르지 않는다 (페이지 안에서만 기억) ──
  const recentLines = []
  const lineKey = (l) => (Array.isArray(l) ? l[0] : l)
  const remember = (l) => {
    recentLines.push(lineKey(l))
    if (recentLines.length > 10) recentLines.shift()
  }
  const pick = (arr) => {
    const fresh = arr.filter((l) => !recentLines.includes(lineKey(l)))
    const pool = fresh.length ? fresh : arr
    return pool[Math.floor(Math.random() * pool.length)]
  }

  // 대화 한 묶음: 여러 줄을 사이를 두고 이어서 말한다
  let convoTimers = []
  function talk(lines) {
    if (!lines) return
    convoTimers.forEach(clearTimeout)
    convoTimers = []
    remember(lines)
    const seq = Array.isArray(lines) ? lines : [lines]
    let t = 0
    seq.forEach((line, i) => {
      const ms = Math.min(6500, 2600 + line.length * 70)
      convoTimers.push(
        setTimeout(() => {
          say(line, ms)
          if (i === 0) hop()
        }, t),
      )
      t += ms + 450
    })
  }

  // ── 때: 방문자 기기와 상관없이 한국 시간 기준 ─────────────────────
  const kst = () => {
    const d = new Date(Date.now() + 9 * 3600e3)
    return {
      y: d.getUTCFullYear(),
      m: d.getUTCMonth() + 1,
      d: d.getUTCDate(),
      h: d.getUTCHours(),
      w: d.getUTCDay(),
      day: Math.floor(d.getTime() / 86400e3),
    }
  }
  // 음력 명절(당일). 앞뒤 하루까지 연휴로 본다. 해가 지나면 다음 해를 더한다.
  const LUNAR = {
    2026: { seol: [2, 17], chuseok: [9, 25] },
    2027: { seol: [2, 7], chuseok: [9, 15] },
    2028: { seol: [1, 27], chuseok: [10, 3] },
  }
  const BIRTH = { y: 2026, m: 11, d: 5 } // 뉴리의창고 문 연 날
  function specialLines() {
    const t = kst()
    const today = Date.UTC(t.y, t.m - 1, t.d)
    const near = (md) => md && Math.abs(today - Date.UTC(t.y, md[0] - 1, md[1])) <= 86400e3
    const lunar = LUNAR[t.y]
    if (near(lunar?.seol)) return LINES.special.seol
    if (near(lunar?.chuseok)) return LINES.special.chuseok
    if (t.m === BIRTH.m && t.d === BIRTH.d) {
      const n = t.y - BIRTH.y
      return n > 0 ? [["오늘은 뉴리의창고 생일이에요!", `창고 문 연 지 벌써 ${n}년이에요`]] : ["오늘은 뉴리의창고 생일이에요!"]
    }
    return LINES.special[`${t.m}-${t.d}`] || null
  }
  // 현충일에는 장난스러운 말은 쉰다
  const quietDay = () => {
    const t = kst()
    return t.m === 6 && t.d === 6
  }
  function timeLines() {
    const h = kst().h
    const T = LINES.time
    return h < 5 ? T.dawn : h < 9 ? T.morning : h < 12 ? T.forenoon : h < 14 ? T.lunch : h < 18 ? T.afternoon : h < 22 ? T.evening : T.night
  }
  function seasonLines() {
    const m = kst().m
    const S = LINES.season
    const base = m >= 3 && m <= 5 ? S.spring : m >= 6 && m <= 8 ? S.summer : m >= 9 && m <= 11 ? S.autumn : S.winter
    const extra = m === 6 || m === 7 ? S.rainy : []
    return [...base, ...extra, ...(LINES.month[m] || [])]
  }

  const pageTitle = () =>
    (document.querySelector("h1.article-title")?.textContent || "").trim().replace(/\s+/g, " ")
  const slug = () => decodeURIComponent(document.body.dataset.slug || "")
  const isNote = () => slug() !== "index" && !!document.querySelector("h1.article-title")
  const scrollRatio = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    return max > 0 ? window.scrollY / max : 0
  }
  const coarse = window.matchMedia("(pointer: coarse)")
  // 지금 페이지가 어떤 곳인지: 404, 홈, 논문 노트 목록, 태그, 빈 폴더
  function pageLines() {
    const s = slug()
    const P = LINES.page
    if (s === "404") return P.lost
    if (s === "index") return P.home
    if (/^논문-노트(\/index)?$/.test(s)) return P.paperList
    if (/^tags(\/|$)/.test(s)) return P.tag
    const listing = document.querySelector(".center .page-listing")
    if (listing && !listing.querySelector("li") && !isPrivate()) return P.empty
    return null
  }
  const zeroComments = () => /^아직 댓글이 없어요/.test(document.querySelector(".nc-list .nc-empty")?.textContent || "")

  // 상황별 대사. 함수는 그때그때 상황을 보고 null 이면 건너뛴다.
  // ── 비공개 프로젝트 안에서 하는 말 (share.js 가 body 에 data-private 를 단다) ──
  const isPrivate = () => !!document.body.dataset.private
  function privateLines() {
    const slug = decodeURIComponent(document.body.dataset.slug || "")
    const project = /얼굴-위조-방지/.test(slug) ? "face" : /번호판/.test(slug) ? "plate" : ""
    const last = slug.replace(/\/index$/, "").split("/").pop() || ""
    const bySection = {
      "실험": [["실험 노트가 잔뜩 들어 있는 칸이에요", "지금은 잠가 뒀어요"], "실험 기록은 아직 상자 안에 꼭꼭"],
      "결과": ["결과는 공개하는 날 짠 하고 보여 드릴게요", ["결과 칸이에요", "숫자는 아직 비밀이에요"]],
      "개념": [["개념 정리도 같이 묶어 뒀어요", "열리면 쉽게 풀어서 보여 드릴게요"]],
      "첨부": ["그래프랑 그림도 상자 안에 넣어 뒀어요", ["그림 칸이에요", "지금은 테이프로 붙여 놨어요"]],
      "00-허브": [["여기가 연구 전체 지도인데요", "지금은 접어 둔 상태예요"]],
      "01-계획": ["다음 계획은 저만 알고 있을게요", ["계획표도 잠겨 있어요", "궁금해도 조금만 참아 주세요"]],
    }
    const byProject = {
      face: [["진짜 얼굴과 가짜 얼굴을 가려내는 연구예요", "자세한 건 공개되면 보여 드릴게요"], "얼굴 위조 방지 연구는 아직 비밀 상자 속이에요"],
      plate: [["차량 번호판을 읽어 내는 연구예요", "내용은 아직 상자 안에 있어요"], "번호판 연구도 공개 전이라 잠가 뒀어요"],
    }
    const general = [
      ["여긴 아직 테이프를 안 뜯은 상자예요", "공개하는 날 제일 먼저 열어 드릴게요"],
      ["쉿, 공개 전 연구 결과예요", "지금은 제가 꼭 안고 있어요"],
      "자물쇠가 단단히 잠겨 있네요",
      ["궁금하죠? 저도 말하고 싶어서 근질근질해요", "조금만 기다려 주세요"],
      "이 상자는 제가 지키고 있어요",
      ["안에 뭐가 들었는지는 비밀", "힌트도 아직 안 돼요"],
      ["여기까지 찾아오셨네요", "열리면 꼭 다시 놀러 와요"],
      ["다른 노트는 열려 있어요", "왼쪽 메뉴에서 골라 보세요"],
    ]
    return [...(bySection[last] || []), ...(byProject[project] || []), ...general]
  }

  function weatherTalk() {
    if (!weatherLine) return null
    const W = LINES.weather
    const c = weatherNow.code
    const tail =
      weatherNow.temp < 0 ? W.freezing
      : weatherNow.temp >= 30 ? W.hot
      : c === 0 ? W.clear
      : c <= 3 ? W.cloud
      : c === 45 || c === 48 ? W.fog
      : c >= 95 ? W.thunder
      : (c >= 71 && c <= 77) || c === 85 || c === 86 ? W.snow
      : W.rain
    return [weatherLine, pick(tail)]
  }

  const TOPICS = [
    () => (isPrivate() ? pick(privateLines()) : null),
    () => (isPrivate() ? pick(privateLines()) : null),
    () => pick(timeLines()),
    () => pick(LINES.weekday[kst().w]),
    () => pick(seasonLines()),
    () => weatherTalk(),
    () => {
      const p = pageLines()
      return p ? pick(p) : null
    },
    () => (isNote() && !isPrivate() ? [`「${pageTitle()}」 읽고 계시네요!`, "궁금한 데가 있으면 저를 눌러 물어보세요"] : null),
    () => {
      if (!isNote() || isPrivate()) return null
      const r = scrollRatio()
      if (r > 0.9) return LINES.act.end[0]
      if (r > 0.45) return "벌써 반이나 읽었어요. 잠깐 쉬어 가도 좋아요"
      if (r < 0.08) return "위에 마인드맵부터 훑어보면 금방 이해돼요"
      return null
    },
    () =>
      document.querySelector(".callout a[data-router-ignore]")
        ? ["마인드맵은 크게 열어서 볼 수 있어요", "확대해서 보기를 눌러 보세요"]
        : null,
    () => pick(LINES.chat.keeper),
    () => pick(LINES.chat.cheer),
    () => pick(LINES.chat.health),
    () => (quietDay() ? null : pick(LINES.chat.monologue)),
    () => pick(LINES.chat.tips),
    () =>
      document.documentElement.getAttribute("saved-theme") === "dark"
        ? "밤에는 어두운 화면이 눈에 편해요"
        : "밝은 화면도 산뜻하네요",
    () => (coarse.matches ? pick(LINES.page.mobile) : null),
  ]

  // 글을 읽는 중(막 스크롤했거나 글을 쓰는 중)에는 잡담을 쉰다
  let lastScrollAt = 0
  const busyReading = () => {
    const a = document.activeElement
    return Date.now() - lastScrollAt < 4000 || !!(a && /^(TEXTAREA|INPUT)$/.test(a.tagName) && !chat.contains(a))
  }
  let lastTopic = -1
  function chatter() {
    if (!chat.hidden || drag || walking || busyReading()) return
    // 특별한 날이면 잡담 세 번 중 한 번 정도는 그날 이야기
    const sp = specialLines()
    if (sp && Math.random() < 0.33) return talk(pick(sp))
    for (let tries = 0; tries < 10; tries++) {
      const i = Math.floor(Math.random() * TOPICS.length)
      if (i === lastTopic) continue
      const lines = TOPICS[i]()
      if (!lines || recentLines.includes(lineKey(lines))) continue
      lastTopic = i
      talk(lines)
      return
    }
  }

  // ── 첫 인사 → 이후 랜덤 수다 ───────────────────────────────
  function visitInfo() {
    const now = Date.now()
    const today = kst().day
    try {
      const n = +(localStorage.getItem("nyuri-visits") || 0) + 1
      const last = +(localStorage.getItem("nyuri-last-seen") || 0)
      const lastDay = +(localStorage.getItem("nyuri-visit-day") || -1)
      localStorage.setItem("nyuri-visits", String(n))
      localStorage.setItem("nyuri-last-seen", String(now))
      localStorage.setItem("nyuri-visit-day", String(today))
      return { n, gap: last ? now - last : 0, sameDay: lastDay === today }
    } catch {
      return { n: 1, gap: 0, sameDay: false }
    }
  }
  setTimeout(() => {
    const v = visitInfo()
    const DAY = 86400e3
    // 비공개 프로젝트에서 처음 열었으면 인사도 그 자리에 맞게
    if (isPrivate()) {
      talk(v.n === 1 ? ["안녕하세요, 뉴리예요!", "여긴 공개 전이라 잠가 둔 상자예요"] : pick(privateLines()))
      return
    }
    if (slug() === "404") return talk(pick(LINES.page.lost))
    const G = LINES.greet
    let hello =
      v.n === 1 ? pick(G.first)
      : v.gap >= 30 * DAY ? pick(G.month)
      : v.gap >= 7 * DAY ? pick(G.week)
      : v.sameDay && v.gap > 30 * 60e3 ? pick(G.today)
      : pick(G.again)
    // 특별한 날이면 인사 뒤에 그날 이야기를 한 줄 붙인다
    const sp = specialLines()
    if (sp) {
      const extra = pick(sp)
      hello = [...(Array.isArray(hello) ? hello : [hello]), ...(Array.isArray(extra) ? extra : [extra])].slice(0, 3)
    }
    talk(hello)
  }, 2500)
  schedule(chatter, 14000, 26000)

  // 상황에 반응하는 말
  // ── 마우스 반응: 눈으로 따라보기 · 간지럼 · 쓰다듬기 ────────────
  const eyes = avatar.querySelector(".np-eyes")
  let eyeRaf = 0
  let lastPointer = null
  function lookAt() {
    eyeRaf = 0
    if (!lastPointer || root.classList.contains("is-sleeping") || drag) {
      eyes.removeAttribute("transform")
      return
    }
    const r = avatar.getBoundingClientRect()
    const dx = lastPointer.x - (r.left + r.width / 2)
    const dy = lastPointer.y - (r.top + r.height * 0.6)
    const d = Math.hypot(dx, dy) || 1
    const reach = Math.min(1, d / 260) // 가까우면 덜, 멀면 끝까지
    const ox = (dx / d) * 9 * reach
    const oy = (dy / d) * 7 * reach
    eyes.setAttribute("transform", `translate(${ox.toFixed(1)} ${oy.toFixed(1)})`)
  }
  window.addEventListener(
    "pointermove",
    (e) => {
      if (!finePointer.matches || e.pointerType !== "mouse") return
      lastPointer = { x: e.clientX, y: e.clientY }
      if (!eyeRaf) eyeRaf = requestAnimationFrame(lookAt)
    },
    { passive: true },
  )
  document.documentElement.addEventListener("mouseleave", () => {
    lastPointer = null
    if (!eyeRaf) eyeRaf = requestAnimationFrame(lookAt)
  })

  // 간지럼: 뉴리 위에서 좌우로 빠르게 4번 이상 방향을 바꾸면
  let flips = []
  let lastDir = 0
  let lastTickle = 0
  avatar.addEventListener("pointermove", (e) => {
    if (!finePointer.matches || drag || e.pointerType !== "mouse") return
    const dir = Math.sign(e.movementX)
    if (!dir || Math.abs(e.movementX) < 2) return
    const now = Date.now()
    if (lastDir && dir !== lastDir) flips.push(now)
    lastDir = dir
    flips = flips.filter((t) => now - t < 1200)
    if (flips.length >= 4 && now - lastTickle > 4000) {
      lastTickle = now
      flips = []
      stopPetting()
      root.classList.remove("is-giggling")
      void root.offsetWidth
      root.classList.add("is-giggling")
      setTimeout(() => root.classList.remove("is-giggling"), 900)
      if (!quietDay()) talk(pick(LINES.act.tickle))
    }
  })

  // 쓰다듬기: 뉴리 위에 마우스를 가만히 올려 두면
  let petTimer = 0
  let lastPetTalk = 0
  function stopPetting() {
    clearTimeout(petTimer)
    root.classList.remove("is-happy")
  }
  let lastHover = 0
  avatar.addEventListener("pointerenter", (e) => {
    if (!finePointer.matches || e.pointerType !== "mouse" || !chat.hidden || drag) return
    // 마우스를 올리면 가끔 인사 (자주는 안 함)
    if (Date.now() - lastHover > 30000 && !root.classList.contains("has-bubble") && Math.random() < 0.4) {
      lastHover = Date.now()
      talk(pick(LINES.act.hover))
    }
    clearTimeout(petTimer)
    petTimer = setTimeout(() => {
      if (drag || !chat.hidden) return
      root.classList.add("is-happy")
      if (Date.now() - lastPetTalk > 15000) {
        lastPetTalk = Date.now()
        talk(pick(LINES.act.pet))
      }
    }, 1400)
  })
  avatar.addEventListener("pointerleave", stopPetting)
  avatar.addEventListener("pointerdown", stopPetting)
  let awayAt = 0
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) awayAt = Date.now()
    else if (awayAt && Date.now() - awayAt > 60000) {
      setTimeout(() => talk(pick(LINES.act.back)), 600)
    }
  })
  let endSaid = false
  let scrollMark = { y: window.scrollY, t: performance.now() }
  let lastFast = 0
  window.addEventListener(
    "scroll",
    () => {
      lastScrollAt = Date.now()
      // 0.5초 안에 화면 네 장 넘게 내리면 천천히 읽자고
      const now = performance.now()
      if (now - scrollMark.t > 500) scrollMark = { y: window.scrollY, t: now }
      else if (
        isNote() &&
        Math.abs(window.scrollY - scrollMark.y) > window.innerHeight * 4 &&
        Date.now() - lastFast > 90000
      ) {
        lastFast = Date.now()
        scrollMark = { y: window.scrollY, t: now }
        talk(pick(LINES.act.fastScroll))
      }
      if (!endSaid && isNote() && !isPrivate() && scrollRatio() > 0.97) {
        endSaid = true
        setTimeout(() => talk(zeroComments() ? pick(LINES.act.endFirst) : LINES.act.end[1]), 400)
      }
    },
    { passive: true },
  )
  document.addEventListener("nav", () => {
    endSaid = false
    // 비공개 프로젝트면 그 자리에 맞는 말, 아니면 글 제목 인사
    setTimeout(() => {
      const p = pageLines()
      if (isPrivate()) talk(pick(privateLines()))
      else if (p && (slug() === "404" || Math.random() < 0.7)) talk(pick(p))
      else if (isNote()) talk(`「${pageTitle()}」 펼쳐 볼까요?`)
    }, 900)
  })

  // 좋아요를 누르면 뉴리가 기뻐한다
  window.addEventListener("nyuri:liked", () => {
    hop()
    talk(pick(LINES.act.like))
  })
  // 댓글 · 공유 · 그래프에서 보내는 신호에 한마디씩
  const REACT = {
    "nyuri:unliked": "unlike",
    "nyuri:commented": "comment",
    "nyuri:replied": "reply",
    "nyuri:edited": "edit",
    "nyuri:deleted": "remove",
    "nyuri:copied": "copied",
    "nyuri:shared": "shared",
    "nyuri:hub": "hub",
  }
  Object.entries(REACT).forEach(([ev, key]) =>
    window.addEventListener(ev, () => {
      wake()
      talk(pick(LINES.act[key]))
    }),
  )
  // 테마 바꿈
  let themeNow = document.documentElement.getAttribute("saved-theme")
  new MutationObserver(() => {
    const t = document.documentElement.getAttribute("saved-theme")
    if (!t || t === themeNow) return
    themeNow = t
    talk(pick(t === "dark" ? LINES.act.dark : LINES.act.light))
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["saved-theme"] })
  // 검색 열기
  document.addEventListener("click", (e) => {
    if (e.target.closest?.(".search-button")) setTimeout(() => talk(pick(LINES.act.search)), 200)
  }, true)

  // ── 깡충 · 돌아다니기 ───────────────────────────────────────
  function hop() {
    if (reduce.matches || drag || root.classList.contains("is-sleeping")) return
    root.classList.remove("is-hopping")
    void root.offsetWidth // 연속으로 뛰어도 처음부터 다시
    root.classList.add("is-hopping")
    setTimeout(() => root.classList.remove("is-hopping"), 620)
  }
  schedule(() => {
    if (Math.random() >= 0.6) return
    hop()
    if (Math.random() < 0.12 && chat.hidden && !root.classList.contains("has-bubble") && !busyReading())
      say(pick(LINES.self.hop), 1600)
  }, 7000, 13000)

  // 지금 자리에서 사방으로 조금씩 아장아장 (화면 밖으로는 안 나감)
  let walking = false
  let placedAt = 0 // 사용자가 직접 옮긴 시각
  function wander() {
    if (reduce.matches || walking || drag || !chat.hidden || root.classList.contains("is-sleeping")) return
    if (Date.now() - placedAt < 90000) return // 방금 옮겨 둔 자리는 한동안 지킨다
    const b = bounds()
    const ang = Math.random() * Math.PI * 2
    const dist = 110 + Math.random() * 170
    const to = {
      x: clamp(pos.x + Math.cos(ang) * dist, b.minX, b.maxX),
      y: clamp(pos.y + Math.sin(ang) * dist, b.minY, b.maxY),
    }
    const from = { ...pos }
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy)
    if (len < 50) return
    const dur = Math.max(900, (len / 70) * 1000) // 70px/s 로 천천히
    walking = true
    root.classList.add("is-walking")
    root.dataset.facing = dx < 0 ? "left" : "right"
    hideBubble()
    if (Math.random() < 0.35) say(pick(LINES.self.walkStart), 2200)
    const t0 = performance.now()
    const step = (now) => {
      if (drag || !walking) {
        root.classList.remove("is-walking")
        walking = false
        return
      }
      const k = Math.min(1, (now - t0) / dur)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2 // 출발·도착만 부드럽게
      pos.x = from.x + dx * e
      pos.y = from.y + dy * e
      apply()
      if (k < 1) requestAnimationFrame(step)
      else {
        walking = false
        root.classList.remove("is-walking")
        save()
        hop()
        if (Math.random() < 0.4) setTimeout(() => talk(pick(LINES.self.walkEnd)), 500)
      }
    }
    requestAnimationFrame(step)
  }
  schedule(wander, 24000, 46000)

  // ── 채팅 ────────────────────────────────────────────────────
  function openChat() {
    window.NYURI?.ip?.() // 쪽지를 보낼 때 기다리지 않게 미리 받아 둔다
    if (!chat.hidden) return
    hideBubble()
    convoTimers.forEach(clearTimeout)
    root.classList.remove("is-sleeping")
    chat.querySelector(".np-guide-hi").textContent = pick(LINES.act.open)
    chat.hidden = false
    placeChat()
    // 다음 프레임에 열린 상태로 → transition 이 현재 값에서 출발
    requestAnimationFrame(() => {
      root.classList.add("chat-open")
      chat.classList.add("is-open")
    })
    avatar.setAttribute("aria-expanded", "true")
    setTimeout(() => textarea.focus({ preventScroll: true }), 60)
  }
  function closeChat(focusBack = true) {
    if (chat.hidden) return
    root.classList.remove("chat-open")
    chat.classList.remove("is-open")
    avatar.setAttribute("aria-expanded", "false")
    const hideNow = () => {
      if (!root.classList.contains("chat-open")) chat.hidden = true
    }
    if (reduce.matches) hideNow()
    else setTimeout(hideNow, 300)
    if (focusBack) avatar.focus({ preventScroll: true })
    // 채팅창이 열려 있는 동안 못 한 말(쪽지 보냄 등)은 닫고 나서
    if (afterClose) {
      const l = afterClose
      afterClose = null
      setTimeout(() => talk(l), 450)
    }
  }
  let afterClose = null
  const toggleChat = () => (chat.hidden ? openChat() : closeChat())
  chat.querySelector(".np-close").addEventListener("click", () => closeChat())
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !chat.hidden) closeChat()
  })
  document.addEventListener("pointerdown", (e) => {
    if (!chat.hidden && !root.contains(e.target) && !chat.contains(e.target)) closeChat(false)
  })

  let sending = false
  const setStatus = (t, isError) => {
    statusEl.textContent = t || ""
    statusEl.classList.toggle("is-error", !!isError)
  }
  chat.querySelector(".np-again").addEventListener("click", () => {
    done.hidden = true
    form.hidden = false
    setStatus("")
    textarea.focus()
  })

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    if (sending) return
    const message = textarea.value.trim()
    const email = emailInput.value.trim()
    if (!message) {
      setStatus("메시지를 적어 주세요.", true)
      textarea.focus()
      return
    }
    if (!email) {
      setStatus("답장 받을 이메일을 적어 주세요.", true)
      emailInput.focus()
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("이메일 주소 형식을 확인해 주세요. 예: you@example.com", true)
      emailInput.focus()
      return
    }
    if (form.querySelector(".np-hp").value) return // 스팸 봇

    const title = (document.querySelector("h1.article-title")?.textContent || document.title).trim()
    const api = (window.NYURI && window.NYURI.api) || ""
    const mailto = () =>
      `mailto:${OWNER_EMAIL}?subject=${encodeURIComponent("[뉴리의창고] " + title)}&body=${encodeURIComponent(
        message + "\n\n" + location.href,
      )}`

    if (!api) {
      // 백엔드 연결 전에는 메일 앱으로 대신 보낸다
      location.href = mailto()
      setStatus("메일 앱이 열렸어요. 거기서 보내기를 눌러 주세요.")
      return
    }

    // 먼저 "보냈어요" 화면을 보여 주고, 실제 전송은 뒤에서 한다. 실패하면 쓰던 글과 함께 되돌린다.
    sending = true
    const showDone = () => {
      textarea.value = ""
      setStatus("")
      form.hidden = true
      done.hidden = false
      done.querySelector(".np-done-text").textContent = `답장은 ${email} 로 갈 거예요.`
      done.querySelector(".np-again").focus()
    }
    showDone()
    hop()
    afterClose = pick(LINES.act.mailSent)
    try {
      const r = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // 사전 요청 없이 보내기
        keepalive: true, // 창을 닫거나 다른 글로 가도 끝까지 보낸다
        body: JSON.stringify({
          action: "mail",
          message,
          email,
          page: location.href,
          title,
          meta: window.NYURI && window.NYURI.meta ? await window.NYURI.meta() : {},
        }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || "failed")
    } catch {
      afterClose = pick(LINES.act.mailFail)
      done.hidden = true
      form.hidden = false
      textarea.value = message
      if (chat.hidden) openChat()
      setStatus("방금 쪽지가 전해지지 않았어요. 잠시 뒤 다시 보내거나 메일 앱을 이용해 주세요.", true)
      const a = document.createElement("a")
      a.href = mailto()
      a.textContent = " 메일 앱으로 보내기"
      statusEl.appendChild(a)
    } finally {
      sending = false
    }
  })

  // ── 시작 ────────────────────────────────────────────────────
  restore()
  requestAnimationFrame(() => root.classList.add("is-ready"))
})()
