import bundleAnalyzer from "@next/bundle-analyzer";

// ANALYZE=true 로 빌드 시 번들 분석 리포트 생성
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 엄격 모드 활성화 (잠재적 문제 조기 감지)
  reactStrictMode: true,

  // 이미지 최적화 (WebP/AVIF 자동 변환)
  images: {
    formats: ["image/avif", "image/webp"],
    // 외부 이미지 호스트 허용 목록 (필요한 도메인만 추가)
    remotePatterns: [
      { protocol: "https", hostname: "**.kakaocdn.net" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  // 프로덕션 빌드에서 console 제거 (error/warn 은 유지)
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  /**
   * 전역 보안 헤더.
   * - 클릭재킹/MIME 스니핑/레퍼러 노출 등을 방지한다.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
