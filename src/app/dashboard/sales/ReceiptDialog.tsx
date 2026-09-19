"use client";

// 인수증 사진 보기·추가·삭제 (매출 한 건)
import { useRef, useState } from "react";
import type { Revenue } from "@/data/sample";
import type { Receipt } from "@/lib/receipts";
import { resizeImageToBase64 } from "@/lib/imageResize";

export default function ReceiptDialog({ revenue, receipts, onClose, onChange }: { revenue: Revenue; receipts: Receipt[]; onClose: () => void; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [big, setBig] = useState<Receipt | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function add(file: File) {
    setBusy(true); setErr(null);
    try {
      const { base64 } = await resizeImageToBase64(file, 2000);
      const r = await fetch(`/api/revenues/receipt/${revenue.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: `data:image/jpeg;base64,${base64}` }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "저장하지 못했습니다.");
      onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "저장하지 못했습니다."); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function remove(rc: Receipt) {
    if (!window.confirm("이 인수증 사진을 지울까요?")) return;
    const r = await fetch(`/api/revenues/receipt/${revenue.id}?id=${encodeURIComponent(rc.id)}`, { method: "DELETE" });
    if (r.ok) { if (big?.id === rc.id) setBig(null); onChange(); } else setErr("지우지 못했습니다.");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">인수증 · {revenue.title}</h2>
            <p className="text-xs text-slate-500">{revenue.date ?? ""}{revenue.customer ? ` · ${revenue.customer}` : ""}{revenue.docNumber ? ` · ${revenue.docNumber}` : ""} · 서명 받은 거래명세표 사진 {receipts.length}장</p>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) add(f); }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "올리는 중…" : "📷 사진 추가"}</button>
            <button type="button" onClick={onClose} className="rounded-full border border-line bg-white px-4 py-2 text-sm">닫기</button>
          </div>
        </div>
        {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
        {receipts.length === 0 && <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-slate-400">아직 인수증 사진이 없습니다. 「사진 추가」로 올리거나, 대시보드의 스마트 업로드에 서명본을 올리면 여기에 붙습니다.</div>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {receipts.map((rc) => (
            <figure key={rc.id} className="overflow-hidden rounded-xl border border-line bg-white">
              <button type="button" onClick={() => setBig(rc)} className="block w-full"><img src={rc.url} alt="인수증" className="aspect-[3/4] w-full object-cover" /></button>
              <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-slate-500">
                <span className="truncate">{rc.at.slice(0, 10)}{rc.by ? ` · ${rc.by}` : ""}{rc.note ? ` · ${rc.note}` : ""}</span>
                <button type="button" onClick={() => remove(rc)} className="shrink-0 text-red-600 hover:underline">삭제</button>
              </figcaption>
            </figure>
          ))}
        </div>
        {big && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3" onClick={() => setBig(null)}>
            <img src={big.url} alt="인수증" className="max-h-full max-w-full rounded-lg object-contain" />
            <a href={big.url} download={`인수증_${revenue.title}_${big.at.slice(0, 10)}.jpg`} onClick={(e) => e.stopPropagation()} className="absolute bottom-4 right-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-800">내려받기</a>
          </div>
        )}
      </div>
    </div>
  );
}
