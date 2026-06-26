# MoaM Mini Game

MoaM 프로젝트에서 실험 중인 미니게임 모음입니다. 현재는 `LunchFot`과 `Pedalrun` 두 게임이 같은 상위 폴더에 있습니다.

## Games

### LunchFot

점심 메뉴를 빠르게 고르는 웹 기반 멀티플레이 룰렛/다트 게임입니다.

- 위치: `lunchfot`
- 기술: React, Vite, TypeScript, Firebase Realtime Database 지원
- 핵심 흐름: 방 생성, 코드 입장, 룰렛 회전, 다트 투척, 결과 공유
- 현재 상태: 20개 점심 카드 적용, 20초 라운드, 5~18초 다트 투척 구간, 멀티플레이 조준/투척 표시

실행:

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

자전거 페달링 입력을 중심으로 한 Unity 기반 러너/라이딩 게임입니다.

- 위치: `pedalrun`
- 기술: Unity 6, URP
- 핵심 흐름: 페달 입력, 조향, 속도감 기반 카메라 연출
- 현재 상태: 기본 조작과 카메라 추적 실험 중

실행:

```text
Unity Hub에서 pedalrun 폴더 열기
```

## Folder Structure

```text
moam-mini-game/
  Assets/
  lunchfot/
  pedalrun/
  README.md
```

## Notes

- `LunchFot`은 브라우저 기반 게임입니다.
- `Pedalrun`은 Unity 프로젝트입니다.
- 각 게임의 세부 실행 방법은 개별 폴더의 README 또는 프로젝트 설정을 확인합니다.
# moam-mini-game
