// 화면에서 새 항목의 id 를 만들 때 씁니다. (React 순수성 규칙 때문에 컴포넌트 안에서 Date.now() 를 직접 부르지 않도록 분리)
let seq = 0;
export function newId(prefix: string) {
  seq = (seq + 1) % 1000;
  return `${prefix}${Date.now()}${seq ? `_${seq}` : ""}`;
}
/** 지금 시각을 한국 시간 기준 "YYYY-MM-DDTHH:mm:ss" 로 (서버가 UTC여도 화면에 한국 시각이 보이도록) */
export function nowIso() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 19);
}
