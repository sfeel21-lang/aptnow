"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DealTable } from "@/components/deals/DealTable";
import { CopyButton } from "@/components/deals/CopyButton";
import type { AptDeal } from "@/types";

/** /api/deals 응답 형태 (필요한 부분만) */
interface DealsApiResponse {
  success: boolean;
  data: AptDeal[];
  meta?: { region: string; period: string; newHighCount: number };
  error?: string;
}

/**
 * 선택된 지역(lawdCd 쿼리)의 실거래가를 조회해 DealTable 로 표시한다.
 * - RegionSelector 가 URL 에 넣은 lawdCd 를 읽어 /api/deals 를 호출한다.
 */
export function DealResults(): JSX.Element | null {
  const searchParams = useSearchParams();
  const lawdCd = searchParams.get("lawdCd");
  const gugun = searchParams.get("gugun") ?? undefined;

  const [deals, setDeals] = useState<AptDeal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lawdCd) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/deals?lawdCd=${lawdCd}&months=3`)
      .then((res) => res.json() as Promise<DealsApiResponse>)
      .then((json) => {
        if (cancelled) return;
        if (json.success) setDeals(json.data);
        else setError(json.error ?? "조회에 실패했습니다.");
      })
      .catch(() => {
        if (!cancelled) setError("네트워크 오류가 발생했습니다.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lawdCd]);

  // 지역 미선택 시 아무것도 렌더하지 않음
  if (!lawdCd) return null;

  if (error) {
    return (
      <p className="rounded-md border border-accent/30 bg-[#FFF5F5] px-4 py-3 text-sm text-accent">
        {error}
      </p>
    );
  }

  return (
    <>
      <DealTable deals={deals} isLoading={isLoading} region={gugun} />
      {/* 공유(카페 복사) 영역 — 데이터가 있을 때만 노출 */}
      {!isLoading && deals.length > 0 ? (
        <CopyButton deals={deals} region={gugun ?? "전체"} />
      ) : null}
    </>
  );
}
