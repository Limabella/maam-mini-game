"use client";

import { useEffect, useMemo, useState } from "react";

const CASE_SECONDS = 600;

type Phase = "briefing" | "investigating" | "solved" | "failed";

type Seal = { x: number; y: number; rotate: number };

type Artwork = {
  id: string;
  number: string;
  title: string;
  titleKo: string;
  image: string;
  season: string;
  year: string;
  medium: string;
  description: string;
  observation: string;
  seals: Seal[];
  forged?: boolean;
};

const artworks: Artwork[] = [
  {
    id: "spring-dawn",
    number: "I",
    title: "Spring Dawn",
    titleKo: "봄날의 여명",
    image: "/assets/gallery/01-spring-dawn.png",
    season: "SPRING",
    year: "UNKNOWN",
    medium: "INK & MINERAL PIGMENT ON SILK",
    description:
      "A single crane crosses a garden waking beneath pale plum blossoms.",
    observation: "One bird · no moon · white blossom",
    seals: [
      { x: 9, y: 14, rotate: -8 },
      { x: 84, y: 21, rotate: 7 },
      { x: 78, y: 84, rotate: -4 },
    ],
  },
  {
    id: "summer-lotus",
    number: "II",
    title: "Summer Lotus",
    titleKo: "여름 연못",
    image: "/assets/gallery/02-summer-lotus.png",
    season: "SUMMER",
    year: "UNKNOWN",
    medium: "INK & MINERAL PIGMENT ON SILK",
    description:
      "Two kingfishers skim the rain-dark water beside a dense lotus bed.",
    observation: "Two birds · no moon · no red fruit",
    seals: [
      { x: 12, y: 81, rotate: 5 },
      { x: 87, y: 12, rotate: -6 },
      { x: 74, y: 88, rotate: 9 },
    ],
  },
  {
    id: "autumn-persimmon",
    number: "III",
    title: "Autumn Persimmon",
    titleKo: "가을 감나무",
    image: "/assets/gallery/03-autumn-persimmon.png",
    season: "AUTUMN",
    year: "UNKNOWN",
    medium: "INK & MINERAL PIGMENT ON SILK",
    description:
      "A silent courtyard holds a persimmon tree heavy with red-orange fruit.",
    observation: "No birds · no moon · red fruit",
    seals: [
      { x: 10, y: 11, rotate: -5 },
      { x: 86, y: 69, rotate: 8 },
      { x: 20, y: 87, rotate: -10 },
    ],
  },
  {
    id: "winter-moon",
    number: "IV",
    title: "Winter Moon",
    titleKo: "겨울 달",
    image: "/assets/gallery/04-winter-moon.png",
    season: "WINTER",
    year: "UNKNOWN",
    medium: "INK & MINERAL PIGMENT ON SILK",
    description:
      "Snow settles on bare plum branches beneath one untroubled full moon.",
    observation: "No birds · one moon · no fruit",
    seals: [
      { x: 11, y: 84, rotate: 8 },
      { x: 79, y: 15, rotate: -7 },
      { x: 88, y: 76, rotate: 4 },
    ],
  },
  {
    id: "crimson-eclipse",
    number: "V",
    title: "Crimson Eclipse",
    titleKo: "붉은 월식",
    image: "/assets/gallery/05-crimson-eclipse.png",
    season: "UNRECORDED",
    year: "UNKNOWN",
    medium: "INK & MINERAL PIGMENT ON SILK",
    description:
      "Three magpies watch a crimson moon burn above fruit-laden branches.",
    observation: "Three birds · one moon · red fruit",
    seals: [
      { x: 8, y: 12, rotate: -7 },
      { x: 86, y: 10, rotate: 6 },
      { x: 12, y: 86, rotate: 9 },
      { x: 85, y: 84, rotate: -5 },
    ],
    forged: true,
  },
];

const testimonies = [
  "The moon appears only where no red fruit grows.",
  "No bird enters the Autumn Persimmon courtyard.",
  "Every authentic work bears exactly three memory seals.",
  "Winter Moon is the only authentic moonlit work.",
  "The autumn fruit hangs immediately before Winter Moon.",
];

const hints = [
  "Count the vermilion memory seals. Repetition is the artist's signature.",
  "Compare every moonlit work with every painting that carries red fruit.",
  "One painting breaks both the seal pattern and the moon-and-fruit rule.",
];

function formatTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("briefing");
  const [remaining, setRemaining] = useState(CASE_SECONDS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [attempts, setAttempts] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [markedStatements, setMarkedStatements] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const selected = artworks.find((artwork) => artwork.id === selectedId) ?? null;
  const opened = artworks.find((artwork) => artwork.id === openId) ?? null;
  const elapsed = CASE_SECONDS - remaining;
  const score = Math.max(100, 1200 - elapsed - attempts * 160 - hintCount * 120);

  useEffect(() => {
    if (phase !== "investigating") return;
    const timer = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setPhase("failed");
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeHints = useMemo(() => hints.slice(0, hintCount), [hintCount]);

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const beginCase = () => {
    setPhase("investigating");
    setRemaining(CASE_SECONDS);
    setSelectedId(null);
    setAttempts(0);
    setHintCount(0);
    setMarkedStatements(new Set());
    announce("Case file opened. Five works, one forgery.");
  };

  const inspect = (id: string) => {
    setSelectedId(id);
    setOpenId(id);
    setZoom(1);
  };

  const accuse = () => {
    if (phase !== "investigating" || !selected) return;
    if (selected.forged) {
      setPhase("solved");
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    announce(`${selected.title} is internally consistent. Reopen the evidence.`);
    if (nextAttempts >= 3) setPhase("failed");
  };

  const useHint = () => {
    if (phase !== "investigating" || hintCount >= hints.length) return;
    setHintCount((current) => current + 1);
  };

  const toggleStatement = (index: number) => {
    setMarkedStatements((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <main className="museum-shell">
      <header className="museum-header">
        <a className="museum-brand" href="#case" aria-label="K-Memorial home">
          <span className="brand-monogram">KM</span>
          <span>
            <strong>K-MEMORIAL</strong>
            <small>THE CURATOR'S LIE</small>
          </span>
        </a>
        <div className="case-status">
          <span>CASE 001</span>
          <i />
          <strong>THE FIFTH SEAL</strong>
        </div>
        <div className="ai-mark">
          <span className="ai-dot" />
          AI ART · LOGIC VERIFIED
        </div>
      </header>

      <section className="case-intro" id="case">
        <div>
          <p className="kicker">PRIVATE VIEWING · 비공개 감정</p>
          <h1>The Curator’s<br /><em>Lie</em></h1>
        </div>
        <div className="intro-brief">
          <span className="brief-index">01</span>
          <p>
            Five paintings entered the archive. Four share one visual grammar.
            One was generated to imitate it. Study the seasons, birds, fruit,
            moonlight, and vermilion seals—then accuse the forgery.
          </p>
          <small>다섯 작품 중 단 하나의 위작을 찾아내세요.</small>
        </div>
      </section>

      <section className="game-board" aria-label="The Curator's Lie game">
        <div className="board-topline">
          <div>
            <span>WEST GALLERY · ROOM 04</span>
            <strong>Five Seasons, One Intruder</strong>
          </div>
          <div className="case-metrics">
            <span>TIME <strong>{formatTime(remaining)}</strong></span>
            <span>ERRORS <strong>{attempts}/3</strong></span>
            <span>HINTS <strong>{hintCount}/3</strong></span>
          </div>
        </div>

        <div className="gallery-wall">
          {artworks.map((artwork) => {
            const isSelected = selectedId === artwork.id;
            return (
              <article className={`art-card ${isSelected ? "is-selected" : ""}`} key={artwork.id}>
                <button
                  className="art-frame"
                  onClick={() => inspect(artwork.id)}
                  aria-label={`Inspect ${artwork.title}`}
                >
                  <span className="frame-number">{artwork.number}</span>
                  <span className="art-crop">
                    <img src={artwork.image} alt={artwork.description} draggable={false} />
                    {artwork.seals.map((seal, index) => (
                      <span
                        className="memory-seal"
                        key={index}
                        style={{ left: `${seal.x}%`, top: `${seal.y}%`, rotate: `${seal.rotate}deg` }}
                        aria-hidden="true"
                      >
                        記
                      </span>
                    ))}
                    <span className="inspect-label">INSPECT +</span>
                  </span>
                </button>
                <div className="art-label">
                  <span>{artwork.season}</span>
                  <h2>{artwork.title}</h2>
                  <p>{artwork.titleKo}</p>
                  <button
                    className={isSelected ? "suspect-button is-selected" : "suspect-button"}
                    onClick={() => setSelectedId(artwork.id)}
                    disabled={phase !== "investigating"}
                  >
                    {isSelected ? "SELECTED SUSPECT" : "MARK AS SUSPECT"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="evidence-deck">
          <section className="testimony-panel">
            <div className="panel-heading">
              <div>
                <span>CURATOR'S TESTIMONY</span>
                <h2>Exactly one statement is false.</h2>
              </div>
              <span className="statement-count">05 STATEMENTS</span>
            </div>
            <ol className="statement-list">
              {testimonies.map((statement, index) => (
                <li key={statement} className={markedStatements.has(index) ? "is-marked" : ""}>
                  <button onClick={() => toggleStatement(index)} aria-pressed={markedStatements.has(index)}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{statement}</p>
                    <i>{markedStatements.has(index) ? "SUSPECT" : "MARK"}</i>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <aside className="deduction-panel">
            <div>
              <span className="panel-eyebrow">DEDUCTION DESK · 추리 기록</span>
              <h2>{selected ? selected.title : "Choose a suspect"}</h2>
              <p>
                {selected
                  ? selected.description
                  : "Inspect the paintings, mark the curator’s false statement, and select the work that cannot belong."}
              </p>
            </div>

            {activeHints.length > 0 && (
              <div className="hint-stack">
                {activeHints.map((hint, index) => (
                  <p key={hint}><span>TRACE {index + 1}</span>{hint}</p>
                ))}
              </div>
            )}

            <div className="desk-actions">
              <button className="hint-action" onClick={useHint} disabled={phase !== "investigating" || hintCount >= 3}>
                REQUEST TRACE <span>{3 - hintCount} LEFT</span>
              </button>
              <button className="accuse-action" onClick={accuse} disabled={phase !== "investigating" || !selected}>
                ACCUSE THIS WORK
              </button>
            </div>
          </aside>
        </div>

        {phase === "briefing" && (
          <div className="case-overlay">
            <p>CASE FILE 001</p>
            <h2>One curator.<br />One lie.<br />One forgery.</h2>
            <button onClick={beginCase}>ENTER THE GALLERY</button>
            <span>10 MINUTES · 5 WORKS · 3 TRACES</span>
          </div>
        )}

        {(phase === "solved" || phase === "failed") && (
          <div className={`case-overlay result-overlay ${phase}`}>
            <p>{phase === "solved" ? "CASE SOLVED" : "ARCHIVE LOCKED"}</p>
            <h2>{phase === "solved" ? "Crimson Eclipse is the forgery." : "The curator kept the secret."}</h2>
            <div className="result-summary">
              <div><span>SCORE</span><strong>{phase === "solved" ? score : "0000"}</strong></div>
              <p>
                The fifth work alone carries four memory seals. It also joins a moon with red fruit,
                making the curator’s first statement the only lie. The remaining four works keep the
                three-seal grammar intact.
              </p>
            </div>
            <button onClick={beginCase}>REOPEN THE CASE</button>
          </div>
        )}
      </section>

      <section className="method-strip">
        <span>AI GENERATED ART</span>
        <i />
        <span>DETERMINISTIC LOGIC</span>
        <i />
        <span>ONE VERIFIED ANSWER</span>
      </section>

      <section className="case-notes">
        <div>
          <p className="kicker">HOW THE ARCHIVE WORKS</p>
          <h2>AI paints the mystery.<br />Logic keeps it honest.</h2>
        </div>
        <div className="notes-grid">
          <p><span>01</span>Every artwork is generated from a structured visual brief.</p>
          <p><span>02</span>Evidence such as seal counts is rendered by the game, not guessed by AI.</p>
          <p><span>03</span>The rule set is checked so only one accusation can close the case.</p>
        </div>
      </section>

      <footer className="museum-footer">
        <span>K-MEMORIAL · THE CURATOR'S LIE</span>
        <span>CASE 001 · THE FIFTH SEAL</span>
      </footer>

      {opened && (
        <div className="inspection-backdrop" role="presentation" onMouseDown={() => setOpenId(null)}>
          <section
            className="inspection-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspection-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="inspection-head">
              <div>
                <span>CONSERVATION VIEW · {opened.number}</span>
                <h2 id="inspection-title">{opened.title}</h2>
              </div>
              <button onClick={() => setOpenId(null)} aria-label="Close inspection">×</button>
            </div>
            <div className="inspection-body">
              <div className="zoom-viewport">
                <div className="zoom-canvas" style={{ transform: `scale(${zoom})` }}>
                  <img src={opened.image} alt={opened.description} />
                  {opened.seals.map((seal, index) => (
                    <span
                      className="memory-seal large"
                      key={index}
                      style={{ left: `${seal.x}%`, top: `${seal.y}%`, rotate: `${seal.rotate}deg` }}
                    >
                      記
                    </span>
                  ))}
                </div>
              </div>
              <aside className="inspection-notes">
                <span>{opened.season} · {opened.year}</span>
                <h3>{opened.titleKo}</h3>
                <p>{opened.description}</p>
                <dl>
                  <div><dt>MEDIUM</dt><dd>{opened.medium}</dd></div>
                  <div><dt>VISIBLE TRACE</dt><dd>{opened.observation}</dd></div>
                  <div><dt>MEMORY SEALS</dt><dd>Count them in the image.</dd></div>
                </dl>
                <label htmlFor="zoom-range">MAGNIFICATION <strong>{Math.round(zoom * 100)}%</strong></label>
                <input
                  id="zoom-range"
                  type="range"
                  min="1"
                  max="2.4"
                  step="0.1"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
                <button
                  className="modal-suspect"
                  onClick={() => {
                    setSelectedId(opened.id);
                    setOpenId(null);
                  }}
                  disabled={phase !== "investigating"}
                >
                  MARK {opened.number} AS SUSPECT
                </button>
              </aside>
            </div>
          </section>
        </div>
      )}

      {toast && <div className="museum-toast" role="status">{toast}</div>}
    </main>
  );
}
