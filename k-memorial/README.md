# K-Memorial — The Curator's Lie

[한국어](README_KO.md)

> Private demo: https://k-memorial-hidden-table.ant-probe.chatgpt.site

K-Memorial is an AI-assisted visual logic game set inside a fictional museum.
Five Korean-inspired artworks enter the archive, but one is a forgery. Players
compare seasons, birds, fruit, moonlight, recurring seals, and the curator's
testimony to identify the only work that cannot belong.

![The Curator's Lie social preview](public/og.png)

## Case 001 — The Fifth Seal

- Five AI-generated artworks
- One verified forgery
- Five curator statements, exactly one false
- Ten-minute investigation
- Three progressive hints
- Three accusation attempts
- Artwork inspection with adjustable magnification

## How to Play

1. Select **Enter the Gallery** to open the case.
2. Inspect all five paintings and zoom in on their visual evidence.
3. Count the vermilion memory seals and compare birds, moonlight, and fruit.
4. Mark any curator statements that appear suspicious.
5. Select one painting as the suspect and choose **Accuse This Work**.
6. Close the case before time or accusation attempts run out.

## Design Principle

AI creates the artwork and atmosphere, while deterministic game data controls
the evidence and answer. The logic does not depend on an AI model judging the
player's response, so every case can be validated to have one solution.

## Tech Stack

- Next.js 16
- React 19
- TypeScript 5
- vinext and Vite 8
- CSS responsive gallery, overlays, and zoom interaction
- OpenAI-generated raster artwork
- OpenAI Sites private hosting
- Node.js 22 or later

## Run Locally

```bash
npm install
npm run dev
```

## Build and Test

```bash
npm run build
npm test
```

## Project Structure

```text
k-memorial/
  app/
    page.tsx
    globals.css
    layout.tsx
  public/
    assets/gallery/
    og.png
  tests/
    rendered-html.test.mjs
```

## Planned Work

- Add cases with conditional, ordering, parity, and self-referential logic
- Generate new museum collections from structured case data
- Add a visual deduction notebook and case history
- Validate future cases with a constraint solver before publishing
- Add community-authored exhibitions with AI-assisted art direction
