"use client";

// 생산품목 타일을 누르면 아래 규격 목록에서 그 분류가 펼쳐지고 그리로 이동합니다
import { useEffect } from "react";

export default function OpenOnHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) { el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
