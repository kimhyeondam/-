// 메뉴 아이콘: 글자 기호 대신 선으로 그린 아이콘 (24px 격자, 굵기 1.8)
const P: Record<string, string> = {
  "/dashboard": "M4 5a1 1 0 011-1h5v7H4V5zM14 4h5a1 1 0 011 1v3h-6V4zM14 11h6v8a1 1 0 01-1 1h-5v-9zM4 14h6v6H5a1 1 0 01-1-1v-5z",
  "/dashboard/bids": "M12 3l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9L8.4 14l.7-4L6.2 7.2l4-.6L12 3zM5 20h14",
  "/dashboard/leads": "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0M19 8l2 2 2-2",
  "/dashboard/customers": "M3 21V7l6-3v17M9 21V10l6-2v13M15 21V12l6-2v11M3 21h18",
  "/dashboard/projects": "M3 7h6l2 2h10v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7z",
  "/dashboard/dispatch": "M3 7h11v9H3zM14 10h4l3 3v3h-7zM6 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  "/dashboard/production": "M4 20V9l5 4V9l5 4V9l6 4v7H4zM7 5h4",
  "/dashboard/inventory": "M3 8l9-4 9 4v9l-9 4-9-4V8zM3 8l9 4 9-4M12 12v9",
  "/dashboard/materials": "M4 7h16v12H4zM4 11h16M9 7v12M15 7v12",
  "/dashboard/quality": "M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3zM9 12l2 2 4-4",
  "/dashboard/attendance": "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  "/dashboard/tasks": "M4 6h16M4 12h16M4 18h10M18 16l2 2 3-3",
  "/dashboard/schedule": "M4 5h16v15H4zM4 10h16M8 3v4M16 3v4",
  "/dashboard/meetings": "M4 5h16v11H8l-4 4V5zM8 9h8M8 12h5",
  "/dashboard/mail": "M3 6h18v12H3zM3 7l9 6 9-6",
  "/dashboard/business-cards": "M3 6h18v12H3zM6 10h5M6 13h4M15 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM13 16c0-1.5 1-2 2-2s2 .5 2 2",
  "/dashboard/documents": "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
  "/dashboard/resource-library": "M4 4h5l2 2h9v13H4zM4 9h16",
  "/dashboard/sales": "M4 19V5M4 19h16M8 15l4-5 3 3 5-6",
  "/dashboard/purchases": "M3 4h2l2 12h11l2-8H6M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z",
  "/dashboard/payments": "M3 7h18v10H3zM3 11h18M7 15h3",
  "/dashboard/quotes": "M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6",
  "/dashboard/pricing": "M6 6l12 12M8 6a2 2 0 100 4 2 2 0 000-4zM16 14a2 2 0 100 4 2 2 0 000-4z",
  "/dashboard/report": "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4",
  "/dashboard/logs": "M4 6h16M4 10h16M4 14h10M4 18h6",
  "/dashboard/suggestions": "M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.4.9.8 1 1.4l.1.7h4.8l.1-.7c.1-.6.4-1 1-1.4A6 6 0 0012 3z",
  "/dashboard/admin/usage": "M4 19h16M6 16V9M10 16V5M14 16v-6M18 16v-3",
  "/dashboard/admin/contracts": "M6 3h12v18H6zM9 8h6M9 12h6M9 16h3M14 17l2 2 3-3",
  "/dashboard/admin/contract-templates": "M6 3h12v18H6zM6 8h12M10 12h4M10 16h4",
  "/dashboard/admin/payroll": "M12 3v18M8 7h6a2.5 2.5 0 010 5H9a2.5 2.5 0 000 5h7",
  "/dashboard/admin/employees": "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M16 11a3 3 0 100-6M21 20a6 6 0 00-5-5.9",
  "/dashboard/admin/settings": "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
};

export default function MenuIcon({ href, className = "h-[18px] w-[18px]" }: { href: string; className?: string }) {
  const d = P[href] ?? "M4 4h16v16H4z";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
