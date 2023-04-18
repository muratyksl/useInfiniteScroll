import { rest } from "msw";

const mockPostCreator = (index: number) => {
  return {
    id: self.crypto.randomUUID(),
    userId: self.crypto.randomUUID(),
    title: `${index} post title`,
    body: `${index} post body`,
  };
};

// generette 120 post with mockPostCreator
export const posts = Array.from({ length: 120 }, (_, index) =>
  mockPostCreator(index)
);

export const handlers = [
  rest.get("/posts", (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(posts));
  }),
];
