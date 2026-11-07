"""옵시디언 볼트에서 publish: true 가 붙은 노트만 Quartz content/ 로 복사한다.

사용법:  python scripts/sync_content.py "<볼트 경로>"
- 노트 속성(frontmatter)에 publish: true 가 있는 .md 만 복사
- 그 노트가 참조하는 첨부(![[...]]) 이미지 파일을 같은 상대 경로로 복사
- ![[이름.excalidraw]] 임베드는 같은 이름의 PNG 임베드로 바꾼다
  같은 이름의 SVG 도 있으면 확대·축소 뷰어(static/viewer.html) 링크를 붙인다
- content/ 안의 기존 파일 중 더 이상 publish 대상이 아닌 .md 는 지운다 (index.md 는 유지)
"""
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import quote

vault = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parent.parent
content = root / "content"
content.mkdir(exist_ok=True)

FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)
EMBED_RE = re.compile(r"!\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]")
LINK_RE = re.compile(r"(?<!!)\[\[([^\]|#]+?)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]")
IMG_EXT = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}
SKIP_DIRS = {".obsidian", ".git", ".claude", ".trash"}


def site_base():
    cfg = (root / "quartz.config.yaml").read_text(encoding="utf-8")
    m = re.search(r"^\s*baseUrl:\s*(\S+)", cfg, re.M)
    return "https://" + m.group(1).strip().strip('"').rstrip("/")


VIEWER = site_base() + "/static/viewer.html"


def slug(path):
    """Quartz 의 파일 경로 slug 규칙 근사: 공백은 -, 영문은 소문자."""
    return path.replace(" ", "-").lower()


# 이 폴더들은 publish 가 켜져 있어도 절대 올리지 않는다 (보안 연구)
SECRET_DIRS = {"80 보안", "얼굴 위조 방지 (PAD)", "차량 번호판 탐지 모델"}

# 이 폴더와 계획 노트는 보안은 아니지만 블로그에 올리지 않는다 (수신함, 노트 틀, 보관)
NEVER_DIRS = {"00 수신함", "90 템플릿", "99 보관"}
NEVER_NAMES = {"01 계획.md"}

# 볼트 경로 -> 블로그 경로: 앞 정렬 번호를 떼고, 이름이 다른 대분류는 바꾼다
SITE_FOLDER_MAP = {"논문": "논문 노트"}


def site_path(rel):
    parts = [re.sub(r"^\d{2} ", "", part) for part in Path(rel).parts]
    if parts and parts[0] in SITE_FOLDER_MAP:
        parts[0] = SITE_FOLDER_MAP[parts[0]]
    return Path(*parts)


def is_secret(text):
    m = FM_RE.match(text)
    return bool(m) and re.search(r"^보안:\s*true\s*$", m.group(1), re.M) is not None


def is_publish(text):
    m = FM_RE.match(text)
    if is_secret(text):
        return False
    return bool(m) and re.search(r"^publish:\s*true\s*$", m.group(1), re.M) is not None


# 볼트 안 파일 색인 (파일명 -> 경로). 옵시디언의 '가장 짧은 경로' 링크 해석용
index = {}
files = []  # 공개 가능한 파일 전체 (폴더까지 적은 링크를 뒤에서부터 맞춰 찾는 데 쓴다)
for p in vault.rglob("*"):
    if p.is_file() and not SKIP_DIRS.intersection(p.parts) and not SECRET_DIRS.intersection(p.parts):
        index.setdefault(p.name, p)
        index.setdefault(p.stem, p)
        files.append(p)


def resolve(name):
    name = name.strip()
    cand = vault / name
    if cand.exists():
        return cand
    # '첨부/SSDG/fig2-overview.png' 처럼 폴더까지 적었으면 그 경로로 끝나는 파일만 고른다.
    # (같은 파일 이름이 논문마다 있어서 이름만으로 찾으면 다른 논문 그림이 붙는다)
    if "/" in name:
        tail = "/" + name.lstrip("/")
        hits = [f for f in files if f.as_posix().endswith(tail) or f.as_posix().endswith(tail + ".md")]
        if hits:
            return hits[0]
    for key in (name, Path(name).name, Path(name).stem):
        if key in index:
            return index[key]
    return None


def promote_h1(text):
    """본문 첫 '# 제목' 을 페이지 제목(title 속성)으로 올리고 본문에서는 뺀다.

    title 속성이 이미 있으면 건드리지 않는다. 제목이 두 번 보이는 것을 막는다.
    """
    m = FM_RE.match(text)
    if not m or re.search(r"^title:", m.group(1), re.M):
        return text
    body = text[m.end():]
    h = re.search(r"^# (.+?)\s*$", body, re.M)
    if not h:
        return text
    title = h.group(1).strip().replace('"', '\\"')
    fm = m.group(1) + f'\ntitle: "{title}"'
    body = body[: h.start()] + body[h.end():].lstrip("\n")
    return f"---\n{fm}\n---\n" + body


import json as _json

_redir_file = root / "scripts" / "redirects.json"
REDIRECTS = {}
if _redir_file.exists():
    REDIRECTS = {k: v for k, v in _json.loads(_redir_file.read_text(encoding="utf-8")).items() if not k.startswith("_")}


def add_aliases(text, key):
    """옮긴 노트에 예전 주소를 aliases 로 붙인다 (Quartz 가 예전 주소 → 새 주소 이동 페이지를 만든다)."""
    olds = REDIRECTS.get(key)
    if not olds:
        return text
    m = FM_RE.match(text)
    if not m:
        return text
    lines = "\n".join(f'  - "{o}"' for o in olds)
    fm = m.group(1) + f"\naliases:\n{lines}"
    return f"---\n{fm}\n---\n" + text[m.end():]


published, copied_assets = [], []


def copy_asset(src):
    arel = site_path(src.relative_to(vault))
    dst = content / arel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    copied_assets.append(arel.as_posix())
    return f"![[{arel.as_posix()}]]"


for md in vault.rglob("*.md"):
    if SKIP_DIRS.intersection(md.parts) or SECRET_DIRS.intersection(md.parts) or "Excalidraw" in md.parts:
        continue
    if NEVER_DIRS.intersection(md.relative_to(vault).parts) or md.name in NEVER_NAMES:
        continue
    text = md.read_text(encoding="utf-8")
    if not is_publish(text):
        continue
    rel = md.relative_to(vault)

    def viewer_anchor(src, label, rel=rel):
        """Excalidraw 파일 → 확대·축소 뷰어 <a> 태그. SVG/PNG 가 없으면 None."""
        base = src.name[: -len(".excalidraw.md")]
        png, svg = resolve(base + ".png"), resolve(base + ".svg")
        if png is None or svg is None:
            return None
        copy_asset(png)
        copy_asset(svg)
        link = (VIEWER
                + "?src=" + quote(slug(site_path(svg.relative_to(vault)).as_posix()))
                + "&fallback=" + quote(slug(site_path(png.relative_to(vault)).as_posix()))
                + "&back=" + quote(slug(site_path(rel).with_suffix("").as_posix()))
                + "&title=" + quote(base))
        # 새 창으로 연다 (data-router-ignore: Quartz SPA 전환을 타지 않는다)
        return f'<a href="{link}" target="_blank" rel="noopener" data-router-ignore>{label}</a>'

    def fix_embed(m):
        src = resolve(m.group(1))
        if src is None:
            return m.group(0)
        if src.name.endswith(".excalidraw.md"):
            base = src.name[: -len(".excalidraw.md")]
            png = resolve(base + ".png")
            if png is None:
                return f"> [!note] 그림 `{base}.png` 이 아직 없음"
            out = copy_asset(png)
            a = viewer_anchor(src, "크게 열어 보기")
            if a:
                out += f"\n\n> [!tip] 마인드맵 크게 보기\n> {a}"
            return out
        if src.suffix.lower() in IMG_EXT:
            return copy_asset(src)
        return m.group(0)

    def fix_link(m):
        """임베드가 아닌 [[그림.excalidraw|별칭]] 링크 → 뷰어 링크 (없으면 글자만)."""
        target, alias = m.group(1), m.group(2)
        src = resolve(target)
        if src is None or not src.name.endswith(".excalidraw.md"):
            return m.group(0)
        label = alias or src.name[: -len(".excalidraw.md")]
        return viewer_anchor(src, label + " (크게 보기)") or label

    text = EMBED_RE.sub(fix_embed, text)
    text = LINK_RE.sub(fix_link, text)
    text = promote_h1(text)
    text = add_aliases(text, rel.with_suffix("").as_posix())
    # 볼트 폴더 앞 정렬 번호("30 IT 트렌드")는 블로그 주소에서 떼고, 대분류 이름을 맞춘다
    rel = site_path(rel)
    dst = content / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(text, encoding="utf-8")
    published.append(rel.as_posix())

# ── 폴더 첫 화면(index.md) 자동 생성: 소개 글 + 노트 목록(제목 · 한 줄 설명) ──
_intro_file = root / "scripts" / "folder_intros.json"
INTROS = {}
if _intro_file.exists():
    INTROS = {k: v for k, v in _json.loads(_intro_file.read_text(encoding="utf-8")).items() if not k.startswith("_")}


def fm_value(text, key):
    m = FM_RE.match(text)
    if not m:
        return ""
    v = re.search(rf"^{key}:\s*(.+?)\s*$", m.group(1), re.M)
    if not v:
        return ""
    v = v.group(1).strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        v = v[1:-1]
    return v.replace('\\"', '"')


NEWEST_FIRST = {"IT 트렌드", "논문 노트"}
folders = {}
for rel in published:
    p = Path(rel)
    if len(p.parts) > 1:
        folders.setdefault(p.parent.as_posix(), []).append(p)

for folder, notes in folders.items():
    items = []
    # 공개 카테고리(IT 트렌드, 논문 노트)는 최신 글이 위로. 나머지 폴더는 예전처럼 이름순
    if folder in NEWEST_FIRST:
        def _key(x):
            tx = (content / x).read_text(encoding="utf-8")
            return (fm_value(tx, "created"), fm_value(tx, "date") or fm_value(tx, "published"), x.as_posix())
        ordered = sorted(notes, key=_key, reverse=True)
    else:
        ordered = sorted(notes, key=lambda x: x.as_posix())
    for p in ordered:
        text = (content / p).read_text(encoding="utf-8")
        title = fm_value(text, "title") or p.stem
        summary = fm_value(text, "summary")
        line = f"- [[{p.with_suffix('').as_posix()}|{title}]]"
        if summary:
            line += f"\n  {summary}"
        items.append(line)
    name = folder.split("/")[-1]
    intro = INTROS.get(folder, "")
    body = f'---\ntitle: "{name}"\n---\n\n' + (intro + "\n\n" if intro else "") + "\n".join(items) + "\n"
    (content / folder / "index.md").write_text(body, encoding="utf-8")
    published.append(f"{folder}/index.md")

# ── 블로그 뼈대: 글이 없어도 자리는 빈 페이지로 둔다 (site_skeleton.json) ──
_skel_file = root / "scripts" / "site_skeleton.json"
if _skel_file.exists():
    for page in _json.loads(_skel_file.read_text(encoding="utf-8")).get("pages", []):
        rel = page["path"]
        if rel in published:
            continue
        dst = content / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        title = page["title"].replace('"', '\\"')
        dst.write_text(f'---\ntitle: "{title}"\nplaceholder: true\n---\n', encoding="utf-8")
        published.append(rel)

# publish 가 풀린 노트는 content 에서 제거
for md in content.rglob("*.md"):
    rel = md.relative_to(content).as_posix()
    if rel == "index.md":
        continue
    if rel not in published:
        md.unlink()

sys.stdout.reconfigure(encoding="utf-8")
print("published notes:", *published, sep="\n  ")
print("assets:", *sorted(set(copied_assets)), sep="\n  ")
