import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import * as THREE from "three";
import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import AssetLab from "./AssetLab";
import { menuById, menuCards } from "./data/menuCards";
import { getMenuDisplayName, getRacerForMenu } from "./data/sushiRacers";
import { createInitialSoundEnabled, useArcadeAudio, type ArcadeAudio } from "./game/audio";
import {
  FINALIST_COUNT,
  VOTE_LIMIT,
  calculateRaceResult,
  formatRaceTime,
  getActiveRaceEvents,
  getPlateStackImpactElapsedMs,
  getPlateStackTargetLaneIndex,
  getRaceLaneStates,
  getVoteTallies,
  hasRaceWinner,
  PLATE_STACK_HIT_HOLD_MS,
  PLATE_STACK_IMPACT_PROGRESS,
  selectFinalists,
} from "./game/sushiRace";
import {
  createRoomStore,
  getRememberedNickname,
  hasFirebaseConfig,
  rememberNickname,
  type RoomStore,
} from "./services/roomStore";
import type { MenuCard, RaceEventType, RoomState, RoomStatus } from "./types";

const getCodeFromPath = () => {
  const [, segment, code] = window.location.pathname.split("/");
  return segment === "room" && code ? code.toUpperCase().slice(0, 4) : "";
};

const getFallbackNickname = (uid: string) => {
  const suffix = uid.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() || "FOT";
  return `FOT-${suffix}`;
};

const useNow = (active = true) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }

    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 80);

    return () => {
      window.clearInterval(interval);
    };
  }, [active]);

  return now;
};

const navigateToHome = (setRoomCode: (code: string) => void) => {
  window.history.pushState({}, "", "/");
  setRoomCode("");
};

const playerCount = (room: RoomState | null) => Object.keys(room?.players ?? {}).length;

const getVoteCount = (room: RoomState, uid: string) => room.votes?.[uid]?.menuIds.length ?? 0;

const VOTE_WINDOW_MS = 60_000;
const getVoteWindowRemainingMs = (room: RoomState, now: number) => Math.max(0, room.createdAt + VOTE_WINDOW_MS - now);

const getAssetStem = (menu: MenuCard) => {
  const match = menu.imageUrl.match(/\/([^/]+)\.png$/);
  return match?.[1] ?? menu.id.replace("-lm", "");
};

const getFoodImageUrl = (menu: MenuCard) => `/food/food_${getAssetStem(menu)}.png`;

const getRunnerImageUrl = (menu: MenuCard) => `/hero/runner_${getAssetStem(menu)}.png`;

const getResultCardImageUrl = (menu: MenuCard) => `/card/lf-card/${getAssetStem(menu)}_lf.png`;

const RACE_TRACK_STACK_Z_OFFSET = 0.012;
const RACE_EVENT_STACK_Y_OFFSET = 0.7;
const RACE_TRACK_START_X = -4.25;
const RACE_TRACK_END_X = 3.55;
const RACE_TRACK_RAIL_ZS = [-1.62, 1.72] as const;
const RACE_TRACK_RAIL_Y_OFFSETS = [-0.02, 0] as const;
const RACE_TRACK_SHADOW_Y_OFFSETS = [-0.02, 0] as const;
const RACE_TRACK_RAIL_WIDTH = RACE_TRACK_END_X - RACE_TRACK_START_X + 0.9;
const RACE_TRACK_RAIL_DEPTH = 0.82;
const RACE_TRACK_FINISH_WIDTH = 0.18;
const RACE_PLATE_SPRITE_WIDTH = 0.58;
const RACE_PLATE_SPRITE_HEIGHT = 0.87;
const RACE_PLATE_ENTRY_X = RACE_TRACK_END_X + 0.92;
const RACE_PLATE_RAIL_BASE_Y = [0.19, 0.21] as const;
const RACE_PLATE_RAIL_FRONT_Z_OFFSET = 0.08;

const getRaceModelUrl = (menuId: string) => {
  const menuIndex = Math.max(0, menuCards.findIndex((menu) => menu.id === menuId));
  return `/3d_glb/3m_${String(menuIndex + 1).padStart(3, "0")}.glb`;
};

const applyRaceRenderPriority = (root: THREE.Object3D, renderOrder: number) => {
  root.renderOrder = renderOrder;
  root.traverse((child) => {
    child.renderOrder = renderOrder;

    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) {
        return;
      }

      const clonedMaterial = material.clone();
      const usesAlpha = clonedMaterial.transparent || clonedMaterial.opacity < 1 || clonedMaterial.alphaTest > 0;
      clonedMaterial.depthTest = true;
      clonedMaterial.depthWrite = !usesAlpha;
      child.material = Array.isArray(child.material)
        ? (child.material as THREE.Material[]).map((entry) => (entry === material ? clonedMaterial : entry))
        : clonedMaterial;
    });
  });
};

type LoadedRaceModel = {
  model: THREE.Group;
  clips: THREE.AnimationClip[];
  grabClip?: THREE.AnimationClip;
  fallClip?: THREE.AnimationClip;
};

const selectRunningClips = (clips: THREE.AnimationClip[]) => {
  if (!clips.length) {
    return [];
  }

  const runningClip = clips.reduce((best, clip) =>
    Math.abs(clip.duration - 1.25) < Math.abs(best.duration - 1.25) ? clip : best,
  );
  return [runningClip];
};

const selectGrabClip = (clips: THREE.AnimationClip[], runningClips: THREE.AnimationClip[]) => {
  const runningClip = runningClips[0];
  return clips
    .filter((clip) => clip !== runningClip)
    .sort((a, b) => Math.abs(a.duration - 0.79) - Math.abs(b.duration - 0.79))[0];
};

const selectFallClip = (clips: THREE.AnimationClip[], runningClips: THREE.AnimationClip[], grabClip?: THREE.AnimationClip) => {
  const runningClip = runningClips[0];
  const remainingClips = clips.filter((clip) => clip !== runningClip && clip !== grabClip);
  const namedFallClip = remainingClips.find((clip) => /fall|down|knock|hit|lose/i.test(clip.name));

  return namedFallClip ?? remainingClips.sort((a, b) => b.duration - a.duration)[0];
};

const raceModelCache = new Map<string, LoadedRaceModel>();
const raceModelPromises = new Map<string, Promise<LoadedRaceModel>>();
const LOADING_BOT_MODEL_URL = "/3d_glb/winlose_bgj.glb";
let loadingBotModel: LoadedRaceModel | null = null;
let loadingBotPromise: Promise<LoadedRaceModel> | null = null;

const createLoadedRaceModel = (root: THREE.Object3D, clips: THREE.AnimationClip[]): LoadedRaceModel => {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxSize = Math.max(size.x, size.y, size.z) || 1;

  const normalized = new THREE.Group();
  root.position.set(-center.x, -box.min.y, -center.z);
  normalized.add(root);
  normalized.scale.setScalar(1 / maxSize);

  const runningClips = selectRunningClips(clips);
  const grabClip = selectGrabClip(clips, runningClips);
  const fallClip = selectFallClip(clips, runningClips, grabClip);

  return {
    model: normalized,
    clips: runningClips,
    grabClip,
    fallClip,
  };
};

const loadRaceModel = (menuId: string) => {
  const cachedModel = raceModelCache.get(menuId);

  if (cachedModel) {
    return Promise.resolve(cachedModel);
  }

  const loadingModel = raceModelPromises.get(menuId);

  if (loadingModel) {
    return loadingModel;
  }

  const promise = new Promise<LoadedRaceModel>((resolve, reject) => {
    new GLTFLoader().load(
      getRaceModelUrl(menuId),
      (gltf) => {
        const loadedModel = createLoadedRaceModel(gltf.scene, gltf.animations);
        raceModelCache.set(menuId, loadedModel);
        raceModelPromises.delete(menuId);
        resolve(loadedModel);
      },
      undefined,
      (error) => {
        raceModelPromises.delete(menuId);
        reject(error);
      },
    );
  });

  raceModelPromises.set(menuId, promise);
  return promise;
};

const loadLoadingBotModel = () => {
  if (loadingBotModel) {
    return Promise.resolve(loadingBotModel);
  }

  if (loadingBotPromise) {
    return loadingBotPromise;
  }

  loadingBotPromise = new Promise<LoadedRaceModel>((resolve, reject) => {
    new GLTFLoader().load(
      LOADING_BOT_MODEL_URL,
      (gltf) => {
        loadingBotModel = createLoadedRaceModel(gltf.scene, gltf.animations);
        loadingBotPromise = null;
        resolve(loadingBotModel);
      },
      undefined,
      (error) => {
        loadingBotPromise = null;
        reject(error);
      },
    );
  });

  return loadingBotPromise;
};

const preloadRaceModels = (menuIds: string[]) => {
  return Promise.all(menuIds.map((menuId) => loadRaceModel(menuId)));
};

type GamePhaseId = "sushi" | "pending" | "dart";

type FlowStepId = "main" | "game-select" | "vote-select" | "playing" | "result";

const GAME_PHASES: Array<{
  id: GamePhaseId;
  label: string;
  enabled: boolean;
}> = [
  { id: "sushi", label: "Conveyor Sushi Race", enabled: true },
  { id: "pending", label: "Coming Soon", enabled: false },
  { id: "dart", label: "Bibimbap's Top Spin", enabled: false },
];

const FLOW_STEPS: Record<FlowStepId, string> = {
  main: "main",
  "game-select": "Game Select",
  "vote-select": "Vote Select",
  playing: "Race",
  result: "Results",
};

const ROOM_STATUS_TO_STEP: Record<RoomStatus, FlowStepId> = {
  lobby: "vote-select",
  countdown: "playing",
  playing: "playing",
  result: "result",
};

const getRoomStepLabel = (status: RoomStatus) => FLOW_STEPS[ROOM_STATUS_TO_STEP[status]];

const RACE_EVENT_META: Record<RaceEventType, { icon: string; label: string }> = {
  chopsticks: { icon: "\u{1F962}", label: "Hand Grab" },
  "reverse-belt": { icon: "\u21A9", label: "Reverse Rail" },
  "green-tea": { icon: "\u{1F375}", label: "Green Tea Slip" },
  "plate-stack": { icon: "\u{1F37D}\uFE0F", label: "Plate Rush" },
};


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
    if (!store) {
      return;
    }

    const activeNickname = nickname.trim() || getFallbackNickname(store.uid);

    try {
      setBusy(true);
      setMessage("");
      setNickname(activeNickname);
      rememberNickname(activeNickname);
      const nextRoomCode = await store.createRoom(activeNickname);
      navigateToRoom(nextRoomCode);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create room.");
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async (joinRoomCode: string) => {
    if (!store || !joinRoomCode.trim()) {
      return;
    }

    const activeNickname = nickname.trim() || getFallbackNickname(store.uid);

    try {
      setBusy(true);
      setMessage("");
      const normalizedCode = joinRoomCode.trim().toUpperCase();
      setNickname(activeNickname);
      rememberNickname(activeNickname);
      await store.joinRoom(normalizedCode, activeNickname);
      navigateToRoom(normalizedCode);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to join room.");
    } finally {
      setBusy(false);
    }
  };

  if (!store) {
    return (
      <main className="app-shell">
        <section className="panel centered">
          <div className="loader" />
          <p>Preparing room connection</p>
        </section>
      </main>
    );
  }

  const currentPlayer = room?.players?.[store.uid] ?? null;
  const appShellClassName = [
    "app-shell",
    !roomCode ? "is-home" : "",
    room?.status === "lobby" ? "is-vote-lobby" : "",
    room?.status === "countdown" ? "is-countdown-screen" : "",
    room?.status === "result" ? "is-result-screen" : "",
    room?.status === "playing" ? "is-race-playing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={appShellClassName}>
      <button className="fixed-brand-logo" type="button" aria-label="LunchFot home" onClick={() => navigateToHome(setRoomCode)}>
        <img src="/other/lunchfot-icon-cutout.png" alt="LunchFot" />
      </button>
      <header className="topbar">
        <div className="topbar-tools">
          <button
            className={`icon-button sound-toggle${soundEnabled ? " is-on" : ""}`}
            type="button"
            title={soundEnabled ? "Mute sound" : "Enable sound"}
            onClick={() => {
              audio.arm();
              setSoundEnabled(!soundEnabled);
            }}
          >
            {soundEnabled ? "\u266A" : "\u266A"}
          </button>
          <span className={store.mode === "firebase" ? "mode live" : "mode"}>{store.mode}</span>
        </div>
      </header>

      {!roomCode ? (
        <HomeScreen busy={busy} message={message} onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      ) : !room || !currentPlayer ? (
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
        <p className="env-note">Firebase config is missing, so this browser is running in local demo mode.</p>
      )}
    </main>
  );
}

type HomeScreenProps = {
  busy: boolean;
  message: string;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (roomCode: string) => Promise<void>;
};

function HomeScreen({ busy, message, onCreateRoom, onJoinRoom }: HomeScreenProps) {
  const [joinCode, setJoinCode] = useState("");
  const [homeMode, setHomeMode] = useState<"idle" | "games" | "join">("idle");
  const [assetLabOpen, setAssetLabOpen] = useState(false);

  const requestJoin = () => {
    if (joinCode.length === 4) {
      void onJoinRoom(joinCode);
      return;
    }

    window.setTimeout(() => document.getElementById("roomCode")?.focus(), 20);
  };

  return (
    <>
    <section className="home-screen">
      <button
        className="home-settings-button"
        type="button"
        aria-label="Asset Lab"
        title="Asset Lab"
        onClick={() => setAssetLabOpen(true)}
      >
        {"\u2699"}
      </button>
      <div className="home-content">
        <div className="home-title" aria-label="Lunch Fot">
          <span className="home-mark">
            <img src="/other/maam-food-logo.png" alt="MaAM Food" />
          </span>
          <strong>Lunch Fot</strong>
        </div>

        <div className="home-menu" aria-label="Main menu">
          <button type="button" disabled={busy} onClick={() => setHomeMode("games")}>
            {"Create Game"}
          </button>

          {homeMode === "games" && (
            <div className="game-picker" aria-label="Game select">
              {GAME_PHASES.map((phase) => (
                <button
                  key={phase.id}
                  className={`game-option${phase.enabled ? " is-live" : ""}`}
                  disabled={busy || !phase.enabled}
                  type="button"
                  onClick={() => {
                    if (phase.enabled) {
                      void onCreateRoom();
                    }
                  }}
                >
                  {phase.label}
                </button>
              ))}
            </div>
          )}

          <button type="button" disabled={busy} onClick={() => setHomeMode("join")}>
            {"Join Room"}
          </button>

        </div>

        {homeMode === "join" && (
          <form
            className="join-code-holder"
            aria-label="Join room"
            onSubmit={(event) => {
              event.preventDefault();
              requestJoin();
            }}
          >
            <input
              autoCapitalize="characters"
              aria-label="room code"
              className="home-code-input"
              id="roomCode"
              maxLength={4}
              placeholder={"Room code"}
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            />
            <button className="join-play-button" disabled={busy || joinCode.length !== 4} type="submit" aria-label="Play">
              {"\u25b6"}
            </button>
          </form>
        )}

        {message && <p className="form-message home-message">{message}</p>}
      </div>
    </section>
    {assetLabOpen && (
      <div className="asset-modal" role="dialog" aria-modal="true" aria-label="Character Motion Lab">
        <div className="asset-modal__backdrop" onClick={() => setAssetLabOpen(false)} />
        <section className="asset-modal__panel">
          <button className="asset-modal__close" type="button" aria-label="Close Asset Lab" onClick={() => setAssetLabOpen(false)}>
            X
          </button>
          <AssetLab embedded />
        </section>
      </div>
    )}
    </>
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
      <p className="room-code-label">Room Code</p>
      <h1 className="room-code">{roomCode}</h1>
      <form
        className="join-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onJoinRoom(roomCode);
        }}
      >
        <label htmlFor="gateNickname">Nickname</label>
        <input
          id="gateNickname"
          maxLength={12}
          placeholder="ex. Min"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
        />
        <button className="primary-button" disabled={busy || !nickname.trim()} type="submit">
          Join
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

function GameRoom({ audio, currentUid, nickname, room, roomCode, store }: GameRoomProps) {
  const now = useNow(room.status === "lobby" || room.status === "countdown" || room.status === "playing");
  const prevStatusRef = useRef(room.status);
  const prevRaceVisibleRef = useRef(false);
  const [raceModelsReady, setRaceModelsReady] = useState(false);
  const [raceModelFallback, setRaceModelFallback] = useState(false);
  const [raceVisualKey, setRaceVisualKey] = useState("");
  const [raceVisualOffset, setRaceVisualOffset] = useState(0);
  const isHost = room.hostUid === currentUid;
  const finalistIds = room.finalists?.length ? room.finalists : selectFinalists(room);
  const finalistKey = finalistIds.slice(0, FINALIST_COUNT).join("|");
  const currentRaceVisualKey = `${roomCode}:${room.seed}:${room.raceStartedAt ?? 0}`;

  useEffect(() => {
    loadLoadingBotModel().catch(console.error);
  }, []);

  useEffect(() => {
    if (!isHost || room.status !== "countdown" || !room.startAt || now < room.startAt || !raceModelsReady) {
      return;
    }

    store.setPlaying(roomCode).catch(console.error);
  }, [isHost, now, raceModelsReady, room.startAt, room.status, roomCode, store]);

  useEffect(() => {
    if (!isHost || room.status !== "playing" || !room.raceStartedAt || !hasRaceWinner(room, now)) {
      return;
    }

    store.finishGame(roomCode, calculateRaceResult(room)).catch(console.error);
  }, [isHost, now, room, room.status, roomCode, store]);

  useEffect(() => {
    const isRaceVisible = room.status === "playing" && raceModelsReady;

    if (isRaceVisible && !prevRaceVisibleRef.current) {
      audio.playSpin(1.2);
    }

    if (room.status === "result" && room.result && prevStatusRef.current !== "result") {
      audio.playResult();
    }

    prevRaceVisibleRef.current = isRaceVisible;
    prevStatusRef.current = room.status;
  }, [audio, raceModelsReady, room.result, room.status]);

  useEffect(() => {
    if (room.status !== "countdown" && room.status !== "playing") {
      setRaceModelsReady(false);
      setRaceModelFallback(false);
      return;
    }

    let cancelled = false;
    setRaceModelsReady(false);
    setRaceModelFallback(false);
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) {
        setRaceModelFallback(true);
        setRaceModelsReady(true);
      }
    }, 12_000);

    preloadRaceModels(finalistIds.slice(0, FINALIST_COUNT))
      .then(() => {
        if (!cancelled) {
          window.clearTimeout(fallbackTimer);
          setRaceModelFallback(false);
          setRaceModelsReady(true);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          window.clearTimeout(fallbackTimer);
          setRaceModelFallback(true);
          setRaceModelsReady(true);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [finalistKey, room.status]);

  useEffect(() => {
    if (room.status !== "playing" || !room.raceStartedAt || !raceModelsReady) {
      if (room.status !== "playing") {
        setRaceVisualKey("");
        setRaceVisualOffset(0);
      }
      return;
    }

    if (raceVisualKey === currentRaceVisualKey) {
      return;
    }

    setRaceVisualKey(currentRaceVisualKey);
    setRaceVisualOffset(Math.max(0, now - room.raceStartedAt));
  }, [currentRaceVisualKey, now, raceModelsReady, raceVisualKey, room.raceStartedAt, room.status]);

  const handleStart = () => {
    audio.arm();
    audio.playGrab();
    store.startGame(roomCode).catch(console.error);
  };

  const handleReset = () => {
    store.resetRoom(roomCode).catch(console.error);
  };

  const isRacePreparing = room.status === "countdown" || (room.status === "playing" && !raceModelsReady);
  const raceVisualNow =
    room.status === "playing" && room.raceStartedAt && raceVisualKey === currentRaceVisualKey
      ? Math.max(room.raceStartedAt, now - raceVisualOffset)
      : now;

  if (isRacePreparing) {
    return <RaceLoadingStage />;
  }

  if (room.status === "playing" && raceModelsReady) {
    return (
      <section className="stage race-stage">
        {raceModelFallback ? <PixiSushiRaceTrack room={room} now={raceVisualNow} /> : <ThreeSushiRaceTrack room={room} now={raceVisualNow} />}
      </section>
    );
  }

  if (room.status === "result" && room.result) {
    return (
      <section className="stage result-stage">
        <ResultView room={room} />
      </section>
    );
  }

  return (
    <section className="stage lobby-stage">
      <div className="lobby-info-row">
        <RoomSummary room={room} roomCode={roomCode} />
        <VoteNotice room={room} now={now} />
        <PlayerList room={room} />
      </div>
      <VoteBoard
        currentUid={currentUid}
        isHost={isHost}
        nickname={nickname}
        room={room}
        roomCode={roomCode}
        store={store}
        onStart={handleStart}
      />
    </section>
  );
}

type RoomSummaryProps = {
  room: RoomState;
  roomCode: string;
};

function VoteNotice({ room, now }: { room: RoomState; now: number }) {
  const remainingSeconds = Math.ceil(getVoteWindowRemainingMs(room, now) / 1000);

  return (
    <p className="vote-notice">
      <span>{"\u203B"} {remainingSeconds > 0 ? `${remainingSeconds}s vote time` : "Vote time ended"}</span> Invite players and choose 1-6 menus. Top 6 racers enter; ties are randomized.
    </p>
  );
}

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
        <span className="room-code-label">Room Code</span>
        <strong className="compact-code">{roomCode}</strong>
      </div>
      <div className="summary-stat">
        <span>{playerCount(room)} players</span>
        <span>{getRoomStepLabel(room.status)}</span>
      </div>
      <button className="icon-button" type="button" title="Copy invite link" onClick={copyShareUrl}>
        {copied ? "OK" : "\u2197"}
      </button>
    </section>
  );
}

function RaceLoadingStage() {
  const [logoSrc, setLogoSrc] = useState("/other/maam-food-logo.png");

  return (
    <section className="countdown-stage race-loading-stage" aria-label="Loading race assets">
      <img
        className="countdown-logo race-loading-logo"
        src={logoSrc}
        alt="MaAM Food"
        onError={() => {
          setLogoSrc((current) => (current === "/other/maam-food-logo.png" ? "/background/maam-food-logo.png" : "/other/lunchfot-icon-cutout.png"));
        }}
      />
      <div className="race-loading-runway">
        <LoadingBotRunner />
        <div className="race-loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}

function LoadingBotRunner() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hasModel, setHasModel] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2.8, 2.8, 1.25, -1.05, 0.1, 20);
    camera.position.set(0, 0.9, 5);
    camera.lookAt(0, 0.18, 0);

    const ambient = new THREE.HemisphereLight(0xfff8dc, 0x0f172a, 2.4);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(1.4, 3.2, 4.2);
    key.castShadow = true;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xfbbf24, 1.2);
    fill.position.set(-2.8, 1.8, 2.4);
    scene.add(fill);

    let runner: THREE.Group | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let cancelled = false;
    let frameId = 0;
    let previousFrameTime = performance.now();

    const resize = () => {
      const rect = host.getBoundingClientRect();
      renderer.setSize(Math.max(240, Math.round(rect.width)), Math.max(160, Math.round(rect.height)), false);
    };

    const renderFrame = (frameTime: number) => {
      if (cancelled) {
        return;
      }

      const delta = Math.min(0.05, Math.max(0, (frameTime - previousFrameTime) / 1000));
      previousFrameTime = frameTime;
      const progress = (frameTime % 1300) / 1300;

      if (runner) {
        runner.position.set(-0.42 + progress * 0.84, 0.08 + Math.sin(frameTime / 92) * 0.014, 0);
        runner.rotation.z = Math.sin(frameTime / 105) * 0.025;
      }

      mixer?.update(delta);
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(renderFrame);
    };

    resize();
    window.addEventListener("resize", resize);

    loadLoadingBotModel()
      .then((loadedModel) => {
        if (cancelled) {
          return;
        }

        runner = cloneSkeleton(loadedModel.model) as THREE.Group;
        runner.scale.setScalar(0.28);
        runner.rotation.y = 0;
        scene.add(runner);
        setHasModel(true);

        if (loadedModel.clips.length) {
          mixer = new THREE.AnimationMixer(runner);
          loadedModel.clips.forEach((clip) => {
            const action = mixer?.clipAction(clip);
            action?.setEffectiveTimeScale(2.15);
            action?.play();
          });
        }
      })
      .catch((error) => {
        console.error(error);
        setHasModel(false);
      });

    frameId = window.requestAnimationFrame(renderFrame);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(frameId);
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className={`loading-bot-runner${hasModel ? " has-3d-model" : ""}`} ref={hostRef} />;
}

type PlayerListProps = {
  room: RoomState;
};

function PlayerList({ room }: PlayerListProps) {
  return (
    <section className="panel player-panel">
      <h2>Players</h2>
      <ul className="player-list">
        {Object.entries(room.players).map(([uid, player]) => (
          <li key={uid}>
            <span className="player-avatar">{player.nickname.slice(0, 1).toUpperCase()}</span>
            <span>{player.nickname}</span>
            <em>{uid === room.hostUid ? "host" : `${getVoteCount(room, uid)}/${VOTE_LIMIT}`}</em>
          </li>
        ))}
      </ul>
    </section>
  );
}

type VoteBoardProps = {
  currentUid: string;
  isHost: boolean;
  nickname: string;
  room: RoomState;
  roomCode: string;
  store: RoomStore;
  onStart: () => void;
};

function VoteBoard({ currentUid, isHost, nickname, room, roomCode, store, onStart }: VoteBoardProps) {
  const savedVotes = room.votes?.[currentUid]?.menuIds ?? [];
  const now = useNow(room.status === "lobby");
  const votingOpen = getVoteWindowRemainingMs(room, now) > 0;
  const [draftVotes, setDraftVotes] = useState(savedVotes);
  const tallies = useMemo(() => getVoteTallies(room), [room]);
  const tallyByMenuId = useMemo(() => new Map(tallies.map((entry) => [entry.menuId, entry.votes])), [tallies]);
  const hasAnyVote = tallies.some((entry) => entry.votes > 0);

  useEffect(() => {
    setDraftVotes(savedVotes);
  }, [savedVotes.join("|")]);

  const submitVote = (menuIds: string[]) => {
    if (!votingOpen) {
      return;
    }

    setDraftVotes(menuIds);
    store.submitVote(roomCode, nickname, menuIds).catch(console.error);
  };

  const toggleVote = (menuId: string) => {
    if (draftVotes.includes(menuId)) {
      submitVote(draftVotes.filter((id) => id !== menuId));
      return;
    }

    if (draftVotes.length >= VOTE_LIMIT) {
      return;
    }

    submitVote([...draftVotes, menuId]);
  };

  return (
    <section className="vote-layout">
      <div className="vote-head">
        <div>
          <p className="status-label">Final Vote</p>
          <h2>Pick 1-6 of 20 menus to race</h2>
        </div>
        <strong>
          {draftVotes.length}/{VOTE_LIMIT}
        </strong>
      </div>

      <div className={`finalist-preview${draftVotes.length ? " has-selections" : ""}`} aria-label="Selected menus">
        {draftVotes.map((menuId, index) => {
          const menu = menuById.get(menuId);
          const racer = getRacerForMenu(menuId);

          return (
            <article className="finalist-chip" key={menuId} style={{ "--chip-color": racer.color } as CSSProperties}>
              <span className="finalist-chip__index">{index + 1}</span>
              {menu && <MenuImage menu={menu} variant="preview" />}
              <strong>{getMenuDisplayName(menu)}</strong>
            </article>
          );
        })}
      </div>

      <div className="candidate-grid">
        {menuCards.map((menu) => {
          const racer = getRacerForMenu(menu.id);
          const selected = draftVotes.includes(menu.id);
          const locked = !votingOpen || (!selected && draftVotes.length >= VOTE_LIMIT);

          return (
            <button
              className={`candidate-card${selected ? " is-selected" : ""}`}
              disabled={locked}
              key={menu.id}
              style={{ "--candidate-color": racer.color, "--candidate-accent": racer.accent } as CSSProperties}
              type="button"
              onClick={() => toggleVote(menu.id)}
            >
              <MenuImage menu={menu} variant="thumb" />
              <strong>{getMenuDisplayName(menu)}</strong>
              <em>{tallyByMenuId.get(menu.id) ?? 0}</em>
            </button>
          );
        })}
      </div>

      <div className="start-row">
        {isHost ? (
          <button className="primary-button start-button" disabled={!hasAnyVote} type="button" onClick={onStart}>
            Start top 6 race
          </button>
        ) : (
          <p className="waiting-text">The race starts when the host launches the top 6 finalists.</p>
        )}
      </div>
    </section>
  );
}

type FinalistStripProps = {
  finalistIds: string[];
};

function FinalistStrip({ finalistIds }: FinalistStripProps) {
  return (
    <section className="finalist-strip">
      {finalistIds.slice(0, FINALIST_COUNT).map((menuId) => {
        const menu = menuById.get(menuId);
        const racer = getRacerForMenu(menuId);

        return (
          <article className="finalist-strip-card" key={menuId} style={{ "--chip-color": racer.color } as CSSProperties}>
            <span>{racer.icon}</span>
            <strong>{getMenuDisplayName(menu)}</strong>
          </article>
        );
      })}
    </section>
  );
}

type RaceScoreboardProps = {
  room: RoomState;
  now: number;
};

function RaceScoreboard({ room, now }: RaceScoreboardProps) {
  const startedAt = room.raceStartedAt ?? now;
  const elapsedMs = Math.max(0, now - startedAt);
  const activeEvents = getActiveRaceEvents(room, now);
  const activeEventLabel = activeEvents.map((event) => RACE_EVENT_META[event.type].label).join("  / ");
  const activeEventIcons = activeEvents.map((event) => RACE_EVENT_META[event.type].icon).join("");
  const leaders = getRaceLaneStates(room, now)
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);

  return (
    <section className="race-scoreboard">
      <div>
        <p className="status-label">Race Time</p>
        <strong>{formatRaceTime(elapsedMs)}</strong>
      </div>
      <div className="leader-stack">
        {leaders.map((lane) => (
          <span key={lane.menuId}>
            {lane.rank}. {lane.menuName}
          </span>
        ))}
      </div>
      <div className={`event-light${activeEvents.length ? " is-active" : ""}`} title={activeEventLabel || "Waiting for event"}>
        {activeEventIcons || "GO"}
      </div>
    </section>
  );
}

type SushiRaceTrackProps = {
  room: RoomState;
  now: number;
};

const drawRoundRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const withAlpha = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const drawEmoji = (
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = "center",
) => {
  context.save();
  context.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  context.textAlign = align;
  context.textBaseline = "middle";
  context.fillText(value, x, y);
  context.restore();
};

function SushiRaceTrack({ room, now }: SushiRaceTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [, setImageVersion] = useState(0);
  const laneStates = getRaceLaneStates(room, now);
  const activeEvents = getActiveRaceEvents(room, now);
  const menuIds = laneStates.map((lane) => lane.menuId).join("|");

  useEffect(() => {
    laneStates.forEach((lane) => {
      if (imageCacheRef.current.has(lane.menuId)) {
        return;
      }

      const menu = menuById.get(lane.menuId) ?? menuCards[0];
      const image = new Image();
      let triedFallback = false;

      image.onload = () => setImageVersion((version) => version + 1);
      image.onerror = () => {
        if (!triedFallback) {
          triedFallback = true;
          image.src = menu.fallbackImageUrl;
        }
      };
      image.src = menu.imageUrl;
      imageCacheRef.current.set(lane.menuId, image);
    });
  }, [laneStates, menuIds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(360, rect.height);
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const padding = width < 680 ? 10 : 16;
    const labelWidth = width < 680 ? 94 : 138;
    const gap = width < 680 ? 7 : 9;
    const laneHeight = (height - padding * 2 - gap * (laneStates.length - 1)) / laneStates.length;
    const trackX = padding + labelWidth;
    const finishX = width - padding - (width < 680 ? 18 : 28);
    const runnerStartX = trackX + 28;
    const runnerEndX = finishX - 24;
    const beltOffset = (now / 14) % 76;

    context.fillStyle = "#fffaf0";
    drawRoundRect(context, 0, 0, width, height, 8);
    context.fill();

    for (let x = padding; x < width - padding; x += 44) {
      context.fillStyle = "rgba(15, 118, 110, 0.055)";
      context.fillRect(x, padding, 18, height - padding * 2);
    }

    context.save();
    context.fillStyle = "#111827";
    drawRoundRect(context, finishX, padding + 4, 14, height - padding * 2 - 8, 3);
    context.fill();
    for (let y = padding + 4; y < height - padding; y += 18) {
      context.fillStyle = Math.floor((y - padding) / 18) % 2 === 0 ? "#ffffff" : "#111827";
      context.fillRect(finishX, y, 14, 9);
    }
    context.restore();

    laneStates.forEach((lane, laneIndex) => {
      const laneY = padding + laneIndex * (laneHeight + gap);
      const laneMidY = laneY + laneHeight / 2;
      const activeLaneEvents = activeEvents.filter((event) => event.affectsAll || event.laneIndex === laneIndex);
      const hasReverse = activeLaneEvents.some((event) => event.type === "reverse-belt");
      const hasGreenTea = activeLaneEvents.some((event) => event.type === "green-tea");
      const hasChopsticks = activeLaneEvents.some((event) => event.type === "chopsticks");
      const runnerX = runnerStartX + lane.displayProgress * Math.max(1, runnerEndX - runnerStartX);
      const runnerPulse = Math.sin(now / 130 + laneIndex) * 3;
      const runnerY = laneMidY + (lane.isEliminated ? 3 : runnerPulse);

      context.save();
      context.globalAlpha = lane.isEliminated ? 0.68 : 1;
      context.fillStyle = withAlpha(lane.accent, 0.34);
      context.strokeStyle = withAlpha(lane.color, 0.28);
      context.lineWidth = 1;
      drawRoundRect(context, padding, laneY, width - padding * 2, laneHeight, 8);
      context.fill();
      context.stroke();

      context.fillStyle = lane.color;
      drawRoundRect(context, padding + 8, laneMidY - 17, 34, 34, 8);
      context.fill();
      context.fillStyle = "#ffffff";
      context.font = "900 16px Inter, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(laneIndex + 1), padding + 25, laneMidY);

      context.fillStyle = "#172033";
      context.font = `900 ${width < 680 ? 12 : 14}px Pretendard, Inter, sans-serif`;
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(lane.menuName, padding + 50, laneMidY - 10, labelWidth - 56);
      context.fillStyle = "#6b7280";
      context.font = `800 ${width < 680 ? 10 : 12}px Pretendard, Inter, sans-serif`;
      context.fillText(lane.characterName, padding + 50, laneMidY + 10, labelWidth - 56);

      const beltY = laneY + laneHeight * 0.25;
      const beltHeight = laneHeight * 0.5;
      const beltWidth = finishX - trackX - 6;

      context.fillStyle = hasReverse ? "#dbeafe" : "#e5e7eb";
      context.strokeStyle = hasReverse ? "#2563eb" : "#a1a1aa";
      context.lineWidth = 1;
      drawRoundRect(context, trackX, beltY, beltWidth, beltHeight, beltHeight / 2);
      context.fill();
      context.stroke();

      context.save();
      drawRoundRect(context, trackX + 2, beltY + 2, beltWidth - 4, beltHeight - 4, beltHeight / 2);
      context.clip();
      const direction = hasReverse ? -1 : 1;
      for (let x = trackX - 80; x < finishX + 80; x += 38) {
        const rollerX = x + direction * beltOffset;
        context.fillStyle = "rgba(255, 255, 255, 0.86)";
        context.beginPath();
        context.arc(rollerX, laneMidY, 7, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "rgba(113, 113, 122, 0.32)";
        context.fillRect(rollerX + 13, beltY + 4, 5, beltHeight - 8);
      }
      context.restore();

      if (hasGreenTea) {
        context.fillStyle = "rgba(22, 163, 74, 0.5)";
        context.beginPath();
        context.ellipse(runnerX + 8, beltY + beltHeight - 9, 48, 12, -0.08, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.ellipse(runnerX - 28, beltY + beltHeight - 6, 21, 7, 0.18, 0, Math.PI * 2);
        context.fill();
        drawEmoji(context, "!!", runnerX - 54, beltY + 10, 23);
      }

      if (hasReverse) {
        context.fillStyle = "#1d4ed8";
        drawRoundRect(context, finishX - 62, laneMidY - 18, 36, 36, 8);
        context.fill();
        context.fillStyle = "#ffffff";
        context.font = "950 24px Inter, sans-serif";
        context.textAlign = "center";
        context.fillText("REV", finishX - 44, laneMidY + 1);
      }

      context.fillStyle = "rgba(17, 24, 39, 0.2)";
      context.beginPath();
      context.ellipse(runnerX, laneMidY + beltHeight * 0.28, 30, 8, 0, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "#ffffff";
      context.strokeStyle = lane.color;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(runnerX, runnerY, 28, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      const image = imageCacheRef.current.get(lane.menuId);
      if (image?.complete && image.naturalWidth > 0) {
        context.save();
        context.beginPath();
        context.arc(runnerX, runnerY, 23, 0, Math.PI * 2);
        context.clip();
        context.drawImage(image, runnerX - 25, runnerY - 25, 50, 50);
        context.restore();
      } else {
        drawEmoji(context, lane.icon, runnerX, runnerY, 24);
      }

      context.fillStyle = "#ffffff";
      context.strokeStyle = withAlpha(lane.color, 0.3);
      context.lineWidth = 1;
      drawRoundRect(context, runnerX + 16, runnerY - 36, 36, 32, 8);
      context.fill();
      context.stroke();
      drawEmoji(context, lane.icon, runnerX + 34, runnerY - 20, 19);

      if (hasChopsticks) {
        context.strokeStyle = "#9a5c24";
        context.lineWidth = 7;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(runnerX - 16, laneY - 12);
        context.lineTo(runnerX - 4, runnerY - 6);
        context.moveTo(runnerX + 18, laneY - 12);
        context.lineTo(runnerX + 4, runnerY - 6);
        context.stroke();
      }

      if (lane.isEliminated) {
        context.fillStyle = "#991b1b";
        drawRoundRect(context, runnerX - 25, laneY + 6, 50, 24, 999);
        context.fill();
        context.fillStyle = "#ffffff";
        context.font = "950 12px Pretendard, Inter, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("OUT", runnerX, laneY + 18);
      }

      if (lane.isFinished) {
        drawEmoji(context, "FIN", runnerX + 46, runnerY - 18, 22);
      }

      context.restore();
    });
  }, [activeEvents, laneStates, now, room.seed]);

  return (
    <section className="race-canvas-shell" aria-label="Sushi race track">
      <canvas className="race-canvas" ref={canvasRef} />
      <div className="sr-only">
        {laneStates.map((lane) => `${lane.rank}. ${lane.menuName} ${lane.isEliminated ? "Out" : formatRaceTime(lane.finishMs)}`).join(", ")}
      </div>
    </section>
  );
}

function ThreeSushiRaceTrack({ room, now }: SushiRaceTrackProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const trackGroupRef = useRef<THREE.Group | null>(null);
  const racerGroupRef = useRef<THREE.Group | null>(null);
  const plateGroupRef = useRef<THREE.Group | null>(null);
  const plateTextureCacheRef = useRef<Map<string, THREE.Texture>>(new Map());
  const plateSpritesRef = useRef<Map<string, THREE.Sprite>>(new Map());
  const railTexturesRef = useRef<THREE.Texture[]>([]);
  const roomRef = useRef(room);
  const raceNowOffsetRef = useRef(now - Date.now());
  const modelCacheRef = useRef<Map<string, LoadedRaceModel>>(new Map());
  const animationMixersRef = useRef<THREE.AnimationMixer[]>([]);
  const racerObjectsRef = useRef<
    Map<
      string,
      {
        laneIndex: number;
        runner: THREE.Group;
        shadow: THREE.Mesh;
        runAction?: THREE.AnimationAction;
        grabAction?: THREE.AnimationAction;
        fallAction?: THREE.AnimationAction;
        grabbed: boolean;
        plateHit: boolean;
      }
    >
  >(new Map());
  const [modelReady, setModelReady] = useState(0);
  const laneStates = getRaceLaneStates(room, now);
  const menuIds = laneStates.map((lane) => lane.menuId).join("|");

  useEffect(() => {
    roomRef.current = room;
    raceNowOffsetRef.current = now - Date.now();
  }, [now, room]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-5, 5, 2.8, -2.8, 0.1, 80);
    camera.position.set(0, 4.1, 8.8);
    camera.lookAt(0, 0.7, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xfff4df, 0x1f2937, 2.2);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffedd5, 3.2);
    key.position.set(-3.2, 7.2, 5.8);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7dd3fc, 1.2);
    rim.position.set(4.4, 3.6, -3.8);
    scene.add(rim);

    const trackGroup = new THREE.Group();
    const racerGroup = new THREE.Group();
    const plateGroup = new THREE.Group();
    scene.add(trackGroup, plateGroup, racerGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    trackGroupRef.current = trackGroup;
    racerGroupRef.current = racerGroup;
    plateGroupRef.current = plateGroup;
    const plateTextureLoader = new THREE.TextureLoader();
    const getPlateTexture = (imageUrl: string) => {
      const cachedTexture = plateTextureCacheRef.current.get(imageUrl);
      if (cachedTexture) {
        return cachedTexture;
      }

      const texture = plateTextureLoader.load(imageUrl);
      texture.colorSpace = THREE.SRGBColorSpace;
      plateTextureCacheRef.current.set(imageUrl, texture);
      return texture;
    };
    const syncPlateSprites = (frameRoom: RoomState, frameLaneStates: ReturnType<typeof getRaceLaneStates>, elapsedMs: number, frameNow: number) => {
      const activeIds = new Set<string>();
      (frameRoom.raceEvents ?? [])
        .filter((event) => event.type === "plate-stack")
        .forEach((event) => {
          const progress = Math.min(1, Math.max(0, (elapsedMs - event.triggerAtMs) / Math.max(1, event.durationMs)));
          const laneIndex = getPlateStackTargetLaneIndex(frameRoom, event);
          const lane = frameLaneStates[laneIndex];

          if (!lane || progress <= 0 || progress >= 1) {
            return;
          }

          const railIndex = laneIndex % 2;
          const laneSlot = Math.floor(laneIndex / 2);
          const impactProgress = Math.min(1, progress / PLATE_STACK_IMPACT_PROGRESS);
          const hitProgress = Math.max(0, (progress - PLATE_STACK_IMPACT_PROGRESS) / (1 - PLATE_STACK_IMPACT_PROGRESS));
          const hitFrame = hitProgress <= 0 ? 0 : Math.min(3, Math.floor(hitProgress * 5) + 1);
          const imageUrl =
            hitFrame === 1
              ? "/other/10dish_item_hit_01.png"
              : hitFrame === 2
                ? "/other/10dish_item_hit_02.png"
                : hitFrame >= 3
                  ? "/other/10dish_item_hit_03.png"
                  : "/other/10dish_item.png";
          const targetX = RACE_TRACK_START_X + lane.displayProgress * Math.max(1, RACE_TRACK_END_X - RACE_TRACK_START_X);
          const x = RACE_PLATE_ENTRY_X - impactProgress * Math.max(0.1, RACE_PLATE_ENTRY_X - targetX) + hitProgress * 0.1;
          const stackOffset = (laneSlot - 1) * RACE_TRACK_STACK_Z_OFFSET;
          const scale = 0.62;
          const width = RACE_PLATE_SPRITE_WIDTH * scale;
          const height = RACE_PLATE_SPRITE_HEIGHT * scale;
          const y = RACE_PLATE_RAIL_BASE_Y[railIndex] + height / 2;
          const z = RACE_TRACK_RAIL_ZS[railIndex] + stackOffset + RACE_PLATE_RAIL_FRONT_Z_OFFSET;
          const opacity = hitFrame ? Math.max(0, 1 - Math.max(0, hitProgress - 0.72) / 0.28) : Math.min(1, progress / 0.12);
          const rotation = THREE.MathUtils.degToRad(hitFrame ? -8 + Math.sin(frameNow / 38) * 8 : -4 + Math.sin(frameNow / 72) * 3);

          let sprite = plateSpritesRef.current.get(event.id);
          if (!sprite) {
            sprite = new THREE.Sprite(
              new THREE.SpriteMaterial({
                map: getPlateTexture(imageUrl),
                transparent: true,
                depthWrite: false,
                depthTest: false,
              }),
            );
            sprite.center.set(0.5, 0.5);
            plateSpritesRef.current.set(event.id, sprite);
            plateGroup.add(sprite);
          }

          const material = sprite.material as THREE.SpriteMaterial;
          if (sprite.userData.imageUrl !== imageUrl) {
            material.map = getPlateTexture(imageUrl);
            material.needsUpdate = true;
            sprite.userData.imageUrl = imageUrl;
          }

          material.opacity = opacity;
          material.rotation = rotation;
          sprite.position.set(x, y, z);
          sprite.scale.set(width, height, 1);
          sprite.renderOrder = 60 + railIndex * 10 + laneSlot;
          sprite.visible = opacity > 0.01;
          activeIds.add(event.id);
        });

      plateSpritesRef.current.forEach((sprite, eventId) => {
        if (activeIds.has(eventId)) {
          return;
        }

        plateGroup.remove(sprite);
        sprite.material.dispose();
        plateSpritesRef.current.delete(eventId);
      });
    };

    let cancelled = false;
    let frameId = 0;
    let previousFrameTime = performance.now();
    const renderFrame = (frameTime: number) => {
      if (cancelled) {
        return;
      }

      const delta = Math.min(0.05, Math.max(0, (frameTime - previousFrameTime) / 1000));
      previousFrameTime = frameTime;
      animationMixersRef.current.forEach((mixer) => mixer.update(delta));
      const activeElapsedMs = roomRef.current.raceStartedAt ? Math.max(0, Date.now() + raceNowOffsetRef.current - roomRef.current.raceStartedAt) : 0;
      const reversedRails = new Set(
        (roomRef.current.raceEvents ?? [])
          .filter((event) => event.type === "plate-stack" && activeElapsedMs >= event.triggerAtMs && activeElapsedMs <= event.triggerAtMs + event.durationMs)
          .map((event) => event.railIndex ?? getPlateStackTargetLaneIndex(roomRef.current, event) % 2),
      );
      railTexturesRef.current.forEach((texture, index) => {
        const railDirection = reversedRails.has(index) ? 1 : -1;
        texture.offset.x = (texture.offset.x + railDirection * delta * (index === 0 ? 0.22 : 0.18)) % 1;
      });

      const frameNow = Date.now() + raceNowOffsetRef.current;
      const frameLaneStates = getRaceLaneStates(roomRef.current, frameNow);
      const elapsedMs = roomRef.current.raceStartedAt ? Math.max(0, frameNow - roomRef.current.raceStartedAt) : 0;
      syncPlateSprites(roomRef.current, frameLaneStates, elapsedMs, frameNow);

      if (racerObjectsRef.current.size) {
        frameLaneStates.forEach((lane, laneIndex) => {
          const racer = racerObjectsRef.current.get(lane.menuId);
          if (!racer) {
            return;
          }

          const railIndex = laneIndex % 2;
          const laneSlot = Math.floor(laneIndex / 2);
          const stackOffset = (laneSlot - 1) * RACE_TRACK_STACK_Z_OFFSET;
          const x = RACE_TRACK_START_X + lane.displayProgress * Math.max(1, RACE_TRACK_END_X - RACE_TRACK_START_X);
          const z = RACE_TRACK_RAIL_ZS[railIndex] + stackOffset;
          const grabEvent = (roomRef.current.raceEvents ?? []).find(
            (event) => event.type === "chopsticks" && event.laneIndex === laneIndex && elapsedMs >= event.triggerAtMs,
          );
          const grabProgress = grabEvent
            ? Math.min(1, Math.max(0, (elapsedMs - grabEvent.triggerAtMs) / Math.max(1, grabEvent.durationMs)))
            : 0;
          const plateHitEvent = (roomRef.current.raceEvents ?? []).find((event) => {
            if (event.type !== "plate-stack" || getPlateStackTargetLaneIndex(roomRef.current, event) !== laneIndex) {
              return false;
            }

            const impactAt = getPlateStackImpactElapsedMs(event);
            return elapsedMs >= impactAt && elapsedMs <= impactAt + PLATE_STACK_HIT_HOLD_MS;
          });
          const isBeingGrabbed = Boolean(grabEvent && grabProgress < 1);
          const isPlateHit = Boolean(plateHitEvent);
          const liftProgress = isBeingGrabbed ? Math.min(1, Math.max(0, (grabProgress - 0.18) / 0.82)) : 0;
          const bob = lane.isEliminated || isPlateHit ? 0 : Math.sin(frameNow / 88 + laneIndex) * 0.052;
          const weirdShake = isBeingGrabbed ? Math.sin(frameNow / 28 + laneIndex) * 0.12 : 0;
          const visible = lane.isEliminated ? isBeingGrabbed && grabProgress < 0.96 : true;

          if (isBeingGrabbed !== racer.grabbed) {
            racer.grabbed = isBeingGrabbed;
            if (isBeingGrabbed) {
              racer.runAction?.fadeOut(0.12);
              racer.fallAction?.fadeOut(0.1);
              racer.grabAction?.reset().fadeIn(0.12).play();
            } else {
              racer.grabAction?.fadeOut(0.12);
              racer.runAction?.reset().fadeIn(0.12).play();
            }
          }

          if (isPlateHit !== racer.plateHit) {
            racer.plateHit = isPlateHit;
            if (isPlateHit) {
              racer.runAction?.fadeOut(0.1);
              racer.grabAction?.fadeOut(0.1);
              racer.fallAction?.reset().fadeIn(0.1).play();
            } else {
              racer.fallAction?.fadeOut(0.12);
              racer.runAction?.reset().fadeIn(0.12).play();
            }
          }

          racer.runner.position.set(x - liftProgress * 0.55 - (isPlateHit ? 0.1 : 0), 0.12 + RACE_TRACK_RAIL_Y_OFFSETS[railIndex] + bob + liftProgress * 1.96, z + liftProgress * 0.12);
          racer.runner.rotation.x = isBeingGrabbed ? Math.sin(frameNow / 42) * 0.32 : isPlateHit ? -0.46 : 0;
          racer.runner.rotation.y = isBeingGrabbed ? Math.sin(frameNow / 35) * 0.24 : 0;
          racer.runner.rotation.z = isBeingGrabbed
            ? -0.35 - liftProgress * 1.2 + weirdShake
            : isPlateHit
              ? -0.55 + Math.sin(frameNow / 55) * 0.06
              : Math.sin(frameNow / 145 + laneIndex) * 0.05;
          racer.runner.visible = visible;
          racer.shadow.position.set(x, 0.02 + RACE_TRACK_SHADOW_Y_OFFSETS[railIndex], z);
          (racer.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.14 * (1 - liftProgress));
          racer.shadow.visible = visible;
        });
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(renderFrame);
    };

    frameId = window.requestAnimationFrame(renderFrame);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      renderer.dispose();
      host.removeChild(renderer.domElement);
      railTexturesRef.current.forEach((texture) => texture.dispose());
      railTexturesRef.current = [];
      plateSpritesRef.current.forEach((sprite) => sprite.material.dispose());
      plateSpritesRef.current.clear();
      plateTextureCacheRef.current.forEach((texture) => texture.dispose());
      plateTextureCacheRef.current.clear();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      trackGroupRef.current = null;
      racerGroupRef.current = null;
      plateGroupRef.current = null;
      modelCacheRef.current.clear();
      animationMixersRef.current = [];
      racerObjectsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let usedCachedModel = false;

    menuIds.split("|").forEach((menuId) => {
      if (!menuId || modelCacheRef.current.has(menuId)) {
        return;
      }

      const cachedModel = raceModelCache.get(menuId);
      if (cachedModel) {
        modelCacheRef.current.set(menuId, cachedModel);
        usedCachedModel = true;
        return;
      }

      loadRaceModel(menuId)
        .then((loadedModel) => {
          if (!cancelled) {
            modelCacheRef.current.set(menuId, loadedModel);
            setModelReady((tick) => tick + 1);
          }
        })
        .catch(console.error);
    });

    if (usedCachedModel) {
      setModelReady((tick) => tick + 1);
    }

    return () => {
      cancelled = true;
    };
  }, [menuIds]);

  useEffect(() => {
    const host = hostRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const trackGroup = trackGroupRef.current;
    const racerGroup = racerGroupRef.current;
    const plateGroup = plateGroupRef.current;

    if (!host || !renderer || !scene || !camera || !trackGroup || !racerGroup || !plateGroup) {
      return;
    }

    if (!laneStates.every((lane) => modelCacheRef.current.has(lane.menuId))) {
      racerGroup.clear();
      plateGroup.clear();
      plateSpritesRef.current.forEach((sprite) => sprite.material.dispose());
      plateSpritesRef.current.clear();
      animationMixersRef.current = [];
      racerObjectsRef.current.clear();
      return;
    }

    const width = Math.max(320, Math.round(host.getBoundingClientRect().width));
    const height = Math.max(420, Math.round(host.getBoundingClientRect().height));
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const viewHeight = 5.6;
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();

    trackGroup.clear();
    railTexturesRef.current.forEach((texture) => texture.dispose());
    railTexturesRef.current = [];
    racerGroup.clear();
    plateGroup.clear();
    plateSpritesRef.current.forEach((sprite) => sprite.material.dispose());
    plateSpritesRef.current.clear();
    animationMixersRef.current = [];
    racerObjectsRef.current.clear();

    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14 });

    const textureLoader = new THREE.TextureLoader();
    RACE_TRACK_RAIL_ZS.forEach((railZ, railIndex) => {
      const texture = textureLoader.load("/other/rail_lane_tile.png");
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.repeat.set(5.2, 1);
      texture.offset.x = railIndex * 0.18;
      railTexturesRef.current.push(texture);

      const rail = new THREE.Mesh(
        new THREE.PlaneGeometry(RACE_TRACK_RAIL_WIDTH, RACE_TRACK_RAIL_DEPTH, 1, 1),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
        }),
      );
      rail.position.set((RACE_TRACK_START_X + RACE_TRACK_END_X) / 2, 0, railZ);
      rail.rotation.x = -Math.PI / 2;
      rail.renderOrder = 1 + railIndex;
      trackGroup.add(rail);
    });

    const finishGroup = new THREE.Group();
    const finishMaterial = new THREE.MeshBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.96, depthWrite: false });
    const checkerRows = 5;
    const checkerCols = 2;
    const checkerWidth = RACE_TRACK_FINISH_WIDTH / checkerCols;
    const checkerHeight = RACE_TRACK_RAIL_DEPTH / checkerRows;
    RACE_TRACK_RAIL_ZS.forEach((railZ, railIndex) => {
      const finishLine = new THREE.Mesh(new THREE.PlaneGeometry(RACE_TRACK_FINISH_WIDTH, RACE_TRACK_RAIL_DEPTH), finishMaterial);
      finishLine.position.set(RACE_TRACK_END_X + 0.06, 0.025, railZ);
      finishLine.rotation.x = -Math.PI / 2;
      finishLine.renderOrder = 8;
      finishGroup.add(finishLine);

      for (let row = 0; row < checkerRows; row += 1) {
        for (let col = 0; col < checkerCols; col += 1) {
          const isWhite = (row + col + railIndex) % 2 === 0;
          const checker = new THREE.Mesh(
            new THREE.PlaneGeometry(checkerWidth, checkerHeight),
            new THREE.MeshBasicMaterial({ color: isWhite ? 0xffffff : 0x111827, transparent: true, opacity: 0.98, depthWrite: false }),
          );
          checker.position.set(
            RACE_TRACK_END_X + 0.061 + (col - 0.5) * checkerWidth,
            0.032,
            railZ - RACE_TRACK_RAIL_DEPTH / 2 + checkerHeight / 2 + row * checkerHeight,
          );
          checker.rotation.x = -Math.PI / 2;
          checker.renderOrder = 9;
          finishGroup.add(checker);
        }
      }
    });
    trackGroup.add(finishGroup);

    laneStates.forEach((lane, laneIndex) => {
      const railIndex = laneIndex % 2;
      const laneSlot = Math.floor(laneIndex / 2);
      const stackOffset = (laneSlot - 1) * RACE_TRACK_STACK_Z_OFFSET;
      const x = RACE_TRACK_START_X + lane.displayProgress * Math.max(1, RACE_TRACK_END_X - RACE_TRACK_START_X);
      const z = RACE_TRACK_RAIL_ZS[railIndex] + stackOffset;
      const bob = lane.isEliminated ? 0 : Math.sin(now / 115 + laneIndex) * 0.055;
      const loadedModel = modelCacheRef.current.get(lane.menuId);

      if (!loadedModel) {
        return;
      }

      const runner = cloneSkeleton(loadedModel.model) as THREE.Group;
      const runnerRenderOrder = 20 + railIndex * 30 + laneSlot * 4;
      applyRaceRenderPriority(runner, runnerRenderOrder);
      runner.scale.multiplyScalar(width < 760 ? 0.42 : 0.504);
      runner.position.set(x, 0.12 + RACE_TRACK_RAIL_Y_OFFSETS[railIndex] + bob, z);
      runner.rotation.y = 0;
      runner.rotation.z = Math.sin(now / 180 + laneIndex) * 0.04;
      const mixer = new THREE.AnimationMixer(runner);
      const runClip = loadedModel.clips[0];
      const runAction = runClip ? mixer.clipAction(runClip) : undefined;
      const grabAction = loadedModel.grabClip ? mixer.clipAction(loadedModel.grabClip) : undefined;
      const fallAction = loadedModel.fallClip ? mixer.clipAction(loadedModel.fallClip) : undefined;

      if (runAction) {
        runAction.timeScale = 1.9;
        runAction.play();
        mixer.setTime(((now / 1000) + laneIndex * 0.18) % Math.max(0.1, runClip.duration));
        animationMixersRef.current.push(mixer);
      }

      if (grabAction) {
        grabAction.timeScale = 1.25;
        grabAction.enabled = false;
      }

      if (fallAction) {
        fallAction.timeScale = 1;
        fallAction.enabled = false;
        fallAction.setLoop(THREE.LoopOnce, 1);
        fallAction.clampWhenFinished = true;
      }

      runner.traverse((child) => {
        if (child instanceof THREE.Object3D) {
          child.visible = !lane.isEliminated || Math.sin(now / 120) > -0.2;
        }
      });

      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), shadowMaterial);
      shadow.renderOrder = runnerRenderOrder - 1;
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(x, 0.02 + RACE_TRACK_SHADOW_Y_OFFSETS[railIndex], z);
      shadow.scale.set(0.82, 0.26, 1);
      racerGroup.add(shadow, runner);
      racerObjectsRef.current.set(lane.menuId, { laneIndex, runner, shadow, runAction, grabAction, fallAction, grabbed: false, plateHit: false });
    });

    renderer.render(scene, camera);
  }, [menuIds, modelReady, room.seed]);

  useEffect(() => {
    const host = hostRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;

    if (!host || !renderer || !scene || !camera || !racerObjectsRef.current.size) {
      return;
    }

    const width = Math.max(320, Math.round(host.getBoundingClientRect().width));
    const height = Math.max(420, Math.round(host.getBoundingClientRect().height));
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const viewHeight = 5.6;
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();

    const elapsedMs = room.raceStartedAt ? Math.max(0, now - room.raceStartedAt) : 0;

    laneStates.forEach((lane, laneIndex) => {
      const racer = racerObjectsRef.current.get(lane.menuId);
      if (!racer) {
        return;
      }

      const railIndex = laneIndex % 2;
      const laneSlot = Math.floor(laneIndex / 2);
      const stackOffset = (laneSlot - 1) * RACE_TRACK_STACK_Z_OFFSET;
      const x = RACE_TRACK_START_X + lane.displayProgress * Math.max(1, RACE_TRACK_END_X - RACE_TRACK_START_X);
      const z = RACE_TRACK_RAIL_ZS[railIndex] + stackOffset;
      const grabEvent = (room.raceEvents ?? []).find(
        (event) => event.type === "chopsticks" && event.laneIndex === laneIndex && elapsedMs >= event.triggerAtMs,
      );
      const grabProgress = grabEvent ? Math.min(1, Math.max(0, (elapsedMs - grabEvent.triggerAtMs) / Math.max(1, grabEvent.durationMs))) : 0;
      const plateHitEvent = (room.raceEvents ?? []).find((event) => {
        if (event.type !== "plate-stack" || getPlateStackTargetLaneIndex(room, event) !== laneIndex) {
          return false;
        }

        const impactAt = getPlateStackImpactElapsedMs(event);
        return elapsedMs >= impactAt && elapsedMs <= impactAt + PLATE_STACK_HIT_HOLD_MS;
      });
      const liftProgress = grabEvent ? Math.min(1, Math.max(0, (grabProgress - 0.18) / 0.82)) : 0;
      const isPlateHit = Boolean(plateHitEvent);
      const bob = lane.isEliminated || isPlateHit ? 0 : Math.sin(now / 115 + laneIndex) * 0.055;
      const visible = lane.isEliminated ? Boolean(grabEvent && grabProgress < 0.96) : true;

      racer.runner.position.set(x - liftProgress * 0.55 - (isPlateHit ? 0.1 : 0), 0.12 + RACE_TRACK_RAIL_Y_OFFSETS[railIndex] + bob + liftProgress * 1.96, z + liftProgress * 0.12);
      racer.runner.rotation.x = isPlateHit ? -0.46 : 0;
      racer.runner.rotation.z = grabEvent ? -0.35 - liftProgress * 1.2 : isPlateHit ? -0.55 : Math.sin(now / 180 + laneIndex) * 0.04;
      racer.runner.visible = visible;
      racer.shadow.position.set(x, 0.02 + RACE_TRACK_SHADOW_Y_OFFSETS[railIndex], z);
      (racer.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.14 * (1 - liftProgress));
      racer.shadow.visible = visible;
    });
  }, [laneStates, modelReady, now]);

  const raceElapsedMs = room.raceStartedAt ? Math.max(0, now - room.raceStartedAt) : 0;
  const handEvents = (room.raceEvents ?? [])
    .filter((event) => event.type === "chopsticks" && event.laneIndex !== null)
    .map((event) => {
      const progress = Math.min(1, Math.max(0, (raceElapsedMs - event.triggerAtMs) / Math.max(1, event.durationMs)));
      const laneIndex = event.laneIndex ?? 0;
      const lane = laneStates[laneIndex];

      if (!lane || progress <= 0 || progress >= 1) {
        return null;
      }

      const railIndex = laneIndex % 2;
      const laneSlot = Math.floor(laneIndex / 2);
      const approachProgress = Math.min(1, progress / 0.22);
      const liftProgress = Math.min(1, Math.max(0, (progress - 0.18) / 0.82));
      const xPercent = 9 + lane.displayProgress * 84 - liftProgress * 10;
      const targetY = (railIndex === 0 ? 28 : 77) + (laneSlot - 1) * RACE_EVENT_STACK_Y_OFFSET;
      const yPercent = targetY - (1 - approachProgress) * 27 - liftProgress * 40;

      return {
        id: event.id,
        progress,
        xPercent,
        yPercent,
        opacity: Math.min(1, approachProgress * 1.4) * (1 - Math.max(0, progress - 0.86) / 0.14),
        rotation: -18 + liftProgress * 11 + Math.sin(now / 45) * 2,
        scale: 0.82 + approachProgress * 0.18,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    progress: number;
    xPercent: number;
    yPercent: number;
    opacity: number;
    rotation: number;
    scale: number;
  }>;

  return (
    <section className="race-canvas-shell race-canvas-shell--3d" aria-label="3D sushi race track">
      <div className="race-rail-stage" aria-hidden="true">
        {handEvents.map((event) => (
          <div
            className="race-hand-event"
            key={event.id}
            style={
              {
                "--hand-x": `${event.xPercent}%`,
                "--hand-y": `${event.yPercent}%`,
                "--hand-opacity": event.opacity,
                "--hand-rotate": `${event.rotation}deg`,
                "--hand-scale": event.scale,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="race-three-host" ref={hostRef} />
      <div className="sr-only">
        {laneStates.map((lane) => `${lane.rank}. ${lane.menuName} ${lane.isEliminated ? "Out" : formatRaceTime(lane.finishMs)}`).join(", ")}
      </div>
    </section>
  );
}

function PixiSushiRaceTrack({ room, now }: SushiRaceTrackProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const readyRef = useRef(false);
  const textureRef = useRef<Map<string, Texture>>(new Map());
  const [assetTick, setAssetTick] = useState(0);
  const laneStates = getRaceLaneStates(room, now);
  const activeEvents = getActiveRaceEvents(room, now);
  const menuIds = laneStates.map((lane) => lane.menuId).join("|");

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host || appRef.current) {
      return;
    }

    const app = new Application();
    app
      .init({
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        height: Math.max(420, Math.round(host.getBoundingClientRect().height)),
        resolution: window.devicePixelRatio || 1,
        width: Math.max(320, Math.round(host.getBoundingClientRect().width)),
      })
      .then(() => {
        if (cancelled) {
          app.destroy(true);
          return;
        }

        appRef.current = app;
        host.appendChild(app.canvas);
        readyRef.current = true;
        setAssetTick((tick) => tick + 1);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
      readyRef.current = false;
      appRef.current?.destroy(true);
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const assetUrls = laneStates.map((lane) => menuById.get(lane.menuId)?.imageUrl ?? menuCards[0].imageUrl);

    assetUrls.forEach((url) => {
      if (textureRef.current.has(url)) {
        return;
      }

      Assets.load<Texture>(url)
        .then((texture) => {
          if (!cancelled) {
            textureRef.current.set(url, texture);
            setAssetTick((tick) => tick + 1);
          }
        })
        .catch(console.error);
    });

    return () => {
      cancelled = true;
    };
  }, [laneStates, menuIds]);

  useEffect(() => {
    const app = appRef.current;
    const host = hostRef.current;
    if (!app || !host || !readyRef.current) {
      return;
    }

    const width = Math.max(320, Math.round(host.getBoundingClientRect().width));
    const height = Math.max(420, Math.round(host.getBoundingClientRect().height));
    if (app.renderer.width !== width || app.renderer.height !== height) {
      app.renderer.resize(width, height);
    }

    app.stage.removeChildren();

    const padding = width < 720 ? 16 : 28;
    const labelWidth = width < 720 ? 86 : 124;
    const trackX = padding + labelWidth;
    const finishX = width - padding - 34;
    const startX = trackX + 24;
    const endX = finishX - 34;
    const railYs = [height * 0.42, height * 0.68];
    const railHeight = width < 720 ? 82 : 100;
    const beltOffset = (now / 13) % 72;

    railYs.forEach((railY, railIndex) => {
      const rail = new Graphics();
      rail
        .roundRect(trackX - 18, railY - railHeight / 2, finishX - trackX + 34, railHeight, railHeight / 2)
        .fill({ color: railIndex === 0 ? 0x6b3f1f : 0x3d2414, alpha: 0.78 })
        .stroke({ color: 0xffd08a, alpha: 0.4, width: 2 });
      app.stage.addChild(rail);

      const rollers = new Graphics();
      for (let x = trackX - 72; x < finishX + 52; x += 36) {
        const rollerX = x + beltOffset;
        rollers.circle(rollerX, railY, 7).fill({ color: 0xfff7df, alpha: 0.72 });
        rollers.rect(rollerX + 13, railY - railHeight / 2 + 9, 5, railHeight - 18).fill({ color: 0x1f130d, alpha: 0.28 });
      }
      app.stage.addChild(rollers);

      const laneTag = new Text({
        text: `Rail ${railIndex + 1}`,
        style: { fill: 0xffffff, fontFamily: "Pretendard, Inter, sans-serif", fontSize: 13, fontWeight: "900" },
      });
      laneTag.x = padding;
      laneTag.y = railY - 10;
      app.stage.addChild(laneTag);
    });

    const finish = new Graphics();
    finish.roundRect(finishX, padding, 16, height - padding * 2, 4).fill({ color: 0x111827, alpha: 0.94 });
    for (let y = padding; y < height - padding; y += 18) {
      finish.rect(finishX, y, 16, 9).fill({ color: Math.floor((y - padding) / 18) % 2 === 0 ? 0xffffff : 0x111827 });
    }
    app.stage.addChild(finish);

    laneStates.forEach((lane, laneIndex) => {
      const railIndex = laneIndex % 2;
      const stackOffset = (Math.floor(laneIndex / 2) - 1) * 18;
      const railY = railYs[railIndex];
      const runnerX = startX + lane.displayProgress * Math.max(1, endX - startX);
      const runnerY = railY + stackOffset + Math.sin(now / 115 + laneIndex) * (lane.isEliminated ? 1 : 5);
      const activeLaneEvents = activeEvents.filter((event) => event.affectsAll || event.laneIndex === laneIndex);
      const hasGreenTea = activeLaneEvents.some((event) => event.type === "green-tea");
      const hasReverse = activeLaneEvents.some((event) => event.type === "reverse-belt");
      const hasChopsticks = activeLaneEvents.some((event) => event.type === "chopsticks");
      const layer = new Container();
      layer.alpha = lane.isEliminated ? 0.55 : 1;

      if (hasGreenTea) {
        const spill = new Graphics();
        spill.ellipse(runnerX + 10, railY + 32, 56, 13).fill({ color: 0x16a34a, alpha: 0.55 });
        spill.ellipse(runnerX - 32, railY + 34, 22, 8).fill({ color: 0x86efac, alpha: 0.65 });
        app.stage.addChild(spill);
      }

      const shadow = new Graphics();
      shadow.ellipse(runnerX, railY + 38, 34, 9).fill({ color: 0x000000, alpha: 0.24 });
      layer.addChild(shadow);

      const plateColor = Number(`0x${lane.color.replace("#", "")}`);
      const plate = new Graphics();
      plate.circle(runnerX, runnerY, 32).fill({ color: 0xffffff }).stroke({ color: plateColor, width: 3 });
      layer.addChild(plate);

      const menu = menuById.get(lane.menuId) ?? menuCards[0];
      const texture = textureRef.current.get(menu.imageUrl);
      if (texture) {
        const mask = new Graphics().circle(runnerX, runnerY, 24).fill({ color: 0xffffff });
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.x = runnerX;
        sprite.y = runnerY;
        sprite.width = 50;
        sprite.height = 50;
        sprite.mask = mask;
        layer.addChild(mask, sprite);
      } else {
        const fallback = new Text({
          text: lane.icon,
          style: { fontFamily: "Apple Color Emoji, Segoe UI Emoji", fontSize: 24 },
        });
        fallback.anchor.set(0.5);
        fallback.x = runnerX;
        fallback.y = runnerY;
        layer.addChild(fallback);
      }

      const nameText = new Text({
        text: lane.menuName,
        style: {
          fill: 0xffffff,
          fontFamily: "Pretendard, Inter, sans-serif",
          fontSize: width < 720 ? 11 : 13,
          fontWeight: "900",
          stroke: { color: 0x111827, width: 3 },
        },
      });
      nameText.anchor.set(0.5);
      nameText.x = runnerX;
      nameText.y = runnerY + 45;
      layer.addChild(nameText);

      if (hasReverse) {
        const sweat = new Text({
          text: "\u{1F4A6}",
          style: { fontFamily: "Apple Color Emoji, Segoe UI Emoji", fontSize: 22 },
        });
        sweat.x = runnerX + 30;
        sweat.y = runnerY - 48;
        layer.addChild(sweat);
      }

      if (hasChopsticks) {
        const chopsticks = new Graphics();
        chopsticks.moveTo(runnerX - 18, runnerY - 90).lineTo(runnerX - 6, runnerY - 13).stroke({ color: 0xa16207, width: 7, cap: "round" });
        chopsticks.moveTo(runnerX + 18, runnerY - 90).lineTo(runnerX + 6, runnerY - 13).stroke({ color: 0xa16207, width: 7, cap: "round" });
        layer.addChild(chopsticks);
      }

      if (lane.isEliminated) {
        const badge = new Graphics();
        badge.roundRect(runnerX - 26, runnerY - 54, 52, 26, 13).fill({ color: 0x991b1b, alpha: 0.96 });
        const eliminated = new Text({
          text: "OUT",
          style: { fill: 0xffffff, fontFamily: "Pretendard, Inter, sans-serif", fontSize: 13, fontWeight: "900" },
        });
        eliminated.anchor.set(0.5);
        eliminated.x = runnerX;
        eliminated.y = runnerY - 41;
        layer.addChild(badge, eliminated);
      }

      if (lane.isFinished) {
        const flag = new Text({
          text: "FIN",
          style: { fontFamily: "Apple Color Emoji, Segoe UI Emoji", fontSize: 24 },
        });
        flag.anchor.set(0.5);
        flag.x = runnerX + 44;
        flag.y = runnerY - 20;
        layer.addChild(flag);
      }

      app.stage.addChild(layer);
    });
  }, [activeEvents, assetTick, laneStates, now]);

  return (
    <section className="race-canvas-shell" aria-label="Sushi race track">
      <div className="race-pixi-host" ref={hostRef} />
      <div className="sr-only">
        {laneStates.map((lane) => `${lane.rank}. ${lane.menuName} ${lane.isEliminated ? "Out" : formatRaceTime(lane.finishMs)}`).join(", ")}
      </div>
    </section>
  );
}

type ResultViewProps = {
  room: RoomState;
};

function ResultView({ room }: ResultViewProps) {
  const result = room.result;
  const winnerMenu = menuById.get(result?.menuId ?? "") ?? menuCards[0];
  const rankings = result?.raceRankings ?? [];
  const votersByMenuId = useMemo(() => {
    const voters = new Map<string, string[]>();

    Object.values(room.votes ?? {}).forEach((entry) => {
      entry.menuIds.forEach((menuId) => {
        const next = voters.get(menuId) ?? [];
        next.push(entry.nickname);
        voters.set(menuId, next);
      });
    });

    return voters;
  }, [room.votes]);

  return (
    <section className="result-popup">
      <article className="result-popup__image">
        <MenuImage menu={winnerMenu} variant="winner" />
      </article>

      <section className="result-popup__rank-panel" aria-label="Race rankings">
        <div className="result-rankings">
          <article className="result-rank-row result-rank-row--head">
            <strong>Rank</strong>
            <span>Menu</span>
            <em>Time</em>
            <span>Selected By</span>
          </article>
          {rankings.map((entry) => (
            <article className="result-rank-row" key={entry.menuId}>
              <strong>{entry.rank}</strong>
              <span>{entry.menuName}</span>
              <em>{formatRaceTime(entry.finishMs)}</em>
              <span>{votersByMenuId.get(entry.menuId)?.join(", ") || "-"}</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function MenuImage({ menu, variant = "thumb" }: { menu: MenuCard; variant?: "preview" | "thumb" | "runner" | "winner" }) {
  const primarySrc = variant === "winner" ? getResultCardImageUrl(menu) : variant === "preview" || variant === "thumb" ? getFoodImageUrl(menu) : menu.imageUrl;
  const fallbackSrc = primarySrc === menu.imageUrl ? menu.fallbackImageUrl : menu.imageUrl;
  const [src, setSrc] = useState(primarySrc);

  useEffect(() => {
    setSrc(primarySrc);
  }, [primarySrc]);

  return (
    <span className={`menu-image menu-image--${variant}`}>
      <img
        alt=""
        src={src}
        onError={() => {
          if (src !== fallbackSrc) {
            setSrc(fallbackSrc);
          } else if (src !== menu.fallbackImageUrl) {
            setSrc(menu.fallbackImageUrl);
          }
        }}
      />
    </span>
  );
}

export default App;
