import React, { useEffect } from "react";

import useEasyInfiniteScroll from "../helperHooks/useEasyInfiniteScroll";
import Post from "./Post";
import { getPosts } from "./service";
import { Post as PostType } from "./types";
import Spinner from "../components/Spinner";

function Posts() {
  let { data, isLoading, setLastElement, totalPages, page, resetPage } =
    useEasyInfiniteScroll<PostType>(getPosts);

  return (
    <div className="min-h-96 h-3/4 p-6 bg-slate-200 rounded-lg drop-shadow-lg overflow-auto">
      {data.map((post, i) => {
        return i === data.length - 1 && page < totalPages ? (
          <Post
            ref={setLastElement}
            key={post.id}
            body={post.body}
            title={post.title}
          />
        ) : (
          <Post key={post.id} body={post.body} title={post.title} />
        );
      })}
      {isLoading ? <Spinner /> : null}
    </div>
  );
}

export default Posts;
