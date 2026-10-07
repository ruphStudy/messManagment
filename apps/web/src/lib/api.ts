import { API_PREFIX, type ApiErrorBody, type AuthResponse, ErrorCode } from '@mess/shared';

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
}

async function send<T>(path: string, { method = 'GET', body, auth = true }: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR, 'Cannot reach the server. Check your internet connection and try again.');
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (json as ApiErrorBody | null)?.error;
    if (!error && res.status >= 500) {
      throw new ApiError(res.status, NETWORK_ERROR, 'The server is not responding. Please try again shortly.');
    }
    throw new ApiError(res.status, error?.code ?? ErrorCode.INTERNAL_ERROR, error?.message ?? 'Something went wrong', error?.fields);
  }
  return (json as { data: T }).data;
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= send<AuthResponse>('/auth/refresh', { method: 'POST', auth: false })
    .then((res) => {
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

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

/** User-facing message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}
