// 현담비서 사용 기록 (서버 저장소 "assistantUsage" 컬렉션)
export interface UsageEntry {
  at: string; // ISO
  question: string;
  user?: string; // 질문한 직원
  mode: "claude" | "local";
  inputTokens: number; // 입력 전체 (캐시 재사용·저장분 포함)
  outputTokens: number;
  cacheRead?: number; // 이 중 캐시에서 재사용한 토큰 (요금 1/10)
  cacheWrite?: number; // 이 중 캐시에 새로 저장한 토큰 (요금 1.25배)
}

// 예상 비용: claude-sonnet-5 기준 입력 $2 / 출력 $10 (백만 토큰당). 캐시 재사용은 입력 요금의 10%, 캐시 저장은 125%. 환율 1,400원 가정
export function estimateCostKrw(inputTokens: number, outputTokens: number, cacheRead = 0, cacheWrite = 0) {
  const fresh = Math.max(inputTokens - cacheRead - cacheWrite, 0);
  const usd = (fresh / 1_000_000) * 2 + (cacheRead / 1_000_000) * 0.2 + (cacheWrite / 1_000_000) * 2.5 + (outputTokens / 1_000_000) * 10;
  return Math.round(usd * 1400);
}
