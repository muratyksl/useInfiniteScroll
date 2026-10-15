import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useInfiniteScroll } from "./index";
import type { InfiniteScrollFetcher, InfiniteScrollPage } from "./index";
import {
  MockIntersectionObserver,
  installMockIntersectionObserver,
  resetMockIntersectionObservers,
} from "../test/mock-intersection-observer";

type Item = { id: number };

const PAGE_SIZE = 3;

function itemsOfPage(page: number, size = PAGE_SIZE): Item[] {
  return Array.from({ length: size }, (_, index) => ({
    id: (page - 1) * size + index + 1,
  }));
}

function pageData(
  page: number,
  totalPages: number,
  size = PAGE_SIZE,
): InfiniteScrollPage<Item> {
  return { data: itemsOfPage(page, size), totalPages };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createSentinel(): HTMLDivElement {
  return document.createElement("div");
}

afterEach(resetMockIntersectionObservers);

describe("useInfiniteScroll", () => {
  it("loads the first page on mount and reports pagination state", async () => {
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async (page) =>
      pageData(page, 4),
    );

    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.page).toBe(1);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(1);
    expect(fetcher.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
    expect(result.current.data).toEqual(itemsOfPage(1));
    expect(result.current.totalPages).toBe(4);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("keeps isLoading true while the first page is pending", async () => {
    const deferred = createDeferred<InfiniteScrollPage<Item>>();
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(() => deferred.promise);

    const { result } = renderHook(() => useInfiniteScroll(fetcher));
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      deferred.resolve(pageData(1, 2));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual(itemsOfPage(1));
  });

  it("observes the sentinel and appends the next page when it intersects", async () => {
    installMockIntersectionObserver();
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async (page) =>
      pageData(page, 3),
    );
    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const sentinel = createSentinel();
    act(() => {
      result.current.setLastElement(sentinel);
    });
    expect(MockIntersectionObserver.latest?.observedElements).toEqual([
      sentinel,
    ]);

    await act(async () => {
      MockIntersectionObserver.latest?.trigger();
    });

    await waitFor(() =>
      expect(result.current.data).toHaveLength(2 * PAGE_SIZE),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe(2);
    expect(result.current.page).toBe(2);
  });

  it("does not load when the sentinel is not intersecting", async () => {
    installMockIntersectionObserver();
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async (page) =>
      pageData(page, 3),
    );
    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setLastElement(createSentinel());
    });
    await act(async () => {
      MockIntersectionObserver.latest?.trigger(false);
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toHaveLength(PAGE_SIZE);
  });

  it("ignores repeated intersections while a page is already loading", async () => {
    installMockIntersectionObserver();
    const deferred = createDeferred<InfiniteScrollPage<Item>>();
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async (page) =>
      page === 1 ? pageData(1, 3) : deferred.promise,
    );
    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setLastElement(createSentinel());
    });
    await act(async () => {
      const observer = MockIntersectionObserver.latest;
      observer?.trigger();
      observer?.trigger();
      observer?.trigger();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);

    await act(async () => {
      deferred.resolve(pageData(2, 3));
    });

    expect(result.current.data).toHaveLength(2 * PAGE_SIZE);
    expect(result.current.page).toBe(2);
  });

  it("stops at the last page and reports hasNextPage false", async () => {
    installMockIntersectionObserver();
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async (page) =>
      pageData(page, 2),
    );
    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setLastElement(createSentinel());
    });
    await act(async () => {
      MockIntersectionObserver.latest?.trigger();
    });
    await waitFor(() =>
      expect(result.current.data).toHaveLength(2 * PAGE_SIZE),
    );

    expect(result.current.page).toBe(2);
    expect(result.current.hasNextPage).toBe(false);

    await act(async () => {
      MockIntersectionObserver.latest?.trigger();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data).toHaveLength(2 * PAGE_SIZE);
  });

  it("supports totalPages Infinity for endless feeds", async () => {
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async (page) =>
      pageData(page, Infinity),
    );
    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.page).toBe(2);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("appends the next page through loadMore and is a no-op at the end", async () => {
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async (page) =>
      pageData(page, 2),
    );
    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.data).toEqual([...itemsOfPage(1), ...itemsOfPage(2)]);
    expect(result.current.page).toBe(2);
    expect(result.current.hasNextPage).toBe(false);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data).toHaveLength(2 * PAGE_SIZE);
  });

  it("works without IntersectionObserver as a manual fallback", async () => {
    // jsdom has no IntersectionObserver and the test does not install one.
    expect(typeof IntersectionObserver).toBe("undefined");

    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async (page) =>
      pageData(page, 2),
    );
    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const sentinel = createSentinel();
    expect(() => {
      act(() => {
        result.current.setLastElement(sentinel);
      });
    }).not.toThrow();

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.data).toHaveLength(2 * PAGE_SIZE);
    expect(result.current.page).toBe(2);
  });

  it("retries the first page after an initial failure", async () => {
    let failures = 0;
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async (page) => {
      failures += 1;
      if (failures === 1) {
        throw new Error("offline");
      }
      return pageData(page, 2);
    });

    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe("offline");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual([]);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(itemsOfPage(1));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe(1);
  });

  it("retries the failed page instead of skipping it", async () => {
    let shouldFail = true;
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async (page) => {
      if (page === 2 && shouldFail) {
        throw new Error("network error");
      }
      return pageData(page, 3);
    });

    const { result } = renderHook(() => useInfiniteScroll(fetcher));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error?.message).toBe("network error");
    expect(result.current.page).toBe(1);
    expect(result.current.data).toHaveLength(PAGE_SIZE);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasNextPage).toBe(true);

    shouldFail = false;
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.page).toBe(2);
    expect(result.current.data).toHaveLength(2 * PAGE_SIZE);
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([1, 2, 2]);
  });

  it("reset clears the list, refetches page 1 and drops stale responses", async () => {
    const deferreds: Array<
      ReturnType<typeof createDeferred<InfiniteScrollPage<Item>>>
    > = [];
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(() => {
      const deferred = createDeferred<InfiniteScrollPage<Item>>();
      deferreds.push(deferred);
      return deferred.promise;
    });

    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    await act(async () => {
      deferreds[0]?.resolve(pageData(1, 3));
    });
    expect(result.current.data).toEqual(itemsOfPage(1));

    // Start loading page 2, but leave it in flight.
    act(() => {
      void result.current.loadMore();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Reset while page 2 is pending.
    act(() => {
      void result.current.reset();
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(fetcher.mock.calls[1][1].aborted).toBe(true);

    const freshFirstPage: Item[] = [{ id: 101 }, { id: 102 }, { id: 103 }];
    await act(async () => {
      deferreds[2]?.resolve({ data: freshFirstPage, totalPages: 3 });
    });
    expect(result.current.data).toEqual(freshFirstPage);

    // The stale page 2 response arrives late and must be dropped.
    await act(async () => {
      deferreds[1]?.resolve(pageData(2, 3));
    });

    expect(result.current.data).toEqual(freshFirstPage);
    expect(result.current.page).toBe(1);
  });

  it("observes a sentinel that exists before the observer effect runs", async () => {
    installMockIntersectionObserver();
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async (page) =>
      pageData(page, 2),
    );

    function Fixture() {
      const { setLastElement } = useInfiniteScroll(fetcher);
      return <div data-testid="sentinel" ref={setLastElement} />;
    }

    render(<Fixture />);

    const sentinel = screen.getByTestId("sentinel");
    await waitFor(() =>
      expect(MockIntersectionObserver.latest?.observedElements).toEqual([
        sentinel,
      ]),
    );
  });

  it("wraps non-Error rejections into Error instances", async () => {
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async () => {
      throw "boom";
    });

    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("boom");
  });

  it("ignores a failed response from a superseded request", async () => {
    const first = createDeferred<InfiniteScrollPage<Item>>();
    const second = createDeferred<InfiniteScrollPage<Item>>();
    let calls = 0;
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(() => {
      calls += 1;
      return calls === 1 ? first.promise : second.promise;
    });

    const { result } = renderHook(() => useInfiniteScroll(fetcher));

    // reset supersedes the pending first request ...
    act(() => {
      void result.current.reset();
    });

    // ... so its failure must not surface as an error.
    await act(async () => {
      first.reject(new Error("stale failure"));
    });
    expect(result.current.error).toBeNull();

    await act(async () => {
      second.resolve(pageData(1, 2));
    });
    expect(result.current.data).toEqual(itemsOfPage(1));
    expect(result.current.error).toBeNull();
  });

  it("aborts the in-flight request on unmount", async () => {
    const deferred = createDeferred<InfiniteScrollPage<Item>>();
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(() => deferred.promise);

    const { unmount } = renderHook(() => useInfiniteScroll(fetcher));
    expect(fetcher.mock.calls[0][1].aborted).toBe(false);

    unmount();
    expect(fetcher.mock.calls[0][1].aborted).toBe(true);

    // A late response must not throw or update state after unmount.
    await act(async () => {
      deferred.resolve(pageData(1, 2));
    });
  });

  it("passes observer options, follows sentinel changes and disconnects on unmount", async () => {
    installMockIntersectionObserver();
    const fetcher = vi.fn<InfiniteScrollFetcher<Item>>(async (page) =>
      pageData(page, 5),
    );
    const { result, rerender, unmount } = renderHook(
      ({ rootMargin }: { rootMargin: string }) =>
        useInfiniteScroll(fetcher, { rootMargin, threshold: [0, 0.5] }),
      { initialProps: { rootMargin: "200px" } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const firstObserver = MockIntersectionObserver.latest;
    expect(firstObserver).toBeDefined();
    expect(firstObserver?.rootMargin).toBe("200px");
    expect([...(firstObserver?.thresholds ?? [])]).toEqual([0, 0.5]);

    const before = createSentinel();
    act(() => {
      result.current.setLastElement(before);
    });
    expect(firstObserver?.observedElements).toEqual([before]);

    const after = createSentinel();
    act(() => {
      result.current.setLastElement(after);
    });
    expect(firstObserver?.observedElements).toEqual([after]);

    act(() => {
      result.current.setLastElement(null);
    });
    expect(firstObserver?.observedElements).toEqual([]);

    // Changing observer options re-creates the observer.
    rerender({ rootMargin: "400px" });
    const secondObserver = MockIntersectionObserver.latest;
    expect(secondObserver).not.toBe(firstObserver);
    expect(secondObserver?.rootMargin).toBe("400px");
    expect(MockIntersectionObserver.instances).toHaveLength(2);

    unmount();
    expect(secondObserver?.observedElements).toEqual([]);
  });
});
