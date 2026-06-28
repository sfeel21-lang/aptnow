import { cn } from "@/lib/utils/cn";

/** PC 거래 테이블 그리드 컬럼 (DealTable 과 동일) */
const GRID_COLS =
  "grid grid-cols-[minmax(0,2fr)_1.3fr_0.5fr_1fr_1.3fr_0.9fr] items-center gap-2 px-4";

interface SkeletonProps {
  className?: string;
}

/**
 * 기본 스켈레톤 블록.
 * - 회색 배경 위로 shimmer(빛 흐름) 애니메이션을 얹는다.
 */
export function Skeleton({ className }: SkeletonProps): JSX.Element {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-border/60",
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-card/70 to-transparent animate-[aptnow-shimmer_1.6s_ease-in-out_infinite]" />
    </div>
  );
}

/**
 * 거래 테이블 스켈레톤 (행 5개).
 */
export function DealTableSkeleton(): JSX.Element {
  return (
    <div
      className="overflow-hidden rounded-lg border"
      aria-busy="true"
      aria-label="거래 목록 불러오는 중"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={cn(GRID_COLS, "h-14 border-b last:border-b-0")}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mx-auto h-4 w-6" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-4 w-20" />
          <Skeleton className="ml-auto h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

/**
 * 모바일 거래 카드 스켈레톤.
 */
export function DealCardSkeleton(): JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-4" aria-busy="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="mt-2 h-3 w-40" />
      <div className="mt-3 flex items-end justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  );
}

/**
 * 히어로 섹션 스켈레톤.
 */
export function HeroSkeleton(): JSX.Element {
  return (
    <div
      className="flex flex-col items-center gap-4 py-14 sm:py-20"
      aria-busy="true"
      aria-label="불러오는 중"
    >
      <Skeleton className="h-9 w-72 sm:h-11 sm:w-96" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-4 h-16 w-full max-w-3xl rounded-2xl" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}
