"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatAmountKorean } from "@/lib/utils/format";
import type { AptDeal } from "@/types";

interface AptHistoryViewProps {
  /** 단지의 실거래 목록 (최신순) */
  deals: AptDeal[];
  /** 시군구 라벨 */
  gugun: string;
  /** 조회 기간(개월) — 안내 문구용 */
  months: number;
  /** 거래 유형 라벨 (매매/전세/월세) — 요약/문구 표기용, 기본 "매매" */
  dealTypeLabel?: string;
}

/** 평형 선택 값 (전체 또는 특정 평) */
type AreaFilter = "all" | number;

/** 변동률 표시 정보 */
function changeInfo(rate: number | undefined): { text: string; cls: string } | null {
  if (rate === undefined) return null;
  const up = rate >= 0;
  return {
    text: `${up ? "▲" : "▼"}${Math.abs(rate).toFixed(1)}%`,
    cls: up ? "text-up" : "text-down",
  };
}

/** 같은 평형(평) 그룹 내 직전 최고가 대비 변동률 계산 */
function withChangeRate(deals: AptDeal[]): (AptDeal & { changeRate?: number })[] {
  const groups = new Map<string, AptDeal[]>();
  for (const d of deals) {
    // 전용면적(㎡)이 미세하게 달라도 같은 평형이면 함께 비교 (국토부 표기 불일치 보정)
    const key = String(d.pyeong);
    const bucket = groups.get(key);
    if (bucket) bucket.push(d);
    else groups.set(key, [d]);
  }
  const rateById = new Map<string, number>();
  for (const bucket of groups.values()) {
    const asc = [...bucket].sort((a, b) => a.dealDate.localeCompare(b.dealDate));
    let prevMax = Number.NEGATIVE_INFINITY;
    for (const d of asc) {
      if (prevMax !== Number.NEGATIVE_INFINITY && prevMax > 0) {
        rateById.set(d.id, ((d.amount - prevMax) / prevMax) * 100);
      }
      if (d.amount > prevMax) prevMax = d.amount;
    }
  }
  return deals.map((d) => ({ ...d, changeRate: rateById.get(d.id) }));
}

/**
 * 단지 상세 이력 표시 + 평형별 필터.
 * - 평형 칩으로 특정 평형만 필터링하며, 요약/표가 선택에 맞춰 갱신된다.
 * - 12개월 데이터를 이미 받아왔으므로 재조회 없이 즉시 필터링한다.
 */
export function AptHistoryView({
  deals,
  gugun,
  months,
  dealTypeLabel = "매매",
}: AptHistoryViewProps): JSX.Element {
  const isRent = dealTypeLabel !== "매매";
  // 선택 평형 (기본 전체)
  const [area, setArea] = useState<AreaFilter>("all");

  // 변동률 채운 전체 목록 (최신순)
  const allRows = useMemo(() => withChangeRate(deals), [deals]);

  // 평형 목록 (작은 평형부터) + 평형별 건수
  const pyeongOptions = useMemo(() => {
    const counts = new Map<number, number>();
    for (const d of deals) counts.set(d.pyeong, (counts.get(d.pyeong) ?? 0) + 1);
    return [...counts.entries()]
      .map(([pyeong, count]) => ({ pyeong, count }))
      .sort((a, b) => a.pyeong - b.pyeong);
  }, [deals]);

  // 선택 평형으로 필터
  const rows = useMemo(
    () => (area === "all" ? allRows : allRows.filter((d) => d.pyeong === area)),
    [allRows, area],
  );

  // 요약 (선택 평형 기준)
  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const latest = rows[0];
    const max = rows.reduce((m, d) => (d.amount > m.amount ? d : m));
    const avg = Math.round(rows.reduce((s, d) => s + d.amount, 0) / rows.length);
    const buildYear = rows.find((d) => d.buildYear > 0)?.buildYear ?? 0;
    const dong = latest?.dong ?? "";
    return { latest, max, avg, buildYear, dong, count: rows.length };
  }, [rows]);

  return (
    <div className="mt-6">
      {/* 평형 필터 */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="평형 선택"
      >
        <FilterChip
          label="전체"
          active={area === "all"}
          onClick={() => setArea("all")}
        />
        {pyeongOptions.map((opt) => (
          <FilterChip
            key={opt.pyeong}
            label={`${opt.pyeong}평`}
            count={opt.count}
            active={area === opt.pyeong}
            onClick={() => setArea(opt.pyeong)}
          />
        ))}
      </div>

      {/* 요약 카드 */}
      {summary ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label={isRent ? "최근 보증금" : "최근 거래가"}
            value={summary.latest?.amountText ?? "-"}
          />
          <SummaryCard
            label={isRent ? "최고 보증금" : "최고가"}
            value={summary.max.amountText}
            accent
          />
          <SummaryCard
            label={isRent ? "평균 보증금" : "평균 거래가"}
            value={formatAmountKorean(summary.avg)}
          />
          <SummaryCard
            label="거래 건수"
            value={`${summary.count}건`}
            sub={summary.buildYear ? `${summary.buildYear}년 준공` : undefined}
          />
        </dl>
      ) : null}

      {/* 위치/안내 */}
      <p className="mt-4 text-sm text-content-secondary">
        {gugun} {summary?.dong ?? ""} · 최근 {months}개월 {dealTypeLabel} 실거래
        {area !== "all" ? ` · ${area}평` : ""}
      </p>

      {/* 이력 테이블 */}
      <div className="mt-3 overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[1fr_1.3fr_1.2fr_0.5fr_0.8fr] items-center gap-2 border-b bg-[#F1F5F9] px-4 py-2.5 text-xs font-semibold text-content-secondary">
          <span>계약일</span>
          <span className="text-right">거래금액</span>
          <span>전용/평형</span>
          <span className="text-right">층</span>
          <span className="text-right">변동</span>
        </div>
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-content-muted">
            선택한 평형의 거래 내역이 없습니다.
          </p>
        ) : (
          <ul>
            {rows.map((d) => {
              const ch = changeInfo(d.changeRate);
              return (
                <li
                  key={d.id}
                  className={cn(
                    "grid grid-cols-[1fr_1.3fr_1.2fr_0.5fr_0.8fr] items-center gap-2 border-b px-4 py-3 text-sm last:border-b-0",
                    d.isNewHigh && "border-l-[3px] border-l-accent bg-[#FFF5F5]",
                  )}
                >
                  <span className="tabular-nums text-content-secondary">
                    {d.dealDate}
                  </span>
                  <span className="text-right">
                    <span className="font-bold tabular-nums">{d.amountText}</span>
                    {d.isNewHigh ? (
                      <span className="ml-1 align-middle text-[10px] font-semibold text-accent">
                        신고가
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-content-secondary">
                    {d.area}㎡ · {d.pyeong}평
                  </span>
                  <span className="text-right tabular-nums text-content-secondary">
                    {d.floor}
                  </span>
                  <span className="text-right tabular-nums">
                    {ch ? (
                      <span className={cn("font-semibold", ch.cls)}>{ch.text}</span>
                    ) : (
                      <span className="text-content-muted">—</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── 하위 컴포넌트 ───────────────────────── */

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "border-primary bg-primary text-primary-foreground"
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

function SummaryCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}): JSX.Element {
  return (
    <div className="rounded-xl border bg-card p-4">
      <dt className="text-xs text-content-muted">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-lg font-bold tabular-nums",
          accent ? "text-accent" : "text-content",
        )}
      >
        {value}
      </dd>
      {sub ? <p className="mt-0.5 text-xs text-content-muted">{sub}</p> : null}
    </div>
  );
}
