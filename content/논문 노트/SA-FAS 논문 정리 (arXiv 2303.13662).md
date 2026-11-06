---
paper: "Rethinking Domain Generalization for Face Anti-spoofing: Separability and Alignment"
arxiv: "2303.13662"
url: https://arxiv.org/abs/2303.13662
authors:
  - Yiyou Sun
  - Yaojie Liu
  - Xiaoming Liu
  - Yixuan Li
  - Wen-Sheng Chu
affiliation: 위스콘신대학교 매디슨(University of Wisconsin-Madison), Google Research, 미시간주립대학교(Michigan State University)
venue: CVPR 2023
code: https://github.com/sunyiyou/SAFAS
tags:
  - 논문
  - FAS
  - 도메인일반화
  - 컴퓨터비전
created: 2026-11-06
status: 정리완료
publish: true
summary: 도메인 차이를 지우지 않고 오히려 나눠 두되, 진짜에서 위조로 가는 방향만 모든 도메인에서 같게 맞춰 처음 보는 데이터셋에서도 위조를 잘 가려낸 CVPR 2023 논문이에요.
title: "SA-FAS: 도메인은 나누고, 방향은 맞추기"
---
> [!abstract] 한 줄 요약
> 기존 도메인 일반화 FAS는 데이터셋마다 다른 흔적을 특징에서 지우려 했다. SA-FAS는 반대로 도메인마다 특징이 따로 뭉치게 두고, 진짜에서 위조로 넘어가는 방향만 모든 도메인에서 같게 맞춘다. 이 생각을 IRM 문제로 정리하고 projected gradient로 풀어서 OCIM 네 과제 모두에서 HTER를 가장 낮게 만들었다.

![[논문 노트/첨부/SA-FAS/SA-FAS 마인드맵.png]]

> [!tip] 마인드맵 크게 보기
> <a href="https://imvely.github.io/nyuri-garden/static/viewer.html?src=%EB%85%BC%EB%AC%B8-%EB%85%B8%ED%8A%B8/%EC%B2%A8%EB%B6%80/sa-fas/sa-fas-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.svg&fallback=%EB%85%BC%EB%AC%B8-%EB%85%B8%ED%8A%B8/%EC%B2%A8%EB%B6%80/sa-fas/sa-fas-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.png&back=%EB%85%BC%EB%AC%B8-%EB%85%B8%ED%8A%B8/sa-fas-%EB%85%BC%EB%AC%B8-%EC%A0%95%EB%A6%AC-%28arxiv-2303.13662%29&title=SA-FAS%20%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5" target="_blank" rel="noopener" data-router-ignore>크게 열어 보기</a>

## 서지 정보

| 항목 | 내용 |
| --- | --- |
| 제목 | Rethinking Domain Generalization for Face Anti-spoofing: Separability and Alignment |
| 저자 | Yiyou Sun, Yaojie Liu, Xiaoming Liu, Yixuan Li, Wen-Sheng Chu |
| 소속 | 위스콘신대학교 매디슨(University of Wisconsin-Madison), Google Research, 미시간주립대학교(Michigan State University) |
| 게재 | CVPR 2023 |
| 원문 | [arXiv 2303.13662](https://arxiv.org/abs/2303.13662) |
| 코드 | [sunyiyou/SAFAS](https://github.com/sunyiyou/SAFAS) |

## 1. 어떤 문제를 푸나

얼굴 인식은 휴대폰 잠금 해제나 전자 결제에 널리 쓰인다. 하지만 인쇄한 사진, 화면 재생, 3D 마스크 같은 위조 공격에는 여전히 약하다. 이런 공격을 걸러내는 일이 얼굴 위조 방지(FAS)다.

출입 통제처럼 조명과 자세가 크게 변하지 않는 환경에서는 단순한 방법도 통했다. 휴대폰 잠금 해제처럼 카메라와 장면이 제각각인 곳에서는 학습 데이터가 모든 변화를 담지 못한다. 학습 데이터와 테스트 데이터 사이의 이런 차이를 도메인 차이라고 부른다. 도메인 차이를 다루는 FAS는 교차 도메인 FAS라고 한다.

지금까지는 도메인 불변 특징을 배우는 방법이 주로 쓰였다. 도메인 판별기를 속이는 적대 학습이나 triplet 계열 손실로 데이터셋마다 다른 흔적을 특징에서 지운다. 저자들은 여기에 두 가지 문제가 있다고 본다.

- 학습 데이터에서 도메인 차이를 지웠다고 해서 특징 공간이 정말 도메인 불변이 되지는 않는다. 학습 데이터는 양도 적고 도메인 종류도 몇 개 안 되어 손실이 쉽게 과적합된다. 처음 보는 테스트 도메인에서는 특징이 더 넓게 퍼지고, 진짜와 위조의 위치 관계도 학습한 분류기와 크게 어긋난다(원문 그림 7).
- 도메인을 한데 섞으면 특징 공간이 모호해진다. 도메인에는 해상도, 흐림, 센서 패턴 같은 정보가 담겨 있다. 도메인이 섞이면 분류기가 저해상도 도메인의 진짜와 고해상도 도메인의 위조를 비교하는 식으로 엉뚱한 상관관계(spurious correlation)에 기대게 된다. 그런 상관관계가 없는 테스트 도메인에서는 통하지 않는다.

## 2. 핵심 아이디어

출발점은 도메인 신호를 지우지 말고 남겨 두자는 생각이다. 대신 특징 공간이 두 성질을 갖게 만든다.

- 분리(Separability): 도메인이 다르거나 진짜/위조 라벨이 다른 샘플은 서로 떨어져 있다. 도메인 차이가 특징 안에 그대로 남는다.
- 정렬(Alignment): 진짜에서 위조로 넘어가는 변화(live-to-spoof transition)가 모든 도메인에서 같은 방향을 향한다. 비슷한 공격 종류라면 환경이나 센서가 달라도 위조로 바뀌는 과정은 비슷할 것이라는 가정에서 나왔다.

![[논문 노트/첨부/SA-FAS/concept-separability-alignment.png]]
*원문 그림 1, 그림 2의 생각을 직접 다시 그린 개념도. 점 위치는 설명용이다.*

두 성질이 함께 있으면 도메인 차이는 진짜와 위조를 가르는 경계와 나란한 방향으로만 나타난다. 그래서 경계 하나를 모든 도메인이 같이 쓸 수 있고, 처음 보는 도메인에도 그 경계가 통한다. 정리하면 특징은 도메인마다 다르게, 분류기는 도메인과 상관없이 같게 배운다. 저자들은 이 논문이 다루는 공격을 인쇄와 재생 공격으로 한정했다.

![[논문 노트/첨부/SA-FAS/fig2-objectives.png]]
*원문 그림 2. 학습 목표에 따라 달라지는 특징 공간. (a) ERM, (b) ERM+SupCon, (c) SA-FAS. 원은 진짜, 엑스는 위조, 색은 도메인이다. 출처: Sun et al., CVPR 2023*

ERM만 쓰면 모든 도메인이 섞인 채 하나의 경계에 맞춰진다(a). SupCon을 더하면 도메인별로 뭉치기는 하지만, 뭉친 덩어리가 아무 데나 놓일 수 있어 도메인마다 최적 경계가 달라진다(b). 분리만으로는 부족하다는 뜻이다. SA-FAS는 여기에 정렬을 더해 도메인별 경계를 하나로 맞춘다(c).

## 3. 방법

### 3.1 문제 설정

입력 공간을 $\mathcal{X}=\mathbb{R}^{d}$, 출력 공간을 $\mathcal{Y}=\{0\text{ (live)},1\text{ (spoof)}\}$ 로 둔다. 학습 데이터는 $E$ 개 도메인 $\mathcal{E}=\{e^{(1)},e^{(2)},..,e^{(E)}\}$ 에서 오고, 평가는 처음 보는 도메인 $e^{*}$ 에서 한다. 목표는 새 도메인의 샘플이 진짜인지 위조인지 가르는 함수를 찾는 것이다.

$$
f:\mathbf{x}\rightarrow\{0\text{ (live)},1\text{ (spoof)}\},
$$

모델은 두 부분으로 나뉜다.

- 인코더 $\phi:\mathcal{X}\rightarrow\mathbb{R}^{m}$: 입력을 $l_{2}$ 정규화된 특징 $\mathbf{z}=\phi(\mathbf{x})$ 로 바꾼다.
- 분류기 $\beta:\mathbb{R}^{m}\rightarrow\mathbb{R}$: 가중치 벡터 하나로, 특징을 스칼라로 바꾼 뒤 sigmoid와 이진 교차 엔트로피를 적용한다. 논문에서는 $\beta$ 를 진짜와 위조를 가르는 초평면의 법선 벡터로 보고 "live-vs-spoof hyperplane"이라 부른다.

보통은 모든 도메인 데이터를 합쳐 평균 오차를 줄이는 ERM(Empirical Risk Minimization)으로 학습한다.

$$
\mathcal{L}_{\textit{ERM}}=\min_{\phi,\beta}\frac{1}{|\mathcal{E}|}\sum_{e\in\mathcal{E}}\mathcal{R}^{e}(\phi,\beta),
$$

$$
\mathcal{R}^{e}(\phi,\beta)\triangleq\mathbb{E}_{(\mathbf{x}_{i},y_{i},e_{i}=e)\sim\mathcal{D}}\ell\left(f(\mathbf{x}_{i};\phi,\beta),y_{i}\right).
$$

$\mathcal{R}^{e}$ 는 도메인 $e$ 하나에서 잰 위험(risk)이다. 저자들은 ERM이 도메인을 섞어 버리면 해상도나 흐림처럼 가장 쉬운 차이로 진짜와 위조를 가르게 된다고 지적한다.

### 3.2 분리: SupCon

분리는 지도 대조 학습(Supervised Contrastive Learning, SupCon)으로 만든다. 일반 대조 학습은 같은 이미지를 증강한 쌍만 같은 범주로 보지만, SupCon은 라벨이 같은 샘플을 모두 끌어당긴다. SA-FAS에서는 "같은 도메인이면서 같은 진짜/위조 라벨"을 하나의 범주로 친다.

미니배치 $\{\mathbf{x}_{i},y_{i},e_{i}\}_{i=1}^{b}$ 의 각 입력에 증강을 두 번 걸어 $2b$ 개 샘플을 만들고, $L_{2}$ 정규화된 특징 $\{\mathbf{z}_{i}\}_{i=1}^{2b}$ 를 얻는다. 분리 손실은 다음과 같다.

$$
\mathcal{L}_{\textit{sep}}=\sum_{i=1}^{2b}\frac{-1}{|S(i)|}\sum_{j\in S(i)}\log\frac{\exp\left(\mathbf{z}_{i}\cdot\mathbf{z}_{j}/\tau\right)}{\sum_{t=1,t\neq i}^{2b}\exp\left(\mathbf{z}_{i}\cdot\mathbf{z}_{t}/\tau\right)},
$$

$\tau$ 는 온도다. 기준 샘플 $i$ 의 양성 집합은 $S(i)=\{j\in\{1,\ldots,2b\}:j\neq i,\tilde{y}_{j}=\tilde{y}_{i},\tilde{e}_{j}=\tilde{e}_{i}\}$ 로, 라벨과 도메인이 모두 같은 샘플이다. 나머지는 모두 음성이다. 양성은 당기고 음성은 밀어서 도메인과 라벨 조합마다 촘촘한 덩어리가 생긴다.

### 3.3 정렬: PG-IRM

정렬 문제는 "전체 경계 하나가 도메인별 경계와 같아지려면 어떻게 해야 하나"로 바뀐다. 저자들은 이를 IRM(Invariant Risk Minimization)으로 정리한다. IRM은 특징 $\phi$ 와 전체 경계 $\beta^{*}$ 를 함께 최적화하되, $\beta^{*}$ 가 각 도메인에서도 최적이어야 한다는 제약을 건다.

$$
\begin{aligned}
&\min_{\phi,\beta^{*}}\frac{1}{|\mathcal{E}|}\sum_{e\in\mathcal{E}}\mathcal{R}^{e}(\phi,\beta^{*})\rightarrow\mathcal{L}_{\textit{IRM}}\\
&\textit{s.t.}\quad\beta^{*}\in\underset{\beta}{\arg\min}\mathcal{R}^{e}(\phi,\beta),\forall e\in\mathcal{E}.
\end{aligned}
$$

도메인별 최적 경계를 $\beta_{e}\in{\arg\min}_{\beta}\mathcal{R}^{e}(\phi,\beta)$ 라 하면, 제약이 성립할 충분조건은 $\beta_{e^{(1)}}=\cdots=\beta_{e^{(E)}}=\beta^{*}$ 이다. 그런데 IRM은 이중 최적화 구조라서 풀기 어렵다고 알려져 있다.

저자들은 projected gradient로 푸는 PG-IRM을 제안한다. 정리 1에 따르면 모든 $\alpha\in(0,1)$ 에서 IRM 목표는 아래 목표와 같다(증명은 원문 부록 A.1).

$$
\begin{aligned}
&\min_{\phi,\beta_{e^{(1)}},\cdots,\beta_{e^{(E)}}}\frac{1}{|\mathcal{E}|}\sum_{e\in\mathcal{E}}\mathcal{R}^{e}(\phi,\beta_{e})\rightarrow\mathcal{L}_{\textit{align}}\\
&\text{ s.t. }\forall e\in\mathcal{E},\exists\beta_{e}\in\Omega_{e}(\phi),\beta_{e}\in\Upsilon_{\alpha}(\beta_{e}),
\end{aligned}
$$

각 도메인의 제약 집합은 $\Omega_{e}(\phi)=\underset{\beta}{\arg\min}\mathcal{R}^{e}(\phi,\beta)$ 이고, $\alpha$-인접 집합은 다음과 같이 정의한다.

$$
\begin{aligned}
\Upsilon_{\alpha}(\beta_{e})=\{\upsilon|&\underset{e^{\prime}\in\mathcal{E}\backslash e}{\max}\ \underset{\beta_{e^{\prime}}\in\Omega_{e^{\prime}}(\phi)}{\min}\|\upsilon-\beta_{e^{\prime}}\|_{2}\\
&\leq\alpha\underset{e^{\prime}\in\mathcal{E}\backslash e}{\max}\ \underset{\beta_{e^{\prime}}\in\Omega_{e^{\prime}}(\phi)}{\min}\|\beta_{e}-\beta_{e^{\prime}}\|_{2}\}
\end{aligned}
$$

말로 풀면 PG-IRM의 핵심은 두 가지다.

1. 경계를 여러 개 최적화한다. 학습 중간 단계의 특징 공간에서는 모든 도메인을 동시에 만족하는 $\beta^{*}$ 가 없을 수 있다. 그러면 기존 IRM은 최적화가 막힌다. 도메인마다 경계 $\beta_{e^{(1)}},\ldots,\beta_{e^{(E)}}$ 를 따로 두면 해가 항상 있다.
2. 경계끼리 가까워지게 민다. 각 도메인 경계를 다른 경계 쪽으로 보간해 업데이트한다. 수학적으로 보면 경계를 $\Upsilon_{\alpha}(\beta_{e})$ 로 사영하는 일이다.

부록 A.2의 보조정리 2에 따르면 이 사영은 $\beta_{e}$ 와 가장 먼 경계 $\beta_{\bar{e}}$ 사이의 선형 보간과 같다.

$$
P_{\Upsilon_{\alpha}(\beta_{e})}(\beta_{e})=\alpha\beta_{e}+(1-\alpha)\beta_{\bar{e}},
$$

가장 먼 경계는 $\bar{e}=\underset{e^{\prime}\in\mathcal{E}\backslash e}{\text{argmax}}\|\beta_{e}-\beta_{e^{\prime}}\|_{2}$ 로 고른다. 기존 IRM의 제약 집합은 비어 있을 수 있어 사영 자체가 안 된다. 반면 $\Upsilon_{\alpha}(\beta_{e})$ 는 비어 있지 않으니 단순한 선형 보간으로 언제든 사영할 수 있다.

실제 업데이트는 경사 하강 한 걸음 뒤에 보간을 거는 방식이다(원문 부록 A.2).

$$
\tilde{\beta}^{t+1}_{e}=\beta^{t}_{e}-\gamma\nabla_{\beta^{t}_{e}}\mathcal{L}_{\textit{PG-IRM}}.
$$

$$
\beta_{e}^{t+1}=\alpha^{\prime}\beta_{e}^{t+1}+\left(1-\alpha^{\prime}\right)\beta_{\bar{e}},
$$

$$
\alpha^{\prime}:=1-\mathbf{1}_{t>T_{a}}(1-\alpha)
$$

처음 $T_{a}$ epoch 동안은 $\alpha^{\prime}=1$ 이라 보간 없이 보통의 경사 하강만 한다. 도메인별 경계가 먼저 각자의 최적점 근처에 가도록 하려는 것이다. 그 뒤에는 $\alpha^{\prime}=\alpha$ 로 사영이 걸린다. 학습이 진행되면 도메인별 경계가 서로 가까워지고 특징 공간도 함께 바뀐다. 수렴하면 $\beta_{e^{(1)}},\beta_{e^{(2)}},\beta_{e^{(3)}}$ 가 거의 같아진다.

### 3.4 학습과 추론

전체 목표는 정렬 손실에 분리 손실을 계수 $\lambda$ 로 더한 것이고, 제약은 PG-IRM과 같다.

$$
\begin{aligned}
&\min_{\phi,\beta_{e^{(1)}},\cdots,\beta_{e^{(E)}}}\mathcal{L}_{\textit{{align}}}+\lambda\mathcal{L}_{\textit{sep}}\quad\rightarrow\mathcal{L}_{\textit{all}}\\
&\text{ s.t. }\forall e\in\mathcal{E},\exists\beta_{e}\in\Omega_{e}(\phi),\beta_{e}\in\Upsilon_{\alpha}(\beta_{e}),
\end{aligned}
$$

추론 때는 도메인별 경계의 평균으로 점수를 낸다.

$$
f(\mathbf{x})=\mathbb{E}_{e\in\mathcal{E}}[\beta_{e}^{T}\phi(\mathbf{x})].
$$

수렴 후에는 어느 두 경계 사이의 코사인 값도 1에 아주 가깝다고 저자들은 확인했다(원문 부록 C).

## 4. 실험 설정

| 항목 | 내용 |
| --- | --- |
| 데이터셋 | Oulu-NPU(O), CASIA(C), Idiap Replay attack(I), MSU-MFSD(M) |
| 평가 방식 | 데이터셋 하나를 하나의 도메인으로 보고, 하나를 평가용으로 빼고 나머지 셋으로 학습 (과제 4개) |
| 전처리 | MTCNN으로 얼굴을 잘라 256x256으로 조정 |
| 백본 | ResNet-18 (비교 대상 SoTA와 같은 백본) |
| 최적화 | SGD, 초기 학습률 5e-3, epoch 40과 80에서 2로 나눔, 총 100 epoch |
| O 평가 예외 | 학습 데이터가 적어 300 epoch, 120과 240에서 감소 |
| 기타 | weight decay 5e-4, 학습 도메인마다 배치 96 |
| SA-FAS 하이퍼파라미터 | $\alpha=0.995$, $\lambda=0.1$, $T_{a}=20$ |
| 지표 | HTER(낮을수록 좋음), AUC(높을수록 좋음), TPR95(FPR 5%에서의 TPR, 높을수록 좋음) |

## 5. 주요 결과

### 5.1 기존 방법과 비교 (원문 표 1)

관례대로 테스트 오차가 가장 낮은 시점의 성능을 적은 표다. "M 평가"는 O, C, I로 학습하고 M으로 평가했다는 뜻이다. 단위는 %.

| 방법 | M 평가 HTER | M 평가 AUC | C 평가 HTER | C 평가 AUC | I 평가 HTER | I 평가 AUC | O 평가 HTER | O 평가 AUC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MMD-AAE | 27.08 | 83.19 | 44.59 | 58.29 | 31.58 | 75.18 | 40.98 | 63.08 |
| MADDG | 17.69 | 88.06 | 24.50 | 84.51 | 22.19 | 84.99 | 27.98 | 80.02 |
| SSDG-M | 16.67 | 90.47 | 23.11 | 85.45 | 18.21 | 94.61 | 25.17 | 81.83 |
| DR-MD-Net | 17.02 | 90.10 | 19.68 | 87.43 | 20.87 | 86.72 | 25.02 | 81.47 |
| RFMeta | 13.89 | 93.98 | 20.27 | 88.16 | 17.30 | 90.48 | 16.45 | 91.16 |
| NAS-FAS | 19.53 | 88.63 | 16.54 | 90.18 | 14.51 | 93.84 | 13.80 | 93.43 |
| D2AM | 12.70 | 95.66 | 20.98 | 85.58 | 15.43 | 91.22 | 15.27 | 90.87 |
| SDA | 15.40 | 91.80 | 24.50 | 84.40 | 15.60 | 90.10 | 23.10 | 84.30 |
| DRDG | 12.43 | 95.81 | 19.05 | 88.79 | 15.56 | 91.79 | 15.63 | 91.75 |
| ANRL | 10.83 | 96.75 | 17.83 | 89.26 | 16.03 | 91.04 | 15.67 | 91.90 |
| SSAN-M | 10.42 | 94.76 | 16.47 | 90.81 | 14.00 | 94.58 | 19.51 | 88.17 |
| SSDG-R | 7.38 | 97.17 | 10.44 | 95.94 | 11.71 | 96.59 | 15.61 | 91.54 |
| SSAN-R | 6.67 | 98.75 | 10.00 | 96.67 | 8.88 | 96.79 | 13.72 | 93.63 |
| PatchNet | 7.10 | 98.46 | 11.33 | 94.58 | 13.40 | 95.67 | 11.82 | 95.07 |
| SA-FAS | 5.95 | 96.55 | 8.78 | 95.37 | 6.58 | 97.54 | 10.00 | 96.23 |

![[논문 노트/첨부/SA-FAS/result-hter.png]]
*원문 표 1의 HTER를 막대그래프로 다시 그렸다.*

HTER는 네 과제 모두 SA-FAS가 가장 낮다. I 평가에서는 가장 좋은 기준선(SSAN-R)보다 HTER가 2.30% 낮은데, 저자들은 25% 넘는 개선이라고 적었다. AUC는 M 평가와 C 평가에서 SSAN-R이나 SSDG-R이 더 높다.

### 5.2 수렴 뒤 성능으로 비교 (원문 표 2)

표 1은 테스트 오차가 가장 낮은 학습 시점(예: epoch 16)의 성능을 적는 관례를 따랐다. 저자들은 이 관례에 문제를 제기한다. 테스트 성능은 학습 중에 크게 흔들리고, 테스트 도메인 정보가 없으면 그 시점을 고를 방법도 없다. 그래서 수렴 후 마지막 10 epoch의 평균과 표준편차를 따로 보고했다. 멈추는 기준은 진짜/위조 이진 분류 손실이 10 epoch 연속 1e-3보다 작거나 최대 epoch에 이르는 것 중 먼저 오는 쪽이다.

| 방법 | M 평가 HTER / AUC / TPR95 | C 평가 HTER / AUC / TPR95 | I 평가 HTER / AUC / TPR95 | O 평가 HTER / AUC / TPR95 |
| --- | --- | --- | --- | --- |
| SSDG-R | 14.65 ± 1.21 / 91.93 ± 1.35 / 53.68 ± 2.56 | 28.76 ± 0.89 / 80.91 ± 1.10 / 41.47 ± 2.68 | 22.84 ± 1.14 / 78.67 ± 1.31 / 50.80 ± 5.95 | 15.83 ± 1.29 / 92.13 ± 0.96 / 66.54 ± 4.00 |
| SSAN-R | 21.79 ± 3.68 / 84.06 ± 3.78 / 51.91 ± 4.28 | 26.44 ± 2.91 / 78.84 ± 2.83 / 45.36 ± 4.29 | 35.39 ± 8.04 / 70.13 ± 9.03 / 64.00 ± 2.70 | 25.72 ± 3.74 / 79.37 ± 4.69 / 36.75 ± 5.19 |
| PatchNet | 25.92 ± 1.13 / 83.43 ± 0.87 / 38.75 ± 8.31 | 36.26 ± 1.98 / 71.38 ± 1.89 / 19.22 ± 3.85 | 29.75 ± 2.76 / 80.53 ± 1.35 / 54.25 ± 2.18 | 23.49 ± 1.80 / 84.62 ± 1.92 / 39.39 ± 6.83 |
| SA-FAS | 14.36 ± 1.10 / 92.06 ± 0.53 / 55.71 ± 4.82 | 19.40 ± 0.66 / 88.69 ± 0.67 / 50.53 ± 3.60 | 11.48 ± 1.10 / 95.74 ± 0.55 / 77.05 ± 3.26 | 11.29 ± 0.32 / 95.23 ± 0.24 / 73.38 ± 1.64 |

저자들이 짚은 점은 세 가지다.

- 모든 방법의 숫자가 표 1보다 훨씬 나쁘다. 가장 좋은 시점을 고르는 방식에 운이 많이 섞여 있다는 뜻이다. 교차 도메인 FAS가 생각보다 덜 풀린 문제라는 뜻이기도 하다.
- 적대 손실을 쓰는 SSAN-R은 표준편차가 큰 편이다. 적대 손실이 학습을 불안정하게 만들 수 있다고 저자들은 본다.
- 이 설정에서도 SA-FAS가 가장 좋고, 표준편차도 가장 작다.

### 5.3 손실 구성 요소 (원문 표 3)

네 과제 평균이다. 위쪽은 분리 손실을 바꾼 것이고(분류는 모두 ERM), 아래쪽은 정렬 방식을 바꾼 것이다. SupCon (SSDG)는 SSDG처럼 진짜는 모든 도메인을 한 덩어리로, 위조는 도메인마다 따로 묶은 SupCon이다.

| 방법 | 평균 HTER | 평균 AUC | 평균 TPR95 |
| --- | --- | --- | --- |
| SimCLR | 22.53 ± 1.31 | 84.42 ± 1.04 | 51.14 ± 3.44 |
| SimSiam | 18.89 ± 0.97 | 89.93 ± 0.80 | 56.62 ± 2.88 |
| Triplet | 18.75 ± 2.31 | 88.11 ± 2.30 | 50.53 ± 8.76 |
| SupCon (SSDG) | 17.91 ± 1.05 | 90.10 ± 0.68 | 61.98 ± 2.87 |
| SupCon | 17.03 ± 1.73 | 90.68 ± 1.29 | 56.72 ± 5.06 |
| ERM | 17.22 ± 1.26 | 90.21 ± 1.38 | 58.62 ± 3.77 |
| DANN | 17.93 ± 1.02 | 90.66 ± 0.56 | 58.66 ± 3.14 |
| IRM-v1 | 17.41 ± 0.77 | 91.16 ± 0.52 | 60.98 ± 2.10 |
| VREx | 25.02 ± 1.92 | 80.65 ± 2.20 | 45.12 ± 3.78 |
| IB-IRM | 17.57 ± 0.74 | 91.71 ± 0.51 | 62.16 ± 2.35 |
| PG-IRM | 15.58 ± 0.96 | 92.03 ± 0.62 | 63.31 ± 2.59 |
| SA-FAS | 14.25 ± 0.79 | 92.93 ± 0.49 | 64.16 ± 3.33 |

분리 손실 가운데서는 도메인별로 나눈 SupCon이 HTER가 가장 낮다. 정렬 쪽에서는 IRM을 아래 같은 라그랑주 벌점 형태로 바꿔 푸는 IRM-v1, IB-IRM, VREx보다 PG-IRM이 낫다.

$$
\min_{\phi,\beta^{*}}\frac{1}{|\mathcal{E}|}\sum_{e\in\mathcal{E}}\left[\mathcal{R}^{e}(\phi,\beta^{*})+\lambda\left\|\nabla_{\beta^{*}}\mathcal{R}^{e}(\phi,\beta^{*})\right\|_{2}^{2}\right].
$$
 저자들은 이 결과를 벌점 항 방식이 비선형 상황에서 잘 듣지 않는다는 근거로 든다. 둘을 함께 쓴 SA-FAS가 세 지표 모두에서 가장 좋다.

### 5.4 분리와 정렬이 정말 성능과 관련 있나

저자들은 테스트 도메인 특징으로 두 점수를 정의했다. 분리 점수는 진짜 특징 중심과 위조 특징 중심 사이의 코사인으로 잰다. 둘이 잘 떨어질수록 코사인이 작아져 점수가 커진다.

$$
S_{sep}=1-\cos(\mathbb{E}_{spoof}[\mathbf{z}],\mathbb{E}_{live}[\mathbf{z}]),
$$

정렬 점수는 두 중심을 잇는 벡터를 정답 방향(oracle vector)으로 보고, 도메인별 경계 $\beta_{e}$ 가 그 방향과 얼마나 가까운지 잰다.

$$
S_{align}=\mathbb{E}_{e\in\mathcal{E}}[\cos(\beta_{e},\mathbb{E}_{spoof}[\mathbf{z}]-\mathbb{E}_{live}[\mathbf{z}])]
$$

학습 중 여러 시점을 점으로 찍어 보면 두 점수 모두 테스트 AUC와 양의 상관을 보였다(원문 그림 5). PG-IRM을 쓰면 정렬 점수와 AUC가 함께 올랐고, SupCon을 쓰면 분리 점수가 올라 분류에 도움이 됐다.

![[논문 노트/첨부/SA-FAS/fig6-umap.png]]
*원문 그림 6. SA-FAS로 학습한 ResNet-18 끝에서 두 번째 층 특징의 UMAP. 점선은 학습 샘플로 구한 결정 경계다. 출처: Sun et al., CVPR 2023*

UMAP으로 보면 진짜와 위조를 가르는 경계가 학습 도메인 전체에서 일관되고, 처음 보는 도메인에도 그대로 통한다. C 평가에서는 CASIA 샘플 일부가 고해상도인 OULU 쪽에, 일부는 저해상도인 MSU나 REPLAY 쪽에 놓였다. CASIA에 저해상도와 고해상도 이미지가 섞여 있다는 사실과 맞는다. 도메인 차이(해상도)가 경계와 상관없는 방향으로 드러난 셈이다.

비교 삼아 DANN과 SSDG의 특징 공간도 그렸다(원문 그림 7, C 평가). DANN은 특히 테스트 도메인에서 도메인 차이가 여전히 넓게 남았다. SSDG는 학습과 테스트에서 위조로 가는 방향이 DANN보다는 잘 맞았지만, 진짜 학습 샘플 사이에도 도메인 차이가 남아 있었다.

### 5.5 하이퍼파라미터 민감도 (원문 부록 D)

학습률과 정렬 시작 epoch $T_{a}$ 는 주어진 범위 안에서 HTER 차이가 최대 1.2%로 크지 않았다. $\alpha$ 는 더 중요하다. $\alpha=0$ 이면 $T_{a}$ 이후 ERM과 같아지고, $\alpha=1$ 이면 도메인별 경계가 끝내 맞춰지지 않는다.

## 6. 강점과 한계

**강점**

- "도메인 신호를 지운다"는 기존 흐름을 뒤집고, 지우지 않고 남겨 둔 채 경계만 맞추자는 관점을 냈다.
- 다루기 어렵다고 알려진 IRM을 projected gradient로 풀고, 그 목표가 원래 IRM과 같다는 증명을 붙였다. 실제 연산은 도메인별 경계를 가장 먼 경계 쪽으로 선형 보간하는 것이라 단순하다.
- 가장 좋은 시점 대신 수렴 후 마지막 10 epoch 평균으로도 비교해, 성능이 운에 덜 기대도록 했다. 이 설정에서도 가장 좋고 가장 안정적이었다.
- 분리 점수와 정렬 점수를 정의해 두 성질과 성능의 관계를 따로 확인했다.
- 코드가 공개되어 있다.

**한계와 확인할 점**

- 저자들이 밝힌 한계 하나는 각 도메인에 진짜와 위조가 모두 있어야 한다는 점이다. 도메인 A에는 진짜만, 도메인 B에는 위조만 있는 학습 데이터는 다룰 수 없다.
- 또 하나는 도메인마다 경계를 하나씩 두므로 도메인 수가 아주 많으면 계산이 늘어난다는 점이다.
- 정렬 가정은 비슷한 공격 종류를 전제로 한다. 논문은 인쇄와 재생 공격에 한정했고, 3D 마스크 같은 다른 공격은 실험하지 않았다.
- 실험은 OCIM 네 데이터셋에서만 했고, "도메인"은 곧 "데이터셋"이다.
- SupCon의 온도 $\tau$ 값은 본문에 적혀 있지 않다.

## 7. 용어 정리

| 용어 | 뜻 |
| --- | --- |
| FAS (Face Anti-Spoofing) | 카메라 앞 얼굴이 진짜 사람인지, 사진이나 영상, 마스크 같은 위조인지 가려내는 일 |
| 교차 도메인 FAS | 학습 때 보지 못한 데이터셋(도메인)에서도 통하는 FAS를 만드는 문제 |
| ERM | 모든 학습 데이터를 합쳐 평균 오차를 줄이는 보통의 학습 방식 |
| IRM | 도메인마다 따로 봐도 같은 분류기가 최적이 되도록 특징과 분류기를 함께 배우는 방식 |
| SupCon | 라벨이 같은 샘플은 당기고 다른 샘플은 미는 지도 대조 학습 |
| projected gradient | 경사 하강으로 한 걸음 간 뒤, 허용되는 집합 안으로 다시 사영하는 최적화 방법 |
| HTER | 진짜를 위조로 본 비율과 위조를 진짜로 본 비율의 평균. 낮을수록 좋다 |
| TPR95 | 위양성률(FPR)이 5%일 때의 참양성률. 실제 쓰임에 가까운 지표 |
| UMAP | 고차원 특징을 2차원으로 줄여 보여 주는 시각화 방법 |

## 함께 읽으면 좋은 논문

- [[SSDG 논문 정리 (arXiv 2004.14043)|SSDG]]: SA-FAS가 직접 비교하고 비판한 방법이다. 진짜는 한 덩어리로 모으고 위조만 흩어 두는 SSDG와, 도메인을 모두 나눠 두는 SA-FAS를 나란히 보면 차이가 잘 보인다.
- [[IADG 논문 정리 (arXiv 2304.05640)|IADG]]: 같은 교차 도메인 FAS 문제를 다룬 논문이다.
- [[FLIP 논문 정리 (arXiv 2309.16649)|FLIP]]: 같은 교차 도메인 FAS 문제를 다룬 논문이다.
- [[CFPL-FAS 논문 정리 (arXiv 2403.14333)|CFPL-FAS]]: 같은 문제를 다루는 교차 도메인 FAS 논문이다.
- [[I-FAS 논문 정리 (arXiv 2501.01720)|I-FAS]]: 같은 OCIM 평가를 쓰면서 멀티모달 LLM으로 FAS를 다룬 논문이다.

## 출처

- Yiyou Sun, Yaojie Liu, Xiaoming Liu, Yixuan Li, Wen-Sheng Chu. Rethinking Domain Generalization for Face Anti-spoofing: Separability and Alignment. CVPR 2023. [arXiv 2303.13662](https://arxiv.org/abs/2303.13662)
- 공식 코드: [github.com/sunyiyou/SAFAS](https://github.com/sunyiyou/SAFAS)
- 그림 2, 그림 6은 원문에서 인용했다(arXiv 비독점 배포 라이선스). 개념도와 막대그래프는 원문 내용을 바탕으로 직접 그렸다.
