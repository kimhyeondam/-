"use client";

// 납품 문서(분할납품요구서·거래명세표) 올리기 → AI 읽기 → 기존 프로젝트와 겹치면 합치고, 아니면 새 프로젝트 만들기
import { useMemo, useRef, useState } from "react";
import type { DeliveryDocKind, DeliveryItem, DeliveryOrder, Project, ProjectType } from "@/data/sample";
import { resizeImageToBase64 } from "@/lib/imageResize";
import { findDuplicate, suggestProjects, suggestProjectName } from "@/lib/projects/orders";

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
/** 확인 창에서 만든 문서 (id·등록 시각은 저장하는 쪽에서 붙입니다) */
export type DraftOrder = Omit<DeliveryOrder, "id" | "uploadedAt">;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

type Extracted = {
  kind: DeliveryDocKind;
  projectName?: string;
  orderNo: string;
  contractNo: string;
  agency: string;
  site: string;
  date: string;
  dueDate: string;
  items: DeliveryItem[];
  totalQty: number;
  totalAmount: number;
  memo: string;
  confidence: "high" | "medium" | "low";
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    r.readAsDataURL(file);
  });
}

export default function OrderUpload({
  projects,
  userName,
  onCreate,
  onAttach,
}: {
  projects: Project[];
  userName?: string;
  onCreate: (input: { name: string; client?: string; type: ProjectType; order: DraftOrder }) => void;
  onAttach: (projectId: string, order: DraftOrder) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<Extracted | null>(null);
  const [fileName, setFileName] = useState("");

  async function pick(file: File) {
    setError(null);
    setBusy(true);
    try {
      let payload: { file: string; mediaType: string };
      if (file.type === "application/pdf") {
        if (file.size > MAX_PDF_BYTES) throw new Error("PDF 가 8MB 를 넘습니다. 필요한 쪽만 저장해서 올려 주세요.");
        payload = { file: await fileToBase64(file), mediaType: "application/pdf" };
      } else if (file.type.startsWith("image/")) {
        const { base64, mediaType } = await resizeImageToBase64(file, 2000);
        payload = { file: base64, mediaType };
      } else {
        throw new Error("사진(JPG/PNG) 또는 PDF 파일만 올릴 수 있습니다.");
      }
      const res = await fetch("/api/projects/extract-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, fileName: file.name }) });
      const body = (await res.json()) as { doc?: Extracted; error?: string };
      if (!res.ok || !body.doc) throw new Error(body.error ?? "인식에 실패했습니다.");
      setFileName(file.name);
      setDoc(body.doc);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-full border border-line bg-white text-slate-700 text-sm px-4 py-2.5 hover:border-primary hover:text-primary disabled:opacity-60 transition">
        {busy ? "문서 읽는 중..." : "📄 납품요구서 올리기"}
      </button>
      {busy && <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-sm text-white shadow-lg">문서를 읽고 있습니다. 10~20초 걸립니다...</div>}
      {error && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {doc && (
        <ReviewModal
          doc={doc}
          fileName={fileName}
          projects={projects}
          userName={userName}
          onClose={() => setDoc(null)}
          onCreate={(input) => { onCreate(input); setDoc(null); }}
          onAttach={(id, order) => { onAttach(id, order); setDoc(null); }}
        />
      )}
    </>
  );
}

function ReviewModal({
  doc,
  fileName,
  projects,
  userName,
  onClose,
  onCreate,
  onAttach,
}: {
  doc: Extracted;
  fileName: string;
  projects: Project[];
  userName?: string;
  onClose: () => void;
  onCreate: (input: { name: string; client?: string; type: ProjectType; order: DraftOrder }) => void;
  onAttach: (projectId: string, order: DraftOrder) => void;
}) {
  const [head, setHead] = useState({ kind: doc.kind, projectName: doc.projectName ?? "", orderNo: doc.orderNo, contractNo: doc.contractNo, agency: doc.agency, site: doc.site, date: doc.date, dueDate: doc.dueDate, memo: doc.memo });
  const [items, setItems] = useState<DeliveryItem[]>(doc.items);
  const duplicate = useMemo(() => findDuplicate(projects, { orderNo: head.orderNo, kind: head.kind }), [projects, head.orderNo, head.kind]);
  const suggestions = useMemo(() => suggestProjects(projects, head).slice(0, 5), [projects, head]);
  const [target, setTarget] = useState<string>(() => {
    const dup = findDuplicate(projects, { orderNo: doc.orderNo, kind: doc.kind });
    if (dup) return dup.project.id;
    const s = suggestProjects(projects, doc);
    return s.length && s[0].strong ? s[0].project.id : "new";
  });
  const [newName, setNewName] = useState(() => (doc.projectName ?? "").trim() || suggestProjectName(doc));
  const [newType, setNewType] = useState<ProjectType>(doc.kind === "거래명세표" ? "민간" : "관급");

  const totalQty = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const totalAmount = items.reduce((s, i) => s + (Number(i.amount) || 0), 0) || doc.totalAmount || 0;

  function buildOrder(): DraftOrder {
    return {
      kind: head.kind,
      projectName: head.projectName.trim() || undefined,
      orderNo: head.orderNo.trim() || undefined,
      contractNo: head.contractNo.trim() || undefined,
      agency: head.agency.trim() || undefined,
      site: head.site.trim() || undefined,
      date: head.date || undefined,
      dueDate: head.dueDate || undefined,
      items: items.map((i) => ({ ...i, qty: Number(i.qty) || 0, unitPrice: Number(i.unitPrice) || undefined, amount: Number(i.amount) || undefined, spec: i.spec || undefined, unit: i.unit || undefined, note: i.note || undefined })),
      totalQty,
      totalAmount: totalAmount || undefined,
      memo: head.memo.trim() || undefined,
      fileName: fileName || undefined,
      uploadedBy: userName,
    };
  }

  function submit() {
    const order = buildOrder();
    if (target === "new") onCreate({ name: newName.trim() || suggestProjectName(order), client: head.agency.trim() || undefined, type: newType, order });
    else onAttach(target, order);
  }

  const set = (k: keyof typeof head) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setHead({ ...head, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card p-5 md:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">문서 읽기 결과 확인</h2>
            <p className="text-xs text-slate-500">{fileName || "업로드한 문서"} · AI 인식 신뢰도 {doc.confidence === "high" ? "높음" : doc.confidence === "medium" ? "보통" : "낮음 (꼭 확인하세요)"}</p>
          </div>
          {doc.confidence !== "high" && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">숫자와 규격을 원본과 대조해 주세요</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block text-sm sm:col-span-2 lg:col-span-4"><span className="text-slate-600">사업명 <span className="text-slate-400">(새 프로젝트를 만들면 이 이름이 프로젝트명이 됩니다)</span></span>
            <input value={head.projectName} onChange={(e) => { setHead({ ...head, projectName: e.target.value }); setNewName(e.target.value); }} className={inputCls} placeholder="예) ○○지구 농공단지 조성공사" />
          </label>
          <label className="block text-sm"><span className="text-slate-600">문서 종류</span>
            <select value={head.kind} onChange={set("kind")} className={inputCls}>{["분할납품요구서", "납품요구서", "거래명세표", "기타"].map((k) => <option key={k}>{k}</option>)}</select>
          </label>
          <label className="block text-sm"><span className="text-slate-600">문서 번호</span><input value={head.orderNo} onChange={set("orderNo")} className={inputCls} placeholder="납품요구번호" /></label>
          <label className="block text-sm"><span className="text-slate-600">계약번호</span><input value={head.contractNo} onChange={set("contractNo")} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">요구/거래일</span><input type="date" value={head.date} onChange={set("date")} className={inputCls} /></label>
          <label className="block text-sm sm:col-span-2"><span className="text-slate-600">수요기관 / 발주처</span><input value={head.agency} onChange={set("agency")} className={inputCls} /></label>
          <label className="block text-sm sm:col-span-2"><span className="text-slate-600">납품장소 / 현장</span><input value={head.site} onChange={set("site")} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">납품기한</span><input type="date" value={head.dueDate} onChange={set("dueDate")} className={inputCls} /></label>
          <label className="block text-sm sm:col-span-2 lg:col-span-3"><span className="text-slate-600">참고 (담당자·연락처 등)</span><input value={head.memo} onChange={set("memo")} className={inputCls} /></label>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-3 py-2 text-left">품명</th><th className="px-3 py-2 text-left">규격</th><th className="px-3 py-2 text-left w-16">단위</th><th className="px-3 py-2 text-right w-20">수량</th><th className="px-3 py-2 text-right w-28">단가</th><th className="px-3 py-2 text-right w-32">금액</th><th className="px-3 py-2 text-left">비고</th><th className="w-10"></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="px-2 py-1"><input value={it.name} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 hover:border-line focus:border-primary outline-none" /></td>
                  <td className="px-2 py-1"><input value={it.spec ?? ""} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, spec: e.target.value } : x)))} className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 hover:border-line focus:border-primary outline-none" /></td>
                  <td className="px-2 py-1"><input value={it.unit ?? ""} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 hover:border-line focus:border-primary outline-none" /></td>
                  <td className="px-2 py-1"><input type="number" value={it.qty} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-right tabular-nums hover:border-line focus:border-primary outline-none" /></td>
                  <td className="px-2 py-1"><input type="number" value={it.unitPrice ?? 0} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, unitPrice: Number(e.target.value) } : x)))} className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-right tabular-nums hover:border-line focus:border-primary outline-none" /></td>
                  <td className="px-2 py-1"><input type="number" value={it.amount ?? 0} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-right tabular-nums hover:border-line focus:border-primary outline-none" /></td>
                  <td className="px-2 py-1"><input value={it.note ?? ""} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 hover:border-line focus:border-primary outline-none" /></td>
                  <td className="px-1 py-1 text-center"><button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500" title="이 줄 삭제">✕</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 text-sm">
              <tr><td className="px-3 py-2 font-medium text-slate-700" colSpan={3}>합계 · 품목 {items.length}건</td><td className="px-3 py-2 text-right tabular-nums font-semibold">{totalQty.toLocaleString("ko-KR")}</td><td></td><td className="px-3 py-2 text-right tabular-nums font-semibold">{totalAmount ? `${totalAmount.toLocaleString("ko-KR")}원` : "-"}</td><td colSpan={2}></td></tr>
            </tfoot>
          </table>
        </div>
        <button type="button" onClick={() => setItems([...items, { name: "", qty: 0 }])} className="text-xs text-primary hover:underline">＋ 품목 줄 추가</button>

        <div className="rounded-xl border border-line bg-background p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-800">어느 프로젝트에 넣을까요?</div>
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm ${target === "new" ? "border-primary bg-primary-soft/50" : "border-line bg-white hover:border-primary/50"}`}>
            <input type="radio" name="target" checked={target === "new"} onChange={() => setTarget("new")} className="mt-1 accent-primary" />
            <span className="flex-1">
              <span className="font-medium text-slate-800">새 프로젝트로 만들기</span>
              {target === "new" && (
                <span className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary" placeholder="프로젝트명" />
                  <select value={newType} onChange={(e) => setNewType(e.target.value as ProjectType)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
                    <option value="관급">관급</option><option value="민간">민간</option>
                  </select>
                </span>
              )}
            </span>
          </label>
          {duplicate && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              같은 번호({head.orderNo})의 {head.kind}가 이미 「[{duplicate.project.code}] {duplicate.project.name}」에 들어 있습니다. 그 프로젝트를 고르면 기존 문서를 이번 내용으로 <b>바꿔 넣습니다</b>(두 번 세지 않음).
            </div>
          )}
          {suggestions.map((s) => (
            <label key={s.project.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm ${target === s.project.id ? "border-primary bg-primary-soft/50" : "border-line bg-white hover:border-primary/50"}`}>
              <input type="radio" name="target" checked={target === s.project.id} onChange={() => setTarget(s.project.id)} className="mt-1 accent-primary" />
              <span>
                <span className="font-medium text-slate-800">{s.strong ? "★ 사업명 일치 · " : ""}기존 프로젝트에 합치기: [{s.project.code}] {s.project.name}</span>
                <span className="block text-xs text-slate-500">{s.reasons.join(" · ")} · 문서 {(s.project.orders ?? []).length}건 등록됨{s.project.client ? ` · ${s.project.client}` : ""}</span>
              </span>
            </label>
          ))}
          {!suggestions.length && projects.length > 0 && (
            <label className="flex items-center gap-3 text-sm text-slate-600">
              <input type="radio" name="target" checked={target !== "new" && !suggestions.some((s) => s.project.id === target)} onChange={() => setTarget(projects[0].id)} className="accent-primary" />
              다른 프로젝트에 합치기
              <select value={target === "new" ? "" : target} onChange={(e) => setTarget(e.target.value || "new")} className="rounded-xl border border-line bg-white px-3 py-1.5 text-sm">
                <option value="">선택…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>)}
              </select>
            </label>
          )}
          {suggestions.length > 0 && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer">추천에 없는 다른 프로젝트 고르기</summary>
              <select value={suggestions.some((s) => s.project.id === target) || target === "new" ? "" : target} onChange={(e) => e.target.value && setTarget(e.target.value)} className="mt-2 rounded-xl border border-line bg-white px-3 py-1.5 text-sm text-slate-700">
                <option value="">선택…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>)}
              </select>
            </details>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
          <button type="button" onClick={submit} disabled={items.length === 0 || (target === "new" && !newName.trim())} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white">
            {target === "new" ? "새 프로젝트로 등록" : "이 프로젝트에 합치기"}
          </button>
        </div>
      </div>
    </div>
  );
}
