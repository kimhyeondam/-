export function formatWon(n: number) {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

/** 1,195만 / 2.2억 처럼 짧게 */
export function formatWonShort(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(n % 100_000_000 === 0 ? 0 : 1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString("ko-KR")}만`;
  return n.toLocaleString("ko-KR");
}

/** 오늘 날짜(YYYY-MM-DD)를 한국 시간 기준으로. 서버(UTC 컨테이너)에서도 같은 날짜가 나옵니다. */
export function todayIso() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 휴대폰처럼 좁은 칸용: 293,615,678원 → 2억 9,362만원, 36,545,678원 → 3,655만원 */
export function formatWonCompact(n: number) {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(Math.round(n));
  if (a >= 100_000_000) {
    const eok = Math.floor(a / 100_000_000);
    const man = Math.round((a % 100_000_000) / 10_000);
    return `${sign}${eok}억${man ? ` ${man.toLocaleString("ko-KR")}만` : ""}원`;
  }
  if (a >= 10_000) return `${sign}${Math.round(a / 10_000).toLocaleString("ko-KR")}만원`;
  return `${sign}${a.toLocaleString("ko-KR")}원`;
}
