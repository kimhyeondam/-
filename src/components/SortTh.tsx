"use client";

import { useState } from "react";

export type SortState<K extends string> = { key: K; dir: 1 | -1 };

/** 표 정렬 상태와 토글 함수 */
export function useSort<K extends string>(initial: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const toggle = (key: K) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  return { sort, toggle };
}

/** 정렬 비교: 숫자는 숫자로, 글자는 한글 순으로 */
export function compareValues(a: string | number, b: string | number) {
  return typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ko");
}

export default function SortTh<K extends string>({
  label,
  k,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  k: K;
  sort: SortState<K>;
  onSort: (k: K) => void;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <th className={`px-3 py-3 font-medium whitespace-nowrap ${className}`}>
      <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 hover:text-primary ${active ? "text-primary" : ""}`}>
        {label}
        <span className="text-[10px] leading-none">{active ? (sort.dir === 1 ? "▲" : "▼") : "◇"}</span>
      </button>
    </th>
  );
}
