import type { MenuCard } from "../types";

const svgDataUri = (name: string, icon: string, accent: string, paper: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180">
      <rect width="240" height="180" rx="28" fill="${paper}"/>
      <circle cx="194" cy="42" r="36" fill="${accent}" opacity=".25"/>
      <circle cx="44" cy="142" r="48" fill="${accent}" opacity=".18"/>
      <text x="120" y="84" text-anchor="middle" font-size="56" font-family="Apple Color Emoji, Segoe UI Emoji">${icon}</text>
      <text x="120" y="132" text-anchor="middle" font-size="24" font-weight="800" fill="#1f2937" font-family="Pretendard, Inter, sans-serif">${name}</text>
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
  imageUrl: `/menu/${fileName}`,
  fallbackImageUrl: svgDataUri(name, icon, accent, paper),
  tags,
  stats,
});

export const menuCards: MenuCard[] = [
  makeMenu("kmj-lm", "001_kmj.png", "김치찌개", "🍲", "#dc2626", "#fff1f2", ["국물", "든든"], {
    taste: 5,
    speed: 3,
    balance: 4,
    budget: 4,
    mood: 4,
  }),
  makeMenu("dnj-lm", "002_dnj.png", "된장찌개", "🥘", "#166534", "#f6fff7", ["구수함", "안정"], {
    taste: 5,
    speed: 3,
    balance: 5,
    budget: 5,
    mood: 3,
  }),
  makeMenu("bbp-lm", "003_bbp.png", "비빔밥", "🥗", "#15803d", "#f0fdf4", ["균형", "한식"], {
    taste: 5,
    speed: 4,
    balance: 5,
    budget: 4,
    mood: 4,
  }),
  makeMenu("sdf-lm", "004_sdf.png", "순두부찌개", "🔥", "#ea580c", "#fff7ed", ["얼큰", "부드러움"], {
    taste: 5,
    speed: 3,
    balance: 4,
    budget: 4,
    mood: 4,
  }),
  makeMenu("jyk-lm", "005_jyk.png", "제육볶음", "🥩", "#b91c1c", "#fff1f2", ["매콤", "활력"], {
    taste: 5,
    speed: 4,
    balance: 3,
    budget: 4,
    mood: 5,
  }),
  makeMenu("dks-lm", "006_dks.png", "돈까스", "🍛", "#a16207", "#fffbeb", ["바삭", "포만감"], {
    taste: 5,
    speed: 4,
    balance: 3,
    budget: 3,
    mood: 4,
  }),
  makeMenu("gks-lm", "007_gks.png", "국수", "🍜", "#4d7c0f", "#f7fee7", ["가벼움", "빠름"], {
    taste: 4,
    speed: 5,
    balance: 4,
    budget: 5,
    mood: 3,
  }),
  makeMenu("nmy-lm", "008_nmy.png", "냉면", "🧊", "#0284c7", "#eff6ff", ["시원함", "리프레시"], {
    taste: 4,
    speed: 4,
    balance: 4,
    budget: 3,
    mood: 5,
  }),
  makeMenu("sgs-lm", "009_sgs.png", "삼겹살 구이", "🔥", "#57534e", "#fafaf9", ["고기", "공유"], {
    taste: 5,
    speed: 2,
    balance: 3,
    budget: 2,
    mood: 5,
  }),
  makeMenu("dgb-lm", "010_dgb.png", "닭갈비", "🍗", "#7f1d1d", "#fff1f2", ["매콤", "철판"], {
    taste: 5,
    speed: 3,
    balance: 4,
    budget: 3,
    mood: 5,
  }),
  makeMenu("pho-lm", "011_pho.png", "쌀국수", "🍜", "#0f766e", "#f0fdfa", ["산뜻", "회복"], {
    taste: 4,
    speed: 4,
    balance: 4,
    budget: 3,
    mood: 3,
  }),
  makeMenu("mlt-lm", "012_mlt.png", "마라탕", "🌶️", "#991b1b", "#fff7ed", ["자극", "취향"], {
    taste: 5,
    speed: 2,
    balance: 3,
    budget: 2,
    mood: 5,
  }),
  makeMenu("sdb-lm", "013_sdb.png", "샐러드 보울", "🥬", "#65a30d", "#f7fee7", ["신선", "건강"], {
    taste: 4,
    speed: 5,
    balance: 5,
    budget: 2,
    mood: 3,
  }),
  makeMenu("sns-lm", "014_sns.png", "샌드위치 수프", "🥪", "#3f6212", "#fefce8", ["간편", "데스크"], {
    taste: 4,
    speed: 5,
    balance: 4,
    budget: 3,
    mood: 3,
  }),
  makeMenu("sro-lm", "015_sro.png", "초밥 롤", "🍣", "#0f766e", "#f0fdfa", ["깔끔", "가벼움"], {
    taste: 5,
    speed: 4,
    balance: 4,
    budget: 2,
    mood: 4,
  }),
  makeMenu("udn-lm", "016_udn.png", "우동", "🍥", "#0369a1", "#f8fafc", ["따뜻함", "편안함"], {
    taste: 4,
    speed: 4,
    balance: 4,
    budget: 4,
    mood: 3,
  }),
  makeMenu("crr-lm", "017_crr.png", "카레라이스", "🍛", "#b45309", "#fffbeb", ["든든", "간편"], {
    taste: 4,
    speed: 4,
    balance: 4,
    budget: 4,
    mood: 3,
  }),
  makeMenu("hbg-lm", "018_hbg.png", "햄버거 세트", "🍔", "#ca8a04", "#fffbeb", ["패스트", "포만감"], {
    taste: 4,
    speed: 5,
    balance: 2,
    budget: 3,
    mood: 4,
  }),
  makeMenu("dnb-lm", "019_dnb.png", "덮밥", "🍚", "#1d4ed8", "#eff6ff", ["가성비", "든든"], {
    taste: 4,
    speed: 5,
    balance: 4,
    budget: 5,
    mood: 3,
  }),
  makeMenu("bnt-lm", "020_bnt.png", "도시락", "🍱", "#15803d", "#f0fdf4", ["균형", "알찬"], {
    taste: 5,
    speed: 4,
    balance: 5,
    budget: 5,
    mood: 3,
  }),
];

export const menuById = new Map(menuCards.map((menu) => [menu.id, menu]));
