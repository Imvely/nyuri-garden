"""옵시디언 볼트에서 publish: true 가 붙은 노트만 Quartz content/ 로 복사한다.

사용법:  python scripts/sync_content.py "<볼트 경로>"
- 노트 속성(frontmatter)에 publish: true 가 있는 .md 만 복사
- 그 노트가 참조하는 첨부(![[...]]) 이미지 파일을 같은 상대 경로로 복사
- ![[이름.excalidraw]] 임베드는 같은 폴더/첨부에 이름.png 가 있으면 PNG 임베드로 바꾼다
- content/ 안의 기존 파일 중 더 이상 publish 대상이 아닌 .md 는 지운다 (index.md 는 유지)
"""
import os, re, shutil, sys
from pathlib import Path

vault = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parent.parent
content = root / "content"
content.mkdir(exist_ok=True)

FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)
EMBED_RE = re.compile(r"!\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]")
IMG_EXT = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}

def is_publish(text):
    m = FM_RE.match(text)
    return bool(m) and re.search(r"^publish:\s*true\s*$", m.group(1), re.M) is not None

# 볼트 안 파일 색인 (파일명 -> 경로), 옵시디언 '가장 짧은 경로' 링크 해석용
index = {}
for p in vault.rglob("*"):
    if p.is_file() and ".obsidian" not in p.parts and ".git" not in p.parts and ".claude" not in p.parts:
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
for md in vault.rglob("*.md"):
    if any(part in (".obsidian", ".git", ".claude", "Excalidraw") for part in md.parts):
        continue
    text = md.read_text(encoding="utf-8")
    if not is_publish(text):
        continue
    rel = md.relative_to(vault)

    def fix_embed(m):
        target = m.group(1).strip()
        src = resolve(target)
        if src is None:
            return m.group(0)
        # Excalidraw 그림은 같은 이름의 PNG 로 대체
        if src.name.endswith(".excalidraw.md"):
            png_name = src.name[: -len(".excalidraw.md")] + ".png"
            png = resolve(png_name)
            if png is None:
                return f"> [!note] 그림 `{png_name}` 이 아직 없음"
            src = png
        if src.suffix.lower() in IMG_EXT:
            arel = src.relative_to(vault)
            dst = content / arel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            copied_assets.append(str(arel))
            return f"![[{arel.as_posix()}]]"
        return m.group(0)

    text = EMBED_RE.sub(fix_embed, text)
    dst = content / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(text, encoding="utf-8")
    published.append(str(rel))

# publish 가 풀린 노트는 content 에서 제거
for md in content.rglob("*.md"):
    rel = md.relative_to(content)
    if rel.name == "index.md" and rel.parent == Path("."):
        continue
    if str(rel) not in published:
        md.unlink()

print("published notes:", *published, sep="\n  ")
print("assets:", *sorted(set(copied_assets)), sep="\n  ")
