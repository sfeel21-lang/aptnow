/**
 * 평형 인덱스 생성 스크립트 (건축물대장 기반 정밀 평형).
 * - 단지별 "전유면적 → 평형"을 건축물대장 전유공용면적으로 산출한다.
 *   분양(공급)면적 = 전유 + 주거공용(복도/계단/벽체 등), 주차장 등 기타공용은 제외.
 *   평형 = round(분양 / 3.3058).
 * - 데이터 소스 조합:
 *   1) MOLIT 실거래(최근 N개월) → 단지별 등장 전유면적 + 대표 지번(번지)
 *   2) K-apt 시군구 단지목록 → 단지 법정동코드(bjdongCd)
 *   3) 건축물대장 전유공용면적 → 호별 전유/주거공용 → 분양면적 → 평형
 * - 결과: src/lib/data/pyeong.generated.json  (키 "lawdCd|dong|aptName" → {전유2자리: 평형})
 * - 진행상황: src/lib/data/pyeong.progress.json (완료 lawdCd 목록) — 재실행 시 이어서 처리.
 *
 * 실행:
 *   node scripts/build-pyeong-index.ts                 # 전국(인기지역 우선), 이어서 처리
 *   MAX_REGIONS=5 node scripts/build-pyeong-index.ts   # 앞 5개 시군구만
 *   MONTHS=12 node scripts/build-pyeong-index.ts        # 실거래 조회 개월(기본 12)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { REGION_CODES } from "../src/lib/constants/regionCodes.ts";

/** 실거래 조회 개월 (단지/전유면적 수집 범위) */
const MONTHS = Number(process.env.MONTHS ?? "12");
/** 처리할 시군구 최대 개수 (테스트용) */
const MAX_REGIONS = Number(process.env.MAX_REGIONS ?? "0");
/** 건축물대장 단지당 최대 페이지 (평형 종류는 초반에 다 등장 → 과조회 방지) */
const MAX_BR_PAGES = Number(process.env.MAX_BR_PAGES ?? "12");
/** 건축물대장 페이지 크기 */
const BR_ROWS = 500;
/** 단지 동시 처리 수 (건축물대장 호출) — data.go.kr 초당 제한 회피 위해 보수적으로 */
const CONCURRENCY = 2;

const MOLIT_ENDPOINT =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const KAPT_LIST_ENDPOINT =
  "https://apis.data.go.kr/1613000/AptListService3/getSigunguAptList3";
const BR_ENDPOINT =
  "https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposPubuseAreaInfo";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** 인기 시군구(이 순서로 먼저 처리) */
const POPULAR_LAWD = [
  "11680", "11650", "11710", "11440", "11170", "41135", // 강남 서초 송파 마포 용산 분당
  "11215", "11200", "11410", "11140", "11560", "11620", // 광진 성동 서대문 중구 영등포 관악
];

/** 분양면적에서 제외할 "기타공용" 용도 키워드(주차장/기계실/관리/복리시설 등) */
const ETC_COMMON =
  /주차|기계|전기|관리사무소|경비|창고|주민공동|복리|물탱크|펌프|방재|정화|다목적|유치원|어린이|보육|상가|근린|판매|소매|슈퍼|약국|의원|경로당|문고|MDF|발전|변전|저수|휴게|커뮤니티|헬스|독서|식당|작업|세탁|전기실/;

const OUT_PATH = new URL("../src/lib/data/pyeong.generated.json", import.meta.url);
const PROGRESS_PATH = new URL(
  "../src/lib/data/pyeong.progress.json",
  import.meta.url,
);

type PyeongMap = Record<string, Record<string, number>>;

function readApiKey(): string {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const key = env.match(/^MOLIT_API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  if (!key) throw new Error("MOLIT_API_KEY 를 .env.local 에서 찾지 못했습니다.");
  return key;
}

function recentYmd(months: number): string[] {
  const now = new Date();
  const list: string[] = [];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return list;
}

/** XML 태그 값 추출 */
function tag(xml: string, key: string): string {
  return xml.match(new RegExp(`<${key}>(.*?)</${key}>`))?.[1]?.trim() ?? "";
}
function tagAll(xml: string, key: string): string[] {
  return [...xml.matchAll(new RegExp(`<${key}>([\\s\\S]*?)</${key}>`, "g"))].map(
    (m) => m[1],
  );
}

/** 일일 호출 한도 초과(치명적 — 중단) 감지 */
function isDailyLimit(text: string): boolean {
  return /LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS/i.test(text);
}
/** 일시 오류(재시도 대상) 감지: 5xx, 타임아웃, 점검, 초당 제한 등 */
function isTransient(status: number, text: string): boolean {
  return (
    status >= 500 ||
    status === 429 ||
    /SERVICE.{0,3}TIMEOUT|TRAFFIC|점검|일시|초당|too many/i.test(text)
  );
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** 견고한 텍스트 요청: 일시 오류는 백오프 재시도, 일일한도는 즉시 throw("QUOTA") */
async function getText(url: string, attempt = 0): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/xml" },
    });
    const text = await res.text();
    if (isDailyLimit(text)) throw new Error("QUOTA");
    if (isTransient(res.status, text) && attempt < 3) {
      await sleep(700 * (attempt + 1));
      return getText(url, attempt + 1);
    }
    return text;
  } catch (e) {
    if ((e as Error).message === "QUOTA") throw e;
    if (attempt < 3) {
      await sleep(700 * (attempt + 1));
      return getText(url, attempt + 1);
    }
    return "";
  }
}

/** MOLIT: 시군구 단지별 전유면적 + 대표 지번 수집 */
async function collectMolit(
  key: string,
  lawdCd: string,
  ymds: string[],
): Promise<Map<string, { dong: string; aptName: string; areas: Set<string>; jibun: Map<string, number> }>> {
  const map = new Map<
    string,
    { dong: string; aptName: string; areas: Set<string>; jibun: Map<string, number> }
  >();
  for (const ymd of ymds) {
    const url =
      `${MOLIT_ENDPOINT}?serviceKey=${encodeURIComponent(key)}` +
      `&LAWD_CD=${lawdCd}&DEAL_YMD=${ymd}&numOfRows=1000&pageNo=1`;
    const xml = await getText(url);
    if (isDailyLimit(xml)) throw new Error("QUOTA");
    for (const it of tagAll(xml, "item")) {
      const aptName = tag(it, "aptNm");
      const dong = tag(it, "umdNm");
      const area = Number.parseFloat(tag(it, "excluUseAr"));
      const jibun = tag(it, "jibun");
      if (!aptName || !dong || !Number.isFinite(area) || area <= 0) continue;
      const k = `${dong}|${aptName}`;
      let e = map.get(k);
      if (!e) {
        e = { dong, aptName, areas: new Set(), jibun: new Map() };
        map.set(k, e);
      }
      e.areas.add(area.toFixed(2));
      if (jibun) e.jibun.set(jibun, (e.jibun.get(jibun) ?? 0) + 1);
    }
  }
  return map;
}

/** K-apt: 시군구 단지목록 → [{정규화명, dong, bjdongCd}] */
async function collectKapt(
  key: string,
  lawdCd: string,
): Promise<{ norm: string; dong: string; bjdongCd: string }[]> {
  const url =
    `${KAPT_LIST_ENDPOINT}?serviceKey=${encodeURIComponent(key)}` +
    `&sigunguCode=${lawdCd}&pageNo=1&numOfRows=3000`;
  const xml = await getText(url);
  if (isDailyLimit(xml)) throw new Error("QUOTA");
  return tagAll(xml, "items").map((it) => ({
    norm: normalizeName(tag(it, "kaptName")),
    dong: tag(it, "as3"),
    bjdongCd: tag(it, "bjdCode").slice(5), // 10자리 → 뒤 5자리(읍면동)
  }));
}

/** 단지명 정규화(공백/괄호/구분기호/"아파트" 제거) */
function normalizeName(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/아파트$/, "")
    .replace(/[\s·.\-_]/g, "")
    .toLowerCase();
}

/** K-apt 목록에서 단지의 bjdongCd 찾기(동 우선, 이름 정규화 매칭) */
function findBjdongCd(
  kapt: { norm: string; dong: string; bjdongCd: string }[],
  aptName: string,
  dong: string,
): string | null {
  const q = normalizeName(aptName);
  const pool = kapt.filter((k) => k.dong === dong);
  const cands = pool.length ? pool : kapt;
  const exact = cands.find((k) => k.norm === q);
  if (exact) return exact.bjdongCd || null;
  const partial = cands
    .filter((k) => k.norm.length > 1 && (k.norm.includes(q) || q.includes(k.norm)))
    .sort((a, b) => Math.abs(a.norm.length - q.length) - Math.abs(b.norm.length - q.length));
  return partial[0]?.bjdongCd || null;
}

/** 상가/오피스텔 등 비주거 건물명 (같은 번지 혼재 시 제외) */
const COMMERCIAL_BLD = /상가|오피스텔|플라자|프라자|타워|근린|쇼핑|몰/;

/** 건축물대장: 단지(번지)의 전유면적 → 평형 맵 산출 */
async function buildPyeongForApt(
  key: string,
  lawdCd: string,
  bjdongCd: string,
  jibun: string,
  aptName: string,
  molitAreas: Set<string>,
): Promise<Record<string, number> | null> {
  const normApt = normalizeName(aptName);
  // 실거래에 등장한 전유면적 숫자(매칭 가드용)
  const molitNums = [...molitAreas].map(Number);
  const matchesMolit = (jy: number): boolean =>
    molitNums.some((a) => Math.abs(a - jy) <= 0.1);
  const [bunRaw, jiRaw = "0"] = jibun.split("-");
  const bun = (bunRaw || "0").padStart(4, "0");
  const ji = jiRaw.padStart(4, "0");

  // 호별 전유/주거공용 합산 (resi: 전유 용도가 아파트/공동주택인 주거 호인지)
  const byHo = new Map<string, { jy: number; res: number; resi: boolean }>();
  for (let page = 1; page <= MAX_BR_PAGES; page += 1) {
    const url =
      `${BR_ENDPOINT}?serviceKey=${encodeURIComponent(key)}` +
      `&sigunguCd=${lawdCd}&bjdongCd=${bjdongCd}&platGbCd=0&bun=${bun}&ji=${ji}` +
      `&numOfRows=${BR_ROWS}&pageNo=${page}`;
    const xml = await getText(url);
    if (isDailyLimit(xml)) throw new Error("QUOTA");
    const items = tagAll(xml, "item");
    if (items.length === 0) break;
    for (const it of items) {
      const bldNm = tag(it, "bldNm");
      // 같은 번지에 혼재하는 다른 건물 제외: 상가류 건물명, 또는 단지명과 불일치
      if (COMMERCIAL_BLD.test(bldNm)) continue;
      if (normApt && !normalizeName(bldNm).includes(normApt)) continue;

      const dongNm = tag(it, "dongNm");
      const hoNm = tag(it, "hoNm");
      const gb = tag(it, "exposPubuseGbCdNm");
      const area = Number.parseFloat(tag(it, "area")) || 0;
      const purps = `${tag(it, "etcPurps")} ${tag(it, "mainPurpsCdNm")}`;
      const k = `${dongNm}|${hoNm}`;
      let e = byHo.get(k);
      if (!e) {
        e = { jy: 0, res: 0, resi: false };
        byHo.set(k, e);
      }
      if (gb === "전유") {
        // 상가/근린생활/오피스텔 용도 호는 제외, 아파트 전유만 집계
        if (/아파트|공동주택/.test(purps)) {
          e.jy += area;
          e.resi = true;
        }
      } else if (gb === "공용") {
        if (!ETC_COMMON.test(purps)) e.res += area; // 주거공용만 합산
      }
    }
    if (items.length < BR_ROWS) break; // 마지막 페이지
  }
  if (byHo.size === 0) return null;

  // 전유면적(2자리)별 분양면적 최빈값 → 평형 (주거 호 + 실거래 전유와 일치하는 것만)
  const byType = new Map<string, Map<string, number>>();
  for (const { jy, res, resi } of byHo.values()) {
    if (!resi || jy <= 0) continue;
    // 건축물대장 전유가 실거래 전유와 다른 단지(예: "일부공유면적포함" 등록)는 제외
    if (!matchesMolit(jy)) continue;
    const areaKey = jy.toFixed(2);
    const supplyKey = (jy + res).toFixed(2);
    let m = byType.get(areaKey);
    if (!m) {
      m = new Map();
      byType.set(areaKey, m);
    }
    m.set(supplyKey, (m.get(supplyKey) ?? 0) + 1);
  }

  // 전유면적별 "분양면적(㎡)"을 저장한다(평형 변환은 런타임에서 — 재크롤 없이 공식 조정 가능)
  const result: Record<string, number> = {};
  for (const [areaKey, supplyCounts] of byType) {
    const supply = Number.parseFloat(
      [...supplyCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0],
    );
    result[areaKey] = Number(supply.toFixed(1));
  }
  return result;
}

async function main(): Promise<void> {
  const key = readApiKey();
  const ymds = recentYmd(MONTHS);

  // 기존 결과/진행상황 로드
  const index: PyeongMap = existsSync(OUT_PATH)
    ? (JSON.parse(readFileSync(OUT_PATH, "utf8")) as PyeongMap)
    : {};
  const done = new Set<string>(
    existsSync(PROGRESS_PATH)
      ? (JSON.parse(readFileSync(PROGRESS_PATH, "utf8")) as string[])
      : [],
  );

  // 대상 시군구(인기 우선)
  const all: { lawdCd: string; sido: string; gugun: string }[] = [];
  for (const [sido, sidoData] of Object.entries(REGION_CODES)) {
    for (const [gugun, dist] of Object.entries(sidoData.districts)) {
      all.push({ lawdCd: (dist as { code: string }).code, sido, gugun });
    }
  }
  all.sort((a, b) => {
    const ia = POPULAR_LAWD.indexOf(a.lawdCd);
    const ib = POPULAR_LAWD.indexOf(b.lawdCd);
    return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
  });
  let targets = all.filter((t) => !done.has(t.lawdCd));
  if (MAX_REGIONS > 0) targets = targets.slice(0, MAX_REGIONS);

  console.log(
    `대상 시군구 ${targets.length}개 (완료 ${done.size}개 건너뜀). 건축물대장 기반 평형 산출 시작.`,
  );

  let quotaHit = false;
  for (const t of targets) {
    if (quotaHit) break;
    try {
      const [molit, kapt] = await Promise.all([
        collectMolit(key, t.lawdCd, ymds),
        collectKapt(key, t.lawdCd),
      ]);

      const units = [...molit.values()];
      let cursor = 0;
      let ok = 0;
      async function worker(): Promise<void> {
        while (cursor < units.length && !quotaHit) {
          const u = units[cursor++];
          if (!u) break;
          const bjdongCd = findBjdongCd(kapt, u.aptName, u.dong);
          if (!bjdongCd) continue;
          // 대표 지번(최빈)
          const jibun = [...u.jibun.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
          if (!jibun) continue;
          try {
            const map = await buildPyeongForApt(
              key,
              t.lawdCd,
              bjdongCd,
              jibun,
              u.aptName,
              u.areas,
            );
            if (map && Object.keys(map).length) {
              index[`${t.lawdCd}|${u.dong}|${u.aptName}`] = map;
              ok += 1;
            }
          } catch (e) {
            if ((e as Error).message === "QUOTA") {
              quotaHit = true;
              console.warn("  ⛔ 일일 호출 한도 초과 감지 — 진행상황 저장 후 종료");
            }
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

      if (!quotaHit) done.add(t.lawdCd);
      // 시군구마다 저장(중단 안전)
      writeFileSync(OUT_PATH, JSON.stringify(index), "utf8");
      writeFileSync(PROGRESS_PATH, JSON.stringify([...done]), "utf8");
      console.log(
        `  ✓ ${t.sido} ${t.gugun}: 단지 ${ok}개 평형 산출 (누적 ${Object.keys(index).length})`,
      );
    } catch (e) {
      if ((e as Error).message === "QUOTA") {
        console.warn("  ⛔ 한도 초과 — 종료");
        break;
      }
      console.warn(`  ⚠ ${t.gugun} 실패: ${(e as Error).message}`);
    }
  }

  writeFileSync(OUT_PATH, JSON.stringify(index), "utf8");
  writeFileSync(PROGRESS_PATH, JSON.stringify([...done]), "utf8");
  console.log(
    `완료/중단. 단지 ${Object.keys(index).length}개, 완료 시군구 ${done.size}개.` +
      (quotaHit ? " (한도 초과로 일부만 처리 — 내일 다시 실행하면 이어서 진행)" : ""),
  );
}

main().catch((e) => {
  console.error("스크립트 실패:", e);
  process.exit(1);
});
