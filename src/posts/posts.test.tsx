import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MockIntersectionObserver,
  installMockIntersectionObserver,
  resetMockIntersectionObservers,
} from "../../test/mock-intersection-observer";
import { installFetchMock, jsonResponse } from "../../test/mock-fetch";
import type { FetchHandler } from "../../test/mock-fetch";
import Posts from "./index";
import type { Post } from "./types";

const TOTAL_POSTS = 12;
const LIMIT = 5;

const allPosts: Post[] = Array.from({ length: TOTAL_POSTS }, (_, index) => ({
  id: index + 1,
  userId: 1,
  title: `Post ${index + 1} title`,
  body: `Post ${index + 1} body`,
}));

/** Serves JSONPlaceholder-style paged responses with an x-total-count header. */
const paginatedHandler: FetchHandler = (input) => {
  const url = new URL(String(input));
  const page = Number(url.searchParams.get("_page") ?? "1");
  const limit = Number(url.searchParams.get("_limit") ?? String(LIMIT));
  const startIndex = (page - 1) * limit;
  return jsonResponse(allPosts.slice(startIndex, startIndex + limit), {
    headers: { "x-total-count": String(TOTAL_POSTS) },
  });
};

function postTitles(): string[] {
  return screen
    .getAllByRole("post-article")
    .map((article) => article.querySelector("h2")?.textContent ?? "");
}

let fetchMock: ReturnType<typeof installFetchMock>;

beforeEach(() => {
  installMockIntersectionObserver();
  fetchMock = installFetchMock(paginatedHandler);
});

afterEach(resetMockIntersectionObservers);

describe("Posts demo", () => {
  it("renders the first page and observes the last post as the sentinel", async () => {
    render(<Posts />);

    expect(screen.getByRole("spinner")).toBeDefined();

    await waitFor(() => expect(screen.queryByRole("spinner")).toBeNull());

    const articles = screen.getAllByRole("post-article");
    expect(articles).toHaveLength(5);
    expect(postTitles()).toEqual(allPosts.slice(0, 5).map((p) => p.title));

    expect(String(fetchMock.mock.calls[0][0])).toContain("_page=1&_limit=5");

    await waitFor(() =>
      expect(MockIntersectionObserver.latest?.observedElements).toEqual([
        articles.at(-1),
      ]),
    );
  });

  it("loads and appends the next page when the sentinel intersects", async () => {
    render(<Posts />);
    await waitFor(() => expect(screen.queryByRole("spinner")).toBeNull());
    expect(screen.getAllByRole("post-article")).toHaveLength(5);

    await act(async () => {
      MockIntersectionObserver.latest?.trigger();
    });

    await waitFor(() =>
      expect(screen.getAllByRole("post-article")).toHaveLength(10),
    );

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("_page=2&_limit=5"),
      ),
    ).toBe(true);

    // All items are unique (no duplicated pages) ...
    expect(new Set(postTitles()).size).toBe(10);
    expect(postTitles()).toEqual(allPosts.slice(0, 10).map((p) => p.title));

    // ... and the sentinel moved to the new last post.
    const articles = screen.getAllByRole("post-article");
    await waitFor(() =>
      expect(MockIntersectionObserver.latest?.observedElements).toEqual([
        articles.at(-1),
      ]),
    );
  });

  it("stops at the end of the list and shows the end state", async () => {
    render(<Posts />);
    await waitFor(() => expect(screen.queryByRole("spinner")).toBeNull());

    await act(async () => {
      MockIntersectionObserver.latest?.trigger();
    });
    await waitFor(() =>
      expect(screen.getAllByRole("post-article")).toHaveLength(10),
    );

    await act(async () => {
      MockIntersectionObserver.latest?.trigger();
    });
    await waitFor(() =>
      expect(screen.getAllByRole("post-article")).toHaveLength(TOTAL_POSTS),
    );

    expect(screen.getByRole("status").textContent).toContain(
      "You have reached the end",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // No sentinel is observed anymore, so further intersections do nothing.
    await act(async () => {
      MockIntersectionObserver.latest?.trigger();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("surfaces a failed page in the error banner and retries it", async () => {
    let failPageTwo = true;
    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input));
      if (page(url) === 2 && failPageTwo) {
        return new Response(null, { status: 500 });
      }
      return paginatedHandler(input, init);
    });

    render(<Posts />);
    await waitFor(() => expect(screen.queryByRole("spinner")).toBeNull());

    await act(async () => {
      MockIntersectionObserver.latest?.trigger();
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("HTTP 500");
    expect(screen.getAllByRole("post-article")).toHaveLength(5);

    failPageTwo = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(screen.getAllByRole("post-article")).toHaveLength(10),
    );
    expect(screen.queryByRole("alert")).toBeNull();

    const pageTwoCalls = fetchMock.mock.calls.filter(
      ([input]) => page(new URL(String(input))) === 2,
    );
    expect(pageTwoCalls).toHaveLength(2);
  });

  it("restarts the list from page 1 with the reset button", async () => {
    render(<Posts />);
    await waitFor(() => expect(screen.queryByRole("spinner")).toBeNull());

    await act(async () => {
      MockIntersectionObserver.latest?.trigger();
    });
    await waitFor(() =>
      expect(screen.getAllByRole("post-article")).toHaveLength(10),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset list" }));

    await waitFor(() =>
      expect(screen.getAllByRole("post-article")).toHaveLength(5),
    );
    expect(postTitles()).toEqual(allPosts.slice(0, 5).map((p) => p.title));

    const firstPageCalls = fetchMock.mock.calls.filter(
      ([input]) => page(new URL(String(input))) === 1,
    );
    expect(firstPageCalls).toHaveLength(2);
  });
});

function page(url: URL): number {
  return Number(url.searchParams.get("_page") ?? "1");
}
