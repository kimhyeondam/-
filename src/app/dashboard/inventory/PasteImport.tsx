"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/data/sample";

type Row = Omit<Product, "id" | "createdAt">;

/** 엑셀에서 복사한 표를 붙여 넣어 품목을 한꺼번에 등록합니다. 열 순서: 품명 · 규격 · 단위 · 분류 · 안전재고 · 기준단가 */
export default function PasteImport({ onSubmit, onCancel }: { onSubmit: (rows: Row[]) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const rows = useMemo<Row[]>(() => {
    return text.split(/\r?\n/).map((l) => l.split("\t").map((c) => c.trim())).filter((c) => c[0] && !/^품명|^품목명|^name$/i.test(c[0])).map((c) => ({
      name: c[0], spec: c[1] || undefined, unit: c[2] || "EA", category: c[3] || "기타", safetyStock: Number(c[4]) || 0, basePrice: Number((c[5] ?? "").replace(/[^\d.]/g, "")) || undefined,
    }));
  }, [text]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">엑셀 붙여넣기로 품목 등록</h2>
        <p className="text-xs text-slate-500">엑셀에서 <b>품명 · 규격 · 단위 · 분류 · 안전재고 · 기준단가</b> 순서로 된 표를 복사(Ctrl+C)해서 아래 칸에 붙여 넣으세요(Ctrl+V). 품명만 있어도 됩니다. 제목 줄은 자동으로 건너뜁니다.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={"흄관 D600\tL=2,500\t본\t흄관\t40\t185000\n도로 경계석\t150*200*1000\t본\t경계석\t300\t9500"} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-mono outline-none focus:border-primary" />
        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-xs"><thead><tr className="text-left text-slate-500 bg-background"><th className="px-2 py-1">품명</th><th className="px-2 py-1">규격</th><th className="px-2 py-1">단위</th><th className="px-2 py-1">분류</th><th className="px-2 py-1 text-right">안전재고</th><th className="px-2 py-1 text-right">기준단가</th></tr></thead>
              <tbody className="divide-y divide-line">{rows.slice(0, 50).map((r, i) => <tr key={i}><td className="px-2 py-1">{r.name}</td><td className="px-2 py-1 text-slate-500">{r.spec ?? "-"}</td><td className="px-2 py-1">{r.unit}</td><td className="px-2 py-1">{r.category}</td><td className="px-2 py-1 text-right">{r.safetyStock}</td><td className="px-2 py-1 text-right">{r.basePrice?.toLocaleString("ko-KR") ?? "-"}</td></tr>)}</tbody>
            </table>
            {rows.length > 50 && <div className="px-2 py-1 text-[11px] text-slate-400">… 외 {rows.length - 50}개</div>}
          </div>
        )}
        <div className="flex justify-end gap-2"><button onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">취소</button><button onClick={() => onSubmit(rows)} disabled={rows.length === 0} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-sm font-semibold px-5 py-2">{rows.length}개 등록</button></div>
      </div>
    </div>
  );
}
