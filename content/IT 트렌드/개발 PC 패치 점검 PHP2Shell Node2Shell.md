---
type: trend
source: https://www.php.net/
topic: 패치 점검
date: 2026-10-21
created: 2026-11-07
publish: true
tags: [IT트렌드, AI보안, 써본기록]
summary: AI가 찾아낸 PHP 취약점과 Brotli, 리눅스 커널 결함이 실제 공격에 쓰인 2주를 정리하고, 내 개발 PC의 Node, Bun, PowerShell, Git, WSL 버전을 직접 점검하고 올린 기록이에요.
title: "내 개발 PC는 안전할까: PHP2Shell, Node2Shell, Fragnesia 버전만 확인하는 30분 점검"
---
> [!abstract] 한 줄 요약
> 10월 하순, AI의 도움으로 찾은 PHP 취약점(PHP2Shell)과 Brotli 압축 해제 결함(Node2Shell), 리눅스 커널 권한 상승(Fragnesia)이 차례로 CISA의 실제 악용 목록(KEV)에 올랐다. 내 노트북을 점검해 보니 Node, Bun, WSL 커널이 해당해서 올렸고, Git for Windows 안의 curl과 오래된 PHP 7.4는 남았다. Node는 고친 뒤에도 Brotli 버전 표기가 그대로라서 버전 숫자만 보고 판단하면 틀린다.

![[IT 트렌드/첨부/패치 점검/패치 점검 마인드맵.png]]

> [!tip] 마인드맵 크게 보기
> <a href="https://imvely.github.io/nyuri-garden/static/viewer.html?src=it-%ED%8A%B8%EB%A0%8C%EB%93%9C/%EC%B2%A8%EB%B6%80/%ED%8C%A8%EC%B9%98-%EC%A0%90%EA%B2%80/%ED%8C%A8%EC%B9%98-%EC%A0%90%EA%B2%80-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.svg&fallback=it-%ED%8A%B8%EB%A0%8C%EB%93%9C/%EC%B2%A8%EB%B6%80/%ED%8C%A8%EC%B9%98-%EC%A0%90%EA%B2%80/%ED%8C%A8%EC%B9%98-%EC%A0%90%EA%B2%80-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.png&back=it-%ED%8A%B8%EB%A0%8C%EB%93%9C/%EA%B0%9C%EB%B0%9C-pc-%ED%8C%A8%EC%B9%98-%EC%A0%90%EA%B2%80-php2shell-node2shell&title=%ED%8C%A8%EC%B9%98%20%EC%A0%90%EA%B2%80%20%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5" target="_blank" rel="noopener" data-router-ignore>크게 열어 보기</a>
*세 결함의 요점, 이 PC에서 올린 것과 남은 것, 점검하며 알게 된 것을 모은 마인드맵.*

| 결함 | 무엇 | 고친 날 | KEV 등재 | 고친 버전 |
|---|---|---|---|---|
| PHP2Shell (CVE-2026-109618, 109619) | PHP 오류 처리의 메모리 결함. 인증 없이 원격 코드 실행 | 10월 21일 | 10월 26일 | PHP 8.5.12, 8.4.27, 8.3.36, 8.2.35 |
| Brotli Node2Shell (CVE-2026-111497) | Brotli 압축 해제의 범위 밖 쓰기 | 10월 21일 | 10월 27일 | Brotli 1.2.1, 1.1.1, 1.0.10, Node.js 26.12.1, 24.22.1, 22.23.4 |
| Fragnesia (CVE-2026-46300) | 리눅스 커널 로컬 권한 상승 | 5월부터 배포판별 | 10월 28일 | 배포판 커널 공지 기준 |

## 1. 무슨 일이 있었나

![[IT 트렌드/첨부/패치 점검/concept-patch-gap.png]]
*개념도. PHP2Shell은 공개와 패치보다 공격 시도가 먼저 왔고, Brotli는 수정 커밋이 8개월 동안 릴리스 없이 공개돼 있었다. 각 출처의 날짜로 직접 그렸다.*

PHP2Shell은 Wiz 연구팀이 8월에 찾아 PHP 보안팀에 알린 결함 두 건이다. PHP가 요청을 처리하다 메모리 부족 같은 치명적 오류를 낼 때 내부 상태가 망가진 채 남고, 다음 요청이 그 상태를 다시 쓰면서 문제가 생긴다. 앱 코드와 상관없이 PHP 자체에서 터지고, Wiz는 지난 10년 동안 나온 거의 모든 PHP 버전이 둘 중 하나 이상에 해당한다고 적었다. 찾는 과정에 Gemini 4 Argon, GPT-5.6 Sol 같은 AI 모델을 썼고, 특히 Gemini 4 Argon이 발견과 패치 검증에 크게 기여했다고 밝혔다.

PHP는 10월 21일 고친 버전을 냈다. 공지는 "완전한 우회책은 없고 업데이트만이 안전한 선택"이라고 적었다. 그런데 AWS는 공개 나흘 전인 10월 17일부터 공격 시도를 봤다고 했고, CISA는 10월 26일 KEV에 올리며 연방 기관에 사흘 안에 조치하라고 했다. 반대로 Sophos는 관측된 활동 상당수가 스캔과 실패한 시도라고 평가를 낮췄다.

Brotli 결함은 반대 방향의 문제다. 구글 Brotli 저장소에는 2월 27일 수정 커밋이 올라갔지만 릴리스와 보안 권고 없이 8개월이 지났다. 10월 21일 Brotli 1.2.1과 Node.js 보안 릴리스가 함께 나왔고, CISA는 10월 27일 KEV에 올렸다. Node.js 공지는 "공격자가 넣은 Brotli 데이터를 `node:zlib` 로 풀면 메모리가 망가져 크래시, 메모리 노출, 원격 코드 실행까지 갈 수 있다"고 적었다. 영향은 Node만이 아니다. 캐나다 사이버보안센터는 .NET, PowerShell, Bun, Envoy, Istio, Python brotli와 brotlicffi를 함께 꼽았다.

Fragnesia는 리눅스 커널의 로컬 권한 상승이다. 5월부터 배포판별 수정 커널이 나왔지만 CISA는 10월 28일에야 실제 악용으로 올렸다. 같은 주 Dream Research는 PHP2Shell과 Fragnesia를 엮어 미국, 일본, 대만, 한국의 방화벽 25대가 root를 빼앗겼다고 보고했다. 이 숫자는 Dream 한 곳의 보고다.

## 2. 내 PC에서 무엇을 보면 되나

노출 조건은 "신뢰할 수 없는 데이터를 그 프로그램이 처리하는가"다. 프로그램이 깔려 있다는 것만으로 공격받는 것은 아니다. 그래도 개발 PC에는 런타임이 여러 벌 깔려 있고, 언제 어떤 서버를 띄울지 모르니 버전을 맞춰 두는 편이 낫다.

| 확인할 것 | 명령 | 기준 |
|---|---|---|
| PHP | `php -v` | 8.5.12, 8.4.27, 8.3.36, 8.2.35 이상. 8.1 이하는 패치가 없다 |
| Node.js | `node -v` | 26.12.1, 24.22.1, 22.23.4 이상. 20 이하는 지원이 끝나 고쳐지지 않는다 |
| Bun | `bun --version` | 1.4.4 이상 |
| PowerShell 7 | `pwsh -v` | 7.6.9, 7.5.13, 7.4.22 이상 (Microsoft 보안 업데이트 가이드) |
| .NET | `dotnet --list-runtimes` | SDK 8.0.427, 9.0.320, 10.0.403 이상 (같은 가이드) |
| Python | `pip show brotli brotlicffi` | brotli 1.2.1 등 고친 버전 |
| Git for Windows 안 curl | `curl -V` (Git Bash) | Git for Windows 2.56.0.windows.4 이상 (brotli 1.2.1) |
| WSL 커널 | `wsl --version` | 사용하는 커널 계열의 고친 버전 이상 (예: 6.6.141, 6.18.33) |

Windows용 PHP는 10월 26일 같은 버전 번호에 `-1` 을 붙여 다시 빌드됐다. 안에 든 Brotli를 1.2.1로 바꾼 것이라, Windows에서 PHP를 쓰면 이 재빌드까지 받아야 한다.

## 3. 써 본 기록: 이 노트북을 점검하고 올렸다

2026년 11월 7일, 이 블로그 글을 쓰는 Windows 11 노트북에서 위 표대로 확인했다.

![[IT 트렌드/첨부/패치 점검/result-check.png]]
*직접 점검한 결과. 진한 색이 아직 남은 항목이다.*

- **Node.js**: 24.14.1이었다. winget으로 같은 24 계열의 24.22.1을 설치했다. 메이저 버전을 올리면 다른 도구가 깨질 수 있어서 계열은 바꾸지 않았다.
- **Bun**: 1.4.2였고 `bun upgrade` 로 1.4.4가 됐다.
- **WSL**: Docker Desktop용 배포판 하나만 있고 꺼져 있었다. 커널은 6.6.87.2로, 6.6 계열의 고친 버전 6.6.141보다 낮았다. `wsl --update` 뒤 WSL 3.0.3, 커널 6.18.54.1이 됐다.
- **PowerShell 7**: 7.6.9였다. Microsoft 보안 업데이트 가이드에서 10월 25일 나온 수정본임을 확인해 그대로 뒀다.
- **.NET, Python brotli**: 깔려 있지 않았다.
- **Git for Windows**: 2.51.1이었고 안에 든 curl이 brotli 1.1.0을 쓰고 있었다. 해당 범위(1.1.0부터 1.1.1 전까지)다. winget으로 올리려 했지만 관리자 권한 확인 창에서 설치가 취소돼 아직 올리지 못했다. Windows 기본 curl(8.21.0)에는 brotli가 들어 있지 않았다.
- **PHP**: 7.4.33이었다. 지원이 끝난 버전이라 고친 판이 나오지 않는다. 웹 서버로 떠 있는 PHP 프로세스와 열린 포트는 없었다. 다른 작업에 쓰일 수 있어 지우지 않았고, 서버로 쓸 일이 생기면 8.x로 옮겨야 한다.

점검하다 헷갈린 곳이 하나 있다. Node를 24.22.1로 올린 뒤 `node -p "process.versions.brotli"` 를 보니 여전히 `1.2.0` 이었다. Node 릴리스 노트를 보면 Brotli 전체를 1.2.1로 바꾼 것이 아니라 수정 커밋 하나만 골라 넣었다(cherry-pick). 그래서 런타임이 알려 주는 라이브러리 버전만 보고 "아직 취약하다"거나 "이미 고쳤다"고 판단하면 틀린다. 기준은 각 프로젝트 공지에 적힌 런타임 버전이다.

## 4. 아쉬운 점과 확인할 점

- 버전 확인은 출발점일 뿐이다. 같은 Brotli가 다른 프로그램 안에 복사돼 들어 있을 수 있다. 이번에도 Git for Windows 안의 curl은 따로 찾아야 보였다.
- Fragnesia의 WSL 커널 수정 여부는 Microsoft 공지에서 찾지 못했다. 업스트림 고친 버전과 숫자를 비교했을 뿐이다.
- Bun 1.4.4의 수정 내용은 2차 출처로 확인했다. Bun 자체 공지 원문은 열지 못했다.
- 방화벽 25대 침해는 한 곳의 보고이고, 그 보고가 인용한 Unit 42 원문은 확인하지 못했다.
- Sophos처럼 실제 피해 규모를 낮게 보는 평가도 있다. KEV 등재가 곧 대규모 피해라는 뜻은 아니다.

> [!note] 뉴리의 생각
> 1. AI가 결함을 찾는 속도가 빨라질수록, 방어 쪽의 병목은 찾기가 아니라 "내 기기 어디에 그 코드가 들어 있나"를 아는 일이 된다. 개발 PC에도 런타임과 숨은 라이브러리 목록을 뽑는 습관이 필요해 보인다.
> 2. 수정 커밋이 8개월 동안 공개돼 있었던 Brotli 사례는, 오픈소스에서 "고쳤다"와 "배포했다" 사이의 간격이 공격자에게 가장 좋은 창이라는 걸 보여 준다. 내가 쓰는 라이브러리는 릴리스뿐 아니라 보안 권고 피드까지 구독해 둘 생각이다.

## 용어 정리

| 용어 | 뜻 |
|---|---|
| KEV | 미국 CISA가 실제 악용이 확인된 취약점을 모아 둔 목록 |
| CVSS | 취약점의 심각도를 0에서 10으로 매기는 점수 |
| 원격 코드 실행 | 공격자가 네트워크 너머에서 대상 기기에 원하는 코드를 실행하는 것 |
| 로컬 권한 상승 | 이미 들어온 일반 사용자가 관리자(root) 권한을 얻는 것 |
| cherry-pick | 다른 버전의 커밋 하나만 골라 가져오는 git 작업 |
| WSL | Windows에서 리눅스 커널을 돌리는 기능 |

## 함께 보면 좋은 글

- [[WorkOS 침해 사고 에이전트 보안 점검표|WorkOS 침해 사고 점검표]]: AI 해킹 에이전트가 찾은 빈틈으로 내 저장소를 점검한 글
- [[주간 별점표 2026년 11월 1주|2026년 11월 1주 IT 트렌드]]: 같은 시기의 보안 소식

## 출처

- [PHP 공식 릴리스 공지 (8.5.12, 8.4.27, 8.3.36, 8.2.35)](https://www.php.net/)
- [Wiz Research: PHP2Shell](https://www.wiz.io/blog/php2shell-php-rce)
- [Node.js 10월 보안 릴리스](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases), [Node.js v24.22.1 릴리스 노트](https://github.com/nodejs/node/releases/tag/v24.22.1)
- [캐나다 사이버보안센터 AL26-027 (Brotli)](https://cyber.gc.ca/en/alerts-advisories/al26-027-critical-vulnerability-impacting-google-brotli-cve-2026-111497)
- [CISA KEV 목록](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
- [Microsoft 보안 업데이트 가이드 CVE-2026-111497](https://msrc.microsoft.com/update-guide/vulnerability/CVE-2026-111497)
- [Git for Windows 2.56.0.windows.4 릴리스](https://github.com/git-for-windows/git/releases/tag/v2.56.0.windows.4)
- [The Register: AWS가 본 10월 17일 공격 시도와 Sophos 평가](https://www.theregister.com/a/5305681)
- [Help Net Security: Brotli 수정 커밋과 릴리스 간격](https://helpnetsecurity.com/2026/10/27/node2shell-broccoli2shell-vulnerability-cve-2026-111497)
- [Dream Research: 방화벽 25대 침해 보고](https://dreamgroup.com/blog/chained-php2shell-exploit-roots-25-servers)
- [Bun 1.4.4 수정 정리 (2차 출처)](https://braindetox.kr/en/posts/brotli_cve_2026_111497_http2shell_beyond_nodejs.html), [Fragnesia 커널 수정 버전 정리 (2차 출처)](https://rescana.com/post/linux-kernel-fragnesia-cve-2026-46300-xfrm-esp-tcp-privilege-escalation-kev)
- 점검 기록: 2026-11-07 이 노트북에서 직접 확인한 결과(첨부 check-result.md). 그림은 출처의 날짜와 점검 결과로 직접 그렸다.
