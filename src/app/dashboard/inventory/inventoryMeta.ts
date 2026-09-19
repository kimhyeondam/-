import type { StockMoveType } from "@/data/sample";

export const productUnits = ["본", "EA", "개", "㎡", "m", "세트", "톤", "식"];
export const productCategories = ["벤치플륨", "측구수로관", "원형사각수로관", "집수정", "PC원형맨홀", "PC사각맨홀", "전기통신 수공맨홀", "콘크리트 기초", "맨홀 부속자재", "흄관", "맨홀", "경계석", "보도블록", "암거", "기초", "기타"];

export const moveTypeMeta: Record<StockMoveType, { sign: 1 | -1; badge: string; hint: string }> = {
  기초재고: { sign: 1, badge: "bg-slate-100 text-slate-600", hint: "실사로 확인한 시작 수량" },
  생산입고: { sign: 1, badge: "bg-green-50 text-green-700", hint: "생산일보에서 자동 입고" },
  출하: { sign: -1, badge: "bg-primary-soft text-primary", hint: "매출(거래명세표)에서 자동 출하" },
  반품입고: { sign: 1, badge: "bg-sky-50 text-sky-700", hint: "거래처에서 되돌아온 제품" },
  불량폐기: { sign: -1, badge: "bg-red-50 text-red-700", hint: "파손·불량으로 폐기" },
  재고조정: { sign: 1, badge: "bg-amber-50 text-amber-700", hint: "실사 차이 보정 (+/-)" },
};

/** 직접 등록할 수 있는 종류 (생산입고·출하는 생산일보·매출에서 자동) */
export const manualMoveTypes: StockMoveType[] = ["반품입고", "불량폐기", "재고조정", "기초재고"];
