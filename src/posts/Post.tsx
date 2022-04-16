import React from "react";

interface IPost {
  title: string;
  body: string;
}

function Post({ title, body }: IPost) {
  return (
    <article className="w-96 p-6 mb-4 bg-white rounded-sm drop-shadow-sm">
      <h2 className="pb-4 font-semibold">{title}</h2>
      <p>{body}</p>
    </article>
  );
}

export default Post;
