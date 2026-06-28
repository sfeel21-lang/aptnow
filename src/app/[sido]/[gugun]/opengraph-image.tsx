import { ImageResponse } from "next/og";
import { getLawdCd } from "@/lib/constants/regionCodes";
import { fetchAptDealsMultiMonth } from "@/lib/api/molit";
import { displayAptName } from "@/lib/utils/format";

// axios 사용 → Node 런타임
export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "아파트 실거래가 - AptNow";

/** OG 이미지용 한글 폰트 (satori 는 woff 지원) */
const FONT_URL =
  "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff/Pretendard-Bold.woff";

interface OgProps {
  params: { sido: string; gugun: string };
}

/**
 * 지역별 동적 OG 이미지.
 * - 지역명 + 최신 거래가를 텍스트로 포함한다.
 */
export default async function OpengraphImage({
  params,
}: OgProps): Promise<ImageResponse> {
  const gugun = decodeURIComponent(params.gugun);
  const lawdCd = getLawdCd(decodeURIComponent(params.sido), gugun);

  // 최신 거래가 1건 (실패 시 생략)
  let latestText = "";
  if (lawdCd) {
    try {
      const deals = await fetchAptDealsMultiMonth(lawdCd, 1);
      const latest = deals[0];
      if (latest)
        latestText = `${displayAptName(latest.aptName)} ${latest.amountText}`;
    } catch {
      /* 무시 */
    }
  }

  // 한글 폰트 로드 (실패 시 폰트 없이 렌더)
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
          padding: "80px",
          background: "linear-gradient(135deg, #1B4FD8 0%, #15409E 100%)",
          color: "white",
        }}
      >
        {/* satori 규칙: 자식이 1개(단일 문자열)가 되도록 템플릿 문자열로 합친다 */}
        <div style={{ fontSize: 36, opacity: 0.85 }}>
          AptNow · 국토교통부 실거래가
        </div>
        <div style={{ fontSize: 84, fontWeight: 700, marginTop: 24 }}>
          {`${gugun} 아파트 실거래가`}
        </div>
        {latestText ? (
          <div style={{ fontSize: 40, marginTop: 28, opacity: 0.95 }}>
            {`최신 거래 · ${latestText}`}
          </div>
        ) : null}
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
