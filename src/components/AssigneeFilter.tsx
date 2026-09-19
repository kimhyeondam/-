"use client";

import { useState } from "react";
import { useMembers } from "@/lib/useMembers";
import { Card } from "@/components/Card";

export type AssigneeFilterValue = "all" | "unassigned" | string;

export default function AssigneeFilter({
  value,
  onChange,
  total,
  unassigned,
  counts,
  showTeam = false,
}: {
  value: AssigneeFilterValue;
  onChange: (v: AssigneeFilterValue) => void;
  total: number;
  unassigned: number;
  counts: Map<string, number>;
  showTeam?: boolean;
}) {
  const members = useMembers();
  const [open, setOpen] = useState(false); // 휴대폰에서는 접어 두고, 누르면 펼칩니다
  const current = value === "all" ? "전체" : value === "unassigned" ? "미배정" : value;
  return (
    <Card className="p-3 lg:p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="lg:hidden flex w-full items-center justify-between gap-2 text-sm" aria-expanded={open}>
        <span className="inline-flex items-center gap-2"><span className="rounded-full bg-primary-soft text-primary text-xs font-semibold px-3 py-1">▽ 담당자 필터</span><span className="font-semibold text-slate-800">{current}</span></span>
        <span className="text-slate-400">{open ? "접기 ▴" : "바꾸기 ▾"}</span>
      </button>
      <div className={`${open ? "block mt-3" : "hidden"} lg:block`}>
      <span className="hidden lg:inline-block rounded-full bg-primary-soft text-primary text-xs font-semibold px-3 py-1">▽ 담당자 필터</span>
      <div className="hidden lg:block mt-3 text-sm font-semibold text-slate-800">표시 대상을 빠르게 좁혀보세요.</div>
      <p className="hidden lg:block mt-1 text-xs text-slate-400 leading-relaxed">전체, 미배정, 특정 담당자 기준으로 화면에 보이는 데이터만 정리합니다.</p>

      <ul className="mt-2 lg:mt-4 space-y-1">
        <FilterRow label="전체" n={total} active={value === "all"} onClick={() => { onChange("all"); setOpen(false); }} />
        <FilterRow label="미배정" n={unassigned} active={value === "unassigned"} onClick={() => { onChange("unassigned"); setOpen(false); }} />
      </ul>
      <div className="mt-4 mb-2 text-[11px] font-semibold tracking-widest text-slate-400">☺ TEAM</div>
      <ul className="space-y-1.5">
        {members.map((m) => (
          <FilterRow
            key={m.id}
            label={m.name}
            sub={showTeam ? m.team : undefined}
            n={counts.get(m.name) ?? 0}
            active={value === m.name}
            boxed
            onClick={() => { onChange(m.name); setOpen(false); }}
          />
        ))}
      </ul>
      </div>
    </Card>
  );
}

function FilterRow({ label, sub, n, active, boxed = false, onClick }: { label: string; sub?: string; n: number; active: boolean; boxed?: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
          active ? "bg-primary text-white font-semibold" : boxed ? "border border-line bg-white text-slate-700 hover:border-primary" : "text-slate-700 hover:bg-primary-soft"
        }`}
      >
        <span className="text-left">
          {label}
          {sub && <span className={`block text-[11px] font-normal ${active ? "text-white/70" : "text-slate-400"}`}>{sub}</span>}
        </span>
        <span className={`text-xs rounded-full px-1.5 ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{n}</span>
      </button>
    </li>
  );
}
