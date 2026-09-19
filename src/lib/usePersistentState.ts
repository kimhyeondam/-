"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 브라우저에 임시 저장되는 상태.
 * - 새로고침해도 값이 남아 있습니다. (이 컴퓨터, 이 브라우저에서만)
 * - 나중에 데이터베이스 저장 단계에서 서버 저장으로 교체할 자리입니다.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const skipFirstSave = useRef(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      // 화면이 먼저 그려진 뒤(hydration 이후) 저장된 값을 불러와야 서버/브라우저 화면이 어긋나지 않습니다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      // 저장소를 못 읽으면 기본값으로 시작
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 저장 실패는 무시 (시크릿 모드 등)
    }
  }, [key, value, loaded]);

  return [value, setValue, loaded] as const;
}
