"""빌드 결과(public)에 SEO, AI 검색 준비, 성능 손질을 한다. postbuild.py 가 부른다 (표준 라이브러리만 사용, CI 에서도 돈다).

근거 스킬 (볼트 .claude/skills): seo-audit, seo-technical, seo-page, seo-schema, schema, seo-sitemap, geo-llmstxt, geo-crawlers
측정: 볼트 .claude/skills/nyuri-post/scripts/seo_measure.py

하는 일
1. 설명문: meta description, og:description, twitter:description, og:image:alt 를 글 요약(summary)으로 (본문 첫 상자 '한 줄 요약' 문구 대신)
2. canonical 주소
3. 글: og:type article, article:published_time, article:modified_time, article:tag
4. JSON-LD: 글 BlogPosting + BreadcrumbList, 카테고리 CollectionPage + BreadcrumbList, 홈 WebSite + Blog
5. 비공개 폴더(연구, 강의, 아이디어, 일지)와 태그 페이지는 noindex, follow 이고 사이트맵에서 뺀다
6. 그림: 빈 alt 는 바로 아래 캡션으로, width/height 는 실제 파일 크기로, 첫 그림 뒤는 지연 로딩
7. 성능: 쓰지 않는 Quartz 기본 글꼴과 수식 없는 페이지의 KaTeX CSS 를 걷어 내고, 웹 글꼴 CSS 는 렌더링을 막지 않게 불러온다
8. robots.txt, llms.txt (사이트 경로 아래. github.io 도메인 루트 robots.txt 는 사용자 사이트 저장소가 있어야 한다)
"""
import html as htmlmod
import json
import re
import struct
import urllib.parse
from pathlib import Path

SITE_NAME = "뉴리의창고"
INDEXNOW_KEY = "94136374f4584429ff18ff38a2a85261"  # IndexNow 키 (공개 값). scripts/indexnow_submit.py 가 쓴다
SITE_DESC = "AI와 IT 소식을 골라 정리하고, 무료로 직접 해 본 기록과 읽은 논문을 손으로 정리하는 개인 블로그예요."
AUTHOR = "뉴리"
PRIVATE = ("연구/", "강의/", "아이디어/", "일지/")
NOINDEX_PREFIX = PRIVATE + ("tags/",)
CAT_NAMES = {"it-트렌드": "IT 트렌드", "논문-노트": "논문 노트"}


# 검색엔진 소유 확인 줄(robots.txt 방식). Daum 웹마스터도구: 사이트 https://imvely.github.io 로 등록 (2026-11-08)
ROBOTS_VERIFY = ("#DaumWebMasterTool:b5f5a17a8b096e949c9c1aac83c7d4311f672fec472a42833ebe85fa1ac6dc62:8eDCqJCqTZrYCvf1G9zNRA==",)
AI_BOTS = ("OAI-SearchBot", "ChatGPT-User", "GPTBot", "Claude-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "Bingbot", "Yeti")


def robots_txt(base):
    """검색 엔진과 AI 검색 크롤러 모두 허용, 비공개 폴더는 제외.
    이름을 따로 적은 봇은 '*' 묶음 규칙을 읽지 않으므로(RFC 9309) 한 묶음에 함께 적는다.
    도메인 맨 위 robots.txt(Imvely/imvely.github.io 저장소)도 같은 내용을 쓴다."""
    return ("# 뉴리의창고. 검색 엔진과 AI 검색 크롤러(geo-crawlers 기준) 모두 허용, 비공개 폴더는 제외\n"
            + "".join(f"User-agent: {b}\n" for b in ("*",) + AI_BOTS)
            + "".join(f"Disallow: /nyuri-garden/{urllib.parse.quote(p)}\n" for p in PRIVATE)
            + "Allow: /\n\n"
            + f"Sitemap: {base}sitemap.xml\n"
            + "".join(f"{v}\n" for v in ROBOTS_VERIFY))


def rss_xml(base, posts, name="index.xml", utm=""):
    """Quartz 기본 RSS 는 최근 수정순 10개라 태그 쪽(noindex)만 담겼다. 공개 글만 새 글 순으로 다시 쓴다.
    index.xml 은 꼬리표 없이 검색엔진 제출용(Search Console 사이트맵, 네이버 RSS). feed.xml 은 구독자용으로 글 주소에 utm 꼬리표를 붙여
    방문 분석 시트에서 RSS 유입을 따로 센다. 쪽마다 있는 RSS 자동 발견 링크는 feed.xml 을 가리킨다."""
    from email.utils import format_datetime
    from datetime import datetime, timezone

    def rfc822(d):
        try:
            return format_datetime(datetime.fromisoformat(str(d)[:10]).replace(tzinfo=timezone.utc))
        except ValueError:
            return ""
    items = sorted([p for p in posts.values() if p["cat"] in CAT_NAMES], key=lambda p: p["added"], reverse=True)
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
           f"<title>{esc(SITE_NAME)}</title>", f"<link>{base}</link>",
           f"<description>{esc(SITE_DESC)}</description>", "<language>ko-KR</language>",
           f'<atom:link href="{base}{name}" rel="self" type="application/rss+xml"/>']
    if items:
        out.append(f"<lastBuildDate>{rfc822(items[0]['added'])}</lastBuildDate>")
    for p in items:
        url = abs_url(base, p["slug"])  # abs_url 이 이미 사이트맵과 같은 인코딩을 한다
        link = url + utm
        out.append(f"<item><title>{esc(p['title'])}</title><link>{esc(link)}</link><guid isPermaLink=\"true\">{url}</guid>"
                   f"<category>{esc(CAT_NAMES[p['cat']])}</category>"
                   f"<description>{esc(p['summary'] or '')}</description><pubDate>{rfc822(p['added'])}</pubDate></item>")
    out.append("</channel></rss>")
    return "\n".join(out) + "\n"
def esc(s):
    return htmlmod.escape(str(s or ""), quote=True)


def abs_url(base, slug):
    s = slug[:-5] if slug.endswith("index") else slug  # 'it-트렌드/index' -> 'it-트렌드/'
    return base + urllib.parse.quote(s, safe="/()-.")


def img_size(p: Path):
    try:
        b = p.open("rb").read(64)
    except OSError:
        return None
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", b[16:24])
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        if b[12:16] == b"VP8X":
            return (1 + int.from_bytes(b[24:27], "little"), 1 + int.from_bytes(b[27:30], "little"))
        if b[12:16] == b"VP8 ":
            w, h = struct.unpack("<HH", b[26:30])
            return (w & 0x3FFF, h & 0x3FFF)
        if b[12:16] == b"VP8L":
            v = int.from_bytes(b[21:25], "little")
            return ((v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1)
    return None


def set_meta(h, attr, key, value):
    """<meta attr="key" content=...> 의 content 를 바꾸고, 없으면 head 끝에 넣는다"""
    # content 값이 빈 형태(<meta name="description" content/>)도 잡는다
    pat = re.compile(r'<meta\s+(?:name|property)="' + re.escape(key) + r'"\s+content(?:="[^"]*")?\s*/?>')
    tag = f'<meta {attr}="{key}" content="{esc(value)}"/>'
    if pat.search(h):
        return pat.sub(lambda m: tag, h, count=1)
    return h.replace("</head>", tag + "</head>", 1)


def jsonld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace("</", "<\\/") + "</script>"


def first_sentence(text):
    text = re.sub(r"\s+", " ", text).strip()
    m = re.match(r"(.+?(?:요\.|다\.|\.))\s", text + " ")
    return (m.group(1) if m else text)[:160]


def process(out: Path, base: str, posts: dict, intros: dict, git_modified):
    """posts: slug -> {title, summary, tags, added, created, venue, cat}"""
    n = 0
    for f in out.rglob("*.html"):
        rel = f.relative_to(out).as_posix()
        if rel.startswith("static/") or "nyuri-redirect" in f.read_text(encoding="utf-8")[:600]:
            continue
        slug = rel[:-5]
        h = f.read_text(encoding="utf-8")
        if "</head>" not in h or 'data-nyuri-seo="1"' in h:
            continue
        h = re.sub(r'(type="application/rss\+xml"[^>]*href="[^"]*)index\.xml"', r'\1feed.xml"', h)  # 구독자는 꼬리표 붙은 피드로
        h = h.replace("<head>", '<head data-nyuri-seo="1">', 1) if "<head>" in h else h

        # ── 성능: 쓰지 않는 기본 글꼴, 수식 없는 페이지의 KaTeX, 렌더링을 막는 웹 글꼴 CSS ──
        h = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/css2\?family=Schibsted[^"]*"\s*/?>', "", h)
        if 'class="katex' not in h:
            h = re.sub(r'<link href="https://cdn\.jsdelivr\.net/npm/katex@[^"]*katex\.min\.css"[^>]*>', "", h)
        def nonblock(m):
            href = m.group(1)
            return (f'<link rel="preload" as="style" href="{href}" onload="this.onload=null;this.rel=\'stylesheet\'">'
                    f'<noscript><link rel="stylesheet" href="{href}"></noscript>')
        h = re.sub(r'<link rel="stylesheet" href="(https://(?:fonts\.googleapis\.com/css2\?family=Gaegu|cdn\.jsdelivr\.net/gh/orioncactus/pretendard)[^"]*)">', nonblock, h)

        page_url = abs_url(base, slug)
        if slug.startswith(NOINDEX_PREFIX) or slug == "404":
            h = h.replace("</head>", '<meta name="robots" content="noindex, follow"/></head>', 1)
            f.write_text(h, encoding="utf-8")
            n += 1
            continue

        # ── 설명문과 canonical ──
        post = posts.get(slug)
        if post:
            desc = post["summary"] or first_sentence(post["title"])
        elif slug == "index":
            desc = SITE_DESC
        elif slug.endswith("/index") and intros.get(slug.split("/")[0]):
            desc = first_sentence(intros[slug.split("/")[0]])
        else:
            desc = None
        if desc:
            for attr, key in (("name", "description"), ("property", "og:description"), ("name", "twitter:description"), ("property", "og:image:alt")):
                h = set_meta(h, attr, key, desc)
        if '<link rel="canonical"' not in h:
            h = h.replace("</head>", f'<link rel="canonical" href="{page_url}"/></head>', 1)

        # ── 구조화 데이터 ──
        crumbs = [{"@type": "ListItem", "position": 1, "name": SITE_NAME, "item": base}]
        cat = slug.split("/")[0]
        if cat in CAT_NAMES:
            crumbs.append({"@type": "ListItem", "position": 2, "name": CAT_NAMES[cat], "item": abs_url(base, cat + "/index")})
        if post:
            crumbs.append({"@type": "ListItem", "position": 3, "name": post["title"], "item": page_url})
            modified = git_modified(post.get("file")) or post["added"]
            image = re.search(r'<meta property="og:image" content="([^"]+)"', h)
            article = {
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                "headline": post["title"][:110],
                "description": desc,
                "datePublished": post["added"],
                "dateModified": modified,
                "inLanguage": "ko-KR",
                "author": {"@type": "Person", "name": AUTHOR, "url": base},
                "publisher": {"@type": "Organization", "name": SITE_NAME, "url": base, "logo": {"@type": "ImageObject", "url": base + "static/icon.png"}},
                "mainEntityOfPage": {"@type": "WebPage", "@id": page_url},
                "url": page_url,
                "keywords": ", ".join(post["tags"]),
                "articleSection": CAT_NAMES.get(cat, ""),
                "isPartOf": {"@type": "Blog", "name": SITE_NAME, "url": base},
            }
            if image:
                article["image"] = image.group(1)
            if post.get("paper_url"):
                article["about"] = {"@type": "ScholarlyArticle", "name": post.get("paper_title") or post["title"], "url": post["paper_url"]}
            if post.get("minutes"):
                article["timeRequired"] = f"PT{post['minutes']}M"
            h = h.replace("</head>", jsonld(article) + jsonld({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": crumbs}) + "</head>", 1)
            h = set_meta(h, "property", "og:type", "article")
            extra = f'<meta property="article:published_time" content="{esc(post["added"])}"/><meta property="article:modified_time" content="{esc(modified)}"/>'
            extra += "".join(f'<meta property="article:tag" content="{esc(t)}"/>' for t in post["tags"])
            h = h.replace("</head>", extra + "</head>", 1)
        elif slug == "index":
            ver = Path(__file__).with_name("site_verification.json")
            if ver.exists():
                for k, v in json.loads(ver.read_text(encoding="utf-8")).items():
                    if v and not k.startswith("_"):
                        h = h.replace("</head>", f'<meta name="{esc(k)}" content="{esc(v)}"/></head>', 1)
            h = h.replace("</head>", jsonld({
                "@context": "https://schema.org", "@graph": [
                    {"@type": "WebSite", "name": SITE_NAME, "url": base, "inLanguage": "ko-KR", "description": SITE_DESC},
                    {"@type": "Blog", "name": SITE_NAME, "url": base, "inLanguage": "ko-KR", "author": {"@type": "Person", "name": AUTHOR}},
                ]}) + "</head>", 1)
        elif slug.endswith("/index") and cat in CAT_NAMES:
            items = [p for p in posts.values() if p["cat"] == cat]
            items.sort(key=lambda p: p["added"], reverse=True)
            h = h.replace("</head>", jsonld({
                "@context": "https://schema.org", "@type": "CollectionPage", "name": CAT_NAMES[cat], "url": page_url,
                "description": desc, "inLanguage": "ko-KR",
                "mainEntity": {"@type": "ItemList", "itemListElement": [
                    {"@type": "ListItem", "position": i + 1, "url": abs_url(base, p["slug"]), "name": p["title"]} for i, p in enumerate(items)]},
            }) + jsonld({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": crumbs}) + "</head>", 1)

        # ── 그림: alt, 크기, 지연 로딩 ──
        count = [0]

        def fix_img(m):
            tag, after = m.group(1), m.group(2)
            count[0] += 1
            src = re.search(r'src="([^"]+)"', tag)
            if src and not src.group(1).startswith("http"):
                p = (f.parent / urllib.parse.unquote(src.group(1))).resolve()
                size = img_size(p)
                if size:
                    tag = re.sub(r'\swidth="[^"]*"', "", tag)
                    tag = re.sub(r'\sheight="[^"]*"', "", tag)
                    tag = tag.replace("<img", f'<img width="{size[0]}" height="{size[1]}"', 1)
            if re.search(r'\salt(?:="")?(?=[\s/>])', tag):
                cap = re.match(r'(?:<br\s*/?>\s*<em>(.*?)</em>|\s*</p>\s*<p><em>(.*?)</em></p>)', after, re.S)
                cap_text = (cap.group(1) or cap.group(2)) if cap else ""
                alt = re.sub(r"<[^>]+>", "", cap_text).strip()
                alt = alt or (post["title"] + " 그림" if post else SITE_NAME + " 그림")
                tag = re.sub(r'\salt(?:="")?(?=[\s/>])', f' alt="{esc(alt[:200])}"', tag, count=1)
            if count[0] > 1 and "loading=" not in tag:
                tag = tag.replace("<img", '<img loading="lazy" decoding="async"', 1)
            return tag + after

        h = re.sub(r'(<img\b[^>]*>)((?:<br\s*/?>\s*<em>.*?</em>|\s*</p>\s*<p><em>.*?</em></p>)?)', fix_img, h, flags=re.S)
        f.write_text(h, encoding="utf-8")
        n += 1

    # ── 사이트맵: 비공개, 태그, 404 빼기 ──
    sm = out / "sitemap.xml"
    if sm.exists():
        s = sm.read_text(encoding="utf-8")
        def keep(m):
            loc = urllib.parse.unquote(re.search(r"<loc>(.*?)</loc>", m.group(0)).group(1))
            path = loc.split(base.split("://")[1], 1)[-1] if "://" in base else loc
            path = loc.split("/nyuri-garden/", 1)[-1]
            return "" if path.startswith(NOINDEX_PREFIX) or path in ("404", "404.html") else m.group(0)
        s = re.sub(r"<url>.*?</url>", keep, s, flags=re.S)
        # Search Console 이 '알 수 없음'으로 두는 일을 줄이려고 XML 선언을 붙이고 lastmod 는 날짜만 (seo-sitemap)
        s = re.sub(r"<lastmod>(\d{4}-\d{2}-\d{2})T[^<]*</lastmod>", r"<lastmod>\1</lastmod>", s)
        if not s.lstrip().startswith("<?xml"):
            s = '<?xml version="1.0" encoding="UTF-8"?>\n' + s.lstrip()
        sm.write_text(s, encoding="utf-8")

    # ── robots.txt, llms.txt ──
    (out / "robots.txt").write_text(robots_txt(base), encoding="utf-8")
    lines = [f"# {SITE_NAME}", "", f"> {SITE_DESC}", "",
             "주인이 직접 써 본 기록과 공식 출처를 근거로 쓴 한국어 IT 블로그다. 글마다 출처, 그림, 마인드맵이 있다.", ""]
    for cat, name in CAT_NAMES.items():
        items = sorted([p for p in posts.values() if p["cat"] == cat], key=lambda p: p["added"], reverse=True)
        if not items:
            continue
        lines += [f"## {name}", ""]
        lines += [f"- [{p['title']}]({abs_url(base, p['slug'])}): {p['summary']}" for p in items]
        lines.append("")
    lines += ["## 더 보기", "", f"- [RSS]({base}index.xml)", f"- [사이트맵]({base}sitemap.xml)", ""]
    (out / "llms.txt").write_text("\n".join(lines), encoding="utf-8")
    (out / "index.xml").write_text(rss_xml(base, posts), encoding="utf-8")
    (out / "feed.xml").write_text(rss_xml(base, posts, "feed.xml", "?utm_source=rss&utm_medium=feed"), encoding="utf-8")
    (out / f"{INDEXNOW_KEY}.txt").write_text(INDEXNOW_KEY, encoding="utf-8")  # IndexNow 키 파일
    # 검색엔진 소유 확인 파일(구글 HTML 파일 방식 등): scripts/verification/ 의 파일을 사이트 경로 바로 아래로 그대로 복사
    vdir = Path(__file__).with_name("verification")
    if vdir.is_dir():
        for vf in vdir.iterdir():
            if vf.is_file():
                (out / vf.name).write_bytes(vf.read_bytes())
    return n
