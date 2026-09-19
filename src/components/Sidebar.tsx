"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { company } from "@/data/sample";
import { menuGroups, adminMenu, applyMenuPrefs, type MenuGroup } from "@/data/menu";
import type { MenuPrefs } from "@/lib/theme";
import { logout } from "@/app/login/actions";
import MenuIcon from "@/components/MenuIcon";

function Group({ group, pathname, collapsed }: { group: MenuGroup; pathname: string; collapsed: boolean }) {
  return (
    <div className="mb-3">
      {group.title && !collapsed && (
        <div className="px-3 pb-1 pt-1 font-mono text-[12px] leading-4 text-slate-400">{group.title}</div>
      )}
      {group.title && collapsed && <div className="mx-3 my-2 border-t border-line" />}
      <ul className="space-y-px">
        {group.items.map((item) => {
          const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={item.label}
                className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary-soft text-slate-900 font-medium"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                {active && <span aria-hidden className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
                <MenuIcon href={item.href} className={`h-[18px] w-[18px] ${active ? "text-slate-900" : "text-slate-400 group-hover:text-slate-900"}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Sidebar({ user, brand, menuPrefs }: { user: { name: string; role: string }; brand?: { name: string; logo?: string; logoMark?: string }; menuPrefs?: MenuPrefs }) {
  const groups = applyMenuPrefs(menuGroups, menuPrefs);
  const name = brand?.name ?? company.name;
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden md:flex shrink-0 flex-col m-4 mr-0 rounded-2xl bg-card border border-line shadow-card transition-all ${
        collapsed ? "w-[76px]" : "w-60"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-4 border-b border-line">
        {collapsed ? (
          brand?.logoMark ? <img src={brand.logoMark} alt={name} className="h-10 w-10 shrink-0 object-contain" /> : <div className="h-10 w-10 shrink-0 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold">{name[0]}</div>
        ) : brand?.logo ? (
          <img src={brand.logo} alt={name} className="h-10 flex-1 min-w-0 object-contain object-left" />
        ) : (
          <>
            <div className="h-10 w-10 shrink-0 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold">{name[0]}</div>
            <div className="flex-1 font-bold text-slate-800 truncate">{name}</div>
          </>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-slate-400 hover:border-primary hover:text-primary"
          aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`}><path d="M15 6l-6 6 6 6" /></svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 thin-scroll">
        {groups.map((g, i) => (
          <Group key={i} group={g} pathname={pathname} collapsed={collapsed} />
        ))}
        <div className="mt-5">
          <Group group={adminMenu} pathname={pathname} collapsed={collapsed} />
        </div>
      </nav>

      <div className="flex items-center gap-3 px-4 py-3 border-t border-line">
        <div className="h-8 w-8 shrink-0 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-bold">
          {user.name[0]}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-800 truncate">{user.name}</div>
            <div className="text-xs text-slate-400">{user.role}</div>
          </div>
        )}
        <form action={logout}>
          <button type="submit" title="로그아웃" className="text-xs text-slate-400 hover:text-primary">
            {collapsed ? "⏻" : "로그아웃"}
          </button>
        </form>
      </div>
    </aside>
  );
}
