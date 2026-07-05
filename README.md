# MaAM Mini Game

> LunchFot demo: https://lunchfot.web.app

MoaM Mini Game is a collection of experimental game prototypes developed under the MoaM project. The repository currently contains a browser-based lunch selection game and a Unity-based riding prototype.

## Projects

### LunchFot

- Live demo: https://lunchfot.web.app

LunchFot is a real-time lunch menu racing game. Players create or join a room, vote for menu candidates, and watch food characters race on animated rails to decide the winner.

- Location: `lunchfot`
- Stack: React, Vite, TypeScript, Three.js, Firebase Realtime Database
- Current focus: 3D food-character racing, rail effects, item events, result cards, and Firebase deployment
- Status: Active prototype

Run locally:

```bash
cd lunchfot
npm install
npm run dev
```

Build:

```bash
cd lunchfot
npm run build
```

### Pedalrun

Pedalrun is a Unity-based runner/riding prototype designed around bicycle pedal input.

- Location: `pedalrun`
- Stack: Unity 6, URP
- Current focus: movement, steering, speed-driven camera direction, and runner gameplay tests
- Status: Prototype

Run:

```text
Open the pedalrun folder in Unity Hub.
```

## Repository Layout

```text
moam-mini-game/
  lunchfot/
  pedalrun/
  README.md
  README_KO.md
```

## Notes

- `lunchfot` is the main web game currently under active iteration.
- `pedalrun` is a Unity prototype and may require a matching Unity editor version.
- Korean documentation is available in `README_KO.md`.

