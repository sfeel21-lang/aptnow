"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  Clock,
  MapPin,
  Search,
  Star,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  getGugunList,
  getLawdCd,
  getSidoList,
} from "@/lib/constants/regionCodes";

/** 인기 시도 (상단 고정 노출) */
const POPULAR_SIDO: readonly string[] = ["서울특별시", "경기도", "인천광역시"];
/** 인기 시군구 (배지 표시) */
const POPULAR_GUGUN: readonly string[] = ["강남구", "서초구", "송파구"];
/** 최근 조회 지역 localStorage 키 */
const RECENT_KEY = "aptnow:recent-regions";
/** 최근 조회 최대 보관 개수 */
const MAX_RECENT = 3;

/** 시도명 축약 표기 (칩/최근 표시용) */
const SIDO_SHORT: Readonly<Record<string, string>> = {
  서울특별시: "서울",
  경기도: "경기",
  인천광역시: "인천",
  부산광역시: "부산",
};

/** 모바일 바텀시트 단계 */
type SheetStep = "sido" | "gugun" | "dong";

/** 지역 선택 상태 */
interface RegionSelection {
  readonly sido: string;
  readonly gugun: string;
  readonly dong: string;
}

interface RegionSelectorProps {
  /** 조회 버튼 클릭 시 호출 (미지정 시 현재 경로에 쿼리만 동기화) */
  onSearch?: (selection: RegionSelection & { lawdCd: string }) => void;
}

/** 인기 시도를 상단으로 끌어올려 정렬 */
function sortByPopular(list: string[], popular: readonly string[]): string[] {
  const pop = list.filter((x) => popular.includes(x));
  const rest = list.filter((x) => !popular.includes(x));
  return [...pop, ...rest];
}

/** localStorage 에서 최근 조회 지역을 읽는다(파싱 실패 시 빈 배열) */
function loadRecent(): RegionSelection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RegionSelection[]) : [];
  } catch {
    return [];
  }
}

/**
 * 지역 선택 컴포넌트.
 * - PC: [시/도][시/군/구][읍/면/동][조회하기] 가로 드롭다운
 * - 모바일: 바텀시트(드래그 닫기) 3단계 계층 탐색
 * - URL 쿼리(sido/gugun/dong)와 상태를 동기화하고, 최근 조회를 localStorage 에 보관한다.
 */
export function RegionSelector({ onSearch }: RegionSelectorProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── 선택 상태 (URL 쿼리로 초기화) ──
  const [sido, setSido] = useState<string>(searchParams.get("sido") ?? "");
  const [gugun, setGugun] = useState<string>(searchParams.get("gugun") ?? "");
  const [dong, setDong] = useState<string>(searchParams.get("dong") ?? "");

  // ── PC 드롭다운 열림 상태 ──
  const [openMenu, setOpenMenu] = useState<SheetStep | null>(null);
  // ── 모바일 바텀시트 상태 ──
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [sheetStep, setSheetStep] = useState<SheetStep>("sido");
  // ── 최근 조회 지역 ──
  const [recent, setRecent] = useState<RegionSelection[]>([]);
  // ── 읍/면/동 목록 (선택한 시군구의 실거래에서 동적 추출) ──
  const [dongList, setDongList] = useState<string[]>([]);
  const [dongLoading, setDongLoading] = useState<boolean>(false);

  // 목록 파생값
  const sidoList = useMemo(() => sortByPopular(getSidoList(), POPULAR_SIDO), []);
  const gugunList = useMemo(
    () => (sido ? sortByPopular(getGugunList(sido), POPULAR_GUGUN) : []),
    [sido],
  );

  // 최초 마운트 시 최근 조회 로드
  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  // 시/군/구 변경 시 읍/면/동 목록을 API 로 불러온다(실거래 기반)
  useEffect(() => {
    const lawdCd = sido && gugun ? getLawdCd(sido, gugun) : "";
    if (!lawdCd) {
      setDongList([]);
      return;
    }
    let cancelled = false;
    setDongLoading(true);
    setDongList([]);
    fetch(`/api/dongs?lawdCd=${lawdCd}`)
      .then((res) => res.json() as Promise<{ dongs: string[] }>)
      .then((json) => {
        if (!cancelled) setDongList(json.dongs);
      })
      .catch(() => {
        if (!cancelled) setDongList([]);
      })
      .finally(() => {
        if (!cancelled) setDongLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sido, gugun]);

  // 바깥 클릭 시 PC 드롭다운 닫기
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openMenu) return;
    const handleClick = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMenu]);

  // ── 선택 핸들러 (상위 선택 변경 시 하위 초기화) ──
  const selectSido = useCallback((value: string): void => {
    setSido(value);
    setGugun("");
    setDong("");
  }, []);
  const selectGugun = useCallback((value: string): void => {
    setGugun(value); // sido 는 고정, dong 만 초기화
    setDong("");
  }, []);
  const selectDong = useCallback((value: string): void => {
    setDong(value);
  }, []);

  /** 최근 조회에 현재 선택을 추가(중복 제거, 최대 3개) */
  const pushRecent = useCallback((selection: RegionSelection): void => {
    setRecent((prev) => {
      const filtered = prev.filter(
        (r) => !(r.sido === selection.sido && r.gugun === selection.gugun),
      );
      const next = [selection, ...filtered].slice(0, MAX_RECENT);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  /** 조회하기 실행 — URL 동기화 + 최근 저장 + 콜백 */
  const handleSearch = useCallback((): void => {
    if (!sido || !gugun) return;
    const lawdCd = getLawdCd(sido, gugun);
    const selection: RegionSelection = { sido, gugun, dong };

    pushRecent(selection);
    setOpenMenu(null);
    setSheetOpen(false);

    if (onSearch) {
      onSearch({ ...selection, lawdCd });
      return;
    }

    // 기본 동작: 지역 상세 페이지(/{시도}/{시군구})로 이동
    const base = `/${encodeURIComponent(sido)}/${encodeURIComponent(gugun)}`;
    const query = dong ? `?dong=${encodeURIComponent(dong)}` : "";
    router.push(`${base}${query}`);
  }, [sido, gugun, dong, onSearch, pushRecent, router]);

  /** 최근 조회 지역 즉시 적용 */
  const applyRecent = useCallback(
    (r: RegionSelection): void => {
      setSido(r.sido);
      setGugun(r.gugun);
      setDong(r.dong);
    },
    [],
  );

  const canSearch = Boolean(sido && gugun);

  return (
    <div ref={rootRef} className="w-full">
      {/* ════════ PC: 가로 드롭다운 ════════ */}
      <div className="hidden items-stretch gap-2 md:flex">
        <DesktopDropdown
          label="시/도"
          value={sido}
          placeholder="시/도 선택"
          isOpen={openMenu === "sido"}
          onToggle={() => setOpenMenu(openMenu === "sido" ? null : "sido")}
          options={sidoList}
          popular={POPULAR_SIDO}
          onSelect={(v) => {
            selectSido(v);
            setOpenMenu("gugun");
          }}
        />
        <DesktopDropdown
          label="시/군/구"
          value={gugun}
          placeholder="시/군/구"
          disabled={!sido}
          isOpen={openMenu === "gugun"}
          onToggle={() => setOpenMenu(openMenu === "gugun" ? null : "gugun")}
          options={gugunList}
          popular={POPULAR_GUGUN}
          onSelect={(v) => {
            selectGugun(v);
            setOpenMenu(dongList.length > 0 ? "dong" : null);
          }}
        />
        <DesktopDropdown
          label="읍/면/동"
          value={dong}
          placeholder={
            dongLoading
              ? "불러오는 중…"
              : dongList.length
                ? "읍/면/동(선택)"
                : "전체"
          }
          disabled={!gugun || dongLoading}
          isOpen={openMenu === "dong"}
          onToggle={() => setOpenMenu(openMenu === "dong" ? null : "dong")}
          options={dongList}
          popular={[]}
          onSelect={(v) => {
            selectDong(v);
            setOpenMenu(null);
          }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={!canSearch}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-card outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Search className="h-4 w-4" aria-hidden />
          조회하기
        </button>
      </div>

      {/* ════════ 모바일: 바텀시트 열기 버튼 ════════ */}
      <button
        type="button"
        onClick={() => {
          setSheetStep("sido");
          setSheetOpen(true);
        }}
        className="flex w-full items-center justify-between rounded-md border bg-card px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
      >
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" aria-hidden />
          {canSearch ? (
            <RegionChipText sido={sido} gugun={gugun} dong={dong} />
          ) : (
            <span className="text-content-muted">지역을 선택하세요</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-content-muted" aria-hidden />
      </button>

      {/* ════════ 선택 칩 (공통) ════════ */}
      {canSearch ? (
        <div className="mt-3 hidden items-center gap-2 text-sm md:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 font-medium">
            <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
            <RegionChipText sido={sido} gugun={gugun} dong={dong} />
          </span>
        </div>
      ) : null}

      {/* 최근 조회 (PC) */}
      {recent.length > 0 ? (
        <div className="mt-3 hidden flex-wrap items-center gap-2 text-xs md:flex">
          <span className="flex items-center gap-1 text-content-muted">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            최근
          </span>
          {recent.map((r) => (
            <button
              key={`${r.sido}-${r.gugun}`}
              type="button"
              onClick={() => applyRecent(r)}
              className="rounded-full border px-2.5 py-1 text-content-secondary outline-none transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
            >
              {SIDO_SHORT[r.sido] ?? r.sido} {r.gugun}
            </button>
          ))}
        </div>
      ) : null}

      {/* ════════ 모바일 바텀시트 ════════ */}
      {sheetOpen ? (
        <MobileBottomSheet
          step={sheetStep}
          sido={sido}
          gugun={gugun}
          sidoList={sidoList}
          gugunList={gugunList}
          dongList={dongList}
          dongLoading={dongLoading}
          recent={recent}
          canSearch={canSearch}
          onClose={() => setSheetOpen(false)}
          onBack={() =>
            setSheetStep((prev) => (prev === "dong" ? "gugun" : "sido"))
          }
          onSelectSido={(v) => {
            selectSido(v);
            setSheetStep("gugun");
          }}
          onSelectGugun={(v) => {
            selectGugun(v);
            // 동 단계로 이동 (동 목록은 effect 가 API 로 불러옴)
            setSheetStep("dong");
          }}
          onSelectDong={(v) => selectDong(v)}
          onApplyRecent={(r) => {
            applyRecent(r);
            setSheetStep("dong");
          }}
          onSearch={handleSearch}
        />
      ) : null}
    </div>
  );
}

/* ───────────────────────── 하위 컴포넌트 ───────────────────────── */

/** 지역 경로 텍스트 (서울 > 강남구 > 대치동) */
function RegionChipText({
  sido,
  gugun,
  dong,
}: {
  sido: string;
  gugun: string;
  dong: string;
}): JSX.Element {
  return (
    <span className="font-medium">
      {SIDO_SHORT[sido] ?? sido}
      {gugun ? ` > ${gugun}` : ""}
      {dong ? ` > ${dong}` : ""}
    </span>
  );
}

interface DesktopDropdownProps {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  popular: readonly string[];
  isOpen: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}

/** PC용 단일 드롭다운 */
function DesktopDropdown({
  label,
  value,
  placeholder,
  options,
  popular,
  isOpen,
  disabled = false,
  onToggle,
  onSelect,
}: DesktopDropdownProps): JSX.Element {
  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={`${label} 선택`}
        aria-expanded={isOpen}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border bg-card px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
          disabled && "cursor-not-allowed opacity-40",
          value ? "text-content" : "text-content-muted",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-content-muted transition-transform",
            isOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {isOpen && !disabled ? (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-12 z-30 max-h-[300px] w-full min-w-[160px] overflow-y-auto rounded-md border bg-card py-1 text-content shadow-card"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-content-muted">
              선택 가능한 항목이 없습니다
            </li>
          ) : (
            options.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  onClick={() => onSelect(option)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-surface focus-visible:bg-surface",
                    value === option && "font-semibold text-primary",
                  )}
                >
                  {option}
                  {popular.includes(option) ? (
                    <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      <Star className="h-2.5 w-2.5" aria-hidden />
                      인기
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

interface MobileBottomSheetProps {
  step: SheetStep;
  sido: string;
  gugun: string;
  sidoList: string[];
  gugunList: string[];
  dongList: string[];
  dongLoading: boolean;
  recent: RegionSelection[];
  canSearch: boolean;
  onClose: () => void;
  onBack: () => void;
  onSelectSido: (value: string) => void;
  onSelectGugun: (value: string) => void;
  onSelectDong: (value: string) => void;
  onApplyRecent: (r: RegionSelection) => void;
  onSearch: () => void;
}

/** 모바일 바텀시트 (드래그로 닫기) */
function MobileBottomSheet({
  step,
  sido,
  gugun,
  sidoList,
  gugunList,
  dongList,
  dongLoading,
  recent,
  canSearch,
  onClose,
  onBack,
  onSelectSido,
  onSelectGugun,
  onSelectDong,
  onApplyRecent,
  onSearch,
}: MobileBottomSheetProps): JSX.Element {
  // 드래그 닫기용 Y 오프셋
  const [dragY, setDragY] = useState<number>(0);
  const startYRef = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>): void => {
    startYRef.current = e.touches[0]?.clientY ?? null;
  };
  const handleTouchMove = (e: TouchEvent<HTMLDivElement>): void => {
    if (startYRef.current === null) return;
    const delta = (e.touches[0]?.clientY ?? 0) - startYRef.current;
    if (delta > 0) setDragY(delta); // 아래로 끌 때만 반영
  };
  const handleTouchEnd = (): void => {
    if (dragY > 100) onClose(); // 100px 이상 끌면 닫기
    setDragY(0);
    startYRef.current = null;
  };

  const stepTitle =
    step === "sido" ? "시/도 선택" : step === "gugun" ? "시/군/구 선택" : "읍/면/동 선택";

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      {/* 반투명 오버레이 */}
      <div
        className="absolute inset-0 bg-content/40"
        onClick={onClose}
        aria-hidden
      />
      {/* 시트 본체 */}
      <div
        className="absolute inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl bg-card text-content shadow-card"
        style={{ transform: `translateY(${dragY}px)` }}
      >
        {/* 드래그 핸들 */}
        <div
          className="flex cursor-grab justify-center pt-3 active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden />
        </div>

        {/* 헤더: 뒤로가기 / 제목 / 닫기 */}
        <div className="flex items-center justify-between px-4 py-3">
          {step !== "sido" ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="이전 단계로"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <span className="h-8 w-8" aria-hidden />
          )}
          <h2 className="font-heading text-base font-semibold">{stepTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* 최근 조회 (시도 단계에서만) */}
        {step === "sido" && recent.length > 0 ? (
          <div className="border-t px-4 py-3">
            <p className="mb-2 flex items-center gap-1 text-xs text-content-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              최근 조회
            </p>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button
                  key={`${r.sido}-${r.gugun}`}
                  type="button"
                  onClick={() => onApplyRecent(r)}
                  className="rounded-full border px-3 py-1.5 text-sm outline-none hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {SIDO_SHORT[r.sido] ?? r.sido} {r.gugun}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* 목록 */}
        <ul className="max-h-[45vh] overflow-y-auto border-t px-2 py-2">
          {step === "dong" && dongLoading ? (
            <li className="px-3 py-3 text-sm text-content-muted">
              읍/면/동을 불러오는 중…
            </li>
          ) : null}
          {step === "dong" && !dongLoading && dongList.length === 0 ? (
            <li className="px-3 py-3 text-sm text-content-muted">
              최근 거래가 있는 동이 없습니다. 아래 ‘조회하기’로 전체를 확인하세요.
            </li>
          ) : null}
          {(step === "sido"
            ? sidoList
            : step === "gugun"
              ? gugunList
              : dongList
          ).map((option) => {
            const selected =
              (step === "sido" && option === sido) ||
              (step === "gugun" && option === gugun);
            const isPopular =
              step === "sido"
                ? POPULAR_SIDO.includes(option)
                : step === "gugun"
                  ? POPULAR_GUGUN.includes(option)
                  : false;
            return (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => {
                    if (step === "sido") onSelectSido(option);
                    else if (step === "gugun") onSelectGugun(option);
                    else onSelectDong(option);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm outline-none transition-colors hover:bg-surface focus-visible:bg-surface",
                    selected && "font-semibold text-primary",
                  )}
                >
                  {option}
                  {isPopular ? (
                    <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      <Star className="h-2.5 w-2.5" aria-hidden />
                      인기
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        {/* 하단 조회 버튼 */}
        <div className="border-t p-4">
          <button
            type="button"
            onClick={onSearch}
            disabled={!canSearch}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
          >
            <Search className="h-4 w-4" aria-hidden />
            {canSearch ? "조회하기" : "지역을 선택하세요"}
          </button>
        </div>
      </div>
    </div>
  );
}
