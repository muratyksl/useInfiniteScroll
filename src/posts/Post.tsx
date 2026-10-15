import type { Ref } from "react";
import type { Post as PostType } from "./types";

type PostProps = Pick<PostType, "title" | "body"> & {
  ref?: Ref<HTMLElement>;
};

export default function Post({ title, body, ref }: PostProps) {
  return (
    <article
      role="post-article"
      ref={ref}
      className="w-96 p-6 mb-4 bg-white rounded-sm drop-shadow-sm"
    >
      <h2 className="pb-4 font-semibold">{title}</h2>
      <p>{body}</p>
    </article>
  );
}
