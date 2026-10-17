import { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useInfiniteScroll } from "./index";
import type { InfiniteScrollPage } from "./index";
import { createQueryFetcher } from "./query";
import type { QueryFetcherOptions } from "./query";

type Item = { id: number };

const PAGE_SIZE = 3;

function itemsOfPage(page: number, size = PAGE_SIZE): Item[] {
  return Array.from({ length: size }, (_, index) => ({
    id: (page - 1) * size + index + 1,
  }));
}

function pageData(page: number, totalPages: number): InfiniteScrollPage<Item> {
  return { data: itemsOfPage(page), totalPages };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

type PageQueryFn = QueryFetcherOptions<Item>["queryFn"];

describe("createQueryFetcher (TanStack Query)", () => {
  it("routes each page through the QueryClient and populates its cache", async () => {
    const queryClient = createClient();
    const queryFn = vi.fn<PageQueryFn>(async (page) => pageData(page, 3));

    const fetcher = createQueryFetcher<Item>(queryClient, {
      queryKey: (page) => ["posts", page],
      queryFn,
      gcTime: 60_000,
    });

    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryFn.mock.calls[0][0]).toBe(1);
    expect(queryFn.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(result.current.data).toEqual(itemsOfPage(1));

    // The page is really in TanStack Query's cache ...
    expect(queryClient.getQueryData(["posts", 1])).toEqual(pageData(1, 3));

    // ... and the next page flows through the same pipeline.
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.data).toHaveLength(2 * PAGE_SIZE);
    expect(queryClient.getQueryData(["posts", 2])).toEqual(pageData(2, 3));
  });

  it("re-serves a page from the cache on reset when staleTime allows", async () => {
    const queryClient = createClient();
    const queryFn = vi.fn<PageQueryFn>(async (page) => pageData(page, 3));

    const fetcher = createQueryFetcher<Item>(queryClient, {
      queryKey: (page) => ["posts", page],
      queryFn,
      staleTime: Infinity,
    });

    const { result } = renderHook(() => useInfiniteScroll(fetcher));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.data).toHaveLength(2 * PAGE_SIZE);
    expect(queryFn).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.reset();
    });

    // Page 1 came back from the TanStack Query cache: no extra call.
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(itemsOfPage(1));
    expect(result.current.page).toBe(1);
  });

  it("deduplicates concurrent requests for the same page", async () => {
    const queryClient = createClient();
    const deferred = createDeferred<InfiniteScrollPage<Item>>();
    const queryFn = vi.fn<PageQueryFn>(() => deferred.promise);

    const fetcher = createQueryFetcher<Item>(queryClient, {
      queryKey: (page) => ["posts", page],
      queryFn,
    });

    const first = fetcher(1, new AbortController().signal);
    const second = fetcher(1, new AbortController().signal);

    deferred.resolve(pageData(1, 2));

    await expect(first).resolves.toEqual(pageData(1, 2));
    await expect(second).resolves.toEqual(pageData(1, 2));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("aborts the combined signal when the scroll request is superseded", async () => {
    const queryClient = createClient();
    let received: AbortSignal | undefined;
    const queryFn = vi.fn<PageQueryFn>(async (_page, context) => {
      received = context.signal;
      return pageData(1, 2);
    });

    const fetcher = createQueryFetcher<Item>(queryClient, {
      queryKey: (page) => ["posts", page],
      queryFn,
    });

    const controller = new AbortController();
    const promise = fetcher(1, controller.signal);

    expect(received?.aborted).toBe(false);
    controller.abort();
    expect(received?.aborted).toBe(true);

    // The in-flight query result still lands in the cache.
    await expect(promise).resolves.toEqual(pageData(1, 2));
  });

  it("hands out an already-aborted signal when called with one", async () => {
    const queryClient = createClient();
    let received: AbortSignal | undefined;
    const queryFn = vi.fn<PageQueryFn>(async (_page, context) => {
      received = context.signal;
      return pageData(1, 2);
    });

    const fetcher = createQueryFetcher<Item>(queryClient, {
      queryKey: (page) => ["posts", page],
      queryFn,
    });

    const controller = new AbortController();
    controller.abort();

    await fetcher(1, controller.signal);

    expect(received?.aborted).toBe(true);
  });

  it("propagates query failures into the hook's error state", async () => {
    const queryClient = createClient();
    let failures = 0;
    const queryFn = vi.fn<PageQueryFn>(async (page) => {
      failures += 1;
      if (failures === 1) {
        throw new Error("query failed");
      }
      return pageData(page, 2);
    });

    const fetcher = createQueryFetcher<Item>(queryClient, {
      queryKey: (page) => ["posts", page],
      queryFn,
    });

    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe("query failed");
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(itemsOfPage(1));
  });
});
