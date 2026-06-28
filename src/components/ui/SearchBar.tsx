"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { displayAptName } from "@/lib/utils/format";
import type { SearchResult } from "@/lib/data/apartments";

/** 입력 디바운스 시간(ms) */
const DEBOUNCE_MS = 300;
/** 자동완성 최대 노출 수 */
const MAX_SUGGESTIONS = 8;

interface SearchBarProps {
  /** 입력 placeholder */
  placeholder?: string;
  /** 추가 클래스 (데스크톱 컨테이너) */
  className?: string;
}

/**
 * 아파트 단지 검색바.
 * - 300ms 디바운스 후 /api/search 호출, 자동완성 드롭다운(최대 8개)
 * - 키보드 네비게이션(↑↓ Enter, Esc)
 * - 모바일: 검색 아이콘 → 전체화면 오버레이
 */
export function SearchBar({
  placeholder = "단지명을 검색하세요",
  className,
}: SearchBarProps): JSX.Element {
  const router = useRouter();
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState<boolean>(false); // 데스크톱 드롭다운
  const [overlayOpen, setOverlayOpen] = useState<boolean>(false); // 모바일 오버레이
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [loading, setLoading] = useState<boolean>(false);

  // 디바운스 + 자동완성 호출
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(
        `/api/search?q=${encodeURIComponent(q)}&limit=${MAX_SUGGESTIONS}`,
        { signal: controller.signal },
      )
        .then((res) => res.json() as Promise<{ results: SearchResult[] }>)
        .then((json) => {
          setResults(json.results);
          setActiveIndex(-1);
        })
        .catch(() => {
          /* 취소/오류 무시 */
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  /** 검색 실행(결과 페이지 이동) */
  const submit = useCallback(
    (keyword: string): void => {
      const q = keyword.trim();
      if (!q) return;
      setOpen(false);
      setOverlayOpen(false);
      router.push(`/search?q=${encodeURIComponent(q)}`);
    },
    [router],
  );

  /** 키보드 네비게이션 */
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === "Enter") {
        const picked = activeIndex >= 0 ? results[activeIndex] : undefined;
        submit(picked ? picked.aptName : query);
      } else if (e.key === "Escape") {
        setOpen(false);
        setOverlayOpen(false);
      }
    },
    [results, activeIndex, query, submit],
  );

  return (
    <>
      {/* ════════ 데스크톱 인라인 검색 ════════ */}
      <div className={cn("relative hidden md:block", className)}>
        <SearchField
          value={query}
          placeholder={placeholder}
          onChange={setQuery}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          loading={loading}
        />
        {open && query.trim() ? (
          <SuggestionList
            results={results}
            activeIndex={activeIndex}
            loading={loading}
            onPick={(r) => submit(r.aptName)}
            className="absolute left-0 top-11 z-30 w-full"
          />
        ) : null}
      </div>

      {/* ════════ 모바일 검색 트리거 ════════ */}
      <button
        type="button"
        onClick={() => setOverlayOpen(true)}
        aria-label="검색 열기"
        className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md text-content-secondary outline-none hover:bg-surface hover:text-content focus-visible:ring-2 focus-visible:ring-primary md:hidden"
      >
        <Search className="h-5 w-5" aria-hidden />
      </button>

      {/* ════════ 모바일 전체화면 오버레이 ════════ */}
      {overlayOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-card md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="단지 검색"
        >
          <div className="flex items-center gap-2 border-b p-3">
            <div className="flex-1">
              <SearchField
                value={query}
                placeholder={placeholder}
                onChange={setQuery}
                onKeyDown={onKeyDown}
                loading={loading}
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => setOverlayOpen(false)}
              aria-label="검색 닫기"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-content-secondary outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {query.trim() ? (
              <SuggestionList
                results={results}
                activeIndex={activeIndex}
                loading={loading}
                onPick={(r) => submit(r.aptName)}
              />
            ) : (
              <p className="py-10 text-center text-sm text-content-muted">
                단지명을 입력하세요
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ───────────────────────── 하위 컴포넌트 ───────────────────────── */

interface SearchFieldProps {
  value: string;
  placeholder: string;
  loading: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
}

/** 검색 입력 필드 */
function SearchField({
  value,
  placeholder,
  loading,
  autoFocus = false,
  onChange,
  onKeyDown,
  onFocus,
}: SearchFieldProps): JSX.Element {
  return (
    <div className="flex w-full items-center gap-2 rounded-md border bg-surface px-3 focus-within:ring-2 focus-within:ring-primary">
      <Search className="h-4 w-4 shrink-0 text-content-muted" aria-hidden />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        aria-label="단지명 검색"
        className="h-10 w-full bg-transparent text-sm text-content outline-none placeholder:text-content-muted"
      />
      {loading ? (
        <span
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

interface SuggestionListProps {
  results: SearchResult[];
  activeIndex: number;
  loading: boolean;
  className?: string;
  onPick: (result: SearchResult) => void;
}

/** 자동완성 목록 */
function SuggestionList({
  results,
  activeIndex,
  loading,
  className,
  onPick,
}: SuggestionListProps): JSX.Element {
  return (
    <ul
      role="listbox"
      aria-label="검색 자동완성"
      className={cn(
        "max-h-[320px] overflow-y-auto rounded-md border bg-card py-1 shadow-card",
        className,
      )}
    >
      {results.length === 0 ? (
        <li className="px-3 py-3 text-sm text-content-muted">
          {loading ? "검색 중…" : "검색 결과가 없습니다"}
        </li>
      ) : (
        results.map((result, i) => (
          <li key={`${result.aptName}-${result.lawdCd}`}>
            <button
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                // blur 로 인한 드롭다운 닫힘보다 먼저 선택 처리
                e.preventDefault();
                onPick(result);
              }}
              className={cn(
                "flex w-full flex-col items-start px-3 py-2 text-left outline-none transition-colors hover:bg-surface",
                i === activeIndex && "bg-surface",
              )}
            >
              <span className="text-sm font-semibold text-content">
                {displayAptName(result.aptName)}
              </span>
              <span className="text-xs text-content-muted">
                {result.address}
              </span>
            </button>
          </li>
        ))
      )}
    </ul>
  );
}
