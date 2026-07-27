import type { MenuCard } from "../types";

export const getAssetStem = (menu: MenuCard) => {
  const match = menu.imageUrl.match(/\/([^/]+)\.png$/);
  return match?.[1] ?? menu.id.replace("-lm", "");
};

export const getFoodImageUrl = (menu: MenuCard) => `/food/food_${getAssetStem(menu)}.png`;

export const getRunnerImageUrl = (menu: MenuCard) => `/hero/runner_${getAssetStem(menu)}.png`;

export const getResultCardImageUrl = (menu: MenuCard) => `/card/lf-card/${getAssetStem(menu)}_lf.png`;
