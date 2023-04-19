import { Post, RequestedPosts } from "./types";

export async function getPosts(
  page: number,
  limit = 5
): Promise<RequestedPosts> {
  const posts = await fetch(
    `https://jsonplaceholder.typicode.com/posts?page=${page}&limit=${limit}`
  );

  const data = await posts.json();

  return {
    data,
    totalPages: 10,
  };
}
