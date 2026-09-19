"use client";

// 스마트 업로드: 사진/PDF 를 끌어다 놓거나 찍어 올리면 AI가 서류 종류를 판별하고, 확인 후 해당 메뉴에 저장합니다.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { InboxDoc, InboxKind } from "@/app/api/inbox/analyze/route";
import { resizeImageToBase64 } from "@/lib/imageResize";
import { useServerState } from "@/lib/useServerState";
import { formatWon, todayIso } from "@/lib/format";
import {
  tasks as initialTasks, events as initialEvents, purchases as initialPurchases, revenues as initialRevenues, deposits as initialDeposits, businessCards as initialCards, projects as initialProjects,
  type Task, type Event, type Purchase, type Revenue, type Deposit, type BusinessCard, type Project,
} from "@/data/sample";
import { kindMeta, toCard, toDeposit, toEvent, toOrder, toPurchase, toRevenue, toTask, toProductionReport, nextProjectCode } from "@/lib/inbox/mapping";
import { attachOrder, findDuplicate, suggestProjects, suggestProjectName } from "@/lib/projects/orders";
import { guessRegion } from "@/lib/projects/region";
import { movesForPurchase, replaceMaterialMovesByRef, movesForProduction, replaceMovesByRef, materialMovesForProduction, matchProduct } from "@/lib/inventory/stock";
import { materials as initialMaterials, materialMoves as initialMaterialMoves, productions as initialProductions, products as initialProducts, stockMoves as initialStockMoves, type Material, type MaterialMove, type ProductionReport, type Product, type StockMove } from "@/data/sample";
import { newId } from "@/lib/ids";
import type { PartyMatch } from "@/lib/inbox/resolveParties";
import { customers as initialCustomers, type Customer } from "@/data/sample";

const KINDS: InboxKind[] = ["명함", "매출명세표", "매입명세표", "납품요구서", "입금내역", "생산일보", "일정", "할일", "기타"];
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    r.readAsDataURL(file);
  });
}

/** 파일 고르기/끌어놓기 → AI 분석 → 확인 창. variant 로 대시보드용(큰 영역)과 버튼용을 고릅니다. */
export default function SmartInbox({ variant = "dropzone", onSaved: onSavedProp }: { variant?: "dropzone" | "button" | "camera"; onSaved?: (text: string, href: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ doc: InboxDoc; fileName: string; match?: PartyMatch; image?: string } | null>(null);
  const [done, setDone] = useState<{ text: string; href: string } | null>(null);

  async function analyze(file: File) {
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      let payload: { file: string; mediaType: string };
      if (file.type === "application/pdf") {
        if (file.size > MAX_PDF_BYTES) throw new Error("PDF 가 8MB 를 넘습니다.");
        payload = { file: await fileToBase64(file), mediaType: "application/pdf" };
      } else if (file.type.startsWith("image/")) {
        const { base64, mediaType } = await resizeImageToBase64(file, 2000);
        payload = { file: base64, mediaType };
      } else {
        throw new Error("사진(JPG/PNG) 또는 PDF 파일만 올릴 수 있습니다.");
      }
      const res = await fetch("/api/inbox/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, fileName: file.name }) });
      const body = (await res.json()) as { doc?: InboxDoc; error?: string; match?: PartyMatch };
      if (!res.ok || !body.doc) throw new Error(body.error ?? "분석에 실패했습니다.");
      setResult({ doc: body.doc, fileName: file.name, match: body.match, image: payload.mediaType === "image/jpeg" ? payload.file : undefined });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) analyze(f); };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDrag(true); };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) analyze(f); }} />
      {variant === "dropzone" ? (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={() => setDrag(false)}
          onClick={() => !busy && fileRef.current?.click()}
          className={`hidden md:block cursor-pointer rounded-2xl border-2 border-dashed px-5 py-5 text-center transition ${drag ? "border-primary bg-primary-soft" : "border-line bg-card hover:border-primary/60"}`}
        >
          <div className="text-2xl">{busy ? "⏳" : "📸"}</div>
          <div className="mt-1 font-semibold text-slate-800">{busy ? "서류를 읽고 있습니다... (10~20초)" : "사진이나 PDF를 여기에 끌어다 놓거나 눌러서 올리세요"}</div>
          <div className="mt-1 text-xs text-slate-500">명함 · 거래명세표 · 매입 영수증 · 납품요구서 · 입금 내역 · 회의 통지 · 지시 메모 → AI가 알아서 분류해 매입·매출·일정·할일 등 맞는 메뉴에 넣어 드립니다. 휴대폰에서는 카메라로 바로 찍을 수 있습니다.</div>
        </div>
      ) : variant === "camera" ? (
        <button type="button" onClick={() => !busy && fileRef.current?.click()} disabled={busy} className="w-full rounded-2xl border-2 border-dashed border-primary/40 bg-primary-soft/60 px-4 py-4 text-left hover:border-primary disabled:opacity-60">
          <div className="text-base font-semibold text-slate-800">{busy ? "⏳ 서류를 읽고 있습니다... (10~20초)" : "📷 사진 찍어서 등록"}</div>
          <div className="mt-1 text-xs text-slate-600">명함·영수증·거래명세표·납품요구서·회의 통지·지시 메모를 찍으면 알아서 맞는 메뉴에 넣어 드립니다.</div>
        </button>
      ) : (
        <button type="button" onClick={() => !busy && fileRef.current?.click()} disabled={busy} title="사진·PDF 올려서 자동 등록" className="rounded-full border border-line bg-white px-3 py-2 text-sm text-slate-700 hover:border-primary hover:text-primary disabled:opacity-60">
          {busy ? "읽는 중..." : "📎"}
        </button>
      )}
      {error && <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"><span>{error}</span><button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button></div>}
      {done && !onSavedProp && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
          <span>{done.text}</span>
          <Link href={done.href} className="text-xs font-semibold text-primary hover:underline">확인하러 가기 →</Link>
        </div>
      )}
      {result && <InboxReview doc={result.doc} fileName={result.fileName} match={result.match} image={result.image} onClose={() => setResult(null)} onSaved={(text, href) => { setResult(null); if (onSavedProp) onSavedProp(text, href); else setDone({ text, href }); }} />}
    </>
  );
}

/** 분석 결과 확인 + 저장. 저장할 메뉴의 데이터는 이 창이 열릴 때만 불러옵니다. */
function InboxReview({ doc, fileName, match, image, onClose, onSaved }: { doc: InboxDoc; fileName: string; match?: PartyMatch; image?: string; onClose: () => void; onSaved: (text: string, href: string) => void }) {
  const [kind, setKind] = useState<InboxKind>(doc.kind);
  const [d, setD] = useState<InboxDoc>(doc);
  const [, setCustomers, customersLoaded] = useServerState<Customer[]>("customers", initialCustomers, "jeil.customers");
  // 모르는 공급자(우리도, 등록된 대리점도 아님)면 대리점으로 등록하고 매출을 그 앞으로 잡을지 선택
  const unknownSupplier = match?.type === "unknown-supplier" && !!doc.supplierName;
  const [registerDealer, setRegisterDealer] = useState(unknownSupplier && doc.kind !== "매입명세표");
  const [me, setMe] = useState<{ id?: string; name?: string } | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); }, []);
  // 저장할 메뉴의 데이터가 서버에서 다 불러와진 뒤에만 저장 버튼을 켭니다 (불러오기 전에 저장하면 유실될 수 있음)
  const [, setTasks, tasksLoaded] = useServerState<Task[]>("tasks", initialTasks, "jeil.tasks");
  const [, setEvents, eventsLoaded] = useServerState<Event[]>("events", initialEvents, "jeil.events");
  const [, setPurchases, purchasesLoaded] = useServerState<Purchase[]>("purchases", initialPurchases, "jeil.purchases");
  const [materials, , materialsLoaded] = useServerState<Material[]>("materials", initialMaterials);
  const [, setMatMoves, matLoaded] = useServerState<MaterialMove[]>("materialMoves", initialMaterialMoves);
  const [revenues, setRevenues, revenuesLoaded] = useServerState<Revenue[]>("revenues", initialRevenues, "jeil.revenues");
  const [priceNote, setPriceNote] = useState<string | null>(null);
  // 인수증: 서명 받은 거래명세표 사진이면 매출에 사진을 붙여 둡니다. 이미 등록된 매출이면 새로 만들지 않고 사진만 붙입니다
  const normName = (v?: string) => (v ?? "").replace(/\s|\(주\)|㈜|주식회사/g, "").toLowerCase();
  const existingRevenue = useMemo(() => {
    if (kind !== "매출명세표" || !revenuesLoaded) return undefined;
    const no = (d.docNo || "").trim();
    return revenues.find((r) => (no && r.docNumber && (r.docNumber === no || r.docNumber.endsWith(no) || no.endsWith(r.docNumber))) || (!!d.counterparty && normName(r.customer) === normName(d.counterparty) && !!d.date && r.date === d.date && (!d.totalAmount || Math.abs(r.amount - d.totalAmount) < 1)));
  }, [kind, revenuesLoaded, revenues, d.docNo, d.counterparty, d.date, d.totalAmount]);
  const [attachTo, setAttachTo] = useState<string>("auto"); // auto | new | 기존 매출 id
  const attachTarget = attachTo === "auto" ? existingRevenue?.id ?? "new" : attachTo;
  const [saveReceipt, setSaveReceipt] = useState(true);
  async function uploadReceipt(revenueId: string) {
    if (!image) return false;
    const r = await fetch(`/api/revenues/receipt/${revenueId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: `data:image/jpeg;base64,${image}`, note: d.signed ? "서명 확인" : undefined }) });
    return r.ok;
  }
  // 단가가 비어 있으면 같은 거래처에 판 같은 품목의 마지막 단가를 채워 줍니다 (대리점 송장은 단가가 비어 오는 경우가 많음)
  useEffect(() => {
    if (!revenuesLoaded || kind !== "매출명세표") return;
    // 대리점으로 등록하기로 했으면 공급자(대리점) 기준으로 이전 단가를 찾습니다
    const who = ((registerDealer && unknownSupplier ? d.supplierName : d.counterparty) || "").trim();
    if (!who || !d.items.some((i) => !i.unitPrice)) return;
    const norm = (v?: string) => (v ?? "").replace(/\s/g, "").toLowerCase();
    const past = revenues.filter((r) => norm(r.customer) === norm(who) && r.items?.length).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    let filled = 0;
    const items = d.items.map((it) => {
      if (it.unitPrice) return it;
      for (const r of past) {
        const hit = r.items!.find((x) => norm(x.name) === norm(it.name) && norm(x.spec) === norm(it.spec));
        if (hit?.unitPrice) { filled++; return { ...it, unitPrice: hit.unitPrice, amount: hit.unitPrice * (it.qty || 0) }; }
      }
      return it;
    });
    if (filled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setD((prev) => ({ ...prev, items }));
      setPriceNote(`${who}에 판 이전 단가를 ${filled}개 품목에 채웠습니다. 바뀐 단가가 있으면 고쳐 주세요.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revenuesLoaded, kind, d.counterparty, registerDealer]);
  const [, setDeposits, depositsLoaded] = useServerState<Deposit[]>("deposits", initialDeposits, "jeil.deposits");
  const [, setCards, cardsLoaded] = useServerState<BusinessCard[]>("businessCards", initialCards, "jeil.businessCards");
  const [projects, setProjects, projectsLoaded] = useServerState<Project[]>("projects", initialProjects, "jeil.projects");
  const [, setProductions, productionsLoaded] = useServerState<ProductionReport[]>("productions", initialProductions);
  const [products, setProducts, productsLoaded] = useServerState<Product[]>("products", initialProducts);
  const [, setStockMoves, stockMovesLoaded] = useServerState<StockMove[]>("stockMoves", initialStockMoves);
  const readyByKind: Record<InboxKind, boolean> = { 명함: cardsLoaded, 매출명세표: revenuesLoaded, 매입명세표: purchasesLoaded && materialsLoaded && matLoaded, 납품요구서: projectsLoaded, 입금내역: depositsLoaded, 생산일보: productionsLoaded && productsLoaded && stockMovesLoaded && matLoaded, 일정: eventsLoaded, 할일: tasksLoaded, 기타: false };
  const [target, setTarget] = useState<string>("auto");

  const set = (k: keyof InboxDoc) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });
  const meta = kindMeta[kind];
  const itemsTotal = d.items.reduce((s, i) => s + (i.amount || i.qty * i.unitPrice || 0), 0);

  // 납품요구서: 기존 프로젝트 추천
  const orderLike = { agency: d.counterparty, site: d.location, contractNo: d.contractNo, orderNo: d.orderNo, projectName: d.projectName };
  const dup = kind === "납품요구서" ? findDuplicate(projects, { orderNo: d.orderNo, kind: "분할납품요구서" }) : null;
  const suggestions = kind === "납품요구서" ? suggestProjects(projects, orderLike).slice(0, 4) : [];
  const autoTarget = dup ? dup.project.id : suggestions[0] && suggestions[0].strong ? suggestions[0].project.id : "new";

  function save() {
    const today = todayIso();
    let dd = d;
    if (registerDealer && unknownSupplier && kind === "매출명세표") {
      const dealer: Customer = { id: newId("c"), name: d.supplierName, bizNo: d.supplierBizNo || undefined, phone: d.contact || undefined, address: d.address || undefined, dealer: true, memo: "스마트 업로드로 등록된 대리점", createdAt: today };
      setCustomers((prev) => (prev.some((c) => c.name === dealer.name) ? prev : [dealer, ...prev]));
      const dest = [d.recipientName, d.siteName].filter(Boolean).join(" · ");
      dd = { ...d, counterparty: d.supplierName, location: d.siteName || d.location, memo: [dest ? `최종 납품처: ${dest}` : "", d.contact ? `담당 ${d.contact}` : "", d.memo].filter(Boolean).join(" · ") };
    }
    switch (kind) {
      case "명함": { const rec = { ...toCard(d, today), ownerId: me?.id, ownerName: me?.name }; setCards((prev) => [rec, ...prev]); onSaved(`명함관리에 「${rec.name} · ${rec.company}」을(를) 저장했습니다.`, meta.href); return; }
      case "매출명세표": {
        const wantReceipt = !!image && saveReceipt;
        if (attachTarget !== "new") {
          const target = revenues.find((r) => r.id === attachTarget);
          if (wantReceipt) uploadReceipt(attachTarget).then((ok) => onSaved(ok ? `이미 등록된 매출 「${target?.title ?? ""}」에 인수증 사진을 붙였습니다. 매출관리에서 「인수증」을 누르면 볼 수 있습니다.` : "인수증 사진을 저장하지 못했습니다. 매출관리에서 다시 올려 주세요.", meta.href));
          else onSaved(`이미 등록된 매출 「${target?.title ?? ""}」이(가) 있어 새로 만들지 않았습니다.`, meta.href);
          return;
        }
        const rec = toRevenue(dd); setRevenues((prev) => [rec, ...prev]);
        if (wantReceipt) uploadReceipt(rec.id).then((ok) => onSaved(`매출관리에 「${rec.title}」 ${formatWon(rec.amount)}을(를) 등록${ok ? "하고 인수증 사진을 붙였습니다" : "했습니다 (인수증 사진 저장 실패)"}.`, meta.href));
        else onSaved(`매출관리에 「${rec.title}」 ${formatWon(rec.amount)}을(를) 등록했습니다.`, meta.href);
        return;
      }
      case "매입명세표": {
        const rec = toPurchase(d);
        setPurchases((prev) => [rec, ...prev]);
        const mv = materialsLoaded && matLoaded ? movesForPurchase(rec, materials, me?.name) : [];
        if (mv.length) setMatMoves((prev) => replaceMaterialMovesByRef(prev, rec.id, mv));
        onSaved(`매입관리에 「${rec.supplier} · ${rec.item}」 ${formatWon(rec.supply + rec.vat)}을(를) 등록했습니다.${mv.length ? ` 원자재 재고에 ${mv.map((x) => materials.find((m) => m.id === x.materialId)?.name).filter(Boolean).join(", ")} 입고 처리했습니다.` : ""}`, meta.href); return;
      }
      case "입금내역": { const rec = toDeposit(d); setDeposits((prev) => [rec, ...prev]); onSaved(`입금관리에 「${rec.payer}」 ${formatWon(rec.amount)} 입금을 등록했습니다. 매출과 연결은 입금관리에서 하세요.`, meta.href); return; }
      case "생산일보": {
        // 품목 이름으로 재고관리 품목을 찾아 연결하고, 없는 것은 새 품목으로 등록합니다 (생산관리 화면과 같은 규칙)
        const rec = toProductionReport(d, me?.name);
        const created: Product[] = [];
        rec.items = rec.items.map((it) => {
          const found = matchProduct(products, it.name, it.spec) ?? created.find((p) => p.name === it.name && (p.spec ?? "") === (it.spec ?? ""));
          if (found) return { ...it, productId: found.id };
          const np: Product = { id: newId("pd"), name: it.name, spec: it.spec, unit: it.unit, category: "기타", safetyStock: 0, createdAt: today };
          created.push(np);
          return { ...it, productId: np.id };
        });
        if (created.length) setProducts((prev) => [...created, ...prev]);
        setProductions((prev) => [rec, ...prev]);
        setStockMoves((prev) => replaceMovesByRef(prev, rec.id, movesForProduction(rec, me?.name)));
        const used = materialMovesForProduction(rec, [...created, ...products], me?.name);
        if (used.length) setMatMoves((prev) => replaceMaterialMovesByRef(prev, rec.id, used));
        const total = rec.items.reduce((s, i) => s + i.produced, 0);
        onSaved(`생산관리에 ${rec.date} 생산일보(품목 ${rec.items.length}건, ${total.toLocaleString("ko-KR")}개)를 저장하고 재고에 입고했습니다.${created.length ? ` 새 품목 ${created.map((p) => `「${p.name}」`).join(", ")}을(를) 재고관리에 등록했습니다.` : ""}${used.length ? ` 배합대로 원자재 ${used.length}종을 사용 처리했습니다.` : ""}`, meta.href);
        return;
      }
      case "일정": { const rec = toEvent(d); setEvents((prev) => [rec, ...prev]); onSaved(`일정관리에 「${rec.title}」(${rec.date}${rec.time ? ` ${rec.time}` : ""})을(를) 등록했습니다.`, meta.href); return; }
      case "할일": { const rec = toTask(d); setTasks((prev) => [rec, ...prev]); onSaved(`할일관리에 「${rec.title}」을(를) 등록했습니다.`, meta.href); return; }
      case "납품요구서": {
        const order = toOrder(d, fileName, me?.name);
        const t = target === "auto" ? autoTarget : target;
        if (t === "new") {
          const name = d.projectName?.trim() || suggestProjectName(order);
          setProjects((prev) => {
            const base: Project = { id: newId("p"), code: nextProjectCode(prev), name, client: order.agency, type: "관급", status: "진행중", assignees: [], progress: 0, revenue: 0, region: guessRegion(order.agency, name, order.site, order.projectName), orders: [] };
            return [attachOrder(base, order), ...prev];
          });
          onSaved(`프로젝트관리에 「${name}」을(를) 만들고 납품요구서(품목 ${order.items.length}건)를 넣었습니다.`, meta.href);
        } else {
          let pname = "";
          setProjects((prev) => prev.map((p) => { if (p.id !== t) return p; pname = p.name; return attachOrder(p, order); }));
          onSaved(`프로젝트 「${pname || "선택한 프로젝트"}」에 납품요구서(품목 ${order.items.length}건)를 합쳤습니다.`, meta.href);
        }
        return;
      }
      default: return;
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-3">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card p-5 md:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">AI가 읽은 내용을 확인하세요</h2>
            <p className="text-xs text-slate-500">{fileName} · 신뢰도 {d.confidence === "high" ? "높음" : d.confidence === "medium" ? "보통" : "낮음"} · {d.summary}</p>
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-slate-600">어떤 서류인가요? <span className="text-slate-400">(틀리면 바꾸세요 → 저장되는 메뉴가 달라집니다)</span></span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button type="button" key={k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1.5 text-xs transition ${kind === k ? "border-primary bg-primary text-white" : "border-line bg-white text-slate-600 hover:border-primary"}`}>{kindMeta[k].label}</button>
            ))}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">저장 위치: <b className="text-slate-700">{meta.menu}</b></div>
        </label>

        {kind === "기타" && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">어느 메뉴에 넣을지 판단하지 못했습니다. 위에서 종류를 골라 주시면 그 메뉴에 저장합니다.</div>}
        {match?.type === "dealer" && match.dealer && (
          <div className="rounded-xl border border-primary/30 bg-primary-soft/60 px-4 py-3 text-sm text-slate-800">
            공급자 <b>{d.supplierName}</b>{d.supplierBizNo ? ` (${d.supplierBizNo})` : ""}는 등록된 <b>대리점</b>입니다. 매출은 대리점 「{match.dealer.name}」 앞으로 잡고, 최종 납품처({[d.recipientName, d.siteName].filter(Boolean).join(" · ") || "-"})는 메모에 남깁니다.
          </div>
        )}
        {match?.type === "us" && <div className="rounded-xl border border-line bg-background px-4 py-2.5 text-xs text-slate-600">공급자가 우리 회사(사업자번호 일치)라서 매출로 분류했습니다. 거래처: {d.counterparty || "-"}</div>}
        {match?.type === "purchase" && <div className="rounded-xl border border-line bg-background px-4 py-2.5 text-xs text-slate-600">공급받는자가 우리 회사(사업자번호 일치)라서 매입으로 분류했습니다. 매입처: {d.counterparty || "-"}</div>}
        {unknownSupplier && kind !== "매입명세표" && (
          <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <input type="checkbox" checked={registerDealer} onChange={(e) => { setRegisterDealer(e.target.checked); if (e.target.checked) setKind("매출명세표"); }} className="mt-0.5 accent-primary" />
            <span>공급자 <b>{d.supplierName}</b>{d.supplierBizNo ? ` (${d.supplierBizNo})` : ""}는 우리 회사도, 등록된 대리점도 아닙니다. <b>대리점 고객으로 등록</b>하고 이 매출을 그 대리점 앞으로 잡을까요? (최종 납품처 {[d.recipientName, d.siteName].filter(Boolean).join(" · ") || "-"}는 메모에 남깁니다)</span>
          </label>
        )}

        {kind === "명함" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm"><span className="text-slate-600">이름</span><input value={d.person} onChange={set("person")} className={inputCls} /></label>
            <label className="block text-sm"><span className="text-slate-600">회사</span><input value={d.counterparty} onChange={set("counterparty")} className={inputCls} /></label>
            <label className="block text-sm"><span className="text-slate-600">직책</span><input value={d.jobTitle} onChange={set("jobTitle")} className={inputCls} /></label>
            <label className="block text-sm"><span className="text-slate-600">휴대전화</span><input value={d.mobile} onChange={set("mobile")} className={inputCls} /></label>
            <label className="block text-sm"><span className="text-slate-600">회사 전화</span><input value={d.phone} onChange={set("phone")} className={inputCls} /></label>
            <label className="block text-sm"><span className="text-slate-600">이메일</span><input value={d.email} onChange={set("email")} className={inputCls} /></label>
            <label className="block text-sm sm:col-span-2"><span className="text-slate-600">주소</span><input value={d.address} onChange={set("address")} className={inputCls} /></label>
          </div>
        )}

        {kind === "매출명세표" && (image || existingRevenue) && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-primary-soft/30 px-4 py-3 text-sm">
            {existingRevenue && (
              <div>
                <div className="font-medium text-slate-800">같은 거래명세표가 매출관리에 이미 있습니다: 「{existingRevenue.title}」 {existingRevenue.date ?? ""}{existingRevenue.docNumber ? ` · ${existingRevenue.docNumber}` : ""}</div>
                <div className="mt-1.5 flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5"><input type="radio" name="attach" checked={attachTarget !== "new"} onChange={() => setAttachTo(existingRevenue.id)} className="accent-primary" /> 그 매출에 인수증 사진만 붙이기 <span className="text-xs text-slate-500">(추천 · 매출이 두 번 잡히지 않음)</span></label>
                  <label className="flex items-center gap-1.5"><input type="radio" name="attach" checked={attachTarget === "new"} onChange={() => setAttachTo("new")} className="accent-primary" /> 새 매출로 따로 등록</label>
                </div>
              </div>
            )}
            {image && (
              <label className="flex items-start gap-2"><input type="checkbox" checked={saveReceipt} onChange={(e) => setSaveReceipt(e.target.checked)} className="mt-0.5 accent-primary" /><span>이 사진을 <b>인수증</b>으로 보관 {d.signed ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-800">서명·도장 확인됨</span> : <span className="text-xs text-slate-500">(서명·도장이 안 보이지만 보관은 가능)</span>}<span className="block text-xs text-slate-500">매출관리 해당 줄의 「인수증」 단추에서 언제든 다시 볼 수 있습니다.</span></span></label>
            )}
          </div>
        )}
        {(kind === "매출명세표" || kind === "매입명세표" || kind === "납품요구서") && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <label className="block text-sm"><span className="text-slate-600">{kind === "매입명세표" ? "매입처" : kind === "납품요구서" ? "수요기관" : "거래처"}</span><input value={d.counterparty} onChange={set("counterparty")} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">날짜</span><input type="date" value={d.date} onChange={set("date")} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">문서 번호</span><input value={d.orderNo} onChange={set("orderNo")} className={inputCls} /></label>
              {kind !== "매입명세표" && <label className="block text-sm"><span className="text-slate-600">사업명</span><input value={d.projectName} onChange={set("projectName")} className={inputCls} /></label>}
              <label className="block text-sm"><span className="text-slate-600">{kind === "매입명세표" ? "지급 예정일" : "납품기한"}</span><input type="date" value={d.dueDate} onChange={set("dueDate")} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">{kind === "매입명세표" ? "분류" : "현장/납품장소"}</span>
                {kind === "매입명세표" ? (
                  <select value={d.category} onChange={set("category")} className={inputCls}>{["원자재", "부자재", "운반", "외주", "설비", "기타"].map((c) => <option key={c}>{c}</option>)}</select>
                ) : (
                  <input value={d.location} onChange={set("location")} className={inputCls} />
                )}
              </label>
            </div>
            {priceNote && <div className="rounded-xl border border-line bg-background px-4 py-2.5 text-xs text-slate-600">{priceNote}</div>}
            {kind === "매출명세표" && d.items.length > 0 && d.items.every((i) => !i.unitPrice) && !priceNote && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">단가가 비어 있습니다. 지금 넣지 않으면 금액 0원으로 저장되고 매출관리에 「단가 미입력」으로 표시됩니다. 나중에 매출을 열어 단가를 넣어도 됩니다.</div>}
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">품명</th><th className="px-3 py-2 text-left">규격</th><th className="px-3 py-2 text-left w-16">단위</th><th className="px-3 py-2 text-right w-20">수량</th><th className="px-3 py-2 text-right w-28">단가</th><th className="px-3 py-2 text-right w-32">금액</th><th className="w-8"></th></tr></thead>
                <tbody className="divide-y divide-line">
                  {d.items.map((it, i) => (
                    <tr key={i}>
                      {(["name", "spec", "unit"] as const).map((k) => <td key={k} className="px-2 py-1"><input value={it[k]} onChange={(e) => setD({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 hover:border-line focus:border-primary outline-none" /></td>)}
                      {(["qty", "unitPrice", "amount"] as const).map((k) => <td key={k} className="px-2 py-1"><input type="number" value={it[k]} onChange={(e) => setD({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, [k]: Number(e.target.value) } : x)) })} className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-right tabular-nums hover:border-line focus:border-primary outline-none" /></td>)}
                      <td className="px-1 text-center"><button type="button" onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })} className="text-slate-300 hover:text-red-500">✕</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50"><tr><td colSpan={3} className="px-3 py-2 text-slate-600">품목 {d.items.length}건</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{d.items.reduce((s, i) => s + (i.qty || 0), 0)}</td><td></td><td className="px-3 py-2 text-right font-semibold tabular-nums">{itemsTotal ? itemsTotal.toLocaleString("ko-KR") : "-"}</td><td></td></tr></tfoot>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setD({ ...d, items: [...d.items, { name: "", spec: "", unit: "EA", qty: 0, unitPrice: 0, amount: 0, defect: 0, note: "" }] })} className="text-xs text-primary hover:underline">＋ 품목 줄 추가</button>
              {kind !== "납품요구서" && (
                <>
                  <label className="text-sm"><span className="text-slate-600">공급가액</span><input type="number" value={d.supplyAmount} onChange={set("supplyAmount")} className="ml-2 w-32 rounded-xl border border-line bg-white px-2 py-1 text-right text-sm" /></label>
                  <label className="text-sm"><span className="text-slate-600">부가세</span><input type="number" value={d.vatAmount} onChange={set("vatAmount")} className="ml-2 w-28 rounded-xl border border-line bg-white px-2 py-1 text-right text-sm" /></label>
                  <label className="text-sm"><span className="text-slate-600">합계</span><input type="number" value={d.totalAmount} onChange={set("totalAmount")} className="ml-2 w-36 rounded-xl border border-line bg-white px-2 py-1 text-right text-sm font-semibold" /></label>
                </>
              )}
            </div>
            {kind === "납품요구서" && (
              <div className="rounded-xl border border-line bg-background p-3 text-sm space-y-2">
                <div className="font-medium text-slate-700">어느 프로젝트에 넣을까요?{!projectsLoaded && <span className="ml-2 text-xs text-slate-400">프로젝트 목록 불러오는 중…</span>}</div>
                {dup && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">같은 번호의 문서가 「[{dup.project.code}] {dup.project.name}」에 이미 있습니다. 그 프로젝트를 고르면 교체됩니다.</div>}
                <select value={target === "auto" ? autoTarget : target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
                  <option value="new">새 프로젝트로 만들기 ({d.projectName || "사업명 없음"})</option>
                  {suggestions.filter((s) => s.strong).map((s) => <option key={s.project.id} value={s.project.id}>★ 사업명 일치 · [{s.project.code}] {s.project.name} 에 합치기</option>)}
                  {projects.filter((p) => p.status !== "취소" && !suggestions.some((s) => s.strong && s.project.id === p.id)).map((p) => <option key={p.id} value={p.id}>[{p.code}] {p.name}{suggestions.some((s) => s.project.id === p.id) ? " (계약·발주처 같음)" : ""}</option>)}
                </select>
                <p className="text-[11px] text-slate-400">{autoTarget === "new" ? "사업명이 같은 프로젝트가 없어 새 프로젝트로 만듭니다." : "사업명이 같은 프로젝트가 있어 합치기를 골라 두었습니다. 아니면 첫 줄 「새 프로젝트로 만들기」를 고르세요."}</p>
              </div>
            )}
          </>
        )}

        {kind === "입금내역" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm"><span className="text-slate-600">입금자</span><input value={d.counterparty} onChange={set("counterparty")} className={inputCls} /></label>
            <label className="block text-sm"><span className="text-slate-600">입금일</span><input type="date" value={d.date} onChange={set("date")} className={inputCls} /></label>
            <label className="block text-sm"><span className="text-slate-600">입금액 (원)</span><input type="number" value={d.totalAmount} onChange={set("totalAmount")} className={inputCls} /></label>
            <label className="block text-sm"><span className="text-slate-600">은행/계좌</span><input value={d.bank} onChange={set("bank")} className={inputCls} /></label>
          </div>
        )}

        {kind === "생산일보" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="block text-sm"><span className="text-slate-600">생산일</span><input type="date" value={d.date} onChange={set("date")} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">라인·조</span><input value={d.line} onChange={set("line")} className={inputCls} placeholder="예) 1라인" /></label>
              <label className="block text-sm"><span className="text-slate-600">작업 시간</span><input type="number" value={d.workHours} onChange={set("workHours")} className={inputCls} /></label>
              <label className="block text-sm col-span-2 sm:col-span-1"><span className="text-slate-600">작업 인원 <span className="text-slate-400">(쉼표로)</span></span><input value={d.workers} onChange={set("workers")} className={inputCls} /></label>
            </div>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">품목</th><th className="px-3 py-2 text-left">규격</th><th className="px-3 py-2 text-left w-16">단위</th><th className="px-3 py-2 text-right w-20">생산량</th><th className="px-3 py-2 text-right w-20">불량</th><th className="px-3 py-2 text-left">비고</th><th className="w-8"></th></tr></thead>
                <tbody className="divide-y divide-line">
                  {d.items.map((it, i) => (
                    <tr key={i} className={!it.qty && !it.defect ? "text-slate-400" : ""}>
                      {(["name", "spec", "unit"] as const).map((k) => <td key={k} className="px-2 py-1"><input value={it[k]} onChange={(e) => setD({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 hover:border-line focus:border-primary outline-none" /></td>)}
                      {(["qty", "defect"] as const).map((k) => <td key={k} className="px-2 py-1"><input type="number" value={it[k]} onChange={(e) => setD({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, [k]: Number(e.target.value) } : x)) })} className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-right tabular-nums hover:border-line focus:border-primary outline-none" /></td>)}
                      <td className="px-2 py-1"><input value={it.note} onChange={(e) => setD({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })} className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 hover:border-line focus:border-primary outline-none" /></td>
                      <td className="px-1 text-center"><button type="button" onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })} className="text-slate-300 hover:text-red-500">✕</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50"><tr><td colSpan={3} className="px-3 py-2 text-slate-600">품목 {d.items.length}줄 (생산량 0인 줄은 저장 시 빠짐)</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{d.items.reduce((s, i) => s + (i.qty || 0), 0)}</td><td className="px-3 py-2 text-right tabular-nums">{d.items.reduce((s, i) => s + (i.defect || 0), 0) || "-"}</td><td colSpan={2}></td></tr></tfoot>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setD({ ...d, items: [...d.items, { name: "", spec: "", unit: "EA", qty: 0, unitPrice: 0, amount: 0, defect: 0, note: "" }] })} className="text-xs text-primary hover:underline">＋ 품목 줄 추가</button>
              <span className="text-xs text-slate-500">저장하면 생산량이 재고에 「생산입고」로 들어가고, 재고관리에 없는 품목은 새로 등록됩니다.</span>
            </div>
          </div>
        )}

        {(kind === "일정" || kind === "할일") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm sm:col-span-2"><span className="text-slate-600">제목</span><input value={d.title} onChange={set("title")} className={inputCls} /></label>
            {kind === "일정" ? (
              <>
                <label className="block text-sm"><span className="text-slate-600">날짜</span><input type="date" value={d.date} onChange={set("date")} className={inputCls} /></label>
                <label className="block text-sm"><span className="text-slate-600">종료일 (여러 날이면)</span><input type="date" value={d.endDate} onChange={set("endDate")} className={inputCls} /></label>
                <label className="block text-sm"><span className="text-slate-600">시작 시각</span><input type="time" value={d.time} onChange={set("time")} className={inputCls} /></label>
                <label className="block text-sm"><span className="text-slate-600">종류</span><select value={d.eventType} onChange={set("eventType")} className={inputCls}>{["납품", "회의", "생산", "점검", "기타"].map((t) => <option key={t}>{t}</option>)}</select></label>
                <label className="block text-sm sm:col-span-2"><span className="text-slate-600">장소</span><input value={d.location} onChange={set("location")} className={inputCls} /></label>
              </>
            ) : (
              <>
                <label className="block text-sm"><span className="text-slate-600">마감일</span><input type="date" value={d.dueDate || d.date} onChange={set("dueDate")} className={inputCls} /></label>
                <label className="block text-sm"><span className="text-slate-600">중요도</span><select value={d.priority} onChange={set("priority")} className={inputCls}><option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option></select></label>
              </>
            )}
          </div>
        )}

        <label className="block text-sm"><span className="text-slate-600">메모</span><input value={d.memo} onChange={set("memo")} className={inputCls} /></label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
          <button type="button" onClick={save} disabled={kind === "기타" || !readyByKind[kind] || (registerDealer && !customersLoaded)} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white">{kind !== "기타" && !readyByKind[kind] ? "준비 중…" : `${meta.menu}에 저장`}</button>
        </div>
      </div>
    </div>
  );
}
