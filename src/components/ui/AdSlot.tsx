"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";
import { publicConfig } from "@/lib/config";
import { trackAdView } from "@/lib/analytics";

// window.adsbygoogle 전역 타입
declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** AdSense 게시자 ID (환경변수 NEXT_PUBLIC_ADSENSE_CLIENT) */
const AD_CLIENT = publicConfig.adsenseClient;
/** 미충전(unfilled) 판정까지 대기 시간(ms) */
const COLLAPSE_CHECK_DELAY = 2_000;
/** 개발 환경 여부 (개발 시 회색 placeholder 표시) */
const IS_DEV = process.env.NODE_ENV === "development";

/** 광고 유형 */
type AdType = "banner" | "infeed" | "sidebar" | "footer";

/** 유형별 표시/스타일 메타 */
interface AdTypeMeta {
  /** placeholder 에 표기할 규격 라벨 */
  readonly dimension: string;
  /** 바깥 래퍼 클래스 (정렬/노출 제어) */
  readonly wrapperClass: string;
  /** placeholder 박스 크기 클래스 */
  readonly boxClass: string;
  /** 실제 <ins> 인라인 스타일 */
  readonly insStyle: CSSProperties;
  /** data-ad-format (고정 규격이면 미지정) */
  readonly format?: string;
  /** 반응형 풀폭 여부 */
  readonly fullWidthResponsive: boolean;
}

const AD_META: Readonly<Record<AdType, AdTypeMeta>> = {
  // 상단 배너: PC 728×90 / 모바일 320×50
  banner: {
    dimension: "728×90",
    wrapperClass: "flex justify-center",
    boxClass: "h-[50px] w-[320px] md:h-[90px] md:w-[728px]",
    insStyle: { display: "block" },
    format: "auto",
    fullWidthResponsive: true,
  },
  // 인피드: 반응형
  infeed: {
    dimension: "반응형",
    wrapperClass: "",
    boxClass: "h-[120px] w-full",
    insStyle: { display: "block" },
    format: "fluid",
    fullWidthResponsive: true,
  },
  // 사이드바: 300×250, PC 전용
  sidebar: {
    dimension: "300×250",
    wrapperClass: "hidden md:flex md:justify-center",
    boxClass: "h-[250px] w-[300px]",
    insStyle: { display: "inline-block", width: "300px", height: "250px" },
    fullWidthResponsive: false,
  },
  // 하단: 반응형
  footer: {
    dimension: "반응형",
    wrapperClass: "",
    boxClass: "h-[90px] w-full",
    insStyle: { display: "block" },
    format: "auto",
    fullWidthResponsive: true,
  },
};

interface AdSlotProps {
  /** 광고 유형 */
  type: AdType;
  /** AdSense 광고 슬롯 ID */
  adSlot: string;
  /** 추가 클래스 */
  className?: string;
}

/**
 * AdSense 광고 슬롯.
 * - 유형별(배너/인피드/사이드바/푸터) 규격으로 광고를 렌더한다.
 * - 개발 환경에서는 회색 placeholder 로 대체한다.
 * - 광고 미충전(unfilled) 시 영역을 collapse(height:0) 처리한다.
 */
export function AdSlot({ type, adSlot, className }: AdSlotProps): JSX.Element | null {
  const meta = AD_META[type];
  const insRef = useRef<HTMLModElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // 광고 미충전 시 collapse
  const [collapsed, setCollapsed] = useState<boolean>(false);

  // 광고 영역이 화면에 도달(스크롤)하면 1회 노출 이벤트 전송
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            trackAdView(type);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [type]);

  useEffect(() => {
    if (IS_DEV) return;
    try {
      // 광고 로딩 요청
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // 스크립트 미로딩 등 — 무시
    }
    // 일정 시간 후 미충전이면 영역 접기
    const timer = window.setTimeout(() => {
      const status = insRef.current?.getAttribute("data-ad-status");
      if (status === "unfilled") setCollapsed(true);
    }, COLLAPSE_CHECK_DELAY);
    return () => window.clearTimeout(timer);
  }, []);

  // 미충전으로 접힌 경우: height 0 으로 collapse (실 환경)
  if (collapsed && !IS_DEV) return null;

  return (
    <div
      ref={containerRef}
      className={cn("my-4", meta.wrapperClass, className)}
      aria-label="광고 영역"
    >
      <div className={type === "sidebar" ? "" : "w-full"}>
        {/* "광고" 레이블 (AdSense 정책 준수) */}
        <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wider text-content-muted">
          광고
        </p>

        {IS_DEV ? (
          // 개발 환경 placeholder
          <div
            className={cn(
              "mx-auto flex items-center justify-center rounded-md border border-dashed bg-surface text-xs text-content-muted",
              meta.boxClass,
            )}
          >
            광고 영역 ({meta.dimension})
          </div>
        ) : (
          // 실제 AdSense 광고 단위
          <ins
            ref={insRef}
            className="adsbygoogle"
            style={meta.insStyle}
            suppressHydrationWarning
            data-ad-client={AD_CLIENT}
            data-ad-slot={adSlot}
            {...(meta.format ? { "data-ad-format": meta.format } : {})}
            {...(meta.fullWidthResponsive
              ? { "data-full-width-responsive": "true" }
              : {})}
          />
        )}
      </div>
    </div>
  );
}
