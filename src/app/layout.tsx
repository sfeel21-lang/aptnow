import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GoogleAnalytics } from "@/components/ui/GoogleAnalytics";
import { SITE } from "@/lib/constants";
import { publicConfig } from "@/lib/config";
import "./globals.css";

/**
 * Pretendard 가변 폰트 로컬 호스팅 (next/font/local).
 * - 자동 self-host + preload + font-display:swap 으로 CLS/LCP 개선.
 * - CSS 변수 --font-pretendard 로 Tailwind heading 폰트와 연결한다.
 */
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-pretendard",
});

/** Google AdSense 게시자 ID (환경변수 NEXT_PUBLIC_ADSENSE_CLIENT) */
const ADSENSE_CLIENT = publicConfig.adsenseClient;

/**
 * 전역 메타데이터 (SEO)
 * - 한국어 서비스 기본 제목/설명 설정
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "AptNow - 아파트 실거래가 조회",
    template: `%s | ${SITE.name}`,
  },
  description:
    "국토교통부 실거래가 데이터로 아파트 매매·전세·월세 실거래가를 쉽고 빠르게 확인하세요.",
  // 모바일 웹앱 형태로 동작 가능하도록 명시 (PWA 친화)
  other: {
    "mobile-web-app-capable": "yes",
  },
};

/**
 * 뷰포트/테마 설정
 * - Next 14 에서는 viewport / themeColor 를 별도 export 로 분리한다.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B4FD8", // 브랜드 딥블루 (주소창 테마색)
};

interface RootLayoutProps {
  children: React.ReactNode;
}

/**
 * 루트 레이아웃.
 * - 모든 페이지를 Header / Footer 로 감싸고, 본문(main)에 최소 화면 높이를 부여한다.
 * - Google AdSense 로더 스크립트를 사이트 전역에 1회 주입한다.
 * - Pretendard 폰트는 globals.css 의 CDN import + font-heading 으로 적용된다.
 */
export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="flex min-h-screen flex-col">
        {/*
         * Google AdSense 로더.
         * - next/script(afterInteractive)로 body 에 주입한다.
         *   (head 에 두면 AdSense 가 data-nscript 속성 관련 콘솔 경고를 출력함)
         */}
        <Script
          id="google-adsense"
          async
          strategy="afterInteractive"
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          data-ad-client={ADSENSE_CLIENT}
        />
        <Header />
        {/* 본문: 최소 화면 높이 확보 + 남은 공간을 채워 푸터를 하단에 고정 */}
        <main className="min-h-screen flex-1">{children}</main>
        <Footer />
        <Analytics />
        {/* Google Analytics 4 (useSearchParams 사용 → Suspense 경계) */}
        <Suspense fallback={null}>
          <GoogleAnalytics gaId={publicConfig.gaId} />
        </Suspense>
      </body>
    </html>
  );
}
