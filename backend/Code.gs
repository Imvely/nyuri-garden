/**
 * 뉴리의창고 백엔드 (구글 앱스 스크립트 웹 앱)
 *
 * 하는 일
 *  - 글마다 좋아요 수 저장 (방문자마다 한 번)
 *  - 댓글 · 답글 저장, 비밀번호로 수정 · 삭제 (비밀번호는 소금을 친 SHA-256 해시로만 저장)
 *  - 주인(관리자 키 보유)이 남긴 댓글은 "뉴리"로 표시
 *  - 방문자의 모든 행동(쪽지 · 댓글 · 답글 · 수정 · 삭제 · 좋아요 · 좋아요 취소)을 주인 메일로 알림
 *
 * 설치 방법은 backend/README.md 참고.
 */

const OWNER_EMAIL = "dayeong.comp@gmail.com" // 모든 알림을 받는 주소
const SITE_NAME = "뉴리의창고"
const MAX_BODY = 2000

// ── 진입점 ────────────────────────────────────────────────────

function doGet(e) {
  try {
    const p = (e && e.parameter) || {}
    if (p.action === "thread") return json(thread(p.page || "", p.clientId || ""))
    if (p.action === "counts") return json(counts(p.pages || "", p.clientId || ""))
    return json({ ok: true, name: SITE_NAME })
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) })
  }
}

function doPost(e) {
  let body = {}
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}")
  } catch (err) {
    return json({ ok: false, error: "bad_request" })
  }
  body.meta = meta_(body)
  // 방문 기록은 잠그지 않고 한 줄만 붙인다 (요청이 많아도 댓글 처리를 막지 않게)
  if (body.action === "track") {
    try {
      return json(track(body))
    } catch (err) {
      return json({ ok: false, error: String(err.message || err) })
    }
  }
  // 주인 전용 통계: 읽기만 하므로 잠그지 않는다. 관리자 키가 틀리면 아무것도 주지 않는다
  if (body.action === "stats") {
    try {
      return json(stats(body))
    } catch (err) {
      return json({ ok: false, error: String(err.message || err) })
    }
  }
  // 쪽지는 시트 순서와 상관없으니 잠그지 않고 바로 보낸다
  if (body.action === "mail") {
    try {
      return json(sendMail(body))
    } catch (err) {
      return json({ ok: false, error: String(err.message || err) })
    }
  }
  const lock = LockService.getScriptLock()
  try {
    lock.waitLock(10000)
    switch (body.action) {
      case "comment":
        return json(addComment(body))
      case "edit":
        return json(editComment(body))
      case "delete":
        return json(deleteComment(body))
      case "like":
        return json(setLike(body))
      default:
        return json({ ok: false, error: "unknown_action" })
    }
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) })
  } finally {
    try {
      lock.releaseLock()
    } catch (e2) {}
  }
}

// ── 처음 한 번 실행: 시트 만들고 관리자 키 발급 ─────────────────

function setup() {
  const ss = book()
  sheet_(ss, "comments", [
    "id", "page", "title", "url", "parentId", "nickname", "isOwner", "body",
    "pwHash", "salt", "createdAt", "updatedAt", "deleted", "ip",
    "createdAtKst", "ipFull", "userAgent", "clientId",
  ])
  sheet_(ss, "likers", ["page", "clientId", "createdAt", "createdAtKst", "ipFull", "userAgent"])
  sheet_(ss, "log", LOG_HEADER)
  const props = PropertiesService.getScriptProperties()
  let key = props.getProperty("ADMIN_KEY")
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, "")
    props.setProperty("ADMIN_KEY", key)
  }
  const link = "https://imvely.github.io/nyuri-garden/#nyuri-admin=" + key
  MailApp.sendEmail({
    to: OWNER_EMAIL,
    subject: "[" + SITE_NAME + "] 백엔드 준비 완료 · 주인 모드 링크",
    body:
      "뉴리의창고 댓글 · 좋아요 · 쪽지 백엔드가 준비됐어요.\n\n" +
      "아래 링크를 내 브라우저에서 한 번 열면, 그 브라우저에서 남기는 댓글은 '뉴리'로 표시돼요.\n" +
      "이 링크는 다른 사람에게 보내지 마세요.\n\n" + link + "\n",
  })
  Logger.log("데이터 시트: " + ss.getName() + " → " + ss.getUrl())
  Logger.log("관리자 키: " + key)
  Logger.log("주인 모드 링크: " + link)
}

// ── 댓글 ─────────────────────────────────────────────────────

// 글 하나의 댓글과 좋아요 목록. 시트를 읽는 대신 캐시에 담아 두고, 쓰기가 생기면 지운다.
const THREAD_TTL = 1800 // 초. 시트를 손으로 고치면 길어야 30분 뒤 화면에 반영된다

function thread(page, clientId) {
  const t = threadData_(page)
  return {
    ok: true,
    comments: t.comments,
    likes: t.likers.length,
    liked: !!clientId && t.likers.indexOf(clientId) >= 0,
  }
}

function threadData_(page) {
  const cache = CacheService.getScriptCache()
  const key = threadKey_(page)
  const hit = cache.get(key)
  if (hit) {
    try {
      return JSON.parse(hit)
    } catch (e) {}
  }
  const comments = readAll_("comments")
    .filter(function (r) {
      return r.page === page
    })
    .map(publicComment_)
  comments.sort(function (a, b) {
    return a.createdAt < b.createdAt ? -1 : 1
  })
  const likers = readAll_("likers")
    .filter(function (r) {
      return r.page === page
    })
    .map(function (r) {
      return String(r.clientId)
    })
  const t = { comments: comments, likers: likers }
  try {
    cache.put(key, JSON.stringify(t), THREAD_TTL)
  } catch (e) {}
  return t
}

function threadKey_(page) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(page), Utilities.Charset.UTF_8)
  return "thread:" + Utilities.base64EncodeWebSafe(d)
}

function dropThread_(page) {
  try {
    CacheService.getScriptCache().removeAll([threadKey_(page), COUNTS_KEY])
  } catch (e) {}
}

// ── 여러 글의 좋아요, 댓글 수를 한 번에 (카테고리 목록, 관련 글) ─────
const COUNTS_KEY = "counts:all"
const COUNTS_TTL = 300 // 초. 좋아요, 댓글이 바뀌면 dropThread_ 가 바로 지운다

function countsData_() {
  const cache = CacheService.getScriptCache()
  const hit = cache.get(COUNTS_KEY)
  if (hit) {
    try {
      return JSON.parse(hit)
    } catch (e) {}
  }
  const data = { counts: {}, likers: {} }
  readAll_("likers").forEach(function (r) {
    const p = String(r.page)
    ;(data.likers[p] = data.likers[p] || []).push(String(r.clientId))
  })
  readAll_("comments").forEach(function (r) {
    if (truthy_(r.deleted)) return
    const p = String(r.page)
    data.counts[p] = data.counts[p] || { likes: 0, comments: 0 }
    data.counts[p].comments++
  })
  Object.keys(data.likers).forEach(function (p) {
    data.counts[p] = data.counts[p] || { likes: 0, comments: 0 }
    data.counts[p].likes = data.likers[p].length
  })
  try {
    cache.put(COUNTS_KEY, JSON.stringify(data), COUNTS_TTL)
  } catch (e) {}
  return data
}

// pages: 쉼표로 이은 글 키 (비우면 전체). clientId 가 있으면 내가 누른 글 목록도 준다
function counts(pages, clientId) {
  const d = countsData_()
  const want = String(pages || "")
    .split(",")
    .map(function (s) {
      return s.trim()
    })
    .filter(Boolean)
    .slice(0, 200)
  const keys = want.length ? want : Object.keys(d.counts)
  const out = {}
  const liked = []
  keys.forEach(function (k) {
    out[k] = d.counts[k] || { likes: 0, comments: 0 }
    if (clientId && (d.likers[k] || []).indexOf(String(clientId)) >= 0) liked.push(k)
  })
  return { ok: true, counts: out, liked: liked }
}

// ── 방문 분석: views 시트에 한 줄씩 ─────────────
// IP 는 원래 값을 남기지 않는다. 비밀 소금(IP_SALT)을 섞은 해시 앞 16자만 남겨 같은 사람을 한 번으로 세는 데만 쓴다
const VIEWS_HEADER = [
  "time", "day", "event", "page", "title", "channel", "refHost",
  "utmSource", "utmMedium", "utmCampaign", "device", "visitor", "newVisitor",
  "depth", "seconds", "target", "position", "reason", "ipHash", "keyword",
]
const DEVICES = { mobile: 1, tablet: 1, pc: 1, desktop: 1 }

function ipHash_(ip) {
  if (!ip) return ""
  const props = PropertiesService.getScriptProperties()
  let salt = props_().IP_SALT
  if (!salt) {
    salt = Utilities.getUuid()
    props.setProperty("IP_SALT", salt)
    PROPS_ = null
  }
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ":" + ip, Utilities.Charset.UTF_8)
  return bytes
    .slice(0, 8)
    .map(function (b) {
      return ((b + 256) % 256).toString(16).padStart(2, "0")
    })
    .join("")
}
const TRACK_EVENTS = { page_view: 1, page_leave: 1, related_click: 1 }

// ── 주인 기기 목록: 주인이 통계를 열 때 그 브라우저 ID 와 IP 해시를 적어 둔다 ──
// 적힌 브라우저나 IP 의 방문은 views 탭에 아예 쓰지 않고(track), 그 전에 쌓인 줄도 집계에서 뺀다(stats)
const OWNER_MAX = 30

function ownerSet_(name) {
  try {
    return JSON.parse(props_()[name] || "[]")
  } catch (e) {
    return []
  }
}

function rememberOwner_(visitor, ipHash) {
  let changed = false
  ;[["OWNER_VISITORS", visitor], ["OWNER_IPS", ipHash]].forEach(function (p) {
    const v = String(p[1] || "")
    if (!v) return
    const list = ownerSet_(p[0])
    if (list.indexOf(v) >= 0) return
    list.unshift(v)
    PropertiesService.getScriptProperties().setProperty(p[0], JSON.stringify(list.slice(0, OWNER_MAX)))
    changed = true
  })
  if (changed) {
    PROPS_ = null
    CacheService.getScriptCache().remove(STATS_KEY)
  }
}

function isOwnerRow_(visitor, ipHash) {
  return (!!visitor && ownerSet_("OWNER_VISITORS").indexOf(String(visitor)) >= 0) || (!!ipHash && ownerSet_("OWNER_IPS").indexOf(String(ipHash)) >= 0)
}

function track(b) {
  if (!TRACK_EVENTS[b.event]) return { ok: false, error: "bad_event" }
  if (isAdmin_(b.adminKey)) return { ok: true, skipped: "owner" } // 주인 방문은 세지 않는다
  // 주인 기기(브라우저 ID 나 IP)로 알려진 방문은 views 탭에 쓰지 않는다
  if (isOwnerRow_(b.visitor, b.meta && b.meta.ip ? ipHash_(b.meta.ip) : "")) return { ok: true, skipped: "owner" }
  if (!rateOk_("track", 600)) return { ok: false, error: "rate" }
  const s = function (v, n) {
    return clean_(v).slice(0, n || 120)
  }
  const num = function (v, max) {
    const x = Number(v)
    return isFinite(x) ? Math.max(0, Math.min(max, Math.round(x))) : ""
  }
  let sh = book().getSheetByName("views")
  if (!sh) sh = sheet_(book(), "views", VIEWS_HEADER)
  SHEETS_.views = sh
  ensureColumns_("views", ["ipHash", "keyword"])
  const device = DEVICES[b.device] ? b.device : ""
  append_("views", {
    ipHash: b.event === "page_view" ? ipHash_(b.meta && b.meta.ip) : "",
    keyword: s(b.keyword, 100),
    time: kst_(),
    day: Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd"),
    event: b.event,
    page: s(b.page, 300),
    title: s(b.title, 200),
    channel: s(b.channel, 20),
    refHost: s(b.refHost, 100),
    utmSource: s(b.utmSource, 60),
    utmMedium: s(b.utmMedium, 60),
    utmCampaign: s(b.utmCampaign, 80),
    device: device,
    visitor: s(b.visitor, 16),
    newVisitor: b.newVisitor ? "TRUE" : "",
    depth: num(b.depth, 100),
    seconds: num(b.seconds, 7200),
    target: s(b.target, 300),
    position: num(b.position, 20),
    reason: s(b.reason, 30),
  })
  return { ok: true }
}

// ── 주인 전용 방문 통계 (관리자 키가 맞을 때만 준다) ─────────────
// 방문자는 IP 해시로 한 번만 센다. IP 해시가 없는 예전 기록은 브라우저 ID(visitor)로 대신 센다
const STATS_KEY = "stats:owner"
const STATS_TTL = 60

function stats(b) {
  if (!isAdmin_(b.adminKey)) return { ok: false, error: "forbidden" }
  rememberOwner_(b.visitor, b.meta && b.meta.ip ? ipHash_(b.meta.ip) : "")
  const cache = CacheService.getScriptCache()
  const hit = cache.get(STATS_KEY)
  if (hit) {
    try {
      return JSON.parse(hit)
    } catch (e) {}
  }
  const sh = book().getSheetByName("views")
  const rows = sh ? readAll_("views") : []
  const today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd")
  const days = []
  for (let i = 6; i >= 0; i--) days.push(Utilities.formatDate(new Date(Date.now() - i * 86400000), "Asia/Seoul", "yyyy-MM-dd"))
  const set = function () {
    return { views: 0, who: {} }
  }
  const site = { today: set(), total: set() }
  const byDay = {}
  days.forEach(function (d) {
    byDay[d] = set()
  })
  const pages = {}
  const keywords = {}
  const devices = { mobile: 0, tablet: 0, pc: 0 }
  const channels = {}
  const add = function (bucket, who) {
    bucket.views++
    if (who) bucket.who[who] = 1
  }
  const ownerV = ownerSet_("OWNER_VISITORS")
  const ownerI = ownerSet_("OWNER_IPS")
  let ownerRows = 0
  rows.forEach(function (r, i) {
    if (r.event !== "page_view") return
    if ((r.visitor && ownerV.indexOf(String(r.visitor)) >= 0) || (r.ipHash && ownerI.indexOf(String(r.ipHash)) >= 0)) {
      ownerRows++
      return
    }
    const day = r.day instanceof Date ? Utilities.formatDate(r.day, "Asia/Seoul", "yyyy-MM-dd") : String(r.day)
    const who = r.ipHash ? "i:" + r.ipHash : r.visitor ? "v:" + r.visitor : "r:" + i
    add(site.total, who)
    if (day === today) add(site.today, who)
    if (byDay[day]) add(byDay[day], who)
    const key = String(r.page || "")
    if (key) {
      const p = (pages[key] = pages[key] || { title: "", total: set(), today: set() })
      if (r.title) p.title = String(r.title)
      add(p.total, who)
      if (day === today) add(p.today, who)
    }
    const kw = String(r.keyword || "").trim()
    if (kw) {
      const k = (keywords[kw] = keywords[kw] || { n: 0, from: {} })
      k.n++
      if (r.refHost) k.from[String(r.refHost)] = 1
    }
    const dev = String(r.device || "")
    if (dev === "desktop" || dev === "pc") devices.pc++
    else if (devices[dev] !== undefined) devices[dev]++
    if (r.channel && r.channel !== "internal") channels[r.channel] = (channels[r.channel] || 0) + 1
  })
  const pack = function (x) {
    return { views: x.views, visitors: Object.keys(x.who).length }
  }
  const out = {
    ok: true,
    updated: kst_(),
    today: pack(site.today),
    total: pack(site.total),
    days: days.map(function (d) {
      return { day: d, views: byDay[d].views, visitors: Object.keys(byDay[d].who).length }
    }),
    pages: Object.keys(pages)
      .map(function (k) {
        const p = pages[k]
        return { page: k, title: p.title, views: p.total.views, visitors: Object.keys(p.total.who).length, today: p.today.views, todayVisitors: Object.keys(p.today.who).length }
      })
      .sort(function (a, b2) {
        return b2.views - a.views
      }),
    keywords: Object.keys(keywords)
      .map(function (k) {
        return { keyword: k, n: keywords[k].n, from: Object.keys(keywords[k].from).join(", ") }
      })
      .sort(function (a, b2) {
        return b2.n - a.n
      })
      .slice(0, 50),
    devices: devices,
    channels: channels,
    ownerExcluded: ownerRows,
  }
  try {
    cache.put(STATS_KEY, JSON.stringify(out), STATS_TTL)
  } catch (e) {}
  return out
}

// 처음 한 번 실행: views 시트와 대시보드 시트를 만든다 (편집기에서 setupAnalytics 실행)
function setupAnalytics() {
  const ss = book()
  sheet_(ss, "views", VIEWS_HEADER)
  let d = ss.getSheetByName("대시보드")
  if (!d) d = ss.insertSheet("대시보드")
  d.clear()
  const V = "views!"
  const cells = [
    ["A1", "최근 30일 (주인 방문 제외, 한국 시각)"],
    ["A2", "날짜"], ["B2", "조회"], ["C2", "방문자"], ["D2", "새 방문자"],
    ["A3", "=ARRAYFORMULA(TEXT(SEQUENCE(30,1,TODAY()-29,1),\"yyyy-mm-dd\"))"],
    ["B3", "=ARRAYFORMULA(IF(A3:A32=\"\",,COUNTIFS(" + V + "B:B,A3:A32," + V + "C:C,\"page_view\")))"],
    ["C3", "=MAP(A3:A32,LAMBDA(d,IFERROR(COUNTUNIQUEIFS(" + V + "L:L," + V + "B:B,d," + V + "C:C,\"page_view\"),0)))"],
    ["D3", "=ARRAYFORMULA(IF(A3:A32=\"\",,COUNTIFS(" + V + "B:B,A3:A32," + V + "C:C,\"page_view\"," + V + "M:M,TRUE)))"],
    ["F1", "글별 조회 (전체 기간)"],
    ["F2", "=QUERY(" + V + "A:R,\"select E, count(C) where C = 'page_view' and E <> '' group by E order by count(C) desc limit 30 label E '글', count(C) '조회'\",1)"],
    ["I1", "유입 경로"],
    ["I2", "=QUERY(" + V + "A:R,\"select F, count(C) where C = 'page_view' group by F order by count(C) desc label F '경로', count(C) '조회'\",1)"],
    ["L1", "어디서 왔나 (외부 사이트)"],
    ["L2", "=QUERY(" + V + "A:R,\"select G, count(C) where C = 'page_view' and G <> '' and F <> 'internal' group by G order by count(C) desc limit 30 label G '사이트', count(C) '조회'\",1)"],
    ["O1", "얼마나 읽었나 (떠날 때 기준)"],
    ["O2", "=QUERY(" + V + "A:R,\"select E, avg(N), avg(O), count(C) where C = 'page_leave' and E <> '' group by E order by count(C) desc limit 30 label E '글', avg(N) '평균 스크롤 %', avg(O) '평균 읽은 초', count(C) '떠난 수'\",1)"],
    ["T1", "다음에 읽을 글 클릭"],
    ["T2", "=QUERY(" + V + "A:R,\"select R, Q, count(C) where C = 'related_click' group by R, Q order by count(C) desc label R '이유', Q '순서', count(C) '클릭'\",1)"],
    ["W1", "기기"],
    ["W2", "=QUERY(" + V + "A:R,\"select K, count(C) where C = 'page_view' group by K label K '기기', count(C) '조회'\",1)"],
  ]
  cells.forEach(function (c) {
    const r = d.getRange(c[0])
    if (String(c[1]).charAt(0) === "=") r.setFormula(c[1])
    else r.setValue(c[1])
  })
  d.getRange("A1:W1").setFontWeight("bold")
  d.setFrozenRows(2)
  Logger.log("views, 대시보드 시트 준비 완료: " + ss.getUrl())
}

function addComment(b) {
  const text = clean_(b.body)
  if (!text) return { ok: false, error: "empty" }
  if (text.length > MAX_BODY) return { ok: false, error: "too_long" }
  if (!rateOk_("comment", 20)) return { ok: false, error: "rate" }

  const owner = isAdmin_(b.adminKey)
  const password = String(b.password || "")
  if (!owner && password.length < 4) return { ok: false, error: "short_password" }

  if (b.parentId) {
    const parent = findRow_("comments", b.parentId)
    if (!parent || parent.data.parentId) return { ok: false, error: "not_found" } // 답글은 한 단계만
  }

  const salt = owner ? "" : Utilities.getUuid()
  const now = new Date().toISOString()
  const row = {
    id: Utilities.getUuid(),
    page: String(b.page || "").slice(0, 300),
    title: clean_(b.title).slice(0, 200),
    url: String(b.url || "").slice(0, 500),
    parentId: String(b.parentId || ""),
    nickname: owner ? "뉴리" : clean_(b.nickname).slice(0, 20) || "익명의 감자",
    isOwner: owner,
    body: text,
    pwHash: owner ? "" : hash_(salt, password),
    salt: salt,
    createdAt: now,
    updatedAt: "",
    deleted: false,
    // 방문자 브라우저가 보낸 IP 앞 두 자리(예: 121.134.xx.xx). 전체 IP 는 받지 않는다.
    ip: owner ? "" : maskIp_(b.meta.ip || b.ip),
    // 관리용 기록 (화면에는 나가지 않음)
    createdAtKst: kst_(),
    ipFull: b.meta.ip,
    userAgent: b.meta.ua,
    clientId: b.meta.clientId,
  }
  ensureColumns_("comments", ["ip", "createdAtKst", "ipFull", "userAgent", "clientId"])
  append_("comments", row)
  dropThread_(row.page)
  log_(row.parentId ? "답글" : "댓글", b, { id: row.id, title: row.title, url: row.url, nickname: row.nickname, owner: owner, detail: row.body })

  if (!owner) {
    notify_(
      "새 " + (row.parentId ? "답글" : "댓글") + ": " + row.title,
      row.nickname + " 님이 「" + row.title + "」에 " + (row.parentId ? "답글" : "댓글") + "을 남겼어요.\n\n" +
        row.body + "\n\n" + (row.url || ""),
    )
  }
  return { ok: true, comment: publicComment_(row) }
}

function editComment(b) {
  const found = findRow_("comments", b.id)
  if (!found || truthy_(found.data.deleted)) return { ok: false, error: "not_found" }
  if (!canTouch_(found.data, b)) {
    log_("수정 실패(비밀번호)", b, { id: found.data.id, title: found.data.title, url: found.data.url, nickname: found.data.nickname })
    return { ok: false, error: "password" }
  }
  const text = clean_(b.body)
  if (!text) return { ok: false, error: "empty" }
  if (text.length > MAX_BODY) return { ok: false, error: "too_long" }
  const before = String(found.data.body || "")
  log_("수정", b, { id: found.data.id, title: found.data.title, url: found.data.url, nickname: found.data.nickname, owner: isAdmin_(b.adminKey), detail: "[전] " + before + "\n[후] " + text })
  found.data.body = text
  found.data.updatedAt = new Date().toISOString()
  write_("comments", found.row, found.data)
  dropThread_(found.data.page)
  if (!isAdmin_(b.adminKey)) {
    notify_(
      "댓글 수정: " + found.data.title,
      found.data.nickname + " 님이 「" + found.data.title + "」의 댓글을 고쳤어요.\n\n" +
        "[고치기 전]\n" + before + "\n\n[고친 뒤]\n" + text + "\n\n" + (found.data.url || ""),
    )
  }
  return { ok: true, comment: publicComment_(found.data) }
}

function deleteComment(b) {
  const found = findRow_("comments", b.id)
  if (!found || truthy_(found.data.deleted)) return { ok: false, error: "not_found" }
  if (!canTouch_(found.data, b)) {
    log_("삭제 실패(비밀번호)", b, { id: found.data.id, title: found.data.title, url: found.data.url, nickname: found.data.nickname })
    return { ok: false, error: "password" }
  }
  log_("삭제", b, { id: found.data.id, title: found.data.title, url: found.data.url, nickname: found.data.nickname, owner: isAdmin_(b.adminKey), detail: found.data.body })
  if (!isAdmin_(b.adminKey)) {
    notify_(
      "댓글 삭제: " + found.data.title,
      found.data.nickname + " 님이 「" + found.data.title + "」의 댓글을 지웠어요.\n\n" +
        "[지운 내용]\n" + found.data.body + "\n\n" + (found.data.url || ""),
    )
  }
  const hasReplies = readAll_("comments").some(function (r) {
    return r.parentId === found.data.id && !truthy_(r.deleted)
  })
  dropThread_(found.data.page)
  if (hasReplies) {
    // 답글이 달린 댓글은 내용만 지우고 자리는 남긴다
    found.data.deleted = true
    found.data.body = ""
    write_("comments", found.row, found.data)
    return { ok: true, removed: false }
  }
  sh_("comments").deleteRow(found.row)
  VALUES_.comments = null
  return { ok: true, removed: true }
}

// ── 좋아요 ───────────────────────────────────────────────────

function setLike(b) {
  const page = String(b.page || "").slice(0, 300)
  const clientId = String(b.clientId || "").slice(0, 80)
  if (!page || !clientId) return { ok: false, error: "bad_request" }
  const sh = sh_("likers")
  const values = values_("likers")
  let at = -1
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === page && values[i][1] === clientId) {
      at = i + 1
      break
    }
  }
  const title = clean_(b.title).slice(0, 200) || page
  if (b.like && at < 0) {
    if (!rateOk_("like", 120)) return { ok: false, error: "rate" }
    ensureColumns_("likers", ["createdAtKst", "ipFull", "userAgent"])
    append_("likers", {
      page: page,
      clientId: clientId,
      createdAt: new Date().toISOString(),
      createdAtKst: kst_(),
      ipFull: b.meta.ip,
      userAgent: b.meta.ua,
    })
  }
  if (!b.like && at > 0) {
    sh.deleteRow(at)
    VALUES_.likers = null
  }
  if ((b.like && at < 0) || (!b.like && at > 0)) dropThread_(page)
  const result = thread(page, clientId)
  if ((b.like && at < 0) || (!b.like && at > 0)) {
    log_(b.like ? "좋아요" : "좋아요 취소", b, { title: title, url: b.url, detail: "지금 좋아요 " + result.likes + "개" })
    notify_(
      (b.like ? "좋아요: " : "좋아요 취소: ") + title,
      "「" + title + "」에 " + (b.like ? "좋아요가 눌렸어요." : "좋아요가 취소됐어요.") +
        "\n지금 좋아요 " + result.likes + "개\n\n" + String(b.url || ""),
    )
  }
  return result
}

// ── 뉴리펫 쪽지 → 메일 ──────────────────────────────────────

function sendMail(b) {
  const message = clean_(b.message)
  if (!message) return { ok: false, error: "empty" }
  if (message.length > MAX_BODY) return { ok: false, error: "too_long" }
  if (!rateOk_("mail", 10)) return { ok: false, error: "rate" }
  const email = String(b.email || "").trim()
  // 답장 받을 이메일은 필수
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "email" }
  log_("뉴리펫 쪽지", b, { title: clean_(b.title), url: String(b.page || ""), nickname: email, detail: message })
  MailApp.sendEmail({
    to: OWNER_EMAIL,
    replyTo: email, // 메일에서 '답장'을 누르면 바로 보낸 사람에게 간다
    subject: "[" + SITE_NAME + "] 뉴리펫 쪽지: " + clean_(b.title).slice(0, 80),
    body:
      message + "\n\n" +
      "답장 받을 이메일: " + email + "\n" +
      "보낸 페이지: " + String(b.page || "") + "\n" +
      "IP: " + (b.meta.ip || "(알 수 없음)") + "\n" +
      "보낸 시각: " + Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm") + "\n",
    name: "뉴리펫",
  })
  return { ok: true }
}

// ── 도우미 ───────────────────────────────────────────────────

const LOG_HEADER = [
  "time", "action", "title", "url", "commentId", "nickname", "owner",
  "ipFull", "ip", "userAgent", "clientId", "referrer", "detail",
]

// 요청에 딸려 온 기록 정보 (브라우저가 보낸 값이라 참고용)
function meta_(b) {
  const m = (b && b.meta) || {}
  const ip = String(m.ip || "").trim().slice(0, 60)
  return {
    ip: /^[0-9a-fA-F.:]+$/.test(ip) ? ip : "",
    ua: String(m.ua || "").slice(0, 300),
    clientId: String(m.clientId || b.clientId || "").slice(0, 80),
    referrer: String(m.referrer || "").slice(0, 300),
  }
}

// 한국 시간 (2026-11-06 13:05:42)
function kst_() {
  return Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss")
}

// 모든 행동을 log 탭에 한 줄씩 남긴다. 실패해도 본래 처리는 계속한다.
function log_(action, b, f) {
  try {
    const m = b.meta || {}
    append_("log", {
      time: kst_(),
      action: action,
      title: f.title || "",
      url: f.url || "",
      commentId: f.id || "",
      nickname: f.nickname || "",
      owner: f.owner ? "TRUE" : "",
      ipFull: m.ip || "",
      ip: maskIp_(m.ip),
      userAgent: m.ua || "",
      clientId: m.clientId || "",
      referrer: m.referrer || "",
      detail: String(f.detail || "").slice(0, 2000),
    })
  } catch (err) {
    console.warn("기록 실패: " + err)
  }
}

// 주인에게 알림 메일. 메일 한도 초과 등으로 실패해도 방문자의 행동은 막지 않는다.
function notify_(subject, body) {
  try {
    MailApp.sendEmail({
      to: OWNER_EMAIL,
      subject: "[" + SITE_NAME + "] " + subject,
      body: body + "\n\n— " + Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm") + " 뉴리펫 알림",
      name: "뉴리펫",
    })
  } catch (err) {
    console.warn("알림 메일 실패: " + err)
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

// 한 요청 안에서 재사용 (매번 openById 하면 수백 ms 씩 든다)
let BOOK_ = null
let PROPS_ = null
const SHEETS_ = {}
const HEADS_ = {}
const VALUES_ = {}

function props_() {
  if (!PROPS_) PROPS_ = PropertiesService.getScriptProperties().getProperties()
  return PROPS_
}

function sh_(name) {
  if (!SHEETS_[name]) {
    let s = book().getSheetByName(name)
    if (!s && name === "log") s = sheet_(book(), "log", LOG_HEADER)
    SHEETS_[name] = s
  }
  return SHEETS_[name]
}

function head_(name) {
  if (!HEADS_[name]) {
    const s = sh_(name)
    HEADS_[name] = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0]
  }
  return HEADS_[name]
}

function values_(name) {
  if (!VALUES_[name]) VALUES_[name] = sh_(name).getDataRange().getValues()
  return VALUES_[name]
}

function book() {
  if (!BOOK_) BOOK_ = openBook_()
  return BOOK_
}

function openBook_() {
  const props = PropertiesService.getScriptProperties()
  const id = props_().SHEET_ID
  if (id) return SpreadsheetApp.openById(id)
  const active = SpreadsheetApp.getActiveSpreadsheet()
  if (active) {
    props.setProperty("SHEET_ID", active.getId())
    return active
  }
  const created = SpreadsheetApp.create(SITE_NAME + " 댓글")
  props.setProperty("SHEET_ID", created.getId())
  return created
}

function sheet_(ss, name, header) {
  let sh = ss.getSheetByName(name)
  if (!sh) sh = ss.insertSheet(name)
  if (sh.getLastRow() === 0) sh.appendRow(header)
  return sh
}

function readAll_(name) {
  const v = values_(name)
  const head = v[0]
  return v.slice(1).map(function (r) {
    const o = {}
    head.forEach(function (h, i) {
      o[h] = r[i]
    })
    return o
  })
}

function findRow_(name, id) {
  const v = values_(name)
  const head = v[0]
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === id) {
      const o = {}
      head.forEach(function (h, j) {
        o[h] = v[i][j]
      })
      return { row: i + 1, data: o }
    }
  }
  return null
}

function append_(name, obj) {
  const sh = sh_(name)
  const head = head_(name)
  VALUES_[name] = null
  sh.appendRow(
    head.map(function (h) {
      return obj[h] === undefined ? "" : obj[h]
    }),
  )
}

function write_(name, row, obj) {
  const sh = sh_(name)
  const head = head_(name)
  VALUES_[name] = null
  sh.getRange(row, 1, 1, head.length).setValues([
    head.map(function (h) {
      return obj[h] === undefined ? "" : obj[h]
    }),
  ])
}

function publicComment_(r) {
  const deleted = truthy_(r.deleted)
  return {
    id: String(r.id),
    parentId: String(r.parentId || ""),
    nickname: String(r.nickname || ""),
    isOwner: truthy_(r.isOwner),
    body: deleted ? "" : String(r.body || ""),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    edited: !!r.updatedAt,
    deleted: deleted,
    ip: String(r.ip || ""),
  }
}

// IP 를 앞 두 자리만 남긴 형태로만 받는다
function maskIp_(raw) {
  const s = String(raw || "").trim().slice(0, 60)
  const v4 = s.match(/^(\d{1,3})\.(\d{1,3})\./)
  if (v4) return v4[1] + "." + v4[2] + ".xx.xx"
  const v6 = s.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4}):/i)
  if (v6) return v6[1] + ":" + v6[2] + ":xx:xx"
  return ""
}

// 시트 제목 줄에 칸이 없으면 맨 끝에 추가한다 (기존 시트 호환)
function ensureColumns_(name, cols) {
  // 한 번 확인한 시트는 6시간 동안 다시 보지 않는다
  const cache = CacheService.getScriptCache()
  const flag = "cols:" + name + ":" + cols.join(",")
  if (cache.get(flag)) return
  const sh = sh_(name)
  const head = head_(name)
  let n = head.length
  let added = false
  cols.forEach(function (c) {
    if (head.indexOf(c) < 0) {
      sh.getRange(1, ++n).setValue(c)
      added = true
    }
  })
  if (added) HEADS_[name] = null
  cache.put(flag, "1", 21600)
}

function canTouch_(row, b) {
  if (isAdmin_(b.adminKey)) return true
  if (truthy_(row.isOwner)) return false
  return !!row.pwHash && hash_(row.salt, String(b.password || "")) === row.pwHash
}

function isAdmin_(key) {
  const real = props_().ADMIN_KEY
  return !!key && !!real && String(key) === real
}

function hash_(salt, password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ":" + password, Utilities.Charset.UTF_8)
  return Utilities.base64Encode(bytes)
}

function clean_(s) {
  return String(s || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
}

function truthy_(v) {
  return v === true || v === "TRUE" || v === "true"
}

// 아주 단순한 속도 제한: 1분에 limit 번까지
function rateOk_(kind, limit) {
  const cache = CacheService.getScriptCache()
  const key = "rate:" + kind + ":" + Math.floor(Date.now() / 60000)
  const n = Number(cache.get(key) || 0) + 1
  cache.put(key, String(n), 120)
  return n <= limit
}
