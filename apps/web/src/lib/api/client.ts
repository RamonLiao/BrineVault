const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export class ApiClient {
  private getToken: () => string | null;
  private onUnauthorised: () => void;

  constructor(getToken: () => string | null, onUnauthorised: () => void) {
    this.getToken = getToken;
    this.onUnauthorised = onUnauthorised;
  }

  async fetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, headers: extraHeaders, ...rest } = options;
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
        });

        if (res.status === 401) {
          // TODO: implement token refresh via POST /auth/refresh
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
