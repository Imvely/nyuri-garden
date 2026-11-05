---
title: "Interpretable Face Anti-Spoofing: Enhancing Generalization with Multimodal Large Language Models"
arxiv: "2501.01720"
url: https://arxiv.org/abs/2501.01720
authors:
  - Guosheng Zhang
  - Keyao Wang
  - Haixiao Yue
  - Ajian Liu
  - Gang Zhang
  - Kun Yao
  - Errui Ding
  - Jingdong Wang
affiliation: Baidu VIS, CASIA
venue: AAAI 2025 (Oral)
published: 2025-01-03
tags:
  - 논문
  - FAS
  - MLLM
  - 컴퓨터비전
created: 2026-11-05
status: 정리완료
publish: true
share_link: https://share.note.sx/gy6tgnhu
share_updated: 2026-11-05T18:08:47+09:00
---

# I-FAS: 해석 가능한 얼굴 위조 방지

> [!abstract] 한 줄 요약
> 얼굴 위조 방지(FAS)를 "진짜/가짜" 이진 분류가 아니라 **멀티모달 LLM이 답하는 VQA 문제**로 바꿨다. 모델이 "No, 이건 화면을 다시 찍은 사진이다"처럼 **판단 + 이유**를 함께 말하게 만들었더니, 한 번도 본 적 없는 환경·공격 유형에서도 훨씬 잘 버틴다.

![[첨부/I-FAS/I-FAS 마인드맵.png]]

## 1. 문제의식

- 기존 FAS는 대부분 이진 분류기. 신뢰도 점수만 내고 **왜 그렇게 판단했는지 설명이 없다**.
- 학습 때 못 본 환경이나 공격(인쇄물, 화면 재생, 3D 마스크 등)에서 **도메인 밖 일반화가 약하다**.
- 도메인 적응(DA)은 타깃 데이터가 필요하고, 도메인 일반화(DG)는 라벨만으로 불변 특징을 배우기 어렵다.
- CLIP류 멀티모달 접근도 있지만 **사람이 손으로 만든 텍스트 템플릿**에 의존해서 다양성과 정보량이 부족하다.

## 2. 핵심 아이디어

사람은 위조를 볼 때 무관한 요소는 무시하고 핵심 단서에 집중해서 **이유를 들어 판단**한다. 이 과정을 MLLM으로 흉내 낸다.

| 구성 | 내용 |
| --- | --- |
| 입력 질문 | `Is this photo of a real person?` (모든 샘플에 동일) |
| 출력 답변 | `[판단 Yes/No] + [This is <설명 캡션>]` |
| 시각 인코더 | CLIP ViT-L/14 (고정) |
| 언어 모델 | OPT-2.7B |
| 추론 | "Yes" 토큰 확률을 진짜일 확률로 사용 |

## 3. 세 가지 구성 요소

### 3.1 SCF: Spoof-aware Captioning and Filtering

기존 FAS 데이터셋은 라벨만 있고 설명이 없다. 그래서 **위조 단서를 설명하는 캡션을 자동으로 만든다**.

1. 공개 FAS 데이터셋 12개를 모아 약 220만 장(진짜 70만, 가짜 150만) 확보
2. 일반 캡셔너(BLIP-2 계열)로 가짜 이미지 캡션 생성
3. 위조 유형별 키워드 사전(`paper → print`, `screen → replay`, `mask`, `mannequin`)과 라벨이 일치하는 샘플만 남김
4. 남은 샘플로 캡셔너를 파인튜닝 → **스푸프 인식 캡셔너** 완성
5. 진짜 이미지는 일반 캡셔너, 가짜 이미지는 스푸프 인식 캡셔너로 최종 캡션 부여

> [!example] 캡션 차이
> 일반 캡셔너: "안경 쓴 남자가 웃고 있다"
> 스푸프 인식 캡셔너: "태블릿 **화면**에 표시된 남자 얼굴 사진" ← 위조 단서가 드러남

### 3.2 GAC: Globally Aware Connector

시각 특징을 LLM 토큰 공간으로 넘기는 연결부. 모아레 패턴, 종이 특유의 흐림 같은 **저수준 전역 단서**를 놓치지 않도록 설계했다.

- ViT 각 층의 CLS 토큰을 모아 **다층 전역 특징**으로 사용 (얕은 층 = 저수준 디테일, 깊은 층 = 의미)
- 이 전역 쿼리와 학습 가능한 쿼리를 합쳐 Self-Attention → 로컬 패치 특징과 Cross-Attention → MLP
- 결과적으로 LLM이 거시적 맥락과 미시적 디테일을 함께 받는다

### 3.3 L-LM Loss: Lopsided Language Model Loss

자동 생성 캡션에는 노이즈가 있다. 그래서 **판단 부분과 해석 부분의 손실을 따로 계산**하고 판단에 가중치를 더 준다.

$$
\mathcal{L}_{total} = \alpha \mathcal{L}_{Judgment} + (1-\alpha)\mathcal{L}_{Interpretation}
$$

- α가 너무 크면 해석에서 오는 일반화 이득이 사라지고, 너무 작으면 캡션 노이즈가 학습을 방해
- 일반 LM 손실보다 수렴이 빠르고 안정적

## 4. 실험

### 프로토콜

| 프로토콜 | 설정 | 의미 |
| --- | --- | --- |
| Protocol 1 | MSU-MFSD, CASIA-FASD, Replay-Attack, OULU-NPU 중 3개로 학습, 1개로 평가 | 표준 cross-domain 벤치마크 |
| Protocol 2 (One to Eleven) | CelebA-Spoof 하나로만 학습, 나머지 11개 데이터셋으로 평가 | 이 논문이 새로 제안. 소스가 극단적으로 제한된 현실적 상황 |

지표는 HTER(낮을수록 좋음)과 AUC(높을수록 좋음). 결과는 시드 3개 평균.

### 결과

| 프로토콜 | 기존 최고 | I-FAS |
| --- | --- | --- |
| Protocol 1 평균 HTER | 약 2.98 ~ 3.01% (FLIP 등) | **1.33%** |
| Protocol 2 평균 HTER / AUC | FLIP 18.73% / 87.90% | **11.30% / 93.71%** |

- Protocol 2에서 SOTA 대비 7%p 이상 개선
- 소스에 없던 공격(3D 마스크, 메이크업, 신소재 마스크)이 있는 CASIA-SURF-3DMask, HKBU-MARs, SIW-M-V2에서도 일관되게 우위

### Ablation (Protocol 2 평균)

| 제거한 요소 | HTER 변화 | AUC 변화 |
| --- | --- | --- |
| SCF (캡션 → 단순 Yes/No) | +3.17%p | −3.30%p |
| GAC (전역 특징 → 학습 쿼리로 대체) | +3.54%p | −2.93%p |
| L-LM Loss (→ 일반 LM 손실) | 소폭 악화 | 소폭 악화 |

> [!note] 캡션이 그냥 다양해서 좋은 게 아니다
> 기존 FLIP에 스푸프 인식 캡션만 끼워 넣어도 HTER 1.43%p 개선. 반면 일반 캡셔너의 다양한 캡션을 넣으면 효과 없음. **위조 단서를 짚어주는 해석**이 핵심.

## 5. 의의와 한계

> [!success] 의의
> - FAS에 처음으로 MLLM 기반 해석 가능한 VQA 프레임워크 도입
> - 설명 텍스트가 단순 부가 기능이 아니라 **일반화 성능 자체를 끌어올리는 감독 신호**임을 보임
> - One to Eleven 벤치마크 제안

> [!warning] 생각해볼 점
> - ViT-L + OPT-2.7B 조합이라 기존 경량 FAS 모델보다 무겁다. 실시간 온디바이스 적용은 별도 고려 필요
> - 캡션 품질이 키워드 사전과 일반 캡셔너에 의존. 사전에 없는 새로운 공격 유형은 설명 품질이 떨어질 수 있음
> - 해석 텍스트의 정확성 자체를 정량 평가하지는 않음

## 논문 그림

| | |
| --- | --- |
| ![[첨부/I-FAS/fig2-overview.png]] 그림 2. 전체 구조 | ![[첨부/I-FAS/fig3-scf-captions.png]] 그림 3. 일반 캡션 vs 스푸프 인식 캡션 |
| ![[첨부/I-FAS/fig4-responses.png]] 그림 4. 모델 응답 예시 | ![[첨부/I-FAS/fig1-one-to-eleven.png]] 그림 1. One-to-Eleven 비교 |

## 관련

- 마인드맵: [[I-FAS 마인드맵.excalidraw]]
- 원문: https://arxiv.org/abs/2501.01720
- 키워드: #FAS #MLLM #VQA #도메인일반화
