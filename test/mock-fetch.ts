import { vi } from "vitest";

export type FetchHandler = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response> | Response;

/**
 * Stubs `globalThis.fetch` with a `vi.fn` around `handler` and returns the
 * mock so tests can assert on URLs and call counts. The stub is removed
 * automatically (`unstubGlobals` in the vitest config).
 */
export function installFetchMock(handler: FetchHandler) {
  const mock = vi.fn(handler);
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** Builds a JSON `Response`, merging headers meant for the stub. */
export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}
