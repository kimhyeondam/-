// 관급 입찰공고 자료 모양. 나라장터(조달청) 공공데이터를 우리 회사 기준으로 정리한 것입니다.

export type BidKind = "공사" | "물품" | "용역";
export type BidMethod = "일반경쟁" | "제한경쟁" | "지명경쟁" | "수의계약" | "기타";

export interface BidNotice {
  id: string; // 공고번호-차수
  kind: BidKind; // 공사/물품/용역
  no: string; // 공고번호
  ord: string; // 차수
  title: string; // 공고명
  agency: string; // 공고기관 (공고를 낸 곳)
  demand: string; // 수요기관 (실제로 쓰는 곳)
  region: string; // 우리 기준 지역 묶음 (예: "나주시", "전남도청", "광주 북구", "교육청", "공사·공단")
  noticeAt: string; // 공고일시 YYYY-MM-DD HH:mm
  closeAt?: string; // 입찰마감일시
  openAt?: string; // 개찰일시
  budget?: number; // 배정예산 (원)
  estimate?: number; // 추정가격 (원)
  method: BidMethod; // 계약방법 묶음 (일반경쟁/제한경쟁/지명경쟁/수의계약)
  methodRaw?: string; // 원문 계약방법 (예: "제한경쟁", "수의(총액)")
  bidMethod?: string; // 입찰방식 원문 (전자입찰/직찰 등)
  award?: string; // 낙찰방법 원문 (적격심사/최저가 등)
  noticeKind?: string; // 공고종류 (일반/변경/취소/재공고 등)
  regionLimit?: string; // 참가제한 지역
  site?: string; // 공사현장 지역 (공사 공고)
  planNo?: string; // 발주계획 통합번호 (발주계획과 연결)
  contact?: string; // 공고기관 담당자 이름
  contactPhone?: string;
  contactEmail?: string;
  url?: string; // 나라장터 상세 링크
  related: boolean; // 우리 제품(콘크리트 제품)과 관련 있어 보이는 공고
  keywords: string[]; // 걸린 제품 키워드
}

export interface BidsFile {
  items: BidNotice[];
  fetchedAt?: string; // 마지막으로 나라장터에서 가져온 시각
  fetchedFrom?: string; // 가져온 기간 시작
  fetchedTo?: string; // 가져온 기간 끝
  error?: string; // 마지막 가져오기 실패 이유
  source?: "api" | "sample";
}

/** 우리 제품 관련 키워드 (공고명에 이 말이 들어가면 「우리 제품 관련」으로 표시) */
export const productKeywords = [
  "콘크리트", "흄관", "맨홀", "경계석", "경계블록", "보도블록", "인터로킹", "투수블록", "벤치플륨", "플륨관", "수로관", "암거", "박스", "옹벽", "우수관", "오수관", "하수관", "배수관", "측구", "U형", "L형", "집수정", "PC", "블록", "관로", "하수도", "우수", "배수로", "농로", "용배수로", "수로", "포장", "보도", "도로", "하천", "정비", "개설", "확포장", "배수", "관거",
];
