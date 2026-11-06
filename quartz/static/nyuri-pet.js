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
        <p class="np-guide">궁금한 점이나 하고 싶은 말을 적어 주세요. 주인에게 메일로 전해 드리고, 답장은 적어 주신 이메일로 가요.</p>
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
  const SHEET = window.matchMedia("(max-width: 800px)")
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
    top = clamp(top, MARGIN, window.innerHeight - h - MARGIN)
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
  avatar.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return
    cancelAnimationFrame(springRaf)
    try {
      avatar.setPointerCapture(e.pointerId)
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
      if (!cancelled) toggleChat()
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
    const fast = speed > 900
    setTimeout(() => talk(fast ? pick(["우와 날았다!", "어지러워요~", "슝!"]) : pick(["여기로 이사!", "고마워요", "자리 좋네요"])), 450)
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

  window.addEventListener("resize", () => {
    const b = bounds()
    pos.x = clamp(pos.x, b.minX, b.maxX)
    pos.y = clamp(pos.y, b.minY, b.maxY)
    apply()
  })

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
  function wake() {
    root.classList.remove("is-sleeping")
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      if (chat.hidden) {
        root.classList.add("is-sleeping")
        hideBubble()
      }
    }, 90000)
  }
  ;["pointermove", "keydown", "scroll", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, wake, { passive: true }),
  )
  wake()

  // ── 말풍선 ──────────────────────────────────────────────────
  let bubbleTimer = 0
  function say(text, ms = 5200) {
    if (!chat.hidden || root.classList.contains("is-sleeping") || drag) return
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
  async function loadWeather() {
    try {
      const r = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=temperature_2m,weather_code&timezone=Asia%2FSeoul",
      )
      const j = await r.json()
      const c = j.current
      const desc = (WEATHER.find(([codes]) => codes.includes(c.weather_code)) || [null, "날씨가 궁금하네요"])[1]
      weatherLine = `오늘 서울은 ${desc}. 지금 ${Math.round(c.temperature_2m)}°C예요`
    } catch {
      weatherLine = null
    }
  }
  loadWeather()

  // 대화 한 묶음: 여러 줄을 사이를 두고 이어서 말한다
  let convoTimers = []
  function talk(lines) {
    convoTimers.forEach(clearTimeout)
    convoTimers = []
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

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  const pageTitle = () =>
    (document.querySelector("h1.article-title")?.textContent || "").trim().replace(/\s+/g, " ")
  const isNote = () => document.body.dataset.slug !== "index" && !!document.querySelector("h1.article-title")
  const scrollRatio = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    return max > 0 ? window.scrollY / max : 0
  }

  // 상황별 대사. 함수는 그때그때 상황을 보고 null 이면 건너뛴다.
  const TOPICS = [
    () => {
      const h = new Date().getHours()
      if (h < 5) return ["이 시간까지 공부 중이세요?", "너무 무리하지는 마요"]
      if (h < 9) return ["좋은 아침이에요!", "아침에 읽는 논문이 제일 잘 들어온대요"]
      if (h < 12) return "오전 공부 화이팅이에요!"
      if (h < 14) return ["점심은 맛있게 드셨어요?", "저는 종이 상자라 쪽지를 먹어요"]
      if (h < 18) return ["오후엔 졸리죠?", "저도 가끔 졸아요… 쿨"]
      if (h < 22) return "오늘 하루도 수고 많았어요"
      return ["밤이 깊었네요", "읽던 건 저장해 두고 푹 자요"]
    },
    () => (weatherLine ? [weatherLine, pick(["산책하기 좋을까요?", "따뜻하게 입어요", "창밖 한 번 봐요"])] : null),
    () => (isNote() ? [`「${pageTitle()}」 읽고 계시네요!`, "궁금한 데가 있으면 저를 눌러 물어보세요"] : null),
    () => {
      if (!isNote()) return null
      const r = scrollRatio()
      if (r > 0.9) return ["끝까지 다 읽으셨네요!", "도움이 됐다면 아래에서 공유해 주세요"]
      if (r > 0.45) return "벌써 반이나 읽었어요. 잠깐 쉬어 가도 좋아요"
      if (r < 0.08) return "위에 마인드맵부터 훑어보면 금방 이해돼요"
      return null
    },
    () =>
      document.querySelector(".callout a[data-router-ignore]")
        ? ["마인드맵은 크게 열어서 볼 수 있어요", "확대·축소해서 보기를 눌러 보세요"]
        : null,
    () => ["궁금한 건 뭐든 저에게 물어보세요", "주인에게 메일로 전해 드릴게요"],
    () => "저를 끌어서 원하는 곳에 둘 수 있어요",
    () => ["오늘은 어떤 걸 공부하세요?", "저는 오늘 쪽지 정리했어요"],
    () => "새 노트가 올라오면 RSS로 받아볼 수 있어요",
    () => ["사실 저는 이 사이트 창고지기예요", "노트들이 다 제 안에 들어 있어요"],
    () => pick(["물 한 잔 마시고 와요", "어깨 한 번 쭉 펴 볼까요?", "눈도 잠깐 쉬어 줘요"]),
    () => pick(["흠흠~ ♪", "심심하다…", "여기 따뜻하다"]),
    () =>
      document.documentElement.getAttribute("saved-theme") === "dark"
        ? "밤에는 어두운 화면이 눈에 편해요"
        : "밝은 화면도 산뜻하네요",
  ]

  let lastTopic = -1
  function chatter() {
    if (!chat.hidden || drag || walking) return
    for (let tries = 0; tries < 8; tries++) {
      const i = Math.floor(Math.random() * TOPICS.length)
      if (i === lastTopic) continue
      const lines = TOPICS[i]()
      if (!lines) continue
      lastTopic = i
      talk(lines)
      return
    }
  }

  // 첫 인사 → 이후 랜덤 수다
  setTimeout(() => {
    const visits = (() => {
      try {
        const n = +(localStorage.getItem("nyuri-visits") || 0) + 1
        localStorage.setItem("nyuri-visits", String(n))
        return n
      } catch {
        return 1
      }
    })()
    talk(
      visits === 1
        ? ["안녕하세요, 뉴리예요!", "여기 노트들을 지키는 창고 친구예요"]
        : pick([["또 왔네요! 반가워요"], ["어서 와요, 기다렸어요!"], ["오늘도 놀러 와 줬네요"]]),
    )
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
      talk(pick(["히히 간지러워요!", "꺄르르, 그만~", "앗 간지러!", "헤헤헤 간질간질"]))
    }
  })

  // 쓰다듬기: 뉴리 위에 마우스를 가만히 올려 두면
  let petTimer = 0
  let lastPetTalk = 0
  function stopPetting() {
    clearTimeout(petTimer)
    root.classList.remove("is-happy")
  }
  avatar.addEventListener("pointerenter", (e) => {
    if (!finePointer.matches || e.pointerType !== "mouse" || !chat.hidden || drag) return
    clearTimeout(petTimer)
    petTimer = setTimeout(() => {
      if (drag || !chat.hidden) return
      root.classList.add("is-happy")
      if (Date.now() - lastPetTalk > 15000) {
        lastPetTalk = Date.now()
        talk(pick(["기분 좋아요~", "쓰담쓰담 좋아요", "헤헤, 따뜻해요"]))
      }
    }, 1400)
  })
  avatar.addEventListener("pointerleave", stopPetting)
  avatar.addEventListener("pointerdown", stopPetting)
  let awayAt = 0
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) awayAt = Date.now()
    else if (awayAt && Date.now() - awayAt > 60000) {
      setTimeout(() => talk(pick([["어디 갔다 왔어요?", "보고 싶었어요"], "돌아왔네요! 이어서 읽어요"])), 600)
    }
  })
  let endSaid = false
  window.addEventListener(
    "scroll",
    () => {
      if (!endSaid && isNote() && scrollRatio() > 0.97) {
        endSaid = true
        setTimeout(() => talk(["다 읽었다!", "수고했어요, 짝짝짝"]), 400)
      }
    },
    { passive: true },
  )
  document.addEventListener("nav", () => {
    endSaid = false
    if (isNote()) setTimeout(() => talk(`「${pageTitle()}」 펼쳐 볼까요?`), 900)
  })

  // 좋아요를 누르면 뉴리가 기뻐한다
  window.addEventListener("nyuri:liked", () => {
    hop()
    talk(pick(["고마워요!", "우와, 좋아요 받았다!", "힘이 나요!"]))
  })

  // ── 깡충 · 돌아다니기 ───────────────────────────────────────
  function hop() {
    if (reduce.matches || drag || root.classList.contains("is-sleeping")) return
    root.classList.remove("is-hopping")
    void root.offsetWidth // 연속으로 뛰어도 처음부터 다시
    root.classList.add("is-hopping")
    setTimeout(() => root.classList.remove("is-hopping"), 620)
  }
  schedule(() => {
    if (Math.random() < 0.6) hop()
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
        if (Math.random() < 0.4) setTimeout(() => talk(pick(["여기가 좋겠다!", "영차영차", "산책 끝!"])), 500)
      }
    }
    requestAnimationFrame(step)
  }
  schedule(wander, 24000, 46000)

  // ── 채팅 ────────────────────────────────────────────────────
  function openChat() {
    if (!chat.hidden) return
    hideBubble()
    root.classList.remove("is-sleeping")
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
  }
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

    sending = true
    form.classList.add("is-sending")
    setStatus("보내는 중이에요…")
    try {
      const r = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // 사전 요청 없이 보내기
        body: JSON.stringify({ action: "mail", message, email, page: location.href, title }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || "failed")
      textarea.value = ""
      setStatus("")
      form.hidden = true
      done.hidden = false
      done.querySelector(".np-done-text").textContent = `답장은 ${email} 로 갈 거예요.`
      done.querySelector(".np-again").focus()
      hop()
    } catch {
      setStatus("지금은 보내지 못했어요. 잠시 뒤 다시 보내거나 메일 앱을 이용해 주세요.", true)
      const a = document.createElement("a")
      a.href = mailto()
      a.textContent = " 메일 앱으로 보내기"
      statusEl.appendChild(a)
    } finally {
      sending = false
      form.classList.remove("is-sending")
    }
  })

  // ── 시작 ────────────────────────────────────────────────────
  restore()
  requestAnimationFrame(() => root.classList.add("is-ready"))
})()
