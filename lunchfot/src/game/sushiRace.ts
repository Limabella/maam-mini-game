import { menuById, menuCards } from "../data/menuCards";
import { getMenuDisplayName, getRacerForMenu } from "../data/sushiRacers";
import type { RaceEvent, RaceEventType, RaceResultRankEntry, ResultEntry, RoomState } from "../types";

export const FINALIST_COUNT = 5;
export const VOTE_LIMIT = 5;
export const RACE_MIN_DURATION_MS = 30_000;
export const RACE_MAX_DURATION_MS = 180_000;

export type VoteTally = {
  menuId: string;
  votes: number;
  index: number;
};

export type RaceLaneState = {
  menuId: string;
  menuName: string;
  characterId: string;
  characterName: string;
  icon: string;
  color: string;
  accent: string;
  style: string;
  progress: number;
  displayProgress: number;
  finishMs: number;
  penaltyMs: number;
  rank: number;
  activeEventTypes: RaceEventType[];
  isEliminated: boolean;
  isFinished: boolean;
};

const hashString = (value: string) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const createSeededRandom = (seed: number) => {
  let value = seed || 1;

  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const getCandidateIds = (room: RoomState) => {
  const validIds = new Set(menuCards.map((menu) => menu.id));
  const fromRoom = room.menuCards.filter((menuId) => validIds.has(menuId));
  return fromRoom.length === menuCards.length ? fromRoom : menuCards.map((menu) => menu.id);
};

export const getVoteTallies = (room: RoomState): VoteTally[] => {
  const candidateIds = getCandidateIds(room);
  const tally = new Map(candidateIds.map((menuId) => [menuId, 0]));

  Object.values(room.votes ?? {}).forEach((entry) => {
    const uniqueVotes = Array.from(new Set(entry.menuIds)).slice(0, VOTE_LIMIT);
    uniqueVotes.forEach((menuId) => {
      if (tally.has(menuId)) {
        tally.set(menuId, (tally.get(menuId) ?? 0) + 1);
      }
    });
  });

  return candidateIds.map((menuId, index) => ({
    menuId,
    votes: tally.get(menuId) ?? 0,
    index,
  }));
};

export const selectFinalists = (room: RoomState) => {
  return getVoteTallies(room)
    .sort((a, b) => b.votes - a.votes || a.index - b.index)
    .slice(0, FINALIST_COUNT)
    .map((entry) => entry.menuId);
};

export const createRaceDuration = (seed: number) => {
  const random = createSeededRandom(seed);
  return Math.round(RACE_MIN_DURATION_MS + random() * (RACE_MAX_DURATION_MS - RACE_MIN_DURATION_MS));
};

export const createRaceEvents = (finalists: string[], seed: number, durationMs: number, playerCount: number): RaceEvent[] => {
  const random = createSeededRandom(seed ^ 0x6c756e63);
  const pickLane = () => Math.floor(random() * Math.max(1, finalists.length));
  const jitter = (amount = 0.05) => (random() - 0.5) * amount * durationMs;
  const clampTrigger = (value: number) => Math.round(Math.min(durationMs - 3800, Math.max(4200, value)));
  const greenTeaLane = pickLane();
  const events: RaceEvent[] = [
    {
      id: "reverse-belt-1",
      type: "reverse-belt",
      triggerAtMs: clampTrigger(durationMs * 0.26 + jitter()),
      durationMs: 3600,
      laneIndex: null,
      penaltyMs: 2200 + Math.round(random() * 1300),
      affectsAll: true,
    },
    {
      id: "green-tea-1",
      type: "green-tea",
      triggerAtMs: clampTrigger(durationMs * 0.48 + jitter()),
      durationMs: 2100,
      laneIndex: greenTeaLane,
      menuId: finalists[greenTeaLane] ?? finalists[0],
      penaltyMs: 2600 + Math.round(random() * 1800),
    },
  ];

  if (playerCount > 2) {
    const chopstickLane = pickLane();
    events.push({
      id: "chopsticks-1",
      type: "chopsticks",
      triggerAtMs: clampTrigger(durationMs * 0.68 + jitter()),
      durationMs: 2400,
      laneIndex: chopstickLane,
      menuId: finalists[chopstickLane] ?? finalists[0],
      penaltyMs: 0,
      eliminates: true,
    });
  }

  return events.sort((a, b) => a.triggerAtMs - b.triggerAtMs);
};

const getRaceBaseFinishMs = (room: RoomState, menuId: string, laneIndex: number) => {
  const durationMs = room.raceDurationMs ?? RACE_MIN_DURATION_MS;
  const menu = menuById.get(menuId);
  const statsSpeed = menu?.stats.speed ?? 3;
  const statsMood = menu?.stats.mood ?? 3;
  const statsBalance = menu?.stats.balance ?? 3;
  const laneHash = hashString(`${room.seed}:${menuId}:${laneIndex}`);
  const randomBias = (laneHash % 1000) / 1000;
  const speedBonus = (statsSpeed - 3) * 0.025 + (statsMood - 3) * 0.012 + (statsBalance - 3) * 0.008;
  const baseFactor = 0.88 + randomBias * 0.24 - speedBonus;

  return Math.round(durationMs * Math.min(1.15, Math.max(0.72, baseFactor)));
};

const getLanePenaltyMs = (room: RoomState, laneIndex: number, elapsedMs = Number.POSITIVE_INFINITY) => {
  return (room.raceEvents ?? [])
    .filter(
      (event) =>
        event.type !== "chopsticks" &&
        (event.affectsAll || event.laneIndex === laneIndex) &&
        elapsedMs >= event.triggerAtMs,
    )
    .reduce((total, event) => total + event.penaltyMs, 0);
};

const getEliminationEvent = (room: RoomState, laneIndex: number, elapsedMs = Number.POSITIVE_INFINITY) => {
  return (room.raceEvents ?? []).find(
    (event) => event.eliminates && event.laneIndex === laneIndex && elapsedMs >= event.triggerAtMs,
  );
};

export const getLaneFinishMs = (room: RoomState, menuId: string, laneIndex: number) => {
  if (getEliminationEvent(room, laneIndex)) {
    return Number.POSITIVE_INFINITY;
  }

  return getRaceBaseFinishMs(room, menuId, laneIndex) + getLanePenaltyMs(room, laneIndex);
};

export const getActiveRaceEvents = (room: RoomState, now: number) => {
  const startedAt = room.raceStartedAt ?? null;

  if (!startedAt) {
    return [];
  }

  const elapsedMs = now - startedAt;
  return (room.raceEvents ?? []).filter(
    (event) => elapsedMs >= event.triggerAtMs && elapsedMs <= event.triggerAtMs + event.durationMs,
  );
};

export const getRaceLaneStates = (room: RoomState, now: number): RaceLaneState[] => {
  const finalists = room.finalists?.length ? room.finalists.slice(0, FINALIST_COUNT) : selectFinalists(room);
  const startedAt = room.raceStartedAt ?? null;
  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : 0;
  const activeEvents = getActiveRaceEvents(room, now);

  const lanes = finalists.map((menuId, laneIndex) => {
    const menu = menuById.get(menuId);
    const racer = getRacerForMenu(menuId);
    const eliminationEvent = getEliminationEvent(room, laneIndex, elapsedMs);
    const visibleElapsed = eliminationEvent ? eliminationEvent.triggerAtMs : elapsedMs;
    const penaltyMs = getLanePenaltyMs(room, laneIndex, visibleElapsed);
    const baseFinishMs = getRaceBaseFinishMs(room, menuId, laneIndex);
    const finishMs = eliminationEvent ? Number.POSITIVE_INFINITY : baseFinishMs + getLanePenaltyMs(room, laneIndex);
    const effectiveElapsed = Math.max(0, visibleElapsed - penaltyMs);
    const rawProgress = eliminationEvent ? Math.min(0.985, effectiveElapsed / Math.max(1, baseFinishMs)) : Math.min(1, effectiveElapsed / Math.max(1, baseFinishMs));
    const laneWave = Math.sin((elapsedMs / 520) + laneIndex * 1.4) * 0.006;
    const displayProgress = Math.min(1, Math.max(0, rawProgress + (rawProgress < 1 ? laneWave : 0)));
    const activeEventTypes = activeEvents
      .filter((event) => event.affectsAll || event.laneIndex === laneIndex)
      .map((event) => event.type);

    return {
      menuId,
      menuName: getMenuDisplayName(menu),
      characterId: racer.characterId,
      characterName: racer.characterName,
      icon: racer.icon,
      color: racer.color,
      accent: racer.accent,
      style: racer.style,
      progress: rawProgress,
      displayProgress,
      finishMs,
      penaltyMs,
      rank: 0,
      activeEventTypes,
      isEliminated: Boolean(eliminationEvent),
      isFinished: !eliminationEvent && rawProgress >= 1,
    };
  });

  return lanes.map((lane) => ({
    ...lane,
    rank:
      lanes.filter((other) => {
        if (lane.isEliminated && !other.isEliminated) {
          return true;
        }

        if (!lane.isEliminated && other.isEliminated) {
          return false;
        }

        return other.progress > lane.progress || (other.progress === lane.progress && other.finishMs < lane.finishMs);
      }).length + 1,
  }));
};

export const hasRaceWinner = (room: RoomState, now: number) => {
  if (room.status !== "playing" || !room.raceStartedAt) {
    return false;
  }

  return getRaceLaneStates(room, now).some((lane) => lane.isFinished);
};

export const calculateRaceResult = (room: RoomState): ResultEntry => {
  const finalists = room.finalists?.length ? room.finalists.slice(0, FINALIST_COUNT) : selectFinalists(room);
  const raceRankings: RaceResultRankEntry[] = finalists
    .map((menuId, laneIndex) => {
      const menu = menuById.get(menuId);
      const racer = getRacerForMenu(menuId);
      const eliminated = Boolean(getEliminationEvent(room, laneIndex));

      return {
        rank: 0,
        menuId,
        menuName: getMenuDisplayName(menu),
        characterId: racer.characterId,
        characterName: racer.characterName,
        finishMs: eliminated ? Number.POSITIVE_INFINITY : getLaneFinishMs(room, menuId, laneIndex),
        penaltyMs: getLanePenaltyMs(room, laneIndex),
        eliminated,
      };
    })
    .sort((a, b) => {
      if (a.eliminated !== b.eliminated) {
        return a.eliminated ? 1 : -1;
      }

      return a.finishMs - b.finishMs || a.menuName.localeCompare(b.menuName);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  const winner = raceRankings[0];

  return {
    menuId: winner.menuId,
    menuName: winner.menuName,
    winnerUid: "race",
    winnerNickname: winner.characterName,
    errorDeg: 0,
    rankings: [],
    characterId: winner.characterId,
    characterName: winner.characterName,
    finishMs: winner.finishMs,
    raceRankings,
  };
};

export const formatRaceTime = (valueMs: number) => {
  if (!Number.isFinite(valueMs)) {
    return "탈락";
  }

  return `${(valueMs / 1000).toFixed(2)}s`;
};
