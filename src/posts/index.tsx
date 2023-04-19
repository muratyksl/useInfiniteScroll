import React from "react";

import useEasyInfiniteScroll, {
  ReturnType,
} from "../helperHooks/useEasyInfiniteScroll";
import Post from "./Post";
import { getPosts } from "./service";
import { Post as PostType } from "./types";
import Spinner from "../components/Spinner";

function Posts({
  data,
  isLoading,
  setLastElement,
  totalPages,
  page,
}: ReturnType<PostType>) {
  return (
    <>
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
    </>
  );
}

function Container() {
  const { data, isLoading, setLastElement, totalPages, page, resetPage } =
    useEasyInfiniteScroll<PostType>(getPosts);

  return (
    <div className="min-h-96 w-104 h-3/4 p-6 bg-slate-200 rounded-lg drop-shadow-lg overflow-auto items-center ">
      {data.length === 0 && !isLoading ? (
        "No posts found"
      ) : (
        <Posts
          data={data}
          isLoading={isLoading}
          setLastElement={setLastElement}
          totalPages={totalPages}
          page={page}
          resetPage={resetPage}
        />
      )}
    </div>
  );
}

export default Container;
