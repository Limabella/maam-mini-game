import { menuById } from "../data/menuCards";
import { getMenuDisplayName, getRacerForMenu } from "../data/sushiRacers";
import type { RaceResultRankEntry, ResultEntry, RoomState } from "../types";
import { createSeededRandom, FINALIST_COUNT, selectFinalists } from "./sushiRace";

export const TOP_SPIN_CUT_IN_MS = 6_000;
export const TOP_SPIN_PLAY_MS = 9_000;

export const getTopSpinFinalists = (room: RoomState) =>
  (room.finalists?.length ? room.finalists : selectFinalists(room)).slice(0, FINALIST_COUNT);

export const getTopSpinWinnerIndex = (room: RoomState) => {
  const finalists = getTopSpinFinalists(room);
  const random = createSeededRandom(room.seed ^ 0x7061656e);
  return Math.min(finalists.length - 1, Math.floor(random() * Math.max(1, finalists.length)));
};

export const calculateTopSpinResult = (room: RoomState): ResultEntry => {
  const finalists = getTopSpinFinalists(room);
  const winnerIndex = getTopSpinWinnerIndex(room);
  const orderedIds = finalists.map((_, offset) => finalists[(winnerIndex + offset) % finalists.length]);
  const raceRankings: RaceResultRankEntry[] = orderedIds.map((menuId, index) => {
    const menu = menuById.get(menuId);
    const racer = getRacerForMenu(menuId);

    return {
      rank: index + 1,
      menuId,
      menuName: getMenuDisplayName(menu),
      characterId: racer.characterId,
      characterName: racer.characterName,
      finishMs: TOP_SPIN_PLAY_MS + index * 250,
      penaltyMs: 0,
    };
  });
  const winner = raceRankings[0];

  return {
    menuId: winner.menuId,
    menuName: winner.menuName,
    winnerUid: "top-spin",
    winnerNickname: "Bibimbap Fot",
    errorDeg: 0,
    rankings: [],
    characterId: winner.characterId,
    characterName: winner.characterName,
    finishMs: TOP_SPIN_PLAY_MS,
    raceRankings,
  };
};
