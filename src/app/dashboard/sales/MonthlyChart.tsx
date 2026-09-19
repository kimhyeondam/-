"use client";

import { useState } from "react";
import { formatWon, formatWonShort } from "@/lib/format";

/** 월별 매출 막대 그래프 (한 가지 색, 마우스를 올리면 금액 표시) */
export default function MonthlyChart({
  year,
  data,
  selectedMonth,
  onSelectMonth,
  title = "매출",
  labels,
  heading,
  sumLabel = "연간 합계",
}: {
  year: number;
  data: number[];
  selectedMonth: number | null; // 선택된 막대 (1부터), 없으면 null
  onSelectMonth: (m: number | null) => void;
  title?: string;
  labels?: string[]; // 막대 아래 이름 (기본: 1월~12월)
  heading?: string; // 제목 (기본: {year}년 월별 {title} 현황)
  sumLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const names = labels ?? Array.from({ length: data.length }, (_, i) => `${i + 1}월`);
  const cols = `repeat(${data.length}, minmax(0, 1fr))`;
  const rawMax = Math.max(...data, 1);
  // 눈금이 보기 좋은 숫자가 되도록 최대값을 올림 (예: 1.1억 → 1.5억, 2,420만 → 2,500만)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const step = magnitude / 2;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(max * r));

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-bold text-slate-800">{heading ?? `${year}년 월별 ${title} 현황`}</h2>
          <p className="text-xs text-slate-400 mt-0.5">막대를 누르면 그 달의 {title}만 아래 목록에 보입니다. 다시 누르면 해제됩니다.</p>
        </div>
        <div className="text-xs text-slate-500">{sumLabel} <b className="text-slate-800 tabular-nums">{formatWon(data.reduce((a, b) => a + b, 0))}</b></div>
      </div>

      <div className="mt-4 grid grid-cols-[48px_1fr] gap-2">
        {/* y축 눈금 */}
        <div className="relative h-44 text-[11px] text-slate-400">
          {ticks.map((t, i) => (
            <span key={i} className="absolute right-1 -translate-y-1/2" style={{ top: `${100 - i * 25}%` }}>{formatWonShort(t)}</span>
          ))}
        </div>
        <div className="relative h-44">
          {/* 가로 눈금선 */}
          {[0, 25, 50, 75, 100].map((p) => (
            <div key={p} className="absolute left-0 right-0 border-t border-line" style={{ top: `${100 - p}%` }} />
          ))}
          <div className="absolute inset-0 grid gap-1.5 items-end px-1" style={{ gridTemplateColumns: cols }}>
            {data.map((v, i) => {
              const h = (v / max) * 100;
              const active = selectedMonth === i + 1;
              const dim = selectedMonth !== null && !active;
              return (
                <button
                  key={i}
                  onClick={() => onSelectMonth(active ? null : i + 1)}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  className="relative h-full flex items-end justify-center group"
                  aria-label={`${names[i]} ${formatWon(v)}`}
                >
                  {v > 0 && (
                    <span
                      className={`absolute text-[11px] tabular-nums whitespace-nowrap ${active ? "text-primary font-semibold" : "text-slate-500"}`}
                      style={{ bottom: `calc(${h}% + 4px)` }}
                    >
                      {formatWonShort(v)}
                    </span>
                  )}
                  <div
                    className={`w-full max-w-[36px] rounded-t transition ${active ? "bg-primary-dark" : dim ? "bg-primary/30" : "bg-primary group-hover:bg-primary-dark"}`}
                    style={{ height: `${Math.max(h, v > 0 ? 2 : 0)}%` }}
                  />
                  {hover === i && (
                    <div className="absolute bottom-full mb-6 z-10 rounded-lg bg-slate-800 text-white text-xs px-2.5 py-1.5 whitespace-nowrap shadow">
                      {labels ? names[i] : `${year}년 ${i + 1}월`} · {formatWon(v)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[48px_1fr] gap-2 mt-1">
        <div />
        <div className="grid gap-1.5 px-1 text-center text-[11px] text-slate-500" style={{ gridTemplateColumns: cols }}>
          {names.map((n, i) => (
            <span key={i} className={`whitespace-nowrap ${selectedMonth === i + 1 ? "text-primary font-semibold" : ""}`}>
              {labels ? n : <><span className="sm:hidden">{i + 1}</span><span className="hidden sm:inline">{n}</span></>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
