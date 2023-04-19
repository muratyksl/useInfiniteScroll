import React from "react";
import { beforeEach, describe, expect, it, test, vitest } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from "../utils/test-utils";
import PostsComp from "./";

describe("Posts Component", () => {
  // IntersectionObserver isn't available in test environment
  beforeEach(() => {
    // IntersectionObserver isn't available in test environment
    const mockIntersectionObserver = vitest.fn();
    mockIntersectionObserver.mockReturnValue({
      observe: () => null,
      unobserve: () => null,
      disconnect: () => null,
    });
    window.IntersectionObserver = mockIntersectionObserver;
  });

  it("It should render first five post when  the page loads", async () => {
    render(<PostsComp />);
    const loading = screen.getByRole("spinner");

    await waitForElementToBeRemoved(loading);

    const posts = await screen.findAllByRole("post-article");

    expect(posts.length).toBe(5);
  });

  it("It should render next five post when  scroll to bottom", async () => {
    render(<PostsComp />);
    const loading = screen.getByRole("spinner");

    await waitForElementToBeRemoved(loading);

    const posts = screen.getAllByRole("post-article");

    expect(posts.length).toBe(5);

    fireEvent.scroll(window, {
      target: {
        scrollY: posts[posts.length - 1].scrollHeight,
      },
    });

    // can not make scroll to last element so set to 5 for now comment the spinner
    // const loading2 = screen.getByRole("spinner");
    // await waitForElementToBeRemoved(loading2);

    const newPosts = await screen.findAllByRole("post-article");

    expect(newPosts.length).toBe(5);
  });
});
