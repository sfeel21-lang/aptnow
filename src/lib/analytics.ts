/**
 * Google Analytics 4 이벤트 추적 헬퍼 (클라이언트 전용).
 * - gtag 가 로드되지 않았으면(미설정/개발) 조용히 무시한다.
 */

// gtag 전역 타입
declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** 범용 이벤트 전송 */
export function trackEvent(
  name: string,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params ?? {});
}

/** 카페 공유용 복사 이벤트 (예: { region: "강남구" }) */
export function trackCopyForCafe(region: string): void {
  trackEvent("copy_for_cafe", { region });
}

/** 광고 영역 노출(스크롤 도달) 이벤트 */
export function trackAdView(adType: string): void {
  trackEvent("ad_area_view", { ad_type: adType });
}
