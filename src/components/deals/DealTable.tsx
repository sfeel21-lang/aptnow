"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { List, type RowComponentProps } from "react-window";
import { AlertCircle, Flame } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { displayAptName } from "@/lib/utils/format";
import { AdSlot } from "@/components/ui/AdSlot";
import { DealTableSkeleton } from "@/components/ui/Skeleton";
import { DealCard } from "@/components/deals/DealCard";
import type { AptDeal } from "@/types";

/** 단지 상세 페이지 href 생성 (동명이인 분리를 위해 동 포함 + 거래유형 유지) */
function detailHref(
  regionPath: string,
  aptName: string,
  dong?: string,
  dealType?: string,
): string {
  const q = [
    dong ? `dong=${encodeURIComponent(dong)}` : "",
    dealType && dealType !== "sale" ? `type=${dealType}` : "",
  ]
    .filter(Boolean)
    .join("&");
  return `${regionPath}/${encodeURIComponent(aptName)}${q ? `?${q}` : ""}`;
}

/** 목록 인피드 광고 슬롯 ID */
const INFEED_AD_SLOT = "5556667778";

/** 평형대 필터 */
const SIZE_FILTERS = [
  { id: "all", label: "전체" },
  { id: "10", label: "10평대" },
  { id: "20", label: "20평대" },
  { id: "30", label: "30평대" },
  { id: "40", label: "40평대" },
  { id: "50", label: "50평↑" },
] as const;
type SizeFilterId = (typeof SIZE_FILTERS)[number]["id"];

/** 정렬 옵션 */
const SORT_OPTIONS = [
  { id: "latest", label: "최신순" },
  { id: "priceDesc", label: "금액높은순" },
  { id: "priceAsc", label: "금액낮은순" },
] as const;
type SortId = (typeof SORT_OPTIONS)[number]["id"];

/** 가상 스크롤 적용 임계치 (이 건수 초과 시 react-window 사용) */
const VIRTUAL_THRESHOLD = 50;
/** 데이터 행 높이(px) */
const ROW_HEIGHT = 56;
/** 광고 행 높이(px) */
const AD_HEIGHT = 132;
/** 인피드 광고 삽입 위치 (10번째 거래 다음) */
const AD_AFTER_INDEX = 9;
/** 가상 스크롤 컨테이너 높이(px) */
const VIRTUAL_VIEWPORT = 640;

/** PC 테이블 그리드 컬럼 정의 (헤더/행 공통) */
const GRID_COLS =
  "grid grid-cols-[minmax(0,2fr)_1.3fr_0.5fr_1fr_1.3fr_0.9fr] items-center gap-2 px-4";

/** 목록 행: 거래 또는 광고 */
type DisplayRow =
  | { readonly kind: "deal"; readonly deal: AptDeal }
  | { readonly kind: "ad" };

interface DealTableProps {
  /** 거래 목록 */
  deals: AptDeal[];
  /** 로딩 상태 (스켈레톤 표시) */
  isLoading?: boolean;
  /** 지역(시군구) 라벨 — 카드/배너 표기용 */
  region?: string;
  /** 단지 상세 페이지 기본 경로 (예: "/서울특별시/강남구") */
  regionPath?: string;
  /** 거래 유형 (sale/jeonse/wolse) — 상세 링크에 유형을 유지 */
  dealType?: string;
}

/**
 * 평형대 필터 일치 여부.
 */
function matchSize(pyeong: number, filter: SizeFilterId): boolean {
  switch (filter) {
    case "all":
      return true;
    case "10":
      // 20평 미만(소형) — 한 자리 평형까지 모두 포함해 누락 방지
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

/**
 * 아파트 실거래가 목록(핵심 화면).
 * - 필터바(평형대/신고가) + 정렬 + 신고가 배너
 * - PC: sticky 헤더 테이블 (50건 초과 시 가상 스크롤)
 * - 모바일: 카드 리스트
 * - 10번째 행에 AdSense 인피드 광고 삽입
 */
export function DealTable({
  deals,
  isLoading = false,
  region,
  regionPath = "",
  dealType = "sale",
}: DealTableProps): JSX.Element {
  const [sizeFilter, setSizeFilter] = useState<SizeFilterId>("all");
  const [newHighOnly, setNewHighOnly] = useState<boolean>(false);
  const [sort, setSort] = useState<SortId>("latest");
  // 가상 스크롤은 클라이언트 마운트 후에만 사용 (SSR 안전)
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => setMounted(true), []);

  // deals 는 서버에서 changeRate(12개월 전고가 대비)/isNewHigh 가 이미 계산되어 전달된다

  // 전체 신고가 건수 (배너용)
  const newHighCount = useMemo(
    () => deals.filter((d) => d.isNewHigh).length,
    [deals],
  );

  // 평형대별 건수 (신고가 토글 반영) — 필터 칩에 표시
  const sizeCounts = useMemo(() => {
    const base = newHighOnly ? deals.filter((d) => d.isNewHigh) : deals;
    const counts: Record<SizeFilterId, number> = {
      all: base.length,
      "10": 0,
      "20": 0,
      "30": 0,
      "40": 0,
      "50": 0,
    };
    for (const d of base) {
      for (const f of SIZE_FILTERS) {
        if (f.id !== "all" && matchSize(d.pyeong, f.id)) counts[f.id] += 1;
      }
    }
    return counts;
  }, [deals, newHighOnly]);

  // 필터 + 정렬 적용
  const visibleDeals = useMemo(() => {
    const filtered = deals.filter(
      (d) =>
        matchSize(d.pyeong, sizeFilter) && (!newHighOnly || d.isNewHigh),
    );
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "priceDesc") return b.amount - a.amount;
      if (sort === "priceAsc") return a.amount - b.amount;
      return b.dealDate.localeCompare(a.dealDate); // latest
    });
    return sorted;
  }, [deals, sizeFilter, newHighOnly, sort]);

  // 광고를 끼운 표시용 행 목록
  const rows = useMemo<DisplayRow[]>(() => {
    const list: DisplayRow[] = [];
    visibleDeals.forEach((deal, index) => {
      list.push({ kind: "deal", deal });
      if (index === AD_AFTER_INDEX && visibleDeals.length > AD_AFTER_INDEX + 1) {
        list.push({ kind: "ad" });
      }
    });
    return list;
  }, [visibleDeals]);

  const useVirtual = mounted && visibleDeals.length > VIRTUAL_THRESHOLD;

  return (
    <div className="w-full">
      {/* ── 신고가 배너 ── */}
      {!isLoading && newHighCount > 0 ? (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-accent/30 bg-[#FFF5F5] px-4 py-2.5 text-sm font-medium text-accent">
          <Flame className="h-4 w-4" aria-hidden />
          이번달 신고가 <span className="num font-bold">{newHighCount}</span>건
        </div>
      ) : null}

      {/* ── 필터바 ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SIZE_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            label={f.label}
            count={sizeCounts[f.id]}
            active={sizeFilter === f.id}
            onClick={() => setSizeFilter(f.id)}
          />
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" aria-hidden />
        <FilterChip
          label="신고가만"
          active={newHighOnly}
          onClick={() => setNewHighOnly((v) => !v)}
          accent
        />

        {/* 정렬 */}
        <div className="ml-auto">
          <label className="sr-only" htmlFor="deal-sort">
            정렬 기준
          </label>
          <select
            id="deal-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortId)}
            className="h-9 rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 본문 ── */}
      {isLoading ? (
        <DealTableSkeleton />
      ) : visibleDeals.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* PC 테이블 */}
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <TableHeader />
            {useVirtual ? (
              <List
                rowCount={rows.length}
                rowHeight={(index) =>
                  rows[index]?.kind === "ad" ? AD_HEIGHT : ROW_HEIGHT
                }
                rowComponent={VirtualRow}
                rowProps={{ rows, regionPath, dealType }}
                style={{ height: VIRTUAL_VIEWPORT }}
              />
            ) : (
              <div>
                {rows.map((row, i) =>
                  row.kind === "ad" ? (
                    <div key={`ad-${i}`} className="px-4">
                      <AdSlot type="infeed" adSlot={INFEED_AD_SLOT} className="my-0" />
                    </div>
                  ) : (
                    <DealRow
                      key={row.deal.id}
                      deal={row.deal}
                      href={detailHref(regionPath, row.deal.aptName, row.deal.dong, dealType)}
                    />
                  ),
                )}
              </div>
            )}
          </div>

          {/* 모바일 카드 리스트 */}
          <div className="space-y-2 md:hidden">
            {rows.map((row, i) =>
              row.kind === "ad" ? (
                <AdSlot
                  key={`ad-m-${i}`}
                  type="infeed"
                  adSlot={INFEED_AD_SLOT}
                />
              ) : (
                <DealCard
                  key={row.deal.id}
                  deal={row.deal}
                  region={region}
                  href={detailHref(regionPath, row.deal.aptName, row.deal.dong, dealType)}
                />
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── 하위 컴포넌트 ───────────────────────── */

/** 필터 칩 버튼 */
function FilterChip({
  label,
  count,
  active,
  onClick,
  accent = false,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  accent?: boolean;
}): JSX.Element {
  // 건수 0인 평형대는 흐리게(비활성 시각화)
  const isEmpty = count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? accent
            ? "border-accent bg-accent text-white"
            : "border-primary bg-primary text-primary-foreground"
          : isEmpty
            ? "bg-card text-content-muted"
            : "bg-card text-content-secondary hover:text-content",
      )}
    >
      {label}
      {count !== undefined ? (
        <span
          className={cn(
            "ml-1 text-xs",
            active ? "text-primary-foreground/80" : "text-content-muted",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/** PC 테이블 헤더 (sticky) */
function TableHeader(): JSX.Element {
  return (
    <div
      className={cn(
        GRID_COLS,
        "h-11 border-b bg-[#F1F5F9] text-xs font-semibold text-content-secondary",
      )}
    >
      <span>단지명</span>
      <span>전용/평형</span>
      <span className="text-center">층</span>
      <span>계약일</span>
      <span className="text-right">거래금액</span>
      <span className="text-right">변동</span>
    </div>
  );
}

interface DealRowProps {
  deal: AptDeal;
  /** 단지 상세 페이지 href */
  href: string;
}

/** PC 데이터 행 (React.memo) — 클릭 시 단지 상세 페이지로 이동 */
const DealRow = memo(function DealRow({
  deal,
  href,
}: DealRowProps): JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        GRID_COLS,
        "h-14 w-full border-b text-left text-sm outline-none transition-colors last:border-b-0 hover:bg-surface focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
        deal.isNewHigh && "border-l-[3px] border-l-accent bg-[#FFF5F5]",
      )}
    >
      {/* 단지명 + 신고가 배지 */}
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-medium">{displayAptName(deal.aptName)}</span>
        {deal.isNewHigh ? (
          <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
            신고가
          </span>
        ) : null}
      </span>
      {/* 전용/평형 */}
      <span className="text-content-secondary tabular-nums">
        {deal.area}㎡ · {deal.pyeong}평
      </span>
      {/* 층 */}
      <span className="text-center tabular-nums text-content-secondary">
        {deal.floor}
      </span>
      {/* 계약일 */}
      <span className="tabular-nums text-content-secondary">
        {deal.dealDate}
      </span>
      {/* 거래금액 */}
      <span className="text-right font-bold tabular-nums">
        {deal.amountText}
      </span>
      {/* 변동 */}
      <ChangeCell changeRate={deal.changeRate} />
    </Link>
  );
});

/** 변동률 셀 */
function ChangeCell({
  changeRate,
}: {
  changeRate: number | undefined;
}): JSX.Element {
  if (changeRate === undefined) {
    return <span className="text-right text-content-muted">—</span>;
  }
  const isUp = changeRate >= 0;
  return (
    <span
      className={cn(
        "text-right text-sm font-semibold tabular-nums",
        isUp ? "text-up" : "text-down",
      )}
    >
      {isUp ? "▲" : "▼"}
      {Math.abs(changeRate).toFixed(1)}%
    </span>
  );
}

/** 가상 스크롤 행 렌더러 (react-window) */
function VirtualRow({
  index,
  style,
  rows,
  regionPath,
  dealType,
}: RowComponentProps<{
  rows: DisplayRow[];
  regionPath: string;
  dealType: string;
}>): JSX.Element {
  const row = rows[index];
  return (
    <div style={style}>
      {!row ? null : row.kind === "ad" ? (
        <div className="px-4">
          <AdSlot type="infeed" adSlot={INFEED_AD_SLOT} className="my-0" />
        </div>
      ) : (
        <DealRow
          deal={row.deal}
          href={detailHref(regionPath, row.deal.aptName, row.deal.dong, dealType)}
        />
      )}
    </div>
  );
}

/** 빈 상태 */
function EmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-content-muted">
      <AlertCircle className="h-6 w-6" aria-hidden />
      <p className="text-sm">조건에 맞는 거래 내역이 없습니다.</p>
    </div>
  );
}

