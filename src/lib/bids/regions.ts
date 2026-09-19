// 관급 발주를 볼 지역 묶음. 회사마다 영업 지역이 달라 「지역 프로필」로 갈아 끼웁니다.
// 서버는 환경변수 BID_REGION (jb: 전북 (기본), gj: 광주·전남) 으로 정하고, 화면에는 서버가 알려 줍니다.

export interface RegionProfile {
  key: "gj" | "jb";
  label: string; // 화면에 쓰는 이름 (예: 광주·전남)
  hq: string[]; // 본청 묶음 이름들
  cities: string[];
  guns: string[];
  area: RegExp; // 이 글자가 있으면 우리 지역 기관
  otherAreas: RegExp; // 다른 시·도 (있으면 제외, 단 area 가 함께 있으면 유지)
  keepIfArea: RegExp; // otherAreas 에 걸려도 이 글자가 있으면 우리 지역으로 봄
  hqOf: (compact: string) => string; // 본청 묶음 고르기
  groups: { title: string; regions: string[] }[]; // 화면 지역 카드 묶음
}

const GJ_GUS = ["광주 동구", "광주 서구", "광주 남구", "광주 북구", "광산구"];
const GJ_CITIES = ["목포시", "여수시", "순천시", "나주시", "광양시"];
const GJ_GUNS = ["담양군", "곡성군", "구례군", "고흥군", "보성군", "화순군", "장흥군", "강진군", "해남군", "영암군", "무안군", "함평군", "영광군", "장성군", "완도군", "진도군", "신안군"];
export const HQ_GWANGJU = "통합시 광주청사";
export const HQ_JEONNAM = "통합시 전남청사";

const gj: RegionProfile = {
  key: "gj", label: "광주·전남",
  hq: [HQ_GWANGJU, HQ_JEONNAM],
  cities: [...GJ_GUS, ...GJ_CITIES], guns: GJ_GUNS,
  area: /광주|전남|전라남도|광주전남|통합특별시/,
  otherAreas: /경기도|경기광주|성남시|하남시|충청|경상|전북|전라북도|강원|제주|서울|부산|대구|인천|대전|울산|세종/,
  keepIfArea: /전남|전라남도|광주광역시|통합특별시/,
  hqOf: (c) => {
    if (/통합특별시/.test(c)) return /전남청사|무안청사|무안|도청/.test(c) ? HQ_JEONNAM : HQ_GWANGJU;
    if (/광주광역시|광주시청|광주광역시청/.test(c) && !/구청/.test(c)) return HQ_GWANGJU;
    if (/전라남도|전남도청|전남도/.test(c)) return HQ_JEONNAM;
    if (/광주/.test(c)) return HQ_GWANGJU;
    return "기타";
  },
  groups: [
    { title: "광주", regions: [HQ_GWANGJU, ...GJ_GUS] },
    { title: "전남 시", regions: [HQ_JEONNAM, ...GJ_CITIES] },
    { title: "전남 군", regions: GJ_GUNS },
    { title: "교육청·공사·공단·기타", regions: ["교육청", "공사·공단", "기타"] },
  ],
};

export const HQ_JEONBUK = "전북도청";
const JB_CITIES = ["전주시", "군산시", "익산시", "정읍시", "남원시", "김제시"];
const JB_GUNS = ["완주군", "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군"];
const jb: RegionProfile = {
  key: "jb", label: "전북",
  hq: [HQ_JEONBUK],
  cities: JB_CITIES, guns: JB_GUNS,
  area: /전북|전라북도|전북특별자치도/,
  otherAreas: /경기|충청|충남|충북|경상|경남|경북|전남|전라남도|광주|강원|제주|서울|부산|대구|인천|대전|울산|세종/,
  keepIfArea: /전북|전라북도|전북특별자치도/,
  hqOf: (c) => (/전북|전라북도/.test(c) ? HQ_JEONBUK : "기타"),
  groups: [
    { title: "전북 시", regions: [HQ_JEONBUK, ...JB_CITIES] },
    { title: "전북 군", regions: JB_GUNS },
    { title: "교육청·공사·공단·기타", regions: ["교육청", "공사·공단", "기타"] },
  ],
};

export const REGION_PROFILES: Record<string, RegionProfile> = { gj, jb };
export type RegionKey = keyof typeof REGION_PROFILES;

export function profileByKey(key?: string | null): RegionProfile { return REGION_PROFILES[key ?? ""] ?? jb; }
/** 서버에서: 환경변수 BID_REGION 으로 정한 프로필 (없으면 전북) */
export function serverProfile(): RegionProfile { return profileByKey(process.env.BID_REGION); }
/** 화면 지역 선택 순서 */
export function regionOrderOf(p: RegionProfile): string[] { return p.groups.flatMap((g) => g.regions); }
