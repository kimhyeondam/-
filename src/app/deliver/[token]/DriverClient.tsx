"use client";

// 기사님 화면: 로그인 없이 링크로 열어 상차·출발·도착·인수 버튼을 누르고 사진을 올립니다.
import { useEffect, useRef, useState } from "react";
import { dispatchSteps, type DispatchStatus, type QuoteItem } from "@/data/sample";
import { resizeImageToBase64 } from "@/lib/imageResize";

interface View {
  id: string; date: string; customer: string; site?: string; address?: string; contact?: string; items: QuoteItem[]; vehicle: string; driver: string;
  status: DispatchStatus; log: { status: DispatchStatus; at: string; by?: string }[]; photos: { id: string; kind: string; at: string; note?: string; image: string }[]; memo?: string; docNumber?: string;
}

const stepHint: Record<DispatchStatus, string> = { 대기: "상차 전입니다", 상차완료: "제품을 실었습니다. 출발할 때 눌러 주세요", 출발: "현장으로 이동 중", 도착: "현장에 도착했습니다. 하차 후 인수 사진을 올려 주세요", 인수완료: "납품이 끝났습니다. 수고하셨습니다!", 취소: "취소된 배차" };
const nextLabel: Partial<Record<DispatchStatus, string>> = { 대기: "상차 완료", 상차완료: "출발", 출발: "현장 도착", 도착: "인수 완료" };

export default function DriverClient({ token }: { token: string }) {
  const [data, setData] = useState<{ dispatch: View; company: { name: string; phone: string; logo?: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<"상차" | "인수" | "기타">("기타");

  useEffect(() => {
    fetch(`/api/dispatch/public?token=${token}`).then(async (r) => {
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "열 수 없습니다.");
      else setData(j);
    }).catch(() => setError("연결에 실패했습니다. 다시 시도해 주세요."));
  }, [token]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch("/api/dispatch/public", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...body }) });
      const j = await r.json();
      if (!r.ok) { alert(j.error ?? "실패했습니다."); return; }
      setData((prev) => (prev ? { ...prev, dispatch: j.dispatch } : prev));
    } finally { setBusy(false); }
  }
  async function advance() {
    const d = data?.dispatch; if (!d) return;
    const idx = dispatchSteps.indexOf(d.status);
    const next = dispatchSteps[idx + 1]; if (!next) return;
    if ((next === "상차완료" && !d.photos.some((p) => p.kind === "상차")) || (next === "인수완료" && !d.photos.some((p) => p.kind === "인수"))) {
      if (!confirm(`${next === "상차완료" ? "상차" : "인수"} 사진이 아직 없습니다. 사진 없이 진행할까요?`)) return;
    }
    await post({ action: "status", status: next });
  }
  function pickPhoto(kind: "상차" | "인수" | "기타") { pendingKind.current = kind; fileRef.current?.click(); }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { base64 } = await resizeImageToBase64(file, 1280);
      await post({ action: "photo", image: `data:image/jpeg;base64,${base64}`, kind: pendingKind.current, note: note.trim() || undefined });
      setNote("");
    } catch { alert("사진을 읽지 못했습니다. 다시 찍어 주세요."); setBusy(false); }
  }

  if (error) return <Shell><div className="rounded-2xl bg-white p-8 text-center text-slate-600">{error}</div></Shell>;
  if (!data) return <Shell><div className="rounded-2xl bg-white p-8 text-center text-slate-400">불러오는 중…</div></Shell>;
  const d = data.dispatch;
  const stepIdx = dispatchSteps.indexOf(d.status);
  const done = d.status === "인수완료" || d.status === "취소";

  return (
    <Shell>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          {data.company.logo && <img src={data.company.logo} alt="" className="h-9 w-auto" />}
          <div><div className="text-xs text-slate-400">{data.company.name} 납품</div><div className="text-lg font-bold text-slate-800">{d.customer}</div></div>
        </div>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {d.site && <div>📍 <b>{d.site}</b>{d.address ? ` · ${d.address}` : ""}</div>}
          {d.contact && <div>☎ 현장 담당 <a href={`tel:${d.contact.replace(/[^\d]/g, "")}`} className="text-primary underline">{d.contact}</a></div>}
          <div>🚚 {d.vehicle} · {d.driver} 기사님</div>
          <div>📅 {d.date}{d.docNumber ? ` · 거래명세표 ${d.docNumber}` : ""}</div>
        </div>
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {d.items.map((it, i) => <li key={i} className="flex justify-between px-3 py-2 text-sm"><span>{it.name}{it.spec ? <span className="text-slate-400"> {it.spec}</span> : ""}</span><b>{it.qty.toLocaleString("ko-KR")} {it.unit}</b></li>)}
        </ul>
        {d.memo && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">📝 {d.memo}</div>}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          {dispatchSteps.map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-1 text-[11px]">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= stepIdx ? "bg-primary text-white" : "bg-slate-100 text-slate-400"}`}>{i + 1}</div>
              <span className={i <= stepIdx ? "text-primary font-semibold" : "text-slate-400"}>{s}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-sm text-slate-600">{stepHint[d.status]}</p>
        {!done && (
          <button onClick={advance} disabled={busy} className="mt-3 w-full rounded-2xl bg-primary py-4 text-lg font-bold text-white shadow-md active:scale-[0.99] disabled:opacity-50">{busy ? "처리 중…" : `${nextLabel[d.status]} 눌러 주세요`}</button>
        )}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <div className="font-bold text-slate-800">사진 올리기 <span className="text-xs font-normal text-slate-400">({d.photos.length}/8)</span></div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="사진 메모 (선택) 예) 인수자 김반장" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => pickPhoto("상차")} disabled={busy || done} className="rounded-xl border-2 border-primary/40 bg-primary-soft py-3 text-sm font-semibold text-primary disabled:opacity-40">📷 상차 사진</button>
          <button onClick={() => pickPhoto("인수")} disabled={busy || d.status === "취소"} className="rounded-xl border-2 border-green-300 bg-green-50 py-3 text-sm font-semibold text-green-700 disabled:opacity-40">📷 인수 사진</button>
          <button onClick={() => pickPhoto("기타")} disabled={busy || d.status === "취소"} className="rounded-xl border-2 border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-600 disabled:opacity-40">📷 기타</button>
        </div>
        {d.photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {d.photos.map((p) => (
              <figure key={p.id} className="relative overflow-hidden rounded-xl border border-slate-200">
                <img src={p.image.startsWith("/api/") ? `${p.image}?t=${token}` : p.image} alt={p.kind} className="aspect-[4/3] w-full object-cover" />
                <figcaption className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-500"><span>{p.kind} · {p.at.slice(11, 16)}{p.note ? ` · ${p.note}` : ""}</span>{!done && <button onClick={() => { if (confirm("이 사진을 지울까요?")) post({ action: "removePhoto", photoId: p.id }); }} className="text-red-500">삭제</button>}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      {d.log.length > 1 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="font-bold text-slate-800">기록</div>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">{d.log.map((l, i) => <li key={i}>{l.at.slice(5, 16).replace("T", " ")} · {l.status}{l.by ? ` (${l.by})` : ""}</li>)}</ul>
        </div>
      )}
      <p className="text-center text-xs text-slate-400">문의: {data.company.name} <a href={`tel:${data.company.phone.replace(/[^\d]/g, "")}`} className="underline">{data.company.phone}</a></p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-md min-h-screen space-y-3 bg-background p-3 pb-10">{children}</main>;
}
