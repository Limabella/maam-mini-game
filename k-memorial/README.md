# K-Memorial — Hidden Table

[한국어](README_KO.md)

> Private demo: https://k-memorial-hidden-table.ant-probe.chatgpt.site
> Current build: Basic 01 — Jeonju Bibimbap House

K-Memorial is a Korean food-culture hidden-object game. Players explore a
restaurant scene, find foods associated with a traditional *jesa* table, and
complete a cultural collection.

The current build is a one-stage prototype set in a bibimbap restaurant in
Jeonju Hanok Village. It tests the core search loop, magnifier, clue map, hints,
scoring, and bilingual cultural information before the Basic Collection expands
to 30 stages.

![K-Memorial Jeonju bibimbap restaurant background](public/assets/backgrounds/jeonju-bibimbap-restaurant-empty.png)

## Live Site

- Private demo: https://k-memorial-hidden-table.ant-probe.chatgpt.site
- Stage: `Basic 01 / 30`
- Time limit: 4 minutes
- Hidden foods: 5
- Available hints: 3

## How to Play

1. Select **Enter the restaurant** to start the four-minute timer.
2. Search the restaurant for the five foods shown in the target panel.
3. Move the pointer across the scene while **Magnifier** is enabled to inspect
   detailed areas.
4. Select a food in the target panel to open its approximate area in
   **Memory Map**.
5. Use **A memory trace** when you need a temporary visual hint. Up to three
   hints are available.
6. Select a hidden food in the scene to add it to the collection.
7. Find all five foods before time runs out to restore the first table rule,
   **Hongdong-Baekseo**.

Selecting an incorrect area adds a miss and reduces the final score. Time used,
misses, and hints all affect the result.

## Controls

- Mouse or touch: select a hidden food
- Pointer movement: move the magnifier across the scene
- **Magnifier**: enable or disable the inspection lens
- **Memory Map**: view an approximate search region
- **A memory trace**: reveal a temporary hint
- Target card: select the food described by the map and cultural note

## Current Hidden Foods

| Korean | English | Romanization |
| --- | --- | --- |
| 대추 | Jujube | Daechu |
| 밤 | Chestnut | Bam |
| 배 | Korean Pear | Bae |
| 감 | Persimmon | Gam |
| 사과 | Apple | Sagwa |

The English terminology and short cultural descriptions reference
[The Soul of Seoul's guide to setting a jesa table](https://thesoulofseoul.net/how-to-set-the-table-for-jesa/).
Family and regional arrangements may differ.

## Features

- A 16:9 Jeonju Hanok Village restaurant scene
- Five separately managed transparent food assets
- Percentage-based hidden-object coordinates for responsive layouts
- Magnifier that enlarges the scene and collectible layers
- Clickable Memory Map with approximate search zones
- Timer, miss counter, three hints, and score calculation
- Korean, English, and romanized food names
- Cultural collection progress for the planned Basic 30 stages
- Responsive desktop and mobile layout

## Tech Stack

- Next.js 16
- React 19
- TypeScript 5
- vinext
- Vite 8
- CSS custom properties, filters, and blend modes
- Node.js 22 or later
- OpenAI Sites private hosting

The game currently has no required database. Timer, score, hints, selected food,
and collection progress are held in React client state.

## Run Locally

Prerequisite:

- Node.js `>=22.13.0`

Install and start the development server:

```bash
npm install
npm run dev
```

Open the local URL printed by vinext.

## Build and Test

Create a production build:

```bash
npm run build
```

Build the project and run the rendered HTML and asset tests:

```bash
npm test
```

Start the production build locally:

```bash
npm run start
```

## Project Structure

```text
k-memorial/
  app/
    globals.css
    layout.tsx
    page.tsx
  docs/
    background-image-prompts-ko.md
    collectible-master-ko.md
    product-plan-ko.md
  public/
    assets/
      backgrounds/
      collectibles/
    og.png
  tests/
    rendered-html.test.mjs
  README.md
  README_KO.md
```

## Asset Workflow

- Backgrounds use a consistent horizontal 16:9 composition.
- Jesa foods must not already appear in the clean background.
- Empty bowls, cooking tools, furniture, decorations, and regional materials
  provide visual density.
- Readable signs, brands, logos, and recognizable people are excluded.
- The foreground, middle ground, and background each reserve useful search
  areas.
- Important hiding areas stay clear of interface edges.
- Clean backgrounds and food source assets remain separate during authoring.
- The final hidden-object artwork should be flattened after each food is
  integrated into the lighting, material, perspective, and existing shapes of
  the scene.

## Prototype Limitation

The current stage still uses runtime food layers with CSS color matching and
blend modes. This is useful for testing coordinates and interaction, but it
cannot fully match the lighting, grain, shadows, and geometry of the background.

The production art workflow should use generative editing or manual compositing
to embed each food into the final background image. The game should then place
transparent click regions over the flattened artwork instead of displaying
separate food images.

## Planned Work

- Rebuild the Jeonju stage as one flattened hidden-object illustration
- Validate each hidden food individually before integrating all five
- Refine mobile hit areas and magnifier behavior
- Expand the Basic Collection to 30 Korean restaurant stages
- Add five difficulty levels based on traditional table-ordering rules
- Develop Maker tools for generating backgrounds, customizing foods, defining
  click regions, and publishing community stages
