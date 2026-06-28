import type { Config } from "tailwindcss";

/**
 * AptNow 디자인 시스템
 * --------------------------------------------------------------
 * [브랜드 컨셉]
 * - 신뢰할 수 있는 부동산 정보 서비스
 * - 숫자와 데이터가 주인공인 깔끔한 레이아웃 (아실 asil.kr 풍의 군더더기 없는 느낌)
 * - 과하지 않은 색상 사용
 *
 * 색상/타이포/그림자/반경 등 모든 디자인 토큰을 이곳에서 일괄 관리한다.
 */
const config: Config = {
  // Tailwind 가 클래스를 스캔할 파일 경로 (src 디렉토리 기준)
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // 브랜드 — 신뢰감을 주는 딥블루
        primary: {
          DEFAULT: "#1B4FD8",
          foreground: "#FFFFFF", // primary 배경 위 텍스트
        },
        // 강조 — 신고가/상승 강조 레드
        accent: "#EF4444",

        // 가격 등락 (한국 부동산 관례: 상승=빨강, 하락=파랑)
        up: "#DC2626", // 가격 상승
        down: "#2563EB", // 가격 하락

        // 표면(배경) 계열
        surface: "#F8FAFC", // 페이지 배경
        card: "#FFFFFF", // 카드 배경
        border: "#E2E8F0", // 테두리

        // 텍스트 계열 — text-content / text-content-secondary / text-content-muted
        // (브랜드 primary 와 충돌을 피하기 위해 content 네임스페이스로 분리)
        content: {
          DEFAULT: "#0F172A", // 본문 기본 (text-primary 역할)
          secondary: "#64748B", // 보조 텍스트
          muted: "#94A3B8", // 흐린 텍스트
        },
      },
      fontFamily: {
        // 본문: 시스템 폰트 (가볍고 빠름)
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        // 제목: Pretendard (next/font 로컬 호스팅, CSS 변수 연결)
        heading: [
          "var(--font-pretendard)",
          "Pretendard",
          "-apple-system",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        // 카드용 은은한 그림자
        card: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.08)",
      },
      maxWidth: {
        // 콘텐츠 최대 너비 (레이아웃 컨테이너 기준)
        content: "1120px",
      },
    },
  },
  plugins: [],
};

export default config;
