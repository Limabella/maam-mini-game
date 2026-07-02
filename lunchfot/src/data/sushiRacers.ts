import type { MenuCard } from "../types";

export type SushiRacer = {
  menuId: string;
  characterId: string;
  characterName: string;
  icon: string;
  color: string;
  accent: string;
  style: "dash" | "jump" | "spin" | "slide" | "bounce";
};

export const MENU_DISPLAY_NAMES: Record<string, string> = {
  "kmj-lm": "Kimchi Stew",
  "dnj-lm": "Doenjang Stew",
  "bbp-lm": "Bibimbap",
  "sdf-lm": "Soft Tofu Stew",
  "jyk-lm": "Jeyuk Bokkeum",
  "dks-lm": "Donkatsu",
  "gks-lm": "Noodles",
  "nmy-lm": "Cold Noodles",
  "sgs-lm": "Grilled Pork Belly",
  "dgb-lm": "Dakgalbi",
  "pho-lm": "Pho",
  "mlt-lm": "Malatang",
  "sdb-lm": "Salad Bowl",
  "sns-lm": "Sandwich & Soup",
  "sro-lm": "Sushi Roll",
  "udn-lm": "Udon",
  "crr-lm": "Curry Rice",
  "hbg-lm": "Burger Set",
  "dnb-lm": "Rice Bowl",
  "bnt-lm": "Lunchbox",
};

export const sushiRacers: SushiRacer[] = [
  {
    menuId: "kmj-lm",
    characterId: "racer-kimchi-flare",
    characterName: "Kimchi Flare",
    icon: "🔥",
    color: "#dc2626",
    accent: "#fecaca",
    style: "dash",
  },
  {
    menuId: "dnj-lm",
    characterId: "racer-doenjang-guard",
    characterName: "Doenjang Guard",
    icon: "🛡️",
    color: "#166534",
    accent: "#bbf7d0",
    style: "bounce",
  },
  {
    menuId: "bbp-lm",
    characterId: "racer-bibim-sprinter",
    characterName: "Bibim Sprinter",
    icon: "⚡",
    color: "#15803d",
    accent: "#bbf7d0",
    style: "dash",
  },
  {
    menuId: "sdf-lm",
    characterId: "racer-soft-tofu",
    characterName: "Soft Tofu Bubble",
    icon: "☁️",
    color: "#ea580c",
    accent: "#fed7aa",
    style: "slide",
  },
  {
    menuId: "jyk-lm",
    characterId: "racer-jeyuk-rocket",
    characterName: "Jeyuk Rocket",
    icon: "🚀",
    color: "#b91c1c",
    accent: "#fecaca",
    style: "dash",
  },
  {
    menuId: "dks-lm",
    characterId: "racer-tonkatsu-crunch",
    characterName: "Donkatsu Crunch",
    icon: "💥",
    color: "#a16207",
    accent: "#fde68a",
    style: "jump",
  },
  {
    menuId: "gks-lm",
    characterId: "racer-noodle-loop",
    characterName: "Noodle Loop",
    icon: "🌀",
    color: "#4d7c0f",
    accent: "#d9f99d",
    style: "spin",
  },
  {
    menuId: "nmy-lm",
    characterId: "racer-cold-breeze",
    characterName: "Cold Breeze",
    icon: "❄️",
    color: "#0284c7",
    accent: "#bae6fd",
    style: "slide",
  },
  {
    menuId: "sgs-lm",
    characterId: "racer-grill-king",
    characterName: "Grill Runner",
    icon: "🥓",
    color: "#57534e",
    accent: "#e7e5e4",
    style: "bounce",
  },
  {
    menuId: "dgb-lm",
    characterId: "racer-dakgalbi-iron",
    characterName: "Dakgalbi Iron",
    icon: "🍗",
    color: "#7f1d1d",
    accent: "#fecaca",
    style: "jump",
  },
  {
    menuId: "pho-lm",
    characterId: "racer-pho-wave",
    characterName: "Pho Wave",
    icon: "🌊",
    color: "#0f766e",
    accent: "#99f6e4",
    style: "slide",
  },
  {
    menuId: "mlt-lm",
    characterId: "racer-mala-spark",
    characterName: "Mala Spark",
    icon: "🌶️",
    color: "#991b1b",
    accent: "#fed7aa",
    style: "dash",
  },
  {
    menuId: "sdb-lm",
    characterId: "racer-salad-leaf",
    characterName: "Salad Leaf",
    icon: "🥬",
    color: "#65a30d",
    accent: "#d9f99d",
    style: "bounce",
  },
  {
    menuId: "sns-lm",
    characterId: "racer-sandwich-scout",
    characterName: "Sandwich Scout",
    icon: "🥪",
    color: "#3f6212",
    accent: "#fef08a",
    style: "jump",
  },
  {
    menuId: "sro-lm",
    characterId: "racer-sushi-ninja",
    characterName: "Sushi Ninja",
    icon: "🍣",
    color: "#0f766e",
    accent: "#99f6e4",
    style: "spin",
  },
  {
    menuId: "udn-lm",
    characterId: "racer-udon-cloud",
    characterName: "Udon Cloud",
    icon: "🍥",
    color: "#0369a1",
    accent: "#bae6fd",
    style: "slide",
  },
  {
    menuId: "crr-lm",
    characterId: "racer-curry-comet",
    characterName: "Curry Comet",
    icon: "☄️",
    color: "#b45309",
    accent: "#fde68a",
    style: "dash",
  },
  {
    menuId: "hbg-lm",
    characterId: "racer-burger-bolt",
    characterName: "Burger Bolt",
    icon: "🍔",
    color: "#ca8a04",
    accent: "#fde68a",
    style: "bounce",
  },
  {
    menuId: "dnb-lm",
    characterId: "racer-bowl-drift",
    characterName: "Bowl Drift",
    icon: "🏁",
    color: "#1d4ed8",
    accent: "#bfdbfe",
    style: "slide",
  },
  {
    menuId: "bnt-lm",
    characterId: "racer-bento-boxer",
    characterName: "Lunchbox Boxer",
    icon: "🍱",
    color: "#15803d",
    accent: "#bbf7d0",
    style: "jump",
  },
];

export const sushiRacerByMenuId = new Map(sushiRacers.map((racer) => [racer.menuId, racer]));

export const getMenuDisplayName = (menu: MenuCard | undefined) => {
  if (!menu) {
    return "";
  }

  return MENU_DISPLAY_NAMES[menu.id] ?? menu.name;
};

export const getRacerForMenu = (menuId: string) => sushiRacerByMenuId.get(menuId) ?? sushiRacers[0];
