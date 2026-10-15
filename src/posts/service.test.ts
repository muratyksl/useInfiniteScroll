import { describe, expect, it } from "vitest";

import { installFetchMock, jsonResponse } from "../../test/mock-fetch";
import { getPosts } from "./service";
import type { Post } from "./types";

function post(id: number): Post {
  return { id, userId: 1, title: `post ${id} title`, body: `post ${id} body` };
}

describe("getPosts", () => {
  it("requests a page with _page/_limit and derives totalPages from x-total-count", async () => {
    const fetchMock = installFetchMock(() =>
      jsonResponse([post(1), post(2)], { headers: { "x-total-count": "100" } }),
    );

    const result = await getPosts(3);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    const url = new URL(String(input));
    expect(url.origin + url.pathname).toBe(
      "https://jsonplaceholder.typicode.com/posts",
    );
    expect(url.searchParams.get("_page")).toBe("3");
    expect(url.searchParams.get("_limit")).toBe("5");
    expect(init?.signal).toBeUndefined();
    expect(result.data).toEqual([post(1), post(2)]);
    expect(result.totalPages).toBe(20);
  });

  it("forwards the abort signal to fetch", async () => {
    const fetchMock = installFetchMock(() => jsonResponse([post(1)]));
    const controller = new AbortController();

    await getPosts(1, controller.signal);

    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("throws on non-OK responses", async () => {
    installFetchMock(() => new Response(null, { status: 500 }));

    await expect(getPosts(1)).rejects.toThrow("HTTP 500");
  });

  it("falls back to a single page when x-total-count is missing", async () => {
    installFetchMock(() => jsonResponse([post(1)]));

    const result = await getPosts(1);

    expect(result.totalPages).toBe(1);
  });
});
