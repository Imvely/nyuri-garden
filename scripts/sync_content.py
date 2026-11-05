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

    def fix_embed(m, rel=rel):
        src = resolve(m.group(1))
        if src is None:
            return m.group(0)
        if src.name.endswith(".excalidraw.md"):
            base = src.name[: -len(".excalidraw.md")]
            png, svg = resolve(base + ".png"), resolve(base + ".svg")
            if png is None:
                return f"> [!note] 그림 `{base}.png` 이 아직 없음"
            out = copy_asset(png)
            if svg is not None:
                srel = svg.relative_to(vault).as_posix()
                copy_asset(svg)
                link = (VIEWER
                        + "?src=" + quote(slug(srel))
                        + "&fallback=" + quote(slug(png.relative_to(vault).as_posix()))
                        + "&back=" + quote(slug(rel.with_suffix("").as_posix()))
                        + "&title=" + quote(base))
                out += f"\n\n> [!tip] 마인드맵 크게 보기\n> [확대·축소해서 보기]({link})"
            return out
        if src.suffix.lower() in IMG_EXT:
            return copy_asset(src)
        return m.group(0)

    text = EMBED_RE.sub(fix_embed, text)
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
