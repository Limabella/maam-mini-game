import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";
import {
  get,
  getDatabase,
  onValue,
  ref,
  remove,
  set,
  update,
  type Database,
} from "firebase/database";
import { menuCards } from "../data/menuCards";
import { canThrowAtSpeed, MAX_SPIN_BOOSTS, SPIN_BOOST_DECAY_MS } from "../game/roulette";
import type { DartAimEntry, ResultEntry, RoomState, SpinBoostEntry, ThrowEntry } from "../types";

export type Unsubscribe = () => void;

export type RoomStore = {
  uid: string;
  mode: "firebase" | "local";
  createRoom: (nickname: string) => Promise<string>;
  joinRoom: (roomCode: string, nickname: string) => Promise<void>;
  watchRoom: (roomCode: string, onRoom: (room: RoomState | null) => void) => Unsubscribe;
  startGame: (roomCode: string) => Promise<void>;
  setPlaying: (roomCode: string) => Promise<void>;
  startSpin: (roomCode: string, boostPower?: number) => Promise<void>;
  updateDartAim: (roomCode: string, aim: DartAimEntry | null) => Promise<void>;
  throwDart: (roomCode: string, nickname: string, throwEntry?: Partial<ThrowEntry>) => Promise<void>;
  finishGame: (roomCode: string, result: ResultEntry) => Promise<void>;
  resetRoom: (roomCode: string) => Promise<void>;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LOCAL_UID_KEY = "lunch-dart:uid";
const LOCAL_NICKNAME_KEY = "lunch-dart:nickname";
const LOCAL_ROOM_PREFIX = "lunch-dart:room:";
const listeners = new Map<string, Set<(room: RoomState | null) => void>>();
const CURRENT_MENU_IDS = menuCards.map((menu) => menu.id);
const CURRENT_MENU_ID_SET = new Set(CURRENT_MENU_IDS);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

export const rememberNickname = (nickname: string) => {
  localStorage.setItem(LOCAL_NICKNAME_KEY, nickname);
};

export const getRememberedNickname = () => localStorage.getItem(LOCAL_NICKNAME_KEY) ?? "";

const roomKey = (roomCode: string) => `${LOCAL_ROOM_PREFIX}${roomCode}`;

const generateRoomCode = () => {
  return Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
};

const randomSeed = () => Math.floor(Math.random() * 2_147_483_647);

const clampBoostPower = (power: number | undefined) => {
  if (!Number.isFinite(power)) {
    return 3.2;
  }

  const direction = (power ?? 3.2) < 0 ? -1 : 1;
  const magnitude = Math.min(11, Math.max(2.6, Math.abs(power ?? 3.2)));

  return direction * magnitude;
};

const createSpinBoost = (uid: string, now: number, boostPower?: number): [string, SpinBoostEntry] => {
  const boostId = `${uid}-${now}-${Math.random().toString(36).slice(2, 8)}`;

  return [
    boostId,
    {
      boostAt: now,
      durationMs: SPIN_BOOST_DECAY_MS,
      power: clampBoostPower(boostPower),
    },
  ];
};

const getRecentBoostEntries = (room: RoomState, limit: number) => {
  return Object.entries(room.spinBoosts ?? {})
    .sort(([, a], [, b]) => b.boostAt - a.boostAt)
    .slice(0, limit);
};

const normalizeRoomMenus = (room: RoomState) => {
  const needsMigration =
    room.menuCards.length !== CURRENT_MENU_IDS.length ||
    room.menuCards.some((menuId) => !CURRENT_MENU_ID_SET.has(menuId));

  if (!needsMigration) {
    return room;
  }

  return {
    ...room,
    menuCards: [...CURRENT_MENU_IDS],
  };
};

const readLocalRoom = (roomCode: string): RoomState | null => {
  const raw = localStorage.getItem(roomKey(roomCode));
  if (!raw) {
    return null;
  }

  try {
    const room = normalizeRoomMenus(JSON.parse(raw) as RoomState);
    localStorage.setItem(roomKey(roomCode), JSON.stringify(room));
    return room;
  } catch {
    return null;
  }
};

const emitLocalRoom = (roomCode: string, room: RoomState | null) => {
  listeners.get(roomCode)?.forEach((listener) => listener(room));
};

const writeLocalRoom = (roomCode: string, room: RoomState | null) => {
  if (room) {
    localStorage.setItem(roomKey(roomCode), JSON.stringify(room));
  } else {
    localStorage.removeItem(roomKey(roomCode));
  }

  emitLocalRoom(roomCode, room);
};

const getLocalUid = () => {
  const existingUid = localStorage.getItem(LOCAL_UID_KEY);
  if (existingUid) {
    return existingUid;
  }

  const uid = `local-${crypto.randomUUID()}`;
  localStorage.setItem(LOCAL_UID_KEY, uid);
  return uid;
};

const createInitialRoom = (hostUid: string, nickname: string): RoomState => {
  const now = Date.now();

  return {
    hostUid,
    status: "lobby",
    createdAt: now,
    seed: randomSeed(),
    startAt: null,
    spinStartAt: null,
    spinBoosts: {},
    wheelSpeed: 0.128,
    menuCards: menuCards.map((menu) => menu.id),
    players: {
      [hostUid]: {
        nickname,
        joinedAt: now,
      },
    },
    throws: {},
    dartAims: {},
    result: null,
  };
};

const ensureFirebaseUser = (auth: Auth) =>
  new Promise<User>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      }
    });

    signInAnonymously(auth).catch((error) => {
      unsubscribe();
      reject(error);
    });
  });

const createFirebaseStore = async (): Promise<RoomStore> => {
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const database = getDatabase(app);
  const user = await ensureFirebaseUser(auth);

  return {
    uid: user.uid,
    mode: "firebase",
    createRoom: (nickname) => firebaseCreateRoom(database, user.uid, nickname),
    joinRoom: (roomCode, nickname) => firebaseJoinRoom(database, user.uid, roomCode, nickname),
    watchRoom: (roomCode, onRoom) => {
      const roomRef = ref(database, `rooms/${roomCode}`);
      return onValue(roomRef, (snapshot) => {
        const room = snapshot.val() as RoomState | null;

        if (!room) {
          onRoom(null);
          return;
        }

        const normalizedRoom = normalizeRoomMenus(room);
        if (normalizedRoom !== room) {
          update(roomRef, { menuCards: [...CURRENT_MENU_IDS] }).catch(() => {});
        }

        onRoom(normalizedRoom);
      });
    },
    startGame: (roomCode) => firebaseStartGame(database, roomCode),
    setPlaying: (roomCode) => firebaseSetPlaying(database, roomCode),
    startSpin: (roomCode, boostPower) => firebaseStartSpin(database, user.uid, roomCode, boostPower),
    updateDartAim: (roomCode, aim) => firebaseUpdateDartAim(database, user.uid, roomCode, aim),
    throwDart: (roomCode, nickname, throwEntry) => firebaseThrowDart(database, user.uid, roomCode, nickname, throwEntry),
    finishGame: (roomCode, result) => firebaseFinishGame(database, roomCode, result),
    resetRoom: (roomCode) => firebaseResetRoom(database, roomCode),
  };
};

const firebaseCreateRoom = async (database: Database, uid: string, nickname: string) => {
  let roomCode = generateRoomCode();
  let roomRef = ref(database, `rooms/${roomCode}`);
  let snapshot = await get(roomRef);

  while (snapshot.exists()) {
    roomCode = generateRoomCode();
    roomRef = ref(database, `rooms/${roomCode}`);
    snapshot = await get(roomRef);
  }

  await set(roomRef, createInitialRoom(uid, nickname));
  return roomCode;
};

const firebaseJoinRoom = async (database: Database, uid: string, roomCode: string, nickname: string) => {
  const normalizedCode = roomCode.toUpperCase();
  const roomRef = ref(database, `rooms/${normalizedCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    throw new Error("방을 찾을 수 없습니다.");
  }

  const room = snapshot.val() as RoomState;
  if (room.status !== "lobby") {
    throw new Error("이미 시작된 방입니다.");
  }

  await set(ref(database, `rooms/${normalizedCode}/players/${uid}`), {
    nickname,
    joinedAt: Date.now(),
  });
};

const firebaseStartGame = async (database: Database, roomCode: string) => {
  await update(ref(database, `rooms/${roomCode}`), {
    status: "countdown",
    startAt: Date.now() + 3200,
    spinStartAt: null,
    spinBoosts: {},
    throws: {},
    dartAims: {},
    result: null,
  });
};

const firebaseSetPlaying = async (database: Database, roomCode: string) => {
  await update(ref(database, `rooms/${roomCode}`), {
    status: "playing",
  });
};

const firebaseStartSpin = async (database: Database, uid: string, roomCode: string, boostPower?: number) => {
  const roomRef = ref(database, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    return;
  }

  const room = snapshot.val() as RoomState;
  if (room.status !== "playing" || room.hostUid !== uid) {
    return;
  }

  const now = Date.now();
  const [boostId, boost] = createSpinBoost(uid, now, boostPower);
  const recentIds = new Set(getRecentBoostEntries(room, MAX_SPIN_BOOSTS - 1).map(([id]) => id));
  const updates: Record<string, unknown> = {
    [`spinBoosts/${boostId}`]: boost,
  };

  if (!room.spinStartAt) {
    updates.spinStartAt = now;
  }

  Object.keys(room.spinBoosts ?? {}).forEach((id) => {
    if (!recentIds.has(id)) {
      updates[`spinBoosts/${id}`] = null;
    }
  });

  await update(roomRef, updates);
};

const firebaseUpdateDartAim = async (database: Database, uid: string, roomCode: string, aim: DartAimEntry | null) => {
  await set(ref(database, `rooms/${roomCode}/dartAims/${uid}`), aim);
};

const firebaseThrowDart = async (
  database: Database,
  uid: string,
  roomCode: string,
  nickname: string,
  throwEntry?: Partial<ThrowEntry>,
) => {
  const roomSnapshot = await get(ref(database, `rooms/${roomCode}`));
  if (!roomSnapshot.exists()) {
    return;
  }

  const room = roomSnapshot.val() as RoomState;
  if (room.status !== "playing" || !room.spinStartAt) {
    return;
  }

  if (!canThrowAtSpeed(room.spinStartAt, Date.now(), room.spinBoosts)) {
    return;
  }

  const throwRef = ref(database, `rooms/${roomCode}/throws/${uid}`);
  const snapshot = await get(throwRef);

  if (snapshot.exists()) {
    return;
  }

  const now = Date.now();
  await set(throwRef, {
    aimOffset: throwEntry?.aimOffset ?? 0,
    charge: throwEntry?.charge ?? 1,
    launchedAt: throwEntry?.launchedAt ?? now,
    nickname,
    throwAt: throwEntry?.throwAt ?? now,
  });
  await remove(ref(database, `rooms/${roomCode}/dartAims/${uid}`));
};

const firebaseFinishGame = async (database: Database, roomCode: string, result: ResultEntry) => {
  await update(ref(database, `rooms/${roomCode}`), {
    status: "result",
    result,
  });
};

const firebaseResetRoom = async (database: Database, roomCode: string) => {
  await update(ref(database, `rooms/${roomCode}`), {
    status: "lobby",
    startAt: null,
    spinStartAt: null,
    spinBoosts: {},
    result: null,
  });
  await remove(ref(database, `rooms/${roomCode}/throws`));
  await remove(ref(database, `rooms/${roomCode}/dartAims`));
};

const createLocalStore = (): RoomStore => {
  const uid = getLocalUid();

  window.addEventListener("storage", (event) => {
    if (!event.key?.startsWith(LOCAL_ROOM_PREFIX)) {
      return;
    }

    const roomCode = event.key.replace(LOCAL_ROOM_PREFIX, "");
    const room = event.newValue ? (JSON.parse(event.newValue) as RoomState) : null;
    emitLocalRoom(roomCode, room);
  });

  return {
    uid,
    mode: "local",
    createRoom: async (nickname) => {
      let roomCode = generateRoomCode();

      while (readLocalRoom(roomCode)) {
        roomCode = generateRoomCode();
      }

      writeLocalRoom(roomCode, createInitialRoom(uid, nickname));
      return roomCode;
    },
    joinRoom: async (roomCode, nickname) => {
      const normalizedCode = roomCode.toUpperCase();
      const room = readLocalRoom(normalizedCode);

      if (!room) {
        throw new Error("방을 찾을 수 없습니다.");
      }

      if (room.status !== "lobby") {
        throw new Error("이미 시작된 방입니다.");
      }

      writeLocalRoom(normalizedCode, {
        ...room,
        players: {
          ...room.players,
          [uid]: {
            nickname,
            joinedAt: Date.now(),
          },
        },
      });
    },
    watchRoom: (roomCode, onRoom) => {
      const normalizedCode = roomCode.toUpperCase();
      const roomListeners = listeners.get(normalizedCode) ?? new Set();
      roomListeners.add(onRoom);
      listeners.set(normalizedCode, roomListeners);
      onRoom(readLocalRoom(normalizedCode));

      return () => {
        roomListeners.delete(onRoom);
      };
    },
    startGame: async (roomCode) => {
      const room = readLocalRoom(roomCode);
      if (!room) {
        return;
      }

      writeLocalRoom(roomCode, {
        ...room,
        status: "countdown",
        startAt: Date.now() + 3200,
        spinStartAt: null,
        spinBoosts: {},
        throws: {},
        dartAims: {},
        result: null,
      });
    },
    setPlaying: async (roomCode) => {
      const room = readLocalRoom(roomCode);
      if (!room) {
        return;
      }

      writeLocalRoom(roomCode, {
        ...room,
        status: "playing",
      });
    },
    startSpin: async (roomCode, boostPower) => {
      const room = readLocalRoom(roomCode);
      if (!room || room.status !== "playing" || room.hostUid !== uid) {
        return;
      }

      const now = Date.now();
      const [boostId, boost] = createSpinBoost(uid, now, boostPower);
      const recentBoosts = getRecentBoostEntries(room, MAX_SPIN_BOOSTS - 1);

      writeLocalRoom(roomCode, {
        ...room,
        spinBoosts: {
          ...Object.fromEntries(recentBoosts),
          [boostId]: boost,
        },
        spinStartAt: room.spinStartAt ?? now,
      });
    },
    updateDartAim: async (roomCode, aim) => {
      const room = readLocalRoom(roomCode);
      if (!room || room.status !== "playing") {
        return;
      }

      const nextAims = { ...(room.dartAims ?? {}) };
      if (aim) {
        nextAims[uid] = aim;
      } else {
        delete nextAims[uid];
      }

      writeLocalRoom(roomCode, {
        ...room,
        dartAims: nextAims,
      });
    },
    throwDart: async (roomCode, nickname, throwEntry) => {
      const room = readLocalRoom(roomCode);
      if (!room || room.status !== "playing" || !room.spinStartAt || room.throws?.[uid]) {
        return;
      }

      if (!canThrowAtSpeed(room.spinStartAt, Date.now(), room.spinBoosts)) {
        return;
      }

      writeLocalRoom(roomCode, {
        ...room,
        dartAims: Object.fromEntries(Object.entries(room.dartAims ?? {}).filter(([aimUid]) => aimUid !== uid)),
        throws: {
          ...(room.throws ?? {}),
          [uid]: {
            aimOffset: throwEntry?.aimOffset ?? 0,
            charge: throwEntry?.charge ?? 1,
            launchedAt: throwEntry?.launchedAt ?? Date.now(),
            nickname,
            throwAt: throwEntry?.throwAt ?? Date.now(),
          },
        },
      });
    },
    finishGame: async (roomCode, result) => {
      const room = readLocalRoom(roomCode);
      if (!room) {
        return;
      }

      writeLocalRoom(roomCode, {
        ...room,
        status: "result",
        result,
      });
    },
    resetRoom: async (roomCode) => {
      const room = readLocalRoom(roomCode);
      if (!room) {
        return;
      }

      writeLocalRoom(roomCode, {
        ...room,
        status: "lobby",
        startAt: null,
        spinStartAt: null,
        spinBoosts: {},
        throws: {},
        dartAims: {},
        result: null,
      });
    },
  };
};

export const createRoomStore = async (): Promise<RoomStore> => {
  if (hasFirebaseConfig) {
    return createFirebaseStore();
  }

  return createLocalStore();
};
