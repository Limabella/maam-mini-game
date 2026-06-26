import { menuById, menuCards } from "../data/menuCards";
import type { ResultEntry, ResultRankEntry, RoomState, SpinBoostEntry } from "../types";

export const SLICE_DEG = 360 / menuCards.length;
export const ROUND_DURATION_MS = 20000;
export const THROW_WINDOW_START_MS = 5000;
export const THROW_WINDOW_END_MS = 18000;
export const MAX_SPIN_BOOSTS = 5;
export const SPIN_BOOST_DECAY_MS = 3200;
export const MIN_THROW_SPEED_FACTOR = 0.2;
export const MAX_THROW_SPEED_FACTOR = 2.4;

const POINTER_DEG = 0;
const MIN_SPEED_MULTIPLIER = 0.04;
const START_SPEED_MULTIPLIER = 2.2;
const MID_START_SPEED_MULTIPLIER = 1.45;
const MID_END_SPEED_MULTIPLIER = 0.92;
const SPIN_FAST_END_MS = 5000;
const SPIN_STEADY_END_MS = 15000;

export const normalizeDeg = (deg: number) => ((deg % 360) + 360) % 360;

export const angularDistance = (a: number, b: number) => {
  const diff = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return Math.min(diff, 360 - diff);
};

export const angularSignedDistance = (from: number, to: number) => {
  let diff = normalizeDeg(to) - normalizeDeg(from);
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
};

export const seedToAngle = (seed: number) => {
  let value = seed || 1;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return normalizeDeg(value) % 360;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const getSpinProgress = (elapsed: number) => clamp(elapsed / ROUND_DURATION_MS, 0, 1);

export const getSpinSpeedMultiplier = (elapsed: number) => {
  const activeElapsed = clamp(elapsed, 0, ROUND_DURATION_MS);

  if (activeElapsed <= SPIN_FAST_END_MS) {
    const progress = activeElapsed / SPIN_FAST_END_MS;
    const eased = 1 - Math.pow(1 - progress, 2);
    return START_SPEED_MULTIPLIER + (MID_START_SPEED_MULTIPLIER - START_SPEED_MULTIPLIER) * eased;
  }

  if (activeElapsed <= SPIN_STEADY_END_MS) {
    const progress = (activeElapsed - SPIN_FAST_END_MS) / (SPIN_STEADY_END_MS - SPIN_FAST_END_MS);
    return MID_START_SPEED_MULTIPLIER + (MID_END_SPEED_MULTIPLIER - MID_START_SPEED_MULTIPLIER) * progress;
  }

  const progress = (activeElapsed - SPIN_STEADY_END_MS) / (ROUND_DURATION_MS - SPIN_STEADY_END_MS);
  const eased = Math.pow(progress, 2);
  return MID_END_SPEED_MULTIPLIER + (MIN_SPEED_MULTIPLIER - MID_END_SPEED_MULTIPLIER) * eased;
};

export const getSpinIntensity = (elapsed: number) => {
  const multiplier = getSpinSpeedMultiplier(elapsed);
  return clamp((multiplier - MIN_SPEED_MULTIPLIER) / (START_SPEED_MULTIPLIER - MIN_SPEED_MULTIPLIER), 0, 1);
};

const getIntegratedSpinTime = (elapsed: number) => {
  const activeElapsed = Math.min(elapsed, ROUND_DURATION_MS);
  let activeSpinTime = 0;
  let cursor = 0;

  while (cursor < activeElapsed) {
    const nextCursor = Math.min(activeElapsed, cursor + 80);
    activeSpinTime += getSpinSpeedMultiplier((cursor + nextCursor) / 2) * (nextCursor - cursor);
    cursor = nextCursor;
  }

  const tailElapsed = Math.max(0, elapsed - ROUND_DURATION_MS);

  return activeSpinTime + tailElapsed * MIN_SPEED_MULTIPLIER;
};

const getIntegratedBoostTime = (boost: SpinBoostEntry, now: number) => {
  const duration = boost.durationMs || SPIN_BOOST_DECAY_MS;
  const elapsed = clamp(now - boost.boostAt, 0, duration);
  const progress = elapsed / duration;

  return (boost.power * duration * (1 - Math.pow(1 - progress, 3))) / 3;
};

export const getActiveBoostPower = (boosts: Record<string, SpinBoostEntry> | undefined, now: number) => {
  return Object.values(boosts ?? {}).reduce((total, boost) => {
    const duration = boost.durationMs || SPIN_BOOST_DECAY_MS;
    const elapsed = clamp(now - boost.boostAt, 0, duration);
    const decay = Math.pow(1 - elapsed / duration, 2);

    return total + boost.power * decay;
  }, 0);
};

export const getCurrentSpinFactor = (
  startAt: number | null,
  now: number,
  boosts?: Record<string, SpinBoostEntry>,
) => {
  if (!startAt) {
    return 0;
  }

  return getSpinSpeedMultiplier(Math.max(0, now - startAt)) + getActiveBoostPower(boosts, now);
};

export const canThrowAtSpeed = (
  startAt: number | null,
  now: number,
  _boosts?: Record<string, SpinBoostEntry>,
) => {
  if (!startAt) {
    return false;
  }

  const elapsed = now - startAt;
  return elapsed >= THROW_WINDOW_START_MS && elapsed <= THROW_WINDOW_END_MS;
};

export const getWheelRotation = (
  seed: number,
  startAt: number | null,
  wheelSpeed: number,
  now: number,
  boosts?: Record<string, SpinBoostEntry>,
) => {
  if (!startAt) {
    return seedToAngle(seed);
  }

  const elapsed = Math.max(0, now - startAt);
  const boostSpinTime = Object.values(boosts ?? {}).reduce((total, boost) => total + getIntegratedBoostTime(boost, now), 0);

  return seedToAngle(seed) + (getIntegratedSpinTime(elapsed) + boostSpinTime) * wheelSpeed;
};

export const getWheelAngle = (
  seed: number,
  startAt: number | null,
  wheelSpeed: number,
  now: number,
  boosts?: Record<string, SpinBoostEntry>,
) => {
  return normalizeDeg(getWheelRotation(seed, startAt, wheelSpeed, now, boosts));
};

export const getClosestMenuForThrow = (room: RoomState, throwAt: number) => {
  const wheelAngle = getWheelAngle(room.seed, room.spinStartAt ?? null, room.wheelSpeed, throwAt, room.spinBoosts);

  return room.menuCards.reduce(
    (best, menuId, index) => {
      const centerDeg = index * SLICE_DEG;
      const screenDeg = normalizeDeg(centerDeg + wheelAngle);
      const errorDeg = angularDistance(screenDeg, POINTER_DEG);
      const signedErrorDeg = angularSignedDistance(POINTER_DEG, screenDeg);

      if (errorDeg < best.errorDeg) {
        return { menuId, index, errorDeg, screenDeg, signedErrorDeg };
      }

      return best;
    },
    {
      menuId: room.menuCards[0],
      index: 0,
      errorDeg: Number.POSITIVE_INFINITY,
      screenDeg: POINTER_DEG,
      signedErrorDeg: 0,
    },
  );
};

export const getThrowImpactVisual = (room: RoomState, throwAt: number) => {
  const landed = getClosestMenuForThrow(room, throwAt);
  const clampedSigned = clamp(landed.signedErrorDeg, -10, 10);
  const clampedError = clamp(landed.errorDeg, 0, 18);

  return {
    menuId: landed.menuId,
    errorDeg: landed.errorDeg,
    xPx: Number((clampedSigned * 3.2).toFixed(2)),
    yPx: Number((92 + clampedError * 4.4).toFixed(2)),
    rotationDeg: Number((90 + clampedSigned * 0.9).toFixed(2)),
  };
};

const buildRankingEntry = (room: RoomState, uid: string, nickname: string, throwAt: number): ResultRankEntry => {
  const landed = getClosestMenuForThrow(room, throwAt);
  const menu = menuById.get(landed.menuId) ?? menuCards[0];

  return {
    uid,
    nickname,
    menuId: menu.id,
    menuName: menu.name,
    errorDeg: Number(landed.errorDeg.toFixed(2)),
    throwAt,
    rank: 0,
  };
};

export const calculateResult = (room: RoomState): ResultEntry | null => {
  const throws = Object.entries(room.throws ?? {});

  if (throws.length === 0) {
    if (!room.spinStartAt) {
      return null;
    }

    const fallbackThrowAt = room.spinStartAt + ROUND_DURATION_MS;
    const fallback = buildRankingEntry(room, "system", "자동 선택", fallbackThrowAt);

    return {
      menuId: fallback.menuId,
      menuName: fallback.menuName,
      winnerUid: fallback.uid,
      winnerNickname: fallback.nickname,
      errorDeg: fallback.errorDeg,
      rankings: [{ ...fallback, rank: 1 }],
    };
  }

  const rankings = throws
    .map(([uid, entry]) => buildRankingEntry(room, uid, entry.nickname, entry.throwAt))
    .sort((a, b) => a.errorDeg - b.errorDeg || a.throwAt - b.throwAt || a.nickname.localeCompare(b.nickname))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  const winner = rankings[0];

  return {
    menuId: winner.menuId,
    menuName: winner.menuName,
    winnerUid: winner.uid,
    winnerNickname: winner.nickname,
    errorDeg: winner.errorDeg,
    rankings,
  };
};
