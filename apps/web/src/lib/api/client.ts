const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  _isRetry?: boolean;
}

export class ApiClient {
  private getToken: () => string | null;
  private onUnauthorised: () => void;
  private onTokenRefreshed: (token: string) => void;

  constructor(
    getToken: () => string | null,
    onUnauthorised: () => void,
    onTokenRefreshed: (token: string) => void,
  ) {
    this.getToken = getToken;
    this.onUnauthorised = onUnauthorised;
    this.onTokenRefreshed = onTokenRefreshed;
  }

  async fetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, headers: extraHeaders, _isRetry, ...rest } = options;
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders as Record<string, string>,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let attempts = 0;
    const maxRetries = 3;

    while (attempts <= maxRetries) {
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          ...rest,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          credentials: 'include',
        });

        if (res.status === 401) {
          if (!_isRetry) {
            const refreshed = await this.attemptRefresh();
            if (refreshed) {
              return this.fetch<T>(path, { ...options, _isRetry: true });
            }
          }
          this.onUnauthorised();
          throw new ApiRequestError('Unauthorised', 'E_UNAUTHORISED', 401);
        }

        if (!res.ok) {
          const error = await res.json().catch(() => ({ message: res.statusText }));
          throw new ApiRequestError(
            error.message ?? 'Request failed',
            error.code ?? 'E_UNKNOWN',
            res.status,
            error.details,
          );
        }

        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      } catch (err) {
        if (err instanceof ApiRequestError) throw err;
        // Only retry on network errors (TypeError from fetch)
        if (!(err instanceof TypeError)) throw err;
        attempts++;
        if (attempts > maxRetries) throw err;
        await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 1000));
      }
    }

    throw new Error('Unreachable');
  }

  private async attemptRefresh(): Promise<boolean> {
    try {
      const token = this.getToken();
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.onTokenRefreshed(data.access_token);
      return true;
    } catch {
      return false;
    }
  }

  get<T>(path: string) {
    return this.fetch<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown) {
    return this.fetch<T>(path, { method: 'POST', body });
  }

  put<T>(path: string, body?: unknown) {
    return this.fetch<T>(path, { method: 'PUT', body });
  }

  delete<T>(path: string) {
    return this.fetch<T>(path, { method: 'DELETE' });
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}
