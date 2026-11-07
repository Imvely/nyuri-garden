---
paper: "VFlash: Fast, Accurate Visual Planning via Flash Primitive Decoding"
arxiv: "2611.08449"
url: https://arxiv.org/abs/2611.08449
authors: [Yu-Cheng Chou, Shihao Wang, Jin Huang, Chi-Pin Huang, Chiao-An Yang, Xianzhe Fan, Jing Wang, Zhiqi Li, Yuanguo Kuang, Ruijie Zheng, Johan Bjorck, Sifei Liu, Hang Su, Abhishek Badki, Lei Zhang, Alan Yuille, Linxi "Jim" Fan, Jan Kautz, Zhiding Yu]
affiliation: NVIDIA (Hugging Face 논문 페이지의 조직과 프로젝트 페이지 기준)
venue: arXiv 프리프린트
published: 2026-11-05
code: https://github.com/NVlabs/Eagle/tree/main/Embodied
tags: [논문, 피지컬AI, 로보틱스, 디코딩]
created: 2026-11-07
status: 정리완료
publish: true
summary: 로봇과 자율주행 모델이 내는 궤적과 박스의 모양을 미리 알면 좌표를 한 번에 예측할 수 있다는 생각으로, 계획 생성을 빠르고 더 정확하게 만든 NVIDIA 논문이에요.
title: "VFlash: 모양을 아는 시각 계획은 여러 칸을 한 번에 채운다"
---
> [!abstract] 한 줄 요약
> 로봇용 VLM은 궤적과 박스를 좌표 토큰 하나씩 생성해서, 계획이 자세할수록 느려진다. VFlash는 도구 호출로 계획의 종류와 길이를 먼저 정하고, 작은 드래프터가 그 모양 전체를 한 번의 순전파로 채운다. 대상 모델과 토큰이 같은지 확인하지 않고 모양만 맞으면 받아들이는데, 3D 궤적 오차는 오히려 대상 모델보다 18~61% 줄었다.

![[논문 노트/첨부/VFlash/VFlash 마인드맵.png]]

> [!tip] 마인드맵 크게 보기
> <a href="https://imvely.github.io/nyuri-garden/static/viewer.html?src=%EB%85%BC%EB%AC%B8-%EB%85%B8%ED%8A%B8/%EC%B2%A8%EB%B6%80/vflash/vflash-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.svg&fallback=%EB%85%BC%EB%AC%B8-%EB%85%B8%ED%8A%B8/%EC%B2%A8%EB%B6%80/vflash/vflash-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5.png&back=%EB%85%BC%EB%AC%B8-%EB%85%B8%ED%8A%B8/vflash-%EB%85%BC%EB%AC%B8-%EC%A0%95%EB%A6%AC-%28arxiv-2611.08449%29&title=VFlash%20%EB%A7%88%EC%9D%B8%EB%93%9C%EB%A7%B5" target="_blank" rel="noopener" data-router-ignore>크게 열어 보기</a>
*문제, 핵심 아이디어, 학습, 정확도, 속도, 한계를 한 장에 모은 마인드맵.*

| 항목 | 내용 |
|---|---|
| 제목 | VFlash: Fast, Accurate Visual Planning via Flash Primitive Decoding |
| 저자 | Yu-Cheng Chou 외 18명 (Linxi "Jim" Fan, Jan Kautz, Zhiding Yu 등) |
| 소속 | NVIDIA |
| 공개 | arXiv 2026년 11월 5일 (v1) |
| 코드 | NVlabs/Eagle 저장소의 Embodied 폴더. 학습과 평가 코드는 공개, 모델 체크포인트는 아직 공개 전(2026-11-07 확인) |
| 원문 라이선스 | arXiv 비독점 배포 라이선스 |

## 1. 어떤 문제를 푸나

로봇과 자율주행에 쓰는 VLM은 생각을 글로만 내지 않는다. 물체 위치는 점과 박스로, 팔이나 차가 갈 길은 궤적으로 낸다. 원문은 이것을 시각 계획(visual plan)이라 부르고, 점, 박스, 궤적 하나하나를 시각 기본 단위(visual primitive)라고 부른다.

문제는 속도다. 자기회귀 VLM은 좌표 토큰을 하나씩 생성한다. 궤적이 길어지거나 물체가 늘거나 2D와 3D 좌표를 함께 내면 토큰 수만큼 모델을 더 돌려야 한다. 로봇은 배치 하나로 새 관찰이 들어올 때마다 계획을 다시 내야 해서, 정해진 지연 시간 안에서는 계획을 자세하게 만들기 어렵다.

기존 투기적 디코딩(speculative decoding)은 작은 모델이 초안을 내고 대상 모델이 토큰 단위로 맞는지 확인한다. 그런데 좌표 하나가 대상 모델의 선택과 한 칸만 달라도 거기서 받아들이기가 끊긴다. 원문 측정에서 DFlash는 글에서는 한 번에 5.5토큰을 받아들였지만 궤적 안에서는 2.2토큰에 그쳤다.

## 2. 핵심 아이디어

![[논문 노트/첨부/VFlash/concept-flash-primitive.png]]
*개념도. 자기회귀 디코딩은 좌표 칸마다 모델을 한 번 돌리고, VFlash는 모양이 정해진 칸 전체를 한 번에 채운 뒤 대상 모델로 한 번 확인한다. 원문 2.2절과 그림 2를 보고 직접 그렸다.*

시각 기본 단위는 모양이 정해져 있다. 박스는 좌표 네 개이고, 점 10개짜리 2D+3D 궤적은 칸 수가 정해진다. 종류와 길이를 알면 각 칸이 무슨 좌표인지 디코딩 전에 알 수 있다.

VFlash는 이 점을 이용한다. 모델이 도구 호출로 "2D+3D 궤적, 점 10개"처럼 출력 모양을 먼저 선언하면, 그 모양에 맞춘 칸 묶음 전체를 가벼운 드래프터가 한 번의 순전파로 예측한다. 예측이 모양 규칙을 지키면 대상 모델과 토큰이 같은지 따지지 않고 통째로 받아들인다.

원문이 흥미롭다고 꼽은 관찰도 여기서 나온다. 드래프터를 대상 모델의 출력이 아니라 정답 좌표로 학습시키면, 빠를 뿐 아니라 대상 모델보다 공간 정확도가 높아진다. 원문은 이것을 근거로 시각 출력에서는 자기회귀 디코딩이 품질의 상한일 필요가 없다고 말한다.

## 3. 방법

![[논문 노트/첨부/VFlash/fig2-fpd.png]]
*원문 그림 2. 시각 기본 단위 시작 토큰이 나오면 도구 호출이 정한 길이의 칸 묶음을 VFlash가 한 번에 채운다. 출처: Chou et al., arXiv 2611.08449 (2026)*

**바탕이 된 DFlash.** 투기적 디코딩에서 드래프트 모델 $q_{\phi}$ 가 토큰 $\gamma$ 개를 제안하고 대상 모델 $p_{\theta}$ 가 한꺼번에 확인한다. 토큰 하나당 평균 지연은 다음과 같다. $\tau$ 는 한 번에 받아들이는 토큰 수의 기댓값이다.

$$
L=\frac{T_{\mathrm{draft}}+T_{\mathrm{verify}}}{\tau}
$$

기존 방식은 대상 모델의 탐욕 선택과 처음 어긋나는 곳까지만 받아들인다.

$$
\tau_{\mathrm{ver}}=1+\max\Big\{k\leq\gamma:\;a_{j}=\operatorname{argmax}_{v}\,p_{\theta}\!\left(v\mid x,a_{<j}\right)\ \text{for all}\ j\leq k\Big\}
$$

**칸 묶음 전체를 한 번에.** 모양 $s$ 가 정하는 길이 $B(s)$ 의 칸 묶음에서, 드래프터는 대상 모델 특징 $H_{\theta}(x)$ 와 시작 토큰 $a_0$ 을 받아 나머지 칸을 서로 조건부 독립으로 한 번에 예측한다.

$$
q_{\phi}\!\left(a_{1:B(s)-1}\mid H_{\theta}(x),a_{0}\right)=\prod_{j=1}^{B(s)-1}q_{\phi,j}\!\left(a_{j}\mid H_{\theta}(x),a_{0},\mathrm{MASK}^{B(s)-1}\right)
$$

**받아들이는 규칙.** 예측 $\hat{a}$ 가 검사 $A_s$ 를 통과하면 칸 전체를 받아들인다. 검사는 모양 규칙 검사이고, 박스에는 LocateAnything의 공간 확신도 검사를 더한다. 통과하지 못하면 앞의 $r$ 칸만 남기고 나머지를 대상 모델이 제약 디코딩으로 다시 만든다(궤적은 $r=0$).

$$
\tau_{\mathrm{dir}}=\begin{cases}B(s),&A_{s}(\hat{a})=1,\\
1+r,&\text{otherwise}\end{cases}
$$

그래서 받아들여진 기본 단위 하나의 토큰당 비용은 드래프터 한 번과 대상 모델 한 번을 칸 수로 나눈 값이 된다. 칸이 늘어도 순차 단계 수는 늘지 않는다.

$$
L_{\mathrm{dir}}=\frac{t_{\mathrm{par}}+t_{\mathrm{target}}}{B(s)}
$$

**좌표 표현.** 칸마다 역할이 고정되려면 좌표 하나가 차지하는 칸 수가 일정해야 한다. 원문의 기본 모델은 좌표마다 1,001개 특수 토큰 중 하나를 쓴다. 좌표를 보통 숫자 글자로 쓰는 모델에는 부호 한 칸과 숫자 다섯 칸의 고정 폭 격자를 쓰고, 예측 뒤 원래 글 형식으로 되돌린다.

**학습.** 자기회귀 VLM을 공간 출력 형식에 맞게 먼저 미세 조정하고 얼린다. 그 위에 5층 드래프터(학습 파라미터 537M)를 학습한다. 라벨은 대상 모델의 출력이 아니라 정답 좌표다. 기본 단위 칸에는 같은 가중치를 주고, 글 칸에는 DFlash처럼 앞쪽에 큰 가중치를 준다. 드래프터 하나가 검증하는 글 경로와 바로 받아들이는 좌표 경로를 모두 맡는다.

## 4. 실험 설정

| 항목 | 내용 |
|---|---|
| 기본 VLM | Qwen3-4B 디코더, MoonViT 비전 인코더, MLP 연결. 좌표는 특수 토큰 |
| 점 운동 예측 대상 | 공개된 MolmoMotion-AR(좌표를 숫자 글자로 씀). 대상 모델은 그대로 두고 드래프터만 학습 |
| 드래프터 | DFlash 구조를 따른 5층 Qwen3 트랜스포머, 대상 모델 5개 층의 특징을 받음 |
| 2D 궤적 평가 | ShareRobot-Bench, VABench-V (DFD, HD, RMSE) |
| 3D 궤적 평가 | InternA1, AgiBot, MolmoBot (ADE, FDE 미터, 5cm와 10cm 안 비율) |
| 박스 평가 | COCO, Dense200 (IoU별 F1, 초당 박스 수) |
| 점 운동 예측 | PointMotionBench의 HOT3D, WorldTrack, DAVIS |
| 하위 작업 | MolmoSpaces 조작(월드 액션 모델), LIBERO 계열, NAVSIM과 Waymo 주행 |
| 지연 시간 측정 | 배치 1, Jetson AGX Thor, DGX Spark, H100. TensorRT-Edge-LLM을 고친 런타임, FP16 |

## 5. 주요 결과

**3D 궤적.** 세 데이터셋 모두에서 네 지표가 좋아졌다. ADE는 3D만 내는 모델에서 18~49%, 2D와 3D를 함께 내는 모델에서 28~61% 줄었다. 자기회귀 모델은 2D와 3D를 같이 내면 3D 오차가 15~51% 커졌지만, VFlash는 두 부분을 한 번에 예측해서 오차가 거의 그대로였다.

| 출력 형식 | 디코더 | InternA1 ADE | AgiBot ADE | AgiBot 5cm 안 비율 | MolmoBot ADE |
|---|---|---|---|---|---|
| 3D만 | AR | 0.101 | 0.083 | 0.503 | 0.066 |
| 3D만 | VFlash | 0.065 | 0.042 | 0.731 | 0.054 |
| 2D+3D | AR | 0.153 | 0.105 | 0.398 | 0.076 |
| 2D+3D | VFlash | 0.062 | 0.041 | 0.739 | 0.055 |
| 2D+3D, 손목 카메라 학습 | AR | 0.130 | 0.084 | 0.456 | 0.066 |
| 2D+3D, 손목 카메라 학습 | VFlash | 0.060 | 0.036 | 0.794 | 0.052 |

![[논문 노트/첨부/VFlash/result-3d-ade.png]]
*직접 그린 그래프. 원문 표 4의 3D 궤적 평균 변위 오차(ADE). 빈 점이 자기회귀, 찬 점이 VFlash다.*

**2D 궤적.** 같은 4B 대상 모델과 디코더만 바꿔 비교했다. 여섯 오차가 모두 낮아졌고, 차이는 3~7%다.

| 방법 | ShareRobot DFD | ShareRobot HD | ShareRobot RMSE | VABench-V DFD | VABench-V HD | VABench-V RMSE |
|---|---|---|---|---|---|---|
| RoboBrain-2.0 (7B) | 0.167 | 0.158 | 0.125 | 0.329 | 0.260 | 0.224 |
| LoHo-Manip (4B) | 0.231 | 0.206 | 0.156 | 0.212 | 0.182 | 0.147 |
| AR (4B) | 0.202 | 0.175 | 0.142 | 0.130 | 0.125 | 0.093 |
| VFlash (4B) | 0.194 | 0.162 | 0.133 | 0.126 | 0.116 | 0.089 |

**박스.** 모양 규칙만 보고 모두 받아들이면 F1이 크게 떨어진다. 확신이 낮은 박스를 자기회귀로 다시 만드는 되돌리기를 쓰면 평균 F1이 AR과 비슷해지고, 초당 박스 수는 2.6~2.8배가 된다. IoU 0.95처럼 아주 정확한 박스에서는 AR보다 낮다.

| 방법 | 데이터셋 | 평균 F1 | F1(IoU 0.50) | F1(IoU 0.95) | 초당 박스 |
|---|---|---|---|---|---|
| AR | COCO | 48.68 | 65.29 | 16.09 | 3.15 |
| AR | Dense200 | 60.10 | 76.70 | 16.95 | 6.73 |
| VFlash(모두 받아들임) | COCO | 41.32 | 59.64 | 10.76 | 5.96 |
| VFlash(모두 받아들임) | Dense200 | 39.09 | 55.06 | 6.59 | 22.66 |
| VFlash(AR 되돌리기) | COCO | 47.79 | 66.38 | 13.48 | 8.76 |
| VFlash(AR 되돌리기) | Dense200 | 61.78 | 82.64 | 12.11 | 17.46 |

**점 운동 예측.** 결과가 섞여 있다. DAVIS에서는 ADE와 FDE가 27%, 19% 줄었지만, HOT3D ADE는 AR(0.109)이 VFlash(0.122)보다 낮고 WorldTrack FDE는 15% 커졌다. 대신 한 번 생성하는 시간이 H100에서 79.8~99.6초에서 3.21~3.86초로 줄어 약 25배 빨라졌다.

**로봇 조작(MolmoSpaces).** 같은 월드 액션 모델에 VFlash 계획을 넣으니 평균 성공률이 62.6%에서 70.2%가 됐다. 같은 계획을 자기회귀로 만들어 넣으면 61.0%로 기준보다도 낮았다.

| 방법 | 평균 | 집기 | 집어 놓기 | 열기 | 닫기 |
|---|---|---|---|---|---|
| PrimeR0 | 60.3 | 77.5 | 54.6 | 27.8 | 81.3 |
| 기준(원래 글 인코더) | 62.6 | 81.1 | 55.7 | 49.3 | 64.2 |
| VFlash 계획 | 70.2 | 83.6 | 67.3 | 52.8 | 77.0 |

LIBERO 계열에서는 기준 대비 이득이 LIBERO 0.8점, LIBERO-Plus 1.9점, LIBERO-PRO 6.8점으로, 교란이 큰 평가일수록 커졌다.

**자율주행.** VLM과 계획은 얼려 둔 채 작은 행동 헤드만 학습했다. NAVSIM PDMS는 지도 학습 87.1, 강화학습 90.7이고, Waymo RFS는 7.79와 7.86이다. NAVSIM 90.7은 표의 Qwen-Drive-1.0-RL과 같다.

**지연 시간.** 원문 그림 1에 Thor와 Spark 결과가 있다.

![[논문 노트/첨부/VFlash/fig1-overview.png]]
*원문 그림 1. 시각 계획의 모양, VFlash의 경로별 처리, Jetson Thor와 DGX Spark의 지연 시간과 3D 정확도. 출처: Chou et al., arXiv 2611.08449 (2026)*

MolmoSpaces 한 단계(전처리, 비전, 프리필, 디코딩, 행동 모델) 시간을 원문 표 11에서 옮겼다. 줄어든 시간은 거의 모두 디코딩에서 나왔다.

| 장비 | AR 전체 | DFlash 전체 | VFlash 전체 | AR 디코딩 | VFlash 디코딩 |
|---|---|---|---|---|---|
| Jetson Thor | 3,552.7ms | 1,828.4ms | 703.3ms | 3,107.6ms | 258.2ms |
| DGX Spark | 3,356.5ms | 1,809.2ms | 649.9ms | 2,950.9ms | 244.3ms |
| H100 | 516.1ms | 340.0ms | 142.3ms | 411.8ms | 38.0ms |

## 6. 강점과 한계

**강점**

- 속도와 정확도를 함께 올렸다. 3D 궤적에서는 대상 모델보다 오차가 낮고, 단계당 지연은 Thor와 Spark에서 5.1~5.2배 줄었다.
- 출력 모양만 정의하면 박스, 길이가 다른 궤적, 점 운동처럼 여러 형식에 같은 틀을 쓴다. 좌표를 특수 토큰으로 쓰든 숫자 글자로 쓰든 지원한다.
- 계획이 자세해져도 순차 단계 수가 늘지 않는다. Thor 주행에서 기본 단위가 36토큰에서 84토큰으로 늘어도 디코딩은 72~78ms였다.
- 대상 VLM을 얼린 채 드래프터만 붙이므로 기존 모델에 얹기 쉽다.

**한계와 확인할 점**

- 25배는 원문이 "예비 단일 롤아웃 측정"이라고 밝힌 값이다.
- 박스는 모두 받아들이면 Dense200 평균 F1이 약 20점 떨어진다. 되돌리기를 써야 AR과 비슷해지고, IoU 0.95에서는 여전히 낮다.
- 점 운동 예측에서는 일부 지표(HOT3D ADE, WorldTrack FDE, 세 데이터셋의 PWT)가 AR보다 나쁘다.
- MolmoSpaces의 AR 디코딩 시간은 출력 전용 엔진으로 따로 잰 예전 측정값이다(부록 E.1). VFlash 쪽은 행동 모델용 특징 계산까지 포함한다.
- 하위 작업 비교는 원문이 밝혔듯 점수를 끌어올리기보다 통제된 비교를 목표로 했다. 행동 모델 구조는 작업마다 다르다.
- 본문의 표 번호가 일부 어긋난다. 2D 궤적 결과를 "Table 3"으로, MolmoSpaces 결과를 "Table 7"로 가리키는데 실제 표는 2와 6이다.
- 2026년 11월 7일 기준으로 학습과 평가 코드는 공개됐지만 대상 모델과 드래프터 체크포인트는 공개 전이다.

## 7. 용어 정리

| 용어 | 뜻 |
|---|---|
| VLM | 이미지와 글을 함께 받아 글이나 좌표를 생성하는 모델 |
| 시각 계획 | 점, 박스, 궤적으로 표현한 공간 목표와 움직임 예측 |
| 시각 기본 단위 | 박스 하나, 궤적 하나처럼 경계와 좌표 배치가 정해진 출력 단위 |
| 자기회귀 디코딩 | 앞 토큰을 보고 다음 토큰 하나를 생성하는 방식 |
| 투기적 디코딩 | 작은 모델이 여러 토큰을 미리 내고 큰 모델이 한꺼번에 확인하는 가속 방식 |
| 드래프터 | 투기적 디코딩에서 초안을 내는 작은 모델 |
| 블록 디퓨전 드래프터 | 가려 둔 칸 여러 개를 한 번의 순전파로 채우는 드래프터(DFlash 방식) |
| ADE, FDE | 예측 궤적과 정답의 평균 거리, 마지막 점의 거리 |
| 월드 액션 모델 | 미래 장면 예측과 행동 생성을 함께 하는 로봇 정책 모델 |

## 함께 읽으면 좋은 논문

블로그에 같은 문제를 다룬 논문 노트는 아직 없다. 원문이 직접 바탕으로 삼은 연구는 DFlash(arXiv 2602.06036, 블록 디퓨전 드래프터)와 LocateAnything(박스 병렬 디코딩)이다.

## 출처

- 원문: [arXiv 2611.08449](https://arxiv.org/abs/2611.08449), [HTML판](https://arxiv.org/html/2611.08449v1)
- 프로젝트 페이지: [research.nvidia.com/labs/lpr/vflash](https://research.nvidia.com/labs/lpr/vflash/)
- 코드: [NVlabs/Eagle, Embodied 폴더](https://github.com/NVlabs/Eagle/tree/main/Embodied) (코드 Apache-2.0, 모델은 NVIDIA 라이선스)
- [Hugging Face 논문 페이지](https://huggingface.co/papers/2611.08449)
- 그림 출처: 원문 그림 1과 2는 Chou et al., arXiv 2611.08449 (2026), arXiv 비독점 배포 라이선스(nonexclusive-distrib 1.0). 개념도와 결과 그래프는 원문 설명과 표 4의 숫자로 직접 그렸다.
