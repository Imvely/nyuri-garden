// 뉴리의창고 첫 화면: 살아 움직이는 지식 그래프
// - 데이터: Quartz 가 만드는 static/contentIndex.json (노트 · 폴더 · 태그 · 노트 사이 링크)
// - 가운데 뉴리(첫 화면) → 폴더 → 노트 → 태그 로 이어진다
// - 처음엔 가운데서 피어나듯 퍼지고, 그 뒤엔 숨 쉬듯 천천히 떠다닌다 (움직임 줄이기 설정이면 멈춘다)
// - 점에 마우스를 올리면 이어진 것만 밝아지고, 누르면 그 페이지로, 끌면 흔들린다
// - 화면 밖이거나 탭이 숨겨지면 그리기를 멈춘다
// 붙는 자리: content/index.md 의 <div data-graph></div>
;(() => {
  if (window.__nyuriGraph) return
  window.__nyuriGraph = true

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)")
  let current = null
  let dataPromise = null

  const siteRoot = () => {
    const a = document.querySelector("a.page-title, .page-title a")
    return a ? new URL(a.getAttribute("href"), location.href).href : new URL("./", location.href).href
  }
  const loadIndex = () => {
    if (!dataPromise)
      dataPromise = fetch(new URL("static/contentIndex.json", siteRoot()))
        .then((r) => r.json())
        .catch(() => {
          dataPromise = null
          return null
        })
    return dataPromise
  }

  const prettyName = (s) => decodeURIComponent(s).replace(/-/g, " ")
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s)

  // contentIndex → 그래프
  function buildGraph(index) {
    const nodes = new Map()
    const links = []
    const add = (id, o) => {
      if (!nodes.has(id)) nodes.set(id, { id, deg: 0, ...o })
      return nodes.get(id)
    }
    const link = (a, b, kind) => {
      if (!nodes.has(a) || !nodes.has(b) || a === b) return
      if (links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) return
      links.push({ a, b, kind })
      nodes.get(a).deg++
      nodes.get(b).deg++
    }

    add("hub", { type: "hub", label: "뉴리의창고", href: "" })
    const slugs = Object.keys(index)
    const notes = slugs.filter((s) => s !== "index" && !s.endsWith("/index") && !s.startsWith("tags/"))

    for (const s of notes) {
      const parts = s.split("/")
      add(s, { type: "note", label: index[s].title || prettyName(parts.at(-1)), href: s })
      // 폴더 (여러 단계면 차례로 잇는다)
      let parent = "hub"
      for (let i = 1; i < parts.length; i++) {
        const f = parts.slice(0, i).join("/")
        const id = "folder:" + f
        add(id, { type: "folder", label: index[f + "/index"]?.title || prettyName(parts[i - 1]), href: f + "/" })
        link(parent, id, "tree")
        parent = id
      }
      link(parent, s, "tree")
    }
    for (const s of notes) {
      for (const t of index[s].tags || []) {
        const id = "tags/" + t
        add(id, { type: "tag", label: "#" + t, href: "tags/" + t })
        link(s, id, "tag")
      }
      for (const l of index[s].links || []) if (notes.includes(l)) link(s, l, "ref")
    }
    return { nodes: [...nodes.values()], links }
  }

  function createGraph(host) {
    host.innerHTML = `
      <figure class="ng">
        <canvas class="ng-canvas" role="img"></canvas>
        <div class="ng-legend" aria-hidden="true">
          <span><i class="ng-key is-note"></i>노트</span>
          <span><i class="ng-key is-folder"></i>폴더</span>
          <span><i class="ng-key is-tag"></i>태그</span>
        </div>
        <div class="ng-tools">
          <button type="button" data-z="in" aria-label="크게 보기"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></button>
          <button type="button" data-z="out" aria-label="작게 보기"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
          <button type="button" data-z="fit" aria-label="한눈에 보기"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg></button>
        </div>
        <p class="ng-status" role="status">그래프를 펼치는 중이에요</p>
      </figure>
      <div class="ng-foot">
        <p>점을 누르면 그 노트로 가요. 끌어서 흔들어 봐도 괜찮아요.</p>
        <a class="ng-more" hidden></a>
      </div>`

    const fig = host.querySelector(".ng")
    const canvas = host.querySelector("canvas")
    const ctx = canvas.getContext("2d")
    const status = host.querySelector(".ng-status")
    let destroyed = false
    let raf = 0
    let visible = true
    let W = 0,
      H = 0,
      dpr = 1
    const view = { s: 1, k: 1, x: 0, y: 0, auto: true } // 화면 = (세계x * s * k, 세계y * s) + (x, y). k: 가로로 벌리는 정도
    let G = { nodes: [], links: [] }
    let byId = new Map()
    let hover = null
    let neighbors = new Set()
    let drag = null
    let energy = 1
    let t0 = performance.now()

    const mascot = new Image()
    mascot.src = new URL("static/nyuri.svg", siteRoot()).href

    // 사이트 테마 색 (테마를 바꾸면 다시 읽는다)
    let C = {}
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement)
      const v = (k, d) => cs.getPropertyValue(k).trim() || d
      C = {
        bg: v("--light", "#1d1915"),
        line: v("--lightgray", "#3a322a"),
        gray: v("--gray", "#b3a690"),
        text: v("--darkgray", "#e6dccb"),
        strong: v("--dark", "#f6eee1"),
        accent: v("--secondary", "#d9ab72"),
        accent2: v("--tertiary", "#ecc596"),
        font: v("--bodyFont", "sans-serif"),
      }
    }
    readColors()
    const themeObs = new MutationObserver(readColors)
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["saved-theme"] })

    // ── 크기 ──
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = r.width
      H = r.height
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      if (view.auto) fitTarget(true)
      wake()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // 화면 밖이면 쉬기
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) wake()
    })
    io.observe(fig)
    const onVis = () => !document.hidden && wake()
    document.addEventListener("visibilitychange", onVis)
    const onMotion = () => wake()
    reduceMotion.addEventListener?.("change", onMotion)

    // ── 시뮬레이션 ──
    const SPRING = { tree: 120, tag: 78, ref: 140 }
    function radius(n) {
      if (n.type === "hub") return 24
      if (n.type === "folder") return 9
      if (n.type === "note") return 8 + Math.min(6, Math.sqrt(n.deg) * 1.6)
      return 4.2
    }
    function step(now) {
      const N = G.nodes
      const wander = !reduceMotion.matches
      // 서로 밀어내기
      for (let i = 0; i < N.length; i++) {
        const a = N[i]
        for (let j = i + 1; j < N.length; j++) {
          const b = N[j]
          let dx = b.x - a.x,
            dy = b.y - a.y
          let d2 = dx * dx + dy * dy
          if (d2 < 0.01) {
            dx = Math.random() - 0.5
            dy = Math.random() - 0.5
            d2 = 0.25
          }
          const d = Math.sqrt(d2)
          const f = (a.charge * b.charge) / Math.max(d2, 60)
          const fx = (dx / d) * f,
            fy = (dy / d) * f
          a.vx -= fx / a.mass
          a.vy -= fy / a.mass
          b.vx += fx / b.mass
          b.vy += fy / b.mass
          // 겹치지 않게
          const min = a.r + b.r + (a.type === "hub" || b.type === "hub" ? 46 : 12)
          if (d < min) {
            const push = (min - d) * 0.25
            a.vx -= (dx / d) * push
            a.vy -= (dy / d) * push
            b.vx += (dx / d) * push
            b.vy += (dy / d) * push
          }
        }
      }
      // 이어진 것끼리 당기기
      for (const l of G.links) {
        const a = byId.get(l.a),
          b = byId.get(l.b)
        const dx = b.x - a.x,
          dy = b.y - a.y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        const f = (d - SPRING[l.kind]) * 0.035
        a.vx += ((dx / d) * f) / a.mass
        a.vy += ((dy / d) * f) / a.mass
        b.vx -= ((dx / d) * f) / b.mass
        b.vy -= ((dy / d) * f) / b.mass
      }
      let e = 0
      for (const n of N) {
        // 가운데로 살짝 모으기 + 숨 쉬듯 떠다니기
        // 뉴리(가운데)는 늘 한가운데에 머문다
        // 가로로 넓은 카드에 맞게 위아래로 더 세게 모은다
        const pull = n.type === "hub" ? 0.06 : 0.0022
        n.vx -= n.x * pull
        n.vy -= n.y * pull * (W > H ? 3 : 1)
        if (wander) {
          n.vx += Math.cos(now * 0.00055 + n.phase) * 0.018
          n.vy += Math.sin(now * 0.00047 + n.phase * 1.7) * 0.018
        }
        if (n === drag?.node) {
          n.vx = n.vy = 0
          n.x = drag.wx
          n.y = drag.wy
          continue
        }
        if (n.type === "hub") {
          n.vx *= 0.5
          n.vy *= 0.5
        }
        n.vx *= 0.84
        n.vy *= 0.84
        n.x += n.vx
        n.y += n.vy
        e += n.vx * n.vx + n.vy * n.vy
      }
      energy = e / Math.max(1, N.length)
    }

    // ── 보기 맞추기 ──
    let target = { s: 1, k: 1, x: 0, y: 0 }
    function fitTarget(snap) {
      if (!G.nodes.length || !W) return
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity
      for (const n of G.nodes) {
        x0 = Math.min(x0, n.x - n.r)
        y0 = Math.min(y0, n.y - n.r)
        x1 = Math.max(x1, n.x + n.r)
        y1 = Math.max(y1, n.y + n.r + 18)
      }
      const padX = W < 560 ? 36 : 90,
        padY = 70
      const fx = (W - padX * 2) / Math.max(x1 - x0, 1)
      const fy = (H - padY * 2) / Math.max(y1 - y0, 1)
      const s = Math.min(fx, fy, 2)
      // 높이가 먼저 꽉 차면 가로 간격만 넓혀서 카드를 고르게 채운다 (점은 그대로 동그랗게)
      const k = Math.min(1.8, Math.max(1, fx / s))
      target = { s, k, x: W / 2 - ((x0 + x1) / 2) * s * k, y: H / 2 - ((y0 + y1) / 2) * s + 6 }
      if (snap) Object.assign(view, target)
    }
    const toWorld = (px, py) => [(px - view.x) / (view.s * view.k), (py - view.y) / view.s]

    // ── 그리기 ──
    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const P = (n) => [n.x * view.s * view.k + view.x, n.y * view.s + view.y]
      const focus = hover || drag?.node || null
      const lit = (id) => !focus || id === focus.id || neighbors.has(id)

      // 선: 손으로 그은 듯 살짝 휜 곡선
      for (const l of G.links) {
        const a = byId.get(l.a),
          b = byId.get(l.b)
        const [ax, ay] = P(a),
          [bx, by] = P(b)
        const on = focus && (l.a === focus.id || l.b === focus.id)
        const mx = (ax + bx) / 2,
          my = (ay + by) / 2
        const bend = 0.08 * (l.a < l.b ? 1 : -1)
        const cx = mx - (by - ay) * bend,
          cy = my + (bx - ax) * bend
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.quadraticCurveTo(cx, cy, bx, by)
        ctx.strokeStyle = on ? C.accent : C.gray
        ctx.globalAlpha = on ? 0.85 : focus ? 0.08 : l.kind === "tag" ? 0.22 : 0.34
        ctx.lineWidth = on ? 1.6 : l.kind === "tag" ? 0.9 : 1.2
        if (l.kind === "ref") ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.globalAlpha = 1

      // 점
      for (const n of G.nodes) {
        const [x, y] = P(n)
        const r = n.r * Math.min(1.25, Math.max(0.75, view.s))
        ctx.globalAlpha = lit(n.id) ? 1 : 0.22
        if (n.type === "hub") {
          const size = r * 2.1
          if (mascot.complete && mascot.naturalWidth) ctx.drawImage(mascot, x - size / 2, y - size / 2 - 2, size, size)
          else {
            ctx.beginPath()
            ctx.arc(x, y, r, 0, Math.PI * 2)
            ctx.fillStyle = C.accent
            ctx.fill()
          }
        } else if (n.type === "folder") {
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = C.bg
          ctx.fill()
          ctx.lineWidth = 1.8
          ctx.strokeStyle = C.gray
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(x, y, r * 0.38, 0, Math.PI * 2)
          ctx.fillStyle = C.gray
          ctx.fill()
        } else if (n.type === "note") {
          if (focus && n.id === focus.id) {
            ctx.beginPath()
            ctx.arc(x, y, r + 6, 0, Math.PI * 2)
            ctx.fillStyle = C.accent
            ctx.globalAlpha = 0.18
            ctx.fill()
            ctx.globalAlpha = 1
          }
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = C.accent
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = focus && neighbors.has(n.id) ? C.accent2 : C.gray
          ctx.fill()
        }
      }

      // 이름표 (화면 크기 그대로, 배경색 테두리로 선 위에서도 읽히게)
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      ctx.lineJoin = "round"
      for (const n of G.nodes) {
        if (n.type === "hub") continue
        const isTag = n.type === "tag"
        const isFocus = focus && n.id === focus.id
        if (isTag && view.s < 0.6 && !isFocus && !(focus && neighbors.has(n.id))) continue
        const [x, y] = P(n)
        const r = n.r * Math.min(1.25, Math.max(0.75, view.s))
        const label = isFocus ? n.label : clip(n.label, n.type === "note" ? 22 : 14)
        ctx.font = isTag ? `500 11.5px ${C.font}` : n.type === "note" ? `650 13.5px ${C.font}` : `600 12.5px ${C.font}`
        ctx.globalAlpha = lit(n.id) ? 1 : 0.2
        ctx.lineWidth = 4
        ctx.strokeStyle = C.bg
        ctx.strokeText(label, x, y + r + 6)
        ctx.fillStyle = isFocus ? C.accent : isTag ? C.gray : n.type === "note" ? C.strong : C.text
        ctx.fillText(label, x, y + r + 6)
      }
      ctx.globalAlpha = 1
    }

    // ── 루프 ──
    function frame(now) {
      raf = 0
      if (destroyed) return
      step(now)
      if (view.auto) fitTarget(false)
      view.s += (target.s - view.s) * (view.auto ? 0.06 : 0.18)
      view.k += (target.k - view.k) * (view.auto ? 0.06 : 0.18)
      view.x += (target.x - view.x) * (view.auto ? 0.06 : 0.18)
      view.y += (target.y - view.y) * (view.auto ? 0.06 : 0.18)
      draw(now)
      const settling = energy > 0.0008 || Math.abs(target.s - view.s) > 0.001 || drag
      // 움직임 줄이기면 자리를 잡은 뒤 멈춘다. 아니면 화면에 보일 때 계속 숨 쉰다.
      const keep = visible && !document.hidden && (settling || !reduceMotion.matches)
      if (keep) raf = requestAnimationFrame(frame)
    }
    function wake() {
      if (!raf && !destroyed && G.nodes.length) raf = requestAnimationFrame(frame)
    }

    // ── 손으로 만지기 ──
    const local = (e) => {
      const r = canvas.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    }
    function hit(px, py) {
      let best = null,
        bd = Infinity
      for (const n of G.nodes) {
        const x = n.x * view.s * view.k + view.x,
          y = n.y * view.s + view.y
        const d = Math.hypot(px - x, py - y)
        const reach = Math.max(14, n.r * view.s + 8)
        if (d < reach && d < bd) {
          best = n
          bd = d
        }
      }
      return best
    }
    function setHover(n) {
      if (hover === n) return
      hover = n
      neighbors = new Set()
      if (n)
        for (const l of G.links) {
          if (l.a === n.id) neighbors.add(l.b)
          if (l.b === n.id) neighbors.add(l.a)
        }
      canvas.style.cursor = n ? (n.type === "hub" ? "grab" : "pointer") : "grab"
      wake()
    }
    let pan = null
    canvas.addEventListener("pointerdown", (e) => {
      const [px, py] = local(e)
      const n = hit(px, py)
      canvas.setPointerCapture(e.pointerId)
      if (n) {
        const [wx, wy] = toWorld(px, py)
        drag = { node: n, wx, wy, sx: px, sy: py, moved: false, ox: n.x - wx, oy: n.y - wy }
        drag.wx = n.x
        drag.wy = n.y
        setHover(n)
      } else if (e.pointerType === "mouse") {
        pan = { sx: px, sy: py, vx: view.x, vy: view.y }
        canvas.style.cursor = "grabbing"
      }
      wake()
    })
    canvas.addEventListener("pointermove", (e) => {
      const [px, py] = local(e)
      if (drag) {
        if (Math.hypot(px - drag.sx, py - drag.sy) > 4) drag.moved = true
        const [wx, wy] = toWorld(px, py)
        drag.wx = wx + drag.ox
        drag.wy = wy + drag.oy
        wake()
        return
      }
      if (pan) {
        view.auto = false
        target.x = pan.vx + (px - pan.sx)
        target.y = pan.vy + (py - pan.sy)
        view.x = target.x
        view.y = target.y
        wake()
        return
      }
      if (e.pointerType === "mouse") setHover(hit(px, py))
    })
    const release = (e) => {
      if (drag) {
        const n = drag.node
        const click = !drag.moved
        // 놓으면 살짝 튕기며 제자리를 찾아간다
        n.vx = (Math.random() - 0.5) * 2
        n.vy = (Math.random() - 0.5) * 2
        drag = null
        if (click && e.type === "pointerup") go(n)
        if (e.pointerType !== "mouse") setHover(null)
      }
      if (pan) {
        pan = null
        canvas.style.cursor = hover ? "pointer" : "grab"
      }
      wake()
    }
    canvas.addEventListener("pointerup", release)
    canvas.addEventListener("pointercancel", release)
    canvas.addEventListener("pointerleave", (e) => {
      if (!drag && !pan && e.pointerType === "mouse") setHover(null)
    })
    // 페이지 스크롤은 그대로 두고, Ctrl/⌘ + 휠일 때만 확대
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey && !e.metaKey) return
        e.preventDefault()
        zoomAt(Math.exp(-e.deltaY * 0.004), ...local(e))
      },
      { passive: false },
    )
    function zoomAt(k, px, py) {
      view.auto = false
      const ns = Math.min(3, Math.max(0.35, target.s * k))
      const kk = ns / target.s
      target.x = px - (px - target.x) * kk
      target.y = py - (py - target.y) * kk
      target.s = ns
      wake()
    }
    host.querySelector(".ng-tools").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-z]")
      if (!b) return
      if (b.dataset.z === "fit") {
        view.auto = true
        fitTarget(false)
      } else zoomAt(b.dataset.z === "in" ? 1.3 : 1 / 1.3, W / 2, H / 2)
      wake()
    })

    function go(n) {
      if (n.type === "hub") {
        // 뉴리를 누르면 한 번 통 튀어 오른다
        n.vy -= 9
        wake()
        return
      }
      const url = new URL(n.href, siteRoot())
      if (window.spaNavigate) window.spaNavigate(url)
      else location.href = url.href
    }

    // ── 데이터 ──
    loadIndex().then((index) => {
      if (destroyed) return
      if (!index) {
        status.textContent = "그래프를 불러오지 못했어요. 새로고침해 주세요."
        return
      }
      G = buildGraph(index)
      G.nodes.forEach((n, i) => {
        n.r = radius(n)
        n.mass = n.type === "hub" ? 6 : n.type === "tag" ? 0.8 : 1.4
        n.charge = n.type === "hub" ? 80 : n.type === "tag" ? 30 : 58
        // 가운데서 피어나듯 시작
        const a = (i / G.nodes.length) * Math.PI * 2
        n.x = n.type === "hub" ? 0 : Math.cos(a) * 6
        n.y = n.type === "hub" ? 0 : Math.sin(a) * 6
        n.vx = n.vy = 0
        n.phase = Math.random() * Math.PI * 2
      })
      byId = new Map(G.nodes.map((n) => [n.id, n]))
      if (!W) {
        const r = canvas.getBoundingClientRect()
        W = r.width
        H = r.height
      }
      // 보이지 않게 먼저 자리를 잡아 보고, 길쭉한 방향이 가로가 되도록 돌린다 (넓은 카드를 꽉 채우게)
      for (let i = 0; i < 260; i++) step(t0)
      let sxx = 0, syy = 0, sxy = 0
      for (const n of G.nodes) {
        sxx += n.x * n.x
        syy += n.y * n.y
        sxy += n.x * n.y
      }
      const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy)
      const cos = Math.cos(-ang), sin = Math.sin(-ang)
      // 그 모양 그대로 가운데로 접었다가 피어나게 한다 (움직임 줄이기면 펼친 채로 보여 준다)
      const shrink = reduceMotion.matches ? 1 : 0.05
      for (const n of G.nodes) {
        const x = n.x * cos - n.y * sin, y = n.x * sin + n.y * cos
        n.x = x * shrink
        n.y = y * shrink
        n.vx = n.vy = 0
      }
      for (let i = 0; i < (reduceMotion.matches ? 60 : 6); i++) step(t0)
      fitTarget(true)
      const counts = { note: 0, folder: 0, tag: 0 }
      G.nodes.forEach((n) => n.type in counts && counts[n.type]++)
      canvas.setAttribute("aria-label", `뉴리의창고 지식 그래프. 노트 ${counts.note}개, 폴더 ${counts.folder}개, 태그 ${counts.tag}개가 이어져 있어요.`)
      const folder = G.nodes.find((n) => n.type === "folder")
      const more = host.querySelector(".ng-more")
      if (folder) {
        more.href = new URL(folder.href, siteRoot()).href
        more.textContent = `${folder.label} 전체 보기`
        more.classList.add("internal")
        more.hidden = false
      }
      status.remove()
      fig.classList.add("is-ready")
      wake()
    })

    return {
      destroy() {
        destroyed = true
        cancelAnimationFrame(raf)
        ro.disconnect()
        io.disconnect()
        themeObs.disconnect()
        document.removeEventListener("visibilitychange", onVis)
        reduceMotion.removeEventListener?.("change", onMotion)
      },
    }
  }

  function mount() {
    current?.destroy()
    current = null
    const host = document.querySelector("[data-graph]")
    if (host) current = createGraph(host)
  }
  document.addEventListener("nav", mount)
  if (document.readyState !== "loading") mount()
  else document.addEventListener("DOMContentLoaded", mount)
})()
