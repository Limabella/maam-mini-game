# LunchFot

LunchFot은 실시간 점심 메뉴 선택 미니게임입니다. 사용자는 방을 만들거나 입장하고, 메뉴 카드에 투표한 뒤, 선정된 음식 캐릭터들이 애니메이션 레일 위에서 레이스하는 장면을 보고 최종 순위를 확인합니다.

![LunchFot main screen](docs/main-screen.png)

## 배포 사이트

- Firebase Hosting: https://lunchfot.web.app

## 주요 기능

- 방 생성 및 방 입장 플로우
- 공유 가능한 방 URL
- Firebase Realtime Database 연동 및 로컬 데모 모드 fallback
- 20개 음식 이미지 기반 투표 선택 화면
- 카운트다운 전환 화면
- Three.js 기반 3D GLB 캐릭터 레이스
- 독립 오브젝트로 구성된 애니메이션 회전 레일
- 결승 지점 NTR-N 깃발 마스코트
- 우승 카드와 간결한 순위표 결과 화면
- 캐릭터 모션과 스프라이트 테스트용 Asset Lab 모달

## 로컬 실행

```bash
npm install
npm run dev
```

Firebase 설정은 `.env.local`에 둘 수 있습니다.

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Firebase 설정이 없으면 로컬 데모 모드로 실행됩니다.

## 빌드

```bash
npm run build
```

## 배포

```bash
npm run build
npx firebase-tools deploy --only hosting --project burger-910f0
```

`firebase.json`은 Vite의 `dist` 폴더를 배포하고 모든 라우트를 `index.html`로 rewrite합니다. 따라서 `/room/ABCD` 같은 방 URL도 배포 환경에서 바로 열립니다.

## 에셋

- 런타임 3D 모델: `public/3d_glb/001.glb`
- 레이스 레일 텍스처: `public/other/rail_lane_tile.png`
- 피니시 마스코트: `public/other/finish_ntr_flag.png`
- 제작 중인 원본 에셋인 `public/character_assets/`는 Git에서 제외합니다.

## 예정 작업

- 이벤트 모션 이펙트
- 달리기 3D 모델링 개선, 모션 변형, 이펙트 추가
