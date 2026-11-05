"""빌드된 HTML 에 '저장된 테마가 없으면 다크' 스크립트를 <head> 맨 앞에 넣는다.

Quartz darkmode 플러그인은 localStorage 'theme' 이 없으면 OS 설정을 따른다.
이 스크립트가 먼저 실행돼 기본값을 dark 로 정해두고, 방문자가 토글하면 그 선택이 유지된다.
사용법:  python scripts/postbuild.py public
"""
import sys
from pathlib import Path

SNIPPET = '<script>try{if(!localStorage.getItem("theme"))localStorage.setItem("theme","dark")}catch(e){}</script>'
out = Path(sys.argv[1] if len(sys.argv) > 1 else "public")
n = 0
for f in out.rglob("*.html"):
    s = f.read_text(encoding="utf-8")
    if SNIPPET in s or "<head>" not in s:
        continue
    f.write_text(s.replace("<head>", "<head>" + SNIPPET, 1), encoding="utf-8")
    n += 1
print(f"dark-default injected into {n} pages")
