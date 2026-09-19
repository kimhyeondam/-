"use client";

import { useState } from "react";
import type { Worker } from "@/data/sample";
import { newId } from "@/lib/ids";

const inputCls = "w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary";

/** 출근부 직원 추가·정리: 로그인 계정이 없는 현장 인원. 계정이 있는 직원은 관리자 메뉴 「직원관리」에서 옵니다 */
export default function WorkerManager({ workers, loaded, accountNames, onChange, onClose }: { workers: Worker[]; loaded: boolean; accountNames: string[]; onChange: (fn: (prev: Worker[]) => Worker[]) => void; onClose: () => void }) {
  const [draft, setDraft] = useState({ name: "", team: "생산1팀", phone: "" });
  function add() {
    const name = draft.name.trim();
    if (!name || !loaded) return;
    if (accountNames.includes(name) || workers.some((w) => w.name === name)) { alert("같은 이름이 이미 있습니다."); return; }
    onChange((prev) => [...prev, { id: newId("w"), name, team: draft.team.trim() || "현장", phone: draft.phone.trim() || undefined, active: true, joinedAt: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10) }]);
    setDraft({ name: "", team: draft.team, phone: "" });
  }
  const patch = (id: string, p: Partial<Worker>) => { if (loaded) onChange((prev) => prev.map((w) => (w.id === id ? { ...w, ...p } : w))); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-800">출근부 직원 추가</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button></div>
        <p className="text-xs text-slate-500">여기서 추가한 직원은 로그인 계정 없이 출근부·급여 집계·생산일보 작업 인원에 나옵니다. 프로그램에 로그인해야 하는 직원은 관리자 메뉴 「직원관리」에서 계정을 만드세요. 퇴사하면 「재직」을 끄면 목록에서 빠지고 기록은 남습니다.</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-xl border border-line bg-background p-3">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="이름 *" className={inputCls} />
          <input value={draft.team} onChange={(e) => setDraft({ ...draft, team: e.target.value })} placeholder="팀 (예: 생산1팀)" className={inputCls} />
          <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="휴대폰 (선택)" className={inputCls} />
          <button onClick={add} className="rounded-full bg-primary text-white px-4 py-1.5 text-sm font-semibold">추가</button>
        </div>
        {accountNames.length > 0 && <p className="text-xs text-slate-400">계정 있는 직원(직원관리): {accountNames.join(", ")}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-left text-xs text-slate-500"><th className="px-2 py-1">이름</th><th className="px-2 py-1">팀</th><th className="px-2 py-1">휴대폰</th><th className="px-2 py-1">입사일</th><th className="px-2 py-1 w-16 text-center">재직</th><th className="w-10"></th></tr></thead>
            <tbody>
              {workers.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-slate-400">아직 추가한 현장 직원이 없습니다.</td></tr>}
              {workers.map((w) => (
                <tr key={w.id} className={w.active ? "" : "opacity-50"}>
                  <td className="px-2 py-1"><input value={w.name} onChange={(e) => patch(w.id, { name: e.target.value })} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={w.team} onChange={(e) => patch(w.id, { team: e.target.value })} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={w.phone ?? ""} onChange={(e) => patch(w.id, { phone: e.target.value })} className={inputCls} /></td>
                  <td className="px-2 py-1"><input type="date" value={w.joinedAt ?? ""} onChange={(e) => patch(w.id, { joinedAt: e.target.value })} className={inputCls} /></td>
                  <td className="px-2 py-1 text-center"><input type="checkbox" checked={w.active} onChange={(e) => patch(w.id, { active: e.target.checked })} className="accent-primary" /></td>
                  <td className="px-2 py-1 text-center"><button onClick={() => { if (confirm(`${w.name} 님을 목록에서 지울까요? 출근 기록은 남습니다.`)) onChange((prev) => prev.filter((x) => x.id !== w.id)); }} className="text-slate-400 hover:text-red-600">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end"><button onClick={onClose} className="rounded-full bg-primary text-white px-5 py-2 text-sm font-semibold">닫기</button></div>
      </div>
    </div>
  );
}
