"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { displayAptName } from "@/lib/utils/format";
import type { AptDeal } from "@/types";

/** 평형대 필터 */
const SIZE_FILTERS = [
  { id: "all", label: "전체 평형" },
  { id: "10", label: "10평대" },
  { id: "20", label: "20평대" },
  { id: "30", label: "30평대" },
  { id: "40", label: "40평대" },
  { id: "50", label: "50평↑" },
] as const;
type SizeFilterId = (typeof SIZE_FILTERS)[number]["id"];

/** 상위 노출 개수 */
const TOP_N = 30;

interface RankingViewProps {
  /** 지역 거래 목록 (히스토리) */
  deals: AptDeal[];
  /** 지역 라벨 (예: "서울 강남구") */
  regionLabel: string;
  /** 단지 상세 페이지 기본 경로 (예: "/서울특별시/강남구") */
  basePath: string;
}

function matchSize(pyeong: number, filter: SizeFilterId): boolean {
  switch (filter) {
    case "all":
      return true;
    case "10":
      return pyeong < 20;
    case "20":
      return pyeong >= 20 && pyeong < 30;
    case "30":
      return pyeong >= 30 && pyeong < 40;
    case "40":
      return pyeong >= 40 && pyeong < 50;
    case "50":
      return pyeong >= 50;
    default:
      return true;
  }
}

/** 계약일 "2026.04.25" → "26년 4월" */
function contractLabel(dealDate: string): string {
  const [y = "", m = ""] = dealDate.split(".");
  return `${y.slice(2)}년 ${Number(m)}월`;
}

/** 순위 색상 (1~3위 강조) */
function rankClass(rank: number): string {
  if (rank === 1) return "text-primary";
  if (rank === 2) return "text-accent";
  if (rank === 3) return "text-[#16A34A]";
  return "text-content-secondary";
}

/**
 * 지역 최고가 아파트 순위.
 * - 평형대별로 단지의 최고 거래가를 집계해 내림차순 순위로 보여준다.
 * - 12개월 히스토리에서 계산하며, 평형 칩으로 즉시 필터/재정렬한다.
 */
export function RankingView({
  deals,
  regionLabel,
  basePath,
}: RankingViewProps): JSX.Element {
  const [band, setBand] = useState<SizeFilterId>("all");

  // 단지별 최고가 집계 → 내림차순 순위
  const ranked = useMemo(() => {
    const filtered =
      band === "all" ? deals : deals.filter((d) => matchSize(d.pyeong, band));
    // 단지명 기준 최고가 거래 1건
    const topByApt = new Map<string, AptDeal>();
    for (const d of filtered) {
      const cur = topByApt.get(d.aptName);
      if (!cur || d.amount > cur.amount) topByApt.set(d.aptName, d);
    }
    return [...topByApt.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, TOP_N);
  }, [deals, band]);

  return (
    <div className="mt-4">
      {/* 평형 필터 */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="평형 선택">
        {SIZE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setBand(f.id)}
            aria-pressed={band === f.id}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
              band === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-content-secondary hover:text-content",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 순위 리스트 */}
      {ranked.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed py-16 text-center text-sm text-content-muted">
          해당 조건의 거래가 없습니다.
        </p>
      ) : (
        <ol className="mt-4 overflow-hidden rounded-lg border">
          {ranked.map((deal, i) => {
            const rank = i + 1;
            const href = `${basePath}/${encodeURIComponent(deal.aptName)}${deal.dong ? `?dong=${encodeURIComponent(deal.dong)}` : ""}`;
            return (
              <li key={deal.aptName} className="border-b last:border-b-0">
                <Link
                  href={href}
                  className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-surface focus-visible:bg-surface"
                >
                  {/* 순위 */}
                  <span
                    className={cn(
                      "w-8 shrink-0 text-center font-bold tabular-nums",
                      rankClass(rank),
                    )}
                  >
                    {rank}위
                  </span>

                  {/* 단지 정보 */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading font-semibold">
                      {displayAptName(deal.aptName)}
                      {deal.buildYear > 0 ? (
                        <span className="ml-1.5 text-xs font-normal text-content-muted">
                          {deal.buildYear} 입주
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-content-secondary">
                      {regionLabel} {deal.dong} ·{" "}
                      <span className="tabular-nums">
                        {contractLabel(deal.dealDate)} · {deal.pyeong}평 ·{" "}
                        {deal.floor}층
                      </span>
                    </p>
                  </div>

                  {/* 최고가 */}
                  <span className="shrink-0 text-right font-bold tabular-nums text-primary">
                    {deal.amountText}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-3 text-right text-xs text-content-muted">
        출처: 국토교통부 실거래가 · 최근 12개월 기준
      </p>
    </div>
  );
}
