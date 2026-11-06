"""빌드된 HTML 의 <head> 맨 앞에 두 가지를 넣는다.

1. 다크모드 기본값: Quartz darkmode 플러그인은 localStorage 'theme' 이 없으면 OS 설정을 따른다.
   이 스크립트가 먼저 실행돼 기본값을 dark 로 정해두고, 방문자가 토글하면 그 선택이 유지된다.
2. 웹폰트 링크: 손글씨 제목(Gaegu), 코드(JetBrains Mono), 본문(Pretendard).
   Quartz 는 custom.scss 를 다른 CSS 뒤에 이어 붙여서 @import 를 쓸 수 없기 때문에 여기서 넣는다.
   (static/viewer.html 처럼 <head> 에 이미 SNIPPET 이 있는 파일은 건너뛴다)

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
    '<script src="__ROOT__static/share.js" defer></script>'
)
OLD_SNIPPET = '<script>try{if(!localStorage.getItem("theme"))localStorage.setItem("theme","dark")}catch(e){}</script>'

out = Path(sys.argv[1] if len(sys.argv) > 1 else "public")
n = 0
for f in out.rglob("*.html"):
    if "static" in f.relative_to(out).parts:
        continue
    s = f.read_text(encoding="utf-8")
    if 'static/share.js' in s or "<head>" not in s:
        continue
    s = s.replace(OLD_SNIPPET, "")
    # 페이지 깊이에 맞춘 사이트 루트 상대 경로 (예: tags/x.html -> ../)
    depth = len(f.relative_to(out).parts) - 1
    root = "./" if depth == 0 else "../" * depth
    f.write_text(s.replace("<head>", "<head>" + SNIPPET.replace("__ROOT__", root), 1), encoding="utf-8")
    n += 1
print(f"dark default + web fonts injected into {n} pages")
