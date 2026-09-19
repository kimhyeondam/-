// 공고를 우리 기준(지역 묶음·계약방법·우리 제품 관련)으로 분류합니다.
import { guessRegion } from "@/lib/projects/region";
import { productKeywords, type BidMethod } from "./types";

import { profileByKey, regionOrderOf, serverProfile, HQ_GWANGJU, HQ_JEONNAM, type RegionProfile } from "./regions";
export { HQ_GWANGJU, HQ_JEONNAM };

// 예전 코드 호환용 (광주·전남 프로필 기준). 새 코드는 프로필을 받아 씁니다
const gj = profileByKey("gj");
export const gwangjuGus = gj.cities.slice(0, 5);
export const jeonnamCities = gj.cities.slice(5);
export const jeonnamGuns = gj.guns;
export const regionOrder = regionOrderOf(gj);

/**
 * 수요기관·공고기관 이름으로 우리 지역인지 판단하고 지역 묶음을 정합니다. 우리 지역이 아니면 undefined.
 * profile 을 주지 않으면 서버 환경변수(BID_REGION)의 지역을 씁니다.
 */
export function regionOf(demand: string, agency: string, regionLimit?: string, site?: string, profile: RegionProfile = serverProfile()): string | undefined {
  const text = `${demand} ${agency}`;
  const compact = text.replace(/\s+/g, "");
  const local = [...profile.cities, ...profile.guns];
  const localSet = new Set(local);
  // 교육청·공사·공단은 현장 지역과 상관없이 따로 묶습니다
  if (profile.area.test(compact) && /교육청|교육지원청|학교|대학교/.test(compact)) return "교육청";
  // 공사현장 지역이 있으면 그것을 먼저 봅니다 (예: 도청 발주라도 현장이 나주면 나주시로)
  if (site) {
    const sc = site.replace(/\s+/g, "");
    if (profile.area.test(sc)) { const r = guessRegion(site); if (r && localSet.has(r)) return r; }
  }
  // 다른 시·도의 기관은 제외
  if (profile.otherAreas.test(compact) && !profile.keepIfArea.test(compact)) return undefined;
  // "영암지사", "나주지점"처럼 시·군 글자 없이 지명만 있는 경우도 잡습니다 (시·군 이름은 두 글자 이상이라 오인이 적음)
  const bases = local.filter((r) => !r.includes(" ")).map((r) => r.replace(/(시|군|구)$/, "")).filter((b) => b.length >= 2);
  const inArea = profile.area.test(compact) || local.some((r) => compact.includes(r.replace(/\s+/g, "")) || compact.includes(r.replace(/^광주\s/, ""))) || bases.some((b) => compact.includes(b));
  // 광주 동구·서구·남구·북구는 다른 광역시에도 있어 "광주" 글자가 있을 때만
  const guOnly = profile.key === "gj" && /(동구|서구|남구|북구)/.test(compact) && !/광주/.test(compact);
  if (!inArea || (guOnly && !/광산구|전남/.test(compact))) {
    // 참가제한 지역이 우리 지역이면 우리 지역 공고로 봅니다
    if (regionLimit && profile.area.test(regionLimit)) return "기타";
    return undefined;
  }
  if (/교육청|교육지원청|학교|대학교/.test(compact)) return "교육청";
  if (/공사|공단|공기업|도시공사|개발공사|환경공단|시설공단|관리공단|한국전력|농어촌공사|수자원|도로공사|철도|LH|주택공사/.test(compact)) return "공사·공단";
  const r = guessRegion(demand) ?? guessRegion(agency);
  if (r && localSet.has(r)) return r;
  const b = bases.find((x) => compact.includes(x));
  if (b) return local.find((x) => x.startsWith(b))!;
  return profile.hqOf(compact);
}

/** 계약방법 원문을 4가지 묶음으로 */
export function methodOf(raw?: string): BidMethod {
  const t = (raw ?? "").replace(/\s+/g, "");
  if (!t) return "기타";
  if (/수의/.test(t)) return "수의계약";
  if (/지명/.test(t)) return "지명경쟁";
  if (/제한/.test(t)) return "제한경쟁";
  if (/일반|경쟁/.test(t)) return "일반경쟁";
  return "기타";
}

/** 공고명에서 우리 제품 관련 키워드 찾기 */
export function keywordsOf(title: string): string[] {
  const t = title.replace(/\s+/g, "");
  return productKeywords.filter((k) => t.toUpperCase().includes(k.toUpperCase()));
}

const strongKeywords = new Set(["콘크리트", "흄관", "맨홀", "경계석", "경계블록", "보도블록", "인터로킹", "투수블록", "벤치플륨", "플륨관", "수로관", "암거", "옹벽", "우수관", "오수관", "하수관", "배수관", "측구", "U형", "L형", "집수정", "관로", "하수도", "배수로", "용배수로", "수로", "관거", "블록"]);
/** 이런 말이 있으면 우리 제품과 관계없는 공고 (폐기물 처리, 조사·탐사·평가·감리 등) */
const excludeWords = /폐콘크리트|폐기물|처리용역|탐사|측량|조사|타당성|평가|감리|점검|진단|청소|준설|제설|임차|임대|용지|보상|전산|소프트웨어|홍보|행사|급식|차량|장비|위탁|운영/;
/**
 * 강한 키워드가 하나라도 있거나 약한 키워드가 2개 이상이면 관련 공고.
 * 용역은 설계용역만 관련으로 봅니다(1년 뒤 자재 발주 신호). 제외어가 있으면 관련 아님.
 */
export function isRelated(keywords: string[], title = "", kind?: string): boolean {
  const t = title.replace(/\s+/g, "");
  if (t && excludeWords.test(t)) return false;
  if (kind === "용역" && !/설계/.test(t)) return false;
  if (keywords.some((k) => strongKeywords.has(k))) return true;
  return keywords.length >= 2;
}
