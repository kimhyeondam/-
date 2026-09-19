// 발송 기록: 누가 어느 계정으로 누구에게 무엇을 보냈는지
import { getStore } from "@/lib/store";

export interface MailLogEntry {
  at: string;
  accountId: string;
  accountEmail: string;
  sentBy: string; // 직원 이름
  to: string;
  subject: string;
  attachments: number;
  ok: boolean;
  error?: string;
}

export async function appendMailLog(entry: MailLogEntry) {
  const store = getStore();
  const row = await store.get<MailLogEntry[]>("mailLog");
  const list = Array.isArray(row?.data) ? row.data : [];
  list.unshift(entry);
  await store.set("mailLog", list.slice(0, 2000));
}

export async function getMailLog() {
  const row = await getStore().get<MailLogEntry[]>("mailLog");
  return Array.isArray(row?.data) ? row.data : [];
}
