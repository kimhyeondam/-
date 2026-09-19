// 서버에서 모든 화면 데이터를 한 번에 읽습니다. (대시보드, AI 비서)
import { getStore } from "@/lib/store";
import { sampleCollections, type Collections } from "@/lib/assistantContext";

export async function loadCollections(): Promise<Collections> {
  const store = getStore();
  const out = { ...sampleCollections } as Collections;
  await Promise.all(
    (Object.keys(sampleCollections) as (keyof Collections)[]).map(async (name) => {
      const row = await store.get<Collections[typeof name]>(name);
      if (row && Array.isArray(row.data)) (out as unknown as Record<string, unknown>)[name] = row.data;
    }),
  );
  return out;
}
