import React from "react";

export default function Spinner() {
  return (
    <div role="spinner" className="flex justify-center items-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-700"></div>
    </div>
  );
}
