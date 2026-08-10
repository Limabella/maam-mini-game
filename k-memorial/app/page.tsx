"use client";

import { useEffect, useMemo, useState } from "react";

const CASE_SECONDS = 600;
type Phase = "briefing" | "investigating" | "solved" | "failed";
type Seal = { x: number; y: number; rotate: number };
type Restaurant = {
  id: string; number: string; title: string; titleKo: string; image: string;
  region: string; specialty: string; material: string; description: string;
  observation: string; seals: Seal[]; forged?: boolean;
};

const restaurants: Restaurant[] = [
  { id: "jeonju-bibimbap", number: "I", title: "Jeonju Bibimbap House", titleKo: "전주 비빔밥집", image: "/assets/restaurants/01-jeonju-bibimbap.png", region: "JEONJU", specialty: "BIBIMBAP", material: "HANOK TIMBER · BRASSWARE", description: "An elegant hanok dining room opens onto a quiet courtyard, with brass bowls and a mother-of-pearl cabinet.", observation: "Brass bowls · hanok courtyard · no blue tile", seals: [{ x: 9, y: 14, rotate: -8 }, { x: 84, y: 21, rotate: 7 }, { x: 78, y: 84, rotate: -4 }] },
  { id: "busan-gukbap", number: "II", title: "Busan Gukbap Diner", titleKo: "부산 돼지국밥집", image: "/assets/restaurants/02-busan-gukbap.png", region: "BUSAN", specialty: "DWAEJI-GUKBAP", material: "COBALT TILE · STAINLESS STEEL", description: "A harbor-side diner pairs cobalt wall tile with stainless tables and a steaming stock pot.", observation: "Cobalt-blue tile · stock pot · harbor view", seals: [{ x: 12, y: 81, rotate: 5 }, { x: 87, y: 12, rotate: -6 }, { x: 74, y: 88, rotate: 9 }] },
  { id: "jeju-black-pork", number: "III", title: "Jeju Black Pork Grill", titleKo: "제주 흑돼지집", image: "/assets/restaurants/03-jeju-black-pork.png", region: "JEJU", specialty: "BLACK PORK", material: "VOLCANIC BASALT · COPPER", description: "Volcanic basalt walls, copper exhaust hoods, iron grills, and a tangerine crate define the island room.", observation: "Basalt · copper hood · tangerines", seals: [{ x: 10, y: 11, rotate: -5 }, { x: 86, y: 69, rotate: 8 }, { x: 20, y: 87, rotate: -10 }] },
  { id: "andong-jjimdak", number: "IV", title: "Andong Jjimdak House", titleKo: "안동 찜닭집", image: "/assets/restaurants/04-andong-jjimdak.png", region: "ANDONG", specialty: "JJIMDAK", material: "HANOK BEAMS · EARTHENWARE", description: "Paper lamps warm the timber room, where earthenware and a Hahoe mask recall Andong's cultural landscape.", observation: "Hahoe mask · earthenware · hanok beams", seals: [{ x: 11, y: 84, rotate: 8 }, { x: 79, y: 15, rotate: -7 }, { x: 88, y: 76, rotate: 4 }] },
  { id: "chuncheon-dakgalbi", number: "V", title: "Chuncheon Dakgalbi Hall", titleKo: "춘천 닭갈비집", image: "/assets/restaurants/05-chuncheon-dakgalbi.png", region: "CHUNCHEON", specialty: "DAKGALBI", material: "IRON GRIDDLE · BORROWED TILE", description: "Round iron griddles and suspended exhausts fill the hall, but one regional material seems strangely borrowed.", observation: "Iron griddle · exhaust hood · cobalt-blue tile", seals: [{ x: 8, y: 12, rotate: -7 }, { x: 86, y: 10, rotate: 6 }, { x: 12, y: 86, rotate: 9 }, { x: 85, y: 84, rotate: -5 }], forged: true },
];

const testimonies = [
  "Cobalt-blue wall tile appears only in the Busan diner.",
  "Volcanic basalt belongs only to the Jeju grill.",
  "Every authentic room bears exactly three memory seals.",
  "Jeonju is the only room where brass bowls face an open hanok courtyard.",
  "The Andong room contains neither a harbor view nor a metal exhaust hood.",
];

const hints = [
  "Count the vermilion memory seals in every restaurant scene.",
  "Compare the wall material in the Busan and Chuncheon rooms.",
  "One room borrows another region's signature and bears a fourth seal.",
];

function formatTime(value: number) { const minutes = Math.floor(value / 60); const seconds = value % 60; return `${minutes}:${seconds.toString().padStart(2, "0")}`; }

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
  const selected = restaurants.find((item) => item.id === selectedId) ?? null;
  const opened = restaurants.find((item) => item.id === openId) ?? null;
  const elapsed = CASE_SECONDS - remaining;
  const score = Math.max(100, 1200 - elapsed - attempts * 160 - hintCount * 120);

  useEffect(() => { if (phase !== "investigating") return; const timer = window.setInterval(() => setRemaining((current) => { if (current <= 1) { window.clearInterval(timer); setPhase("failed"); return 0; } return current - 1; }), 1000); return () => window.clearInterval(timer); }, [phase]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenId(null); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, []);
  const activeHints = useMemo(() => hints.slice(0, hintCount), [hintCount]);
  const announce = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 2200); };
  const beginCase = () => { setPhase("investigating"); setRemaining(CASE_SECONDS); setSelectedId(null); setAttempts(0); setHintCount(0); setMarkedStatements(new Set()); announce("Case file opened. Five regions, one borrowed room."); };
  const inspect = (id: string) => { setSelectedId(id); setOpenId(id); setZoom(1); };
  const accuse = () => { if (phase !== "investigating" || !selected) return; if (selected.forged) { setPhase("solved"); return; } const nextAttempts = attempts + 1; setAttempts(nextAttempts); announce(`${selected.title} is regionally consistent. Reopen the evidence.`); if (nextAttempts >= 3) setPhase("failed"); };
  const useHint = () => { if (phase === "investigating" && hintCount < hints.length) setHintCount((current) => current + 1); };
  const toggleStatement = (index: number) => setMarkedStatements((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; });

  return <main className="museum-shell">
    <header className="museum-header">
      <a className="museum-brand" href="#case" aria-label="K-Memorial home"><span className="brand-monogram">KM</span><span><strong>K-MEMORIAL</strong><small>THE CURATOR&apos;S LIE</small></span></a>
      <div className="case-status"><span>CASE 001</span><i /><strong>THE BORROWED ROOM</strong></div>
      <div className="ai-mark"><span className="ai-dot" />AI SCENES · LOGIC VERIFIED</div>
    </header>

    <section className="case-intro" id="case"><div><p className="kicker">PRIVATE VIEWING · 비공개 감정</p><h1>The Curator&apos;s<br /><em>Lie</em></h1></div><div className="intro-brief"><span className="brief-index">01</span><p>Five representative Korean restaurant rooms entered the archive. Four preserve a coherent regional identity. One AI composite has borrowed another region&apos;s visual signature. Inspect every room, test the curator&apos;s claims, and accuse the imitation.</p><small>다섯 지역의 식당 중 다른 고장의 기억을 빌린 가짜 공간을 찾아내세요.</small></div></section>

    <section className="game-board" aria-label="The Curator's Lie game">
      <div className="board-topline"><div><span>KOREAN DINING ARCHIVE · ROOM 01</span><strong>Five Regions, One Borrowed Room</strong></div><div className="case-metrics"><span>TIME <strong>{formatTime(remaining)}</strong></span><span>ERRORS <strong>{attempts}/3</strong></span><span>HINTS <strong>{hintCount}/3</strong></span></div></div>
      <div className="gallery-wall">{restaurants.map((item) => { const isSelected = selectedId === item.id; return <article className={`art-card ${isSelected ? "is-selected" : ""}`} key={item.id}><button className="art-frame" onClick={() => inspect(item.id)} aria-label={`Inspect ${item.title}`}><span className="frame-number">{item.number}</span><span className="art-crop"><img src={item.image} alt={item.description} draggable={false} />{item.seals.map((seal, index) => <span className="memory-seal" key={index} style={{ left: `${seal.x}%`, top: `${seal.y}%`, rotate: `${seal.rotate}deg` }} aria-hidden="true">記</span>)}<span className="inspect-label">INSPECT +</span></span></button><div className="art-label"><span>{item.region}</span><h2>{item.title}</h2><p>{item.titleKo}</p><button className={isSelected ? "suspect-button is-selected" : "suspect-button"} onClick={() => setSelectedId(item.id)} disabled={phase !== "investigating"}>{isSelected ? "SELECTED SUSPECT" : "MARK AS SUSPECT"}</button></div></article>; })}</div>

      <div className="evidence-deck"><section className="testimony-panel"><div className="panel-heading"><div><span>CURATOR&apos;S TESTIMONY</span><h2>Exactly one statement is false.</h2></div><span className="statement-count">05 STATEMENTS</span></div><ol className="statement-list">{testimonies.map((statement, index) => <li key={statement} className={markedStatements.has(index) ? "is-marked" : ""}><button onClick={() => toggleStatement(index)} aria-pressed={markedStatements.has(index)}><span>{String(index + 1).padStart(2, "0")}</span><p>{statement}</p><i>{markedStatements.has(index) ? "SUSPECT" : "MARK"}</i></button></li>)}</ol></section>
        <aside className="deduction-panel"><div><span className="panel-eyebrow">DEDUCTION DESK · 추리 기록</span><h2>{selected ? selected.title : "Choose a suspect"}</h2><p>{selected ? selected.description : "Inspect the restaurant scenes, mark the curator's false statement, and select the room that cannot belong."}</p></div>{activeHints.length > 0 && <div className="hint-stack">{activeHints.map((hint, index) => <p key={hint}><span>TRACE {index + 1}</span>{hint}</p>)}</div>}<div className="desk-actions"><button className="hint-action" onClick={useHint} disabled={phase !== "investigating" || hintCount >= 3}>REQUEST TRACE <span>{3 - hintCount} LEFT</span></button><button className="accuse-action" onClick={accuse} disabled={phase !== "investigating" || !selected}>ACCUSE THIS ROOM</button></div></aside></div>

      {phase === "briefing" && <div className="case-overlay"><p>CASE FILE 001</p><h2>One curator.<br />One lie.<br />One borrowed room.</h2><button onClick={beginCase}>ENTER THE ARCHIVE</button><span>10 MINUTES · 5 REGIONS · 3 TRACES</span></div>}
      {(phase === "solved" || phase === "failed") && <div className={`case-overlay result-overlay ${phase}`}><p>{phase === "solved" ? "CASE SOLVED" : "ARCHIVE LOCKED"}</p><h2>{phase === "solved" ? "Chuncheon Dakgalbi Hall is the composite." : "The curator kept the secret."}</h2><div className="result-summary"><div><span>SCORE</span><strong>{phase === "solved" ? score : "0000"}</strong></div><p>The Chuncheon room alone borrows Busan&apos;s cobalt tile and carries four memory seals. This makes the curator&apos;s first statement the only lie; the other four rooms preserve their regional grammar.</p></div><button onClick={beginCase}>REOPEN THE CASE</button></div>}
    </section>

    <section className="method-strip"><span>AI-GENERATED RESTAURANTS</span><i /><span>DETERMINISTIC LOGIC</span><i /><span>ONE VERIFIED ANSWER</span></section>
    <section className="case-notes"><div><p className="kicker">HOW THE ARCHIVE WORKS</p><h2>AI builds the atmosphere.<br />Logic keeps it honest.</h2></div><div className="notes-grid"><p><span>01</span>Every restaurant scene is generated from a structured regional visual brief.</p><p><span>02</span>Evidence such as seal counts is rendered by the game, not guessed by AI.</p><p><span>03</span>The rule set is checked so only one accusation can close the case.</p></div></section>
    <footer className="museum-footer"><span>K-MEMORIAL · THE CURATOR&apos;S LIE</span><span>CASE 001 · THE BORROWED ROOM</span></footer>

    {opened && <div className="inspection-backdrop" role="presentation" onMouseDown={() => setOpenId(null)}><section className="inspection-modal" role="dialog" aria-modal="true" aria-labelledby="inspection-title" onMouseDown={(event) => event.stopPropagation()}><div className="inspection-head"><div><span>ARCHIVE VIEW · {opened.number}</span><h2 id="inspection-title">{opened.title}</h2></div><button onClick={() => setOpenId(null)} aria-label="Close inspection">×</button></div><div className="inspection-body"><div className="zoom-viewport"><div className="zoom-canvas" style={{ transform: `scale(${zoom})` }}><img src={opened.image} alt={opened.description} />{opened.seals.map((seal, index) => <span className="memory-seal large" key={index} style={{ left: `${seal.x}%`, top: `${seal.y}%`, rotate: `${seal.rotate}deg` }}>記</span>)}</div></div><aside className="inspection-notes"><span>{opened.region} · {opened.specialty}</span><h3>{opened.titleKo}</h3><p>{opened.description}</p><dl><div><dt>MATERIAL</dt><dd>{opened.material}</dd></div><div><dt>VISIBLE TRACE</dt><dd>{opened.observation}</dd></div><div><dt>MEMORY SEALS</dt><dd>Count them in the image.</dd></div></dl><label htmlFor="zoom-range">MAGNIFICATION <strong>{Math.round(zoom * 100)}%</strong></label><input id="zoom-range" type="range" min="1" max="2.4" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><button className="modal-suspect" onClick={() => { setSelectedId(opened.id); setOpenId(null); }} disabled={phase !== "investigating"}>MARK {opened.number} AS SUSPECT</button></aside></div></section></div>}
    {toast && <div className="museum-toast" role="status">{toast}</div>}
  </main>;
}
