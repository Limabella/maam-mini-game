import type { MenuCard } from "../types";

const svgDataUri = (name: string, icon: string, accent: string, paper: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180">
      <rect width="240" height="180" rx="28" fill="${paper}"/>
      <circle cx="194" cy="42" r="36" fill="${accent}" opacity=".25"/>
      <circle cx="44" cy="142" r="48" fill="${accent}" opacity=".18"/>
      <text x="120" y="84" text-anchor="middle" font-size="56" font-family="Apple Color Emoji, Segoe UI Emoji">${icon}</text>
      <text x="120" y="132" text-anchor="middle" font-size="24" font-weight="800" fill="#1f2937" font-family="Inter, sans-serif">${name}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const makeMenu = (
  id: string,
  fileName: string,
  name: string,
  icon: string,
  accent: string,
  paper: string,
  tags: string[],
  stats: MenuCard["stats"],
): MenuCard => ({
  id,
  name,
  imageUrl: `/card/${fileName}`,
  fallbackImageUrl: svgDataUri(name, icon, accent, paper),
  tags,
  stats,
});

export const menuCards: MenuCard[] = [
  makeMenu("kmj-lm", "001_kmj.png", "Kimchi Stew", "🍲", "#dc2626", "#fff1f2", ["soup", "hearty"], {
    taste: 5,
    speed: 3,
    balance: 4,
    budget: 4,
    mood: 4,
  }),
  makeMenu("dnj-lm", "002_dnj.png", "Doenjang Stew", "🥘", "#166534", "#f6fff7", ["savory", "comfort"], {
    taste: 5,
    speed: 3,
    balance: 5,
    budget: 5,
    mood: 3,
  }),
  makeMenu("bbp-lm", "003_bbp.png", "Bibimbap", "🥗", "#15803d", "#f0fdf4", ["balanced", "Korean"], {
    taste: 5,
    speed: 4,
    balance: 5,
    budget: 4,
    mood: 4,
  }),
  makeMenu("sdf-lm", "004_sdf.png", "Soft Tofu Stew", "🔥", "#ea580c", "#fff7ed", ["spicy", "soft"], {
    taste: 5,
    speed: 3,
    balance: 4,
    budget: 4,
    mood: 4,
  }),
  makeMenu("jyk-lm", "005_jyk.png", "Jeyuk Bokkeum", "🥩", "#b91c1c", "#fff1f2", ["spicy", "energy"], {
    taste: 5,
    speed: 4,
    balance: 3,
    budget: 4,
    mood: 5,
  }),
  makeMenu("dks-lm", "006_dks.png", "Donkatsu", "🍛", "#a16207", "#fffbeb", ["crispy", "filling"], {
    taste: 5,
    speed: 4,
    balance: 3,
    budget: 3,
    mood: 4,
  }),
  makeMenu("gks-lm", "007_gks.png", "Noodles", "🍜", "#4d7c0f", "#f7fee7", ["light", "quick"], {
    taste: 4,
    speed: 5,
    balance: 4,
    budget: 5,
    mood: 3,
  }),
  makeMenu("nmy-lm", "008_nmy.png", "Cold Noodles", "🧊", "#0284c7", "#eff6ff", ["cool", "refresh"], {
    taste: 4,
    speed: 4,
    balance: 4,
    budget: 3,
    mood: 5,
  }),
  makeMenu("sgs-lm", "009_sgs.png", "Grilled Pork Belly", "🔥", "#57534e", "#fafaf9", ["meat", "shared"], {
    taste: 5,
    speed: 2,
    balance: 3,
    budget: 2,
    mood: 5,
  }),
  makeMenu("dgb-lm", "010_dgb.png", "Dakgalbi", "🍗", "#7f1d1d", "#fff1f2", ["spicy", "griddle"], {
    taste: 5,
    speed: 3,
    balance: 4,
    budget: 3,
    mood: 5,
  }),
  makeMenu("pho-lm", "011_pho.png", "Pho", "🍜", "#0f766e", "#f0fdfa", ["fresh", "recovery"], {
    taste: 4,
    speed: 4,
    balance: 4,
    budget: 3,
    mood: 3,
  }),
  makeMenu("mlt-lm", "012_mlt.png", "Malatang", "🌶️", "#991b1b", "#fff7ed", ["bold", "custom"], {
    taste: 5,
    speed: 2,
    balance: 3,
    budget: 2,
    mood: 5,
  }),
  makeMenu("sdb-lm", "013_sdb.png", "Salad Bowl", "🥬", "#65a30d", "#f7fee7", ["fresh", "healthy"], {
    taste: 4,
    speed: 5,
    balance: 5,
    budget: 2,
    mood: 3,
  }),
  makeMenu("sns-lm", "014_sns.png", "Sandwich & Soup", "🥪", "#3f6212", "#fefce8", ["simple", "desk"], {
    taste: 4,
    speed: 5,
    balance: 4,
    budget: 3,
    mood: 3,
  }),
  makeMenu("sro-lm", "015_sro.png", "Sushi Roll", "🍣", "#0f766e", "#f0fdfa", ["clean", "light"], {
    taste: 5,
    speed: 4,
    balance: 4,
    budget: 2,
    mood: 4,
  }),
  makeMenu("udn-lm", "016_udn.png", "Udon", "🍥", "#0369a1", "#f8fafc", ["warm", "calm"], {
    taste: 4,
    speed: 4,
    balance: 4,
    budget: 4,
    mood: 3,
  }),
  makeMenu("crr-lm", "017_crr.png", "Curry Rice", "🍛", "#b45309", "#fffbeb", ["hearty", "easy"], {
    taste: 4,
    speed: 4,
    balance: 4,
    budget: 4,
    mood: 3,
  }),
  makeMenu("hbg-lm", "018_hbg.png", "Burger Set", "🍔", "#ca8a04", "#fffbeb", ["fast", "filling"], {
    taste: 4,
    speed: 5,
    balance: 2,
    budget: 3,
    mood: 4,
  }),
  makeMenu("dnb-lm", "019_dnb.png", "Rice Bowl", "🍚", "#1d4ed8", "#eff6ff", ["value", "hearty"], {
    taste: 4,
    speed: 5,
    balance: 4,
    budget: 5,
    mood: 3,
  }),
  makeMenu("bnt-lm", "020_bnt.png", "Lunchbox", "🍱", "#15803d", "#f0fdf4", ["balanced", "packed"], {
    taste: 5,
    speed: 4,
    balance: 5,
    budget: 5,
    mood: 3,
  }),
];

export const menuById = new Map(menuCards.map((menu) => [menu.id, menu]));
