// 왼쪽 메뉴 정의. 사이드바와 "준비 중" 화면이 함께 사용합니다.

export interface MenuItem {
  href: string;
  label: string;
  icon: string; // 간단한 기호 아이콘 (추후 아이콘 라이브러리로 교체 가능)
  description: string; // 준비 중 화면에 표시되는 설명
}

export interface MenuGroup {
  title?: string;
  items: MenuItem[];
}

export const menuGroups: MenuGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "대시보드", icon: "▦", description: "오늘의 업무 현황을 한눈에 봅니다." },
    ],
  },
  {
    title: "영업",
    items: [
      { href: "/dashboard/bids", label: "관급 발주", icon: "◎", description: "나라장터의 우리 지역 지자체 입찰공고를 지역별·발주 방식별로 모아 봅니다." },
      { href: "/dashboard/leads", label: "리드관리", icon: "☺", description: "문의가 들어온 잠재 고객(리드)을 등록하고 단계별로 관리합니다." },
      { href: "/dashboard/customers", label: "고객관리", icon: "▣", description: "거래처(건설사, 관공서 등) 정보와 담당자 연락처를 관리합니다." },
      { href: "/dashboard/projects", label: "프로젝트관리", icon: "▭", description: "현장(공사)별 납품 프로젝트의 진행률과 납기를 관리합니다." },
    ],
  },
  {
    title: "생산",
    items: [
      { href: "/dashboard/dispatch", label: "배차·출고", icon: "🚚", description: "차량별 납품 배차를 만들고 기사님 링크로 상차·도착·인수 사진을 받습니다." },
      { href: "/dashboard/production", label: "생산일보", icon: "⚒", description: "하루 생산량과 불량, 작업 인원을 기록하면 재고에 자동으로 입고됩니다." },
      { href: "/dashboard/inventory", label: "재고관리", icon: "▦", description: "제품별 현재고와 입출고 내역을 관리하고 안전재고 이하를 경고합니다." },
      { href: "/dashboard/materials", label: "원자재 재고", icon: "▩", description: "시멘트·골재·자갈·혼화재·철망 재고. 매입은 자동 입고, 생산일보는 배합대로 자동 소진됩니다." },
      { href: "/dashboard/quality", label: "품질관리", icon: "✓", description: "배치별 강도 시험 결과와 자체 시험성적서를 기록·보관합니다." },
      { href: "/dashboard/attendance", label: "직원출근부", icon: "◷", description: "직원별 출근·휴가·결근을 달력 표로 기록하고 월별로 집계합니다." },
    ],
  },
  {
    title: "할 일",
    items: [
      { href: "/dashboard/tasks", label: "할일관리", icon: "☑", description: "할 일을 '할 일 → 진행 중 → 완료' 칸반 보드로 관리합니다." },
      { href: "/dashboard/schedule", label: "일정관리", icon: "▤", description: "납품·생산·회의 일정을 달력으로 관리합니다." },
      { href: "/dashboard/meetings", label: "미팅관리", icon: "♪", description: "회의록과 미팅 결과를 기록합니다." },
      { href: "/dashboard/mail", label: "메일관리", icon: "✉", description: "거래처와 주고받은 메일을 정리합니다." },
      { href: "/dashboard/business-cards", label: "명함관리", icon: "▬", description: "받은 명함을 등록하고 검색합니다." },
      { href: "/dashboard/documents", label: "양식 문서 작성", icon: "✎", description: "견적서, 거래명세서, 납품확인서 등 양식 문서를 작성합니다." },
      { href: "/dashboard/resource-library", label: "자료실", icon: "▥", description: "업무 자료를 게시판 형태로 관리합니다." },
    ],
  },
  {
    title: "재무",
    items: [
      { href: "/dashboard/sales", label: "매출관리", icon: "$", description: "월별·거래처별 매출을 관리합니다." },
      { href: "/dashboard/purchases", label: "매입관리", icon: "▽", description: "원자재·운반·외주 매입과 미지급금을 관리합니다." },
      { href: "/dashboard/payments", label: "입금관리", icon: "▮", description: "세금계산서 발행과 입금 여부를 확인합니다." },
      { href: "/dashboard/quotes", label: "견적관리", icon: "▤", description: "발송한 견적서와 수주 여부를 관리합니다." },
      { href: "/dashboard/pricing", label: "단가표", icon: "%", description: "품목 기준 단가와 거래처별 적용률(%)을 정합니다. 매출 등록 때 단가가 자동으로 들어갑니다." },
    ],
  },
  {
    title: "시스템",
    items: [
      { href: "/dashboard/report", label: "월간 보고", icon: "▣", description: "매출·입금·매입·생산·재고·출근·배차·품질을 한 장으로 보고 인쇄합니다." },
      { href: "/dashboard/logs", label: "로그", icon: "≡", description: "누가 언제 무엇을 변경했는지 기록을 봅니다." },
      { href: "/dashboard/suggestions", label: "건의사항", icon: "◇", description: "직원들의 건의사항을 접수합니다." },
    ],
  },
];

export const adminMenu: MenuGroup = {
  title: "관리자 메뉴",
  items: [
    { href: "/dashboard/admin/usage", label: "AI 비서 사용량", icon: "▁", description: "AI 비서 사용량을 확인합니다." },
    { href: "/dashboard/admin/contracts", label: "계약관리", icon: "▯", description: "거래처와의 계약서를 관리합니다." },
    { href: "/dashboard/admin/contract-templates", label: "계약 템플릿", icon: "▤", description: "자주 쓰는 계약서 양식을 관리합니다." },
    { href: "/dashboard/admin/payroll", label: "급여 집계", icon: "₩", description: "출근부의 출근일·연장시간으로 월 급여 집계표를 만듭니다." },
    { href: "/dashboard/admin/employees", label: "직원관리", icon: "☺", description: "직원 계정과 권한을 관리합니다." },
    { href: "/dashboard/admin/settings", label: "시스템 설정", icon: "⚙", description: "회사 정보, 로고, 기본 설정을 변경합니다." },
  ],
};

export function findMenuItem(href: string): MenuItem | undefined {
  const all = [...menuGroups, adminMenu].flatMap((g) => g.items);
  return all.find((m) => m.href === href);
}

/** 시스템 설정의 메뉴 순서·숨김을 적용한 묶음 목록 (관리자 메뉴는 그대로) */
export function applyMenuPrefs(groups: MenuGroup[], prefs?: { order?: string[]; hidden?: string[] }): MenuGroup[] {
  if (!prefs || (!prefs.order?.length && !prefs.hidden?.length)) return groups;
  const hidden = new Set(prefs.hidden ?? []);
  const order = prefs.order ?? [];
  const rank = (href: string) => { const i = order.indexOf(href); return i < 0 ? 999 : i; };
  return groups
    .map((g) => ({ ...g, items: g.items.filter((it) => !hidden.has(it.href) || it.href === "/dashboard").slice().sort((a, b) => rank(a.href) - rank(b.href)) }))
    .filter((g) => g.items.length > 0);
}
