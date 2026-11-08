---
type: trend
source: https://huggingface.co/LiquidAI/LFM3-1.7B
topic: LFM3-1.7B
date: 2026-10-27
created: 2026-11-08
publish: true
tags: [IT트렌드, 오픈모델, 써본기록]
summary: LFM3-1.7B와 작은 오픈 모델 4종을 GPU 없는 4코어 노트북에서 llama.cpp로 돌려 속도와 메모리를 잰 표예요. 회사가 GPU로 잰 '1.8배 이상 빠르다'가 CPU에서는 얼마로 나오는지도 확인했어요.
title: "LFM3-1.7B CPU 실측: GPU 없는 노트북에서 오픈 모델 5종 속도와 메모리를 쟀다"
---
> [!abstract] 한 줄 요약
> Liquid AI가 2026년 10월 27일 공개한 LFM3-1.7B는 그래픽카드 없는 4코어 노트북에서도 비교한 5개 모델 가운데 가장 빨랐다. 글 생성은 초당 30.3토큰으로 다음 모델(MiniCPM5-2B, 22.5)의 1.35배였고, 회사가 GPU로 잰 1.8배 이상에는 못 미쳤다. 메모리는 8K 문맥에서 2.24GB로 가장 적게 썼다.

![[IT 트렌드/첨부/오픈 모델 실측/오픈 모델 실측 마인드맵.webp]]

> [!tip] 마인드맵 크게 보기
> <a href="https://imvely.github.io/nyuri-garden/static/viewer.html?src=it-%ED%8A%B8%EB%A0%8C%EB%93%9C/%EC%B2%A8%EB%B6%80/%EC%98%A4%ED%94%88-%EB%AA%A8%EB%8D%B8-%EC%8B%A4%EC%B8%A1/%EC%98%A4%ED%94%88-%EB%AA%A8%EB%8D%B8-%EC%8B%A4%EC%B8%A1-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.svg&fallback=it-%ED%8A%B8%EB%A0%8C%EB%93%9C/%EC%B2%A8%EB%B6%80/%EC%98%A4%ED%94%88-%EB%AA%A8%EB%8D%B8-%EC%8B%A4%EC%B8%A1/%EC%98%A4%ED%94%88-%EB%AA%A8%EB%8D%B8-%EC%8B%A4%EC%B8%A1-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.png&back=it-%ED%8A%B8%EB%A0%8C%EB%93%9C/gpu-%EC%97%86%EB%8A%94-%EB%85%B8%ED%8A%B8%EB%B6%81-%EC%98%A4%ED%94%88-%EB%AA%A8%EB%8D%B8-%EC%8B%A4%EC%B8%A1&title=%EC%98%A4%ED%94%88%20%EB%AA%A8%EB%8D%B8%20%EC%8B%A4%EC%B8%A1%20%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5" target="_blank" rel="noopener" data-router-ignore>크게 열어 보기</a>
*LFM3가 무엇인지, 회사 주장과 CPU 측정 결과, 남은 질문을 한 장에 모은 마인드맵.*

## 한눈에 보기

| 모델 | 파일 크기(Q4_0) | 글 생성(초당 토큰) | 프롬프트 처리(초당 토큰) | 최대 메모리(8K 문맥) | 라이선스 |
|---|---|---|---|---|---|
| LFM3-1.7B | 1.04GB | 30.3 | 123.4 | 2.24GB | LFM Open License v1.0 |
| MiniCPM5-2B | 1.51GB | 22.5 | 83.0 | 3.26GB | Apache 2.0 |
| Gemma 4 E4B | 5.14GB | 10.8 | 72.6 | 5.73GB | Apache 2.0 |
| Qwen3.5-4B | 2.57GB | 10.7 | 43.6 | 5.25GB | Apache 2.0 |
| Qwen3.5-9B | 5.37GB | 5.7 | 22.0 | 9.06GB | Apache 2.0 |

측정: 2026년 11월 8일, Intel Core i7-1195G7(4코어), 메모리 15.7GB, 그래픽카드 없음, llama.cpp b12185 CPU판 4스레드. 속도는 노트북이 식은 상태에서 모델을 번갈아 두 번씩 잰 평균이다.

## 1. 무엇인가

LFM3-1.7B는 Liquid AI가 2026년 10월 27일 공개한 17억 파라미터 언어 모델이다. 회사는 휴대폰이나 노트북에서 도는 에이전트용 모델이라고 소개했고, 4비트로 줄이면 약 1GB라고 밝혔다. 문맥은 256K 토큰까지 받고, 지원 언어 16개에 한국어가 들어 있다.

![[IT 트렌드/첨부/오픈 모델 실측/concept-lfm3-layers.png]]
*LFM3-1.7B 모델 설정 파일(config.json)의 층 순서를 그대로 옮겨 그린 개념도.*

구조가 남다르다. 24개 층 가운데 13개는 바로 앞 7토큰만 보는 짧은 합성곱 층이고, 5개는 앞 256토큰만 기억하는 슬라이딩 어텐션 층이다. 문맥 전체를 기억하는 전체 어텐션 층은 6개뿐이다. 긴 대화를 기억하는 데 드는 메모리(KV 캐시)는 이 6개 층에서만 쌓인다. 설정 파일 값으로 계산하면 128K 문맥의 KV 캐시는 1.61GB이고, 회사가 밝힌 1.6GB와 같다. 회사 블로그는 같은 조건에서 Qwen3.5-4B가 4.3GB, MiniCPM5-2B가 5.6GB를 쓴다고 적었다.

## 2. 왜 눈여겨보나

LFM3 모델 카드는 "32K 문맥에서 비교한 모든 모델보다 세 기기 모두에서 프롬프트 처리는 2.5배 이상, 글 생성은 1.8배 이상 빠르다"고 적었다. 그런데 세 기기는 AMD Ryzen AI Max+ 395(내장 GPU, Vulkan), Apple M5 Max(Metal), iPhone 17 Pro이고, 모두 GPU에 모델을 올린 측정이다. 그래픽카드 없이 CPU만 있는 노트북에서도 그 차이가 나는지는 카드에 없다.

질문은 실제로 있다. 2026년 10월 27일 Hacker News에 올라온 "Survival LLM"(인터넷 없이 내 컴퓨터에서 도는 AI 비서) 글은 546점을 받았지만, 글감을 조사할 때 토론에서 CPU만 쓴 속도 숫자는 찾지 못했다. 그래서 회사가 비교한 4개 모델(MiniCPM5-2B, Qwen3.5-4B, Qwen3.5-9B, Gemma 4 E4B)을 같은 노트북에서 같은 조건으로 돌렸다.

## 3. 어떻게 쟀나

1. 모델 파일은 모두 Q4_0 GGUF로 맞췄다. LFM3는 Liquid 공식 저장소의 QAD-Q4_0, Gemma 4 E4B는 Google 공식 QAT Q4_0, Qwen3.5는 unsloth, MiniCPM5-2B는 bartowski가 변환한 파일이다.
2. llama.cpp의 `llama-bench`로 프롬프트 512토큰 처리(pp512)와 100토큰 생성(tg100) 속도를 쟀다. 스레드는 물리 코어 수와 같은 4개다.
3. 노트북은 오래 돌리면 뜨거워져 느려진다. 그래서 모델 사이에 90초씩 쉬면서 번갈아 두 번 쟀고, 두 번째에는 순서를 뒤집었다. 두 번의 차이는 3% 안이었다(`roundrobin.py`).
4. 앞에 8,192토큰을 채운 긴 문맥 측정과 최대 메모리는 따로 한 번씩 쟀다(`bench.py`). 메모리는 프로세스의 작업 집합을 0.2초마다 재서 가장 큰 값이다.
5. 모델마다 한국어 질문 3개(셈, 요약, JSON 뽑기)를 생각 모드를 끄고 같은 조건으로 물었다(`korean_check.py`).

## 4. 써 본 기록

### CPU에서도 가장 빠르지만, 차이는 1.35배

![[IT 트렌드/첨부/오픈 모델 실측/result-cpu-speed.png]]
*식은 상태에서 번갈아 두 번 잰 글 생성 속도 평균과 8K 문맥에서 잰 최대 메모리. 직접 측정한 값으로 그렸다.*

LFM3-1.7B는 글 생성 초당 30.3토큰, 프롬프트 처리 초당 123.4토큰으로 다섯 모델 가운데 가장 빨랐다. 다음으로 빠른 MiniCPM5-2B(22.5, 83.0)와 비교하면 글 생성은 1.35배, 프롬프트 처리는 1.49배다. 회사가 GPU로 잰 1.8배와 2.5배보다 작다. 다만 회사는 32K 문맥에서 쟀고 이 표는 짧은 문맥이라, 조건이 완전히 같지는 않다.

크기가 비슷한 두 모델은 결과가 엇갈렸다. 파일이 5GB인 Gemma 4 E4B는 2.6GB인 Qwen3.5-4B와 글 생성 속도(10.8, 10.7)가 거의 같았고, 프롬프트 처리는 1.7배 빨랐다. Qwen3.5-9B는 초당 5.7토큰으로, 한국어 한 문장(약 60토큰)을 쓰는 데 10초쯤 걸린다.

### 긴 문맥에서 차이가 벌어진다

앞에 8,192토큰을 채우면 모델마다 느려지는 정도가 달랐다. 이 측정은 노트북이 뜨거워진 상태에서 한 번만 했다. 절대값보다 같은 측정 안에서 줄어든 비율을 보면 된다.

| 모델 | 짧은 문맥 글 생성 | 8K 문맥 글 생성 | 줄어든 비율 |
|---|---|---|---|
| LFM3-1.7B | 16.0 | 13.2 | 18% |
| MiniCPM5-2B | 12.1 | 5.4 | 56% |
| Gemma 4 E4B | 9.5 | 4.1 | 56% |
| Qwen3.5-4B | 5.7 | 4.8 | 16% |
| Qwen3.5-9B | 2.8 | 3.3 | 줄지 않음 |

문맥 전체를 보는 층이 6개뿐인 LFM3와, 선형 어텐션을 섞은 Qwen3.5는 긴 문맥에서 덜 느려졌다. MiniCPM5와 Gemma 4는 절반 아래로 떨어졌다. 같은 표에서 LFM3의 짧은 문맥 값(16.0)은 식은 상태에서 잰 30.3의 절반쯤이다. 노트북에서 오래 돌릴 일이라면 식은 상태에서 잰 속도의 절반쯤을 기준으로 잡아 두면 된다.

### 메모리는 문맥 길이까지 같이 봐야 한다

최대 메모리는 LFM3가 2.24GB로 가장 적었고, Qwen3.5-9B가 9.06GB로 가장 많았다. 메모리 15.7GB 노트북에서 브라우저와 편집기를 함께 켜 두려면 5GB 안쪽 모델이 현실적이다. 회사가 AMD 기기에서 32K 문맥으로 잰 값(LFM3 2.75GB, MiniCPM5-2B 3.84GB, Qwen3.5-4B 6.00GB, Qwen3.5-9B 8.41GB, Gemma 4 E4B 9.52GB)과 순서는 대체로 같았다.

### 한국어 질문 세 개

| 질문 | 결과 |
|---|---|
| 셈: 사과 1,200원 10개와 배 3,000원 10개를 사고 만 원 상품권을 쓰면? (정답 32,000원) | 다섯 모델 모두 틀렸다. LFM3는 41,000원(만 원을 1,000원으로 읽음), MiniCPM5는 42,000원(상품권을 빼먹음), Qwen3.5-4B와 Gemma 4는 1000, Qwen3.5-9B는 12000이라고 답했다 |
| 요약: 두 문장을 한 문장으로 | 다섯 모델 모두 발표와 비판을 한 문장에 담았다. Gemma 4만 날짜를 뺐다 |
| JSON 뽑기: 이름, 날짜, 장소 | 다섯 모델 모두 값을 맞혔다. Gemma 4와 Qwen3.5-9B는 "다른 말은 쓰지 마"라고 했는데도 코드 블록 표시를 붙였다 |

셈 문제는 생각 모드를 끄고 "숫자만 답해"라고 시킨 조건이라 모델에게 불리했다. 그래도 작은 모델에 계산을 맡기려면 생각 모드를 켜거나 계산기 도구를 붙여야 한다. LFM3 모델 카드도 크기가 작아 복잡한 여러 단계 추론에는 권하지 않는다고 적었다.

## 5. 아쉬운 점과 확인할 점

- 모델 파일을 만든 곳이 다르다. LFM3는 정확도 손실을 줄이도록 학습한 QAD 판이고, Gemma 4도 QAT 판이다. 나머지는 일반 Q4_0 변환이다. 속도에는 영향이 작지만 답의 질은 달라질 수 있다.
- 회사는 32K 문맥에서, 이 글은 512토큰과 8K 문맥에서 쟀다. 32K는 CPU에서 한 모델에 수십 분이 걸려 재지 않았다.
- 한국어 질문은 3개뿐이고 한 번씩만 물었다. 모델 품질을 가르는 평가가 아니라 "말이 되나"를 본 정도다.
- LFM3의 라이선스는 Apache 2.0이 아니다. LFM Open License v1.0은 연 매출 1천만 달러 이상인 회사의 상업적 사용을 허락하지 않는다. 개인이나 작은 회사는 쓸 수 있다.

> [!note] 뉴리의 생각
> 1. GPU 없는 노트북에서 오프라인 비서를 돌린다면 지금은 LFM3-1.7B나 MiniCPM5-2B 급이 현실적인 크기다. 초당 20~30토큰이면 한 문장 답이 2~3초 안에 나온다. 4B를 넘는 모델은 초당 10토큰 안팎이라 같은 답에 6초 넘게 걸린다.
> 2. 회사가 GPU로 잰 배수는 CPU에서 그대로 나오지 않는다. 앞으로 "몇 배 빠르다"는 발표를 보면 어떤 기기에서 GPU를 썼는지부터 확인할 생각이다. CPU 판 llama.cpp에서 LFM3용 최적화가 들어가 차이가 1.8배 가까이 벌어지면 이 판단을 바꾼다.

## 용어 정리

| 용어 | 뜻 |
|---|---|
| GGUF | llama.cpp가 읽는 모델 파일 형식. 줄인(양자화한) 가중치를 한 파일에 담는다 |
| Q4_0 | 가중치 하나를 4비트 정도로 줄이는 양자화 방식. 파일이 원래의 4분의 1쯤으로 준다 |
| 프롬프트 처리(prefill) | 입력 글을 한꺼번에 읽는 단계. 초당 토큰으로 잰다 |
| 글 생성(decode) | 답을 한 토큰씩 쓰는 단계. 체감 속도는 주로 이쪽이 정한다 |
| KV 캐시 | 앞에서 읽은 토큰을 다시 계산하지 않으려고 모아 두는 메모리 |
| 슬라이딩 어텐션 | 정해진 길이(LFM3는 256토큰)만큼만 뒤를 돌아보는 어텐션 |
| 열 제한(스로틀링) | 칩이 뜨거워지면 스스로 속도를 낮추는 것 |

## 함께 보면 좋은 글

- [[Kanana-2-v-decide 판단 전용 모델|Kanana-2-v-decide를 CPU로 돌려 본 기록]]: 같은 노트북에서 3.67B 판단 모델을 돌린 글
- [[가중치 프로그래밍 반박 재현|가중치 공간 프로그래밍 실측]]: 같은 노트북에서 Qwen3.5-0.8B를 돌린 글

## 출처

- [LFM3-1.7B 모델 카드](https://huggingface.co/LiquidAI/LFM3-1.7B), [LFM3-1.7B-GGUF](https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF), [LFM Open License v1.0](https://huggingface.co/LiquidAI/LFM3-1.7B/blob/main/LICENSE)
- [Liquid AI 블로그: LFM3 (2026-10-27)](https://www.liquid.ai/blog/lfm3)
- [MiniCPM5-2B](https://huggingface.co/openbmb/MiniCPM5-2B), [bartowski/MiniCPM5-2B-GGUF](https://huggingface.co/bartowski/MiniCPM5-2B-GGUF)
- [Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B), [Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B), [unsloth GGUF](https://huggingface.co/unsloth/Qwen3.5-4B-GGUF)
- [Gemma 4 E4B](https://huggingface.co/google/gemma-4-E4B-it), [google/gemma-4-E4B-it-qat-q4_0-gguf](https://huggingface.co/google/gemma-4-E4B-it-qat-q4_0-gguf)
- [llama.cpp 릴리스 b12185](https://github.com/ggml-org/llama.cpp/releases/tag/b12185)
- [Hacker News: Survival LLM](https://news.ycombinator.com/item?id=50264853), [Hacker News: LFM3](https://news.ycombinator.com/item?id=50262229)
- 측정: 2026-11-08 직접 실행한 스크립트와 결과 파일(첨부 폴더). 그림은 모델 설정 파일과 측정 결과로 직접 그렸다.
