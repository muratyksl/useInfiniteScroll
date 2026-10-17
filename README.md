# useInfiniteScroll

[![CI](https://github.com/muratyksl/useInfiniteScroll/actions/workflows/ci.yml/badge.svg)](https://github.com/muratyksl/useInfiniteScroll/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A tiny, **race-safe**, **SSR-safe** React hook for infinite scrolling, built on the
[IntersectionObserver API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).

Zero dependencies (React is a peer), fully typed, ESM + CJS, ~1 kB gzipped — and a
real test suite that drives the observer instead of mocking it away.

```tsx
import { useInfiniteScroll } from "useinfinitescroll";

function List() {
  const { data, isLoading, error, hasNextPage, setLastElement, loadMore } =
    useInfiniteScroll<Item>(async (page, signal) => {
      const response = await fetch(`/api/items?page=${page}`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const items = await response.json();
      return { data: items, totalPages: 10 };
    });

  return (
    <div>
      {data.map((item) => (
        <Card key={item.id} item={item} />
      ))}

      {/* Sentinel: when this becomes visible, the next page loads. */}
      {hasNextPage && <div ref={setLastElement} />}

      {isLoading && <Spinner />}
      {error && <button onClick={() => void loadMore()}>Retry</button>}
    </div>
  );
}
```

## Why this hook

Most infinite-scroll snippets work until the second page. This one is built for the
details that usually break:

- **Race-safe** — every request carries a token; a stale response (after `reset()` or a
  newer request) is dropped instead of being appended twice.
- **Abortable** — your fetcher receives an `AbortSignal` that is aborted when the
  request becomes obsolete or the component unmounts. No state updates after unmount.
- **End-aware** — no page is requested past `totalPages`; `hasNextPage` tells you when
  to hide the sentinel. Return `totalPages: Infinity` for endless feeds.
- **Retry-friendly** — when a page fails, `loadMore()` retries that page instead of
  silently skipping it. Errors are exposed in `error`, not swallowed in a `console.log`.
- **SSR-safe** — no `window`/`IntersectionObserver` access during render. Without the
  observer (SSR, older browsers, jsdom) the first page still loads and `loadMore()`
  works as a manual fallback.
- **UI-agnostic** — the hook renders nothing and assumes no markup. Point
  `setLastElement` at a `<div>`, a table row, an SVG node or any component ref;
  everything else is up to your design system. The package ships no components
  and no CSS (the Tailwind demo is just an app).
- **Prefetch margin** — `rootMargin: "300px"` starts loading before the user hits the
  bottom.
- **Query-library friendly** — fetch straight through your `QueryClient` with the
  [`useinfinitescroll/query`](#tanstack-query-and-other-query-libraries) adapter and
  keep its caching, deduplication and retries.
- **Proven** — 34 tests, 100% statement/branch coverage on both entry points. The test
  double fires real `IntersectionObserver` callbacks, so the scrolling behavior
  itself is under test.

## Install

```sh
npm install useinfinitescroll
# or
pnpm add useinfinitescroll
yarn add useinfinitescroll
```

Requires React `^18.2.0 || ^19.0.0`.

## Usage

The fetcher receives the page number (starting at `1`) and an `AbortSignal`, and
returns `{ data, totalPages }`.

```tsx
import { useInfiniteScroll } from "useinfinitescroll";

type Item = { id: number; title: string };

const { data, setLastElement } = useInfiniteScroll<Item>(
  async (page, signal) => {
    const response = await fetch(`/api/items?page=${page}`, { signal });
    const json = await response.json();
    return { data: json.items, totalPages: json.pageCount };
  },
  { rootMargin: "200px", threshold: 0 },
);
```

### Endless feeds

```ts
return { data: await response.json(), totalPages: Infinity };
```

### Manual loading (no observer)

Render the first page and let users continue with a button — the hook handles the
same race-safety and page bookkeeping:

```tsx
{
  hasNextPage && <button onClick={() => void loadMore()}>Load more</button>;
}
```

### Starting over

`reset()` clears the list and loads page 1 again (useful for filters, pull-to-refresh
or a "restart" action). Any in-flight request is aborted and its response ignored.

### TanStack Query (and other query libraries)

Nothing here conflicts with a data-fetching library — but you don't have to choose:
the `useinfinitescroll/query` adapter routes every page through your
`QueryClient`, so TanStack Query provides caching, in-flight deduplication and
retries while the hook keeps handling the sentinel and page bookkeeping.

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { useInfiniteScroll } from "useinfinitescroll";
import { createQueryFetcher } from "useinfinitescroll/query";

function List() {
  const queryClient = useQueryClient();

  const { data, hasNextPage, setLastElement } = useInfiniteScroll(
    createQueryFetcher<Post>(queryClient, {
      queryKey: (page) => ["posts", page],
      queryFn: async (page, { signal }) => {
        const response = await fetch(`/api/posts?_page=${page}&_limit=10`, {
          signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { data: await response.json(), totalPages: 10 };
      },
      staleTime: 60_000,
    }),
  );
  // ... same rendering as above
}
```

The adapter is **structural**: it only requires a `fetchQuery` method, so it has no
runtime or type dependency on `@tanstack/react-query` (a real `QueryClient`
satisfies it as-is, and so does anything else with the same shape). A page that is
already fresh in the cache — for example after `reset()` — is served without a
network call. If you would rather have TanStack Query own the pagination state
itself, its `useInfiniteQuery` is the right tool; this adapter is for keeping the
scroll mechanics of this hook while your query client does the fetching.

## API

### `useInfiniteScroll(fetcher, options?)`

**Options**

| Option       | Type                 | Default | Description                                                                    |
| ------------ | -------------------- | ------- | ------------------------------------------------------------------------------ |
| `rootMargin` | `string`             | `"0px"` | Margin around the scroll container in which the sentinel counts as visible.    |
| `threshold`  | `number \| number[]` | `0`     | Visibility ratio(s) at which the sentinel counts as visible (forwarded as-is). |

**Returned values**

| Value            | Type                                  | Description                                                                             |
| ---------------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| `data`           | `T[]`                                 | All items loaded so far, in page order.                                                 |
| `page`           | `number`                              | The last successfully loaded page.                                                      |
| `totalPages`     | `number`                              | Total pages reported by the fetcher (`0` until the first response).                     |
| `isLoading`      | `boolean`                             | `true` while any page is being fetched, including the first one.                        |
| `error`          | `Error \| null`                       | The error thrown by the fetcher, if the last request failed.                            |
| `hasNextPage`    | `boolean`                             | `false` once all pages are loaded.                                                      |
| `setLastElement` | `(node: HTMLElement \| null) => void` | Ref callback for the sentinel element; loads the next page when it becomes visible.     |
| `loadMore`       | `() => Promise<void>`                 | Loads the next page manually. No-op while loading or at the end; retries a failed page. |
| `reset`          | `() => Promise<void>`                 | Clears the list and loads the first page again.                                         |

**Fetcher type**

```ts
type InfiniteScrollFetcher<T> = (
  page: number,
  signal: AbortSignal,
) => Promise<{ data: T[]; totalPages: number }>;
```

## Demo

A live demo is deployed to GitHub Pages:
**https://muratyksl.github.io/useInfiniteScroll/**

It paginates the public [JSONPlaceholder](https://jsonplaceholder.typicode.com/) API,
including error, retry, end-of-list and reset states. Run it locally:

```sh
pnpm install
pnpm dev
```

## Development

Requires Node 24+ and pnpm 12 (see `.node-version` / `packageManager`).

| Script               | What it does                                        |
| -------------------- | --------------------------------------------------- |
| `pnpm dev`           | Runs the demo app with HMR.                         |
| `pnpm test`          | Vitest in watch mode.                               |
| `pnpm test:run`      | Single test run.                                    |
| `pnpm coverage`      | Coverage report for `lib/` (currently 100%).        |
| `pnpm typecheck`     | TypeScript, no emit.                                |
| `pnpm lint`          | ESLint (flat config, react-hooks rules included).   |
| `pnpm build`         | Typechecks, bundles `lib/` to `dist/`, emits types. |
| `pnpm build:demo`    | Builds the demo app to `dist-demo/` (GitHub Pages). |
| `pnpm check:package` | [publint](https://publint.dev) packaging check.     |

Tests live next to the code they cover:

- `lib/useInfiniteScroll.test.tsx` — hook behavior (mount, paging, races, retries,
  aborting, UI-agnostic sentinels).
- `lib/query.test.tsx` — the TanStack Query adapter against a real `QueryClient`
  (cache population, cache hits on reset, deduplication, signal combining).
- `src/posts/service.test.ts` — request shape, `totalPages` derivation, errors.
- `src/posts/posts.test.tsx` — the demo end to end, driven by a controllable
  `IntersectionObserver` double (`test/mock-intersection-observer.ts`).

## CI/CD

- **CI** (`.github/workflows/ci.yml`) — on every push/PR: typecheck, lint, tests and
  build on Node 22 and 24, plus coverage, demo build and publint on Node 24.
- **Demo** (`.github/workflows/pages.yml`) — builds and deploys the demo app to
  GitHub Pages on every push to `master`.
- **Publish** (`.github/workflows/publish.yml`) — publishing a GitHub release (or
  manual dispatch) tests, builds and publishes to npm with
  [provenance](https://docs.npmjs.com/generating-provenance-statements) via
  trusted publishing.
- **Dependabot** keeps npm dependencies and actions up to date weekly.

## License

[MIT](./LICENSE)
