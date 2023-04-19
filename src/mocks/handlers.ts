import { rest } from "msw";

let crypto: Crypto | null = null;

if (import.meta.env.MODE === "development") {
  crypto = self.crypto;
} else if (import.meta.env.MODE === "test") {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  crypto = await import("crypto");
}

const mockPostCreator = (index: number) => {
  if (!crypto) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    title: `${index} post title`,
    body: `${index} post body`,
  };
};

// generette 120 post with mockPostCreator
export const posts = Array.from({ length: 120 }, (_, index) =>
  mockPostCreator(index)
);

export const handlers = [
  rest.get("https://jsonplaceholder.typicode.com/posts*", (req, res, ctx) => {
    //create paginated with page and limit
    const page = req.url.searchParams.get("page");
    const limit = req.url.searchParams.get("limit");

    if (!page || !limit) {
      return res(ctx.status(400), ctx.json({ message: "Invalid query" }));
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const startIndex = (pageNumber - 1) * limitNumber;
    const endIndex = pageNumber * limitNumber;
    const paginatedPosts = posts.slice(startIndex, endIndex);
    return res(ctx.status(200), ctx.json(paginatedPosts));
  }),
];
