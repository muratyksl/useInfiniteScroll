import { useInfiniteScroll } from "../../lib";
import Post from "./Post";
import { getPosts } from "./service";
import Spinner from "../components/Spinner";

export default function Posts() {
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    setLastElement,
    loadMore,
    reset,
  } = useInfiniteScroll(getPosts, { rootMargin: "200px" });

  return (
    <div className="min-h-96 w-104 h-3/4 p-6 bg-slate-200 rounded-lg drop-shadow-lg overflow-auto items-center">
      {data.map((post, index) => (
        <Post
          key={post.id}
          title={post.title}
          body={post.body}
          ref={
            index === data.length - 1 && hasNextPage
              ? setLastElement
              : undefined
          }
        />
      ))}

      {isLoading && <Spinner />}

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 p-4 mb-4 text-red-800 bg-red-100 rounded-sm"
        >
          <p>{error.message}</p>
          <button
            type="button"
            className="px-3 py-1 font-semibold text-white bg-red-700 rounded-sm"
            onClick={() => void loadMore()}
          >
            Try again
          </button>
        </div>
      )}

      {!hasNextPage && !isLoading && !error && data.length > 0 && (
        <p role="status" className="text-center text-slate-500">
          You have reached the end
        </p>
      )}

      {data.length === 0 && !isLoading && !error && <p>No posts found</p>}

      {data.length > 0 && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className="px-3 py-1 text-sm text-slate-600 underline"
            onClick={() => void reset()}
          >
            Reset list
          </button>
        </div>
      )}
    </div>
  );
}
