import type { InfiniteScrollFetcher, InfiniteScrollPage } from "./index";

/**
 * The slice of a TanStack Query `QueryClient` the adapter needs.
 *
 * Deliberately structural: `useinfinitescroll/query` has **no dependency** on
 * `@tanstack/react-query` (it is not imported at runtime or in the types), so
 * the main package stays dependency-free.
 */
export type QueryClientLike = {
  fetchQuery<TPage>(options: {
    queryKey: readonly unknown[];
    queryFn: (context: { signal: AbortSignal }) => TPage | Promise<TPage>;
    staleTime?: number;
    gcTime?: number;
  }): Promise<TPage>;
};

export type QueryFetcherOptions<T> = {
  /** Cache key for one page, e.g. `(page) => ["posts", page]`. */
  queryKey: (page: number) => readonly unknown[];
  /**
   * Loads one page. The `signal` aborts when the request is superseded
   * (`reset()`, unmount) or when the query itself is cancelled.
   */
  queryFn: (
    page: number,
    context: { signal: AbortSignal },
  ) => Promise<InfiniteScrollPage<T>>;
  /**
   * How long a cached page counts as fresh. Defaults to the `QueryClient`'s
   * own setting. With a `staleTime`, revisiting a page (e.g. after `reset()`)
   * is served from the cache instead of the network.
   */
  staleTime?: number;
  /** How long an unused page stays in the cache. Defaults to the client's. */
  gcTime?: number;
};

function combineSignals(first: AbortSignal, second: AbortSignal): AbortSignal {
  const controller = new AbortController();
  if (first.aborted || second.aborted) {
    controller.abort();
    return controller.signal;
  }
  const abort = () => controller.abort();
  first.addEventListener("abort", abort, { once: true });
  second.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

/**
 * Adapts a TanStack Query `QueryClient` into an `InfiniteScrollFetcher`.
 *
 * Every page runs through `queryClient.fetchQuery`, so the client provides
 * caching, in-flight deduplication and retries while `useInfiniteScroll`
 * keeps ownership of the sentinel, page bookkeeping and race-safety.
 *
 * @example
 * ```tsx
 * import { useQueryClient } from "@tanstack/react-query";
 * import { useInfiniteScroll } from "useinfinitescroll";
 * import { createQueryFetcher } from "useinfinitescroll/query";
 *
 * const queryClient = useQueryClient();
 *
 * const { data, setLastElement } = useInfiniteScroll(
 *   createQueryFetcher<Post>(queryClient, {
 *     queryKey: (page) => ["posts", page],
 *     queryFn: async (page, { signal }) => {
 *       const response = await fetch(`/api/posts?_page=${page}&_limit=10`, { signal });
 *       return { data: await response.json(), totalPages: 10 };
 *     },
 *     staleTime: 60_000,
 *   }),
 * );
 * ```
 */
export function createQueryFetcher<T>(
  queryClient: QueryClientLike,
  options: QueryFetcherOptions<T>,
): InfiniteScrollFetcher<T> {
  const { queryKey, queryFn, staleTime, gcTime } = options;

  return (page, signal) =>
    queryClient.fetchQuery<InfiniteScrollPage<T>>({
      queryKey: queryKey(page),
      queryFn: (context) =>
        queryFn(page, { signal: combineSignals(context.signal, signal) }),
      ...(staleTime === undefined ? {} : { staleTime }),
      ...(gcTime === undefined ? {} : { gcTime }),
    });
}
