---
paper: "FLIP: Cross-domain Face Anti-spoofing with Language Guidance"
arxiv: "2309.16649"
url: https://arxiv.org/abs/2309.16649
authors:
  - Koushik Srivatsan
  - Muzammal Naseer
  - Karthik Nandakumar
affiliation: Mohamed Bin Zayed University of Artificial Intelligence (MBZUAI), Abu Dhabi, United Arab Emirates
venue: ICCV 2023
code: https://github.com/koushiksrivats/FLIP
tags:
  - 논문
  - FAS
  - 도메인일반화
  - 비전언어모델
  - 컴퓨터비전
created: 2026-11-06
status: 정리완료
publish: true
summary: CLIP으로 시작한 ViT에 "진짜 얼굴", "위조 얼굴"을 설명하는 문장을 기준점으로 붙여서, 처음 보는 데이터셋에서도 위조를 더 잘 걸러낸 ICCV 2023 논문이에요.
title: "FLIP: 문장을 기준점으로 삼는 얼굴 위조 판별"
---
> [!abstract] 한 줄 요약
> 얼굴 위조 방지(FAS) 모델의 출발점을 ImageNet 대신 CLIP 이미지 인코더로 바꾸기만 해도 처음 보는 데이터셋에서 더 잘 버틴다. 여기에 진짜와 위조를 설명하는 문장 여러 개의 평균을 분류 기준으로 쓰고, 이미지 두 장과 문장 두 개 사이의 일관성까지 학습시키면 세 가지 평가 방식 모두에서 기존 방법보다 평균 HTER가 낮아진다.

![[논문 노트/첨부/FLIP/FLIP 마인드맵.webp]]

> [!tip] 마인드맵 크게 보기
> <a href="https://imvely.github.io/nyuri-garden/static/viewer.html?src=%EB%85%BC%EB%AC%B8-%EB%85%B8%ED%8A%B8/%EC%B2%A8%EB%B6%80/flip/flip-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.svg&fallback=%EB%85%BC%EB%AC%B8-%EB%85%B8%ED%8A%B8/%EC%B2%A8%EB%B6%80/flip/flip-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.png&back=%EB%85%BC%EB%AC%B8-%EB%85%B8%ED%8A%B8/flip-%EB%85%BC%EB%AC%B8-%EC%A0%95%EB%A6%AC-%28arxiv-2309.16649%29&title=FLIP%20%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5" target="_blank" rel="noopener" data-router-ignore>크게 열어 보기</a>

## 서지 정보

| 항목 | 내용 |
| --- | --- |
| 제목 | FLIP: Cross-domain Face Anti-spoofing with Language Guidance |
| 저자 | Koushik Srivatsan, Muzammal Naseer, Karthik Nandakumar |
| 소속 | Mohamed Bin Zayed University of Artificial Intelligence (MBZUAI), Abu Dhabi, United Arab Emirates |
| 게재 | ICCV 2023 |
| 원문 | [arXiv 2309.16649](https://arxiv.org/abs/2309.16649) |
| 코드 | [koushiksrivats/FLIP](https://github.com/koushiksrivats/FLIP) |

## 1. 어떤 문제를 푸나

얼굴 인식은 휴대폰부터 공항 탑승구까지 널리 쓰인다. 공격자는 인쇄한 사진, 다시 재생한 영상, 3D 마스크 같은 도구로 남의 얼굴을 흉내 낸다. 이런 공격을 가려내는 일이 얼굴 위조 방지(FAS)다.

학습과 평가 데이터가 비슷하면 지금 방법들도 정확도가 높다. 데이터셋이 바뀌면 이야기가 달라진다. 저자들은 이유를 두 가지로 꼽는다. 카메라, 공격 도구, 조명, 해상도가 달라서 소스와 타깃 사이 간격이 크다. 그리고 FAS 데이터셋은 학습 데이터가 적어서 모델이 소스에 과적합하기 쉽다.

최근에는 ViT가 이 문제에 잘 맞는다는 결과가 나왔다. 이미지를 패치로 나누고 패치 사이 관계를 멀리까지 보기 때문에 국소 위조 흔적을 찾아 전체 판단으로 모을 수 있다. 저자들은 기존 ViT 방법에 두 가지 한계가 있다고 본다.

- 이미지와 이미지 라벨만으로 학습한다. 학습 데이터가 적을 때 이것만으로는 표현이 충분하지 않을 수 있다.
- 사전학습 가중치를 FAS에 맞추려고 적응 모듈, 도메인 라벨, 공격 종류 정보를 따로 붙인다.

그래서 세 가지를 묻는다. ImageNet 대신 이미지와 글을 함께 배운 가중치로 ViT를 시작하면 더 잘 일반화하는가. 텍스트 인코더까지 쓰면 더 나아지는가. 자기지도 학습을 더하면 도메인 간격과 데이터 부족을 더 줄일 수 있는가.

## 2. 핵심 아이디어

보통 FAS 분류기는 이미지 특징 위에 MLP 머리를 얹고 진짜와 위조 사이에 경계를 긋는다. FLIP은 그 경계 대신 문장을 쓴다. "This is a real face" 같은 진짜 쪽 문장 6개와 "A photo of a spoof face" 같은 위조 쪽 문장 6개를 CLIP 텍스트 인코더에 넣고, 각 묶음의 평균을 기준점으로 삼는다. 이미지 특징이 어느 기준점과 코사인 유사도가 더 높은지로 진짜와 위조를 정한다.

![[논문 노트/첨부/FLIP/concept-language-anchor.png]]
*원문 그림 2와 3절 설명의 생각을 직접 다시 그린 개념도. 점 위치는 설명용이다.*

저자들은 이미지를 여러 클래스 설명에 함께 맞추면 클래스에 고유한 단서를 배운다고 설명한다. 평균을 내면 문장마다 섞인 잡음은 줄고 좋은 표현은 남는다. 학습 데이터가 적은 FAS에서는 이 점이 일반화에 도움이 된다는 것이 저자들의 설명이다.

## 3. 방법

![[논문 노트/첨부/FLIP/fig2-overview.png]]
*원문 그림 2. FLIP 전체 구조. CLIP을 바탕으로 세 가지 방식으로 미세조정한다. 출처: Srivatsan et al., ICCV 2023*

바탕 모델은 CLIP이다. 이미지 인코더 $\mathcal{V}$ 는 $K$ 개 transformer 블록 $\{\mathcal{V}_{k}\}_{k=1}^{K}$ 로 된 ViT다. 이미지를 $M$ 개 패치로 나눠 패치 임베딩 $\boldsymbol{e}_{0}\in\mathbb{R}^{M\times d_{v}}$ 를 만들고, 학습되는 class token을 붙여 블록을 차례로 통과시킨다.

$$
[{\text{c}}_{k},\boldsymbol{e}_{k}]=\mathcal{V}_{k}([\text{c}_{k-1},\boldsymbol{e}_{k-1}])\qquad k=1,2,\cdots,K.
$$

마지막 블록의 class token $\text{c}_{K}$ 를 ImageProj로 투영하면 이미지 표현 $x$ 가 된다.

$$
x=\texttt{ImageProj}({\text{c}}_{K})\ \ \ \qquad\boldsymbol{x}\in\mathbb{R}^{d_{vl}}.
$$

텍스트 인코더 $\mathcal{L}$ 은 문장 $t$ 를 토큰으로 나눠 단어 임베딩 $\boldsymbol{w}_{0}=[w_{0}^{1},w_{0}^{2},\cdots,w_{0}^{Q}]\in\mathbb{R}^{Q\times d_{l}}$ 을 만들고 블록을 차례로 통과시킨다. 마지막 블록에서 마지막 토큰을 TextProj로 투영하면 텍스트 표현 $z$ 가 된다.

$$
\boldsymbol{w}_{k}=\mathcal{L}_{k}(\boldsymbol{w}_{k-1})\ \ \ \qquad k=1,2,\cdots,K.
$$

$$
\boldsymbol{z}=\texttt{TextProj}({w_{K}^{Q}})\ \ \ \ \ \qquad\boldsymbol{z}\in\mathbb{R}^{d_{vl}}.
$$

두 표현은 같은 $d_{vl}$ 차원 공간에 놓인다. CLIP은 한 배치의 맞는 (이미지, 문장) 쌍 $n$ 개는 코사인 유사도를 키우고, 틀린 쌍 $(n^{2}-n)$ 개는 줄이도록 사전학습됐다. 이 위에서 세 가지 변형을 만든다.

### 3.1 FLIP-V (이미지 인코더만)

CLIP에서 이미지 인코더만 가져오고 텍스트 인코더는 버린다. ImageProj 직전의 class token $\text{c}_{K}$ 를 2층 MLP 머리에 넣어 진짜와 위조를 가른다. 손실은 교차 엔트로피 $L_{ce}$ 하나다. "CLIP 가중치로 시작한 평범한 ViT"인 셈이고, 초기화만 바꾼 효과를 보려는 변형이다.

### 3.2 FLIP-IT (이미지와 문장의 유사도)

MLP 머리 대신 문장을 쓴다. 진짜 쪽 문장 $t_{r}$ 과 위조 쪽 문장 $t_{s}$ 를 텍스트 인코더에 넣어 $\boldsymbol{z}_{r}$, $\boldsymbol{z}_{s}$ 를 얻는다. 이미지 표현 $x$ 와 두 텍스트 표현의 코사인 유사도 두 개를 클래스 logit으로 보고 교차 엔트로피를 건다. 추론 때는 이미지 $I$ 와 코사인 유사도 $sim(\cdot,\cdot)$ 가 가장 높은 클래스를 고른다.

$$
p(\hat{y}|x)=\frac{\text{exp}(sim(\boldsymbol{x},\boldsymbol{z}_{\hat{y}})/\tau)}{\text{exp}(sim(\boldsymbol{x},\boldsymbol{z}_{r})/\tau)+\text{exp}(sim(\boldsymbol{x},\boldsymbol{z}_{s})/\tau)},
$$

$\tau$ 는 온도, $\hat{y}\in\{r,s\}$ 는 예측한 클래스다.

문장은 한 클래스에 $P$ 개를 쓰고, 각 문장의 표현을 평균한 $\bar{z}$ 를 그 클래스의 기준으로 삼는다. 원문이 쓴 문장은 아래와 같다(원문 표 1).

| 번호 | 진짜 쪽 문장 | 위조 쪽 문장 |
| --- | --- | --- |
| P1 | This is an example of a real face | This is an example of a spoof face |
| P2 | This is a bonafide face | This is an example of an attack face |
| P3 | This is a real face | This is not a real face |
| P4 | This is how a real face looks like | This is how a spoof face looks like |
| P5 | A photo of a real face | A photo of a spoof face |
| P6 | This is not a spoof face | A printout shown to be a spoof face |

### 3.3 FLIP-MCL (다중모달 대조 학습)

FLIP-IT의 교차 엔트로피에 자기지도 손실 두 개를 더한다.

simCLR 손실은 이미지끼리 건다. 한 이미지에 서로 다른 변환을 적용해 두 view $I^{v_{1}}$, $I^{v_{2}}$ 를 만들고, 이미지 인코더 $\mathcal{V}$ 로 특징을 뽑는다. 이 특징을 비선형 투영망 $\mathcal{H}$ 에 통과시킨 뒤 대조 손실을 건다.

$$
\boldsymbol{x}^{v_{1}}=\mathcal{V}(I^{v_{1}}),\ \ \ \ \boldsymbol{x}^{v_{2}}=\mathcal{V}(I^{v_{2}})
$$

$$
\boldsymbol{h}_{1}=\mathcal{H}(\boldsymbol{x}^{v_{1}})\ \ ,\ \ h_{2}=\mathcal{H}(\boldsymbol{x}^{v_{2}})\ \ \ \quad\boldsymbol{h}_{1},\boldsymbol{h}_{2}\in\mathbb{R}^{d_{h}}.
$$

$$
L_{simCLR}=\texttt{simCLR}(\boldsymbol{h}_{1},\boldsymbol{h}_{2})
$$

MSE 손실은 이미지와 문장 사이에 건다. 정답 클래스의 문장 중 두 개를 무작위로 골라 $\boldsymbol{z}^{v_{1}}$, $\boldsymbol{z}^{v_{2}}$ 를 얻는다. 이미지 view와 문장 view를 하나씩 짝지어 코사인 유사도를 두 번 계산하고, 두 값이 같아지게 만든다.

$$
L_{mse}=(sim(\boldsymbol{x}^{v_{1}},\boldsymbol{z}^{v_{1}})-sim(\boldsymbol{x}^{v_{2}},\boldsymbol{z}^{v_{2}}))^{2}
$$

원문 3.4절의 전체 손실은 세 항의 합이다.

$$
L_{mcl}=L_{ce}+L_{simCLR}+L_{mse}
$$

4.3절과 원문 표 7에서는 각 항에 가중치를 붙여 민감도를 본다.

$$
L_{mcl}=\alpha L_{ce}+\beta L_{simCLR}+\gamma L_{mse}
$$

추론은 FLIP-IT와 똑같이 코사인 유사도로 한다. 학습이 끝나면 문장 표현을 미리 계산해 둘 수 있다. 그래서 추론 때는 텍스트 인코더와 투영망 없이 이미지 인코더만 있으면 된다.

## 4. 실험 설정

| 항목 | 내용 |
| --- | --- |
| Protocol 1 | MSU-MFSD(M), CASIA-MFSD(C), Idiap Replay Attack(I), OULU-NPU(O). 하나를 빼고 나머지 셋으로 학습 |
| Protocol 2 | WMCA(W), CASIA-CeFA(C), CASIA-SURF(S). 하나를 빼고 나머지 둘로 학습 |
| Protocol 3 | M, C, I, O 중 하나로 학습하고 다른 하나로 평가. 조합 12개 |
| 추가 학습 데이터 | 세 프로토콜 모두 CelebA-Spoof를 보조 학습 데이터로 넣음 |
| 입력 | 얼굴을 잘라 224x224x3, 패치 16x16 |
| 백본 | CLIP의 ViT 변형. $d_{v}=768$, 공유 공간 $d_{vl}=512$ |
| 최적화 | Adam, 초기 학습률 $10^{-6}$, weight decay $10^{-6}$, 4000 iteration |
| 배치 | 도메인마다 3 (Protocol 1, 3), 8 (Protocol 2) |
| 기타 | FLIP-V의 MLP 머리는 512, 2차원 2층. $\mathcal{H}$ 는 512, 4096, 256차원 3층 |
| 지표 | HTER(낮을수록 좋음), AUC(높을수록 좋음), TPR@FPR=1%(높을수록 좋음) |
| 반복 | 시드를 바꿔 5번 실행한 평균 |

0-shot은 타깃 데이터를 한 장도 쓰지 않는 설정, 5-shot은 라벨 있는 타깃 샘플 5개를 학습에 쓰는 설정이다. 본문 결과는 모두 0-shot이다.

## 5. 주요 결과

### 5.1 Protocol 1 (원문 표 2, 0-shot)

"M 평가"는 O, C, I로 학습하고 M으로 평가했다는 뜻이다. 단위는 %. 원문 표의 일부 행만 옮겼다.

| 방법 | M 평가 HTER | M 평가 AUC | C 평가 HTER | C 평가 AUC | I 평가 HTER | I 평가 AUC | O 평가 HTER | O 평가 AUC | 평균 HTER |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MADDG | 17.69 | 88.06 | 24.50 | 84.51 | 22.19 | 84.99 | 27.98 | 80.02 | 23.09 |
| SSDG-R | 7.38 | 97.17 | 10.44 | 95.94 | 11.71 | 96.59 | 15.61 | 91.54 | 11.28 |
| SSAN-R | 6.67 | 98.75 | 10.00 | 96.67 | 8.88 | 96.79 | 13.72 | 93.63 | 9.80 |
| PatchNet | 7.10 | 98.46 | 11.33 | 94.58 | 13.40 | 95.67 | 11.82 | 95.07 | 10.90 |
| DiVT-M | 2.86 | 99.14 | 8.67 | 96.62 | 3.71 | 99.29 | 13.06 | 94.04 | 7.07 |
| ViT | 1.58 | 99.68 | 5.70 | 98.91 | 9.25 | 97.15 | 7.47 | 98.42 | 6.00 |
| FLIP-V | 3.79 | 99.31 | 1.27 | 99.75 | 4.71 | 98.80 | 4.15 | 98.76 | 3.48 |
| FLIP-IT | 5.27 | 98.41 | 0.44 | 99.98 | 2.94 | 99.42 | 3.61 | 99.15 | 3.06 |
| FLIP-MCL | 4.95 | 98.11 | 0.54 | 99.98 | 4.25 | 99.07 | 2.31 | 99.63 | 3.01 |

![[논문 노트/첨부/FLIP/result-hter.png]]
*원문 표 2의 0-shot 평균 HTER를 막대그래프로 다시 그렸다.*

초기화만 CLIP으로 바꾼 FLIP-V도 평균 HTER 3.48%로 ImageNet 초기화 ViT(6.00%)보다 낮다. FLIP-MCL은 3.01%다. 원문 표에 따르면 5-shot으로 타깃에 적응한 다른 방법의 평균(3.31%)보다도 낮다. TPR@FPR=1%도 C, I, O 평가에서 각각 100.00, 84.62, 92.28로 0-shot ViT(88.57, 51.54, 69.30)보다 높다.

M 평가만 예외다. FLIP-MCL의 HTER 4.95%는 0-shot ViT의 1.58%보다 높다. 저자들은 진짜 얼굴을 위조로 본 경우가 늘어서라고 설명한다. 저해상도나 조명 변화가 있는 진짜 얼굴이 위조로 분류됐고, 위조를 진짜로 본 경우는 없었다고 적었다.

### 5.2 Protocol 2 (원문 표 3, 0-shot)

| 방법 | W 평가 HTER | W 평가 AUC | C 평가 HTER | C 평가 AUC | S 평가 HTER | S 평가 AUC | 평균 HTER |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ViT | 7.98 | 97.97 | 11.13 | 95.46 | 13.35 | 94.13 | 10.82 |
| FLIP-V | 6.13 | 97.84 | 10.89 | 95.82 | 12.48 | 94.43 | 9.83 |
| FLIP-IT | 4.89 | 98.65 | 10.04 | 96.48 | 15.68 | 91.83 | 10.2 |
| FLIP-MCL | 4.46 | 99.16 | 9.66 | 96.69 | 11.71 | 95.21 | 8.61 |

"W 평가"는 C, S로 학습하고 W로 평가했다는 뜻이다. Protocol 2는 CASIA-CeFA와 CASIA-SURF에 피험자가 1000명 넘게 있어서 MCIO(약 50명)보다 규모가 크고 환경 변화도 많다. 여기서는 FLIP-IT가 S 평가에서 FLIP-V보다 나빴고 ViT보다도 나빴다. FLIP-MCL은 세 과제 모두에서 세 변형 가운데 HTER가 가장 낮다.

### 5.3 Protocol 3, 데이터셋 하나로 학습 (원문 표 4, 0-shot)

데이터셋 하나로 학습하고 다른 하나로 평가하는 가장 어려운 설정이다. 12개 조합의 평균 HTER만 옮겼다. 일부 기존 방법은 조합 6개만 보고했다.

| 방법 | 평균 HTER |
| --- | --- |
| ADDA | 39.6 |
| DRCN | 38.1 |
| DupGAN | 36.8 |
| KSA | 24.0 |
| DR-UDA | 23.1 |
| MDDR | 26.1 |
| ADA | 25.0 |
| USDAN-Un | 16.3 |
| GDA | 14.4 |
| CDFTN-L | 13.2 |
| FLIP-V | 7.12 |
| FLIP-IT | 6.03 |
| FLIP-MCL | 4.84 |

O로 평가할 때 차이가 크다. C로 학습한 경우 CDFTN-L은 29.9%, FLIP-MCL은 3.91%다. 반대로 I로 평가하는 일부 조합에서는 CDFTN-L이 더 낫다. C로 학습해 I로 평가하면 CDFTN-L은 1.7%, FLIP-MCL은 10.57%다. 비교 대상인 기존 방법 상당수는 타깃 데이터를 라벨 없이 쓰는 도메인 적응 방법이다.

### 5.4 초기화를 바꿔 보면 (원문 표 5, Protocol 1)

같은 ViT 학습 방식에서 시작 가중치만 바꿨다.

| 초기화 | M 평가 HTER | C 평가 HTER | I 평가 HTER | O 평가 HTER | 평균 HTER |
| --- | --- | --- | --- | --- | --- |
| 처음부터 학습 | 18.32 | 40.05 | 19.22 | 29.72 | 25.86 |
| BeIT | 4.73 | 7.86 | 13.51 | 15.19 | 8.70 |
| ImageNet | 1.58 | 5.70 | 9.25 | 7.47 | 6.00 |
| CLIP (FLIP-V) | 3.79 | 1.27 | 4.71 | 4.15 | 3.48 |

평균으로 보면 CLIP 초기화가 가장 좋다. 저자들은 이 결과가 "사전학습 ViT 이미지 인코더를 전부 미세조정하면 일반화가 떨어진다"는 기존 주장과 어긋난다고 짚는다.

### 5.5 문장 하나 대 문장 묶음 (원문 표 6, FLIP-IT, Protocol 1)

| 문장 | M 평가 HTER | C 평가 HTER | I 평가 HTER | O 평가 HTER | 평균 HTER |
| --- | --- | --- | --- | --- | --- |
| P1 | 6.00 | 0.54 | 3.60 | 3.47 | 3.40 |
| P2 | 8.32 | 1.05 | 2.98 | 5.74 | 4.52 |
| P3 | 4.68 | 0.21 | 4.30 | 4.07 | 3.31 |
| P4 | 5.78 | 0.65 | 3.72 | 3.54 | 3.42 |
| P5 | 6.48 | 0.46 | 2.52 | 3.24 | 3.17 |
| P6 | 5.58 | 0.3 | 2.85 | 3.03 | 2.94 |
| 묶음(평균) | 5.27 | 0.44 | 2.94 | 3.61 | 3.06 |

과제마다 가장 좋은 문장이 다르다. M은 P3, I는 P5, O는 P6이 가장 낮다. 평균만 보면 P6 하나(2.94%)가 묶음(3.06%)보다 조금 낮다. 저자들은 모든 과제에 맞는 문장 하나를 미리 고르기 어렵다고 보고, 묶음을 더 안정적인 선택으로 꼽는다.

### 5.6 손실 가중치 (원문 표 7, Protocol 1 평균 HTER)

| $(\alpha,\beta,\gamma)$ | (1,1,1) | (1,1,0) | (1,0,1) | (1,2,2) | (1,5,5) |
| --- | --- | --- | --- | --- | --- |
| HTER | 3.01 | 3.15 | 3.47 | 3.20 | 3.67 |

simCLR이나 MSE 중 하나를 빼면 나빠진다. 자기지도 손실의 비중을 키워도 나빠지는데, 저자들은 교차 엔트로피의 몫이 줄기 때문이라고 설명한다.

### 5.7 계산량 (원문 표 11)

| 방법 | 학습 이미지 인코더 FLOPs | 학습 텍스트 인코더+투영 파라미터 | 추론 파라미터 | 추론 시간(초/프레임) |
| --- | --- | --- | --- | --- |
| ViT | 17.58G | - | 86.19M | 0.007 |
| FLIP-V | 17.58G | - | 86.58M | 0.013 |
| FLIP-IT | 17.58G | 63.11M | 86.19M | 0.010 |
| FLIP-MCL | 52.74G | 83.05M | 86.19M | 0.010 |

FLIP-MCL은 학습 때 이미지를 원본과 변환 두 장, 모두 세 번 통과시켜서 FLOPs가 세 배다. 추론 때는 이미지 인코더만 남아서 ViT와 파라미터 수가 같다(NVIDIA Quadro RTX 6000 기준).

### 5.8 처음 보는 공격 종류 (원문 표 12)

M, C, I, O를 합친 뒤 80%-20%로 나눴다. Replay는 진짜와 인쇄로 학습하고 재생 공격으로 평가, Print는 진짜와 재생으로 학습하고 인쇄 공격으로 평가했다.

| 방법 | Replay HTER | Print HTER |
| --- | --- | --- |
| ViT | 4.69 | 10.36 |
| FLIP-MCL | 1.07 | 1.98 |

### 5.9 모델이 어디를 보나

![[논문 노트/첨부/FLIP/fig3-attention.webp]]
*원문 그림 3. Protocol 1 위조 이미지에서 FLIP-MCL의 attention map. 출처: Srivatsan et al., ICCV 2023*

Protocol 1에서는 종이 질감(M), 종이 테두리(C), 모아레 무늬(I, O)에 주의가 몰린다. Protocol 2에서는 화면 테두리와 반사(W), 인쇄한 천의 주름(C), 눈과 코를 오려 낸 부분(S)을 본다. 틀린 사례도 함께 보였다. 어두운 조명, 피부색이 어두운 얼굴, 심한 화소 깨짐, 큰 자세 변화가 있는 진짜 얼굴은 위조로 분류되기도 했다. 고해상도 위조는 진짜로 분류되는 경우가 있었다.

## 6. 강점과 한계

**강점**

- 구조를 거의 바꾸지 않는다. FLIP-V는 초기화만 바꾼 ViT이고, FLIP-IT와 FLIP-MCL도 추론 때는 이미지 인코더 하나로 끝난다.
- 도메인 라벨이나 공격 종류 정보 없이 학습한다.
- 모든 실험을 시드 5개로 돌려 평균과 표준편차를 냈다. Protocol 1, 2에서는 단측 t-검정도 했다.
- 데이터셋 하나로 학습하는 Protocol 3에서 평균 HTER를 13.2%에서 4.84%로 낮췄다.
- 코드가 공개되어 있다.

**한계와 확인할 점**

- 저자들이 직접 밝힌 한계는 학습 때 텍스트 인코더를 돌리는 추가 계산이다. FLIP-MCL의 학습 FLOPs는 ViT의 세 배다.
- Protocol 1의 M 평가에서는 FLIP 세 변형 모두 0-shot ViT보다 HTER가 높다. t-검정도 M에서는 0-shot, 5-shot 모두 유의하지 않았다.
- 표 6에서 문장 묶음은 평균으로 가장 좋은 단일 문장(P6)보다 조금 뒤진다. 묶음의 장점은 "고르지 않아도 된다"는 데 있다.
- 온도 $\tau$ 값과 simCLR에 쓴 이미지 변환의 구체적인 종류는 본문에 적혀 있지 않다.
- 세 프로토콜 모두 CelebA-Spoof를 보조 학습 데이터로 넣었다. 이것 없이 학습한 결과는 따로 보고하지 않았다.
- 기존 방법의 숫자는 각 논문이 보고한 값을 옮겨 왔다. 저자들은 기존 연구 대부분이 한 번 실행한 최고값을 보고한다고 지적한다.
- 저자들은 다른 비전 언어 모델에서도 같은 결론이 나오는지, 프롬프트 학습으로 더 나아지는지를 다음 과제로 남겼다.

## 7. 용어 정리

| 용어 | 뜻 |
| --- | --- |
| FAS (Face Anti-Spoofing) | 카메라 앞 얼굴이 진짜 사람인지, 사진, 영상, 마스크 같은 위조인지 가려내는 일 |
| CLIP | 인터넷의 이미지와 글 쌍 수백만 개로, 짝이 맞는 이미지와 글의 표현을 가깝게 학습한 모델 |
| VLP | 비전 언어 사전학습. 이미지와 글을 함께 배운 모델 |
| 0-shot, 5-shot | 학습에 타깃 데이터를 한 장도 안 쓰는 설정과, 라벨 있는 타깃 샘플 5개를 쓰는 설정 |
| HTER | 진짜를 위조로 본 비율과 위조를 진짜로 본 비율의 평균. 낮을수록 좋다 |
| TPR@FPR=1% | 오경보를 1%로 묶었을 때 제대로 잡아낸 비율. 높을수록 좋다 |
| simCLR | 같은 이미지의 두 변환은 가깝게, 다른 이미지는 멀게 만드는 자기지도 대조 학습 |
| 문장 묶음 (ensemble of prompts) | 한 클래스를 설명하는 문장 여러 개의 텍스트 표현을 평균한 것 |

## 함께 읽으면 좋은 논문

- [[SSDG 논문 정리 (arXiv 2004.14043)|SSDG]]: FLIP이 Protocol 1 비교 표에 넣은 기준 방법이다(SSDG-R, 평균 HTER 11.28%).
- [[I-FAS 논문 정리 (arXiv 2501.01720)|I-FAS]]: 같은 MCIO 평가에서 언어 모델을 FAS에 끌어온 다른 방식이다. 멀티모달 LLM이 판단과 이유를 함께 말하게 만든다.
- [[CFPL-FAS 논문 정리 (arXiv 2403.14333)|CFPL-FAS]]: FLIP-MCL을 비교 대상으로 인용한 후속 논문이다. 교차 데이터셋 FAS라는 같은 문제를 다룬다.

## 출처

- Koushik Srivatsan, Muzammal Naseer, Karthik Nandakumar. FLIP: Cross-domain Face Anti-spoofing with Language Guidance. ICCV 2023. [arXiv 2309.16649](https://arxiv.org/abs/2309.16649)
- 공식 코드: [github.com/koushiksrivats/FLIP](https://github.com/koushiksrivats/FLIP)
- 그림 2, 그림 3은 원문에서 인용했다(CC BY-NC-SA 4.0). 개념도와 막대그래프는 원문 내용을 바탕으로 직접 그렸다.
