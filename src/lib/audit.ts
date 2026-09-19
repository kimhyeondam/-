// 활동 기록(로그): 누가 언제 무엇을 했는지 서버 저장소 "auditLog"에 남깁니다.
import { getStore } from "@/lib/store";

export interface AuditEntry {
  at: string; // ISO
  user: string; // 직원 이름
  userId?: string;
  action: string; // 예: 로그인, 저장, 직원 추가, 메일 발송
  target?: string; // 예: 할일관리, 견적서 QT-2609-001
  detail?: string;
}

export const collectionLabels: Record<string, string> = {
  tasks: "할일관리", events: "일정관리", projects: "프로젝트관리", customers: "고객관리", leads: "리드관리", quotations: "견적관리",
  revenues: "매출관리", deposits: "입금관리", purchases: "매입관리", resources: "자료실", businessCards: "명함관리", meetings: "미팅관리",
  documents: "양식 문서", settings: "시스템 설정", receipts: "인수증", suggestions: "건의사항", assistantUsage: "AI 사용량", contracts: "계약관리", contractTemplates: "계약 템플릿",
};

export async function audit(entry: Omit<AuditEntry, "at">) {
  try {
    const store = getStore();
    const apply = (prev: AuditEntry[] | null) => [{ ...entry, at: new Date().toISOString() }, ...(Array.isArray(prev) ? prev : [])].slice(0, 5000);
    if (store.update) await store.update<AuditEntry[]>("auditLog", apply);
    else { const row = await store.get<AuditEntry[]>("auditLog"); await store.set("auditLog", apply(row?.data ?? null)); }
  } catch {
    // 기록 실패가 본 작업을 막지 않도록 조용히 무시
  }
}

export async function getAuditLog() {
  try {
    const row = await getStore().get<AuditEntry[]>("auditLog");
    return Array.isArray(row?.data) ? row.data : [];
  } catch {
    // 기록 파일이 깨졌으면 빈 목록으로 시작 (깨진 파일은 .corrupt-… 로 남습니다)
    await getStore().set("auditLog", []).catch(() => {});
    return [];
  }
}
