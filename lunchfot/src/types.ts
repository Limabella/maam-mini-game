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

export type MenuVoteEntry = {
  menuIds: string[];
  nickname: string;
  updatedAt: number;
};

export type RaceEventType = "chopsticks" | "reverse-belt" | "green-tea" | "plate-stack";

export type RaceEvent = {
  id: string;
  type: RaceEventType;
  triggerAtMs: number;
  durationMs: number;
  laneIndex: number | null;
  menuId?: string;
  penaltyMs: number;
  affectsAll?: boolean;
  eliminates?: boolean;
};

export type RaceResultRankEntry = {
  rank: number;
  menuId: string;
  menuName: string;
  characterId: string;
  characterName: string;
  finishMs: number;
  penaltyMs: number;
  eliminated?: boolean;
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
  characterId?: string;
  characterName?: string;
  finishMs?: number;
  raceRankings?: RaceResultRankEntry[];
};

export type RoomState = {
  hostUid: string;
  status: RoomStatus;
  createdAt: number;
  seed: number;
  startAt: number | null;
  spinStartAt: number | null;
  spinBoosts: Record<string, SpinBoostEntry>;
  wheelSpeed: number;
  menuCards: string[];
  players: Record<string, Player>;
  votes?: Record<string, MenuVoteEntry>;
  finalists?: string[];
  raceEvents?: RaceEvent[];
  raceStartedAt?: number | null;
  raceDurationMs?: number;
  dartAims?: Record<string, DartAimEntry>;
  throws?: Record<string, ThrowEntry>;
  result?: ResultEntry | null;
};
