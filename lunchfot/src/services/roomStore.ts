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
  set,
  update,
  type Database,
} from "firebase/database";
import { menuCards } from "../data/menuCards";
import {
  createRaceEvents,
  createRaceDuration,
  selectFinalists,
  VOTE_LIMIT,
} from "../game/sushiRace";
import type { MenuVoteEntry, ResultEntry, RoomState } from "../types";

export type Unsubscribe = () => void;

export type RoomStore = {
  uid: string;
  mode: "firebase" | "local";
  createRoom: (nickname: string) => Promise<string>;
  joinRoom: (roomCode: string, nickname: string) => Promise<void>;
  watchRoom: (roomCode: string, onRoom: (room: RoomState | null) => void) => Unsubscribe;
  submitVote: (roomCode: string, nickname: string, menuIds: string[]) => Promise<void>;
  startGame: (roomCode: string) => Promise<void>;
  setPlaying: (roomCode: string) => Promise<void>;
  finishGame: (roomCode: string, result: ResultEntry) => Promise<void>;
  resetRoom: (roomCode: string) => Promise<void>;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LOCAL_UID_KEY = "lunch-sushi-race:uid";
const LOCAL_NICKNAME_KEY = "lunch-sushi-race:nickname";
const LOCAL_ROOM_PREFIX = "lunch-sushi-race:room:";
const listeners = new Map<string, Set<(room: RoomState | null) => void>>();
const CURRENT_MENU_IDS = menuCards.map((menu) => menu.id);
const CURRENT_MENU_ID_SET = new Set(CURRENT_MENU_IDS);
const RACE_COUNTDOWN_MS = 10_000;

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

const sanitizeVote = (menuIds: string[]) => {
  return Array.from(new Set(menuIds.filter((menuId) => CURRENT_MENU_ID_SET.has(menuId)))).slice(0, VOTE_LIMIT);
};

const buildVoteEntry = (nickname: string, menuIds: string[]): MenuVoteEntry => ({
  menuIds: sanitizeVote(menuIds),
  nickname,
  updatedAt: Date.now(),
});

const normalizeRoom = (room: RoomState): RoomState => {
  const normalizedMenuCards =
    room.menuCards?.length === CURRENT_MENU_IDS.length && room.menuCards.every((menuId) => CURRENT_MENU_ID_SET.has(menuId))
      ? room.menuCards
      : [...CURRENT_MENU_IDS];

  return {
    ...room,
    menuCards: normalizedMenuCards,
    spinStartAt: room.spinStartAt ?? null,
    spinBoosts: room.spinBoosts ?? {},
    wheelSpeed: room.wheelSpeed ?? 0.128,
    throws: room.throws ?? {},
    dartAims: room.dartAims ?? {},
    votes: room.votes ?? {},
    finalists: room.finalists ?? [],
    raceEvents: room.raceEvents ?? [],
    raceStartedAt: room.raceStartedAt ?? null,
    raceDurationMs: room.raceDurationMs ?? createRaceDuration(room.seed),
    result: room.result ?? null,
  };
};

const createInitialRoom = (hostUid: string, nickname: string): RoomState => {
  const now = Date.now();
  const seed = randomSeed();

  return {
    hostUid,
    status: "lobby",
    createdAt: now,
    seed,
    startAt: null,
    spinStartAt: null,
    spinBoosts: {},
    wheelSpeed: 0.128,
    menuCards: [...CURRENT_MENU_IDS],
    players: {
      [hostUid]: {
        nickname,
        joinedAt: now,
      },
    },
    votes: {},
    finalists: [],
    raceEvents: [],
    raceStartedAt: null,
    raceDurationMs: createRaceDuration(seed),
    throws: {},
    dartAims: {},
    result: null,
  };
};

const createRaceStartPatch = (room: RoomState) => {
  const seed = randomSeed();
  const roomWithSeed = normalizeRoom({ ...room, seed });
  const finalists = selectFinalists(roomWithSeed);
  const raceDurationMs = createRaceDuration(seed);
  const currentPlayerCount = Object.keys(room.players).length;

  return {
    status: "countdown" as const,
    seed,
    startAt: Date.now() + RACE_COUNTDOWN_MS,
    raceStartedAt: null,
    raceDurationMs,
    finalists,
    raceEvents: createRaceEvents(finalists, seed, raceDurationMs, currentPlayerCount),
    spinStartAt: null,
    spinBoosts: {},
    throws: {},
    dartAims: {},
    result: null,
  };
};

const readLocalRoom = (roomCode: string): RoomState | null => {
  const raw = localStorage.getItem(roomKey(roomCode));
  if (!raw) {
    return null;
  }

  try {
    const room = normalizeRoom(JSON.parse(raw) as RoomState);
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
        onRoom(room ? normalizeRoom(room) : null);
      });
    },
    submitVote: (roomCode, nickname, menuIds) => firebaseSubmitVote(database, user.uid, roomCode, nickname, menuIds),
    startGame: (roomCode) => firebaseStartGame(database, user.uid, roomCode),
    setPlaying: (roomCode) => firebaseSetPlaying(database, roomCode),
    finishGame: (roomCode, result) => firebaseFinishGame(database, roomCode, result),
    resetRoom: (roomCode) => firebaseResetRoom(database, user.uid, roomCode),
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

  const room = normalizeRoom(snapshot.val() as RoomState);
  if (room.status !== "lobby") {
    throw new Error("이미 시작된 방입니다.");
  }

  await set(ref(database, `rooms/${normalizedCode}/players/${uid}`), {
    nickname,
    joinedAt: Date.now(),
  });
};

const firebaseSubmitVote = async (
  database: Database,
  uid: string,
  roomCode: string,
  nickname: string,
  menuIds: string[],
) => {
  const roomRef = ref(database, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    return;
  }

  const room = normalizeRoom(snapshot.val() as RoomState);
  if (room.status !== "lobby") {
    return;
  }

  await set(ref(database, `rooms/${roomCode}/votes/${uid}`), buildVoteEntry(nickname, menuIds));
};

const firebaseStartGame = async (database: Database, uid: string, roomCode: string) => {
  const roomRef = ref(database, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    return;
  }

  const room = normalizeRoom(snapshot.val() as RoomState);
  if (room.status !== "lobby" || room.hostUid !== uid) {
    return;
  }

  await update(roomRef, createRaceStartPatch(room));
};

const firebaseSetPlaying = async (database: Database, roomCode: string) => {
  const roomRef = ref(database, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    return;
  }

  const room = normalizeRoom(snapshot.val() as RoomState);
  if (room.status !== "countdown") {
    return;
  }

  await update(roomRef, {
    status: "playing",
    raceStartedAt: Date.now(),
  });
};

const firebaseFinishGame = async (database: Database, roomCode: string, result: ResultEntry) => {
  await update(ref(database, `rooms/${roomCode}`), {
    status: "result",
    result,
  });
};

const firebaseResetRoom = async (database: Database, uid: string, roomCode: string) => {
  const roomRef = ref(database, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    return;
  }

  const room = normalizeRoom(snapshot.val() as RoomState);
  if (room.hostUid !== uid) {
    return;
  }

  await update(roomRef, {
    status: "lobby",
    startAt: null,
    raceStartedAt: null,
    finalists: [],
    raceEvents: [],
    result: null,
    throws: {},
    dartAims: {},
    spinStartAt: null,
    spinBoosts: {},
  });
};

const createLocalStore = (): RoomStore => {
  const uid = getLocalUid();

  window.addEventListener("storage", (event) => {
    if (!event.key?.startsWith(LOCAL_ROOM_PREFIX)) {
      return;
    }

    const roomCode = event.key.replace(LOCAL_ROOM_PREFIX, "");
    const room = event.newValue ? normalizeRoom(JSON.parse(event.newValue) as RoomState) : null;
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
    submitVote: async (roomCode, nickname, menuIds) => {
      const room = readLocalRoom(roomCode);
      if (!room || room.status !== "lobby") {
        return;
      }

      writeLocalRoom(roomCode, {
        ...room,
        votes: {
          ...(room.votes ?? {}),
          [uid]: buildVoteEntry(nickname, menuIds),
        },
      });
    },
    startGame: async (roomCode) => {
      const room = readLocalRoom(roomCode);
      if (!room || room.status !== "lobby" || room.hostUid !== uid) {
        return;
      }

      writeLocalRoom(roomCode, {
        ...room,
        ...createRaceStartPatch(room),
      });
    },
    setPlaying: async (roomCode) => {
      const room = readLocalRoom(roomCode);
      if (!room || room.status !== "countdown") {
        return;
      }

      writeLocalRoom(roomCode, {
        ...room,
        status: "playing",
        raceStartedAt: Date.now(),
      });
    },
    finishGame: async (roomCode, result) => {
      const room = readLocalRoom(roomCode);
      if (!room || room.status !== "playing") {
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
      if (!room || room.hostUid !== uid) {
        return;
      }

      writeLocalRoom(roomCode, {
        ...room,
        status: "lobby",
        startAt: null,
        raceStartedAt: null,
        finalists: [],
        raceEvents: [],
        result: null,
        throws: {},
        dartAims: {},
        spinStartAt: null,
        spinBoosts: {},
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
