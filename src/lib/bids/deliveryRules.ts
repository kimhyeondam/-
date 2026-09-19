// 납품요구 「품명」이 우리 제품(콘크리트 2차제품)인지 판단하는 규칙.
// 기본 규칙 + 화면에서 고친 목록(시스템 설정 settings.deliveryRules)을 함께 씁니다.

export interface DeliveryRules {
  includeExact: string[]; // 이 품명은 무조건 우리 품목 (예: "맨홀보조물")
  excludeExact: string[]; // 이 품명은 무조건 제외 (예: "아스팔트콘크리트")
  includeWords: string[]; // 품명에 이 말이 있으면 우리 품목
  excludeWords: string[]; // 품명에 이 말이 있으면 제외 (포함어보다 우선)
}

/** 기본 포함어: 콘크리트 2차제품(관·블록·경계·맨홀·암거·측구·수로 등) */
export const DEFAULT_INCLUDE_WORDS = [
  "콘크리트관", "원심력", "흄관", "콘크리트블록", "보도블록", "보차도", "인터로킹", "투수블록", "잔디블록", "식생블록", "호안블록", "어초", "사방",
  "경계블록", "콘크리트경계", "경계석", "맨홀", "암거", "측구", "수로관", "수로", "벤치플륨", "플륨", "집수정", "집수", "빗물받이", "우수받이", "옹벽",
  "프리캐스트", "PC", "콘크리트뚜껑", "콘크리트덮개", "콘크리트파일", "콘크리트말뚝", "콘크리트기초", "전주", "경계", "블록", "배수", "하수", "우수",
];
/** 기본 제외어: 이름은 비슷하지만 우리 제품이 아닌 것 (재료·다른 소재·엉뚱한 품목) */
export const DEFAULT_EXCLUDE_WORDS = [
  "아스팔트", "레미콘", "시멘트", "봉강", "이형봉강", "철근콘크리트용봉강", "철망", "와이어메쉬", "몰탈", "모르타르", "골재", "자연석", "석재", "화강", "현무암", "대리석", "석판", "판석", "고무", "플라스틱", "합성수지", "PE", "PVC", "FRP", "강관", "주철", "스테인리스", "알루미늄", "철제", "강재", "목재",
  "컴퓨터", "시스템", "패널", "칸막이", "페인트", "도료", "조명", "전기", "소프트웨어", "가구", "의자", "책상", "차량", "장비", "기계", "펌프", "밸브", "케이블",
];
export const EMPTY_RULES: DeliveryRules = { includeExact: [], excludeExact: [], includeWords: [], excludeWords: [] };

const norm = (s: string) => s.replace(/\s+/g, "").toUpperCase();

/** 품명(item)과 세부품명(detail)으로 우리 품목인지 판단 */
export function isOurItem(item: string, detail: string | undefined, rules: Partial<DeliveryRules> = {}): boolean {
  const name = norm(item); const full = norm(`${item} ${detail ?? ""}`);
  if (!name) return false;
  const r = { ...EMPTY_RULES, ...rules };
  if (r.excludeExact.some((x) => norm(x) === name)) return false;
  if (r.includeExact.some((x) => norm(x) === name)) return true;
  const excludeWords = [...DEFAULT_EXCLUDE_WORDS, ...r.excludeWords].map(norm).filter(Boolean);
  const includeWords = [...DEFAULT_INCLUDE_WORDS, ...r.includeWords].map(norm).filter(Boolean);
  if (excludeWords.some((w) => full.includes(w))) return false;
  return includeWords.some((w) => full.includes(w));
}
