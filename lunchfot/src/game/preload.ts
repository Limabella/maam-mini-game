import { menuCards } from "../data/menuCards";
import { getFoodImageUrl } from "../lib/menuAssets";

type IdleWindow = Window & { requestIdleCallback?: (callback: () => void) => number };

const preloadImage = (src: string) =>
  new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });

export const preloadUiImages = () => {
  const urls = new Set([
    "/background/sushi-vote-selection-bg-blur-kimono.png",
    "/background/sushi-restaurant-play-bg.png",
    "/other/maam-food-logo.png",
    "/other/lunchfot-icon-cutout.png",
    "/other/10dish_item.png",
    "/other/10dish_item_hit_01.png",
    "/other/10dish_item_hit_02.png",
    "/other/10dish_item_hit_03.png",
    "/top-spin/bibimbap-top-spin-cut-01.webp",
    "/top-spin/bibimbap-top-spin-cut-02.webp",
    "/top-spin/bibimbap-top-spin-cut-03.webp",
    "/top-spin/bibimbap-top-spin-cut-04.webp",
    ...menuCards.map(getFoodImageUrl),
  ]);

  const start = () => urls.forEach((url) => void preloadImage(url));
  const requestIdleCallback = (window as IdleWindow).requestIdleCallback;

  if (requestIdleCallback) {
    requestIdleCallback(start);
  } else {
    window.setTimeout(start, 80);
  }
};
