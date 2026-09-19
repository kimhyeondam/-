// 계약 템플릿의 {{빈칸}}을 실제 값으로 채웁니다. (브라우저/서버 공용)
import type { CompanyProfile } from "@/data/sample";
import { toKoreanNumber, fmtDateKo } from "@/lib/documents/calc";

export interface ContractFields {
  customer: string;
  customerRef?: string;
  amount: number;
  startDate?: string;
  endDate?: string;
  items?: string;
  special?: string;
  date: string; // 계약일
}

export function fillTemplate(body: string, f: ContractFields, company: CompanyProfile) {
  const period = f.startDate && f.endDate ? `${fmtDateKo(f.startDate)} ~ ${fmtDateKo(f.endDate)}` : f.startDate ? `${fmtDateKo(f.startDate)}부터` : "협의";
  const map: Record<string, string> = {
    "{{고객명}}": f.customer || "________",
    "{{고객담당자}}": f.customerRef || "",
    "{{공급자명}}": company.name,
    "{{공급자대표}}": company.ceo,
    "{{공급자주소}}": company.address,
    "{{계약금액}}": (f.amount || 0).toLocaleString("ko-KR"),
    "{{계약금액한글}}": toKoreanNumber(f.amount || 0),
    "{{계약기간}}": period,
    "{{시작일}}": f.startDate ? fmtDateKo(f.startDate) : "____년 __월 __일",
    "{{종료일}}": f.endDate ? fmtDateKo(f.endDate) : "____년 __월 __일",
    "{{품목}}": f.items || "별첨 견적서와 같음",
    "{{계약일}}": fmtDateKo(f.date),
    "{{특약}}": f.special?.trim() || "해당 없음",
  };
  return body.replace(/\{\{[^}]+\}\}/g, (k) => map[k] ?? k);
}
