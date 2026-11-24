"""IndexNow 로 공개 글 주소를 검색엔진(Bing, 네이버, Yandex 등 IndexNow 참여 엔진)에 알린다. 계정과 비용 없음.

사용:  python scripts/indexnow_submit.py            (사이트맵의 모든 주소)
       python scripts/indexnow_submit.py <주소> ...  (지정한 주소만)
키 파일은 scripts/seo_post.py 가 빌드 때 사이트 경로 아래에 만든다 (keyLocation 으로 범위를 알린다).
배포가 끝난 뒤에 돌린다(키 파일이 실제 사이트에 있어야 한다).
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from seo_post import INDEXNOW_KEY  # noqa: E402

BASE = "https://imvely.github.io/nyuri-garden/"


def main():
    urls = sys.argv[1:]
    if not urls:
        xml = urllib.request.urlopen(BASE + "sitemap.xml", timeout=30).read().decode("utf-8")
        urls = re.findall(r"<loc>(.*?)</loc>", xml)
    urls = [u if u.startswith("http") else "https://" + u for u in urls]
    body = json.dumps({
        "host": "imvely.github.io",
        "key": INDEXNOW_KEY,
        "keyLocation": f"{BASE}{INDEXNOW_KEY}.txt",
        "urlList": urls[:10000],
    }).encode("utf-8")
    # api.indexnow.org 는 참여 엔진 전체에 나눠 준다. 주로 보는 Bing 과 네이버에는 직접도 보낸다
    for name, endpoint in (("IndexNow", "https://api.indexnow.org/indexnow"), ("Bing", "https://www.bing.com/indexnow"),
                           ("네이버", "https://searchadvisor.naver.com/indexnow"), ("Yandex", "https://yandex.com/indexnow")):
        req = urllib.request.Request(endpoint, data=body, headers={"Content-Type": "application/json; charset=utf-8"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                print(f"{name}:", r.status, len(urls), "개 주소")
        except urllib.error.HTTPError as e:
            print(f"{name} 실패:", e.code, e.read()[:200])
        except Exception as e:  # 회사망 차단 등
            print(f"{name} 연결 실패:", type(e).__name__, str(e)[:120])

if __name__ == "__main__":
    main()
