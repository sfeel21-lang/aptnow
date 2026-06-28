import { memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { displayAptName } from "@/lib/utils/format";
import type { AptDeal } from "@/types";

interface DealCardProps {
  /** 거래 데이터 (changeRate 포함 가능) */
  deal: AptDeal;
  /** 지역(시군구) 라벨 — 예: "강남구" */
  region?: string;
  /** 단지 상세 페이지 href */
  href: string;
}

/**
 * 변동률 텍스트/색상 정보를 만든다.
 * - 양수/0: 상승(빨강, ▲), 음수: 하락(파랑, ▼)
 */
function getChangeInfo(
  changeRate: number | undefined,
): { text: string; className: string } | null {
  if (changeRate === undefined) return null;
  const isUp = changeRate >= 0;
  const arrow = isUp ? "▲" : "▼";
  return {
    text: `${arrow} 전고가 대비 ${isUp ? "+" : "-"}${Math.abs(changeRate).toFixed(1)}%`,
    className: isUp ? "text-up" : "text-down",
  };
}

/**
 * 모바일용 거래 카드.
 * - 단지명/신고가 배지 · 평형·층·지역 · 거래금액·계약일 · 변동률을 표시한다.
 * - React.memo 로 불필요한 리렌더를 방지한다.
 */
function DealCardBase({ deal, region, href }: DealCardProps): JSX.Element {
  const change = getChangeInfo(deal.changeRate);
  // 계약일 "2024.11.07" → "24.11.07"
  const shortDate = deal.dealDate.slice(2);

  return (
    <Link
      href={href}
      className={cn(
        "block w-full rounded-lg border bg-card p-4 text-left shadow-sm outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary",
        deal.isNewHigh && "border-l-[3px] border-l-accent bg-[#FFF5F5]",
      )}
    >
      {/* 1행: 단지명 + 신고가 배지 */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-heading font-semibold">
          {displayAptName(deal.aptName)}
        </span>
        {deal.isNewHigh ? (
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
            신고가
          </span>
        ) : null}
      </div>

      {/* 2행: 평형 · 층 · 지역 */}
      <p className="mt-1 text-sm text-content-secondary">
        {deal.pyeong}평 · {deal.floor}층 ·{" "}
        {region ? `${region} ` : ""}
        {deal.dong}
      </p>

      {/* 3행: 거래금액 + 계약일 */}
      <div className="mt-3 flex items-end justify-between">
        <span className="text-lg font-bold tabular-nums">{deal.amountText}</span>
        <span className="text-xs tabular-nums text-content-muted">
          {shortDate}
        </span>
      </div>

      {/* 4행: 변동률 (있을 때만) */}
      {change ? (
        <p className={cn("mt-1 text-xs font-medium", change.className)}>
          {change.text}
        </p>
      ) : null}
    </Link>
  );
}

export const DealCard = memo(DealCardBase);
