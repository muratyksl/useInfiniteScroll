import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";
import { cleanup } from "./utils/test-utils";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
afterEach(() => {
  cleanup();
});
