# LunchFot

> Live on Firebase Hosting: https://lunchfot.web.app  
> Last deployed: 2026-07-04, project `burger-910f0`, hosting site `lunchfot`

LunchFot is a real-time lunch selection mini game. Players create or join a room, vote for menu cards, watch the finalists race on animated conveyor rails, and receive a compact ranked result.

This build is a demo version. Core room creation, voting, racing, and result display flows are available, while game balance and event variety are still being refined.

![LunchFot main screen](docs/main-screen.png)

## Live Site

- Firebase Hosting: https://lunchfot.web.app

## Highlights

- Room creation and join flow with shareable room URLs
- Firebase Realtime Database support with local demo fallback
- Food vote selection using 20 menu images
- Loading transition with a running GLB bot
- 3D GLB character race powered by Three.js
- Animated conveyor rail objects with independent lane flow
- Three.js finish line aligned to the rail end
- Result screen with a winning card and compact ranking table
- Asset Lab modal for character motion and sprite testing

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

## Build

```bash
npm run build
```

## Deploy

```bash
npm run build
npx firebase-tools deploy --only hosting --project burger-910f0
```

`firebase.json` deploys the Vite `dist` folder and rewrites all routes to `index.html`, so direct room URLs such as `/room/ABCD` work after deployment.

## Assets

- Menu racer GLBs: `public/3d_glb/3m_001.glb` through `public/3d_glb/3m_020.glb`
- Loading runner GLB: `public/3d_glb/winlose_bgj.glb`
- Race rail texture: `public/other/rail_lane_tile.png`
- Plate event sprites: `public/other/10dish_item*.png`
- Work-in-progress authoring assets under `public/character_assets/` are ignored by Git.

## Planned Work

- Improve the multi-vote system
- Add character-specific special skill events
- Refine game balance, motion variants, and race effects
