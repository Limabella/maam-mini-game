export type RoomStatus = "lobby" | "countdown" | "playing" | "result";

export type MenuStats = {
  taste: number;
  speed: number;
  balance: number;
  budget: number;
  mood: number;
};

export type MenuCard = {
  id: string;
  name: string;
  imageUrl: string;
  fallbackImageUrl: string;
  tags: string[];
  stats: MenuStats;
};

export type Player = {
  nickname: string;
  joinedAt: number;
};

export type ThrowEntry = {
  aimOffset?: number;
  charge?: number;
  launchedAt?: number;
  nickname: string;
  throwAt: number;
};

export type DartAimEntry = {
  aimOffset: number;
  isHolding: boolean;
  nickname: string;
  updatedAt: number;
};

export type SpinBoostEntry = {
  boostAt: number;
  power: number;
  durationMs: number;
};

export type ResultRankEntry = {
  uid: string;
  nickname: string;
  menuId: string;
  menuName: string;
  errorDeg: number;
  throwAt: number;
  rank: number;
};

export type ResultEntry = {
  menuId: string;
  menuName: string;
  winnerUid: string;
  winnerNickname: string;
  errorDeg: number;
  rankings: ResultRankEntry[];
};

export type RoomState = {
  hostUid: string;
  status: RoomStatus;
  createdAt: number;
  seed: number;
  startAt: number | null;
  spinStartAt?: number | null;
  spinBoosts?: Record<string, SpinBoostEntry>;
  wheelSpeed: number;
  menuCards: string[];
  players: Record<string, Player>;
  dartAims?: Record<string, DartAimEntry>;
  throws?: Record<string, ThrowEntry>;
  result?: ResultEntry | null;
};
