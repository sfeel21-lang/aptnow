"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, ClipboardCopy, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { displayAptName, formatAmountKorean } from "@/lib/utils/format";
import { trackCopyForCafe } from "@/lib/analytics";
import { SITE } from "@/lib/constants";
import type { AptDeal } from "@/types";

/** 네이버 그린 */
const NAVER_GREEN = "#03C75A";
/** "최근 N건" 모드에서 보여줄 건수 */
const RECENT_COUNT = 5;
/** 복사 완료 표시 유지 시간(ms) */
const RESET_DELAY = 2_000;

/** 공유 건수 선택 모드 */
type ShareScope = "all" | "recent" | "newhigh";

const SCOPE_OPTIONS: ReadonlyArray<{ id: ShareScope; label: string }> = [
  { id: "all", label: "전체" },
  { id: "recent", label: `최근 ${RECENT_COUNT}건` },
  { id: "newhigh", label: "신고가만" },
];

interface CopyButtonProps {
  /** 거래 목록 */
  deals: AptDeal[];
  /** 지역(시군구) 라벨 — 예: "강남구" */
  region: string;
  /** 거래 유형 라벨 (매매/전세/월세) — 공유 문구에 사용, 기본 "매매" */
  typeLabel?: string;
  /** 공유 링크 (미지정 시 현재 주소/사이트 URL 사용) */
  shareUrl?: string;
}

/** 오늘 날짜를 "2024.11.21" 형식으로 반환 */
function formatToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

/**
 * 네이버 카페 등에 붙여넣을 공유 텍스트를 생성한다.
 */
function buildShareText(
  items: AptDeal[],
  region: string,
  url: string,
  typeLabel: string,
): string {
  const isRent = typeLabel !== "매매";
  const lines: string[] = [];
  lines.push(`📢 [${region}] 오늘의 아파트 실거래가 (${formatToday()})`);
  lines.push("");
  lines.push(`🏠 ${typeLabel} 실거래 ${items.length}건`);
  lines.push("");

  for (const d of items) {
    lines.push(`▶ ${displayAptName(d.aptName)} (${d.buildYear}년식)`);
    lines.push(`   ${d.area}㎡ ${d.pyeong}평 | ${d.floor}층 | ${d.dealDate}`);
    lines.push(`   💰 ${d.amountText}${d.isNewHigh ? " 🔴신고가" : ""}`);
    lines.push("");
  }

  // 통계
  const newHigh = items.filter((d) => d.isNewHigh).length;
  const avg =
    items.length > 0
      ? Math.round(
          items.reduce((sum, d) => sum + d.amount, 0) / items.length,
        )
      : 0;
  lines.push("📊 이번달 통계");
  lines.push(`- 거래 건수: ${items.length}건`);
  lines.push(`- 신고가: ${newHigh}건`);
  lines.push(`- 평균 ${isRent ? "보증금" : "거래가"}: ${formatAmountKorean(avg)}`);
  lines.push("");
  lines.push(`🔗 전체 실거래 확인: ${url}`);
  lines.push("💡 AptNow - 아파트 실거래가 바로 확인");

  return lines.join("\n");
}

/** clipboard API 미지원 환경용 폴백 복사 */
function fallbackCopy(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * 네이버 카페 공유용 복사 버튼 (트래픽 유입 핵심).
 * - 목록 하단 고정 영역 + 모바일 플로팅 버튼
 * - 건수 선택(전체/최근/신고가) + 카카오(Web Share) 공유 + 복사 성공 confetti
 */
export function CopyButton({
  deals,
  region,
  typeLabel = "매매",
  shareUrl,
}: CopyButtonProps): JSX.Element {
  const [scope, setScope] = useState<ShareScope>("all");
  const [copied, setCopied] = useState<boolean>(false);

  // 공유 링크 (지정값 → 현재 주소 → 사이트 URL 순)
  const url = useMemo(() => {
    if (shareUrl) return shareUrl;
    if (typeof window !== "undefined") return window.location.href;
    return `${SITE.url}/${region}`;
  }, [shareUrl, region]);

  // 선택된 건수 모드에 맞는 거래 목록 (최신순 기준)
  const selectedDeals = useMemo(() => {
    const sorted = [...deals].sort((a, b) =>
      b.dealDate.localeCompare(a.dealDate),
    );
    if (scope === "recent") return sorted.slice(0, RECENT_COUNT);
    if (scope === "newhigh") return sorted.filter((d) => d.isNewHigh);
    return sorted;
  }, [deals, scope]);

  /** 클립보드 복사 실행 */
  const handleCopy = useCallback(async (): Promise<void> => {
    const text = buildShareText(selectedDeals, region, url, typeLabel);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
    } catch {
      fallbackCopy(text);
    }
    setCopied(true);
    // GA4 이벤트: 카페 공유용 복사
    trackCopyForCafe(region);
    window.setTimeout(() => setCopied(false), RESET_DELAY);
  }, [selectedDeals, region, url, typeLabel]);

  /** 카카오톡 등 시스템 공유 (Web Share API) */
  const handleShare = useCallback(async (): Promise<void> => {
    const text = buildShareText(selectedDeals, region, url, typeLabel);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${region} 아파트 실거래가`,
          text,
          url,
        });
      } catch {
        // 사용자가 취소한 경우 등 — 무시
      }
    } else {
      // 미지원 시 복사로 폴백
      void handleCopy();
    }
  }, [selectedDeals, region, url, typeLabel, handleCopy]);

  const disabled = selectedDeals.length === 0;

  return (
    <>
      {/* ════════ 하단 고정 공유 영역 ════════ */}
      <section
        aria-label="실거래가 공유"
        className="mt-6 rounded-xl border bg-card p-4 shadow-card"
      >
        {/* 건수 선택 라디오 */}
        <fieldset className="mb-3 flex flex-wrap items-center gap-2">
          <legend className="sr-only">공유할 거래 건수 선택</legend>
          <span className="text-sm font-medium text-content-secondary">
            공유 범위
          </span>
          {SCOPE_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors",
                scope === opt.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-content-secondary hover:text-content",
              )}
            >
              <input
                type="radio"
                name="share-scope"
                value={opt.id}
                checked={scope === opt.id}
                onChange={() => setScope(opt.id)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </fieldset>

        <div className="flex items-stretch gap-2">
          {/* 복사 버튼 (네이버 그린) */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={disabled}
            style={{ backgroundColor: NAVER_GREEN }}
            className="relative inline-flex h-[52px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-semibold text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40"
          >
            {copied ? (
              <>
                <Check className="h-5 w-5" aria-hidden />
                복사됐어요! 카페에 붙여넣기 하세요
                {/* CSS-only confetti */}
                <ConfettiBurst />
              </>
            ) : (
              <>
                <ClipboardCopy className="h-5 w-5" aria-hidden />
                오늘 실거래 카페에 공유하기
              </>
            )}
          </button>

          {/* 카카오/시스템 공유 (Web Share API) */}
          <button
            type="button"
            onClick={handleShare}
            disabled={disabled}
            aria-label="카카오톡 등으로 공유"
            className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-[#FEE500] text-[#191600] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40"
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </section>

      {/* ════════ 모바일 플로팅 버튼 ════════ */}
      <button
        type="button"
        onClick={handleCopy}
        disabled={disabled}
        aria-label="오늘 실거래 카페에 공유하기"
        style={{ backgroundColor: NAVER_GREEN }}
        className="fixed bottom-20 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-card outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 disabled:opacity-40 md:hidden"
      >
        {copied ? (
          <Check className="h-6 w-6" aria-hidden />
        ) : (
          <ClipboardCopy className="h-6 w-6" aria-hidden />
        )}
      </button>
    </>
  );
}

/** 복사 성공 시 표시되는 CSS-only confetti 조각들 */
function ConfettiBurst(): JSX.Element {
  // 색상/위치를 고정 배열로 두어 결정적으로 렌더 (Math.random 미사용)
  const pieces = [
    { left: "12%", color: "#FACC15", delay: "0ms" },
    { left: "28%", color: "#F87171", delay: "60ms" },
    { left: "45%", color: "#60A5FA", delay: "20ms" },
    { left: "62%", color: "#34D399", delay: "90ms" },
    { left: "80%", color: "#F472B6", delay: "40ms" },
  ];
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute bottom-2 h-1.5 w-1.5 rounded-[1px]"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animation: `aptnow-confetti 0.8s ${p.delay} ease-out`,
          }}
        />
      ))}
    </span>
  );
}
