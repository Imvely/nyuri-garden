// 뉴리의창고 공유 썸네일(Open Graph 이미지) 생성기
//
// Quartz 의 og-image 플러그인이 만든 "<slug>-og-image.webp" 를 같은 이름으로 덮어쓴다.
// 그래서 페이지의 og:image / twitter:image 메타 태그는 그대로 두면 된다.
//
// 디자인: 크림색 종이 바탕, 오른쪽에 캐릭터(quartz/static/nyuri.svg),
// 왼쪽에 손글씨(Gaegu) 제목과 형광펜, 아래에 종류·태그 칩.
// 글자 배치는 Satori(폰트 파일을 직접 받아 글자를 도형으로 그림), 래스터화는 sharp.
//
// 사용법:  node scripts/make_og.mjs public
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import satori from "satori"
import sharp from "sharp"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const out = path.resolve(process.argv[2] || path.join(root, "public"))
const W = 1200
const H = 630
const C = {
  paper: "#fbf6ec",
  blob: "#f5e7cf",
  ink: "#2b221a",
  soft: "#7a6a57",
  line: "#e6d9c2",
  highlight: "rgba(242, 196, 109, 0.5)",
  chip: "#f3e6cf",
}

const fonts = [
  { name: "Gaegu", weight: 700, style: "normal", data: await fs.readFile(path.join(root, "assets/fonts/Gaegu-Bold.ttf")) },
  { name: "Gaegu", weight: 400, style: "normal", data: await fs.readFile(path.join(root, "assets/fonts/Gaegu-Regular.ttf")) },
]
const mascotSvg = await fs.readFile(path.join(root, "quartz/static/nyuri.svg"), "utf8")
const mascot = "data:image/svg+xml;base64," + Buffer.from(mascotSvg).toString("base64")
// 손으로 그은 물결 밑줄 (호박색)
const WAVE =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 230 24"><path d="M4 14 C 30 2, 50 22, 78 12 S 128 4, 152 13 S 200 20, 226 9" fill="none" stroke="#e0a64a" stroke-width="7" stroke-linecap="round"/></svg>`,
  ).toString("base64")

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))

// 작은 JSX 대체: h("div", style, ...children)
// Satori 는 자식이 여럿인 div 에 display:flex 를 요구하므로 기본값으로 둔다
const h = (type, style, ...children) => ({
  type,
  props: {
    style: type === "div" ? { display: "flex", ...style } : style,
    children: children.length === 0 ? undefined : children.length === 1 ? children[0] : children,
  },
})
const img = (src, w, ht, style = {}) => ({ type: "img", props: { src, width: w, height: ht, style } })

function titleSize(title) {
  const len = [...title].length
  if (len <= 10) return 92
  if (len <= 16) return 82
  if (len <= 24) return 72
  if (len <= 34) return 62
  return 54
}

async function render({ title, tags, kind }) {
  const size = titleSize(title)
  const chips = [kind, ...tags.slice(0, 3).map((x) => "#" + x)].filter(Boolean)

  const tree = h(
    "div",
    {
      width: W,
      height: H,
      display: "flex",
      position: "relative",
      background: C.paper,
      fontFamily: "Gaegu",
      color: C.ink,
    },
    // 오른쪽 아래 은은한 원 + 바닥 형광펜 띠
    h("div", { position: "absolute", left: W - 510, top: H - 340, width: 600, height: 600, borderRadius: 300, background: C.blob }),
    h("div", { position: "absolute", left: 0, top: H - 14, width: W, height: 14, background: "rgba(242, 196, 109, 0.55)" }),
    // 캐릭터
    img(mascot, 400, 400, { position: "absolute", left: W - 450, top: H - 458 }),
    // 왼쪽 글자 영역
    h(
      "div",
      {
        position: "absolute",
        left: 72,
        top: 64,
        width: 690,
        height: H - 64 - 72,
        display: "flex",
        flexDirection: "column",
      },
      // 사이트 이름
      h(
        "div",
        { display: "flex", alignItems: "center", gap: 14 },
        img(mascot, 58, 58),
        h("div", { fontSize: 38, fontWeight: 700, color: C.soft }, "뉴리의창고"),
      ),
      // 제목 (형광펜은 글자 아래쪽에 깔리는 배경 그라디언트로)
      h(
        "div",
        {
          flexDirection: "column",
          marginTop: 34,
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1.22,
          wordBreak: "keep-all",
        },
        ...title.split("\n").map((line) => h("div", {}, line)),
      ),
      img(WAVE, 230, 24, { marginTop: 18 }),
      h("div", { flexGrow: 1 }),
      // 칩
      h(
        "div",
        { display: "flex", gap: 12, flexWrap: "wrap" },
        ...chips.map((label) =>
          h(
            "div",
            {
              display: "flex",
              padding: "6px 20px 8px",
              borderRadius: 999,
              background: C.chip,
              border: `2px solid ${C.line}`,
              fontSize: 30,
              fontWeight: 700,
              color: C.soft,
            },
            label,
          ),
        ),
      ),
    ),
  )

  const svg = await satori(tree, { width: W, height: H, fonts })
  return sharp(Buffer.from(svg), { density: 96 }).webp({ quality: 90 }).toBuffer()
}

async function* htmlFiles(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === "static") continue
      yield* htmlFiles(p)
    } else if (e.name.endsWith(".html")) yield p
  }
}

let n = 0
for await (const file of htmlFiles(out)) {
  const html = await fs.readFile(file, "utf8")
  const og = html.match(/<meta property="og:image" content="([^"]+)"/)
  if (!og) continue
  const imgName = decodeURIComponent(new URL(og[1]).pathname.split("/").pop())
  const target = path.join(path.dirname(file), imgName)
  try {
    await fs.access(target)
  } catch {
    continue // 플러그인이 만든 이미지가 없는 페이지는 건너뛴다
  }

  const rel = path.relative(out, file).replace(/\\/g, "/")
  const isIndex = rel === "index.html"
  const isTag = rel.startsWith("tags/")
  let title = decode((html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || "")
  if (isIndex) title = "손으로 정리한\n공부 노트"
  if (isTag) title = "#" + title.replace(/^Tag:\s*/i, "")
  const tags = [...html.matchAll(/class="internal tag-link"[^>]*>#?([^<]+)<\/a>/g)].map((m) => decode(m[1]).trim())
  const kind = isIndex ? "공부 노트 모음" : isTag ? "태그 모음" : "논문 노트"

  await fs.writeFile(target, await render({ title, tags: [...new Set(tags)], kind }))
  n++
}
console.log(`og images rendered: ${n}`)
