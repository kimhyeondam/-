// 재고 계산 규칙. 재고는 따로 저장하지 않고 입출고(StockMove)의 합으로 구합니다.
import type { Material, MaterialMove, Product, ProductionReport, Purchase, Revenue, StockMove } from "@/data/sample";
import { newId, nowIso } from "@/lib/ids";

/** 품명·규격 비교용: 공백/괄호/대소문자 무시 */
export const normKey = (s?: string) => (s ?? "").toLowerCase().replace(/[\s()（）\-_,.*×x]/g, "");

/** 품명(+규격)으로 품목 찾기. 규격까지 같은 것을 우선, 없으면 품명만 같은 것 */
export function matchProduct(products: Product[], name: string, spec?: string): Product | undefined {
  const n = normKey(name);
  if (!n) return undefined;
  const sp = normKey(spec);
  const exact = products.find((p) => normKey(p.name) === n && normKey(p.spec) === sp);
  if (exact) return exact;
  // 별칭(공장 호칭): "원형1호 상부 600H" 처럼 품명+규격을 붙여 적은 것도 맞춰 봅니다
  const joined = n + sp;
  const byAlias = products.find((p) => (p.aliases ?? []).some((a) => { const k = normKey(a); return k === n || k === joined || (sp && k === n + "/" + sp); }));
  if (byAlias) return byAlias;
  const byName = products.filter((p) => normKey(p.name) === n);
  if (byName.length === 1) return byName[0];
  // "흄관 D600 L=2,500" 처럼 품명에 규격이 붙어 있는 경우
  return products.find((p) => n.includes(normKey(p.name)) && (!p.spec || n.includes(normKey(p.spec)) || !sp));
}

/** 품목별 현재고 */
export function stockByProduct(moves: StockMove[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const mv of moves) m.set(mv.productId, (m.get(mv.productId) ?? 0) + mv.qty);
  return m;
}

/** 특정 문서(ref)에 딸린 입출고를 새것으로 바꿔 넣기 (수정·삭제 시 사용) */
export function replaceMovesByRef(moves: StockMove[], ref: string, next: StockMove[]): StockMove[] {
  return [...next, ...moves.filter((m) => m.ref !== ref)];
}

/** 생산일보 → 생산입고 (양품 수량) */
export function movesForProduction(report: ProductionReport, by?: string): StockMove[] {
  const label = `생산일보 ${report.date.slice(5).replace("-", "/")}`;
  return report.items
    .filter((it) => it.productId && it.produced > 0)
    .map((it) => ({ id: newId("sm"), date: report.date, productId: it.productId!, type: "생산입고" as const, qty: it.produced, ref: report.id, refLabel: label, createdBy: by, createdAt: nowIso() }));
}

/** 매출(거래명세표) → 출하. 품목에 없는 품명은 건너뜁니다 */
export function movesForRevenue(rev: Revenue, products: Product[], by?: string): { moves: StockMove[]; unmatched: string[] } {
  const moves: StockMove[] = [];
  const unmatched: string[] = [];
  for (const it of rev.items ?? []) {
    if (!(it.qty > 0)) continue;
    const p = matchProduct(products, it.name, it.spec);
    if (!p) { unmatched.push(it.name); continue; }
    moves.push({ id: newId("sm"), date: rev.date || nowIso().slice(0, 10), productId: p.id, type: "출하", qty: -it.qty, ref: rev.id, refLabel: rev.docNumber ? `거래명세표 ${rev.docNumber}` : rev.title, memo: rev.customer, createdBy: by, createdAt: nowIso() });
  }
  return { moves, unmatched };
}

/** 안전재고 이하 품목 (안전재고를 0으로 둔 품목은 "정하지 않음"으로 보고 경고하지 않습니다) */
export function lowStock(products: Product[], moves: StockMove[]) {
  const stock = stockByProduct(moves);
  return products
    .map((p) => ({ product: p, qty: stock.get(p.id) ?? 0 }))
    .filter(({ product, qty }) => (product.safetyStock ?? 0) > 0 && qty <= product.safetyStock!);
}

/* ───────── 원자재 ───────── */

export function materialStock(moves: MaterialMove[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const mv of moves) m.set(mv.materialId, Math.round(((m.get(mv.materialId) ?? 0) + mv.qty) * 1000) / 1000);
  return m;
}

export function replaceMaterialMovesByRef(moves: MaterialMove[], ref: string, next: MaterialMove[]): MaterialMove[] {
  return [...next, ...moves.filter((m) => m.ref !== ref)];
}

/** 매입 품목명으로 원자재 찾기 (예: "시멘트 1종" → 시멘트, "모래" → 골재(모래)) */
export function matchMaterial(materials: Material[], name: string): Material | undefined {
  const n = normKey(name);
  if (!n) return undefined;
  return (
    materials.find((m) => normKey(m.name) === n) ??
    materials.find((m) => n.includes(normKey(m.name)) || normKey(m.name).includes(n)) ??
    materials.find((m) => m.name.split(/[()\s/]/).filter(Boolean).some((part) => part.length >= 2 && n.includes(normKey(part))))
  );
}

/** 단위 맞추기: 시멘트 포(40kg)·kg 로 산 것을 ton 자재에 넣을 때 등 */
export function convertQty(qty: number, from: string | undefined, to: string): number {
  const f = (from ?? "").toLowerCase().replace(/\s/g, "");
  const t = to.toLowerCase();
  if (!f || f === t) return qty;
  const table: Record<string, number> = { "포>ton": 0.04, "포>kg": 40, "kg>ton": 0.001, "ton>kg": 1000, "톤>ton": 1, "t>ton": 1, "루베>㎥": 1, "m3>㎥": 1, "㎥>루베": 1, "ea>ea": 1, "개>ea": 1, "본>ea": 1 };
  const k = `${f}>${t}`;
  return table[k] !== undefined ? Math.round(qty * table[k] * 1000) / 1000 : qty;
}

/** 매입 → 매입입고 (원자재 이름이 맞는 줄만). 품목이 여러 줄이면 줄마다, 아니면 매입 한 건을 한 줄로 봅니다 */
export function movesForPurchase(purchase: Purchase, materials: Material[], by?: string): MaterialMove[] {
  const lines = purchase.items?.length ? purchase.items.map((i) => ({ name: `${i.name} ${i.spec ?? ""}`, qty: i.qty, unit: i.unit })) : [{ name: `${purchase.item} ${purchase.spec ?? ""}`, qty: purchase.qty ?? 0, unit: purchase.unit }];
  const out: MaterialMove[] = [];
  for (const l of lines) {
    if (!l.qty || l.qty <= 0) continue;
    const mat = matchMaterial(materials, l.name);
    if (!mat) continue;
    const qty = convertQty(l.qty, l.unit, mat.unit);
    out.push({ id: newId("mm"), date: purchase.date, materialId: mat.id, type: "매입입고", qty, ref: purchase.id, refLabel: `매입 ${purchase.supplier}`, memo: `${l.name.trim()}${l.unit && l.unit !== mat.unit ? ` (${l.qty}${l.unit} → ${qty}${mat.unit})` : ""}`, createdBy: by, createdAt: nowIso() });
  }
  return out;
}

/** 생산일보 → 배합대로 원자재 사용 (생산 + 불량 수량 모두 자재를 씁니다) */
export function materialMovesForProduction(report: ProductionReport, products: Product[], by?: string): MaterialMove[] {
  const used = new Map<string, number>();
  for (const it of report.items) {
    const p = products.find((x) => x.id === it.productId);
    if (!p?.recipe) continue;
    const count = (it.produced || 0) + (it.defect || 0);
    for (const r of p.recipe) used.set(r.materialId, (used.get(r.materialId) ?? 0) + r.qty * count);
  }
  const label = `생산일보 ${report.date.slice(5).replace("-", "/")}`;
  return [...used.entries()]
    .filter(([, q]) => q > 0)
    .map(([materialId, q]) => ({ id: newId("mm"), date: report.date, materialId, type: "생산사용" as const, qty: -Math.round(q * 1000) / 1000, ref: report.id, refLabel: label, createdBy: by, createdAt: nowIso() }));
}
