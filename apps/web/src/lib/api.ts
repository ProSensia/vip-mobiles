import "server-only";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function parseAndThrow<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : undefined;
  if (!res.ok) throw new ApiError(res.status, body?.error || res.statusText, body?.details);
  return body as T;
}

/**
 * Public, cookie-free fetch for storefront data (settings, catalog, product
 * pages, branches, homepage sections). Never touches next/headers' cookies(),
 * so pages using only this helper stay eligible for static rendering / ISR
 * instead of being forced into per-request dynamic rendering.
 */
export async function publicApi<T = any>(
  path: string,
  init?: RequestInit & { next?: NextFetchRequestConfig }
): Promise<T> {
  const res = await fetch(`${API_INTERNAL_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    next: init?.next ?? { revalidate: 60 },
    // Bounded so a slow/unreachable API fails fast during SSR/SSG instead of
    // hanging the whole page (or build) — better a degraded page than none.
    signal: init?.signal ?? AbortSignal.timeout(8000),
  });
  return parseAndThrow<T>(res);
}

export async function publicApiSafe<T = any>(path: string, init?: RequestInit & { next?: NextFetchRequestConfig }): Promise<T | null> {
  try {
    return await publicApi<T>(path, init);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) return null;
    // Network-level failure (API unreachable, e.g. during a build without the
    // API running) — degrade gracefully instead of crashing the page/build.
    console.warn(`publicApiSafe: ${path} failed —`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Authenticated fetch (Server Components, Route Handlers) for admin/portal
 * pages and session lookups. Forwards the incoming request's cookies and is
 * always uncached, since the response is specific to whoever is logged in —
 * this necessarily opts the calling route into dynamic rendering.
 */
export async function serverApi<T = any>(path: string, init?: RequestInit): Promise<T> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const res = await fetch(`${API_INTERNAL_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...init?.headers,
    },
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(8000),
  });
  return parseAndThrow<T>(res);
}

/** Same as serverApi but returns null instead of throwing on 401/404 — handy for optional session/data lookups. */
export async function serverApiSafe<T = any>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    return await serverApi<T>(path, init);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) return null;
    console.warn(`serverApiSafe: ${path} failed —`, err instanceof Error ? err.message : err);
    return null;
  }
}
