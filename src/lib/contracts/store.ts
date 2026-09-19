// 계약 데이터 읽기/쓰기 (서버)
import { getStore } from "@/lib/store";
import { contracts as sampleContracts, type Contract } from "@/data/sample";

export async function getContracts(): Promise<Contract[]> {
  const row = await getStore().get<Contract[]>("contracts");
  return Array.isArray(row?.data) ? row.data : sampleContracts;
}
export async function saveContracts(list: Contract[]) {
  await getStore().set("contracts", list);
}
export async function updateContract(id: string, patch: Partial<Contract>) {
  const list = await getContracts();
  const target = list.find((c) => c.id === id);
  if (!target) return null;
  const updated = { ...target, ...patch };
  await saveContracts(list.map((c) => (c.id === id ? updated : c)));
  return updated;
}
