# LunchFot

LunchFot is a real-time lunch selection mini game. Players enter a shared room, vote for menu cards, watch the selected foods race, and get a final ranked result.

![LunchFot main screen](docs/main-screen.png)

## Firebase Site

- Hosting: https://lunchfot.web.app

## Run Locally

```bash
npm install
npm run dev
```

Firebase config can be placed in `.env.local`.

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

If Firebase config is missing, the app runs in local demo mode.

## Deploy

```bash
npm run build
npx firebase-tools deploy --only hosting --project burger-910f0
```

`firebase.json` deploys the Vite `dist` folder and rewrites all routes to `index.html`, so direct room URLs such as `/room/ABCD` work after deployment.

## Current Features

- Main menu and room join flow
- Realtime room state with Firebase/local fallback
- Food card voting with 20 menu images
- Countdown transition screen
- Sushi race play screen
- Result page with winning card and compact ranking table
- Asset Lab for character motion and sprite testing

## Planned Work

- Event motion effects
- Running 3D model, motion, and effects
