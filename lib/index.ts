import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A single page of results.
 *
 * Return `totalPages: Infinity` for feeds that never end.
 */
export type InfiniteScrollPage<T> = {
  /** The items of this page. */
  data: T[];
  /** Total number of pages available. Used to stop scrolling at the end. */
  totalPages: number;
};

/**
 * Fetches one page. Receives the page number and an `AbortSignal` that is
 * aborted when the request becomes stale (reset, refetch or unmount).
 */
export type InfiniteScrollFetcher<T> = (
  page: number,
  signal: AbortSignal,
) => Promise<InfiniteScrollPage<T>>;

export type UseInfiniteScrollOptions = {
  /**
   * Margin around the scroll container in which the sentinel counts as
   * visible, e.g. `"300px"` to start loading before the user reaches the
   * bottom. Passed to the `IntersectionObserver`.
   * @default "0px"
   */
  rootMargin?: string;
  /**
   * Visibility ratio(s) at which the sentinel counts as visible. Passed to
   * the `IntersectionObserver`.
   * @default 0
   */
  threshold?: number | number[];
};

export type UseInfiniteScrollResult<T> = {
  /** All items loaded so far, in page order. */
  data: T[];
  /** The last successfully loaded page. */
  page: number;
  /** Total number of pages reported by the fetcher, `0` before the first response. */
  totalPages: number;
  /** `true` while a page is being fetched, including the very first one. */
  isLoading: boolean;
  /** The error thrown by the fetcher, or `null`. */
  error: Error | null;
  /** `false` once all pages are loaded. */
  hasNextPage: boolean;
  /**
   * Ref callback for the sentinel element. Mount it after the last rendered
   * item. When it becomes visible, the next page is loaded automatically.
   */
  setLastElement: (node: HTMLElement | null) => void;
  /**
   * Loads the next page manually (useful for a "Load more" button). While a
   * request is in flight it is a no-op. If the previous page failed, it
   * retries that page instead of skipping it.
   */
  loadMore: () => Promise<void>;
  /** Clears all items and loads the first page again. */
  reset: () => Promise<void>;
};

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

function isAbortError(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as { name?: unknown }).name === "AbortError"
  );
}

/**
 * Infinite scrolling for any paginated API, powered by the
 * `IntersectionObserver` API.
 *
 * The hook manages page numbers, appends results, aborts stale requests and
 * stops at the end of the list. When `IntersectionObserver` is not available
 * (SSR, older browsers, tests) the first page still loads and `loadMore()`
 * keeps working as a manual fallback.
 *
 * @example
 * ```tsx
 * const { data, setLastElement, isLoading } =
 *   useInfiniteScroll(async (page, signal) => {
 *     const response = await fetch(`/api/items?page=${page}`, { signal });
 *     return response.json(); // { data: Item[]; totalPages: number }
 *   });
 * ```
 */
export function useInfiniteScroll<T>(
  fetcher: InfiniteScrollFetcher<T>,
  options: UseInfiniteScrollOptions = {},
): UseInfiniteScrollResult<T> {
  const { rootMargin = "0px", threshold = 0 } = options;

  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Mutable mirrors, so callbacks and observers never read stale state.
  const fetcherRef = useRef(fetcher);
  const pageRef = useRef(1);
  const totalPagesRef = useRef(0);
  const isLoadingRef = useRef(true);
  const failedPageRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastElementRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Keep the latest fetcher without re-triggering requests when the consumer
  // passes an inline function.
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const runFetch = useCallback((targetPage: number): Promise<void> => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const handleResult = (result: InfiniteScrollPage<T>): void => {
      if (requestId !== requestIdRef.current) return;

      failedPageRef.current = null;
      pageRef.current = targetPage;
      totalPagesRef.current = result.totalPages;
      setPage(targetPage);
      setTotalPages(result.totalPages);
      setData((previous) =>
        targetPage === 1 ? result.data : [...previous, ...result.data],
      );
      setError(null);
    };

    const handleError = (cause: unknown): void => {
      if (requestId !== requestIdRef.current) return;
      if (isAbortError(cause)) return;

      failedPageRef.current = targetPage;
      setError(toError(cause));
    };

    const settle = (): void => {
      if (requestId !== requestIdRef.current) return;

      isLoadingRef.current = false;
      setIsLoading(false);
    };

    return fetcherRef
      .current(targetPage, controller.signal)
      .then(handleResult, handleError)
      .then(settle);
  }, []);

  const loadMore = useCallback((): Promise<void> => {
    if (isLoadingRef.current) return Promise.resolve();

    const targetPage = failedPageRef.current ?? pageRef.current + 1;
    const total = totalPagesRef.current;
    // `0` means the total is unknown yet (first page still in flight or failed).
    if (total > 0 && targetPage > total) return Promise.resolve();

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    return runFetch(targetPage);
  }, [runFetch]);

  const reset = useCallback((): Promise<void> => {
    // Invalidate and abort whatever is in flight before restarting.
    requestIdRef.current += 1;
    abortRef.current?.abort();

    failedPageRef.current = null;
    pageRef.current = 1;
    totalPagesRef.current = 0;
    isLoadingRef.current = true;

    setData([]);
    setPage(1);
    setTotalPages(0);
    setError(null);
    setIsLoading(true);

    return runFetch(1);
  }, [runFetch]);

  const setLastElement = useCallback((node: HTMLElement | null) => {
    const observer = observerRef.current;
    const previous = lastElementRef.current;

    if (observer && previous && previous !== node) {
      observer.unobserve(previous);
    }
    lastElementRef.current = node;
    if (observer && node && node !== previous) {
      observer.observe(node);
    }
  }, []);

  // Load the first page on mount.
  useEffect(() => {
    isLoadingRef.current = true;
    void runFetch(1);

    return () => {
      // Never let an in-flight request resolve after unmount.
      requestIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, [runFetch]);

  const thresholdKey = JSON.stringify(threshold);

  // Observe the sentinel. Re-created only when the observer options change.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin, threshold },
    );
    observerRef.current = observer;
    if (lastElementRef.current) observer.observe(lastElementRef.current);

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
    // `threshold` is tracked through `thresholdKey` because arrays change
    // identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMore, rootMargin, thresholdKey]);

  return {
    data,
    page,
    totalPages,
    isLoading,
    error,
    hasNextPage: page < totalPages,
    setLastElement,
    loadMore,
    reset,
  };
}
