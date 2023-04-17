import React from "react";

import Post from "./Post";

function Posts() {
  return (
    <div className="min-h-96 h-3/4 p-6 bg-slate-200 rounded-lg drop-shadow-lg overflow-auto">
      <Post title="Hello World" body="This is a post" />
    </div>
  );
}

export default Posts;
