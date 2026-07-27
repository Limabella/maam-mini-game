# Pedalrun

[한국어](README_KO.md)

Pedalrun is a Unity bicycle riding game prototype focused on responsive cycling, road navigation, and stage-based delivery gameplay.

![Pedalrun bicycle road preview](docs/images/pedalrun-bicycle-road.png)

## Features

- Bicycle movement and steering built in Unity 6
- A long road environment with sidewalks and safety guardrails
- Crosswalk openings designed for transitions between the road and sidewalks
- Collision damping that prevents the bicycle from being launched excessively
- A foundation for delivery robots, obstacles, finish lines, and future stages

## Controls

- `W / S`: Pedal input
- Mouse drag: Steer left and right
- `Space`: Brake

## Current Status

The first bicycle road environment is playable in the Unity Editor. The next milestone is a complete Stage 1 gameplay loop with obstacles, delivery objectives, HUD feedback, and a WebGL build.

## Tech Stack

- Unity 6.3 LTS
- Universal Render Pipeline (URP)
- C#

## Roadmap

- Complete the Stage 1 course and finish-line flow
- Add randomized obstacles with safe spacing
- Add sidewalk delivery robots
- Add timer, objective, and result HUD
- Build and deploy the game for WebGL

