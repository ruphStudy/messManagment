import { API_PREFIX, CLIENT_HEADER, ClientType, ErrorCode, type ApiErrorBody, type AuthResponse } from '@mess/shared';
import { tokenStorage } from './token-storage';

const BASE_URL = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4100'}${API_PREFIX}`;
const TIMEOUT_MS = 15_000;
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

let accessToken: string | null = null;
let refreshInFlight: Promise<AuthResponse | null> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function onSessionExpired(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

async function send<T>(path: string, { method = 'GET', body, auth = true }: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', [CLIENT_HEADER]: ClientType.MOBILE };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR, 'Cannot reach the server. Check your internet connection.');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (json as ApiErrorBody | null)?.error;
    if (!error && res.status >= 500) throw new ApiError(res.status, NETWORK_ERROR, 'The server is not responding. Please try again.');
    throw new ApiError(res.status, error?.code ?? ErrorCode.INTERNAL_ERROR, error?.message ?? 'Something went wrong', error?.fields);
  }
  return (json as { data: T }).data;
}

/** Stores tokens from a login/refresh response. */
export async function storeSession(res: AuthResponse) {
  setAccessToken(res.accessToken);
  if (res.refreshToken) await tokenStorage.set(res.refreshToken);
}

export async function clearSession() {
  setAccessToken(null);
  await tokenStorage.clear();
}

/** Uses the stored refresh token to get a new access token. Returns null when the session is gone. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    const refreshToken = await tokenStorage.get();
    if (!refreshToken) return null;
    try {
      const res = await send<AuthResponse>('/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false });
      await storeSession(res);
      return res;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearSession();
        return null;
      }
      throw error;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await send<T>(path, options);
  } catch (error) {
    if (options.auth === false || !(error instanceof ApiError) || error.status !== 401) throw error;
    const refreshed = await refreshSession();
    if (!refreshed) {
      sessionExpiredHandler?.();
      throw error;
    }
    return send<T>(path, options);
  }
}

export async function logoutRequest() {
  const refreshToken = await tokenStorage.get();
  try {
    if (refreshToken) await send('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false });
  } finally {
    await clearSession();
  }
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}
