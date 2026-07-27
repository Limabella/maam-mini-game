# 백기준 캐릭터 제작 명세서

## 목적

`백기준`은 Pedalrun의 메인 플레이어 캐릭터다. 단순한 임시 라이더가 아니라, 게임의 브랜드와 Web3 패션 시스템을 대표하는 고품질 캐릭터로 제작한다.

이 문서는 AI 콘셉트 이미지 제작, 3D 모델링, 리깅, Unity 적용, 추후 NFT/패션 파츠 확장을 한 번에 고려한 제작 기준이다.

## 핵심 방향

- 음식 배달 자전거 러너 게임의 주인공
- `100 Burger Family` 소속 배달 라이더
- 빠른 주행, 야간 배달, 도시형 라이프스타일 이미지
- 게임 내 카메라가 등 뒤와 측면을 자주 비추므로 상체, 등, 배달가방, 실루엣이 중요
- Web3 패션 시스템을 위해 의상/가방/장갑/헬멧/액세서리를 교체 가능한 구조로 설계

## 캐릭터 한 줄 설명

도시의 밤거리를 빠르게 가르는 `100 Burger Family`의 에이스 배달 라이더.

## 기본 프로필

- 이름: 백기준
- 역할: 플레이어 캐릭터, 메인 배달 라이더
- 소속: 100 Burger Family
- 직업 이미지: 버거 전문점 소속 프리미엄 배달 라이더
- 성격: 침착함, 집중력, 속도감, 책임감
- 키 기준: 약 `178cm`
- 체형: 슬림하지만 운동감 있는 라이더 체형
- 나이대: 20대 중후반

## 비주얼 키워드

- 야간 도시 배달
- 블랙 셰프 재킷
- 방수 라이더 팬츠
- 글러브
- 자전거 배달가방
- 따뜻한 버거샵 조명
- 젖은 도로 반사광
- 고급스러운 블랙/골드 포인트
- 빠른 속도감
- 프로페셔널 배달원

## 디자인 기준

### 얼굴

- 동양인 남성 캐릭터
- 선명한 눈매
- 집중한 표정이 잘 어울리는 얼굴
- 과장된 만화풍보다는 세미리얼 스타일
- 게임 카메라에서 얼굴이 크게 잡히지 않아도 정체성이 보이도록 헤어 실루엣을 명확히 제작

### 헤어

- 검은색 또는 아주 어두운 브라운
- 약간 젖은 듯한 질감
- 앞머리가 자연스럽게 흐르는 스타일
- 빠른 주행 시 실루엣이 무너지지 않도록 덩어리감 있는 헤어 메시 추천

### 상의

- 블랙 셰프 재킷 또는 배달 유니폼 재킷
- 가슴 부위에 `BAEK GIJUN` 네임 패치
- 소매 또는 어깨에 `100 Burger Family` 심볼 패치
- 소재는 방수 코팅된 천 느낌
- 골드/앰버 색상의 단추 또는 작은 장식 포인트

### 하의

- 블랙 라이더 팬츠
- 자전거 페달링에 방해되지 않는 슬림핏
- 무릎 부위에 약한 주름과 패널 디테일
- 발목 부분은 체인이나 페달에 걸리지 않는 형태

### 장갑

- 블랙 라이딩 글러브
- 손바닥/손등에 약한 패드 디테일
- 핸들 잡는 포즈에서 형태가 잘 보이도록 손가락 모델링 정리 필요

### 신발

- 블랙 라이딩 슈즈 또는 워커형 스니커즈
- 페달에 닿는 밑창 부분은 단순하고 안정적으로 제작
- 발 IK 적용 시 변형이 적도록 발목 형태를 명확히 구분

### 배달가방

- 등에 장착되는 대형 배달 박스
- 컬러: 블랙 베이스 + 골드 로고
- 전면 또는 측면에 `100 Burger Family` 로고
- 상단 스트랩, 측면 버클, 모서리 보호대 표현
- 게임 카메라에서 가장 자주 보이는 요소이므로 등쪽 실루엣을 우선 제작
- Web3 패션 파츠 중 가장 중요한 교체 대상

## 컬러 팔레트

| 항목 | 색상 | 용도 |
|---|---|---|
| Main Black | `#0B0A08` | 유니폼, 가방, 장갑 |
| Warm Gold | `#C78A3A` | 로고, 패치, 단추 |
| Burger Amber | `#F0A33A` | 포인트 조명, UI 연계 색 |
| Wet Gray | `#2B2B2B` | 팬츠, 보조 패널 |
| Skin Warm | `#D3A17B` | 피부 기준 |

## 모델링 품질 기준

### 권장 폴리곤

- MVP 고품질 캐릭터: `25k ~ 45k triangles`
- 모바일/WebGL 최적화 버전: `12k ~ 20k triangles`
- 얼굴/손/가방에 우선 배분
- 신발, 팬츠 하단, 내부 보이지 않는 면은 절감

### LOD 권장

- `LOD0`: 근접 카메라용, 25k ~ 45k tris
- `LOD1`: 일반 주행용, 12k ~ 20k tris
- `LOD2`: 원거리/저사양용, 5k ~ 8k tris

### 텍스처 권장

- 캐릭터 본체: `2048x2048`
- 얼굴/헤어: `2048x2048`
- 배달가방: `2048x2048`
- 모바일/WebGL 빌드에서는 `1024x1024` 압축 버전 별도 사용

### 머티리얼 수

- 권장: 3개 이하
- `Body`
- `FaceHair`
- `DeliveryBag`

머티리얼 수가 많아지면 WebGL/모바일 성능에 직접적인 부담이 생긴다.

## 리깅 기준

### Unity Rig Type

- `Humanoid` 우선
- Unity Avatar 매핑 가능해야 함
- 기존 Easy Bike System 라이더 교체를 위해 일반적인 Humanoid 본 구조 유지

### 필수 본

- Hips
- Spine
- Chest
- Neck
- Head
- UpperArm_L/R
- LowerArm_L/R
- Hand_L/R
- UpperLeg_L/R
- LowerLeg_L/R
- Foot_L/R
- Toe_L/R

### 추가 본 권장

- BagRoot
- BagStrap_L/R
- JacketSkirt_L/R
- HairFront
- HairSide_L/R

추가 본은 선택 사항이다. MVP에서는 고정 메시로 두고, 최종 품질에서 흔들림이나 물리 효과를 붙인다.

## 자전거 탑승 포즈 기준

### 기본 포즈

- 상체는 약간 앞으로 기울어진 라이딩 자세
- 양손은 핸들바를 잡은 상태
- 발은 좌우 페달 위치에 맞게 배치
- 무릎은 페달링 애니메이션을 고려해 너무 펴지지 않게 제작

### Unity IK 연결 대상

- `Left Hand Target`
- `Right Hand Target`
- `Left Foot Target`
- `Right Foot Target`

현재 Easy Bike System의 `BikeIKTargets`와 연결 가능해야 한다.

## 애니메이션 요구사항

### 필수

- Idle Ride Pose
- Pedal Loop
- Lean Left
- Lean Right
- Brake Reaction
- Light Hit Reaction
- Delivery Success Pose
- Delivery Fail Pose

### 선택

- Start Sprint
- Fast Pedal Burst
- Look Left
- Look Right
- Near Miss Reaction
- Booster Activated

MVP에서는 기존 IK 기반 자세를 먼저 사용하고, 최종 품질 단계에서 전용 애니메이션을 추가한다.

## Web3 패션 파츠 구조

패션 시스템을 Solidity/NFT와 연결하려면 캐릭터를 처음부터 파츠 교체 구조로 만들어야 한다.

### 파츠 슬롯

- `Outfit`: 재킷/상의
- `Pants`: 하의
- `Gloves`: 장갑
- `Shoes`: 신발
- `Bag`: 배달가방
- `Helmet`: 헬멧 또는 모자
- `Accessory`: 배지, 고글, 라이트, 장식

### Unity 프리팹 구조 예시

```text
BaekGijun_Player
├─ Armature
├─ Body_Base
├─ FaceHair
├─ Outfit_Slot
├─ Pants_Slot
├─ Gloves_Slot
├─ Shoes_Slot
├─ Bag_Slot
├─ Helmet_Slot
└─ Accessory_Slot
```

### Solidity 연동 기준

- 온체인에는 소유권과 장착 정보만 저장
- 실제 3D 모델/텍스처는 Unity 클라이언트 또는 CDN/IPFS 메타데이터에서 로드
- 게임 플레이 성능 때문에 매 프레임 Web3 조회 금지
- 로그인/장착/결제/보상 시점에만 체인 또는 백엔드 조회

## AI 이미지 제작 프롬프트 기준

### 기본 프롬프트

```text
A semi-realistic Korean male bicycle delivery rider named Baek Gijun, wearing a premium black chef-style delivery uniform with subtle gold details, black riding gloves, slim black rider pants, and a large square black delivery backpack branded "100 Burger Family". He rides a black city bicycle through a rainy night street with warm burger restaurant lights, wet road reflections, cinematic lighting, focused expression, professional food delivery hero, high quality character concept art, front three-quarter view.
```

### 네거티브 프롬프트

```text
low quality, extra fingers, deformed hands, broken bicycle, unreadable logo, messy text, oversized head, childlike proportions, fantasy armor, sci-fi weapon, unrealistic anatomy, duplicate limbs
```

### 필요한 이미지 세트

- 정면 전신
- 측면 전신
- 후면 전신
- 얼굴 클로즈업
- 배달가방 후면 클로즈업
- 자전거 탑승 포즈
- 유니폼 디테일 시트
- Web3 패션 파츠 변형 3종

## Blender 제작 체크리스트

- 스케일을 Unity 기준 `1 unit = 1 meter`로 맞춘다.
- 캐릭터 키를 약 `1.78m`로 설정한다.
- 모델 원점은 발바닥 중앙 또는 Hips 기준으로 정리한다.
- 메시 이름을 파츠별로 명확히 구분한다.
- 불필요한 내부 면을 제거한다.
- 노멀 방향을 정리한다.
- 텍스처 경로를 상대 경로로 유지한다.
- `Apply Transform` 후 FBX를 내보낸다.
- Export Forward: `-Z Forward`
- Export Up: `Y Up`

## Unity 임포트 기준

### FBX Import

- Rig: `Humanoid`
- Avatar Definition: `Create From This Model`
- Materials: 프로젝트 머티리얼로 수동 연결 권장
- Scale Factor: `1`
- Read/Write: 필요할 때만 켠다
- Optimize Game Objects: IK 타겟 테스트 전에는 끈다

### 프리팹 적용

- 기존 라이더를 바로 삭제하지 말고 비활성화한다.
- `BaekGijun_Player` 프리팹을 자전거 루트 하위에 배치한다.
- 손/발 IK 타겟을 `BikeIKTargets`에 연결한다.
- 배달가방이 카메라와 충돌하지 않는지 확인한다.
- 페달링 중 발이 페달에서 크게 벗어나지 않는지 확인한다.

## 품질 검수 기준

### 게임 카메라

- 등 뒤 카메라에서 배달가방 로고가 읽히는가
- 빠른 속도에서 실루엣이 명확한가
- 카메라 FOV 변화 시 얼굴/상체가 과하게 왜곡되지 않는가

### 조작

- 조향 시 상체 기울기가 자연스러운가
- 브레이크 시 몸이 너무 흔들리지 않는가
- 페달 연타 속도 변화가 캐릭터 움직임과 어울리는가

### 성능

- WebGL에서 프레임 저하가 심하지 않은가
- 머티리얼 수가 과도하지 않은가
- 텍스처 압축 후에도 로고와 얼굴이 유지되는가

## MVP 적용 전략

1. 기존 라이더로 게임 로직 MVP를 계속 구현한다.
2. 백기준 캐릭터는 별도 프리팹으로 제작한다.
3. 첫 버전은 고품질 정적 메시 + Humanoid Rig까지만 완성한다.
4. IK 연결 후 손/발 위치를 맞춘다.
5. 이후 의상/가방 파츠 분리와 Web3 장착 시스템을 붙인다.

## 산출물 목록

- `BaekGijun_ConceptSheet.png`
- `BaekGijun_Model.fbx`
- `BaekGijun_Textures`
- `BaekGijun_Player.prefab`
- `BaekGijun_MaterialSet`
- `BaekGijun_FashionSlots.json`
- `BaekGijun_UnityImportGuide.md`

## 추천 우선순위

1. 후면 실루엣과 배달가방
2. 핸들 잡는 손
3. 페달에 닿는 발
4. 얼굴과 헤어
5. 유니폼 로고/패치
6. Web3 패션 파츠 분리

## 최종 기준

백기준 캐릭터는 보기 좋은 독립 모델이 아니라, 자전거에 탄 상태에서 가장 좋아 보여야 한다. 따라서 정면 포즈보다 후면 주행 카메라, 측면 주행 카메라, 배달가방 실루엣, 손/발 IK 안정성이 더 중요하다.
