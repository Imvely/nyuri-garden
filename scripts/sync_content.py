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


def is_publish(text):
    m = FM_RE.match(text)
    return bool(m) and re.search(r"^publish:\s*true\s*$", m.group(1), re.M) is not None


# 볼트 안 파일 색인 (파일명 -> 경로). 옵시디언의 '가장 짧은 경로' 링크 해석용
index = {}
for p in vault.rglob("*"):
    if p.is_file() and not SKIP_DIRS.intersection(p.parts):
        index.setdefault(p.name, p)
        index.setdefault(p.stem, p)


def resolve(name):
    name = name.strip()
    cand = vault / name
    if cand.exists():
        return cand
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
    arel = src.relative_to(vault)
    dst = content / arel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    copied_assets.append(arel.as_posix())
    return f"![[{arel.as_posix()}]]"


for md in vault.rglob("*.md"):
    if SKIP_DIRS.intersection(md.parts) or "Excalidraw" in md.parts:
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
                + "?src=" + quote(slug(svg.relative_to(vault).as_posix()))
                + "&fallback=" + quote(slug(png.relative_to(vault).as_posix()))
                + "&back=" + quote(slug(rel.with_suffix("").as_posix()))
                + "&title=" + quote(base))
        # data-router-ignore: Quartz SPA 전환을 타지 않고 페이지를 새로 연다
        return f'<a href="{link}" data-router-ignore>{label}</a>'

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
            a = viewer_anchor(src, "확대·축소해서 보기")
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
        return viewer_anchor(src, label + " (확대·축소)") or label

    text = EMBED_RE.sub(fix_embed, text)
    text = LINK_RE.sub(fix_link, text)
    text = promote_h1(text)
    text = add_aliases(text, rel.with_suffix("").as_posix())
    dst = content / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(text, encoding="utf-8")
    published.append(rel.as_posix())

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
