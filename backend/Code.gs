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
  const lock = LockService.getScriptLock()
  try {
    lock.waitLock(10000)
    body.meta = meta_(body)
    switch (body.action) {
      case "comment":
        return json(addComment(body))
      case "edit":
        return json(editComment(body))
      case "delete":
        return json(deleteComment(body))
      case "like":
        return json(setLike(body))
      case "mail":
        return json(sendMail(body))
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

function thread(page, clientId) {
  const rows = readAll_("comments").filter(function (r) {
    return r.page === page
  })
  const comments = rows.map(publicComment_)
  comments.sort(function (a, b) {
    return a.createdAt < b.createdAt ? -1 : 1
  })
  const likers = readAll_("likers").filter(function (r) {
    return r.page === page
  })
  const liked = clientId
    ? likers.some(function (r) {
        return r.clientId === clientId
      })
    : false
  return { ok: true, comments: comments, likes: likers.length, liked: liked }
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
  if (hasReplies) {
    // 답글이 달린 댓글은 내용만 지우고 자리는 남긴다
    found.data.deleted = true
    found.data.body = ""
    write_("comments", found.row, found.data)
    return { ok: true, removed: false }
  }
  book().getSheetByName("comments").deleteRow(found.row)
  return { ok: true, removed: true }
}

// ── 좋아요 ───────────────────────────────────────────────────

function setLike(b) {
  const page = String(b.page || "").slice(0, 300)
  const clientId = String(b.clientId || "").slice(0, 80)
  if (!page || !clientId) return { ok: false, error: "bad_request" }
  const sh = book().getSheetByName("likers")
  const values = sh.getDataRange().getValues()
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
  if (!b.like && at > 0) sh.deleteRow(at)
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
    sheet_(book(), "log", LOG_HEADER)
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

function book() {
  const props = PropertiesService.getScriptProperties()
  const id = props.getProperty("SHEET_ID")
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
  const sh = book().getSheetByName(name)
  const v = sh.getDataRange().getValues()
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
  const sh = book().getSheetByName(name)
  const v = sh.getDataRange().getValues()
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
  const sh = book().getSheetByName(name)
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
  sh.appendRow(
    head.map(function (h) {
      return obj[h] === undefined ? "" : obj[h]
    }),
  )
}

function write_(name, row, obj) {
  const sh = book().getSheetByName(name)
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
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
  const sh = book().getSheetByName(name)
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
  let n = head.length
  cols.forEach(function (c) {
    if (head.indexOf(c) < 0) sh.getRange(1, ++n).setValue(c)
  })
}

function canTouch_(row, b) {
  if (isAdmin_(b.adminKey)) return true
  if (truthy_(row.isOwner)) return false
  return !!row.pwHash && hash_(row.salt, String(b.password || "")) === row.pwHash
}

function isAdmin_(key) {
  const real = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY")
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
