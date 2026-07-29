"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";

const BACKGROUND = "/assets/backgrounds/jeonju-bibimbap-restaurant-empty.png";
const GAME_SECONDS = 240;
const LENS_ZOOM = 2.35;

type GameState = "ready" | "playing" | "won" | "lost";

type Food = {
  id: string;
  ko: string;
  en: string;
  romanized: string;
  image: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  opacity: number;
  camouflageFilter: string;
  blendMode: CSSProperties["mixBlendMode"];
  zone: string;
  zoneKo: string;
  map: { x: number; y: number; width: number; height: number };
  note: string;
};

const foods: Food[] = [
  {
    id: "jujube",
    ko: "대추",
    en: "Jujube",
    romanized: "Daechu",
    image: "/assets/collectibles/jujube.png",
    x: 20.8,
    y: 43.4,
    size: 4.6,
    rotation: 7,
    opacity: 0.8,
    camouflageFilter:
      "grayscale(0.22) sepia(0.22) saturate(0.58) brightness(0.72) contrast(1.12)",
    blendMode: "multiply",
    zone: "Courtyard brick wall",
    zoneKo: "놋그릇 선반",
    map: { x: 7, y: 29, width: 27, height: 31 },
    note: "A red fruit placed toward the east in Hongdong-Baekseo.",
  },
  {
    id: "chestnut",
    ko: "밤",
    en: "Chestnut",
    romanized: "Bam",
    image: "/assets/collectibles/chestnut.png",
    x: 91.2,
    y: 55.8,
    size: 4.7,
    rotation: 2,
    opacity: 0.84,
    camouflageFilter:
      "grayscale(0.52) sepia(0.38) saturate(0.42) brightness(0.68) contrast(1.08)",
    blendMode: "multiply",
    zone: "Brass-bowl shelf",
    zoneKo: "돌솥 찬장",
    map: { x: 84, y: 43, width: 15, height: 32 },
    note: "Chestnuts appear in the fruit and dessert row of many family tables.",
  },
  {
    id: "pear",
    ko: "배",
    en: "Korean Pear",
    romanized: "Bae",
    image: "/assets/collectibles/pear.png",
    x: 17.2,
    y: 37.6,
    size: 4.3,
    rotation: 91,
    opacity: 0.7,
    camouflageFilter:
      "grayscale(0.92) sepia(0.08) saturate(0.16) brightness(0.76) contrast(1.02)",
    blendMode: "multiply",
    zone: "Curved roof tiles",
    zoneKo: "안뜰 돌담",
    map: { x: 4, y: 24, width: 28, height: 28 },
    note: "A pale fruit commonly placed toward the west.",
  },
  {
    id: "persimmon",
    ko: "감",
    en: "Persimmon",
    romanized: "Gam",
    image: "/assets/collectibles/persimmon.png",
    x: 23.2,
    y: 48.2,
    size: 4.4,
    rotation: -3,
    opacity: 0.78,
    camouflageFilter:
      "grayscale(0.38) sepia(0.34) saturate(0.5) brightness(0.65) contrast(1.06)",
    blendMode: "multiply",
    zone: "Onggi jar lids",
    zoneKo: "배식대",
    map: { x: 15, y: 38, width: 20, height: 31 },
    note: "Persimmon is part of the Jo-Yul-Si-Yi ordering tradition.",
  },
  {
    id: "apple",
    ko: "사과",
    en: "Apple",
    romanized: "Sagwa",
    image: "/assets/collectibles/apple.png",
    x: 49.7,
    y: 49.8,
    size: 4.2,
    rotation: 5,
    opacity: 0.8,
    camouflageFilter:
      "grayscale(0.68) sepia(0.26) saturate(0.28) brightness(0.58) contrast(1.18)",
    blendMode: "multiply",
    zone: "Black stone bowl",
    zoneKo: "앞쪽 식탁",
    map: { x: 41, y: 39, width: 21, height: 28 },
    note: "Its red skin connects it to the eastern side of the table.",
  },
];

type LensState = {
  visible: boolean;
  x: number;
  y: number;
  left: number;
  top: number;
  size: number;
  sceneWidth: number;
  sceneHeight: number;
};

const emptyLens: LensState = {
  visible: false,
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  size: 160,
  sceneWidth: 0,
  sceneHeight: 0,
};

function formatTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [gameState, setGameState] = useState<GameState>("ready");
  const [found, setFound] = useState<Set<string>>(new Set());
  const [remainingTime, setRemainingTime] = useState(GAME_SECONDS);
  const [misses, setMisses] = useState(0);
  const [hints, setHints] = useState(0);
  const [hinted, setHinted] = useState<string | null>(null);
  const [selected, setSelected] = useState(foods[0].id);
  const [showMap, setShowMap] = useState(false);
  const [magnifierOn, setMagnifierOn] = useState(true);
  const [lens, setLens] = useState<LensState>(emptyLens);
  const [toast, setToast] = useState<string | null>(null);
  const [missMark, setMissMark] = useState<{ x: number; y: number; key: number } | null>(
    null,
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remainingFoods = useMemo(
    () => foods.filter((food) => !found.has(food.id)),
    [found],
  );
  const selectedFood =
    foods.find((food) => food.id === selected && !found.has(food.id)) ??
    remainingFoods[0] ??
    foods[0];
  const elapsed = GAME_SECONDS - remainingTime;
  const score = Math.max(0, 1000 - hints * 80 - misses * 25 - elapsed * 2);

  useEffect(() => {
    if (gameState !== "playing") return;
    const timer = window.setInterval(() => {
      setRemainingTime((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setGameState("lost");
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const announce = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1700);
  };

  const startGame = () => {
    setFound(new Set());
    setRemainingTime(GAME_SECONDS);
    setMisses(0);
    setHints(0);
    setHinted(null);
    setSelected(foods[0].id);
    setGameState("playing");
    announce("The restaurant is open to memory. Find all five foods.");
  };

  const findFood = (food: Food, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (gameState !== "playing" || found.has(food.id)) return;
    const next = new Set(found);
    next.add(food.id);
    setFound(next);
    setHinted(null);
    announce(`${food.en} found · ${food.ko}`);

    const nextFood = foods.find((candidate) => !next.has(candidate.id));
    if (nextFood) setSelected(nextFood.id);
    if (next.size === foods.length) {
      setTimeout(() => setGameState("won"), 500);
    }
  };

  const markMiss = (event: MouseEvent<HTMLDivElement>) => {
    if (gameState !== "playing") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setMisses((count) => count + 1);
    setMissMark({ x, y, key: Date.now() });
    window.setTimeout(() => setMissMark(null), 650);
  };

  const useHint = () => {
    if (gameState !== "playing" || hints >= 3 || remainingFoods.length === 0) return;
    const food = selectedFood ?? remainingFoods[0];
    setHints((count) => count + 1);
    setHinted(food.id);
    announce(`A memory flickers near the ${food.zone.toLowerCase()}.`);
    window.setTimeout(() => setHinted(null), 2400);
  };

  const moveLens = (event: MouseEvent<HTMLDivElement>) => {
    if (!magnifierOn || gameState !== "playing") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const size = Math.max(112, Math.min(180, rect.width * 0.18));
    setLens({
      visible: true,
      x,
      y,
      left: Math.max(0, Math.min(rect.width - size, x + 18)),
      top: Math.max(0, Math.min(rect.height - size, y + 18)),
      size,
      sceneWidth: rect.width,
      sceneHeight: rect.height,
    });
  };

  const resetLens = () => setLens((current) => ({ ...current, visible: false }));

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#game" aria-label="K-Memorial home">
          <span className="brand-mark">KM</span>
          <span>
            <strong>K-Memorial</strong>
            <small>Hidden Table</small>
          </span>
        </a>
        <div className="stage-rail" aria-label="Basic game progress">
          <span className="rail-label">BASIC COLLECTION</span>
          <span className="rail-line">
            <i />
          </span>
          <strong>01 / 30</strong>
        </div>
        <span className="status-chip">JEONJU · 전주</span>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">A KOREAN FOOD-CULTURE PUZZLE</p>
          <h1>Find what memory<br />left behind.</h1>
        </div>
        <div className="intro-copy">
          <p>
            Five foods are folded into an empty bibimbap restaurant in Jeonju
            Hanok Village. Look closely, collect them, then restore the first row
            of a <em>jesa</em> table.
          </p>
          <span>찾고 · 배우고 · 상을 완성하세요</span>
        </div>
      </section>

      <section className="game-layout" id="game">
        <div className="scene-column">
          <div className="scene-meta">
            <div>
              <span>STAGE 01</span>
              <strong>Jeonju Bibimbap House</strong>
            </div>
            <div className="game-stats">
              <span>TIME <strong>{formatTime(remainingTime)}</strong></span>
              <span>FOUND <strong>{found.size}/{foods.length}</strong></span>
              <span>MISSES <strong>{misses}</strong></span>
            </div>
          </div>

          <div
            className={`scene ${magnifierOn ? "is-magnifying" : ""}`}
            onClick={markMiss}
            onMouseMove={moveLens}
            onMouseLeave={resetLens}
            aria-label="Jeonju Hanok Village bibimbap restaurant hidden-object scene"
          >
            <img
              className="scene-background"
              src={BACKGROUND}
              alt="An empty bibimbap restaurant in Jeonju Hanok Village"
              draggable={false}
            />

            {foods.map((food) =>
              found.has(food.id) ? null : (
                <button
                  key={food.id}
                  className={`hidden-item ${hinted === food.id ? "is-hinted" : ""}`}
                  style={
                    {
                      "--item-x": `${food.x}%`,
                      "--item-y": `${food.y}%`,
                      "--item-size": `${food.size}%`,
                      "--item-rotation": `${food.rotation}deg`,
                      "--item-opacity": food.opacity,
                      "--item-filter": food.camouflageFilter,
                      "--item-blend": food.blendMode,
                    } as CSSProperties
                  }
                  onClick={(event) => findFood(food, event)}
                  aria-label={`Hidden ${food.en}`}
                >
                  <img
                    className="food-camouflage"
                    src={food.image}
                    alt=""
                    draggable={false}
                  />
                </button>
              ),
            )}

            {missMark && (
              <span
                key={missMark.key}
                className="miss-mark"
                style={{ left: `${missMark.x}%`, top: `${missMark.y}%` }}
              />
            )}

            {lens.visible && (
              <div
                className="magnifier-lens"
                style={{
                  left: lens.left,
                  top: lens.top,
                  width: lens.size,
                  height: lens.size,
                  backgroundImage: `url(${BACKGROUND})`,
                  backgroundSize: `${lens.sceneWidth * LENS_ZOOM}px ${
                    lens.sceneHeight * LENS_ZOOM
                  }px`,
                  backgroundPosition: `${
                    -(lens.x * LENS_ZOOM - lens.size / 2)
                  }px ${-(lens.y * LENS_ZOOM - lens.size / 2)}px`,
                }}
                aria-hidden="true"
              >
                {foods.map((food) =>
                  found.has(food.id) ? null : (
                    <img
                      key={food.id}
                      className="lens-item"
                      src={food.image}
                      alt=""
                      style={{
                        left:
                          (food.x / 100) * lens.sceneWidth * LENS_ZOOM -
                          lens.x * LENS_ZOOM +
                          lens.size / 2,
                        top:
                          (food.y / 100) * lens.sceneHeight * LENS_ZOOM -
                          lens.y * LENS_ZOOM +
                          lens.size / 2,
                        width:
                          (food.size / 100) * lens.sceneWidth * LENS_ZOOM,
                        opacity: 0.9,
                        transform: `rotate(${food.rotation}deg)`,
                      }}
                    />
                  ),
                )}
                <span className="lens-crosshair" />
              </div>
            )}

            {gameState === "ready" && (
              <div className="scene-gate">
                <p>JEONJU · BASIC 01</p>
                <h2>The first memory<br />begins at an empty table.</h2>
                <button className="primary-button" onClick={startGame}>
                  Enter the restaurant
                </button>
                <span>4 minutes · 5 foods · 3 hints</span>
              </div>
            )}

            {gameState === "lost" && (
              <div className="scene-gate">
                <p>THE DOORS ARE CLOSING</p>
                <h2>{foods.length - found.size} memories remain.</h2>
                <button className="primary-button" onClick={startGame}>
                  Try again
                </button>
              </div>
            )}

            {gameState === "won" && (
              <div className="scene-gate result-gate">
                <p>ROW ONE RESTORED</p>
                <h2>Hongdong-Baekseo</h2>
                <div className="result-score">
                  <span>SCORE</span>
                  <strong>{score.toString().padStart(4, "0")}</strong>
                </div>
                <p className="result-copy">
                  Red foods east, white foods west. Families and regions may
                  arrange their tables differently—the act of remembering comes
                  first.
                </p>
                <button className="primary-button" onClick={startGame}>
                  Play again
                </button>
              </div>
            )}

            {toast && <div className="toast" role="status">{toast}</div>}
          </div>

          <div className="culture-strip">
            <span className="rule-index">01</span>
            <div>
              <small>TABLE RULE · 상차림 규칙</small>
              <strong>Hongdong-Baekseo · 홍동백서</strong>
            </div>
            <p>Red foods to the east, white foods to the west.</p>
          </div>
        </div>

        <aside className="side-panel">
          <div className="side-heading">
            <span>TARGETS</span>
            <strong>{remainingFoods.length} REMAINING</strong>
          </div>

          <div className="target-list">
            {foods.map((food) => {
              const isFound = found.has(food.id);
              return (
                <button
                  key={food.id}
                  className={`target-card ${isFound ? "is-found" : ""} ${
                    selected === food.id ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    if (!isFound) {
                      setSelected(food.id);
                      setShowMap(true);
                    }
                  }}
                  disabled={isFound}
                >
                  <span className="target-thumb">
                    <img src={food.image} alt="" />
                  </span>
                  <span>
                    <strong>{food.en}</strong>
                    <small>{food.romanized} · {food.ko}</small>
                  </span>
                  <i>{isFound ? "FOUND" : "○"}</i>
                </button>
              );
            })}
          </div>

          <div className="tool-grid">
            <button
              className={magnifierOn ? "is-active" : ""}
              onClick={() => setMagnifierOn((value) => !value)}
              aria-pressed={magnifierOn}
            >
              <span className="tool-icon">⌕</span>
              <strong>Magnifier</strong>
              <small>{magnifierOn ? "ON" : "OFF"}</small>
            </button>
            <button onClick={() => setShowMap(true)}>
              <span className="tool-icon">⌗</span>
              <strong>Memory Map</strong>
              <small>OPEN</small>
            </button>
          </div>

          <button
            className="hint-button"
            onClick={useHint}
            disabled={gameState !== "playing" || hints >= 3}
          >
            <span>Use a memory trace</span>
            <strong>{3 - hints} LEFT</strong>
          </button>

          <p className="source-note">
            English cultural terminology references{" "}
            <a
              href="https://thesoulofseoul.net/how-to-set-the-table-for-jesa/"
              target="_blank"
              rel="noreferrer"
            >
              The Soul of Seoul
            </a>
            .
          </p>
        </aside>
      </section>

      <section className="roadmap">
        <div>
          <p className="eyebrow">WHAT COMES AFTER BASIC 30</p>
          <h2>Made by memory.<br />Hidden by players.</h2>
        </div>
        <div className="roadmap-copy">
          <p>
            Maker players will generate restaurant scenes, remove color or keep
            only outlines, tune opacity and texture, then publish their own
            cultural hidden-object stages.
          </p>
          <div className="roadmap-steps">
            <span><b>01</b> Generate a place</span>
            <span><b>02</b> Customize a food</span>
            <span><b>03</b> Hide & publish</span>
          </div>
        </div>
      </section>

      <footer>
        <span>K-MEMORIAL · BASIC COLLECTION 01</span>
        <span>JEONJU HANOK VILLAGE · 전주한옥마을</span>
      </footer>

      {showMap && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowMap(false)}>
          <div
            className="map-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span>APPROXIMATE CLUE</span>
                <h2 id="map-title">Memory Map</h2>
              </div>
              <button onClick={() => setShowMap(false)} aria-label="Close memory map">
                ×
              </button>
            </div>

            <div className="map-content">
              <div className="mini-scene" style={{ backgroundImage: `url(${BACKGROUND})` }}>
                <span
                  className="map-zone"
                  style={{
                    left: `${selectedFood.map.x}%`,
                    top: `${selectedFood.map.y}%`,
                    width: `${selectedFood.map.width}%`,
                    height: `${selectedFood.map.height}%`,
                  }}
                />
                <span className="mini-caption">AREA, NOT EXACT POSITION</span>
              </div>
              <div className="map-detail">
                <span>YOU ARE LOOKING FOR</span>
                <img src={selectedFood.image} alt={selectedFood.en} />
                <h3>{selectedFood.en}</h3>
                <p>{selectedFood.romanized} · {selectedFood.ko}</p>
                <div className="zone-name">
                  <small>SEARCH NEAR</small>
                  <strong>{selectedFood.zone}</strong>
                  <span>{selectedFood.zoneKo}</span>
                </div>
                <p className="food-note">{selectedFood.note}</p>
              </div>
            </div>

            <div className="modal-targets">
              {remainingFoods.map((food) => (
                <button
                  key={food.id}
                  className={selectedFood.id === food.id ? "is-selected" : ""}
                  onClick={() => setSelected(food.id)}
                >
                  {food.en}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
