import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Posts from "./";

const posts = Array.from({ length: 120 }, (_, index) => ({
  id: index + 1,
  userId: 1,
  title: `${index} post title`,
  body: `${index} post body`,
}));

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Posts Component", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const page = Number(url.searchParams.get("page") ?? "1");
        const limit = Number(url.searchParams.get("limit") ?? "5");
        const startIndex = (page - 1) * limit;
        return jsonResponse(posts.slice(startIndex, startIndex + limit));
      }),
    );

    // IntersectionObserver isn't available in test environment
    class MockIntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("It should render first five post when the page loads", async () => {
    render(<Posts />);
    const loading = screen.getByRole("spinner");

    await waitForElementToBeRemoved(loading);

    const rendered = await screen.findAllByRole("post-article");

    expect(rendered).toHaveLength(5);
  });

  it("It should not request another page until the sentinel intersects", async () => {
    render(<Posts />);
    await waitForElementToBeRemoved(screen.getByRole("spinner"));

    expect(screen.getAllByRole("post-article")).toHaveLength(5);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
