# MaAM Mini Game

> LunchFot demo: https://lunchfot.web.app

MoaM Mini Game은 MoaM 프로젝트에서 실험 중인 미니게임 프로토타입 모음입니다. 현재는 브라우저 기반 점심 메뉴 선택 게임과 Unity 기반 라이딩 프로토타입을 포함합니다.

## 프로젝트

### LunchFot

LunchFot은 실시간 점심 메뉴 레이스 게임입니다. 플레이어는 방을 만들거나 입장하고, 점심 후보 메뉴에 투표한 뒤, 음식 캐릭터들이 애니메이션 레일 위에서 경주하는 과정을 보며 최종 메뉴를 결정합니다.

- 위치: `lunchfot`
- 기술: React, Vite, TypeScript, Three.js, Firebase Realtime Database
- 현재 초점: 3D 음식 캐릭터 레이스, 레일 효과, 아이템 이벤트, 결과 카드, Firebase 배포
- 상태: 개발 중인 프로토타입

로컬 실행:

```bash
cd lunchfot
npm install
npm run dev
```

빌드:

```bash
cd lunchfot
npm run build
```

### Pedalrun

Pedalrun은 자전거 페달 입력을 중심으로 설계한 Unity 기반 러너/라이딩 프로토타입입니다.

- 위치: `pedalrun`
- 기술: Unity 6, URP
- 현재 초점: 이동, 조향, 속도 기반 카메라 방향, 러너 게임플레이 테스트
- 상태: 프로토타입

실행:

```text
Unity Hub에서 pedalrun 폴더를 엽니다.
```

## 저장소 구조

```text
moam-mini-game/
  lunchfot/
  pedalrun/
  README.md
  README_KO.md
```

## 참고

- `lunchfot`은 현재 가장 활발히 개발 중인 웹 게임입니다.
- `pedalrun`은 Unity 프로토타입이며, 호환되는 Unity 에디터 버전이 필요할 수 있습니다.
- 영문 문서는 `README.md`에서 확인할 수 있습니다.
