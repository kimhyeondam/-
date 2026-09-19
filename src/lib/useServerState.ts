"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type Updater<T> = T | ((prev: T) => T);

/**
 * 서버 저장소와 연결된 상태.
 * - 화면이 뜨면 서버에서 불러오고(loaded=true), 값이 바뀌면 0.5초 뒤 서버에 저장합니다.
 * - 불러오기 전에 바뀐 값은 줄을 세워 뒀다가 서버 데이터 위에 순서대로 적용합니다.
 * - 저장을 기다리는 중에 화면을 떠나면 그 즉시 저장합니다.
 * - 서버에 아직 데이터가 없으면: 예전 브라우저 임시 저장(localStorage)에 있던 값 → 없으면 기본값(initial)을 올려 둡니다.
 */
/** 브라우저 임시 저장(탭을 닫으면 사라짐): 다른 화면에 갔다 와도 마지막 자료를 바로 보여 주기 위해 */
const CACHE_MAX = 400_000; // 이보다 큰 자료는 저장하지 않음 (글자 수)
const CACHE_TTL = 10 * 60_000; // 10분 지난 것은 쓰지 않음
function cacheRead<T>(collection: string): T | null {
  try {
    const raw = sessionStorage.getItem(`jeil.cache.${collection}`);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: T };
    return Date.now() - at < CACHE_TTL ? data : null;
  } catch { return null; }
}
function cacheWrite(collection: string, data: unknown) {
  try { const s = JSON.stringify({ at: Date.now(), data }); if (s.length <= CACHE_MAX) sessionStorage.setItem(`jeil.cache.${collection}`, s); else sessionStorage.removeItem(`jeil.cache.${collection}`); } catch { /* 공간 부족 등 */ }
}

export function useServerState<T>(collection: string, initial: T, legacyKey?: string) {
  // 지난번에 받아 둔 자료가 있으면 그것으로 먼저 그리고(loaded=true), 서버 답이 오면 바꿔 끼웁니다.
  // (서버 렌더링과 첫 화면이 같아야 하므로 캐시는 화면이 붙은 직후에 읽습니다)
  const cached = useRef<T | null>(null);
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const pending = useRef<Updater<T>[]>([]); // 불러오기 전에 들어온 변경
  const unsaved = useRef(false); // 서버에 아직 안 보낸 변경이 있는지
  const latest = useRef<T>(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Updater<T>[]>([]); // 마지막 저장 이후 들어온 변경 (서버 최신 데이터 위에 다시 적용하기 위해)
  const saving = useRef(false);
  const [retry, setRetry] = useState(0); // 저장 중에 또 바뀐 게 있으면 저장 뒤 한 번 더 돌리기 위한 신호

  const put = useCallback(
    async (data: T, keepalive = false) => {
      const res = await fetch(`/api/data/${collection}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }), keepalive });
      if (!res.ok) throw new Error(`저장 실패 (${res.status})`);
    },
    [collection],
  );

  /**
   * 저장: 서버의 최신 데이터를 먼저 읽고, 그 위에 이 화면에서 바꾼 것(갱신 함수들)을 다시 적용해서 올립니다.
   * 같은 데이터를 여러 화면(예: 현담비서 업로드 창과 매출관리)이 각자 들고 있어도 서로의 변경을 덮어쓰지 않습니다.
   */
  const save = useCallback(
    async (data: T, keepalive = false) => {
      if (keepalive) {
        // 화면을 떠나는 순간에는 읽을 시간이 없어 지금 값을 그대로 보냅니다
        try { await put(data, true); } catch (e) { setError((e as Error).message); }
        return;
      }
      if (saving.current) { unsaved.current = true; return; }
      saving.current = true;
      const ops = queue.current;
      queue.current = [];
      try {
        let next = data;
        const canReplay = ops.length > 0 && ops.every((u) => typeof u === "function");
        if (canReplay) {
          const res = await fetch(`/api/data/${collection}`, { cache: "no-store" });
          if (res.ok) {
            const row = (await res.json()) as { data: T | null };
            if (row.data !== null) {
              next = row.data;
              for (const u of ops) next = (u as (p: T) => T)(next);
            }
          }
        }
        await put(next);
        cacheWrite(collection, next);
        // 서버 것과 합쳐진 결과를 화면에도 반영 (그 사이 또 바뀐 게 있으면 그 위에 적용)
        if (queue.current.length === 0) { latest.current = next; setValue(next); }
        setError(null);
      } catch (e) {
        queue.current = [...ops, ...queue.current];
        setError((e as Error).message);
      } finally {
        saving.current = false;
        if (queue.current.length) { unsaved.current = true; setRetry((n) => n + 1); }
      }
    },
    [collection, put],
  );

  // 0) 화면이 붙자마자 브라우저 임시 저장분을 먼저 보여 줌 (그리기 전에 실행되어 깜빡임 없음)
  useLayoutEffect(() => {
    const c = cacheRead<T>(collection);
    if (c === null || loadedRef.current) return;
    cached.current = c; latest.current = c; loadedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(c); setLoaded(true);
  }, [collection]);

  // 1) 처음 불러오기
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/data/${collection}`);
        if (!res.ok) throw new Error(`불러오기 실패 (${res.status})`);
        const row = (await res.json()) as { data: T | null };
        if (!alive) return;
        let base: T;
        let needSeed = false;
        if (row.data !== null) {
          base = row.data;
        } else {
          base = initial;
          needSeed = true;
          if (legacyKey) {
            try {
              const raw = window.localStorage.getItem(legacyKey);
              if (raw) base = JSON.parse(raw) as T;
            } catch {}
          }
        }
        // 불러오기 전에 바뀐 것을 서버 데이터 위에 적용
        const queued = pending.current;
        pending.current = [];
        let next = base;
        for (const u of queued) next = typeof u === "function" ? (u as (p: T) => T)(next) : u;
        // 캐시로 먼저 그린 뒤 사용자가 바꾼 것(queue)이 있으면 서버 값 위에 다시 적용해 화면이 되돌아가지 않게 합니다
        if (cached.current !== null && queue.current.length) { for (const u of queue.current) if (typeof u === "function") next = (u as (p: T) => T)(next); }
        latest.current = next;
        setValue(next);
        loadedRef.current = true;
        setLoaded(true);
        if (!needSeed) cacheWrite(collection, base);
        if (needSeed || queued.length) { try { await put(next); } catch (e) { setError((e as Error).message); } }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  // 2) 값 바꾸기
  const update = useCallback((next: Updater<T>) => {
    if (!loadedRef.current) {
      pending.current.push(next);
      setValue((prev) => (typeof next === "function" ? (next as (p: T) => T)(prev) : next)); // 화면에는 바로 반영
      return;
    }
    unsaved.current = true;
    queue.current.push(next);
    // 최신 값을 바로 계산해 둡니다. (React 가 갱신 함수를 나중에 실행하면, 그 사이 화면이 닫힐 때 옛 값이 저장될 수 있음)
    const v = typeof next === "function" ? (next as (p: T) => T)(latest.current) : next;
    latest.current = v;
    setValue(v);
  }, []);

  // 3) 바뀐 뒤 0.5초 지나면 저장 (연달아 바뀌면 마지막 것만)
  useEffect(() => {
    if (!loaded || !unsaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      unsaved.current = false;
      save(latest.current);
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, loaded, save, retry]);

  // 4) 화면을 떠날 때 저장이 남아 있으면 즉시 보냄
  useEffect(() => {
    const flush = () => {
      if (unsaved.current && loadedRef.current) {
        unsaved.current = false;
        if (timer.current) clearTimeout(timer.current);
        save(latest.current, true);
      }
    };
    const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
      flush();
    };
  }, [save]);

  return [value, update, loaded, error] as const;
}
