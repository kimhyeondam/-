import { todayIso } from "@/lib/format";
// 예시 데이터 (화면 확인용)
// 지금은 화면 모양을 잡기 위한 예시 데이터입니다.
// 다음 단계에서 실제 데이터 저장(데이터베이스)으로 바꿀 예정입니다.

export type TaskStatus = "backlog" | "todo" | "doing" | "done" | "cancelled";
export type Priority = "high" | "medium" | "low";

export interface Task {
  id: string;
  title: string;
  description?: string;
  project?: string; // 프로젝트 이름 (없으면 "프로젝트 미연결")
  assignees: string[]; // 담당자 이름 목록 (없으면 미배정)
  due?: string; // YYYY-MM-DD
  status: TaskStatus;
  priority: Priority;
  createdAt: string; // ISO
}

/** 완료·취소가 아닌 "아직 남아 있는" 할일인지 */
export function isOpenTask(t: Task) {
  return t.status !== "done" && t.status !== "cancelled";
}

export interface Member {
  id: string;
  name: string;
  team: string;
}

export const members: Member[] = [
  { id: "admin", name: "관리자", team: "경영지원" },
  { id: "m1", name: "김철수", team: "생산1팀" },
  { id: "m2", name: "이영희", team: "영업팀" },
  { id: "m3", name: "박민수", team: "품질팀" },
  { id: "m4", name: "최준영", team: "설비팀" },
  { id: "m5", name: "정하늘", team: "관리팀" },
];

export type ProjectType = "관급" | "민간" | "내부";
export type ProjectStatus = "진행예정" | "진행중" | "완료" | "보류" | "취소";

/** 납품 문서(분할납품요구서·거래명세표)의 품목 한 줄 */
export interface DeliveryItem {
  name: string; // 품명
  spec?: string; // 규격
  unit?: string; // 단위 (EA, M, 조 …)
  qty: number; // 수량
  unitPrice?: number; // 단가 (원)
  amount?: number; // 금액 (원)
  note?: string; // 비고 (예: A-1,2,3)
}

export type DeliveryDocKind = "분할납품요구서" | "거래명세표" | "납품요구서" | "기타";

/** 프로젝트에 붙는 납품 문서 한 건 (사진/PDF를 AI가 읽어 정리한 결과) */
export interface DeliveryOrder {
  id: string;
  kind: DeliveryDocKind;
  projectName?: string; // 사업명·공사명
  orderNo?: string; // 납품요구번호 / 명세표 번호
  contractNo?: string; // 계약번호
  agency?: string; // 수요기관 / 발주처 / 공급받는자
  site?: string; // 납품장소 / 현장명
  date?: string; // 요구일자 / 거래일자 (YYYY-MM-DD)
  dueDate?: string; // 납품기한 (YYYY-MM-DD)
  items: DeliveryItem[];
  totalQty: number;
  totalAmount?: number;
  memo?: string;
  fileName?: string;
  uploadedAt: string;
  uploadedBy?: string;
  shipments?: Shipment[]; // 이 문서 기준으로 발행한 거래명세표(납품 차수)
}

/** 납품요구서 품목을 실제로 납품한 기록 = 거래명세표 한 장 */
export interface Shipment {
  id: string;
  date: string;
  docId: string; // 양식 문서(거래명세표)
  docNumber: string;
  revenueId?: string; // 함께 등록된 매출
  qtys: number[]; // 문서 items 순서대로 이번에 납품한 수량
  amount: number; // 청구액(부가세 포함)
}

export interface Project {
  id: string;
  code: string; // 예) 26-3 (연도-순번)
  name: string;
  client?: string; // 고객(거래처). 내부 프로젝트는 비움
  type: ProjectType;
  status: ProjectStatus;
  assignees: string[]; // 담당자 이름 (없으면 미배정)
  startDate?: string;
  dueDate?: string; // 납기/완료 목표일
  progress: number; // 0~100
  revenue: number; // 누적 매출 (원)
  memo?: string;
  region?: string; // 지역 (시·군·구). 비우면 발주처·현장에서 자동으로 추정
  orders?: DeliveryOrder[]; // 납품요구서·거래명세표 (업로드해 정리한 문서들)
}

export type EventType = "납품" | "회의" | "생산" | "점검" | "기타";

export interface Event {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (시작일)
  endDate?: string; // YYYY-MM-DD (종료일, 없으면 하루짜리)
  time?: string; // HH:MM (없으면 종일)
  endTime?: string;
  type: EventType;
  attendees: string[]; // 참석자 이름 (없으면 미배정)
  location?: string;
  memo?: string;
}

export const company = {
  name: "현담토목",
  shortName: "현담",
  assistantName: "현담비서",
  ownerName: "대표님",
};

export interface Resource {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string; // ISO
}

export const resources: Resource[] = [
  {
    id: "r1",
    title: "납품 업무 처리 가이드라인 v1.0",
    content: "## 납품 업무 가이드라인\n\n### 1. 출하 준비\n- 거래명세서 출력\n- 제품 규격·수량 재확인\n- 상차 순서 확인\n\n### 2. 운송\n- 기사 연락처 및 도착 예정 시간 공유\n- 현장 하차 장소 사전 확인\n\n### 3. 완료 처리\n- 납품확인서 서명 수령\n- 세금계산서 발행",
    author: "관리팀",
    createdAt: "2026-09-08T17:11:00",
  },
  {
    id: "r2",
    title: "신규 입사자 안전 교육 체크리스트",
    content: "## 안전 교육 체크리스트\n\n- [ ] 보호구(안전모, 안전화) 지급\n- [ ] 크레인·지게차 작업 반경 안내\n- [ ] 양생실 출입 규칙 안내\n- [ ] 비상 연락망 및 대피 경로 안내\n- [ ] 4대 보험 및 계정(이메일, 업무 시스템) 발급",
    author: "총무팀",
    createdAt: "2026-09-05T10:30:00",
  },
  {
    id: "r3",
    title: "2026년 하반기 영업 전략",
    content: "## 하반기 영업 전략\n\n### 타겟\n- 지자체 우수관로·보도 정비 사업\n- 중견 건설사 토목 현장\n\n### 채널\n1. 관급 입찰 모니터링 (주 1회)\n2. 기존 거래처 방문 (월 2회)\n3. 제품 카탈로그 개정\n\n### KPI\n- 신규 견적 월 15건\n- 수주율 30%",
    author: "영업팀",
    createdAt: "2026-09-01T09:00:00",
  },
];

export const tasks: Task[] = [
  { id: "t1", title: "흄관 D600 200본 출하 준비", project: "○○지구 우수관로 공사", assignees: ["김철수"], due: "2026-09-09", status: "doing", priority: "high", createdAt: "2026-09-01T09:00:00" },
  { id: "t2", title: "맨홀 블록 거푸집 점검", project: "생산 설비 자동화 검토", assignees: ["최준영"], due: "2026-09-09", status: "todo", priority: "medium", createdAt: "2026-09-02T09:00:00" },
  { id: "t3", title: "경계석 견적서 발송 (△△건설)", assignees: ["이영희"], due: "2026-09-09", status: "todo", priority: "high", createdAt: "2026-09-03T09:00:00" },
  { id: "t4", title: "KS 인증 갱신 서류 준비", assignees: ["박민수", "정하늘"], due: "2026-09-12", status: "todo", priority: "medium", createdAt: "2026-09-03T10:00:00" },
  { id: "t5", title: "레미콘 원자재 단가 협의", assignees: ["관리자"], due: "2026-09-08", status: "todo", priority: "high", createdAt: "2026-09-04T09:00:00" },
  { id: "t6", title: "보도블록 색상 샘플 제작", project: "□□시 보행환경 개선", assignees: ["김철수"], due: "2026-09-11", status: "doing", priority: "low", createdAt: "2026-09-04T11:00:00" },
  { id: "t7", title: "8월 생산 실적 보고서 작성", assignees: ["정하늘"], due: "2026-09-05", status: "done", priority: "medium", createdAt: "2026-08-28T09:00:00" },
  { id: "t8", title: "PC 암거 강도 시험 결과 확인", project: "○○지구 우수관로 공사", assignees: ["박민수"], due: "2026-09-10", status: "todo", priority: "high", createdAt: "2026-09-05T09:00:00" },
  { id: "t9", title: "야적장 배수로 정비 아이디어 검토", assignees: [], status: "backlog", priority: "low", createdAt: "2026-09-05T14:00:00" },
  { id: "t10", title: "신제품(투수블록) 생산 라인 검토", description: "지자체 투수블록 수요 증가에 대응", assignees: [], status: "backlog", priority: "medium", createdAt: "2026-09-06T09:00:00" },
  { id: "t11", title: "◇◇도로 경계석 납품 완료 보고", project: "◇◇도로 경계석 납품", assignees: ["이영희"], due: "2026-08-30", status: "done", priority: "medium", createdAt: "2026-08-20T09:00:00" },
  { id: "t12", title: "구형 진동기 수리", assignees: ["최준영"], due: "2026-08-25", status: "cancelled", priority: "low", createdAt: "2026-08-15T09:00:00" },
];

export const projects: Project[] = [
  { id: "p1", code: "26-1", name: "○○지구 우수관로 공사 흄관 납품", client: "○○건설", type: "민간", status: "진행중", assignees: ["김철수", "이영희"], startDate: "2026-07-01", dueDate: "2026-10-31", progress: 65, revenue: 128500000, memo: "D600 400본, D800 120본" },
  { id: "p2", code: "26-2", name: "□□시 보행환경 개선 보도블록 납품", client: "□□시청", type: "관급", status: "진행중", assignees: ["김철수"], startDate: "2026-08-10", dueDate: "2026-11-15", progress: 30, revenue: 42000000 },
  { id: "p3", code: "26-3", name: "△△산업단지 맨홀 납품", client: "△△건설", type: "민간", status: "진행중", assignees: ["이영희", "박민수"], startDate: "2026-06-15", dueDate: "2026-09-25", progress: 85, revenue: 96300000 },
  { id: "p4", code: "26-4", name: "◇◇도로 경계석 납품", client: "◇◇토건", type: "민간", status: "완료", assignees: ["이영희"], startDate: "2026-05-01", dueDate: "2026-08-30", progress: 100, revenue: 58700000 },
  { id: "p5", code: "26-5", name: "생산 설비 자동화 검토", type: "내부", status: "진행예정", assignees: [], startDate: "2026-10-01", dueDate: "2026-12-31", progress: 0, revenue: 0, memo: "진동 성형기 교체 견적 비교" },
  { id: "p6", code: "26-6", name: "☆☆군 농로 배수로 PC 암거 납품", client: "☆☆군청", type: "관급", status: "진행예정", assignees: ["박민수"], startDate: "2026-10-05", dueDate: "2027-01-31", progress: 0, revenue: 0 },
  { id: "p7", code: "26-7", name: "KS 인증 갱신", type: "내부", status: "진행중", assignees: ["박민수", "정하늘"], startDate: "2026-08-01", dueDate: "2026-09-30", progress: 50, revenue: 0 },
  { id: "p8", code: "26-8", name: "▽▽물류센터 진입로 경계석·측구", client: "▽▽개발", type: "민간", status: "보류", assignees: [], startDate: "2026-09-01", progress: 10, revenue: 0, memo: "발주처 설계 변경 대기" },
  { id: "p9", code: "25-12", name: "◎◎택지 우수관 흄관 납품", client: "◎◎건설", type: "민간", status: "완료", assignees: ["김철수"], startDate: "2025-11-01", dueDate: "2026-03-31", progress: 100, revenue: 214000000 },
  { id: "p10", code: "25-9", name: "야적장 배수 개선 공사", type: "내부", status: "취소", assignees: [], startDate: "2025-09-01", progress: 0, revenue: 0, memo: "예산 사유로 취소" },
];

export const events: Event[] = [
  { id: "e1", title: "흄관 D600 1차 납품 (○○지구)", date: "2026-09-09", time: "09:00", endTime: "11:00", type: "납품", attendees: ["김철수"], location: "○○지구 현장" },
  { id: "e2", title: "주간 생산 회의", date: "2026-09-09", time: "14:00", endTime: "15:00", type: "회의", attendees: ["관리자", "김철수", "최준영", "박민수"], location: "본사 회의실" },
  { id: "e3", title: "△△건설 현장 소장 미팅", date: "2026-09-10", time: "10:30", type: "회의", attendees: ["이영희"], location: "△△산업단지 현장사무소" },
  { id: "e4", title: "맨홀 블록 생산 (300개)", date: "2026-09-11", endDate: "2026-09-12", type: "생산", attendees: ["김철수"] },
  { id: "e5", title: "크레인 정기 안전 점검", date: "2026-09-12", time: "13:00", type: "점검", attendees: ["최준영"], memo: "점검업체 방문" },
  { id: "e6", title: "경계석 2차 납품 (◇◇도로)", date: "2026-09-13", time: "08:00", type: "납품", attendees: ["김철수", "이영희"] },
  { id: "e7", title: "KS 심사관 방문", date: "2026-09-16", time: "10:00", endTime: "12:00", type: "점검", attendees: ["박민수"], location: "본사 공장" },
  { id: "e8", title: "월간 매출 마감", date: "2026-09-30", type: "기타", attendees: ["정하늘"] },
  { id: "e9", title: "레미콘 납품업체 단가 협상", date: "2026-09-18", time: "15:00", type: "회의", attendees: [] },
  { id: "e10", title: "추석 연휴 (휴무)", date: "2026-09-24", endDate: "2026-09-27", type: "기타", attendees: [] },
];

/** @deprecated 예시 데이터용. 화면에서는 todayIso()를 쓰세요 (요청·렌더 시점 기준) */
export const today = todayIso();

export interface Customer {
  id: string;
  name: string; // 고객명(거래처명)
  ceo?: string; // 대표자
  bizNo?: string; // 사업자번호
  phone?: string;
  email?: string;
  address?: string;
  memo?: string;
  dealer?: boolean; // 대리점: 우리 제품을 받아 자기 이름으로 최종 현장에 납품하는 거래처
  priceRate?: number; // 단가 적용률(%). 기준 단가 × 적용률 = 이 거래처 단가 (예: 90 = 10% 할인). 없으면 100
  createdAt: string; // YYYY-MM-DD
}

export const customers: Customer[] = [
  { id: "c1", name: "○○건설", ceo: "오건설", bizNo: "123-45-67890", phone: "02-1234-5678", email: "order@oo-const.co.kr", address: "서울시 ○○구", priceRate: 95, createdAt: "2025-03-10" },
  { id: "c2", name: "□□시청", ceo: "-", bizNo: "-", phone: "031-000-0000", address: "경기도 □□시", memo: "관급, 조달 계약", createdAt: "2025-06-01" },
  { id: "c3", name: "△△건설", ceo: "박삼각", bizNo: "234-56-78901", phone: "010-2222-3333", email: "site@aa-const.kr", priceRate: 90, createdAt: "2025-08-20" },
  { id: "c4", name: "◇◇토건", ceo: "최마름", bizNo: "345-67-89012", phone: "010-4444-5555", createdAt: "2026-01-15" },
  { id: "c5", name: "◎◎건설", ceo: "정겹원", bizNo: "456-78-90123", phone: "02-9876-5432", createdAt: "2025-10-05" },
  { id: "c6", name: "☆☆군청", ceo: "-", bizNo: "-", phone: "033-000-0000", memo: "관급, 농로 배수로 사업", createdAt: "2026-08-01" },
  { id: "c7", name: "▽▽개발", ceo: "한역삼", bizNo: "567-89-01234", phone: "010-6666-7777", createdAt: "2026-08-20" },
];

export type LeadSource = "전화" | "홈페이지" | "소개" | "입찰공고" | "현장방문" | "기타";
export type LeadStatus = "신규" | "상담중" | "견적발송" | "계약완료" | "실패" | "보류";

export interface Lead {
  id: string;
  company: string; // 회사명
  contact: string; // 담당자
  phone?: string;
  email?: string;
  source: LeadSource; // 유입경로
  status: LeadStatus;
  assignee?: string; // 담당직원 이름
  product?: string; // 관심 제품
  memo?: string;
  createdAt: string; // YYYY-MM-DD
}

export const leads: Lead[] = [
  { id: "l1", company: "가나종합건설", contact: "김현장", phone: "010-1234-5678", email: "kim@dot-const.kr", source: "홈페이지", status: "상담중", assignee: "이영희", product: "흄관 D800", createdAt: "2026-09-03" },
  { id: "l2", company: "다라개발", contact: "이대리", phone: "010-2345-6789", source: "전화", status: "신규", product: "경계석", createdAt: "2026-09-08" },
  { id: "l3", company: "마바시 도로과", contact: "박주무관", phone: "031-111-2222", source: "입찰공고", status: "신규", product: "보도블록", memo: "10월 입찰 예정", createdAt: "2026-09-07" },
  { id: "l4", company: "사아산업", contact: "최부장", phone: "010-3456-7890", email: "choi@half.co.kr", source: "소개", status: "견적발송", assignee: "이영희", product: "맨홀 블록", createdAt: "2026-08-25" },
  { id: "l5", company: "자차토목", contact: "정소장", phone: "010-4567-8901", source: "현장방문", status: "계약완료", assignee: "이영희", product: "PC 암거", createdAt: "2026-07-15" },
  { id: "l6", company: "카타주택", contact: "강대표", phone: "010-5678-9012", source: "소개", status: "실패", assignee: "관리자", memo: "타사 단가 채택", createdAt: "2026-06-20" },
  { id: "l7", company: "파하레저", contact: "윤팀장", phone: "010-6789-0123", source: "홈페이지", status: "보류", assignee: "이영희", product: "투수블록", memo: "내년 착공 예정", createdAt: "2026-05-30" },
  { id: "l8", company: "▽▽개발", contact: "한역삼", phone: "010-6666-7777", source: "전화", status: "계약완료", assignee: "이영희", product: "경계석·측구", createdAt: "2026-08-10" },
];

// ---------- 재무: 견적 / 매출 / 입금 ----------

export interface QuoteItem {
  name: string; // 품명
  spec?: string; // 규격
  unit: string; // 단위 (본, 개, ㎡, m ...)
  qty: number;
  unitPrice: number;
}

export type QuoteStatus = "작성중" | "발송완료" | "수락" | "거절" | "만료";

export interface Quotation {
  id: string;
  number: string; // QT-2609-001 (QT-연월-순번)
  recipient: string; // 수신자(거래처)
  date: string; // 견적일
  validUntil?: string; // 유효기간
  items: QuoteItem[];
  status: QuoteStatus;
  project?: string;
  memo?: string;
}

export function quoteSupply(q: Pick<Quotation, "items">) {
  return q.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
}
export function quoteVat(q: Pick<Quotation, "items">) {
  return Math.round(quoteSupply(q) * 0.1);
}
export function quoteTotal(q: Pick<Quotation, "items">) {
  return quoteSupply(q) + quoteVat(q);
}

export const quotations: Quotation[] = [
  { id: "q1", number: "QT-2609-001", recipient: "가나종합건설", date: "2026-09-04", validUntil: "2026-10-04", status: "발송완료", project: "○○지구 우수관로 공사 흄관 납품",
    items: [{ name: "흄관", spec: "D800 × 2.5m", unit: "본", qty: 120, unitPrice: 185000 }, { name: "운반비", unit: "식", qty: 1, unitPrice: 1200000 }] },
  { id: "q2", number: "QT-2609-002", recipient: "사아산업", date: "2026-09-08", status: "작성중",
    items: [{ name: "맨홀 블록", spec: "D900 하부", unit: "개", qty: 40, unitPrice: 96000 }, { name: "맨홀 블록", spec: "D900 상부", unit: "개", qty: 40, unitPrice: 88000 }] },
  { id: "q3", number: "QT-2608-001", recipient: "△△건설", date: "2026-08-12", validUntil: "2026-09-12", status: "수락", project: "△△산업단지 맨홀 납품",
    items: [{ name: "맨홀 블록", spec: "D900 세트", unit: "세트", qty: 60, unitPrice: 240000 }, { name: "맨홀 뚜껑", spec: "주철 D648", unit: "개", qty: 60, unitPrice: 135000 }] },
  { id: "q4", number: "QT-2608-002", recipient: "카타주택", date: "2026-08-20", validUntil: "2026-09-05", status: "거절", memo: "타사 단가 채택",
    items: [{ name: "경계석", spec: "150×200×1000", unit: "개", qty: 500, unitPrice: 9800 }] },
  { id: "q5", number: "QT-2607-001", recipient: "▽▽개발", date: "2026-07-25", validUntil: "2026-08-25", status: "만료",
    items: [{ name: "경계석", spec: "150×200×1000", unit: "개", qty: 800, unitPrice: 9500 }, { name: "L형 측구", spec: "300×500", unit: "개", qty: 400, unitPrice: 21000 }] },
];

export interface Revenue {
  id: string;
  title: string; // 매출명
  date?: string; // 매출일 (없으면 날짜 미정)
  customer?: string;
  project?: string;
  amount: number; // 공급가+부가세 포함 청구액 (품목이 있으면 품목에서 자동 계산)
  quoteId?: string;
  memo?: string;
  items?: QuoteItem[]; // 품목 (품명·규격·단위·수량·단가) → 금액 자동 계산
  vatIncluded?: boolean; // 단가에 부가세 포함 여부
  site?: string; // 납품 장소(현장)
  docId?: string; // 함께 만들어진 거래명세표 (양식 문서)
  docNumber?: string; // 거래명세표 번호 (예: ST-2609-003)
  delivery?: RevenueDelivery; // 납품 방법 (우리 차 배차 / 용차 / 거래처 차량 / 미정)
}

export type DeliveryMode = "자차" | "용차" | "거래처차량" | "미정";
export const deliveryModeLabel: Record<DeliveryMode, string> = { 자차: "우리 차로 납품", 용차: "용차 불러서 납품", 거래처차량: "거래처가 차를 보냄", 미정: "미정" };

/** 매출에 붙는 납품 방법. 자차·용차·거래처차량이면 배차·출고에 배차가 자동으로 생깁니다 */
export interface RevenueDelivery {
  mode: DeliveryMode;
  vehicleId?: string;
  vehicle?: string; // 차량번호 · 차종 (거래처 차량이면 거래처가 알려준 번호)
  driver?: string;
  driverPhone?: string;
  dispatchId?: string; // 배차·출고의 배차 id
  memo?: string;
}

export const revenues: Revenue[] = [
  { id: "r1", title: "◎◎택지 흄관 3차(잔금)", date: "2026-03-20", customer: "◎◎건설", project: "◎◎택지 우수관 흄관 납품", amount: 66000000 },
  { id: "r2", title: "◇◇도로 경계석 1차", date: "2026-06-10", customer: "◇◇토건", project: "◇◇도로 경계석 납품", amount: 33000000 },
  { id: "r3", title: "◇◇도로 경계석 2차(잔금)", date: "2026-08-31", customer: "◇◇토건", project: "◇◇도로 경계석 납품", amount: 31570000 },
  { id: "r4", title: "○○지구 흄관 1차", date: "2026-08-05", customer: "○○건설", project: "○○지구 우수관로 공사 흄관 납품", amount: 77000000 },
  { id: "r5", title: "△△산업단지 맨홀 1차", date: "2026-07-15", customer: "△△건설", project: "△△산업단지 맨홀 납품", amount: 49500000 },
  { id: "r6", title: "□□시 보도블록 1차", date: "2026-09-05", customer: "□□시청", project: "□□시 보행환경 개선 보도블록 납품", amount: 24200000 },
  { id: "r7", title: "△△산업단지 맨홀 2차", customer: "△△건설", project: "△△산업단지 맨홀 납품", amount: 24750000, quoteId: "q3", memo: "9월 말 납품 후 청구 예정" },
];

export type DepositSource = "수기" | "자동";

export interface Deposit {
  id: string;
  date: string;
  payer: string; // 입금자명
  amount: number;
  bank?: string;
  source: DepositSource;
  revenueId?: string; // 연결된 매출
  memo?: string;
}

export const deposits: Deposit[] = [
  { id: "d1", date: "2026-03-31", payer: "◎◎건설", amount: 66000000, bank: "국민은행", source: "수기", revenueId: "r1" },
  { id: "d2", date: "2026-06-25", payer: "◇◇토건", amount: 33000000, bank: "농협", source: "수기", revenueId: "r2" },
  { id: "d3", date: "2026-08-10", payer: "△△건설", amount: 30000000, bank: "국민은행", source: "수기", revenueId: "r5", memo: "1차 일부 입금" },
  { id: "d4", date: "2026-08-28", payer: "○○건설", amount: 77000000, bank: "기업은행", source: "수기", revenueId: "r4" },
  { id: "d5", date: "2026-09-02", payer: "(주)파하레저", amount: 500000, bank: "농협", source: "수기", memo: "샘플 대금, 매출 미연결" },
];

// ---------- 명함 ----------
export type CardSource = "수기" | "스캔";

export interface BusinessCard {
  id: string;
  name: string;
  company: string;
  title?: string; // 직책
  phone?: string; // 회사 전화
  mobile?: string; // 휴대전화
  email?: string;
  address?: string;
  source: CardSource;
  memo?: string;
  ownerId?: string; // 담당자(받은 직원) 계정 id. 직원은 자기 명함만 보고, 관리자는 전체를 봅니다
  ownerName?: string;
  createdAt: string; // YYYY-MM-DD
}

export const businessCards: BusinessCard[] = [
  { id: "bc1", name: "오건설", company: "○○건설", title: "대표이사", phone: "02-1234-5678", mobile: "010-1111-2222", email: "ceo@oo-const.co.kr", address: "서울시 ○○구 ○○대로 12", source: "수기", createdAt: "2026-08-12" },
  { id: "bc2", name: "박삼각", company: "△△건설", title: "현장소장", mobile: "010-2222-3333", email: "site@aa-const.kr", address: "△△산업단지 현장사무소", source: "수기", memo: "맨홀 납품 현장 담당", createdAt: "2026-08-20" },
  { id: "bc3", name: "김현장", company: "가나종합건설", title: "공무부장", mobile: "010-1234-5678", email: "kim@dot-const.kr", address: "경기도 ◇◇시 ◇◇로 88", source: "수기", createdAt: "2026-09-03" },
  { id: "bc4", name: "이레미", company: "★★레미콘", title: "영업팀장", phone: "031-555-0000", mobile: "010-9999-0000", email: "sales@star-remicon.kr", address: "경기도 ★★시 산업로 5", source: "수기", memo: "원자재(레미콘) 공급업체", createdAt: "2026-07-10" },
];

// ---------- 매입 ----------
export type PurchaseCategory = "원자재" | "부자재" | "운반" | "외주" | "설비" | "기타";

export interface Purchase {
  id: string;
  date: string; // 매입일
  supplier: string; // 매입처
  item: string; // 품목
  spec?: string; // 규격
  qty?: number;
  unit?: string;
  unitPrice?: number;
  supply: number; // 공급가액
  vat: number; // 부가세
  category: PurchaseCategory;
  paid: number; // 지급액
  payDue?: string; // 지급 예정일
  invoice: boolean; // 세금계산서 수취
  memo?: string;
  items?: QuoteItem[]; // 명세서에 품목이 여러 줄이면 여기에 (원자재 입고는 줄마다 맞춥니다)
}

export const purchaseTotal = (p: Pick<Purchase, "supply" | "vat">) => p.supply + p.vat;

export const purchases: Purchase[] = [
  { id: "pu1", date: "2026-09-02", supplier: "★★레미콘", item: "레미콘", spec: "25-24-150", qty: 120, unit: "㎥", unitPrice: 78000, supply: 9360000, vat: 936000, category: "원자재", paid: 0, payDue: "2026-10-10", invoice: true },
  { id: "pu2", date: "2026-09-05", supplier: "한일시멘트 대리점", item: "시멘트", spec: "1종 벌크", qty: 60, unit: "톤", unitPrice: 105000, supply: 6300000, vat: 630000, category: "원자재", paid: 0, payDue: "2026-10-05", invoice: true },
  { id: "pu3", date: "2026-08-28", supplier: "◇◇골재", item: "골재", spec: "25mm 쇄석", qty: 300, unit: "톤", unitPrice: 18000, supply: 5400000, vat: 540000, category: "원자재", paid: 5940000, payDue: "2026-09-30", invoice: true },
  { id: "pu4", date: "2026-08-20", supplier: "대한철강", item: "철근", spec: "SD400 D13", qty: 12, unit: "톤", unitPrice: 920000, supply: 11040000, vat: 1104000, category: "원자재", paid: 6000000, payDue: "2026-09-20", invoice: true, memo: "잔금 9/20 예정" },
  { id: "pu5", date: "2026-08-25", supplier: "◎◎운수", item: "흄관 운반", spec: "○○지구 3회", supply: 2400000, vat: 240000, category: "운반", paid: 2640000, invoice: true },
  { id: "pu6", date: "2026-07-15", supplier: "혼화제코리아", item: "혼화제", spec: "AE감수제 20L", qty: 40, unit: "통", unitPrice: 45000, supply: 1800000, vat: 180000, category: "부자재", paid: 1980000, invoice: true },
  { id: "pu7", date: "2026-07-30", supplier: "△△설비", item: "진동기 수리", supply: 850000, vat: 85000, category: "설비", paid: 935000, invoice: false, memo: "현금 영수증" },
  { id: "pu8", date: "2026-06-18", supplier: "◇◇골재", item: "모래", spec: "세척사", qty: 200, unit: "톤", unitPrice: 22000, supply: 4400000, vat: 440000, category: "원자재", paid: 4840000, invoice: true },
  { id: "pu9", date: "2026-03-10", supplier: "대한철강", item: "철근", spec: "SD400 D10", qty: 8, unit: "톤", unitPrice: 900000, supply: 7200000, vat: 720000, category: "원자재", paid: 7920000, invoice: true },
];

// ---------- 미팅 ----------
export interface MeetingAction {
  title: string;
  assignee?: string;
  due?: string; // YYYY-MM-DD
  taskId?: string; // 할일관리에 등록되면 채워짐
}

export interface Meeting {
  id: string;
  title: string;
  at: string; // ISO (로컬 기준, 초 없음: 2026-09-09T15:26)
  project?: string;
  customer?: string;
  attendees: string[];
  location?: string;
  notes: string; // 회의록 원문
  summary?: string; // AI 요약
  decisions?: string[]; // 결정 사항
  actions: MeetingAction[]; // 할 일
  createdBy?: string;
}

export const meetings: Meeting[] = [
  { id: "m1", title: "△△건설 현장 소장 미팅", at: "2026-09-03T10:30", project: "△△산업단지 맨홀 납품", customer: "△△건설", attendees: ["이영희", "박민수"], location: "△△산업단지 현장사무소",
    notes: "- 맨홀 2차분 60세트 9/25까지 납품 요청\n- 뚜껑은 주철 D648로 통일\n- 현장 야적 공간 협소 → 2회 분할 납품 협의\n- 강도 시험 성적서 납품 시 동봉 요청",
    summary: "맨홀 2차분 납품 일정과 규격을 확정하고 분할 납품에 합의했습니다.", decisions: ["2차분 60세트 9/25 납품", "뚜껑 규격 주철 D648로 통일", "2회 분할 납품"],
    actions: [{ title: "맨홀 2차분 생산 계획 수립", assignee: "김철수", due: "2026-09-12" }, { title: "강도 시험 성적서 준비", assignee: "박민수", due: "2026-09-20" }], createdBy: "이영희" },
  { id: "m2", title: "주간 생산 회의", at: "2026-09-02T14:00", attendees: ["관리자", "김철수", "최준영", "박민수"], location: "본사 회의실",
    notes: "- 흄관 D600 재고 180본, 추가 200본 생산 착수\n- 진동기 2호기 소음 → 설비팀 점검\n- 추석 연휴 전 출하 일정 정리 필요",
    actions: [{ title: "진동기 2호기 점검", assignee: "최준영", due: "2026-09-05" }], createdBy: "관리자" },
  { id: "m3", title: "미팅 2026. 8. 28. 오후 03:10", at: "2026-08-28T15:10", customer: "○○건설", attendees: ["이영희"], notes: "○○지구 2차 납품 일정 문의. 10월 초 예정. 견적 단가 유지 요청.", actions: [], createdBy: "이영희" },
];

// ---------- 회사 정보 (양식 문서 머리글, 시스템 설정에서 수정) ----------
export interface CompanyProfile {
  name: string;
  ceo: string;
  bizNo: string;
  address: string;
  phone: string;
  fax?: string;
  email?: string;
  bank?: string; // 입금 계좌
  bizType?: string; // 업태
  bizItem?: string; // 종목
  logo?: string; // 로고 이미지 (경로 또는 data URL). 문서 머리글·메뉴·로그인에 표시
  logoMark?: string; // 작은 심볼 로고 (메뉴 접었을 때)
  shortName?: string; // 약칭 (예: 현담). 비서 이름 「○○비서」와 로그인 화면 글자에 씁니다
  ownerName?: string; // 대시보드 인사말 호칭 (예: 대표님)
}

// 회사 정보 기본값. 실제 값(대표·사업자번호·주소·전화·계좌·로고)은 관리자 메뉴 「시스템 설정」에서 넣습니다.
export const companyProfile: CompanyProfile = {
  name: "현담토목",
  shortName: "현담",
  ownerName: "대표님",
  ceo: "",
  bizNo: "",
  address: "",
  phone: "",
  fax: "",
  email: "",
  bank: "",
  bizType: "제조업",
  bizItem: "콘크리트 제품",
};

// ---------- 양식 문서 ----------
export type DocType = "견적서" | "거래명세표" | "납품확인서";

export interface FormDoc {
  id: string;
  type: DocType;
  number: string; // QT-2609-001 / ST-2609-001 / DC-2609-001
  date: string;
  customer: string; // 수신
  customerRef?: string; // 담당자/연락처
  project?: string;
  site?: string; // 납품 장소(현장)
  items: QuoteItem[];
  vatIncluded: boolean; // false: 부가세 별도
  memo?: string;
  validDays?: number; // 견적 유효기간(일)
  receiver?: string; // 납품확인서 인수자
  quoteId?: string;
  revenueId?: string; // 거래명세표와 함께 등록된 매출
  createdBy?: string;
  createdAt: string;
}

export const docPrefix: Record<DocType, string> = { 견적서: "QT", 거래명세표: "ST", 납품확인서: "DC" };

export const formDocs: FormDoc[] = [
  { id: "fd1", type: "거래명세표", number: "ST-2609-001", date: "2026-09-05", customer: "□□시청", customerRef: "도로과 박주무관", project: "□□시 보행환경 개선 보도블록 납품", site: "□□시 중앙로 보도 정비 현장",
    items: [{ name: "보도블록", spec: "300×300×60 회색", unit: "㎡", qty: 400, unitPrice: 38000 }, { name: "보도블록", spec: "300×300×60 적색", unit: "㎡", qty: 200, unitPrice: 41000 }], vatIncluded: false, createdBy: "이영희", createdAt: "2026-09-05" },
  { id: "fd2", type: "납품확인서", number: "DC-2608-001", date: "2026-08-28", customer: "○○건설", customerRef: "현장 오건설 소장", project: "○○지구 우수관로 공사 흄관 납품", site: "○○지구 우수관로 공사 현장", receiver: "오건설",
    items: [{ name: "흄관", spec: "D600 × 2.5m", unit: "본", qty: 200, unitPrice: 128000 }], vatIncluded: false, memo: "1차 납품분. 하차 후 현장 검수 완료.", createdBy: "김철수", createdAt: "2026-08-28" },
];

// ---------- 건의사항 ----------
export type SuggestionCategory = "업무 개선" | "설비·안전" | "복지·근무" | "기타";
export type SuggestionStatus = "접수" | "검토중" | "반영" | "보류";

export interface Suggestion {
  id: string;
  title: string;
  content: string;
  category: SuggestionCategory;
  status: SuggestionStatus;
  author: string; // 직원 이름
  authorId?: string;
  anonymous?: boolean; // 익명 제출 (관리자에게만 이름 표시)
  createdAt: string; // ISO
  reply?: string; // 관리자 답변
  repliedBy?: string;
  repliedAt?: string;
}

export const suggestions: Suggestion[] = [
  { id: "s1", title: "야적장 조명 추가 요청", content: "겨울철 오후 5시 이후 야적장이 어두워 지게차 작업이 위험합니다. LED 투광등 2개 정도 추가되면 좋겠습니다.", category: "설비·안전", status: "검토중", author: "김철수", createdAt: "2026-09-01T09:20:00", reply: "설비팀에서 견적 받는 중입니다. 9월 중 설치 예정.", repliedBy: "관리자", repliedAt: "2026-09-03T14:00:00" },
  { id: "s2", title: "거래명세표 자동 발송", content: "납품 후 거래명세표를 매번 손으로 보내는데, 납품확인서 저장하면 자동으로 메일 발송되게 해 주세요.", category: "업무 개선", status: "접수", author: "이영희", createdAt: "2026-09-07T11:05:00" },
  { id: "s3", title: "휴게실 정수기 교체", content: "정수기 온수가 안 나온 지 한 달 됐습니다.", category: "복지·근무", status: "반영", author: "정하늘", createdAt: "2026-08-20T10:00:00", reply: "8/28 새 정수기 설치 완료했습니다.", repliedBy: "관리자", repliedAt: "2026-08-28T16:30:00" },
];

// ---------- 계약 ----------
export interface ContractTemplate {
  id: string;
  name: string;
  description?: string;
  body: string; // {{고객명}} 같은 빈칸(치환 항목) 포함
  createdAt: string;
}

export type ContractStatus = "작성중" | "발송완료" | "서명완료" | "취소";

export interface Contract {
  id: string;
  title: string;
  customer: string;
  customerEmail?: string;
  customerRef?: string; // 상대방 담당자
  templateId?: string;
  body: string; // 완성된 본문
  amount: number; // 계약금액 (부가세 포함)
  startDate?: string;
  endDate?: string;
  items?: string; // 품목 요약
  status: ContractStatus;
  createdBy?: string;
  createdAt: string; // YYYY-MM-DD
  sentAt?: string;
  signToken?: string; // 고객 서명 링크용
  signedAt?: string;
  signerName?: string;
  signature?: string; // 서명 이미지 (data URL)
  memo?: string;
}

export const contractPlaceholders = ["{{고객명}}", "{{고객담당자}}", "{{공급자명}}", "{{공급자대표}}", "{{공급자주소}}", "{{계약금액}}", "{{계약금액한글}}", "{{계약기간}}", "{{시작일}}", "{{종료일}}", "{{품목}}", "{{계약일}}", "{{특약}}"];

export const contractTemplates: ContractTemplate[] = [
  {
    id: "ct1",
    name: "콘크리트 제품 공급 계약서",
    description: "흄관·맨홀·경계석 등 제품을 특정 현장에 납품할 때 쓰는 기본 계약서",
    createdAt: "2026-01-10",
    body: `물품 공급 계약서

공급자 {{공급자명}}(이하 "갑")과 수요자 {{고객명}}(이하 "을")은 아래와 같이 물품 공급 계약을 체결한다.

제1조 (계약의 목적)
갑은 을에게 아래 물품을 공급하고, 을은 그 대금을 지급한다.
- 품목: {{품목}}

제2조 (계약금액)
계약금액은 일금 {{계약금액한글}}원정(₩{{계약금액}}, 부가가치세 포함)으로 한다.

제3조 (납품 기간 및 장소)
1. 납품 기간: {{계약기간}}
2. 납품 장소: 을이 지정하는 현장으로 하며, 상차·운반 조건은 별도 협의한다.

제4조 (대금 지급)
을은 납품 완료 후 갑이 발행한 세금계산서를 받은 날로부터 30일 이내에 대금을 지급한다.

제5조 (품질 및 검수)
갑은 KS 규격에 적합한 제품을 공급하며, 을은 납품 즉시 검수하고 하자가 있을 경우 7일 이내에 통지한다.

제6조 (계약의 해지)
어느 한쪽이 계약을 위반하고 상당한 기간 내에 시정하지 않으면 상대방은 계약을 해지할 수 있다.

제7조 (특약사항)
{{특약}}

본 계약을 증명하기 위해 계약서 2부를 작성하여 갑·을이 서명 날인 후 각 1부씩 보관한다.

{{계약일}}

갑: {{공급자명}} 대표 {{공급자대표}} (인)
    {{공급자주소}}
을: {{고객명}} {{고객담당자}} (서명)`,
  },
  {
    id: "ct2",
    name: "연간 단가 계약서",
    description: "1년 동안 정해진 단가로 수시 발주·납품할 때 쓰는 계약서",
    createdAt: "2026-01-10",
    body: `연간 단가 계약서

{{공급자명}}(이하 "갑")과 {{고객명}}(이하 "을")은 {{시작일}}부터 {{종료일}}까지 아래 조건으로 단가 계약을 체결한다.

제1조 (대상 품목 및 단가)
- {{품목}}
단가는 계약 기간 동안 유지하며, 원자재 가격이 10% 이상 변동할 경우 협의하여 조정할 수 있다.

제2조 (발주 및 납품)
을은 필요 시 서면(이메일 포함)으로 발주하고, 갑은 발주일로부터 7일 이내에 납품한다.

제3조 (대금 지급)
매월 말일 마감하여 익월 30일까지 지급한다.

제4조 (예상 계약금액)
연간 예상 금액은 ₩{{계약금액}}(부가가치세 포함)이며, 실제 금액은 발주 실적에 따른다.

제5조 (특약사항)
{{특약}}

{{계약일}}

갑: {{공급자명}} 대표 {{공급자대표}} (인)
을: {{고객명}} {{고객담당자}} (서명)`,
  },
];

export const contracts: Contract[] = [
  { id: "k1", title: "○○지구 우수관로 흄관 공급 계약서", customer: "○○건설", customerEmail: "order@oo-const.co.kr", customerRef: "오건설 대표", templateId: "ct1", amount: 205500000, startDate: "2026-07-01", endDate: "2026-10-31", items: "흄관 D600 400본, D800 120본", status: "서명완료", createdBy: "이영희", createdAt: "2026-06-25", sentAt: "2026-06-25", signedAt: "2026-06-27", signerName: "오건설", body: "(서명 완료된 계약 본문)" },
  { id: "k2", title: "△△산업단지 맨홀 납품 계약서", customer: "△△건설", customerEmail: "site@aa-const.kr", customerRef: "박삼각 소장", templateId: "ct1", amount: 96300000, startDate: "2026-06-15", endDate: "2026-09-25", items: "맨홀 블록 D900 60세트, 주철 뚜껑 60개", status: "발송완료", createdBy: "이영희", createdAt: "2026-06-10", sentAt: "2026-06-10", body: "(발송된 계약 본문)" },
  { id: "k3", title: "☆☆군 PC 암거 연간 단가 계약서", customer: "☆☆군청", customerRef: "농업정책과", templateId: "ct2", amount: 150000000, startDate: "2026-10-01", endDate: "2027-09-30", items: "PC 암거 1.5×1.5 / 2.0×2.0", status: "작성중", createdBy: "박민수", createdAt: "2026-09-05", body: "(작성 중인 계약 본문)" },
];

/* ───────── 생산·재고·출근 ───────── */

/** 재고관리 품목 (우리가 만드는 제품) */
export interface Product {
  id: string;
  name: string; // 품명 (예: 흄관 D600)
  spec?: string; // 규격
  unit: string; // 단위
  category?: string; // 분류 (흄관, 맨홀, 경계석, 보도블록, 암거 ...)
  safetyStock?: number; // 안전재고 (이 밑으로 내려가면 경고)
  basePrice?: number; // 기준 단가 (단가표). 거래처별 적용률을 곱해 매출 단가가 됩니다
  recipe?: { materialId: string; qty: number }[]; // 배합: 1개 만들 때 드는 원자재 (생산일보 저장 시 자동 소진)
  favorite?: boolean; // 생산 품목(별표): 생산일보 빠른 입력·양식 인쇄에 나오는 품목
  aliases?: string[]; // 별칭(공장 호칭). 예: "원형1호 상부 600H" → 생산일보·거래명세표에서 이 이름으로 적어도 이 품목에 연결
  memo?: string;
  createdAt: string;
}

export type StockMoveType = "기초재고" | "생산입고" | "출하" | "반품입고" | "불량폐기" | "재고조정";

/** 재고 입출고 한 줄. 재고 = 품목별 qty 합계 (입고 +, 출하 -) */
export interface StockMove {
  id: string;
  date: string;
  productId: string;
  type: StockMoveType;
  qty: number; // 입고는 +, 출하·폐기는 -
  ref?: string; // 연결된 문서 (생산일보 id, 매출 id 등) — 원본이 지워지면 같이 지워집니다
  refLabel?: string; // 화면에 보여줄 이름 (예: 거래명세표 ST-2609-003)
  memo?: string;
  createdBy?: string;
  createdAt: string;
}

export interface ProductionItem {
  productId?: string; // 품목에 연결 (없으면 이름으로 새 품목 생성)
  name: string;
  spec?: string;
  unit: string;
  planned?: number; // 계획 수량
  produced: number; // 양품 수량 (재고 입고)
  defect?: number; // 불량 수량
}

/** 생산일보: 하루 생산 기록 */
export interface ProductionReport {
  id: string;
  date: string;
  line?: string; // 라인·조 (예: 1라인, 야간조)
  workers: string[]; // 작업 인원 (직원 이름)
  items: ProductionItem[];
  hours?: number; // 작업 시간
  weather?: string;
  notes?: string; // 특이사항
  createdBy?: string;
  createdAt: string;
}

export const attendanceStatuses = ["출근", "지각", "조퇴", "반차", "외근", "휴가", "병가", "결근"] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

/** 직원출근부: 직원 1명의 하루 기록 */
export interface Attendance {
  id: string;
  date: string;
  memberId: string;
  name: string;
  status: AttendanceStatus;
  checkIn?: string; // "08:30"
  checkOut?: string; // "17:30"
  overtime?: number; // 연장근무 시간
  memo?: string;
}

export const products: Product[] = [
  { id: "pd1", name: "흄관 D600", spec: "L=2,500", unit: "본", category: "흄관", safetyStock: 40, basePrice: 185000, recipe: [{ materialId: "mt1", qty: 0.32 }, { materialId: "mt2", qty: 0.45 }, { materialId: "mt3", qty: 0.5 }, { materialId: "mt5", qty: 1 }], createdAt: "2026-01-05" },
  { id: "pd2", name: "흄관 D800", spec: "L=2,500", unit: "본", category: "흄관", safetyStock: 30, basePrice: 290000, recipe: [{ materialId: "mt1", qty: 0.5 }, { materialId: "mt2", qty: 0.7 }, { materialId: "mt3", qty: 0.8 }, { materialId: "mt5", qty: 1 }], createdAt: "2026-01-05" },
  { id: "pd3", name: "원형1호 맨홀 하부구체", spec: "900*H1000", unit: "EA", category: "맨홀", safetyStock: 10, basePrice: 150000, recipe: [{ materialId: "mt1", qty: 0.25 }, { materialId: "mt2", qty: 0.35 }, { materialId: "mt3", qty: 0.4 }], createdAt: "2026-01-05" },
  { id: "pd4", name: "도로 경계석", spec: "150*200*1000", unit: "본", category: "경계석", safetyStock: 300, basePrice: 9500, recipe: [{ materialId: "mt1", qty: 0.012 }, { materialId: "mt2", qty: 0.02 }, { materialId: "mt3", qty: 0.02 }], createdAt: "2026-01-05" },
  { id: "pd5", name: "보도블록 (투수)", spec: "300*300*60", unit: "㎡", category: "보도블록", safetyStock: 200, basePrice: 21000, recipe: [{ materialId: "mt1", qty: 0.02 }, { materialId: "mt2", qty: 0.04 }, { materialId: "mt4", qty: 0.3 }], createdAt: "2026-01-05" },
  { id: "pd6", name: "PC 암거 1.5*1.5", spec: "L=2,000", unit: "EA", category: "암거", safetyStock: 4, basePrice: 1850000, recipe: [{ materialId: "mt1", qty: 1.1 }, { materialId: "mt2", qty: 1.6 }, { materialId: "mt3", qty: 1.8 }], createdAt: "2026-03-02" },
];

export const stockMoves: StockMove[] = [
  { id: "sm1", date: "2026-08-31", productId: "pd1", type: "기초재고", qty: 62, memo: "8월 말 실사", createdAt: "2026-08-31T18:00:00" },
  { id: "sm2", date: "2026-08-31", productId: "pd2", type: "기초재고", qty: 18, memo: "8월 말 실사", createdAt: "2026-08-31T18:00:00" },
  { id: "sm3", date: "2026-08-31", productId: "pd3", type: "기초재고", qty: 14, memo: "8월 말 실사", createdAt: "2026-08-31T18:00:00" },
  { id: "sm4", date: "2026-08-31", productId: "pd4", type: "기초재고", qty: 420, memo: "8월 말 실사", createdAt: "2026-08-31T18:00:00" },
  { id: "sm5", date: "2026-08-31", productId: "pd5", type: "기초재고", qty: 150, memo: "8월 말 실사", createdAt: "2026-08-31T18:00:00" },
  { id: "sm6", date: "2026-08-31", productId: "pd6", type: "기초재고", qty: 6, memo: "8월 말 실사", createdAt: "2026-08-31T18:00:00" },
  { id: "sm7", date: "2026-09-08", productId: "pd1", type: "생산입고", qty: 24, ref: "pr1", refLabel: "생산일보 9/8", createdAt: "2026-09-08T17:30:00" },
  { id: "sm8", date: "2026-09-08", productId: "pd4", type: "생산입고", qty: 120, ref: "pr1", refLabel: "생산일보 9/8", createdAt: "2026-09-08T17:30:00" },
  { id: "sm9", date: "2026-09-09", productId: "pd1", type: "출하", qty: -30, refLabel: "○○지구 흄관 1차", memo: "○○건설 현장", createdAt: "2026-09-09T10:00:00" },
  { id: "sm10", date: "2026-09-09", productId: "pd2", type: "생산입고", qty: 8, ref: "pr2", refLabel: "생산일보 9/9", createdAt: "2026-09-09T17:30:00" },
  { id: "sm11", date: "2026-09-09", productId: "pd5", type: "생산입고", qty: 60, ref: "pr2", refLabel: "생산일보 9/9", createdAt: "2026-09-09T17:30:00" },
];

export const productions: ProductionReport[] = [
  { id: "pr1", date: "2026-09-08", line: "1라인", workers: ["김철수", "박민수", "최준영"], hours: 8, weather: "맑음", items: [
    { productId: "pd1", name: "흄관 D600", spec: "L=2,500", unit: "본", planned: 24, produced: 24, defect: 1 },
    { productId: "pd4", name: "도로 경계석", spec: "150*200*1000", unit: "본", planned: 120, produced: 120, defect: 3 },
  ], notes: "경계석 몰드 2번 보수 필요", createdBy: "김철수", createdAt: "2026-09-08T17:30:00" },
  { id: "pr2", date: "2026-09-09", line: "1라인", workers: ["김철수", "박민수"], hours: 8, weather: "흐림", items: [
    { productId: "pd2", name: "흄관 D800", spec: "L=2,500", unit: "본", planned: 10, produced: 8, defect: 0 },
    { productId: "pd5", name: "보도블록 (투수)", spec: "300*300*60", unit: "㎡", planned: 60, produced: 60, defect: 2 },
  ], notes: "D800 몰드 1개 점검으로 계획 대비 2본 미달", createdBy: "김철수", createdAt: "2026-09-09T17:30:00" },
];

export const attendance: Attendance[] = [
  { id: "at1", date: "2026-09-08", memberId: "m1", name: "김철수", status: "출근", checkIn: "08:00", checkOut: "18:30", overtime: 1 },
  { id: "at2", date: "2026-09-08", memberId: "m3", name: "박민수", status: "출근", checkIn: "08:05", checkOut: "17:30" },
  { id: "at3", date: "2026-09-08", memberId: "m2", name: "이영희", status: "외근", memo: "○○건설 현장 방문" },
  { id: "at4", date: "2026-09-09", memberId: "m1", name: "김철수", status: "출근", checkIn: "07:55", checkOut: "17:30" },
  { id: "at5", date: "2026-09-09", memberId: "m3", name: "박민수", status: "출근", checkIn: "08:10", checkOut: "17:30" },
  { id: "at6", date: "2026-09-09", memberId: "m4", name: "최준영", status: "휴가" },
];

/* ───────── 원자재 ───────── */

export interface Material {
  id: string;
  name: string; // 시멘트, 골재, 자갈, 혼화재, 수로관 철망
  unit: string; // ton, ㎥(루베), kg, EA
  safetyStock?: number;
  memo?: string;
  createdAt: string;
}

export type MaterialMoveType = "기초재고" | "매입입고" | "생산사용" | "재고조정" | "폐기";

export interface MaterialMove {
  id: string;
  date: string;
  materialId: string;
  type: MaterialMoveType;
  qty: number; // 입고 +, 사용 -
  ref?: string; // 매입 id, 생산일보 id
  refLabel?: string;
  memo?: string;
  createdBy?: string;
  createdAt: string;
}

export const materials: Material[] = [
  { id: "mt1", name: "시멘트", unit: "ton", safetyStock: 20, createdAt: "2026-01-05" },
  { id: "mt2", name: "골재(모래)", unit: "㎥", safetyStock: 30, memo: "1루베 단위", createdAt: "2026-01-05" },
  { id: "mt3", name: "자갈", unit: "㎥", safetyStock: 30, memo: "1루베 단위", createdAt: "2026-01-05" },
  { id: "mt4", name: "혼화재", unit: "kg", safetyStock: 200, createdAt: "2026-01-05" },
  { id: "mt5", name: "수로관 철망", unit: "EA", safetyStock: 50, createdAt: "2026-01-05" },
];

export const materialMoves: MaterialMove[] = [
  { id: "mm1", date: "2026-08-31", materialId: "mt1", type: "기초재고", qty: 48, memo: "8월 말 실사", createdAt: "2026-08-31T18:00:00" },
  { id: "mm2", date: "2026-08-31", materialId: "mt2", type: "기초재고", qty: 85, memo: "8월 말 실사", createdAt: "2026-08-31T18:00:00" },
  { id: "mm3", date: "2026-08-31", materialId: "mt3", type: "기초재고", qty: 92, memo: "8월 말 실사", createdAt: "2026-08-31T18:00:00" },
  { id: "mm4", date: "2026-08-31", materialId: "mt4", type: "기초재고", qty: 640, memo: "8월 말 실사", createdAt: "2026-08-31T18:00:00" },
  { id: "mm5", date: "2026-08-31", materialId: "mt5", type: "기초재고", qty: 130, memo: "8월 말 실사", createdAt: "2026-08-31T18:00:00" },
  { id: "mm6", date: "2026-09-08", materialId: "mt1", type: "생산사용", qty: -9.1, ref: "pr1", refLabel: "생산일보 9/8", createdAt: "2026-09-08T17:30:00" },
  { id: "mm7", date: "2026-09-08", materialId: "mt2", type: "생산사용", qty: -13.2, ref: "pr1", refLabel: "생산일보 9/8", createdAt: "2026-09-08T17:30:00" },
  { id: "mm8", date: "2026-09-08", materialId: "mt3", type: "생산사용", qty: -14.4, ref: "pr1", refLabel: "생산일보 9/8", createdAt: "2026-09-08T17:30:00" },
  { id: "mm9", date: "2026-09-08", materialId: "mt5", type: "생산사용", qty: -24, ref: "pr1", refLabel: "생산일보 9/8", createdAt: "2026-09-08T17:30:00" },
];

/* ───────── 배차·출고 ───────── */

export interface Vehicle {
  id: string;
  plate: string; // 차량번호
  name?: string; // 예: 5톤 카고, 25톤 트레일러
  driver?: string;
  driverPhone?: string;
  own: boolean; // 자차 true / 용차(외주) false
  memo?: string;
}

export type DispatchStatus = "대기" | "상차완료" | "출발" | "도착" | "인수완료" | "취소";
export const dispatchSteps: DispatchStatus[] = ["대기", "상차완료", "출발", "도착", "인수완료"];

export interface DispatchPhoto {
  id: string;
  kind: "상차" | "인수" | "기타";
  image: string; // data URL (jpeg)
  at: string;
  note?: string;
}

/** 배차 한 건 = 차 한 대가 한 현장에 가는 일 */
export interface Dispatch {
  id: string;
  token: string; // 기사님 링크 (/deliver/<token>)
  date: string;
  revenueId?: string;
  docNumber?: string; // 거래명세표 번호
  customer: string;
  site?: string; // 현장명
  address?: string;
  contact?: string; // 현장 담당자 연락처
  items: QuoteItem[];
  vehicle: string; // 차량번호 (+차종)
  driver: string;
  driverPhone?: string;
  own: boolean;
  carrier?: "자차" | "용차" | "거래처차량"; // 누구 차인지 (없으면 own 으로 판단)
  status: DispatchStatus;
  log: { status: DispatchStatus; at: string; by?: string }[];
  photos: DispatchPhoto[];
  memo?: string;
  createdBy?: string;
  createdAt: string;
}

export const vehicles: Vehicle[] = [
  { id: "v1", plate: "전남 81바 1234", name: "5톤 카고 (크레인)", driver: "박민수", driverPhone: "010-4444-5555", own: true },
  { id: "v2", plate: "전남 82사 5678", name: "11톤 카고", driver: "최준영", driverPhone: "010-6666-7777", own: true },
  { id: "v3", plate: "용차 (○○운수)", name: "25톤 트레일러", driver: "○○운수 기사", driverPhone: "010-1234-0000", own: false },
];

export const dispatches: Dispatch[] = [
  { id: "dp1", token: "sample-dispatch-token-000000001", date: "2026-09-09", docNumber: "ST-2609-001", customer: "○○건설", site: "○○지구 우수관로 공사", address: "전남 ○○군 ○○면", contact: "김현장 010-1111-2222", items: [{ name: "흄관 D600", spec: "L=2,500", unit: "본", qty: 30, unitPrice: 185000 }], vehicle: "전남 81바 1234 · 5톤 카고 (크레인)", driver: "박민수", driverPhone: "010-4444-5555", own: true, status: "인수완료", log: [{ status: "대기", at: "2026-09-09T07:30:00" }, { status: "상차완료", at: "2026-09-09T08:10:00", by: "박민수" }, { status: "출발", at: "2026-09-09T08:15:00", by: "박민수" }, { status: "도착", at: "2026-09-09T09:40:00", by: "박민수" }, { status: "인수완료", at: "2026-09-09T10:05:00", by: "박민수" }], photos: [], createdBy: "관리자", createdAt: "2026-09-09T07:30:00" },
];

/* ───────── 품질관리 (자체 시험성적서) ───────── */

export type QualityResult = "합격" | "불합격" | "판정대기";

/** 시험 1건 (품목·타설일 기준). 양식은 회사 자체 시험성적서에 맞춰 칸을 둔 것이며, 필요하면 칸을 늘립니다 */
export interface QualityTest {
  id: string;
  date: string; // 시험일
  castDate?: string; // 타설(제조)일
  productId?: string;
  productName: string;
  spec?: string;
  batchNo?: string; // 배치·로트 번호
  productionId?: string; // 생산일보 연결
  testType: string; // 압축강도, 휨강도, 외압강도, 흡수율, 치수 등
  age?: number; // 재령(일) 7 / 28
  sampleCount?: number; // 공시체 수
  values: number[]; // 측정값 (MPa, kN 등)
  unit: string; // MPa, kN, %, mm
  standard?: number; // 기준값 (이상)
  result: QualityResult;
  tester?: string; // 시험자
  reviewer?: string; // 검토자
  certNo?: string; // 성적서 번호
  attachment?: { name: string; data: string }; // 성적서 파일 (PDF/사진, data URL)
  memo?: string;
  createdBy?: string;
  createdAt: string;
}

export const qualityTestTypes = ["압축강도", "휨강도", "외압강도", "흡수율", "치수검사", "외관검사", "기타"];

export const qualityTests: QualityTest[] = [
  { id: "qt1", date: "2026-09-08", castDate: "2026-08-11", productId: "pd1", productName: "흄관 D600", spec: "L=2,500", batchNo: "260811-A", testType: "외압강도", age: 28, sampleCount: 3, values: [52.1, 53.4, 51.8], unit: "kN/m", standard: 50, result: "합격", tester: "박민수", reviewer: "관리자", certNo: "QC-2609-001", createdBy: "박민수", createdAt: "2026-09-08T16:00:00" },
  { id: "qt2", date: "2026-09-09", castDate: "2026-09-02", productId: "pd4", productName: "도로 경계석", spec: "150*200*1000", batchNo: "260902-B", testType: "휨강도", age: 7, sampleCount: 3, values: [4.6, 4.9, 4.7], unit: "MPa", standard: 5, result: "판정대기", tester: "박민수", memo: "28일 재령 시험 후 최종 판정", createdBy: "박민수", createdAt: "2026-09-09T16:00:00" },
];

/* ───────── 급여 (출근부 집계) ───────── */

export type PayType = "월급" | "일급" | "시급";

/** 직원별 급여 기준. 출근부 기록과 곱해 월 급여 집계표를 만듭니다 */
export interface PayProfile {
  memberId: string;
  name: string;
  payType: PayType;
  basePay: number; // 월급 / 일급 / 시급
  hourlyForOvertime?: number; // 연장근무 시급 (비우면 월급÷209, 일급÷8, 시급 그대로)
  overtimeRate?: number; // 연장 배율 (기본 1.5)
  allowances?: { name: string; amount: number }[]; // 고정 수당 (식대, 교통비 …)
  deductions?: { name: string; amount: number }[]; // 고정 공제 (가불 등)
  standardDays?: number; // 월급제 결근 공제 기준 근무일 (기본 22)
  memo?: string;
}

export const payProfiles: PayProfile[] = [
  { memberId: "m1", name: "김철수", payType: "월급", basePay: 3200000, overtimeRate: 1.5, allowances: [{ name: "식대", amount: 200000 }], standardDays: 22 },
  { memberId: "m3", name: "박민수", payType: "일급", basePay: 150000, overtimeRate: 1.5, allowances: [{ name: "식대", amount: 200000 }] },
];

/* ───────── 현장 직원 (로그인 계정 없이 출근부·생산일보에만 쓰는 인원) ───────── */
export interface Worker {
  id: string;
  name: string;
  team: string; // 생산1팀, 야적장 …
  phone?: string;
  joinedAt?: string;
  active: boolean;
  memo?: string;
}
export const workers: Worker[] = [];
