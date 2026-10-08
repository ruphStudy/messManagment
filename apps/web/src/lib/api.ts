import { API_PREFIX, type ApiErrorBody, type ApiSuccess, type AuthResponse, ErrorCode } from '@mess/shared';

export const NETWORK_ERROR = 'NETWORK_ERROR';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }

  get isNetwork() {
    return this.code === NETWORK_ERROR;
  }
}

// The access token lives only in memory; the refresh token is an httpOnly cookie the browser manages.
let accessToken: string | null = null;
let refreshInFlight: Promise<AuthResponse | null> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Called when a request fails because the session can no longer be refreshed. */
export function onSessionExpired(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Attach the access token and transparently refresh on 401. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
}

async function send<T>(path: string, { method = 'GET', body, auth = true, signal }: RequestOptions): Promise<ApiSuccess<T>> {
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, NETWORK_ERROR, 'Cannot reach the server. Check your internet connection and try again.');
  }

  if (res.status === 204) return { data: undefined as T };
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (json as ApiErrorBody | null)?.error;
    if (!error && res.status >= 500) {
      throw new ApiError(res.status, NETWORK_ERROR, 'The server is not responding. Please try again shortly.');
    }
    throw new ApiError(res.status, error?.code ?? ErrorCode.INTERNAL_ERROR, error?.message ?? 'Something went wrong', error?.fields);
  }
  return json as ApiSuccess<T>;
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= send<AuthResponse>('/auth/refresh', { method: 'POST', auth: false })
    .then(({ data: res }) => {
      setAccessToken(res.accessToken);
      return res;
    })
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        setAccessToken(null);
        return null;
      }
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/** Returns the response `data`. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiEnvelope<T>(path, options)).data;
}

/** Returns `{ data, meta }` — use for paginated lists. */
export async function apiEnvelope<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccess<T>> {
  try {
    return await send<T>(path, options);
  } catch (error) {
    const canRetry = options.auth !== false && error instanceof ApiError && error.status === 401;
    if (!canRetry) throw error;

    const refreshed = await refreshSession();
    if (!refreshed) {
      sessionExpiredHandler?.();
      throw error;
    }
    return send<T>(path, options);
  }
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** User-facing message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}

/** Authorized binary download (e.g. a complaint photo) as an object URL. Caller revokes it. */
export async function apiObjectUrl(path: string): Promise<string> {
  const get = () => fetch(`${API_PREFIX}${path}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, credentials: 'same-origin' });
  let res = await get();
  if (res.status === 401 && (await refreshSession())) res = await get();
  if (!res.ok) throw new ApiError(res.status, ErrorCode.FILE_NOT_FOUND, 'Could not load the file');
  return URL.createObjectURL(await res.blob());
}

/** Authorized file download (e.g. a CSV export): saves it under the server's filename. API errors are thrown as ApiError. */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const get = () => fetch(`${API_PREFIX}${path}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, credentials: 'same-origin' });
  let res: Response;
  try {
    res = await get();
    if (res.status === 401 && (await refreshSession())) res = await get();
  } catch {
    throw new ApiError(0, NETWORK_ERROR, 'Cannot reach the server. Check your internet connection and try again.');
  }
  if (!res.ok) {
    const error = ((await res.json().catch(() => null)) as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, error?.code ?? ErrorCode.INTERNAL_ERROR, error?.message ?? 'Download failed. Please try again.', error?.fields);
  }
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
