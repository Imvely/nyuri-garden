"""빌드 결과(public)를 마무리한다.

1. 모든 HTML 의 <head> 맨 앞에 넣는 것
   - 다크모드 기본값: Quartz darkmode 플러그인은 localStorage 'theme' 이 없으면 OS 설정을 따른다.
     이 스크립트가 먼저 실행돼 기본값을 dark 로 정해두고, 방문자가 토글하면 그 선택이 유지된다.
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
    '<script>try{if(!localStorage.getItem("theme"))localStorage.setItem("theme","dark")}catch(e){}</script>'
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
)
MARKER = "static/comments.js"
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
    f.write_text(s.replace("<head>", "<head>" + SNIPPET.replace("__ROOT__", root), 1), encoding="utf-8")
    n += 1
print(f"head snippet injected into {n} pages")

# RSS 피드에는 스타일시트를 붙이지 않는다.
# (Chrome 이 XSLT 지원을 없애는 중이라 경고 배너가 뜬다. 사람이 보는 안내는 static/rss.html)
