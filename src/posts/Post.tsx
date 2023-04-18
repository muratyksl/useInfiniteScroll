import React, { forwardRef } from "react";
import { Post as PostType } from "./types";

const Post = forwardRef(function Post(
  { title, body }: Pick<PostType, "title" | "body">,
  ref
) {
  return (
    <article
      ref={ref}
      className="w-96 p-6 mb-4 bg-white rounded-sm drop-shadow-sm"
    >
      <h2 className="pb-4 font-semibold">{title}</h2>
      <p>{body}</p>
    </article>
  );
});

export default Post;
