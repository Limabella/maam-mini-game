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
  "kmj-lm": "김치찌개",
  "dnj-lm": "된장찌개",
  "bbp-lm": "비빔밥",
  "sdf-lm": "순두부찌개",
  "jyk-lm": "제육볶음",
  "dks-lm": "돈까스",
  "gks-lm": "국수",
  "nmy-lm": "냉면",
  "sgs-lm": "삼겹살 구이",
  "dgb-lm": "닭갈비",
  "pho-lm": "쌀국수",
  "mlt-lm": "마라탕",
  "sdb-lm": "샐러드 보울",
  "sns-lm": "샌드위치 & 수프",
  "sro-lm": "초밥·롤",
  "udn-lm": "우동",
  "crr-lm": "카레라이스",
  "hbg-lm": "햄버거 세트",
  "dnb-lm": "덮밥",
  "bnt-lm": "도시락",
};

export const sushiRacers: SushiRacer[] = [
  {
    menuId: "kmj-lm",
    characterId: "racer-kimchi-flare",
    characterName: "김치 플레어",
    icon: "🔥",
    color: "#dc2626",
    accent: "#fecaca",
    style: "dash",
  },
  {
    menuId: "dnj-lm",
    characterId: "racer-doenjang-guard",
    characterName: "된장 가드",
    icon: "🛡️",
    color: "#166534",
    accent: "#bbf7d0",
    style: "bounce",
  },
  {
    menuId: "bbp-lm",
    characterId: "racer-bibim-sprinter",
    characterName: "비빔 스프린터",
    icon: "⚡",
    color: "#15803d",
    accent: "#bbf7d0",
    style: "dash",
  },
  {
    menuId: "sdf-lm",
    characterId: "racer-soft-tofu",
    characterName: "순두부 버블",
    icon: "💭",
    color: "#ea580c",
    accent: "#fed7aa",
    style: "slide",
  },
  {
    menuId: "jyk-lm",
    characterId: "racer-jeyuk-rocket",
    characterName: "제육 로켓",
    icon: "🚀",
    color: "#b91c1c",
    accent: "#fecaca",
    style: "dash",
  },
  {
    menuId: "dks-lm",
    characterId: "racer-tonkatsu-crunch",
    characterName: "돈까스 크런치",
    icon: "⭐",
    color: "#a16207",
    accent: "#fde68a",
    style: "jump",
  },
  {
    menuId: "gks-lm",
    characterId: "racer-noodle-loop",
    characterName: "국수 루프",
    icon: "🌀",
    color: "#4d7c0f",
    accent: "#d9f99d",
    style: "spin",
  },
  {
    menuId: "nmy-lm",
    characterId: "racer-cold-breeze",
    characterName: "냉면 브리즈",
    icon: "❄️",
    color: "#0284c7",
    accent: "#bae6fd",
    style: "slide",
  },
  {
    menuId: "sgs-lm",
    characterId: "racer-grill-king",
    characterName: "삼겹 그릴러",
    icon: "👑",
    color: "#57534e",
    accent: "#e7e5e4",
    style: "bounce",
  },
  {
    menuId: "dgb-lm",
    characterId: "racer-dakgalbi-iron",
    characterName: "닭갈비 아이언",
    icon: "💥",
    color: "#7f1d1d",
    accent: "#fecaca",
    style: "jump",
  },
  {
    menuId: "pho-lm",
    characterId: "racer-pho-wave",
    characterName: "쌀국수 웨이브",
    icon: "🌊",
    color: "#0f766e",
    accent: "#99f6e4",
    style: "slide",
  },
  {
    menuId: "mlt-lm",
    characterId: "racer-mala-spark",
    characterName: "마라 스파크",
    icon: "🌶️",
    color: "#991b1b",
    accent: "#fed7aa",
    style: "dash",
  },
  {
    menuId: "sdb-lm",
    characterId: "racer-salad-leaf",
    characterName: "샐러드 리프",
    icon: "🍃",
    color: "#65a30d",
    accent: "#d9f99d",
    style: "bounce",
  },
  {
    menuId: "sns-lm",
    characterId: "racer-sandwich-scout",
    characterName: "샌드 스카우트",
    icon: "🎯",
    color: "#3f6212",
    accent: "#fef08a",
    style: "jump",
  },
  {
    menuId: "sro-lm",
    characterId: "racer-sushi-ninja",
    characterName: "초밥 닌자",
    icon: "🍣",
    color: "#0f766e",
    accent: "#99f6e4",
    style: "spin",
  },
  {
    menuId: "udn-lm",
    characterId: "racer-udon-cloud",
    characterName: "우동 클라우드",
    icon: "☁️",
    color: "#0369a1",
    accent: "#bae6fd",
    style: "slide",
  },
  {
    menuId: "crr-lm",
    characterId: "racer-curry-comet",
    characterName: "카레 코멧",
    icon: "☄️",
    color: "#b45309",
    accent: "#fde68a",
    style: "dash",
  },
  {
    menuId: "hbg-lm",
    characterId: "racer-burger-bolt",
    characterName: "버거 볼트",
    icon: "🍔",
    color: "#ca8a04",
    accent: "#fde68a",
    style: "bounce",
  },
  {
    menuId: "dnb-lm",
    characterId: "racer-bowl-drift",
    characterName: "덮밥 드리프트",
    icon: "🏁",
    color: "#1d4ed8",
    accent: "#bfdbfe",
    style: "slide",
  },
  {
    menuId: "bnt-lm",
    characterId: "racer-bento-boxer",
    characterName: "도시락 복서",
    icon: "🥊",
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

export const getRacerForMenu = (menuId: string) =>
  sushiRacerByMenuId.get(menuId) ?? sushiRacers[0];
