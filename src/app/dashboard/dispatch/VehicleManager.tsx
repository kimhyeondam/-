"use client";

import { useState } from "react";
import type { Vehicle } from "@/data/sample";
import { newId } from "@/lib/ids";

const inputCls = "w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary";

/** 차량·기사 목록 (배차 등록 때 골라 쓰는 명단) */
export default function VehicleManager({ vehicles, loaded, onChange, onClose }: { vehicles: Vehicle[]; loaded: boolean; onChange: (fn: (prev: Vehicle[]) => Vehicle[]) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Vehicle>({ id: "", plate: "", name: "", driver: "", driverPhone: "", own: true });
  function add() {
    if (!draft.plate.trim() || !loaded) return;
    onChange((prev) => [...prev, { ...draft, id: newId("v"), plate: draft.plate.trim(), name: draft.name?.trim() || undefined, driver: draft.driver?.trim() || undefined, driverPhone: draft.driverPhone?.trim() || undefined }]);
    setDraft({ id: "", plate: "", name: "", driver: "", driverPhone: "", own: true });
  }
  function patch(id: string, p: Partial<Vehicle>) { if (loaded) onChange((prev) => prev.map((v) => (v.id === id ? { ...v, ...p } : v))); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-800">차량·기사 관리</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button></div>
        <p className="text-xs text-slate-500">자차와 자주 쓰는 용차를 등록해 두면 배차 등록 때 한 번에 고를 수 있습니다. 칸을 고치면 바로 저장됩니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead><tr className="text-left text-xs text-slate-500"><th className="px-2 py-1">차량번호</th><th className="px-2 py-1">차종</th><th className="px-2 py-1">기사</th><th className="px-2 py-1">휴대폰</th><th className="px-2 py-1 w-16">용차</th><th className="w-10"></th></tr></thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td className="px-2 py-1"><input value={v.plate} onChange={(e) => patch(v.id, { plate: e.target.value })} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={v.name ?? ""} onChange={(e) => patch(v.id, { name: e.target.value })} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={v.driver ?? ""} onChange={(e) => patch(v.id, { driver: e.target.value })} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={v.driverPhone ?? ""} onChange={(e) => patch(v.id, { driverPhone: e.target.value })} className={inputCls} /></td>
                  <td className="px-2 py-1 text-center"><input type="checkbox" checked={!v.own} onChange={(e) => patch(v.id, { own: !e.target.checked })} className="accent-primary" /></td>
                  <td className="px-2 py-1 text-center"><button onClick={() => { if (confirm(`${v.plate} 차량을 지울까요?`)) onChange((prev) => prev.filter((x) => x.id !== v.id)); }} className="text-slate-400 hover:text-red-600">×</button></td>
                </tr>
              ))}
              <tr className="bg-background">
                <td className="px-2 py-1"><input value={draft.plate} onChange={(e) => setDraft({ ...draft, plate: e.target.value })} placeholder="전남 81바 1234" className={inputCls} /></td>
                <td className="px-2 py-1"><input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="5톤 카고" className={inputCls} /></td>
                <td className="px-2 py-1"><input value={draft.driver ?? ""} onChange={(e) => setDraft({ ...draft, driver: e.target.value })} placeholder="기사" className={inputCls} /></td>
                <td className="px-2 py-1"><input value={draft.driverPhone ?? ""} onChange={(e) => setDraft({ ...draft, driverPhone: e.target.value })} placeholder="010-" className={inputCls} /></td>
                <td className="px-2 py-1 text-center"><input type="checkbox" checked={!draft.own} onChange={(e) => setDraft({ ...draft, own: !e.target.checked })} className="accent-primary" /></td>
                <td className="px-2 py-1 text-center"><button onClick={add} className="rounded-full bg-primary text-white px-2 py-1 text-xs">추가</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-end"><button onClick={onClose} className="rounded-full bg-primary text-white px-5 py-2 text-sm font-semibold">닫기</button></div>
      </div>
    </div>
  );
}
