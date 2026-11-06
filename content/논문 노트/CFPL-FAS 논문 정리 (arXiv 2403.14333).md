---
paper: "CFPL-FAS: Class Free Prompt Learning for Generalizable Face Anti-spoofing"
arxiv: "2403.14333"
url: https://arxiv.org/abs/2403.14333
authors:
  - Ajian Liu
  - Shuai Xue
  - Jianwen Gan
  - Jun Wan
  - Yanyan Liang
  - Jiankang Deng
  - Sergio Escalera
  - Zhen Lei
affiliation: MAIS, CASIA, China; BIT, Zhuhai; GC&UKLIS, Wuzhou University; M.U.S.T, Macau; SAI, UCAS, China; ICL, UK; CVC, Spain; CAIR, HKISI, CAS
venue: CVPR 2024
tags:
  - 논문
  - FAS
  - 도메인일반화
  - 비전언어모델
  - 컴퓨터비전
created: 2026-11-06
status: 정리완료
publish: true
summary: CLIP의 글 인코더로 이미지마다 다른 채널 가중치를 만들어, 클래스 이름 없이도 처음 보는 데이터셋에서 위조를 잘 가려낸 CVPR 2024 논문이에요.
title: "CFPL-FAS: 클래스 이름 없이 배우는 프롬프트"
---
> [!abstract] 한 줄 요약
> CLIP 위에 작은 트랜스포머 두 개(CQF, SQF)를 얹어 이미지의 내용과 스타일에서 프롬프트를 만든다. 이 프롬프트를 글 인코더에 통과시켜 얻은 값으로 이미지 특징의 채널을 키우거나 줄인 뒤 진짜와 위조를 가른다. OCIM 네 과제에서 평균 HTER 3.60%를 기록했다.

![[논문 노트/첨부/CFPL-FAS/CFPL-FAS 마인드맵.png]]

> [!tip] 마인드맵 크게 보기
> <a href="https://imvely.github.io/nyuri-garden/static/viewer.html?src=%EB%85%BC%EB%AC%B8-%EB%85%B8%ED%8A%B8/%EC%B2%A8%EB%B6%80/cfpl-fas/cfpl-fas-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.svg&fallback=%EB%85%BC%EB%AC%B8-%EB%85%B8%ED%8A%B8/%EC%B2%A8%EB%B6%80/cfpl-fas/cfpl-fas-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.png&back=%EB%85%BC%EB%AC%B8-%EB%85%B8%ED%8A%B8/cfpl-fas-%EB%85%BC%EB%AC%B8-%EC%A0%95%EB%A6%AC-%28arxiv-2403.14333%29&title=CFPL-FAS%20%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5" target="_blank" rel="noopener" data-router-ignore>크게 열어 보기</a>

## 서지 정보

| 항목 | 내용 |
| --- | --- |
| 제목 | CFPL-FAS: Class Free Prompt Learning for Generalizable Face Anti-spoofing |
| 저자 | Ajian Liu, Shuai Xue, Jianwen Gan, Jun Wan, Yanyan Liang, Jiankang Deng, Sergio Escalera, Zhen Lei |
| 소속 | MAIS, CASIA, China; BIT, Zhuhai; GC&UKLIS, Wuzhou University; M.U.S.T, Macau; SAI, UCAS, China; ICL, UK; CVC, Spain; CAIR, HKISI, CAS |
| 게재 | CVPR 2024 |
| 원문 | [arXiv 2403.14333](https://arxiv.org/abs/2403.14333) |

## 1. 어떤 문제를 푸나

얼굴 위조 방지(FAS)는 인쇄 사진, 화면 재생, 마스크 같은 공격을 걸러내는 일이다. 학습과 평가를 같은 데이터셋에서 하면 성능이 높다. 그런데 다른 데이터셋으로 가면 분포 차이 때문에 크게 떨어진다.

그래서 여러 소스 데이터셋으로 학습해 처음 보는 데이터셋에 대비하는 도메인 일반화(DG)가 연구되어 왔다. 저자들은 기존 DG 방법을 두 갈래로 나눈다. 하나는 도메인 라벨을 써서 적대 학습으로 데이터셋 차이가 없는 특징 공간을 맞추는 방법이다. 다른 하나는 샘플 단위로 생존 여부와 상관없는 특징을 떼어 내는 방법이다. 저자들은 두 방식 모두 특징의 의미 구조를 비틀어 일반화에 한계가 있다고 본다. 데이터셋이 크게 다르면 모든 도메인에 맞는 촘촘한 공간이 있다는 보장도 없다.

저자들이 보는 근본 원인은 생존 여부와 상관없는 신호가 분류기를 방해한다는 점이다. 그렇다면 샘플마다 분류기 가중치를 바꿔 방해 요인은 줄이고 일반화되는 특징은 키우면 된다. CLIP처럼 글과 이미지를 함께 배운 모델의 글 인코더를 쓰면, 이산적인 도메인 라벨보다 넓은 의미 공간에서 그런 가중치를 만들 수 있다.

걸림돌이 하나 있다. 일반 DG 과제에는 "만화", "스케치", "사진"처럼 도메인을 말로 설명할 수 있다. FAS 데이터셋은 MSU, CASIA, Idiap, OULU처럼 만든 기관 이름이 붙어 있을 뿐이라 프롬프트에 넣을 도메인 의미가 없다.

## 2. 핵심 아이디어

도메인 이름 대신 이미지 자체의 내용과 스타일에서 프롬프트를 만든다. 그리고 이 프롬프트를 진짜와 위조 클래스를 가르는 분류기 가중치로 쓰지 않는다. 이미지 특징의 채널마다 곱할 조정 계수로 쓴다. 이름의 "Class Free"가 이 뜻이다.

![[논문 노트/첨부/CFPL-FAS/concept-class-free.png]]
*원문 그림 1의 생각을 직접 다시 그린 개념도. 칸의 값은 설명용이다.*

선행 연구를 따라 저자들은 생존 여부와 상관없는 신호는 주로 샘플의 스타일에, 위조 단서는 내용에 들어 있다고 본다. 그래서 내용 프롬프트와 스타일 프롬프트를 따로 만들고 둘의 상관을 줄이는 쪽으로 학습한다.

## 3. 방법

![[논문 노트/첨부/CFPL-FAS/fig2-overview.jpg]]
*원문 그림 2. CFPL 전체 구조. CLIP의 이미지 인코더와 글 인코더 위에 CQF, SQF, PTM, DSP, PM을 붙였다. 출처: Liu et al., CVPR 2024*

CLIP의 이미지 인코더 $\mathcal{V}$ 와 글 인코더 $\mathcal{T}$ 를 바탕으로 장치 네 개를 더한다.

### 3.1 내용 특징과 스타일 특징

- 스타일 특징: AdaIN을 참고해 이미지 인코더 $l$ 번째 층의 평균 $\mu(\boldsymbol{v}^{l})$ 과 표준편차 $\sigma(\boldsymbol{v}^{l})$ 를 구해 이어 붙인 것이 그 층의 스타일 통계 $\boldsymbol{v}^{l}_{s}$ 다. 모든 층($L$ 개)의 스타일 통계를 평균하면 샘플의 스타일 특징 $\boldsymbol{v}_{s}$ 가 된다.
- 내용 특징: 이미지 인코더 마지막 층 출력을 평균과 표준편차로 정규화해 내용 특징 $\boldsymbol{v}_{c}$ 를 얻는다.

$$
\begin{split}&\boldsymbol{v}_{s}=\frac{\sum_{l=1}^{L}\boldsymbol{v}^{l}_{s}}{L},\boldsymbol{v}^{l}_{s}=\left[\mu(\boldsymbol{v}^{l})\left|\right|\sigma(\boldsymbol{v}^{l})\right],\boldsymbol{v}_{s}\in\mathbb{R}^{1\times 2d},\\
&\boldsymbol{v}_{c}=\frac{\boldsymbol{v}^{L}-\mu(\boldsymbol{v}^{L})}{\sigma(\boldsymbol{v}^{L})},\boldsymbol{v}_{c}\in\mathbb{R}^{n\times d}\end{split}
$$

### 3.2 CQF와 SQF

Content Q-Former(CQF)와 Style Q-Former(SQF)는 같은 뼈대를 쓴다. BLIP-2의 Q-Former에서 착안했다.

- 학습 가능한 질의 $N$ 개 $\boldsymbol{Q}=\left\{\boldsymbol{q}^{1},\boldsymbol{q}^{2},\cdots,\boldsymbol{q}^{N}\right\}\in\mathbb{R}^{N\times d}$ 를 넣는다. $d=512$ 로 CLIP의 공동 임베딩 차원과 같다.
- 질의끼리는 자기 주의(MSA)로, 이미지 특징과는 교차 주의(MCA)로 정보를 주고받은 뒤 MLP를 거친다. 블록마다 앞에 LayerNorm, 뒤에 잔차 연결이 있고 MLP는 GELU를 쓴 두 층이다.
- 출력은 프롬프트 $\boldsymbol{P}=\left\{\boldsymbol{p}^{1},\boldsymbol{p}^{2},\dots,\boldsymbol{p}^{N}\right\}\in\mathbb{R}^{N\times d}$ 다. CQF는 내용 특징을 보고 내용 프롬프트 $\boldsymbol{P}_{c}$ 를, SQF는 스타일 특징을 보고 스타일 프롬프트 $\boldsymbol{P}_{s}$ 를 낸다.

$$
\begin{split}\boldsymbol{Q^{\prime}}&=\boldsymbol{Q}+\texttt{MSA}(\texttt{LN}(\boldsymbol{Q})),\boldsymbol{Q^{\prime}}\in\mathbb{R}^{N\times d}\\
\boldsymbol{Q^{\prime\prime}}&=\boldsymbol{Q^{\prime}}+\texttt{MCA}(\texttt{LN}(\boldsymbol{Q^{\prime}}),\texttt{LN}(\boldsymbol{v})),\boldsymbol{Q^{\prime\prime}}\in\mathbb{R}^{N\times d}\\
\boldsymbol{P}&=\boldsymbol{Q^{\prime\prime}}+\texttt{MLP}(\texttt{LN}(\boldsymbol{Q^{\prime\prime}})),\boldsymbol{P}\in\mathbb{R}^{N\times d}\end{split}
$$

### 3.3 PTM: 내용 프롬프트에 글로 감독 주기

CLIP은 FAS의 "진짜", "위조" 개념을 잘 모른다. 그래서 프롬프트와 글의 상호정보를 키우는 정렬 대신, 프롬프트와 글이 짝이 맞는지 맞히는 이진 분류(Prompt-Text Matched)를 건다.

1. 샘플마다 "a photo of a $\left\langle\mathrm{CLASS}\right\rangle$ face." 라는 문장을 만든다. CLASS는 진짜면 live, 위조면 fake다.
2. 문장을 토크나이저와 임베딩 층에 통과시켜 글 감독 $\boldsymbol{S}\in\mathbb{R}^{B\times 77\times d}$ 로 바꾼다. 단어 토큰 수는 평균을 낸 뒤 $N$ 번 펼쳐 질의 수와 맞춘다.
3. 내용 프롬프트 $\boldsymbol{P_{c}}\in\mathbb{R}^{B\times N\times d}$ 와 $\boldsymbol{S}$ 를 임베딩 방향으로 이어 붙여 양성 쌍 $\boldsymbol{R}_{p}\in\mathbb{R}^{B\times N\times 2d}$ 를 만든다.
4. 음성 쌍은 ALBEF의 어려운 음성 채굴을 따른다. 프롬프트마다 대조 유사도 분포에 따라 음성 문장 하나를, 문장마다 음성 프롬프트 하나를 뽑는다. 닮은 것일수록 뽑힐 확률이 높다.
5. 양성과 음성 쌍을 배치 방향으로 합치면 $\boldsymbol{R}\in\mathbb{R}^{3B\times N\times 2d}$ 가 된다. 질의마다 두 클래스 선형 분류기로 로짓을 구하고, 모든 질의의 로짓을 평균해 짝이 맞는지 점수를 낸다. 손실은 교차 엔트로피 $\mathcal{H}(.,.)$ 이고 분류층은 $\texttt{FC}^{ptm}$ 이다.

$$
\begin{split}\boldsymbol{S}&=\texttt{Embed}(\texttt{Tokenizer}(\boldsymbol{T})),\boldsymbol{S}\in\mathbb{R}^{{B\times 77\times d}},\\
\boldsymbol{S}&=\texttt{Mean\&Expand}(\boldsymbol{S}),\boldsymbol{S}\in\mathbb{R}^{{B\times N\times d}},\\
\boldsymbol{R}_{p}&=\left[\boldsymbol{P}\left|\right|\boldsymbol{S}\right]_{\texttt{2}},\boldsymbol{R}_{p}\in\mathbb{R}^{{B\times N\times 2d}},\\
\boldsymbol{R}&=\left[\boldsymbol{R}_{p}\left|\right|\boldsymbol{R}^{prompt}_{n}\left|\right|\boldsymbol{R}^{text}_{n}\right]_{\texttt{0}},\boldsymbol{R}\in\mathbb{R}^{{3B\times N\times 2d}}\\
\end{split}
$$

위 식이 쌍을 만드는 과정이다. PTM 손실은 $3B$ 개 쌍 각각의 교차 엔트로피를 더한다.

$$
\begin{split}\mathcal{L}_{ptm}=\sum_{i=1}^{3B}\mathcal{H}(\boldsymbol{y}^{ptm}_{i},\texttt{Mean}(\texttt{FC}^{ptm}(\boldsymbol{R}_{i})))\end{split}
$$

### 3.4 DSP: 스타일 프롬프트 다양화

스타일은 말로 적기 어려워 글 감독을 줄 수 없다. 대신 MixStyle처럼 샘플 사이에서 스타일 통계를 섞는다.

- 배치의 $\mu(\boldsymbol{v})$, $\sigma(\boldsymbol{v})$ 순서를 섞어 참조 통계 $\mu(\hat{\boldsymbol{v}})$, $\sigma(\hat{\boldsymbol{v}})$ 를 만든다.
- 둘을 가중합해 섞인 통계 $\gamma_{mix}$, $\beta_{mix}$ 를 얻는다. 가중치는 샘플마다 $\lambda\sim Beta(\alpha,\alpha)$ 로 뽑는다. $\alpha$ 는 MixStyle 논문의 권고대로 0.1로 두었다.

$$
\begin{split}\gamma_{mix}=\lambda\sigma(\boldsymbol{v})+(1-\lambda)\sigma(\hat{\boldsymbol{v}}),\\
\beta_{mix}=\lambda\mu(\boldsymbol{v})+(1-\lambda)\mu(\hat{\boldsymbol{v}})\end{split}
$$

- 섞인 통계로 스타일 특징을 다시 계산한다. 학습 때만 확률 0.5로 켜고 평가 때는 쓰지 않는다.

### 3.5 PM: 프롬프트로 시각 특징 조정하기

내용과 스타일 프롬프트는 샘플마다 만들어지므로, 클래스를 예측하는 가중치보다 채널별 반응을 다시 맞추는 조정 계수로 쓰기에 알맞다고 저자들은 본다.

1. $\boldsymbol{P_{c}}$, $\boldsymbol{P_{s}}$ 를 글 인코더에 넣어 글 특징 $\boldsymbol{t_{c}}\in\mathbb{R}^{B\times d}$, $\boldsymbol{t_{s}}\in\mathbb{R}^{B\times d}$ 를 얻는다.
2. 둘을 이어 붙인 조정 특징 $\boldsymbol{t}\in\mathbb{R}^{B\times 2d}$ 를 게이트 함수 $\texttt{g}_{e}$ 에 넣는다. $\texttt{g}_{e}$ 는 FC 두 층($\mathbf{W}_{1}\in\mathbb{R}^{\frac{d}{r}\times 2d}$, $\mathbf{W}_{2}\in\mathbb{R}^{d\times\frac{d}{r}}$)과 ReLU, 시그모이드로 되어 있고 축소 비율 $r$ 은 16이다.
3. 그 출력이 채널 가중치 $\boldsymbol{w}\in\mathbb{R}^{B\times d}$ 다. 시각 특징의 채널 $\boldsymbol{v}^{c}$ 마다 스칼라 $\boldsymbol{w}^{c}$ 를 곱해 $\boldsymbol{\tilde{v}}\in\mathbb{R}^{B\times d}$ 를 만든다.
4. $\boldsymbol{\tilde{v}}$ 에 $\texttt{FC}^{cls}$ 와 softmax를 붙여 진짜와 위조를 판단한다.

$$
\begin{split}\boldsymbol{w}&=\delta(\texttt{g}_{e}(\boldsymbol{t},\mathbf{W}))=\delta(\mathbf{W}_{2}\sigma_{\textrm{relu}}(\mathbf{W}_{1}\boldsymbol{t})),\\
\boldsymbol{\tilde{v}}&=\left[\boldsymbol{\tilde{v}}^{1},\boldsymbol{\tilde{v}}^{2},\dots,\boldsymbol{\tilde{v}}^{d}\right],\boldsymbol{\tilde{v}}^{c}=\boldsymbol{w}^{c}\cdot\boldsymbol{v}^{c},\\
\mathcal{L}_{cls}&=\sum_{i=1}^{B}\mathcal{H}(\boldsymbol{y}^{cls}_{i},\texttt{FC}^{cls}(\boldsymbol{\tilde{v}}_{i})),\boldsymbol{\tilde{v}}\in\mathbb{R}^{B\times d}\end{split}
$$

### 3.6 학습과 추론

학습 때는 CQF, SQF, 두 분류층($\texttt{FC}^{ptm}$, $\texttt{FC}^{cls}$), 게이트 함수 $\texttt{g}_{e}$, 이미지 인코더 $\mathcal{V}$ 를 갱신한다. 글 인코더 $\mathcal{T}$ 는 고정한다. 전체 손실은 분류 손실과 PTM 손실을 가중치 없이 더한 것이다.

$$
\begin{split}\mathcal{L}_{total}=\mathcal{L}_{cls}+\mathcal{L}_{ptm}\end{split}
$$

추론 때는 CQF와 SQF가 샘플마다 프롬프트를 만든다. 글 인코더는 이 프롬프트를 연속적인 조정 계수로 바꾸고, 그 값을 시각 특징에 곱한다.

## 4. 실험 설정

| 항목 | 내용 |
| --- | --- |
| Protocol 1 | MSU-MFSD(M), CASIA-FASD(C), Idiap Replay-Attack(I), OULU-NPU(O) |
| Protocol 2 | CASIA-SURF(S), CASIA-SURF CeFA(C), WMCA(W)의 RGB 샘플. 피험자와 공격 종류가 더 많다 |
| 평가 방식 | 데이터셋 하나를 도메인 하나로 본다. 하나를 평가용으로 빼고 나머지로 학습 |
| 지표 | HTER(낮을수록 좋음), AUC(높을수록 좋음), FPR=1%일 때 TPR(높을수록 좋음) |
| 입력 | 224x224, 무작위 크기 조절 자르기와 좌우 뒤집기 |
| 질의 | 내용과 스타일 질의 길이 16, 차원 512, CQF와 SQF 깊이 1 |
| 최적화 | Adam, weight decay 0.05, 배치 12, 500 epoch, 두 번째 단계 최소 학습률 1e-6 |
| 추가 데이터 | 표에서 *가 붙은 결과는 CelebA-Spoof를 소스 데이터로 더 썼다 |

Protocol 2의 C는 CASIA-SURF CeFA다. Protocol 1의 C(CASIA-FASD)와 다른 데이터셋이다.

## 5. 주요 결과

### 5.1 Protocol 1 (원문 표 1)

"M 평가"는 O, C, I로 학습하고 M으로 평가했다는 뜻이다. 단위는 %.

| 방법 | M 평가 HTER | M 평가 AUC | C 평가 HTER | C 평가 AUC | I 평가 HTER | I 평가 AUC | O 평가 HTER | O 평가 AUC | 평균 HTER |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MADDG | 17.69 | 88.06 | 24.50 | 84.51 | 22.19 | 84.99 | 27.98 | 80.02 | 23.09 |
| DR-MD-Net | 17.02 | 90.10 | 19.68 | 87.43 | 20.87 | 86.72 | 25.02 | 81.47 | 20.64 |
| RFMeta | 13.89 | 93.98 | 20.27 | 88.16 | 17.30 | 90.48 | 16.45 | 91.16 | 16.97 |
| NAS-FAS | 19.53 | 88.63 | 16.54 | 90.18 | 14.51 | 93.84 | 13.80 | 93.43 | 16.09 |
| D2AM | 12.70 | 95.66 | 20.98 | 85.58 | 15.43 | 91.22 | 15.27 | 90.87 | 16.09 |
| SDA | 15.40 | 91.80 | 24.50 | 84.40 | 15.60 | 90.10 | 23.10 | 84.30 | 19.65 |
| DRDG | 12.43 | 95.81 | 19.05 | 88.79 | 15.56 | 91.79 | 15.63 | 91.75 | 15.66 |
| ANRL | 10.83 | 96.75 | 17.83 | 89.26 | 16.03 | 91.04 | 15.67 | 91.90 | 15.09 |
| SSDG-R | 7.38 | 97.17 | 10.44 | 95.94 | 11.71 | 96.59 | 15.61 | 91.54 | 11.28 |
| SSAN-R | 6.67 | 98.75 | 10.00 | 96.67 | 8.88 | 96.79 | 13.72 | 93.63 | 9.81 |
| PatchNet | 7.10 | 98.46 | 11.33 | 94.58 | 13.40 | 95.67 | 11.82 | 95.07 | 10.91 |
| SA-FAS | 5.95 | 96.55 | 8.78 | 95.37 | 6.58 | 97.54 | 10.00 | 96.23 | 7.82 |
| IADG | 5.41 | 98.19 | 8.70 | 96.44 | 10.62 | 94.50 | 8.86 | 97.14 | 8.39 |
| CFPL | 3.09 | 99.45 | 2.56 | 99.10 | 5.43 | 98.41 | 3.33 | 99.05 | 3.60 |
| FLIP-MCL* | 4.95 | 98.11 | 0.54 | 99.98 | 4.25 | 99.07 | 2.31 | 99.63 | 3.01 |
| CFPL* | 1.43 | 99.28 | 2.56 | 99.10 | 5.43 | 98.41 | 2.50 | 99.42 | 2.98 |

FPR=1%일 때 TPR은 아래 세 방법만 값이 있다.

| 방법 | M 평가 | C 평가 | I 평가 | O 평가 |
| --- | --- | --- | --- | --- |
| CFPL | 94.28 | 66.33 | 85.29 | 90.06 |
| FLIP-MCL* | 74.67 | 100.00 | 84.62 | 92.28 |
| CFPL* | 98.57 | 66.33 | 85.29 | 94.72 |

![[논문 노트/첨부/CFPL-FAS/result-hter.png]]
*원문 표 1의 HTER 가운데 SA-FAS, IADG, CFPL을 막대그래프로 다시 그렸다.*

CelebA-Spoof 없이 학습한 방법 중에서는 CFPL이 네 과제의 모든 지표에서 가장 좋다. 평균 HTER는 3.60%다. 이전 최고였던 SA-FAS(7.82%)의 절반에도 못 미친다. CelebA-Spoof를 더하면 평균 HTER가 2.98%로 FLIP-MCL*(3.01%)보다 조금 낮다. 저자들은 클래스 문장 여러 개를 앙상블하는 방식보다 클래스 없는 프롬프트 학습이 낫다는 근거로 이 결과를 든다. 타깃 데이터셋 이미지 5장을 학습에 쓰는 다른 방법보다는 평균 HTER가 조금 높았다.

### 5.2 Protocol 2 (원문 표 2)

"W 평가"는 C(CeFA), S로 학습하고 W로 평가했다는 뜻이다. 단위는 %.

| 방법 | W 평가 HTER | W 평가 AUC | W 평가 TPR | C 평가 HTER | C 평가 AUC | C 평가 TPR | S 평가 HTER | S 평가 AUC | S 평가 TPR | 평균 HTER |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ViT* | 7.98 | 97.97 | 73.61 | 11.13 | 95.46 | 47.59 | 13.35 | 94.13 | 49.97 | 10.82 |
| FLIP-MCL* | 4.46 | 99.16 | 83.86 | 9.66 | 96.69 | 59.00 | 11.71 | 95.21 | 57.98 | 8.61 |
| CFPL* | 4.40 | 99.11 | 85.23 | 8.13 | 96.70 | 62.41 | 8.50 | 97.00 | 55.66 | 7.01 |
| ViT | 21.04 | 89.12 | 30.09 | 17.12 | 89.05 | 22.71 | 17.16 | 90.25 | 30.23 | 18.44 |
| CLIP-V | 20.00 | 87.72 | 16.44 | 17.67 | 89.67 | 20.70 | 8.32 | 97.23 | 57.28 | 15.33 |
| CLIP | 17.05 | 89.37 | 8.17 | 15.22 | 91.99 | 17.08 | 9.34 | 96.62 | 60.75 | 13.87 |
| CoOp | 9.52 | 90.49 | 10.68 | 18.30 | 87.47 | 11.50 | 11.37 | 95.46 | 40.40 | 13.06 |
| CFPL | 9.04 | 96.48 | 25.84 | 14.83 | 90.36 | 8.33 | 8.77 | 96.83 | 53.34 | 10.88 |

TPR은 FPR=1% 기준이다. CelebA-Spoof 없이 학습한 경우 W 평가와 C 평가에서는 CFPL의 HTER가 가장 낮다. S 평가에서는 시각 특징만 쓰는 CLIP-V보다 조금 뒤졌다(HTER 8.77% 대 8.32%). 저자들은 CASIA-SURF의 위조 흔적이 뚜렷해서 시각 특징만으로도 일반화가 잘 된다고 설명한다. CelebA-Spoof를 더한 CFPL*는 평균 HTER 7.01%로 ViT*(10.82%)와 FLIP-MCL*(8.61%)보다 낮다.

### 5.3 구성 요소를 하나씩 더해 보면 (원문 표 3)

두 프로토콜의 모든 과제를 평균한 값이다. 기준선(B)은 CFPL에서 PTM, DSP, PM을 모두 뺀 것이다. CQF와 SQF로 프롬프트를 만드는 부분만 남는다.

| 설정 | HTER(%) | AUC(%) | TPR(%) @FPR=1% |
| --- | --- | --- | --- |
| CoOp | 8.78 | 94.77 | 43.71 |
| B | 8.11 | 96.09 | 51.59 |
| B + PTM | 7.50 | 96.39 | 54.78 |
| B + PTM + DSP | 7.08 | 96.79 | 57.61 |
| B + PTM + DSP + PM | 6.72 | 97.09 | 60.35 |

학습 가능한 문맥 벡터를 쓰는 CoOp 대신 CQF와 SQF로 프롬프트를 만들기만 해도 좋아진다. PM 없는 줄은 게이트 함수 대신 $\boldsymbol{w}=\left(\boldsymbol{t_{c}}+\boldsymbol{t_{s}}\right)/2$ 로 두 글 특징을 평균해 쓴 결과다. 게이트 함수를 넣으면 HTER가 7.08%에서 6.72%로 내려간다.

### 5.4 CQF와 SQF 구조 (원문 표 4, O 평가)

| 방법 | HTER(%) | AUC(%) | TPR(%)@FPR=1% |
| --- | --- | --- | --- |
| CoCoOp | 6.80 | 97.27 | 60.41 |
| CQF | 5.12 | 98.65 | 73.67 |
| SQF | 4.84 | 98.75 | 87.08 |
| CFPL | 3.33 | 99.05 | 90.06 |

CQF는 CFPL에서 SQF를 뺀 것, SQF는 CQF를 뺀 것이다. 둘 중 하나만 있어도 CoCoOp의 두 층 병목 구조(Meta-Net)보다 낫다. 둘을 함께 쓰면 가장 좋다.

### 5.5 질의 길이와 Q-Former 깊이 (원문 표 5, O 평가 HTER %)

| 깊이(행), 길이(열) | 8 | 16 | 32 | 64 |
| --- | --- | --- | --- | --- |
| 1 | 3.47 | 3.33 | 3.33 | 3.30 |
| 4 | 3.45 | 3.42 | 3.45 | 3.45 |
| 8 | 3.56 | 3.56 | 3.47 | 3.47 |
| 12 | 3.41 | 3.33 | 3.33 | 3.33 |

질의를 늘려도 이득이 미미하고 오히려 나빠지기도 한다. 깊이도 영향이 작다. 저자들은 질의 16개, 깊이 1을 권한다.

### 5.6 모델이 어디를 보나

![[논문 노트/첨부/CFPL-FAS/fig4-attention.jpg]]
*원문 그림 4. Protocol 1 과제별 주의 지도. 기준선이 틀린 샘플을 CFPL은 맞혔다. 출처: Liu et al., CVPR 2024*

I 평가(O, C, M으로 학습)에서 기준선은 배경을 보다가 진짜 얼굴을 틀렸다. CFPL은 얼굴과 배경의 경계로 시선을 옮겨 맞혔다. 화면 재생 공격에서는 기준선이 화면의 반사광을 놓쳤지만 CFPL은 그 부분을 짚었다.

## 6. 강점과 한계

**강점**

- 저자들은 글 프롬프트 학습으로 DG FAS를 다룬 첫 연구라고 밝힌다. 시각 특징을 직접 손대는 대신 글 인코더의 넓은 의미 공간을 빌린다.
- 도메인 이름이나 도메인 라벨이 필요 없다. 프롬프트는 이미지의 내용과 스타일에서 만들어진다.
- Protocol 1에서 CelebA-Spoof 없이 평균 HTER 3.60%를 냈다. 비교한 방법 가운데 가장 낮다.
- 구성 요소를 하나씩 더할 때마다 세 지표가 모두 좋아진다(표 3).

**한계와 확인할 점**

- Protocol 2의 S 평가에서는 시각 특징만 쓰는 CLIP-V보다 HTER, AUC, TPR이 모두 조금 낮다고 저자들도 적었다.
- CelebA-Spoof를 더해도 타깃 이미지 5장을 쓰는 다른 방법보다 평균 HTER가 조금 높았다.
- 표 1에서 CFPL과 CFPL*의 C 평가, I 평가 값은 같다(2.56%, 5.43%).
- Protocol 2의 C 평가에서 CFPL의 TPR@FPR=1%는 8.33%다. 같은 표의 CLIP(17.08%)이나 ViT(22.71%)보다 낮다.
- 최소 학습률(1e-6)과 "두 번째 단계"는 적혀 있지만 초기 학습률과 단계 구성은 본문에 없다. 전체 손실은 $\mathcal{L}_{cls}$ 와 $\mathcal{L}_{ptm}$ 을 그냥 더한다. 두 손실의 비율을 바꿔 본 실험은 없다.
- 본문에 코드 공개 여부가 적혀 있지 않다.

## 7. 용어 정리

| 용어 | 뜻 |
| --- | --- |
| FAS (Face Anti-Spoofing) | 카메라 앞 얼굴이 진짜 사람인지, 사진, 영상, 마스크 같은 위조인지 가려내는 일 |
| 도메인 일반화 (DG) | 여러 소스 데이터로만 학습해서 처음 보는 데이터에도 통하게 만드는 방법 |
| CLIP | 이미지 인코더와 글 인코더를 함께 학습해 이미지와 문장의 짝을 맞히게 한 모델 |
| 프롬프트 학습 | 글 인코더에 넣는 문장 일부를 학습 가능한 벡터로 바꿔 과제에 맞추는 방법. CoOp, CoCoOp가 대표적이다 |
| Q-Former | 학습 가능한 질의 벡터가 교차 주의로 이미지 특징에서 정보를 뽑아 오는 작은 트랜스포머 |
| MixStyle | 샘플 사이에서 특징의 평균과 표준편차를 섞어 스타일을 다양하게 만드는 기법 |
| HTER | 진짜를 위조로 본 비율(FRR)과 위조를 진짜로 본 비율(FAR)의 평균. 낮을수록 좋다 |
| TPR@FPR=1% | 거짓 양성률을 1%로 묶었을 때의 참 양성률. 실제 운영 임계값을 고를 때 쓴다 |

## 함께 읽으면 좋은 논문

- [[SSDG 논문 정리 (arXiv 2004.14043)|SSDG]]: 원문 표 1의 비교 대상이다. 진짜만 모으고 위조는 흩어 두는 DG 방법이다.
- [[SA-FAS 논문 정리 (arXiv 2303.13662)|SA-FAS]]: 표 1에서 CFPL 이전 최고 평균 HTER(7.82%)를 낸 방법이다.
- [[IADG 논문 정리 (arXiv 2304.05640)|IADG]]: 표 1의 비교 대상이다. 샘플 스타일에 덜 민감한 특징을 배우는 방법이다. CFPL의 "생존과 무관한 신호는 스타일에 있다"는 판단도 이 논문을 근거로 든다.
- [[FLIP 논문 정리 (arXiv 2309.16649)|FLIP]]: 글을 이용해 시각 표현을 개선한 방법이다. 표 1과 표 2에서 CelebA-Spoof를 함께 쓴 조건끼리 비교된다.
- [[I-FAS 논문 정리 (arXiv 2501.01720)|I-FAS]]: 같은 OCIM 평가를 쓰면서 멀티모달 LLM이 판단과 이유를 함께 말하게 만든 최근 논문이다.

## 출처

- Ajian Liu, Shuai Xue, Jianwen Gan, Jun Wan, Yanyan Liang, Jiankang Deng, Sergio Escalera, Zhen Lei. CFPL-FAS: Class Free Prompt Learning for Generalizable Face Anti-spoofing. CVPR 2024. [arXiv 2403.14333](https://arxiv.org/abs/2403.14333)
- 그림 2, 그림 4는 원문에서 인용했다(arXiv 비독점 배포 라이선스). 개념도와 막대그래프는 원문 내용을 바탕으로 직접 그렸다.
