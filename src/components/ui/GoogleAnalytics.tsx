"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";

interface GoogleAnalyticsProps {
  /** GA4 측정 ID (NEXT_PUBLIC_GA_ID) */
  gaId: string;
}

/**
 * Google Analytics 4 로더 + 페이지뷰 자동 추적.
 * - gaId 미설정 시 아무것도 렌더하지 않는다.
 * - 라우트(pathname/searchParams) 변경 시 page_view 를 직접 전송한다.
 */
export function GoogleAnalytics({ gaId }: GoogleAnalyticsProps): JSX.Element | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 라우트 변경 시 페이지뷰 추적 (SPA 이동 대응)
  useEffect(() => {
    if (!gaId || typeof window === "undefined" || !window.gtag) return;
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    window.gtag("event", "page_view", { page_path: url });
  }, [gaId, pathname, searchParams]);

  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script
        id="ga-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}', { send_page_view: false });
          `,
        }}
      />
    </>
  );
}
