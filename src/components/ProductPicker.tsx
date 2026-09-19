"use client";

// 품목 검색 입력칸: 몇 글자만 치면 품명·규격·분류에서 찾아 목록을 보여 주고, 고르면 onPick 으로 알려 줍니다.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/data/sample";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

export function searchProducts(products: Product[], query: string, limit = 40): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products.slice(0, limit);
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = products
    .map((p) => {
      const hay = `${p.name} ${p.spec ?? ""} ${p.category ?? ""} ${(p.aliases ?? []).join(" ")}`.toLowerCase();
      const compact = norm(hay);
      if (!tokens.every((t) => hay.includes(t) || compact.includes(norm(t)))) return null;
      const score = (norm(p.name).startsWith(norm(q)) ? 3 : 0) + (norm(p.name).includes(norm(q)) ? 2 : 0) + (p.basePrice ? 1 : 0);
      return { p, score };
    })
    .filter((x): x is { p: Product; score: number } => !!x)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name, "ko"));
  return scored.slice(0, limit).map((x) => x.p);
}

export default function ProductPicker({ products, value, onChange, onPick, placeholder, className, autoFocus, disabled }: { products: Product[]; value: string; onChange: (text: string) => void; onPick: (p: Product) => void; placeholder?: string; className?: string; autoFocus?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useMemo(() => (open ? searchProducts(products, value) : []), [products, value, open]);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  function pick(p: Product) { onPick(p); setOpen(false); }
  return (
    <div ref={box} className="relative">
      <input
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setIdx(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || list.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, list.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(list[idx]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder ?? "품명 몇 글자 (예: 벤치 300, 원형 1호 하부)"}
        className={className}
        autoComplete="off"
      />
      {open && list.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full min-w-[20rem] overflow-y-auto rounded-xl border border-line bg-white shadow-lg text-sm">
          {list.map((p, i) => (
            <li key={p.id}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(p); }} className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left ${i === idx ? "bg-primary-soft" : "hover:bg-slate-50"}`}>
                <span className="min-w-0"><span className="text-slate-800">{p.name}</span>{p.spec && <span className="ml-1 text-xs text-slate-400">{p.spec}</span>}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{p.category ?? ""} · {p.unit}{p.basePrice ? ` · ${p.basePrice.toLocaleString("ko-KR")}원` : ""}</span>
              </button>
            </li>
          ))}
          {list.length >= 40 && <li className="px-3 py-1 text-[11px] text-slate-400">더 있습니다. 글자를 더 입력해 좁혀 보세요.</li>}
        </ul>
      )}
      {open && list.length === 0 && products.length === 0 && <div className="absolute z-30 mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">등록된 품목이 없습니다. 재고관리 → 「카탈로그 품목 불러오기」를 먼저 눌러 주세요.</div>}
    </div>
  );
}
