"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { menuGroups, adminMenu, applyMenuPrefs } from "@/data/menu";
import type { MenuPrefs } from "@/lib/theme";
import { logout } from "@/app/login/actions";
import MenuIcon from "@/components/MenuIcon";

/** 휴대폰·태블릿용 상단 바 + 슬라이드 메뉴 (넓은 화면에서는 숨김) */
export default function MobileNav({ user, brand, menuPrefs }: { user: { name: string; role: string }; brand: { name: string; logo?: string; logoMark?: string }; menuPrefs?: MenuPrefs }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 화면을 이동하면 메뉴를 닫습니다.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOpen(false); }, [pathname]);

  const groups = [...applyMenuPrefs(menuGroups, menuPrefs), adminMenu];
  return (
    <div className="md:hidden" data-print-hide>
      <div className="sticky top-0 z-30 flex items-center justify-between bg-card border-b border-line px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          {brand.logo ? <img src={brand.logo} alt={brand.name} className="h-7 object-contain" /> : <span className="font-bold text-slate-800">{brand.name}</span>}
        </Link>
        <button onClick={() => setOpen(true)} aria-label="메뉴 열기" className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-slate-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <nav data-mobile-drawer onClick={(e) => e.stopPropagation()} className="relative ml-auto flex h-full w-[82%] max-w-sm flex-col bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary-soft text-primary flex items-center justify-center text-sm font-bold">{user.name[0]}</div>
                <div><div className="text-sm font-semibold text-slate-800">{user.name}</div><div className="text-xs text-slate-400">{user.role}</div></div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="메뉴 닫기" className="text-2xl leading-none text-slate-400">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {groups.map((g, i) => (
                <div key={i} className="mb-3">
                  {g.title && <div className="px-3 pb-1 text-[11px] font-semibold tracking-widest text-slate-400">{g.title}</div>}
                  <ul>
                    {g.items.map((item) => {
                      const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
                      return (
                        <li key={item.href}>
                          <Link href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${active ? "bg-primary-soft text-slate-900 font-medium" : "text-slate-700 active:bg-primary-soft"}`}>
                            <MenuIcon href={item.href} className={`h-5 w-5 ${active ? "text-slate-900" : "text-slate-400"}`} />{item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <form action={logout} className="border-t border-line p-3">
              <button type="submit" className="w-full rounded-xl border border-line bg-white py-2.5 text-sm text-slate-700">로그아웃</button>
            </form>
          </nav>
        </div>
      )}
    </div>
  );
}
