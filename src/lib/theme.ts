// 화면 색: 시스템 설정에서 고른 대표 색(primary)으로 진한 색·연한 색을 만들어 CSS 변수로 넣습니다.
// DESIGN.md 에 있는 색만 고를 수 있습니다: ink(기본)·link·violet·cyan-deep·warning-deep·error-deep
export const themePresets: { name: string; color: string }[] = [
  { name: "먹색 (기본)", color: "#171717" }, { name: "파랑", color: "#0070f3" }, { name: "보라", color: "#7928ca" }, { name: "청록", color: "#29bc9b" },
  { name: "주황", color: "#ab570a" }, { name: "빨강", color: "#c50000" },
];
/** DESIGN.md 색마다 정해진 진한 색(눌렀을 때)·연한 색(배경) 짝 */
const DESIGN_PAIRS: Record<string, { dark: string; soft: string }> = {
  "#171717": { dark: "#4d4d4d", soft: "#f5f5f5" },
  "#0070f3": { dark: "#0761d1", soft: "#d3e5ff" },
  "#7928ca": { dark: "#4c2889", soft: "#d8ccf1" },
  "#29bc9b": { dark: "#29bc9b", soft: "#aaffec" },
  "#ab570a": { dark: "#ab570a", soft: "#ffefcf" },
  "#c50000": { dark: "#c50000", soft: "#f7d4d6" },
};

function hexToRgb(hex: string) { const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return null; const n = parseInt(m[1], 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;

/** 대표 색 하나로 진한 색(버튼 눌렀을 때)·연한 색(배경)을 만듭니다 */
export function themeVars(primary?: string) {
  const key = (primary ?? "").trim().toLowerCase();
  const pair = DESIGN_PAIRS[key] ?? (hexToRgb(key) ? undefined : DESIGN_PAIRS["#171717"]);
  if (pair) return { primary: key in DESIGN_PAIRS ? key : "#171717", ...pair };
  const rgb = hexToRgb(primary ?? "") ?? hexToRgb("#171717")!;
  const dark = toHex(rgb.r * 0.78, rgb.g * 0.78, rgb.b * 0.78);
  const soft = toHex(255 - (255 - rgb.r) * 0.14, 255 - (255 - rgb.g) * 0.14, 255 - (255 - rgb.b) * 0.14);
  return { primary: toHex(rgb.r, rgb.g, rgb.b), dark, soft };
}

export interface MenuPrefs { order?: string[]; hidden?: string[] }
