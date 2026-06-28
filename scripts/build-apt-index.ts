/**
 * 단지 마스터 인덱스 생성 스크립트 (방법 A — 실거래 집계).
 * - 전국 시군구 × 최근 N개월 매매 실거래를 훑어, 등장한 단지를 수집한다.
 * - 결과를 src/lib/data/apartments.generated.json 으로 저장한다.
 *
 * 실행:
 *   node scripts/build-apt-index.ts            # 전국
 *   MONTHS=6 MAX_REGIONS=25 node scripts/build-apt-index.ts   # 옵션
 */
import { readFileSync, writeFileSync } from "node:fs";
import { REGION_CODES } from "../src/lib/constants/regionCodes.ts";

/** 조회 개월 수 (기본 6) */
const MONTHS = Number(process.env.MONTHS ?? "6");
/** 처리할 시군구 최대 개수 (테스트용, 기본 전체) */
const MAX_REGIONS = Number(process.env.MAX_REGIONS ?? "0");
/** 동시 요청 수 */
const CONCURRENCY = 5;

const ENDPOINT =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** 시도 축약 (주소 표기용) */
const SIDO_SHORT: Record<string, string> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

interface IndexEntry {
  aptName: string;
  address: string;
  sido: string;
  gugun: string;
  dong: string;
  lawdCd: string;
}

/** .env.local 에서 MOLIT_API_KEY 읽기 */
function readApiKey(): string {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const key = env.match(/^MOLIT_API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  if (!key) throw new Error("MOLIT_API_KEY 를 .env.local 에서 찾지 못했습니다.");
  return key;
}

/** 현재월부터 과거 months 개월의 YYYYMM 목록 */
function recentYmd(months: number): string[] {
  const now = new Date();
  const list: string[] = [];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return list;
}

/** 한 (시군구, 월) 의 거래 item 배열을 JSON 으로 가져온다 */
async function fetchItems(
  key: string,
  lawdCd: string,
  ymd: string,
): Promise<Record<string, unknown>[]> {
  const url =
    `${ENDPOINT}?serviceKey=${encodeURIComponent(key)}` +
    `&LAWD_CD=${lawdCd}&DEAL_YMD=${ymd}&numOfRows=1000&pageNo=1&_type=json`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const text = await res.text();
  // 쿼터 초과/오류 시 JSON 이 아닐 수 있음
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`비정상 응답(${ymd}): ${text.slice(0, 120)}`);
  }
  const code = json?.response?.header?.resultCode;
  if (code && code !== "000") {
    throw new Error(`API 오류 resultCode=${code} (${ymd})`);
  }
  const items = json?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

async function main(): Promise<void> {
  const key = readApiKey();
  const ymds = recentYmd(MONTHS);

  // 대상 시군구 목록
  let targets: { lawdCd: string; sido: string; gugun: string }[] = [];
  for (const [sido, sidoData] of Object.entries(REGION_CODES)) {
    for (const [gugun, dist] of Object.entries(sidoData.districts)) {
      targets.push({ lawdCd: dist.code, sido, gugun });
    }
  }
  if (MAX_REGIONS > 0) targets = targets.slice(0, MAX_REGIONS);

  console.log(
    `대상 시군구 ${targets.length}개 × ${MONTHS}개월 = 최대 ${targets.length * MONTHS}콜 시작`,
  );

  const index = new Map<string, IndexEntry>();
  let done = 0;
  let failed = 0;

  // 시군구 단위로 동시 처리(풀)
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < targets.length) {
      const t = targets[cursor++];
      if (!t) break;
      const short = SIDO_SHORT[t.sido] ?? t.sido;
      for (const ymd of ymds) {
        try {
          const items = await fetchItems(key, t.lawdCd, ymd);
          for (const it of items) {
            const aptName = String(it.aptNm ?? "").trim();
            const dong = String(it.umdNm ?? "").trim();
            if (!aptName) continue;
            const k = `${t.lawdCd}|${dong}|${aptName}`;
            if (!index.has(k)) {
              index.set(k, {
                aptName,
                address: `${short} ${t.gugun} ${dong}`,
                sido: t.sido,
                gugun: t.gugun,
                dong,
                lawdCd: t.lawdCd,
              });
            }
          }
        } catch (e) {
          failed += 1;
          if (failed <= 5) console.warn(`  ⚠ ${t.gugun} ${ymd}: ${(e as Error).message}`);
        }
      }
      done += 1;
      if (done % 20 === 0)
        console.log(`  진행 ${done}/${targets.length} · 누적 단지 ${index.size}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // 정렬(지역→단지명) 후 저장
  const entries = [...index.values()].sort(
    (a, b) =>
      a.lawdCd.localeCompare(b.lawdCd) || a.aptName.localeCompare(b.aptName, "ko"),
  );
  const outPath = new URL(
    "../src/lib/data/apartments.generated.json",
    import.meta.url,
  );
  writeFileSync(outPath, JSON.stringify(entries, null, 0), "utf8");

  console.log(
    `✅ 완료: 단지 ${entries.length}개 저장 (실패 콜 ${failed}건) → src/lib/data/apartments.generated.json`,
  );
}

main().catch((e) => {
  console.error("스크립트 실패:", e);
  process.exit(1);
});
