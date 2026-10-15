import { vi } from "vitest";

function normalizeThresholds(
  threshold: number | number[] | undefined,
): number[] {
  if (threshold === undefined) return [0];
  return Array.isArray(threshold) ? threshold : [threshold];
}

function toEntry(
  target: Element,
  isIntersecting: boolean,
): IntersectionObserverEntry {
  const rect = target.getBoundingClientRect();
  return {
    isIntersecting,
    target,
    time: performance.now(),
    boundingClientRect: rect,
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: rect,
    rootBounds: null,
  };
}

/**
 * A controllable `IntersectionObserver` test double for jsdom, which does not
 * implement the API at all.
 *
 * Unlike a naive no-op mock, it records every instance and observed element
 * and lets tests fire the observer callback:
 *
 * ```ts
 * installMockIntersectionObserver();
 * // ...render...
 * MockIntersectionObserver.latest?.trigger(); // sentinel became visible
 * ```
 */
export class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  static get latest(): MockIntersectionObserver | undefined {
    return MockIntersectionObserver.instances.at(-1);
  }

  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly scrollMargin: string;
  readonly thresholds: readonly number[];

  private readonly callback: IntersectionObserverCallback;
  private readonly targets = new Set<Element>();

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.callback = callback;
    this.root = options?.root ?? null;
    this.rootMargin = options?.rootMargin ?? "0px";
    this.scrollMargin = options?.scrollMargin ?? "0px";
    this.thresholds = normalizeThresholds(options?.threshold);
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** The elements currently observed by this instance. */
  get observedElements(): Element[] {
    return [...this.targets];
  }

  /**
   * Fires the observer callback. Without a `target`, every observed element
   * is reported.
   */
  trigger(isIntersecting = true, target?: Element): void {
    const targets = target ? [target] : [...this.targets];
    const entries = targets.map((element) => toEntry(element, isIntersecting));
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

/** Makes `new IntersectionObserver(...)` return the test double. */
export function installMockIntersectionObserver(): void {
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
}

/** Clears the instance registry between tests. */
export function resetMockIntersectionObservers(): void {
  MockIntersectionObserver.instances = [];
}
