"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { useServerState } from "@/lib/useServerState";
import { menuGroups } from "@/data/menu";
import MenuIcon from "@/components/MenuIcon";
import { themePresets, themeVars, type MenuPrefs } from "@/lib/theme";

type Settings = { theme?: { primary?: string }; menu?: MenuPrefs };

/** 화면 색과 메뉴 순서·숨김을 바꾸는 카드 (시스템 설정) */
export default function AppearanceCard() {
  const router = useRouter();
  const [settings, setSettings, loaded] = useServerState<Settings>("settings", {});
  const [color, setColor] = useState("#171717");
  const [order, setOrder] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const allItems = menuGroups.flatMap((g) => g.items);
  useEffect(() => {
    if (!loaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColor(settings.theme?.primary ?? "#171717");
    const o = settings.menu?.order ?? [];
    setOrder([...o.filter((h) => allItems.some((i) => i.href === h)), ...allItems.map((i) => i.href).filter((h) => !o.includes(h))]);
    setHidden(settings.menu?.hidden ?? []);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = themeVars(color);
  function move(href: string, dir: -1 | 1) {
    setOrder((prev) => { const i = prev.indexOf(href); const j = i + dir; if (i < 0 || j < 0 || j >= prev.length) return prev; const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; return next; });
  }
  function save() {
    setSettings({ ...settings, theme: { primary: color }, menu: { order, hidden } });
    setSaved(true);
    setTimeout(() => { setSaved(false); router.refresh(); }, 800);
  }
  function reset() { setColor("#171717"); setOrder(allItems.map((i) => i.href)); setHidden([]); }

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h2 className="font-bold text-slate-800">화면 색과 메뉴 순서</h2>
        <p className="mt-1 text-xs text-slate-500">대표 색을 고르면 버튼·선택된 메뉴·강조 색이 한꺼번에 바뀝니다. 메뉴는 ▲▼로 순서를 바꾸고, 안 쓰는 메뉴는 숨길 수 있습니다. 저장하면 모든 직원 화면에 적용됩니다.</p>
      </div>
      <div>
        <div className="text-sm text-slate-600">대표 색</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {themePresets.map((p) => (
            <button key={p.color} type="button" onClick={() => setColor(p.color)} title={p.name} className={`h-9 w-9 rounded-full border-2 ${color.toLowerCase() === p.color ? "border-slate-800 scale-110" : "border-white shadow"}`} style={{ background: p.color }} />
          ))}
          <label className="ml-2 inline-flex items-center gap-2 text-sm text-slate-600">직접 고르기 <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-line bg-white" /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-slate-400">미리보기</span>
          <span className="rounded-full px-4 py-1.5 font-semibold text-white" style={{ background: t.primary }}>버튼</span>
          <span className="rounded-full px-4 py-1.5" style={{ background: t.soft, color: t.primary }}>연한 배경</span>
          <span className="rounded-full px-4 py-1.5 font-semibold text-white" style={{ background: t.dark }}>진한 색</span>
        </div>
      </div>
      <div>
        <div className="text-sm text-slate-600">메뉴 순서·숨기기 <span className="text-xs text-slate-400">(묶음 안에서 순서가 바뀝니다. 관리자 메뉴는 고정)</span></div>
        <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {order.map((href) => { const it = allItems.find((i) => i.href === href); if (!it) return null; const off = hidden.includes(href); return (
            <li key={href} className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm ${off ? "border-line bg-slate-50 text-slate-400 line-through" : "border-line bg-white text-slate-700"}`}>
              <MenuIcon href={href} className="h-4 w-4 text-slate-400" /><span className="flex-1 truncate">{it.label}</span>
              <button type="button" onClick={() => move(href, -1)} className="rounded px-1.5 text-slate-500 hover:bg-primary-soft hover:text-primary" title="위로">▲</button>
              <button type="button" onClick={() => move(href, 1)} className="rounded px-1.5 text-slate-500 hover:bg-primary-soft hover:text-primary" title="아래로">▼</button>
              {href !== "/dashboard" && <label className="ml-1 inline-flex items-center gap-1 text-[11px] text-slate-500"><input type="checkbox" checked={!off} onChange={(e) => setHidden((h) => (e.target.checked ? h.filter((x) => x !== href) : [...h, href]))} className="accent-primary" />표시</label>}
            </li>
          ); })}
        </ul>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={save} className="rounded-full bg-primary hover:bg-primary-dark px-6 py-2.5 text-sm font-semibold text-white shadow-sm">저장</button>
        <button type="button" onClick={reset} className="rounded-full border border-line bg-white px-4 py-2.5 text-sm text-slate-600 hover:border-primary">기본으로</button>
        {saved && <span className="text-sm text-green-700">저장했습니다. 새로고침하면 적용됩니다.</span>}
      </div>
    </Card>
  );
}
