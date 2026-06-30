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
  getRaceLaneStates,
  getVoteTallies,
  hasRaceWinner,
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

    let frame = 0;
    const tick = () => {
      setNow(Date.now());
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    const fallback = window.setInterval(() => setNow(Date.now()), 160);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(fallback);
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

const getAssetStem = (menu: MenuCard) => {
  const match = menu.imageUrl.match(/\/([^/]+)\.png$/);
  return match?.[1] ?? menu.id.replace("-lm", "");
};

const getFoodImageUrl = (menu: MenuCard) => `/food/food_${getAssetStem(menu)}.png`;

const getRunnerImageUrl = (menu: MenuCard) => `/hero/runner_${getAssetStem(menu)}.png`;

const getRaceModelUrl = (menuId: string) => {
  const menuIndex = Math.max(0, menuCards.findIndex((menu) => menu.id === menuId));
  return `/3d_glb/3m_${String(menuIndex + 1).padStart(3, "0")}.glb`;
};

type LoadedRaceModel = {
  model: THREE.Group;
  clips: THREE.AnimationClip[];
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

  return {
    model: normalized,
    clips: selectRunningClips(clips),
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
  { id: "sushi", label: "\ud68c\uc804 \ucd08\ubc25 \ub808\uc774\uc2a4", enabled: true },
  { id: "pending", label: "\uc900\ube44\uc911", enabled: false },
  { id: "dart", label: "\ub2e4\ud2b8 \uac8c\uc784", enabled: false },
];

const FLOW_STEPS: Record<FlowStepId, string> = {
  main: "main",
  "game-select": "\uac8c\uc784\uc120\ud0dd",
  "vote-select": "\ud22c\ud45c\uc120\ud0dd",
  playing: "\uac8c\uc784\uc9c4\ud589",
  result: "\uacb0\uacfc\ud654\uba74",
};

const ROOM_STATUS_TO_STEP: Record<RoomStatus, FlowStepId> = {
  lobby: "vote-select",
  countdown: "playing",
  playing: "playing",
  result: "result",
};

const getRoomStepLabel = (status: RoomStatus) => FLOW_STEPS[ROOM_STATUS_TO_STEP[status]];

const RACE_EVENT_META: Record<RaceEventType, { icon: string; label: string }> = {
  chopsticks: { icon: "🥢", label: "젓가락 탈락" },
  "reverse-belt": { icon: "↩", label: "역주행 레일" },
  "green-tea": { icon: "🍵", label: "녹차 미끄러짐" },
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
      setMessage(error instanceof Error ? error.message : "방 생성에 실패했습니다.");
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
      setMessage(error instanceof Error ? error.message : "입장에 실패했습니다.");
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
        <p className="env-note">Firebase 환경변수가 없어서 이 브라우저의 로컬 데모 모드로 실행 중입니다.</p>
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
        ⚙
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
            {"\uac8c\uc784 \uc0dd\uc131"}
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
            {"\ubc29 \uc785\uc7a5"}
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
              placeholder={"\ubc29 \uc785\uc7a5 \ucf54\ub4dc"}
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
            ×
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

function GameRoom({ audio, currentUid, nickname, room, roomCode, store }: GameRoomProps) {
  const now = useNow(room.status === "countdown" || room.status === "playing");
  const prevStatusRef = useRef(room.status);
  const prevRaceVisibleRef = useRef(false);
  const [raceModelsReady, setRaceModelsReady] = useState(false);
  const isHost = room.hostUid === currentUid;
  const finalistIds = room.finalists?.length ? room.finalists : selectFinalists(room);
  const finalistKey = finalistIds.slice(0, FINALIST_COUNT).join("|");

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
      return;
    }

    let cancelled = false;
    setRaceModelsReady(false);
    Promise.all([preloadRaceModels(finalistIds.slice(0, FINALIST_COUNT)), loadLoadingBotModel()])
      .then(() => {
        if (!cancelled) {
          setRaceModelsReady(true);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setRaceModelsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [finalistKey, room.status]);

  const handleStart = () => {
    audio.arm();
    audio.playGrab();
    store.startGame(roomCode).catch(console.error);
  };

  const handleReset = () => {
    store.resetRoom(roomCode).catch(console.error);
  };

  const isRacePreparing = room.status === "countdown" || (room.status === "playing" && !raceModelsReady);

  if (isRacePreparing) {
    return <RaceLoadingStage />;
  }

  if (room.status === "playing" && raceModelsReady) {
    return (
      <section className="stage race-stage">
        <ThreeSushiRaceTrack room={room} now={now} />
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
        <span>{getRoomStepLabel(room.status)}</span>
      </div>
      <button className="icon-button" type="button" title="초대 링크 복사" onClick={copyShareUrl}>
        {copied ? "OK" : "↗"}
      </button>
    </section>
  );
}

function RaceLoadingStage() {
  return (
    <section className="countdown-stage race-loading-stage" aria-label="Loading race assets">
      <img className="countdown-logo race-loading-logo" src="/other/maam-food-logo.png" alt="MaAM Food" />
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
    const camera = new THREE.OrthographicCamera(-2.35, 2.35, 1.35, -1.15, 0.1, 20);
    camera.position.set(0, 0.95, 5);
    camera.lookAt(0, 0.38, 0);

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
      const progress = (frameTime % 2600) / 2600;

      if (runner) {
        runner.position.set(-1.75 + progress * 3.5, -0.36 + Math.sin(frameTime / 120) * 0.025, 0);
        runner.rotation.z = Math.sin(frameTime / 150) * 0.035;
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
        runner.scale.setScalar(1.15);
        runner.rotation.y = 0;
        scene.add(runner);

        if (loadedModel.clips.length) {
          mixer = new THREE.AnimationMixer(runner);
          loadedModel.clips.forEach((clip) => {
            const action = mixer?.clipAction(clip);
            action?.setEffectiveTimeScale(1.18);
            action?.play();
          });
        }
      })
      .catch(console.error);

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

  return <div className="loading-bot-runner" ref={hostRef} />;
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
  const [draftVotes, setDraftVotes] = useState(savedVotes);
  const tallies = useMemo(() => getVoteTallies(room), [room]);
  const tallyByMenuId = useMemo(() => new Map(tallies.map((entry) => [entry.menuId, entry.votes])), [tallies]);
  const hasAnyVote = tallies.some((entry) => entry.votes > 0);

  useEffect(() => {
    setDraftVotes(savedVotes);
  }, [savedVotes.join("|")]);

  const submitVote = (menuIds: string[]) => {
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
          <p className="status-label">최종 투표</p>
          <h2>20개 메뉴 중 5개 출전</h2>
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
          const locked = !selected && draftVotes.length >= VOTE_LIMIT;

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
            상위 5개 레이스 시작
          </button>
        ) : (
          <p className="waiting-text">방장이 시작하면 상위 5개 후보로 바로 출발합니다.</p>
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
  const activeEventLabel = activeEvents.map((event) => RACE_EVENT_META[event.type].label).join(" · ");
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
      <div className={`event-light${activeEvents.length ? " is-active" : ""}`} title={activeEventLabel || "이벤트 대기"}>
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
        drawEmoji(context, "🍵", runnerX - 54, beltY + 10, 23);
      }

      if (hasReverse) {
        context.fillStyle = "#1d4ed8";
        drawRoundRect(context, finishX - 62, laneMidY - 18, 36, 36, 8);
        context.fill();
        context.fillStyle = "#ffffff";
        context.font = "950 24px Inter, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("↩", finishX - 44, laneMidY + 1);
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
        context.fillText("탈락", runnerX, laneY + 18);
      }

      if (lane.isFinished) {
        drawEmoji(context, "🏁", runnerX + 46, runnerY - 18, 22);
      }

      context.restore();
    });
  }, [activeEvents, laneStates, now, room.seed]);

  return (
    <section className="race-canvas-shell" aria-label="Sushi race track">
      <canvas className="race-canvas" ref={canvasRef} />
      <div className="sr-only">
        {laneStates.map((lane) => `${lane.rank}위 ${lane.menuName} ${lane.isEliminated ? "탈락" : formatRaceTime(lane.finishMs)}`).join(", ")}
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
  const modelCacheRef = useRef<Map<string, LoadedRaceModel>>(new Map());
  const animationMixersRef = useRef<THREE.AnimationMixer[]>([]);
  const racerObjectsRef = useRef<
    Map<
      string,
      {
        laneIndex: number;
        runner: THREE.Group;
        shadow: THREE.Mesh;
      }
    >
  >(new Map());
  const [modelReady, setModelReady] = useState(0);
  const laneStates = getRaceLaneStates(room, now);
  const menuIds = laneStates.map((lane) => lane.menuId).join("|");

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
    scene.add(trackGroup, racerGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    trackGroupRef.current = trackGroup;
    racerGroupRef.current = racerGroup;

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
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(renderFrame);
    };

    frameId = window.requestAnimationFrame(renderFrame);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      renderer.dispose();
      host.removeChild(renderer.domElement);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      trackGroupRef.current = null;
      racerGroupRef.current = null;
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

    if (!host || !renderer || !scene || !camera || !trackGroup || !racerGroup) {
      return;
    }

    if (!laneStates.every((lane) => modelCacheRef.current.has(lane.menuId))) {
      racerGroup.clear();
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
    racerGroup.clear();
    animationMixersRef.current = [];
    racerObjectsRef.current.clear();

    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 });

    const startX = -3.55;
    const endX = 3.55;
    const railZs = [-1.72, 1.86];
    const railYOffsets = [0.18, 0];
    const railShadowYOffsets = [0.14, 0];

    laneStates.forEach((lane, laneIndex) => {
      const railIndex = laneIndex % 2;
      const laneSlot = Math.floor(laneIndex / 2);
      const stackOffset = (laneSlot - 1) * 0.46;
      const x = startX + lane.displayProgress * Math.max(1, endX - startX);
      const z = railZs[railIndex] + stackOffset;
      const bob = lane.isEliminated ? 0 : Math.sin(now / 115 + laneIndex) * 0.055;
      const loadedModel = modelCacheRef.current.get(lane.menuId);

      if (!loadedModel) {
        return;
      }

      const runner = cloneSkeleton(loadedModel.model) as THREE.Group;
      runner.renderOrder = 10 + railIndex * 10 + laneSlot;
      runner.scale.multiplyScalar(width < 760 ? 0.736 : 0.896);
      runner.position.set(x, 0.16 + railYOffsets[railIndex] + bob, z);
      runner.rotation.y = 0;
      runner.rotation.z = Math.sin(now / 180 + laneIndex) * 0.04;
      loadedModel.clips.forEach((clip) => {
        const mixer = new THREE.AnimationMixer(runner);
        const action = mixer.clipAction(clip);
        action.timeScale = 1.15;
        action.play();
        mixer.setTime(((now / 1000) + laneIndex * 0.18) % Math.max(0.1, clip.duration));
        animationMixersRef.current.push(mixer);
      });
      runner.traverse((child) => {
        if (child instanceof THREE.Object3D) {
          child.visible = !lane.isEliminated || Math.sin(now / 120) > -0.2;
        }
      });

      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), shadowMaterial);
      shadow.renderOrder = runner.renderOrder - 1;
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(x, 0.02 + railShadowYOffsets[railIndex], z);
      shadow.scale.set(1.12, 0.42, 1);
      racerGroup.add(shadow, runner);
      racerObjectsRef.current.set(lane.menuId, { laneIndex, runner, shadow });
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

    const startX = -3.55;
    const endX = 3.55;
    const railZs = [-1.72, 1.86];
    const railYOffsets = [0.18, 0];
    const railShadowYOffsets = [0.14, 0];

    laneStates.forEach((lane, laneIndex) => {
      const racer = racerObjectsRef.current.get(lane.menuId);
      if (!racer) {
        return;
      }

      const railIndex = laneIndex % 2;
      const laneSlot = Math.floor(laneIndex / 2);
      const stackOffset = (laneSlot - 1) * 0.46;
      const x = startX + lane.displayProgress * Math.max(1, endX - startX);
      const z = railZs[railIndex] + stackOffset;
      const bob = lane.isEliminated ? 0 : Math.sin(now / 115 + laneIndex) * 0.055;
      const visible = !lane.isEliminated || Math.sin(now / 120) > -0.2;

      racer.runner.position.set(x, 0.16 + railYOffsets[railIndex] + bob, z);
      racer.runner.rotation.z = Math.sin(now / 180 + laneIndex) * 0.04;
      racer.runner.visible = visible;
      racer.shadow.position.set(x, 0.02 + railShadowYOffsets[railIndex], z);
      racer.shadow.visible = visible;
    });
  }, [laneStates, modelReady, now]);

  return (
    <section className="race-canvas-shell race-canvas-shell--3d" aria-label="3D sushi race track">
      <div className="race-rail-stage" aria-hidden="true">
        <div className="race-rail-object race-rail-object--top" />
        <div className="race-rail-object race-rail-object--bottom" />
        <div className="race-finish-mascot" />
      </div>
      <div className="race-three-host" ref={hostRef} />
      <div className="sr-only">
        {laneStates.map((lane) => `${lane.rank}위 ${lane.menuName} ${lane.isEliminated ? "탈락" : formatRaceTime(lane.finishMs)}`).join(", ")}
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
        text: `${railIndex + 1} 레일`,
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
          text: "💦",
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
          text: "탈락",
          style: { fill: 0xffffff, fontFamily: "Pretendard, Inter, sans-serif", fontSize: 13, fontWeight: "900" },
        });
        eliminated.anchor.set(0.5);
        eliminated.x = runnerX;
        eliminated.y = runnerY - 41;
        layer.addChild(badge, eliminated);
      }

      if (lane.isFinished) {
        const flag = new Text({
          text: "🏁",
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
        {laneStates.map((lane) => `${lane.rank}위 ${lane.menuName} ${lane.isEliminated ? "탈락" : formatRaceTime(lane.finishMs)}`).join(", ")}
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
            <strong>순위</strong>
            <span>음식명</span>
            <em>걸린시간</em>
            <span>선택사용자이름</span>
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
  const primarySrc = variant === "preview" || variant === "thumb" ? getFoodImageUrl(menu) : menu.imageUrl;
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
          if (src !== menu.fallbackImageUrl) {
            setSrc(menu.fallbackImageUrl);
          }
        }}
      />
    </span>
  );
}

export default App;

