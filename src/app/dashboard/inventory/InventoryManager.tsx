"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import Tabs from "@/components/Tabs";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { products as initialProducts, stockMoves as initialMoves, type Product, type StockMove } from "@/data/sample";
import { newId, nowIso } from "@/lib/ids";
import { todayIso } from "@/lib/format";
import { stockByProduct } from "@/lib/inventory/stock";
import { moveTypeMeta, productCategories } from "./inventoryMeta";
import { catalogProducts, catalogCategories } from "@/data/catalog";
import PasteImport from "./PasteImport";
import ProductForm, { type ProductInput } from "./ProductForm";
import MoveForm, { type MoveInput } from "./MoveForm";

export default function InventoryManager({ initialTab = "stock", openId }: { initialTab?: "stock" | "moves"; openId?: string } = {}) {
  const [items, setItems, loaded, loadError] = useServerState<Product[]>("products", initialProducts);
  const [moves, setMoves, movesLoaded] = useServerState<StockMove[]>("stockMoves", initialMoves);
  const [today] = useState(todayIso);
  const [tab, setTab] = useState<"stock" | "moves">(initialTab);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [onlyFav, setOnlyFav] = useState(false);
  const [onlyLow, setOnlyLow] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [moving, setMoving] = useState<Product | null | "any">(null);
  const [pasting, setPasting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  function flash(msg: string) { setNotice(msg); setTimeout(() => setNotice(null), 8000); }
  const catalogMissing = catalogProducts.filter((c) => !items.some((p) => p.id === c.id || (p.name === c.name && (p.spec ?? "") === (c.spec ?? "")))).length;
  // 예전 카탈로그 목록에서 빠진 품목(id가 cat_ 로 시작하지만 지금 카탈로그에 없음) 중 입출고 기록이 없는 것은 정리 대상
  const catalogStale = items.filter((p) => p.id.startsWith("cat_") && !catalogProducts.some((c) => c.id === p.id) && !moves.some((m) => m.productId === p.id));
  // 카탈로그가 고쳐져 메모(조달번호·중량)·분류·별칭이 달라진 품목
  const catalogOutdated = items.filter((p) => { const c = catalogProducts.find((x) => x.id === p.id); return !!c && ((c.memo ?? "") !== (p.memo ?? "") || (c.category ?? "") !== (p.category ?? "") || JSON.stringify(c.aliases ?? []) !== JSON.stringify(p.aliases ?? [])); });
  /** 카탈로그 품목을 한꺼번에 등록 (이미 있는 것은 건너뜀) + 카탈로그에서 빠진 미사용 품목 정리 */
  function importCatalog() {
    if (!loaded) return;
    const add = catalogProducts.filter((c) => !items.some((p) => p.id === c.id || (p.name === c.name && (p.spec ?? "") === (c.spec ?? ""))));
    const staleIds = new Set(catalogStale.map((p) => p.id));
    const refresh = new Map(catalogOutdated.map((p) => [p.id, catalogProducts.find((c) => c.id === p.id)!]));
    if (!add.length && !staleIds.size && !refresh.size) { flash("카탈로그 품목이 이미 모두 등록되어 있습니다."); return; }
    // 기존 품목은 단가·안전재고·배합은 그대로 두고 카탈로그 정보(메모·분류·별칭)만 새로 맞춥니다
    setItems((prev) => [...prev.filter((p) => !staleIds.has(p.id)).map((p) => { const c = refresh.get(p.id); return c ? { ...p, memo: c.memo, category: c.category, aliases: c.aliases } : p; }), ...add.map((c) => ({ ...c, createdAt: today }))]);
    const done = [add.length ? `카탈로그 품목 ${add.length}개를 등록` : "", refresh.size ? `${refresh.size}개의 조달번호·중량·별칭을 최신으로 맞춤` : "", staleIds.size ? `카탈로그에서 빠진 ${staleIds.size}개를 정리` : ""].filter(Boolean).join(", ");
    flash(`${done}했습니다. 단가는 「단가표」에서, 안전재고와 배합은 품목 수정에서 넣으세요.`);
  }
  function importRows(rows: Omit<Product, "id" | "createdAt">[]) {
    if (!loaded) return;
    const fresh = rows.filter((r) => !items.some((p) => p.name === r.name && (p.spec ?? "") === (r.spec ?? "")));
    setItems((prev) => [...prev, ...fresh.map((r) => ({ ...r, id: newId("pd"), createdAt: today }))]);
    setPasting(false);
    flash(`${fresh.length}개 품목을 등록했습니다.${rows.length - fresh.length ? ` (이미 있는 ${rows.length - fresh.length}개는 건너뜀)` : ""}`);
  }
  const allCategories = Array.from(new Set([...productCategories, ...catalogCategories, ...items.map((p) => p.category ?? "기타")]));
  const [me, setMe] = useState<{ name?: string } | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (loaded && openId) { const p = items.find((x) => x.id === openId); if (p) setEditing(p); } }, [loaded, openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const stock = useMemo(() => stockByProduct(moves), [moves]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .map((p) => ({ p, qty: stock.get(p.id) ?? 0, low: p.safetyStock !== undefined && (stock.get(p.id) ?? 0) <= p.safetyStock }))
      .filter(({ p }) => category === "all" || (p.category ?? "기타") === category)
      .filter(({ p }) => !onlyFav || p.favorite)
      .filter(({ low }) => !onlyLow || low)
      .filter(({ p }) => !q || [p.name, p.spec ?? "", p.category ?? "", p.memo ?? ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => Number(b.low) - Number(a.low) || a.p.name.localeCompare(b.p.name, "ko"));
  }, [items, stock, query, category, onlyLow, onlyFav]);
  const lowCount = items.filter((p) => p.safetyStock !== undefined && (stock.get(p.id) ?? 0) <= p.safetyStock).length;
  const todayIn = moves.filter((m) => m.date === today && m.qty > 0).reduce((s, m) => s + m.qty, 0);
  const todayOut = moves.filter((m) => m.date === today && m.qty < 0).reduce((s, m) => s - m.qty, 0);
  const productName = (id: string) => { const p = items.find((x) => x.id === id); return p ? `${p.name}${p.spec ? ` (${p.spec})` : ""}` : "(삭제된 품목)"; };
  const moveRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...moves]
      .filter((m) => !q || [productName(m.productId), m.type, m.refLabel ?? "", m.memo ?? ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [moves, query, items]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleFavorite(id: string) {
    if (!loaded) return;
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)));
  }
  function addProduct(d: ProductInput) {
    const id = newId("pd");
    const { initialStock, ...rest } = d;
    setItems((prev) => [{ ...rest, id, createdAt: today }, ...prev]);
    if (initialStock && movesLoaded) setMoves((prev) => [{ id: newId("sm"), date: today, productId: id, type: "기초재고", qty: initialStock, memo: "품목 등록 시 입력", createdBy: me?.name, createdAt: nowIso() }, ...prev]);
    setAdding(false);
  }
  function updateProduct(id: string, d: ProductInput) {
    const { initialStock: _i, ...rest } = d; // eslint-disable-line @typescript-eslint/no-unused-vars
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...rest } : p)));
    setEditing(null);
  }
  function removeProduct(id: string) {
    const n = moves.filter((m) => m.productId === id).length;
    if (!confirm(`이 품목을 삭제할까요?${n ? ` 입출고 내역 ${n}건도 함께 지워집니다.` : ""}`)) return;
    setItems((prev) => prev.filter((p) => p.id !== id));
    if (movesLoaded) setMoves((prev) => prev.filter((m) => m.productId !== id));
    setEditing(null);
  }
  function addMove(d: MoveInput) {
    if (!movesLoaded) return;
    setMoves((prev) => [{ id: newId("sm"), ...d, createdBy: me?.name, createdAt: nowIso() }, ...prev]);
    setMoving(null);
  }
  function removeMove(m: StockMove) {
    if (m.ref) { alert("생산일보·매출에서 자동으로 만들어진 내역입니다. 원본(생산일보 또는 매출)을 수정하거나 삭제하세요."); return; }
    if (!confirm("이 입출고 내역을 지울까요? 재고 수량이 되돌아갑니다.")) return;
    setMoves((prev) => prev.filter((x) => x.id !== m.id));
  }

  return (
    <>
      <PageHeader
        title="재고관리"
        description="제품별 현재고를 보고, 안전재고 이하는 빨간색으로 경고합니다. 생산일보와 거래명세표가 재고를 자동으로 움직입니다."
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPasting(true)} className="rounded-full border border-line bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 hover:border-primary hover:text-primary transition">엑셀 붙여넣기</button>
            <button onClick={() => setMoving("any")} className="rounded-full border border-line bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 hover:border-primary hover:text-primary transition">입출고 등록</button>
            <button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">＋ 품목 등록</button>
          </div>
        }
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      {notice && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}
      {(catalogMissing > 0 || catalogStale.length > 0 || catalogOutdated.length > 0) && (
        <div className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary-soft/50 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex-1"><div className="font-semibold text-slate-800">{catalogMissing > 0 ? `콘크리트 제품 카탈로그 품목 ${catalogMissing}개를 아직 불러오지 않았습니다` : catalogOutdated.length > 0 ? `카탈로그 정보(조달번호·중량·별칭)가 바뀐 품목 ${catalogOutdated.length}개를 맞출 수 있습니다` : `카탈로그에서 빠진 품목 ${catalogStale.length}개를 정리할 수 있습니다`}</div><div className="text-xs text-slate-500">벤치플륨·측구수로관·원형사각수로관·집수정·PC원형/사각맨홀·사각맨홀 집수정(우수받이)·전기통신 수공맨홀·콘크리트 기초와 맨홀 부속자재입니다. 한 번 누르면 생산일보·매출·품질관리에서 검색해 고를 수 있습니다.</div></div>
          <button onClick={importCatalog} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm">{catalogMissing > 0 ? "카탈로그 품목 불러오기" : "카탈로그와 맞추기"}</button>
        </div>
      )}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="등록 품목" value={`${items.length}종`} sub="재고를 관리하는 제품 수" icon="▦" onClick={() => { setTab("stock"); setOnlyLow(false); }} />
        <StatCard label="재고 부족" value={<span className={lowCount ? "text-red-600" : ""}>{lowCount}종</span>} sub="안전재고 이하" icon="!" highlight={onlyLow} onClick={() => { setTab("stock"); setOnlyLow(true); }} />
        <StatCard label="오늘 입고" value={`${todayIn.toLocaleString("ko-KR")}`} sub="생산·반품·조정 합계" icon="▲" tone="green" onClick={() => setTab("moves")} />
        <StatCard label="오늘 출하" value={`${todayOut.toLocaleString("ko-KR")}`} sub="거래명세표 기준" icon="▼" onClick={() => setTab("moves")} />
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Tabs value={tab} onChange={(v) => setTab(v as "stock" | "moves")} tabs={[{ key: "stock", label: "재고 현황", n: items.length }, { key: "moves", label: "입출고 내역", n: moves.length }]} />
          <div className="relative w-full md:w-72 md:ml-auto">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === "stock" ? "품명, 규격, 분류 검색" : "품명, 종류, 메모 검색"} className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
          </div>
        </div>
        {tab === "stock" && (
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={category} onChange={setCategory} tabs={[{ key: "all", label: "전체" }, ...allCategories.filter((c) => items.some((p) => (p.category ?? "기타") === c)).map((c) => ({ key: c, label: c, n: items.filter((p) => (p.category ?? "기타") === c).length }))]} />
            <label className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-slate-700"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> 부족만</label>
            <label className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-slate-700" title="별표(★)를 켠 품목만. 생산일보 빠른 입력과 양식 인쇄에 나옵니다"><input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} /> 생산 품목만 <span className="text-xs text-slate-400">★ {items.filter((p) => p.favorite).length}</span></label>
          </div>
        )}
      </Card>

      {tab === "stock" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-line">
                <th className="px-5 py-3 font-medium">품명</th>
                <th className="px-3 py-3 font-medium">규격</th>
                <th className="px-3 py-3 font-medium">분류</th>
                <th className="px-3 py-3 font-medium text-right">현재고</th>
                <th className="px-3 py-3 font-medium text-right">안전재고</th>
                <th className="px-3 py-3 font-medium">상태</th>
                <th className="px-3 pr-5 py-3 font-medium text-right">입출고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">표시할 품목이 없습니다. 「품목 등록」으로 제품을 추가하세요.</td></tr>}
              {rows.map(({ p, qty, low }) => (
                <tr key={p.id} className={`hover:bg-primary-soft/30 transition ${low ? "bg-red-50/40" : ""}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-start gap-1.5">
                      <button type="button" onClick={() => toggleFavorite(p.id)} title={p.favorite ? "생산 품목에서 빼기" : "생산 품목(별표)으로 표시: 생산일보 빠른 입력·양식 인쇄에 나옵니다"} className={`mt-0.5 shrink-0 text-base leading-none ${p.favorite ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}>{p.favorite ? "★" : "☆"}</button>
                      <button onClick={() => setEditing(p)} title={p.name} className="block max-w-[17rem] truncate text-left font-medium text-slate-800 hover:text-primary">{p.name}</button>
                    </div>
                    {p.memo && <div className="ml-6 text-xs text-slate-400 truncate max-w-[17rem]">{p.memo}</div>}
                  </td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{p.spec ?? "-"}</td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{p.category ?? "기타"}</td>
                  <td className={`px-3 py-3 text-right tabular-nums font-semibold whitespace-nowrap ${low ? "text-red-600" : "text-slate-800"}`}>{qty.toLocaleString("ko-KR")} <span className="text-xs font-normal text-slate-400">{p.unit}</span></td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500 whitespace-nowrap">{p.safetyStock ?? "-"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{low ? <span className="rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs">부족</span> : <span className="rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-xs">정상</span>}</td>
                  <td className="px-3 pr-5 py-3 text-right whitespace-nowrap"><button onClick={() => setMoving(p)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-700 hover:border-primary hover:text-primary">반품·폐기·조정</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "moves" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-line">
                <th className="px-5 py-3 font-medium">날짜</th>
                <th className="px-3 py-3 font-medium">종류</th>
                <th className="px-3 py-3 font-medium">품목</th>
                <th className="px-3 py-3 font-medium text-right">수량</th>
                <th className="px-3 py-3 font-medium">연결 문서</th>
                <th className="px-3 py-3 font-medium">메모</th>
                <th className="px-3 py-3 font-medium">담당</th>
                <th className="px-3 pr-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {moveRows.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">입출고 내역이 없습니다.</td></tr>}
              {moveRows.map((m) => (
                <tr key={m.id} className="hover:bg-primary-soft/30 transition">
                  <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{m.date}</td>
                  <td className="px-3 py-3 whitespace-nowrap"><span className={`rounded-full px-2 py-0.5 text-xs ${moveTypeMeta[m.type].badge}`}>{m.type}</span></td>
                  <td className="px-3 py-3 text-slate-800"><span className="block max-w-[16rem] truncate" title={productName(m.productId)}>{productName(m.productId)}</span></td>
                  <td className={`px-3 py-3 text-right tabular-nums font-semibold whitespace-nowrap ${m.qty >= 0 ? "text-green-700" : "text-red-600"}`}>{m.qty >= 0 ? "+" : ""}{m.qty.toLocaleString("ko-KR")}</td>
                  <td className="px-3 py-3 text-xs text-slate-500"><span className="block max-w-[12rem] truncate">{m.refLabel ?? "-"}</span></td>
                  <td className="px-3 py-3 text-xs text-slate-500"><span className="block max-w-[14rem] truncate">{m.memo ?? "-"}</span></td>
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{m.createdBy ?? "-"}</td>
                  <td className="px-3 pr-5 py-3 text-right whitespace-nowrap">{!m.ref && <button onClick={() => removeMove(m)} className="text-xs text-slate-400 hover:text-red-600">삭제</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      </>)}

      {adding && <ProductForm onSubmit={addProduct} onCancel={() => setAdding(false)} />}
      {pasting && <PasteImport onSubmit={importRows} onCancel={() => setPasting(false)} />}
      {editing && <ProductForm initial={editing} onSubmit={(d) => updateProduct(editing.id, d)} onCancel={() => setEditing(null)} onDelete={() => removeProduct(editing.id)} />}
      {moving && items.length > 0 && <MoveForm products={items} product={moving === "any" ? undefined : moving} stock={stock} today={today} onSubmit={addMove} onCancel={() => setMoving(null)} />}
    </>
  );
}
