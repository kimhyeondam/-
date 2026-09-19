"use client";

import { useEffect, useState } from "react";
import type { Member } from "@/data/sample";

let cache: Member[] | null = null;

/** 담당자 선택에 쓰는 활성 직원 목록 (직원관리에서 관리) */
export function useMembers() {
  const [members, setMembers] = useState<Member[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    fetch("/api/members")
      .then((r) => r.json())
      .then((d: { members?: Member[] }) => {
        cache = d.members ?? [];
        setMembers(cache);
      })
      .catch(() => {});
  }, []);
  return members;
}

/** 직원관리에서 바뀌면 다시 불러오도록 */
export function invalidateMembers() {
  cache = null;
}
