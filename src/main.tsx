import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

if (import.meta.env.MODE === "development") {
  const { worker } = await import("./mocks/browser");
  worker.start();
}

const container = document.getElementById("root");
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
