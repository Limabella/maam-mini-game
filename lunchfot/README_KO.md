# LunchFot

> Firebase Hosting 데모: https://lunchfot.web.app  
> 마지막 배포: 2026-07-04, project `burger-910f0`, hosting site `lunchfot`

LunchFot은 실시간 점심 메뉴 선택 미니게임입니다. 사용자는 방을 만들거나 입장하고, 메뉴 카드에 투표한 뒤, 선정된 음식 캐릭터들이 애니메이션 레일 위에서 경주하는 장면을 보고 최종 순위를 확인합니다.

현재 빌드는 데모 버전입니다. 방 생성, 입장, 투표, 레이스, 결과 표시의 핵심 흐름은 동작하지만 게임 밸런스와 이벤트 다양성은 계속 조정 중입니다.

![LunchFot main screen](docs/main-screen.png)

## 배포 사이트

- Firebase Hosting: https://lunchfot.web.app

## 주요 기능

- 공유 가능한 방 URL을 통한 방 생성 및 입장 흐름
- Firebase Realtime Database 연동 및 로컬 데모 모드 fallback
- 20개 메뉴 이미지를 활용한 음식 투표 선택
- GLB 러너가 등장하는 로딩 전환 화면
- Three.js 기반 3D GLB 캐릭터 레이스
- 독립적으로 흐르는 애니메이션 레일 오브젝트
- 레일 끝 좌표에 맞춘 Three.js 피니시 라인
- 우승 카드와 간결한 순위표를 보여주는 결과 화면
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

- 메뉴별 레이스 GLB: `public/3d_glb/3m_001.glb`부터 `public/3d_glb/3m_020.glb`
- 로딩 러너 GLB: `public/3d_glb/winlose_bgj.glb`
- 레이스 레일 텍스처: `public/other/rail_lane_tile.png`
- 접시 이벤트 스프라이트: `public/other/10dish_item*.png`
- 제작 중인 원본 에셋은 `public/character_assets/`에 두며 Git에서는 제외합니다.

## 추가 예정

- 멀티투표 시스템 개선
- 캐릭터별 필살기 이벤트 추가
- 게임 밸런스, 모션 변형, 레이스 효과 개선
