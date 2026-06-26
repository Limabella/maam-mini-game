import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { menuById, menuCards } from "./data/menuCards";
import {
  canThrowAtSpeed,
  calculateResult,
  getActiveBoostPower,
  getCurrentSpinFactor,
  getSpinIntensity,
  getThrowImpactVisual,
  getWheelRotation,
  ROUND_DURATION_MS,
  SLICE_DEG,
  THROW_WINDOW_END_MS,
  THROW_WINDOW_START_MS,
} from "./game/roulette";
import { createInitialSoundEnabled, useArcadeAudio, type ArcadeAudio } from "./game/audio";
import {
  createRoomStore,
  getRememberedNickname,
  hasFirebaseConfig,
  rememberNickname,
  type RoomStore,
} from "./services/roomStore";
import type { MenuCard, RoomState, ThrowEntry } from "./types";

const getCodeFromPath = () => {
  const [, segment, code] = window.location.pathname.split("/");
  return segment === "room" && code ? code.toUpperCase().slice(0, 4) : "";
};

const useNow = (active = true) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }

    let frame = 0;
    const tick = () => {
      setNow(Date.now());
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    const fallback = window.setInterval(() => setNow(Date.now()), 100);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(fallback);
    };
  }, [active]);

  return now;
};

const playerCount = (room: RoomState | null) => Object.keys(room?.players ?? {}).length;

const throwCount = (room: RoomState | null) => Object.keys(room?.throws ?? {}).length;

const getGestureBoostPower = (distance: number, duration: number, direction = 1) => {
  const safeDuration = Math.max(24, duration);
  const velocity = distance / safeDuration;
  const distanceBonus = Math.min(distance, 180) / 180;
  const quickBonus = safeDuration < 180 ? (180 - safeDuration) / 180 : 0;
  const magnitude = Math.min(11, Math.max(2.6, 2.8 + velocity * 5.8 + distanceBonus * 2.2 + quickBonus * 1.6));

  return direction < 0 ? -magnitude : magnitude;
};

const formatError = (errorDeg: number) => `${errorDeg.toFixed(2)}°`;

const MENU_DISPLAY_NAMES: Record<string, string> = {
  "kmj-lm": "김치찌개",
  "dnj-lm": "된장찌개",
  "bbp-lm": "비빔밥",
  "sdf-lm": "순두부찌개",
  "jyk-lm": "제육볶음",
  "dks-lm": "돈까스",
  "gks-lm": "국수",
  "nmy-lm": "냉면",
  "sgs-lm": "삼겹살 구이",
  "dgb-lm": "닭갈비",
  "pho-lm": "쌀국수",
  "mlt-lm": "마라탕",
  "sdb-lm": "샐러드 보울",
  "sns-lm": "샌드위치 & 수프",
  "sro-lm": "초밥·롤",
  "udn-lm": "우동",
  "crr-lm": "카레라이스",
  "hbg-lm": "햄버거 세트",
  "dnb-lm": "덮밥",
  "bnt-lm": "도시락",
};

const getMenuDisplayName = (menu: MenuCard | undefined) => (menu ? MENU_DISPLAY_NAMES[menu.id] ?? menu.name : "");

const buildNutritionRows = (menu: MenuCard) => [
  { label: "단백질", value: Math.min(95, 38 + menu.stats.taste * 10 + menu.stats.balance * 2) },
  { label: "탄수화물", value: Math.min(95, 36 + menu.stats.speed * 8 + menu.stats.mood * 3) },
  { label: "지방", value: Math.min(95, 24 + (6 - menu.stats.budget) * 9 + menu.stats.taste * 4) },
  { label: "식이섬유", value: Math.min(95, 30 + menu.stats.balance * 11) },
  { label: "나트륨", value: Math.min(95, 34 + menu.stats.mood * 8 + (6 - menu.stats.budget) * 4) },
];

function App() {
  const [store, setStore] = useState<RoomStore | null>(null);
  const [roomCode, setRoomCode] = useState(getCodeFromPath());
  const [room, setRoom] = useState<RoomState | null>(null);
  const [nickname, setNickname] = useState(getRememberedNickname());
  const [soundEnabled, setSoundEnabled] = useState(createInitialSoundEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const audio = useArcadeAudio(soundEnabled, setSoundEnabled, room?.status === "playing");

  useEffect(() => {
    createRoomStore()
      .then(setStore)
      .catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!store || !roomCode) {
      setRoom(null);
      return;
    }

    return store.watchRoom(roomCode, setRoom);
  }, [roomCode, store]);

  useEffect(() => {
    const onPopState = () => setRoomCode(getCodeFromPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigateToRoom = (nextRoomCode: string) => {
    window.history.pushState({}, "", `/room/${nextRoomCode}`);
    setRoomCode(nextRoomCode);
  };

  const handleCreateRoom = async () => {
    if (!store || !nickname.trim()) {
      return;
    }

    try {
      setBusy(true);
      setMessage("");
      rememberNickname(nickname.trim());
      const nextRoomCode = await store.createRoom(nickname.trim());
      navigateToRoom(nextRoomCode);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "諛??앹꽦???ㅽ뙣?덉뒿?덈떎.");
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async (joinRoomCode: string) => {
    if (!store || !nickname.trim() || !joinRoomCode.trim()) {
      return;
    }

    try {
      setBusy(true);
      setMessage("");
      const normalizedCode = joinRoomCode.trim().toUpperCase();
      rememberNickname(nickname.trim());
      await store.joinRoom(normalizedCode, nickname.trim());
      navigateToRoom(normalizedCode);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "?낆옣???ㅽ뙣?덉뒿?덈떎.");
    } finally {
      setBusy(false);
    }
  };

  if (!store) {
    return (
      <main className="app-shell">
        <section className="panel centered">
          <div className="loader" />
          <p>방 연결 준비 중</p>
        </section>
      </main>
    );
  }

  const currentPlayer = room?.players?.[store.uid] ?? null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigateToHome(setRoomCode)}>
          <span className="brand-mark">LF</span>
          <span>LunchFot</span>
        </button>
        <div className="topbar-tools">
          <button
            className={`icon-button sound-toggle${soundEnabled ? " is-on" : ""}`}
            type="button"
            title={soundEnabled ? "사운드 끄기" : "사운드 켜기"}
            onClick={() => {
              audio.arm();
              setSoundEnabled(!soundEnabled);
            }}
          >
            {soundEnabled ? "♪" : "×"}
          </button>
          <span className={store.mode === "firebase" ? "mode live" : "mode"}>{store.mode}</span>
        </div>
      </header>

      {!roomCode ? (
        <HomeScreen
          busy={busy}
          message={message}
          nickname={nickname}
          setNickname={setNickname}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      ) : !room ? (
        <RoomGate
          busy={busy}
          message={message}
          nickname={nickname}
          roomCode={roomCode}
          setNickname={setNickname}
          onJoinRoom={handleJoinRoom}
        />
      ) : !currentPlayer ? (
        <RoomGate
          busy={busy}
          message={message}
          nickname={nickname}
          roomCode={roomCode}
          setNickname={setNickname}
          onJoinRoom={handleJoinRoom}
        />
      ) : (
        <GameRoom
          audio={audio}
          currentUid={store.uid}
          nickname={currentPlayer.nickname}
          room={room}
          roomCode={roomCode}
          store={store}
        />
      )}

      {!hasFirebaseConfig && (
        <p className="env-note">Firebase 환경변수가 없어서 이 브라우저의 로컬 데모 모드로 실행 중입니다.</p>
      )}
    </main>
  );
}

const navigateToHome = (setRoomCode: (code: string) => void) => {
  window.history.pushState({}, "", "/");
  setRoomCode("");
};

type HomeScreenProps = {
  busy: boolean;
  message: string;
  nickname: string;
  setNickname: (nickname: string) => void;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (roomCode: string) => Promise<void>;
};

function HomeScreen({ busy, message, nickname, setNickname, onCreateRoom, onJoinRoom }: HomeScreenProps) {
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  return (
    <section className="home-grid">
      <div className={`intro${showGameMenu ? " is-picking-game" : ""}`}>
        <p className="eyebrow">짧고 빠른 방 생성 게임 허브</p>
        <h1>게임을 고르고 바로 방을 만드세요.</h1>
        <p className="intro-copy">
          Lunch Dart는 가장 짧고 간단한 방 생성 게임입니다. 아래에서 게임을 고르거나, 이미 받은 코드로 바로 방에 입장할 수 있습니다.
        </p>
        {showGameMenu && (
          <div className="game-list game-list--side">
            <button className="game-tile featured" disabled={busy || !nickname.trim()} type="button" onClick={() => void onCreateRoom()}>
              <strong>1. Lunch Dart</strong>
              <span>3분 내 결정 · 가장 짧은 룰렛 + 다트 게임</span>
            </button>
            <button className="game-tile" disabled type="button">
              <strong>2. Menu Relay</strong>
              <span>추가 예정 · 팀 선택형 미니게임</span>
            </button>
            <button className="game-tile" disabled type="button">
              <strong>3. Budget Battle</strong>
              <span>추가 예정 · 예산 맞추기 플레이스홀더</span>
            </button>
          </div>
        )}
      </div>

      <section className="panel action-panel">
        <label htmlFor="nickname">닉네임</label>
        <input
          id="nickname"
          maxLength={12}
          placeholder="예: Le-bela"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
        />
        <div className="home-actions">
          <button
            className="primary-button"
            disabled={busy || !nickname.trim()}
            type="button"
            onClick={() => setShowGameMenu((value) => !value)}
          >
            게임 생성
          </button>
          <button
            className="ghost-button"
            disabled={busy}
            type="button"
            onClick={() => document.getElementById("roomCode")?.focus()}
          >
            방 입장
          </button>
        </div>
      </section>

      <form
        className="panel action-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void onJoinRoom(joinCode);
        }}
      >
        <label htmlFor="roomCode">방 입장 코드</label>
        <input
          autoCapitalize="characters"
          id="roomCode"
          maxLength={4}
          placeholder="ABCD"
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
        />
        <button className="secondary-button" disabled={busy || !nickname.trim() || joinCode.length !== 4} type="submit">
          방 입장
        </button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </section>
  );
}

type RoomGateProps = {
  busy: boolean;
  message: string;
  nickname: string;
  roomCode: string;
  setNickname: (nickname: string) => void;
  onJoinRoom: (roomCode: string) => Promise<void>;
};

function RoomGate({ busy, message, nickname, roomCode, setNickname, onJoinRoom }: RoomGateProps) {
  return (
    <section className="panel room-gate">
      <p className="room-code-label">방 코드</p>
      <h1 className="room-code">{roomCode}</h1>
      <form
        className="join-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onJoinRoom(roomCode);
        }}
      >
        <label htmlFor="gateNickname">닉네임</label>
        <input
          id="gateNickname"
          maxLength={12}
          placeholder="예: Min"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
        />
        <button className="primary-button" disabled={busy || !nickname.trim()} type="submit">
          참가하기
        </button>
      </form>
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}

type GameRoomProps = {
  audio: ArcadeAudio;
  currentUid: string;
  nickname: string;
  room: RoomState;
  roomCode: string;
  store: RoomStore;
};

type DartFlight = {
  aimOffset: number;
  charge: number;
  landAt: number;
  nickname: string;
  startedAt: number;
  uid: string;
};

function GameRoom({ audio, currentUid, nickname, room, roomCode, store }: GameRoomProps) {
  const now = useNow(room.status === "countdown" || room.status === "playing");
  const prevStatusRef = useRef(room.status);
  const isHost = room.hostUid === currentUid;
  const hasThrown = Boolean(room.throws?.[currentUid]);
  const countdownLeft = Math.max(0, Math.ceil(((room.startAt ?? now) - now) / 1000));
  const spinStartAt = room.spinStartAt ?? null;
  const playingElapsed = spinStartAt ? now - spinStartAt : 0;
  const throwWindowOpen = canThrowAtSpeed(spinStartAt, now, room.spinBoosts);
  const currentSpinFactor = getCurrentSpinFactor(spinStartAt, now, room.spinBoosts);
  const activeFlights = useMemo(
    () =>
      Object.entries(room.throws ?? {})
        .filter(([, entry]) => entry.launchedAt && now < entry.throwAt)
        .map(([uid, entry]) => ({
          aimOffset: entry.aimOffset ?? 0,
          charge: entry.charge ?? 1,
          landAt: entry.throwAt,
          nickname: entry.nickname,
          startedAt: entry.launchedAt ?? entry.throwAt - 680,
          uid,
        })),
    [now, room.throws],
  );

  useEffect(() => {
    if (room.status !== "countdown" || !room.startAt || now < room.startAt) {
      return;
    }

    store.setPlaying(roomCode).catch(console.error);
  }, [now, room.startAt, room.status, roomCode, store]);

  useEffect(() => {
    if (room.status !== "playing") {
      return;
    }

    if (!spinStartAt) {
      return;
    }

    if (playingElapsed < ROUND_DURATION_MS) {
      return;
    }

    const result = calculateResult(room);
    if (result) {
      store.finishGame(roomCode, result).catch(console.error);
    }
  }, [playingElapsed, room, room.status, roomCode, spinStartAt, store]);

  useEffect(() => {
    if (room.status === "result" && room.result && prevStatusRef.current !== "result") {
      audio.playResult();
    }
    prevStatusRef.current = room.status;
  }, [audio, room.result, room.status]);

  const handleStart = () => {
    audio.arm();
    store.startGame(roomCode).catch(console.error);
  };

  const handleThrow = (throwEntry?: Partial<ThrowEntry>) => {
    audio.playThrow();
    store.throwDart(roomCode, nickname, throwEntry).catch(console.error);
  };

  const handleSpinStart = (boostPower: number) => {
    audio.playSpin(Math.abs(boostPower) / 4.2);
    store.startSpin(roomCode, boostPower).catch(console.error);
  };

  const handleReset = () => {
    store.resetRoom(roomCode).catch(console.error);
  };

  if (room.status === "countdown") {
    return (
      <section className="stage countdown-stage">
        <RoomSummary room={room} roomCode={roomCode} />
        <div className="countdown-number">{countdownLeft || "GO"}</div>
      </section>
    );
  }

  if (room.status === "playing") {
    return (
      <section className="stage">
        <RoomSummary room={room} roomCode={roomCode} />
        <RouletteWheel canControl={isHost} flights={activeFlights} now={now} room={room} onSpinStart={handleSpinStart} />
        <div className="throw-panel">
          <div>
            <p className="status-label">{hasThrown ? "다트 기록 완료" : "현재 투척"}</p>
            <strong>{throwCount(room)} / {playerCount(room)}</strong>
          </div>
          <button className="primary-button throw-button" disabled={hasThrown || !spinStartAt} type="button" onClick={() => handleThrow()}>
            Throw Dart
          </button>
        </div>
        <ThrowList room={room} />
        <DartRack
          audio={audio}
          currentSpeed={currentSpinFactor}
          currentUid={currentUid}
          onAimUpdate={(aimOffset, isHolding) => {
            store
              .updateDartAim(
                roomCode,
                isHolding
                  ? {
                      aimOffset,
                      isHolding,
                      nickname,
                      updatedAt: Date.now(),
                    }
                  : null,
              )
              .catch(console.error);
          }}
          onLaunch={(charge, aimOffset, durationMs) => {
            const startedAt = Date.now();
            handleThrow({
              aimOffset,
              charge,
              launchedAt: startedAt,
              throwAt: startedAt + durationMs,
            });
          }}
          room={room}
          spinReady={Boolean(spinStartAt)}
          throwWindowOpen={throwWindowOpen}
        />
      </section>
    );
  }

  if (room.status === "result" && room.result) {
    const selectedMenu = menuById.get(room.result.menuId) ?? menuCards[0];

    return (
      <section className="stage">
        <RoomSummary room={room} roomCode={roomCode} />
        <ResultView
          isHost={isHost}
          menu={selectedMenu}
          roomCode={roomCode}
          room={room}
          onReset={handleReset}
        />
      </section>
    );
  }

  return (
    <section className="stage lobby-stage">
      <RoomSummary room={room} roomCode={roomCode} />
      <PlayerList room={room} />
      {isHost ? (
        <button className="primary-button start-button" type="button" onClick={handleStart}>
          게임 시작
        </button>
      ) : (
        <p className="waiting-text">방장이 시작하면 바로 카운트다운이 시작됩니다.</p>
      )}
      <MenuPreview />
    </section>
  );
}

type RoomSummaryProps = {
  room: RoomState;
  roomCode: string;
};

function RoomSummary({ room, roomCode }: RoomSummaryProps) {
  const shareUrl = `${window.location.origin}/room/${roomCode}`;
  const [copied, setCopied] = useState(false);

  const copyShareUrl = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <section className="room-summary">
      <div>
        <span className="room-code-label">방 코드</span>
        <strong className="compact-code">{roomCode}</strong>
      </div>
      <div className="summary-stat">
        <span>{playerCount(room)}명</span>
        <span>{room.status}</span>
      </div>
      <button className="icon-button" type="button" title="초대 링크 복사" onClick={copyShareUrl}>
        {copied ? "OK" : "↗"}
      </button>
    </section>
  );
}

type PlayerListProps = {
  room: RoomState;
};

function PlayerList({ room }: PlayerListProps) {
  return (
    <section className="panel player-panel">
      <h2>참가자</h2>
      <ul className="player-list">
        {Object.entries(room.players).map(([uid, player]) => (
          <li key={uid}>
            <span className="player-avatar">{player.nickname.slice(0, 1).toUpperCase()}</span>
            <span>{player.nickname}</span>
            {uid === room.hostUid && <em>host</em>}
          </li>
        ))}
      </ul>
    </section>
  );
}

type RouletteWheelProps = {
  canControl: boolean;
  flights: DartFlight[];
  room: RoomState;
  now: number;
  onSpinStart: (boostPower: number) => void;
};

function RouletteWheel({ canControl, flights, room, now, onSpinStart }: RouletteWheelProps) {
  const gestureRef = useRef<{ angle: number; pointerId: number; startedAt: number; x: number; y: number } | null>(null);
  const lastWheelBoostAtRef = useRef(0);
  const [isArmed, setIsArmed] = useState(false);
  const spinStartAt = room.spinStartAt ?? null;
  const isSpinning = Boolean(spinStartAt);
  const elapsed = spinStartAt ? Math.max(0, now - spinStartAt) : 0;
  const activeBoostPower = getActiveBoostPower(room.spinBoosts, now);
  const angle = getWheelRotation(room.seed, spinStartAt, room.wheelSpeed, now, room.spinBoosts);
  const boostMagnitude = Math.abs(activeBoostPower);
  const spinIntensity = Math.min(1, getSpinIntensity(elapsed) + boostMagnitude / 18);
  const wheelStyle = {
    "--boost-intensity": Math.min(1, boostMagnitude / 16).toFixed(3),
    "--spin-intensity": spinIntensity.toFixed(3),
    transform: `translateZ(0) rotate(${angle}deg)`,
  } as CSSProperties;

  const getPointerAngle = (target: HTMLElement, x: number, y: number) => {
    const rect = target.getBoundingClientRect();
    return Math.atan2(y - (rect.top + rect.height / 2), x - (rect.left + rect.width / 2));
  };

  const getAngleDelta = (from: number, to: number) => {
    let delta = to - from;

    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    return delta;
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!canControl || event.button !== 0) {
      return;
    }

    setIsArmed(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gestureRef.current = {
      angle: getPointerAngle(event.currentTarget, event.clientX, event.clientY),
      pointerId: event.pointerId,
      startedAt: Date.now(),
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    gestureRef.current = null;

    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const angleDelta = getAngleDelta(gesture.angle, getPointerAngle(event.currentTarget, event.clientX, event.clientY));
    const distance = Math.hypot(dx, dy);
    const arcDistance = Math.abs(angleDelta) * 180;
    const effectiveDistance = Math.max(distance, arcDistance);
    const duration = Date.now() - gesture.startedAt;

    if (effectiveDistance < 14) {
      return;
    }

    onSpinStart(getGestureBoostPower(effectiveDistance, duration, angleDelta >= 0 ? 1 : -1));
  };

  const handlePointerCancel = (event: PointerEvent<HTMLElement>) => {
    if (gestureRef.current?.pointerId === event.pointerId) {
      gestureRef.current = null;
    }
  };

  const handleWheel = (event: WheelEvent<HTMLElement>) => {
    if (!canControl) {
      return;
    }

    if (!isArmed && !isSpinning) {
      return;
    }

    const nowMs = Date.now();
    if (nowMs - lastWheelBoostAtRef.current < 70) {
      return;
    }

    const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(dominantDelta) < 1) {
      return;
    }

    event.preventDefault();
    lastWheelBoostAtRef.current = nowMs;
    onSpinStart(getGestureBoostPower(Math.min(240, Math.abs(dominantDelta)), 90, dominantDelta >= 0 ? 1 : -1));
  };

  return (
    <section
      className={`wheel-zone${isSpinning ? " is-spinning" : " is-idle"}${isArmed ? " is-armed" : ""}${canControl ? "" : " is-locked"}`}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <div className="dart-pointer" />
      <div
        aria-label={isSpinning ? "회전 중인 룰렛" : "좌클릭으로 룰렛 돌리기"}
        className="wheel"
        role="button"
        style={wheelStyle}
        tabIndex={0}
      >
        {room.menuCards.map((menuId, index) => {
          const menu = menuById.get(menuId) ?? menuCards[index % menuCards.length];

          return (
            <article
              className="wheel-card"
              key={menu.id}
              style={{ "--angle": `${index * SLICE_DEG}deg` } as CSSProperties}
            >
              <MenuImage menu={menu} variant="food" />
              <span>{menu.name}</span>
            </article>
          );
        })}
      </div>
      <RemoteAimLayer currentTime={now} room={room} />
      {Object.entries(room.throws ?? {}).filter(([, entry]) => now >= entry.throwAt).map(([uid, entry]) => {
        const impact = getThrowImpactVisual(room, entry.throwAt);

        return (
          <div
            aria-hidden="true"
            className="impact-dart"
            key={`${uid}-${entry.throwAt}`}
            style={
              {
                "--impact-rotation": `${impact.rotationDeg}deg`,
                "--impact-x": `${impact.xPx}px`,
                "--impact-y": `${impact.yPx}px`,
              } as CSSProperties
            }
          >
            <span className="impact-dart-piece">
              <span className="dart-tip" />
              <span className="dart-body" />
              <span className="dart-fin top" />
              <span className="dart-fin bottom" />
            </span>
          </div>
        );
      })}
      <DartFlightCanvas flights={flights} room={room} />
      <div className="wheel-hub">
        <span>DART</span>
      </div>
    </section>
  );
}

type RemoteAimLayerProps = {
  currentTime: number;
  room: RoomState;
};

function RemoteAimLayer({ currentTime, room }: RemoteAimLayerProps) {
  const activeAims = Object.entries(room.dartAims ?? {}).filter(
    ([uid, aim]) => !room.throws?.[uid] && aim.isHolding && currentTime - aim.updatedAt < 2400,
  );

  return (
    <div className="remote-aim-layer" aria-hidden="true">
      {activeAims.map(([uid, aim]) => (
        <div
          className="remote-aim"
          key={uid}
          style={{ "--aim-offset": aim.aimOffset.toFixed(3) } as CSSProperties}
        >
          <span className="remote-aim-name">{aim.nickname}</span>
          <span className="remote-aim-dart">
            <span className="dart-tip" />
            <span className="dart-body" />
            <span className="dart-fin top" />
            <span className="dart-fin bottom" />
          </span>
        </div>
      ))}
    </div>
  );
}

type DartFlightCanvasProps = {
  flights: DartFlight[];
  room: RoomState;
};

function DartFlightCanvas({ flights, room }: DartFlightCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || flights.length === 0) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let frame = 0;
    const drawDart = (x: number, y: number, angle: number, scale: number) => {
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.scale(scale, scale);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.shadowColor = "rgba(17, 24, 39, 0.28)";
      context.shadowBlur = 10;
      context.shadowOffsetY = 5;
      context.fillStyle = "#111827";
      context.beginPath();
      context.moveTo(-44, 0);
      context.lineTo(-28, -6);
      context.lineTo(-28, 6);
      context.closePath();
      context.fill();
      context.fillRect(-28, -3, 54, 6);
      context.fillStyle = "#2563eb";
      context.beginPath();
      context.moveTo(24, 0);
      context.lineTo(50, -15);
      context.lineTo(44, 0);
      context.lineTo(50, 15);
      context.closePath();
      context.fill();
      context.restore();
    };

    const tick = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);

      const stillFlying = flights.some((flight) => Date.now() < flight.landAt);

      flights.forEach((flight) => {
        const duration = Math.max(520, flight.landAt - flight.startedAt);
        const impact = getThrowImpactVisual(room, flight.landAt);
        const progress = Math.min(1, Math.max(0, (Date.now() - flight.startedAt) / duration));
        const eased = 1 - Math.pow(1 - progress, 3);
        const startX = rect.width * (0.5 + flight.aimOffset * 0.38);
        const startY = rect.height * 0.99;
        const endX = rect.width / 2 + impact.xPx;
        const endY = rect.height / 2 - impact.yPx;
        const controlX = rect.width * (0.5 + flight.aimOffset * 0.18);
        const controlY = rect.height * (0.5 - flight.charge * 0.3);
        const oneMinus = 1 - eased;
        const x = oneMinus * oneMinus * startX + 2 * oneMinus * eased * controlX + eased * eased * endX;
        const y = oneMinus * oneMinus * startY + 2 * oneMinus * eased * controlY + eased * eased * endY;
        const nextT = Math.min(1, eased + 0.02);
        const nextOneMinus = 1 - nextT;
        const nextX = nextOneMinus * nextOneMinus * startX + 2 * nextOneMinus * nextT * controlX + nextT * nextT * endX;
        const nextY = nextOneMinus * nextOneMinus * startY + 2 * nextOneMinus * nextT * controlY + nextT * nextT * endY;
        const angle = Math.atan2(nextY - y, nextX - x);

        context.strokeStyle = `rgba(37, 99, 235, ${0.3 * (1 - progress)})`;
        context.lineWidth = 7;
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo(controlX, controlY, x, y);
        context.stroke();
        drawDart(x, y, angle, 0.78 + eased * 0.16);
      });

      if (stillFlying) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frame);
  }, [flights, room]);

  return <canvas aria-hidden="true" className="dart-flight-canvas" ref={canvasRef} />;
}

type ThrowListProps = {
  room: RoomState;
};

function ThrowList({ room }: ThrowListProps) {
  const throws = Object.values(room.throws ?? {});

  return (
    <section className="throw-list">
      {throws.map((entry) => (
        <span key={`${entry.nickname}-${entry.throwAt}`}>{entry.nickname}</span>
      ))}
    </section>
  );
}

type DartRackProps = {
  audio: ArcadeAudio;
  currentSpeed: number;
  currentUid: string;
  onAimUpdate: (aimOffset: number, isHolding: boolean) => void;
  onLaunch: (charge: number, aimOffset: number, durationMs: number) => void;
  room: RoomState;
  spinReady: boolean;
  throwWindowOpen: boolean;
};

function DartRack({ audio, currentSpeed, currentUid, onAimUpdate, onLaunch, room, spinReady, throwWindowOpen }: DartRackProps) {
  const CHARGE_CYCLE_MS = 1280;
  const [heldUid, setHeldUid] = useState<string | null>(null);
  const [aimOffset, setAimOffset] = useState(0);
  const [, setChargeTick] = useState(0);
  const [flyingUid, setFlyingUid] = useState<string | null>(null);
  const holdRef = useRef<{ pointerId: number; startedAt: number; startX: number } | null>(null);
  const throwTimerRef = useRef<number | null>(null);
  const chargeFrameRef = useRef<number | null>(null);
  const aimUpdateRef = useRef(0);

  useEffect(() => {
    return () => {
      if (throwTimerRef.current) {
        window.clearTimeout(throwTimerRef.current);
      }
      if (chargeFrameRef.current) {
        window.cancelAnimationFrame(chargeFrameRef.current);
      }
    };
  }, []);

  const currentHasThrown = Boolean(room.throws?.[currentUid]);
  const canGrabCurrentDart = spinReady && !currentHasThrown && !flyingUid;

  const getChargePower = (startedAt: number) => {
    const elapsed = Math.max(0, Date.now() - startedAt);
    const cycleProgress = (elapsed % CHARGE_CYCLE_MS) / CHARGE_CYCLE_MS;
    const triangleWave = cycleProgress < 0.5 ? cycleProgress * 2 : (1 - cycleProgress) * 2;
    return 0.18 + triangleWave * 0.82;
  };

  const stopChargeLoop = () => {
    if (chargeFrameRef.current) {
      window.cancelAnimationFrame(chargeFrameRef.current);
      chargeFrameRef.current = null;
    }
  };

  const startChargeLoop = () => {
    stopChargeLoop();

    const tick = () => {
      setChargeTick(Date.now());
      chargeFrameRef.current = window.requestAnimationFrame(tick);
    };

    chargeFrameRef.current = window.requestAnimationFrame(tick);
  };

  const resetHold = () => {
    holdRef.current = null;
    stopChargeLoop();
    setHeldUid(null);
    setChargeTick(0);
    setAimOffset(0);
  };

  const handlePointerDown = (uid: string, event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || uid !== currentUid || !canGrabCurrentDart) {
      audio.playDenied();
      return;
    }

    audio.arm();
    audio.playGrab();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    holdRef.current = {
      pointerId: event.pointerId,
      startedAt: Date.now(),
      startX: event.clientX,
    };
    setHeldUid(uid);
    setAimOffset(0);
    onAimUpdate(0, true);
    setChargeTick(Date.now());
    startChargeLoop();
  };

  const handlePointerMove = (uid: string, event: PointerEvent<HTMLButtonElement>) => {
    const hold = holdRef.current;
    if (uid !== currentUid || heldUid !== uid || !hold || hold.pointerId !== event.pointerId) {
      return;
    }

    const nextAimOffset = Math.max(-1, Math.min(1, (event.clientX - hold.startX) / 120));
    setAimOffset(nextAimOffset);

    const nowMs = Date.now();
    if (nowMs - aimUpdateRef.current > 80) {
      aimUpdateRef.current = nowMs;
      onAimUpdate(nextAimOffset, true);
    }
  };

  const handleRelease = (uid: string, event: PointerEvent<HTMLButtonElement>) => {
    const hold = holdRef.current;
    if (uid !== currentUid || heldUid !== uid || !hold || hold.pointerId !== event.pointerId) {
      return;
    }

    const finalCharge = getChargePower(hold.startedAt);
    const finalAimOffset = aimOffset;
    resetHold();

    if (!canGrabCurrentDart || !throwWindowOpen || finalCharge < 0.34) {
      onAimUpdate(0, false);
      audio.playDenied();
      return;
    }

    const durationMs = 680;
    setFlyingUid(uid);
    onLaunch(finalCharge, finalAimOffset, durationMs);
    throwTimerRef.current = window.setTimeout(() => {
      setFlyingUid(null);
    }, durationMs);
  };

  const handleCancel = (uid: string) => {
    if (heldUid !== uid) {
      return;
    }

    resetHold();
    onAimUpdate(0, false);
  };

  return (
    <section className="dart-rack" aria-label="Dart players">
      <div className="dart-rack-head">
        <span>룰렛 플레이어</span>
        <strong>{room.players[room.hostUid]?.nickname ?? "host"}</strong>
      </div>
      <div className="dart-speed-meter" aria-hidden="true">
        <span>투척 가능 시간</span>
        <strong>
          {(THROW_WINDOW_START_MS / 1000).toFixed(0)} - {(THROW_WINDOW_END_MS / 1000).toFixed(0)}초
        </strong>
        <em>{currentSpeed.toFixed(2)}</em>
      </div>
      <div className="dart-grid">
        {Object.entries(room.players).map(([uid, player]) => {
          const isCurrent = uid === currentUid;
          const isHost = uid === room.hostUid;
          const isHeld = heldUid === uid;
          const isFlying = flyingUid === uid;
          const isThrown = Boolean(room.throws?.[uid]);
          const disabled = !isCurrent || !spinReady || isThrown || Boolean(flyingUid);
          const chargePower =
            isHeld && holdRef.current ? getChargePower(holdRef.current.startedAt) : isFlying ? 1 : 0;
          const visibleAimOffset = isHeld ? aimOffset : 0;

          return (
            <article
              className={`dart-card${isCurrent ? " is-own" : ""}${isHost ? " is-host" : ""}${isHeld ? " is-held" : ""}${isFlying ? " is-flying" : ""}${isThrown ? " is-thrown" : ""}`}
              key={uid}
              style={
                {
                  "--throw-charge": chargePower.toFixed(2),
                  "--aim-offset": visibleAimOffset.toFixed(3),
                } as CSSProperties
              }
            >
              <button
                aria-label={`${player.nickname} dart`}
                className="dart-handle"
                disabled={disabled}
                onPointerCancel={() => handleCancel(uid)}
                onPointerDown={(event) => handlePointerDown(uid, event)}
                onPointerMove={(event) => handlePointerMove(uid, event)}
                onPointerUp={(event) => handleRelease(uid, event)}
                type="button"
              >
                <span className="dart-piece" aria-hidden="true">
                  <span className="dart-tip" />
                  <span className="dart-body" />
                  <span className="dart-fin top" />
                  <span className="dart-fin bottom" />
                </span>
              </button>
              <div className="dart-gauge" aria-hidden="true">
                <span style={{ "--gauge-fill": `${Math.round(chargePower * 100)}%` } as CSSProperties} />
              </div>
              <span className="dart-name">{player.nickname}</span>
              <span className="dart-role">{isHost ? "룰렛 + 다트" : "다트"}</span>
              {isCurrent && !spinReady && <span className="dart-hint">룰렛 시작 대기</span>}
              {isCurrent && spinReady && !isThrown && !isFlying && !throwWindowOpen && (
                <span className="dart-hint">룰렛이 충분히 느려질 때까지 대기</span>
              )}
              {isCurrent && spinReady && !isThrown && !isFlying && throwWindowOpen && (
                <span className="dart-hint">좌클릭 홀드로 게이지 조절 후 놓기</span>
              )}
              {isThrown && <span className="dart-hint">투척 완료</span>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MenuPreview() {
  const featured = useMemo(() => menuCards.slice(0, 6), []);

  return (
    <section className="menu-strip">
      {featured.map((menu) => (
        <article className="menu-tile" key={menu.id}>
          <MenuImage menu={menu} variant="food" />
          <span>{menu.name}</span>
        </article>
      ))}
    </section>
  );
}

type ResultViewProps = {
  isHost: boolean;
  menu: MenuCard;
  room: RoomState;
  roomCode: string;
  onReset: () => void;
};

function ResultView({ isHost, menu, room, roomCode, onReset }: ResultViewProps) {
  const displayName = getMenuDisplayName(menu);
  const shareText = `오늘 점심은 ${displayName} (${roomCode})`;
  const rankings = room.result?.rankings ?? [];

  const copyResult = async () => {
    await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
  };

  return (
    <section className="result-layout">
      <article className="result-menu-card">
        <MenuImage menu={menu} variant="card" />
        <div className="result-map-overlay">
          <span>근처 맛집 위치</span>
          <strong>{displayName}</strong>
          <i />
        </div>
        <div className="result-map-note">
          <span>추천 후보</span>
          <strong>반경 800m · 임시 지도</strong>
        </div>
        <div className="result-bot" aria-hidden="true">
          <span className="bot-head">
            <i />
          </span>
          <span className="bot-body" />
        </div>
      </article>
      <section className="panel result-detail">
        <span className="status-label">가장 정확한 다트 결과</span>
        <h2>{room.result?.winnerNickname}</h2>
        <p>
          {displayName} · 오차 {formatError(room.result?.errorDeg ?? 0)}
        </p>
        <div className="result-rankings">
          {rankings.map((entry) => (
            <article className="result-rank-row" key={`${entry.uid}-${entry.throwAt}`}>
              <strong>{entry.rank}</strong>
              <span>{entry.nickname}</span>
              <span>{getMenuDisplayName(menuById.get(entry.menuId))}</span>
              <em>{formatError(entry.errorDeg)}</em>
            </article>
          ))}
        </div>
        <div className="result-actions">
          <button className="secondary-button" type="button" onClick={copyResult}>
            결과 공유
          </button>
          {isHost && (
            <button className="ghost-button" type="button" onClick={onReset}>
              다시 하기
            </button>
          )}
        </div>
      </section>
    </section>
  );
}

function MenuImage({ menu, variant = "card" }: { menu: MenuCard; variant?: "card" | "food" }) {
  const [src, setSrc] = useState(menu.imageUrl);

  useEffect(() => {
    setSrc(menu.imageUrl);
  }, [menu.imageUrl]);

  return (
    <span className={`menu-image menu-image--${variant}`}>
      <img
        alt=""
        src={src}
        onError={() => {
          if (src !== menu.fallbackImageUrl) {
            setSrc(menu.fallbackImageUrl);
          }
        }}
      />
    </span>
  );
}

export default App;

