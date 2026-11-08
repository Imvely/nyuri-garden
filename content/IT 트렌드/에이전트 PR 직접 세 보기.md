---
type: trend
source: https://github.blog/news-insights/octoverse/octoverse-commits-pushes-reach-new-highs-in-2026-as-developers-build-with-agents/
topic: Octoverse 2026
date: 2026-10-28
created: 2026-11-08
publish: true
tags: [IT트렌드, AI에이전트, 개발도구, 써본기록]
summary: Octoverse 2026이 밝힌 '9월 PR의 40% 넘게 에이전트가 시작했다'를 GitHub 검색 API로 공개 저장소에서 직접 세어 보고, Stack Overflow 월 질문 수도 함께 확인한 기록이에요.
title: "Octoverse 2026: 에이전트가 PR 40%를 쓴다는데, 공개 저장소에서 직접 세 보니 13.5%"
---
> [!abstract] 한 줄 요약
> GitHub은 2026년 10월 28일 Octoverse에서 9월 PR의 40% 넘게 에이전트 초안에서 시작했다고 밝혔다. 같은 9월, 공개 저장소에서 병합된 PR 1,808만 건을 GitHub 검색 API로 직접 세어 보니 에이전트로 알아볼 수 있는 신호가 붙은 PR은 13.5%였다. 1년 전 7.5%에서 늘었지만 발표와는 차이가 크고, 두 숫자는 세는 대상이 다르다. 같은 9월 Stack Overflow 질문은 한 달 964개였다.

![[IT 트렌드/첨부/에이전트 PR/에이전트 PR 마인드맵.webp]]

> [!tip] 마인드맵 크게 보기
> <a href="https://imvely.github.io/nyuri-garden/static/viewer.html?src=it-%ED%8A%B8%EB%A0%8C%EB%93%9C/%EC%B2%A8%EB%B6%80/%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8-pr/%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8-pr-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.svg&fallback=it-%ED%8A%B8%EB%A0%8C%EB%93%9C/%EC%B2%A8%EB%B6%80/%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8-pr/%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8-pr-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.png&back=it-%ED%8A%B8%EB%A0%8C%EB%93%9C/%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8-pr-%EC%A7%81%EC%A0%91-%EC%84%B8-%EB%B3%B4%EA%B8%B0&title=%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8%20PR%20%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5" target="_blank" rel="noopener" data-router-ignore>크게 열어 보기</a>
*발표 숫자, 직접 센 방법과 결과, 차이가 나는 이유를 한 장에 모은 마인드맵.*

## 한눈에 보기

| 항목 | 내용 |
|---|---|
| 발표 | GitHub Octoverse 2026 (2026년 10월 28일, 11월 6일 수정) |
| 화제가 된 숫자 | 9월 PR의 40% 넘게 에이전트 초안에서 시작(3월 17%), 9월 1억 1,000만 건 |
| GitHub의 정의 | "우리가 감지할 수 있는 코딩 에이전트에서 첫 초안이 나온 PR". 감지 방법은 공개하지 않았고 최소치라고 밝혔다 |
| 직접 센 결과 | 공개 저장소 9월 병합 PR 1,808만 건 중 에이전트 신호 13.5% (2025년 9월 7.5%) |
| 함께 본 것 | Stack Overflow 월 질문 2026년 9월 964개, 10월 973개 |
| 도구 | GitHub 검색 API(gh), Stack Exchange API. 둘 다 무료 |

## 1. 무엇이 발표됐나

GitHub은 해마다 플랫폼 통계를 Octoverse라는 이름으로 낸다. 2026년판은 10월 28일 GitHub Universe와 함께 나왔고, 핵심은 에이전트였다.

- 2026년 9월 GitHub의 PR 가운데 40% 넘게 에이전트의 첫 초안에서 시작했다. 3월에는 17%였다.
- 9월에 에이전트가 시작한 PR은 1억 1,000만 건으로, 3월의 약 6배다.
- 에이전트가 관여한 PR은 2주 안에 90%가 병합됐다(2월 83%). 감지된 에이전트가 없는 PR은 2월과 9월 모두 약 86%였다.
- 2025년 10월부터 2026년 9월까지 병합된 PR은 13억 건으로, 그 전 해 5억 3,800만 건의 약 2.4배다. 개발자는 2억 2,500만 명이 넘는다.

![[IT 트렌드/첨부/에이전트 PR/concept-what-counts.png]]
*발표 숫자와 직접 센 숫자가 무엇을 세는지 비교한 개념도. 선 길이는 비율이 아니다. 직접 그렸다.*

GitHub은 에이전트 PR을 "우리가 감지할 수 있는 코딩 에이전트에서 첫 초안이 나온 PR"로 정의했다. 어떤 에이전트를, 무엇으로 감지했는지는 적지 않았다. 대신 "모든 에이전트 사용을 감지하지는 못하므로 최소치"라고 밝혔고, 집계 기간을 9월 1일부터 8월 31일까지에서 10월 1일부터 9월 30일까지로 바꾸며 지난 해 숫자도 다시 계산했다고 적었다.

## 2. 왜 직접 세 봤나

감지 방법이 공개되지 않은 숫자는 밖에서 검증할 수 없다. 그래서 밖에서 누구나 볼 수 있는 신호로만 다시 세어, 적어도 공개 저장소에서는 어느 정도인지 확인하기로 했다.

에이전트 PR에는 겉으로 보이는 흔적이 두 가지 있다. 하나는 작성자다. Copilot 코딩 에이전트, Devin, Jules는 PR을 자기 앱 계정으로 올린다. 다른 하나는 브랜치 이름이다. 사용자 계정으로 올라오지만 브랜치 이름이 `claude/`, `codex/`, `cursor/`로 시작하는 PR이 많고, 이 이름은 각 회사 에이전트가 브랜치를 만들 때 붙이는 앞부분으로 보인다. 2026년 9월 15일 병합 PR을 접두어마다 4개씩 뽑아 보니 12개 모두 이런 이름이었다(`claude/` 뒤에 단어와 임의 문자, `cursor/` 뒤에 작업 이름과 16진수).

## 3. 어떻게 셌나

2026년 11월 8일, GitHub 검색 API로 공개 저장소에서 그 달에 병합된 PR 수를 셌다(`is:pr is:merged merged:2026-09-01..2026-09-30` 같은 검색의 `total_count`). 2025년 9월과 2026년 3월, 6월, 9월 네 달을 봤다.

1. 전체 병합 PR 수
2. 에이전트 신호 6가지: 작성자 `app/copilot-swe-agent`, `app/devin-ai-integration`, `app/google-labs-jules`, 브랜치 `claude/`, `codex/`, `cursor/`
3. 비교용 의존성 봇 2가지: Dependabot, Renovate

검색 API는 무거운 검색을 연달아 하면 2차 속도 제한을 건다. 처음에 몇 초 간격으로 보냈다가 막혔고, 요청 사이에 10초씩 쉬게 고쳐 36번을 다시 셌다(`count_prs.py`). Stack Overflow 월 질문 수는 Stack Exchange API의 개수 전용 필터로 셌다(`so_questions.py`).

## 4. 써 본 기록

### 공개 저장소에서는 13.5%

![[IT 트렌드/첨부/에이전트 PR/result-agent-share.png]]
*공개 저장소 병합 PR 가운데 에이전트 신호가 붙은 비율(직접 셈)과 Octoverse 발표값. 직접 센 숫자로 그렸다.*

| 달 | 공개 저장소 병합 PR | 에이전트 신호 | 비율 | 의존성 봇 비율 |
|---|---|---|---|---|
| 2025년 9월 | 5,102,995 | 380,541 | 7.5% | 13.9% |
| 2026년 3월 | 9,135,966 | 1,064,025 | 11.6% | 12.3% |
| 2026년 6월 | 11,403,862 | 1,270,043 | 11.1% | 10.5% |
| 2026년 9월 | 18,082,478 | 2,442,442 | 13.5% | 7.9% |

2026년 9월 기준으로 신호별로 나누면 `claude/` 브랜치가 6.92%로 가장 많았고, `codex/` 4.54%, `cursor/` 1.62%, Copilot 코딩 에이전트 0.24%, Devin 0.15%, Jules 0.03% 순이었다. 1년 전에는 `codex/`가 5.70%로 거의 전부였고 `claude/`는 0.03%였다.

눈에 띈 것이 두 가지 있다. 먼저 공개 저장소의 병합 PR 자체가 1년 새 510만 건에서 1,808만 건으로 3.5배가 됐다. 에이전트 신호 PR도 늘었지만 전체가 같이 커져서 비율은 7.5%에서 13.5%로 올랐다. 다음으로 Copilot 코딩 에이전트의 공개 PR은 3월 23만 1,450건에서 9월 4만 3,037건으로 줄었다. `copilot/` 브랜치 수도 23만 5,108건에서 4만 6,790건으로 같이 줄어, 이름이 바뀐 탓은 아니었다.

### 발표와 차이가 나는 이유

13.5%와 40%는 같은 것을 센 숫자가 아니다. 차이가 나는 이유로 짐작할 수 있는 것이 세 가지 있다.

- GitHub의 숫자에는 비공개 저장소가 들어간다. 회사 저장소에서 에이전트를 많이 쓴다면 공개 저장소보다 비율이 높을 수 있다.
- 에이전트가 늘 표시를 남기지는 않는다. 사용자가 평소 브랜치에서 에이전트에게 코드를 쓰게 하고 직접 PR을 열면, 밖에서는 사람이 쓴 PR과 구별할 수 없다.
- 내가 센 것은 '그 달에 병합된 PR'이고, GitHub이 센 것은 '에이전트 초안에서 시작한 PR'이다. 열린 뒤 병합되지 않은 PR은 내 숫자에 빠진다.

그래서 이 결과로 40%가 틀렸다고 할 수는 없다. 밖에서 확인되는 하한이 13.5%이고, 1년 새 거의 두 배가 됐다는 데까지가 확인한 범위다. 병합률 90% 같은 숫자는 PR마다 열고 닫은 시간을 받아야 해서 이번에는 확인하지 못했다.

### Stack Overflow는 한 달 964개

![[IT 트렌드/첨부/에이전트 PR/result-so-questions.png]]
*Stack Exchange API로 센 Stack Overflow 월 질문 수(지금 남아 있는 질문 기준). 직접 센 숫자로 그렸다.*

같은 주 Hacker News에서는 "Stack Overflow 질문이 한 달 1,000개 아래로 떨어졌다"는 글이 859점을 받았다. Stack Exchange API로 세어 보니 2026년 9월 964개, 10월 973개였다. ChatGPT가 나온 2022년 11월은 10만 9,119개, 질문이 가장 많던 무렵인 2014년 3월은 20만 7,169개였다. 이 숫자는 삭제된 질문을 빼고 지금 남아 있는 질문만 센 것이라, 당시 실제로 올라온 수보다 적다.

## 5. 아쉬운 점과 확인할 점

- 공개 저장소만 셀 수 있다. 비공개 저장소의 비율은 GitHub만 안다.
- 브랜치 이름은 사람이 `codex/`처럼 지어도 잡힌다. 표본 12개는 모두 에이전트가 만든 이름 모양이었지만 전수 확인은 아니다.
- 검색 API의 `total_count`는 GitHub이 계산해 주는 값이다. 결과가 덜 계산됐다는 표시(`incomplete_results`)는 모든 검색에서 없었다.
- Gemini Code Assist, Amazon Q처럼 이번에 넣지 않은 에이전트도 있다. 이름 규칙을 확인한 신호만 넣었다.
- Stack Overflow 숫자는 삭제된 질문을 빼서 과거 쪽이 낮게 나온다. 줄어드는 흐름은 그대로다.

> [!note] 뉴리의 생각
> 1. 공개 저장소만 봐도 1년 새 에이전트 PR 비율이 두 배 가까이 됐다. 2027년 9월에 같은 방법으로 다시 세어 20%를 넘으면, 공개 오픈소스에서도 에이전트가 PR 다섯 개 중 하나를 쓰는 셈이 된다. 10% 아래로 떨어지면 지금 늘어난 몫은 잠깐 몰린 실험이었다고 보겠다.
> 2. 에이전트 PR을 셀 수 있는 공개 표준이 필요하다. 지금은 브랜치 이름 관례에 기대어 셀 수밖에 없고, 회사마다 표시 방식이 달라 비교가 어렵다. GitHub이 감지 방법을 공개하거나 PR에 에이전트 표시 필드를 두면 이 차이는 줄어든다.

## 용어 정리

| 용어 | 뜻 |
|---|---|
| PR(Pull Request) | 바꾼 코드를 저장소에 합쳐 달라는 요청. 리뷰를 거쳐 병합된다 |
| 코딩 에이전트 | 지시를 받아 코드를 쓰고 PR까지 여는 AI. Copilot 코딩 에이전트, Claude Code, Codex, Cursor, Devin 등 |
| 브랜치 접두어 | 브랜치 이름 앞부분. 에이전트는 `claude/`처럼 정해진 앞부분을 붙이곤 한다 |
| 의존성 봇 | 라이브러리 버전을 올리는 PR을 자동으로 여는 봇. Dependabot, Renovate |
| 2차 속도 제한 | 짧은 시간에 무거운 요청을 몰아 보내면 GitHub이 거는 추가 제한 |
| Octoverse | GitHub이 해마다 내는 플랫폼 통계 보고서 |

## 함께 보면 좋은 글

- [[내 코딩 도구 점검 확장과 플러그인|내 코딩 도구 점검]]: 같은 시기 코딩 도구와 에이전트 확장에서 생긴 사고
- [[Claude Code 스킬 직접 만들기|Claude Code 스킬 직접 만들기]]: 에이전트에게 일을 맡기는 방법을 직접 해 본 글
- [[주간 별점표 2026년 11월 1주|2026년 11월 1주 IT 트렌드]]: 같은 시기 소식

## 출처

- [GitHub Octoverse 2026 (2026-10-28, 11-06 수정)](https://github.blog/news-insights/octoverse/octoverse-commits-pushes-reach-new-highs-in-2026-as-developers-build-with-agents/)
- [GitHub 검색 문서: PR 검색 조건](https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests)
- [Stack Exchange API: questions](https://api.stackexchange.com/docs/questions)
- [Hacker News: StackOverflow now gets fewer than 1000 questions a month (2026-10-28)](https://news.ycombinator.com/item?id=50282454), [Stack Exchange Data Explorer 원 쿼리](https://data.stackexchange.com/stackoverflow/query/1926661)
- [Simon Willison: GitHub Octoverse 2026](https://simonwillison.net/2026/Oct/28/github-octoverse-2026/)
- 측정: 2026-11-08 직접 실행한 스크립트와 결과 파일(첨부 폴더). 표본 PR은 저장소와 제목을 지우고 브랜치 접두어만 남겼다. 그림은 직접 센 숫자로 그렸다.
