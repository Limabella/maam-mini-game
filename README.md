# MoaM Mini Game

MoaM Mini Game is a collection of small experimental games developed under the MoaM project. The repository currently contains browser-based and Unity-based prototypes.

## Games

### LunchFot

LunchFot is a real-time lunch menu race game. Players join a room, vote for lunch candidates, and watch the selected food characters race to decide the result.

- Location: `lunchfot`
- Stack: React, Vite, TypeScript, Three.js, Firebase Realtime Database
- Current focus: 3D character racing, rail effects, item events, result cards, and Firebase deployment
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

Pedalrun is a Unity-based runner/racing prototype driven by bicycle pedal input.

- Location: `pedalrun`
- Stack: Unity 6, URP
- Current focus: basic movement, steering, speed-based camera direction, and runner gameplay tests
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
- Each game may include its own setup notes in its project folder.
