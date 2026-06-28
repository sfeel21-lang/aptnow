"use client";

import { useEffect, useState } from "react";

interface VisitorsResponse {
  count: number;
  estimated: boolean;
}

/**
 * "오늘 N명 방문중" 카운터 (신뢰도 구축용).
 * - /api/visitors 를 조회해 표시하고, 1분마다 갱신한다.
 * - 조회 실패 시 아무것도 표시하지 않는다.
 */
export function VisitorCounter(): JSX.Element | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = (): void => {
      fetch("/api/visitors")
        .then((res) => res.json() as Promise<VisitorsResponse>)
        .then((data) => {
          if (!cancelled) setCount(data.count);
        })
        .catch(() => {
          /* 무시 */
        });
    };

    load();
    const timer = window.setInterval(load, 60_000); // 1분마다 갱신
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (count === null) return null;

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-content-secondary lg:inline-flex"
      aria-label={`오늘 ${count}명 방문중`}
    >
      {/* 온라인 표시 점 */}
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#03C75A] opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#03C75A]" />
      </span>
      오늘 <span className="num font-semibold text-content">{count.toLocaleString("ko-KR")}</span>명 방문중
    </span>
  );
}
