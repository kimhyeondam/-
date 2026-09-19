"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";

type Info = { counts: Record<string, { sample: number; mine: number }>; labels: Record<string, string>; snapshots: { file: string; at: string; size: number }[] };

/** 예시 데이터 지우기: 예시만 지우는 것이 기본이고, 어떤 경우든 되돌릴 수 있습니다 */
export default function ResetSampleCard() {
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [confirm, setConfirm] = useState("");
  const [keepTemplates, setKeepTemplates] = useState(true);
  const [mode, setMode] = useState<"sample" | "all">("sample");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function load() { fetch("/api/admin/reset-sample").then((r) => (r.ok ? r.json() : null)).then((d) => d && setInfo(d)).catch(() => {}); }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const rows = info ? Object.entries(info.counts).filter(([k, n]) => (n.sample > 0 || n.mine > 0) && !(keepTemplates && k === "contractTemplates")) : [];
  const sampleTotal = rows.reduce((s, [, n]) => s + n.sample, 0);
  const mineTotal = rows.reduce((s, [, n]) => s + n.mine, 0);
  const word = mode === "all" ? "전체삭제" : "지우기";

  async function run() {
    if (confirm !== word) return;
    if (mode === "all" && !window.confirm(`직접 입력한 ${mineTotal}건까지 모두 지웁니다. 되돌리기는 가능하지만 정말 진행할까요?`)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/reset-sample", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm, keepTemplates, mode }) });
      const d = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? "실패했습니다." }); return; }
      const removed = Object.values(d.result as Record<string, { removed: number }>).reduce((s, r) => s + r.removed, 0);
      setMsg({ ok: true, text: `${removed}건을 지웠습니다. 실수라면 아래 「되돌리기」로 방금 상태로 복구할 수 있습니다.` });
      setConfirm(""); load(); router.refresh();
    } finally { setBusy(false); }
  }
  async function undo(file: string) {
    if (!window.confirm(`${file.replace("reset-", "").replace(".json", "").replace("T", " ")} 시점으로 되돌릴까요? 그 뒤에 입력한 내용은 사라집니다.`)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/reset-sample", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "undo", file }) });
      const d = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? "실패했습니다." }); return; }
      setMsg({ ok: true, text: `${d.restored}건을 되돌렸습니다.` });
      load(); router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <Card className="p-6 space-y-4 border-red-200">
      <div>
        <h2 className="font-bold text-slate-800">예시 데이터 지우기</h2>
        <p className="mt-1 text-xs text-slate-500">처음 설치 때 들어 있던 예시(○○건설, 흄관 D600 예시 매출 등)만 지웁니다. <b>직접 입력한 기록은 남습니다.</b> 지우기 전 상태는 자동으로 저장되어 언제든 되돌릴 수 있습니다.</p>
      </div>
      {info && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500"><th className="py-1 pr-3 font-medium">메뉴</th><th className="py-1 pr-3 font-medium text-right">예시</th><th className="py-1 font-medium text-right">직접 입력</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map(([k, n]) => <tr key={k}><td className="py-1 pr-3 text-slate-700">{info.labels[k] ?? k}</td><td className={`py-1 pr-3 text-right tabular-nums ${n.sample ? "text-red-600" : "text-slate-300"}`}>{n.sample}</td><td className={`py-1 text-right tabular-nums ${n.mine ? "text-green-700 font-semibold" : "text-slate-300"}`}>{n.mine}</td></tr>)}
              {rows.length === 0 && <tr><td colSpan={3} className="py-2 text-slate-400">데이터가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-1 rounded-full border border-line p-1 w-fit text-sm">
        <button type="button" onClick={() => { setMode("sample"); setConfirm(""); }} className={`rounded-full px-4 py-1.5 ${mode === "sample" ? "bg-primary text-white font-semibold" : "text-slate-600"}`}>예시만 지우기 ({sampleTotal}건)</button>
        <button type="button" onClick={() => { setMode("all"); setConfirm(""); }} className={`rounded-full px-4 py-1.5 ${mode === "all" ? "bg-red-600 text-white font-semibold" : "text-slate-600"}`}>전부 지우기 ({sampleTotal + mineTotal}건)</button>
      </div>
      {mode === "all" && <p className="text-xs text-red-600">직접 입력한 {mineTotal}건까지 모두 지워집니다. 회사를 처음부터 다시 세팅할 때만 쓰세요.</p>}
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={keepTemplates} onChange={(e) => setKeepTemplates(e.target.checked)} className="accent-primary" /> 계약 템플릿(납품계약서 등 양식)은 남겨 두기</label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm"><span className="text-slate-600">확인 문구 「{word}」를 입력</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={word} className="mt-1 w-full max-w-xs rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-red-400" /></label>
        <button type="button" onClick={run} disabled={busy || confirm !== word} className={`rounded-full disabled:opacity-40 px-5 py-2 text-sm font-semibold text-white ${mode === "all" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary-dark"}`}>{busy ? "처리 중…" : word}</button>
      </div>
      {msg && <div className={`rounded-xl border px-4 py-2 text-sm ${msg.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>{msg.text}</div>}
      {info && info.snapshots.length > 0 && (
        <div className="rounded-xl border border-line bg-background p-3">
          <div className="text-sm font-semibold text-slate-800">되돌리기</div>
          <p className="text-[11px] text-slate-400">지우기를 실행할 때마다 직전 상태가 저장됩니다(최근 10개). 누르면 그 시점으로 돌아갑니다.</p>
          <ul className="mt-2 space-y-1">
            {info.snapshots.map((s) => (
              <li key={s.file} className="flex items-center justify-between gap-2 text-sm"><span className="text-slate-700">{s.file.replace("reset-", "").replace(".json", "").replace("T", " ").replace(/-(\d\d)-(\d\d)$/, ":$1:$2")} <span className="text-xs text-slate-400">({Math.round(s.size / 1024)}KB)</span></span><button type="button" disabled={busy} onClick={() => undo(s.file)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-700 hover:border-primary hover:text-primary">이 시점으로 되돌리기</button></li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
