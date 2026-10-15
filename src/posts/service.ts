import type { InfiniteScrollPage } from "../../lib";
import type { Post } from "./types";

const POSTS_URL = "https://jsonplaceholder.typicode.com/posts";
const POSTS_PER_PAGE = 5;

/**
 * Loads one page of posts from JSONPlaceholder.
 *
 * JSONPlaceholder paginates with `_page`/`_limit` and reports the total
 * number of posts in the `x-total-count` header.
 */
export async function getPosts(
  page: number,
  signal?: AbortSignal,
): Promise<InfiniteScrollPage<Post>> {
  const response = await fetch(
    `${POSTS_URL}?_page=${page}&_limit=${POSTS_PER_PAGE}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch posts (HTTP ${response.status})`);
  }

  const data = (await response.json()) as Post[];
  const totalCount = Number(response.headers.get("x-total-count") ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / POSTS_PER_PAGE));

  return { data, totalPages };
}
