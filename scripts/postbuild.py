"""빌드 결과(public)를 마무리한다.

1. 모든 HTML 의 <head> 맨 앞에 넣는 것
   - 테마 기본값: 어떤 기기든 라이트. Quartz darkmode 플러그인은 OS 설정을 따르므로,
     방문자가 직접 토글을 누른 적이 없으면(nyuri-theme-picked 없음) 먼저 light 로 정해 둔다.
     예전 기본값(dark)이 저장된 방문자도 직접 고른 적이 없으면 라이트로 돌아간다.
     토글을 누르면 그 선택을 기억하고 그 뒤로는 손대지 않는다.
   - 웹폰트 링크: 손글씨 제목(Gaegu), 코드(JetBrains Mono), 본문(Pretendard).
     Quartz 는 custom.scss 를 다른 CSS 뒤에 이어 붙여서 @import 를 쓸 수 없기 때문에 여기서 넣는다.
   - RSS alternate 링크, 공유 줄(share.js), 뉴리펫(nyuri-pet.js)
   (static/ 아래 HTML 은 건너뛴다)
2. RSS 구독 안내는 static/rss.html 이 맡는다 (피드 XML 은 그대로 둔다).

사용법:  python scripts/postbuild.py public
"""
import sys
from pathlib import Path

SNIPPET = (
    '<script>try{var k="nyuri-theme-picked";if(!localStorage.getItem(k)){localStorage.setItem("theme","light");'
    'matchMedia("(prefers-color-scheme: dark)").addEventListener("change",function(){if(!localStorage.getItem(k))'
    'setTimeout(function(){localStorage.setItem("theme","light");document.documentElement.setAttribute("saved-theme","light")},0)})}'
    'document.addEventListener("click",function(e){if(e.target.closest&&e.target.closest(".darkmode"))localStorage.setItem(k,"1")},true)'
    '}catch(e){}</script>'
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700'
    '&family=JetBrains+Mono:wght@400;600&display=swap">'
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9'
    '/dist/web/variable/pretendardvariable-dynamic-subset.min.css">'
    '<link rel="alternate" type="application/rss+xml" title="뉴리의창고" href="__ROOT__index.xml">'
    '<script src="__ROOT__static/nyuri-config.js"></script>'
    '<script src="__ROOT__static/share.js" defer></script>'
    '<script src="__ROOT__static/nyuri-pet.js" defer></script>'
    '<script src="__ROOT__static/comments.js" defer></script>'
    '<script src="__ROOT__static/nyuri-graph.js" defer></script>'
    '<script src="__ROOT__static/nyuri-list.js" defer></script>'
)
MARKER = "static/nyuri-list.js"
OLD_SNIPPET = '<script>try{if(!localStorage.getItem("theme"))localStorage.setItem("theme","dark")}catch(e){}</script>'

out = Path(sys.argv[1] if len(sys.argv) > 1 else "public")
n = 0
for f in out.rglob("*.html"):
    if "static" in f.relative_to(out).parts:
        continue
    s = f.read_text(encoding="utf-8")
    if MARKER in s or "<head>" not in s:
        continue
    s = s.replace(OLD_SNIPPET, "")
    # 페이지 깊이에 맞춘 사이트 루트 상대 경로 (예: tags/x.html -> ../)
    depth = len(f.relative_to(out).parts) - 1
    root = "./" if depth == 0 else "../" * depth
    # 404 페이지는 없는 주소 어디서나 뜨므로 사이트 절대 경로를 쓴다
    if f.relative_to(out).as_posix() == "404.html":
        root = "/nyuri-garden/"
    f.write_text(s.replace("<head>", "<head>" + SNIPPET.replace("__ROOT__", root), 1), encoding="utf-8")
    n += 1
print(f"head snippet injected into {n} pages")

# ── 공개 카테고리 목록 데이터 (static/nyuri-list.json) ──
# 정렬, 찾기, 태그 거르기, 페이지 나누기는 static/nyuri-list.js 가 이 파일로 한다.
# 비공개 폴더(연구, 강의, 아이디어, 일지)는 넣지 않는다.
import json, re, subprocess
LIST_FOLDERS = {"IT 트렌드": ["it트렌드"], "논문 노트": ["논문"]}
FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)
repo = Path(__file__).resolve().parent.parent
content = repo / "content"


def fm(text):
    m = FM_RE.match(text)
    data = {}
    if not m:
        return data
    last = None
    for line in m.group(1).splitlines():
        li = re.match(r"^\s+-\s+(.+)$", line)  # 여러 줄 목록 (tags:\n  - a)
        if li and last:
            item = li.group(1).strip().strip("\"'")
            data[last] = (data[last].rstrip("]") + ", " + item + "]") if data[last] else "[" + item + "]"
            continue
        mm = re.match(r"^([A-Za-z_가-힣]+):\s*(.*)$", line)
        if mm:
            last = mm.group(1)
            v = mm.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            data[mm.group(1)] = v
    return data


def first_added(path):
    try:
        out = subprocess.run(["git", "log", "--diff-filter=A", "--follow", "--format=%cI", "--", str(path)],
                             cwd=repo, capture_output=True, text=True, encoding="utf-8").stdout.split()
        return out[-1] if out else ""
    except Exception:
        return ""


idx = json.loads((out / "static" / "contentIndex.json").read_text(encoding="utf-8"))
slug_of = {v.get("filePath"): k for k, v in idx.items()}
lists = {}
for folder, hide_tags in LIST_FOLDERS.items():
    items = []
    for md in sorted((content / folder).glob("*.md")):
        if md.name == "index.md":
            continue
        rel = md.relative_to(content).as_posix()
        slug = slug_of.get(rel)
        if not slug:
            continue  # 빌드에 없는 글(초안, 암호 글)은 넣지 않는다
        f = fm(md.read_text(encoding="utf-8"))
        fm_tags = [x.strip() for x in f.get("tags", "").strip("[]").split(",") if x.strip()]
        case = {x.lower(): x for x in fm_tags}
        built = idx[slug].get("tags") or [x.lower() for x in fm_tags]  # 빌드 색인의 태그가 기준
        tags = [case.get(x, x) for x in built if x not in hide_tags]
        added = first_added(md) or (f.get("created", "") + "T23:59:59+09:00")
        # 읽는 시간: 본문 글자 수(공백 제외) / 분당 500자, 표와 그림이 많아도 최소 1분
        text = idx[slug].get("content", "")
        chars = len(re.sub(r"\s+", "", text))
        minutes = max(1, round(chars / 500))
        items.append({"slug": slug, "title": f.get("title") or idx[slug].get("title") or md.stem,
                      "summary": f.get("summary", ""), "tags": tags, "created": f.get("created", ""),
                      "venue": f.get("venue", ""), "added": added, "minutes": minutes})
        idx[slug]["added"] = added  # 탐색기 정렬용 (quartz.config.yaml 의 explorer mapFn)
    if items:
        key = slug_of.get(f"{folder}/index.md", "")
        lists[key or folder] = items
(out / "static" / "nyuri-list.json").write_text(json.dumps(lists, ensure_ascii=False), encoding="utf-8")
(out / "static" / "contentIndex.json").write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")
print("list data:", {k: len(v) for k, v in lists.items()})

# RSS 피드에는 스타일시트를 붙이지 않는다.
# (Chrome 이 XSLT 지원을 없애는 중이라 경고 배너가 뜬다. 사람이 보는 안내는 static/rss.html)

# 이름을 바꾼 폴더: 예전 폴더 주소로 들어오면 새 폴더로 넘긴다
DIR_REDIRECTS = {"논문": "논문-노트/"}
for old, new in DIR_REDIRECTS.items():
    d = out / old
    if (d / "index.html").exists() and "nyuri-redirect" not in (d / "index.html").read_text(encoding="utf-8"):
        continue  # 같은 이름의 진짜 폴더가 다시 생겼으면 건드리지 않는다
    d.mkdir(parents=True, exist_ok=True)
    target = "../" + new
    (d / "index.html").write_text(
        '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>옮겨졌어요 · 뉴리의창고</title>'
        f'<meta name="nyuri-redirect" content="{new}"><link rel="canonical" href="{target}">'
        f'<meta http-equiv="refresh" content="0; url={target}"></head>'
        f'<body><a href="{target}">새 주소로 이동</a></body></html>',
        encoding="utf-8",
    )
print("folder redirects:", ", ".join(DIR_REDIRECTS))
