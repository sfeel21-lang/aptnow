import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AptNow - 아파트 실거래가 조회";

/** OG 이미지용 한글 폰트 (satori 는 woff 지원) */
const FONT_URL =
  "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff/Pretendard-Bold.woff";

/**
 * 메인 브랜드 OG 이미지.
 */
export default async function OpengraphImage(): Promise<ImageResponse> {
  let fontData: ArrayBuffer | null = null;
  try {
    fontData = await fetch(FONT_URL).then((r) => r.arrayBuffer());
  } catch {
    fontData = null;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #1B4FD8 0%, #15409E 100%)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 110, fontWeight: 700 }}>AptNow</div>
        <div style={{ fontSize: 44, marginTop: 16, opacity: 0.9 }}>
          아파트 실거래가, 지금 바로 확인하세요
        </div>
        <div style={{ fontSize: 30, marginTop: 24, opacity: 0.8 }}>
          국토교통부 공식 데이터 · 매일 업데이트
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: "Pretendard", data: fontData, weight: 700, style: "normal" }]
        : [],
    },
  );
}
