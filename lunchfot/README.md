# Lunch Dart Roulette

카카오톡 링크로 바로 입장해서 점심 메뉴를 정하는 모바일 우선 웹 게임입니다.

## 실행

```bash
npm install
npm run dev
```

Firebase 환경변수가 없으면 로컬 데모 모드로 실행됩니다. 같은 브라우저 안에서는 방 생성, 입장, 시작, 다트, 결과 흐름을 확인할 수 있습니다.

## 메뉴 이미지

실제 메뉴 이미지는 `public/menu` 폴더에 넣으면 됩니다. 파일명은 앱의 메뉴 ID와 맞춥니다.

예: `public/menu/jeyuk.png`, `public/menu/kimchi-stew.png`

현재는 파일이 없어도 내장 SVG 대체 이미지가 표시됩니다. 전체 파일명 목록은 `public/menu/README.md`에 있습니다.

## Firebase 설정

`.env.local`을 만들고 Firebase Web App 설정값을 넣습니다.

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Firebase Authentication에서 Anonymous provider를 켜고, Realtime Database를 생성하세요.

개발용 Realtime Database rules 예시는 아래와 같습니다.

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": "auth != null"
      }
    }
  }
}
```

## 게임 흐름

- 홈: 닉네임 입력 후 방 생성 또는 4자리 코드 입장
- 로비: 방 코드, 참가자, 초대 링크 복사, 방장 시작
- 카운트다운: 3초 뒤 공통 `startAt` 기준으로 시작
- 플레이: 회전 각도는 `seed + startAt + wheelSpeed + throwAt`으로 결정
- 결과: 각 다트가 가장 가까운 메뉴 카드와의 각도 오차를 계산해 우승자를 정함

## 배포

Firebase Hosting 기준으로 빌드 결과는 `dist`에 생성됩니다.

```bash
npm run build
firebase init hosting
firebase deploy
```
