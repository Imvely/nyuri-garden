---
type: trend
source: https://claude.com/resources/articles/message-threads
topic: Message Threads
date: 2026-11-02
created: 2026-11-07
publish: true
tags: [IT트렌드, AI에이전트, Claude, 써본기록]
summary: Claude API에 생긴 Message Threads 베타를 공식 문서로 정리하고, API 키 없이 가짜 서버로 SDK 요청을 가로채 요청 크기와 재전송 동작을 확인한 기록이에요.
title: "Message Threads: 대화를 서버가 잠깐 기억하는 Claude API, 요청은 얼마나 줄어드나"
---
> [!abstract] 한 줄 요약
> Anthropic이 11월 2일 Messages API에 `thread` 매개변수를 베타로 붙였다. 첫 요청에 대화 전체를 보내면 다음부터는 새 메시지와 직전 응답 id만 보내면 된다. API 키 없이 가짜 서버로 공식 SDK의 요청을 가로채 보니, 30턴 대화의 요청 본문 합계가 매번 전체를 보낼 때의 약 9%였다. 모델이 읽는 토큰과 가격은 그대로이고, 회사가 밝힌 첫 토큰 35% 단축은 재 보지 못했다.

![[IT 트렌드/첨부/Message Threads/Message Threads 마인드맵.webp]]

> [!tip] 마인드맵 크게 보기
> <a href="https://imvely.github.io/nyuri-garden/static/viewer.html?src=it-%ED%8A%B8%EB%A0%8C%EB%93%9C/%EC%B2%A8%EB%B6%80/message-threads/message-threads-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.svg&fallback=it-%ED%8A%B8%EB%A0%8C%EB%93%9C/%EC%B2%A8%EB%B6%80/message-threads/message-threads-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.png&back=it-%ED%8A%B8%EB%A0%8C%EB%93%9C/message-threads-%EB%8C%80%ED%99%94%EB%A5%BC-%EA%B8%B0%EC%96%B5%ED%95%98%EB%8A%94-api&title=Message%20Threads%20%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5" target="_blank" rel="noopener" data-router-ignore>크게 열어 보기</a>
*무엇인지, 회사가 밝힌 것, 지켜야 할 규칙, 가짜 서버로 본 것, 만료와 보관, 아직 못 한 것을 모은 마인드맵.*

| 항목 | 내용 |
|---|---|
| 무엇 | Messages API가 대화를 서버에 잠깐 들고 있게 하는 `thread` 매개변수 |
| 누가 | Anthropic |
| 언제 | 2026년 11월 2일 공개 베타 |
| 어디서 | Claude API, Claude Platform on AWS, Google Cloud(Anthropic 운영), Microsoft Foundry |
| 베타 헤더 | `message-threads-2026-08-12` |
| 가격 | 바뀌지 않는다. 토큰 요금과 속도 제한이 그대로 적용된다 |

## 1. 무엇인가

![[IT 트렌드/첨부/Message Threads/concept-thread-flow.png]]
*개념도. 공식 문서의 만들기, 이어 보내기, 다시 만들기 흐름을 직접 그렸다.*

지금까지 Messages API는 대화를 기억하지 않았다. 에이전트가 30번째 턴을 보낼 때도 시스템 프롬프트, 도구 정의, 앞선 29턴을 전부 다시 올려야 했다. 서버는 그때마다 전체를 다시 검사하고 토큰으로 나눴다.

스레드를 쓰면 첫 요청에 `"thread": {"type": "create"}` 를 붙여 대화 전체를 보낸다. 서버는 Claude의 답까지 포함한 대화를 응답 id 아래 저장한다. 다음 요청에는 새 메시지와 `"thread": {"type": "continue", "previous_message_id": "<직전 id>"}` 만 보낸다. 시스템 프롬프트와 도구는 빼야 하고, 넣으면 400 오류가 난다.

Claude Managed Agents의 세션 스레드와는 다른 기능이다.

## 2. 왜 눈여겨보나

Anthropic은 Claude Code 사용자 대부분에게 이 기능을 기본으로 켠 뒤, 50만~100만 토큰 요청에서 첫 토큰까지 걸리는 시간의 중앙값이 약 35% 줄었다고 밝혔다. 측정 방법이나 표본 수는 발표에 없다.

줄어드는 것은 요청을 올리고 검사하는 시간이다. 모델은 매 턴 대화 전체를 그대로 읽으므로 토큰 사용량은 같다. 회사도 맥락이 길수록 효과가 크다고 했고, 오래 도는 코딩 에이전트, 컴퓨터 사용 에이전트, 문서와 이미지가 많은 작업을 꼽았다.

## 3. 어떻게 동작하나

요청 필드는 세 무리로 나뉜다.

| 무리 | 필드 | 규칙 |
|---|---|---|
| 첫 요청에만 | `system`, `tools` | 이어 보내기 요청에 넣으면 `null` 이어도 400 오류 |
| 매번 같은 값 | `model`, `tool_choice`, `thinking`, `mcp_servers`, `context_management`, `output_config`, 맨 위 `cache_control`, 베타 헤더 묶음 등 | 값이 달라지면 `thread_fingerprint_mismatch` 오류 |
| 자유 | `max_tokens`, `stop_sequences`, `stream`, `metadata` 등 | 턴마다 바꿔도 된다 |

스레드는 마지막 요청 5분 뒤 만료되고, 서버는 마지막 사용 뒤 1시간 안에 지운다. 만료됐거나 저장되지 않은 턴을 이어 보내면 404(`thread_not_found`)가 온다. 이유는 알려 주지 않는다. 이때는 내 쪽 사본으로 대화 전체를 새 create 요청에 다시 보낸다. 어떤 응답도 그 턴이 저장됐는지 알려 주지 않으므로, 문서는 대화의 원본을 늘 애플리케이션 쪽에 두라고 한다.

몇 가지 규칙이 더 있다.

- 응답 id 하나는 한 번만 이어 쓸 수 있다. 앞 턴을 고치거나 갈라 쓰려면 새 스레드를 만든다.
- 스레드가 프롬프트 캐싱을 대신하지 않는다. 맨 위 `cache_control` 을 매번 보내야 턴마다 캐시가 쌓인다. 캐시 지점은 요청당 4개까지다.
- 스트리밍은 `message_stop` 을 받은 뒤에 이어 보내야 한다. 그 전에 보내면 404가 날 수 있다.
- 거절(`refusal`) 응답 뒤에는 스레드를 잇지 말고 새로 만든다.
- 메시지 배치, 토큰 세기, 대화 압축, 대부분의 컨텍스트 편집과 함께 쓸 수 없다. 스레드를 목록으로 보거나 지우는 API도 없다.
- 대화는 서버 키로 암호화해 메모리에만 두고 디스크에 쓰지 않는다. 그래도 ZDR(데이터 무보존) 대상은 아니다.

## 4. 써 본 기록: 키 없이 가짜 서버로 SDK 요청을 가로챘다

이 블로그는 유료 API 키를 쓰지 않는다. 그래서 실제 첫 토큰 시간은 재지 못했다. 대신 2026년 11월 7일, 공식 Python SDK(anthropic 2.6.0)의 스레드 도우미를 가짜 서버에 연결해, SDK가 실제로 무엇을 보내는지 확인했다. 요청은 내 컴퓨터 밖으로 나가지 않았고 비용도 들지 않았다.

조건은 이렇게 잡았다. 시스템 프롬프트 2,000자, 턴마다 들어오는 도구 결과 6,000자, 모델 답 600자로 30턴을 보냈다. 15턴에서는 가짜 서버가 한 번 404(`thread_not_found`)를 돌려주게 했다. 비교로 같은 대화를 스레드 없이 매번 전체를 보내는 방식으로도 보냈다.

```python
th = client.beta.messages.thread(model="claude-opus-5-5", max_tokens=1024,
                                 system=SYSTEM, cache_control={"type": "ephemeral"})
th.send({"role": "user", "content": TOOL_RESULT})   # 턴마다 새 메시지만 넘긴다
```

![[IT 트렌드/첨부/Message Threads/result-request-size.png]]
*직접 측정한 그래프. 가짜 서버가 받은 턴별 요청 본문 크기. 실제 API는 부르지 않았다.*

| 확인한 것 | 결과 |
|---|---|
| 첫 요청 | `thread: create`, 시스템 프롬프트 포함, 24KB |
| 이어 보내기 요청 | `thread: continue`, 메시지 1개, 시스템 프롬프트 없음. 30턴까지 18KB로 일정 |
| 베타 헤더 | 도우미가 모든 요청에 알아서 붙였다 |
| 15턴의 404 | 도우미가 곧바로 메시지 29개 전체를 create 요청으로 다시 보냈다(303KB). 스레드 없이 보낸 같은 턴(302KB)과 거의 같다 |
| 30턴 합계 | 스레드 854KB, 매번 전체 9,363KB. 약 9% |

스레드 없이 보내면 요청이 턴마다 20KB씩 커져 30턴에는 600KB가 된다. 스레드는 404가 난 한 턴만 빼고 크기가 일정했다. 만료가 잦으면 그만큼 전체 재전송이 끼어든다는 것도 그래프에서 보인다.

## 5. 아쉬운 점과 확인할 점

- 회사가 밝힌 35%는 Claude Code 사용자 기준이고 측정 방법이 공개되지 않았다. 이 글도 재현하지 못했다. 요청 본문이 줄어드는 것은 확인했지만, 그만큼 첫 토큰이 빨라지는지는 실제 API로 재야 안다.
- 5분 만료는 사람이 중간에 오래 생각하는 작업이나 긴 도구 실행이 끼는 에이전트에서 자주 걸릴 수 있다. 만료되면 전체를 다시 보내므로, 그 턴은 스레드가 없을 때와 같다.
- 토큰 요금은 줄지 않는다. 비용을 줄이려면 프롬프트 캐싱을 따로 챙겨야 한다.
- 대화 압축과 함께 쓸 수 없어서, 아주 긴 대화는 내 코드에서 요약을 만든 뒤 새 스레드로 옮겨야 한다.
- 가짜 서버 실험은 SDK가 보내는 요청만 본 것이다. 서버가 실제로 언제 스레드를 저장하지 않는지는 확인할 수 없다.

> [!note] 뉴리의 생각
> 1. 상태 없는 API라는 전제가 처음 느슨해졌다. 그래도 문서가 원본은 내 쪽에 두라고 거듭 말하는 걸 보면, 이 기능은 기억 장치라기보다 업로드를 줄이는 캐시에 가깝다.
> 2. 이득은 대화가 길고 턴 사이가 짧은 에이전트 루프에 몰린다. 사람과 천천히 주고받는 챗봇은 5분 만료 때문에 효과가 작을 것이다.

## 용어 정리

| 용어 | 뜻 |
|---|---|
| 첫 토큰 시간(TTFT) | 요청을 보낸 뒤 첫 글자가 돌아오기까지 걸린 시간 |
| 상태 없는 API | 서버가 앞선 요청을 기억하지 않아 매번 필요한 내용을 다 보내야 하는 API |
| 프롬프트 캐싱 | 앞서 처리한 프롬프트 앞부분을 저장해 두고 다음 요청에서 다시 쓰는 기능 |
| 베타 헤더 | 정식 출시 전 기능을 쓰겠다고 요청에 붙이는 표시 |
| ZDR | 데이터 무보존. 요청 내용을 서버에 남기지 않는 약정 |
| 가짜 서버(목 서버) | 실제 서버 대신 정해 둔 응답을 돌려주는 시험용 서버 |

## 함께 보면 좋은 글

- [[주간 별점표 2026년 11월 1주|2026년 11월 1주 IT 트렌드]]: Message Threads가 나온 주의 소식
- [[Claude Code 스킬 직접 만들기|Claude Code 스킬 직접 만들기]]: 이 블로그가 Claude Code를 쓰는 방식

## 출처

- [Claude 블로그: Message threads](https://claude.com/resources/articles/message-threads)
- [Claude 문서: Message threads](https://platform.claude.com/docs/en/build-with-claude/message-threads)
- [Claude Platform 릴리스 노트](https://platform.claude.com/docs/en/release-notes/overview)
- 측정: 2026-11-07 직접 실행한 가짜 서버 스크립트와 결과 파일(anthropic Python SDK 2.6.0). 그림은 문서 설명과 측정 결과로 직접 그렸다.
