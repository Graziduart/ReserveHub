import {
  CircuitOpenError,
  circuitKeyFromUrl,
  circuitServiceLabel,
  withCircuit,
} from './circuitBreaker';

export type ApiService = 'core' | 'iam' | 'data' | 'audit';

/** Disparado após login, logout ou sessão expirada (401 no core). */
export const RESERVEHUB_AUTH_EVENT = 'reservehub:auth-changed';

const ACCESS_TOKEN_KEY = 'reservehub.accessToken';
const REFRESH_TOKEN_KEY = 'reservehub.refreshToken';
const AUTH_USER_KEY = 'reservehub.user';

export type StoredAuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId?: string;
};

function useProxy(): boolean {
  const v = import.meta.env.VITE_USE_PROXY;
  return v === '1' || v === 'true';
}

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, '');
}

function resolveCoreBase(): string {
  const def = 'http://127.0.0.1:3000';
  return stripTrailingSlash(import.meta.env.VITE_API_CORE ?? def);
}

function resolveIamBase(): string {
  const def = 'http://127.0.0.1:3001';
  return stripTrailingSlash(import.meta.env.VITE_API_IAM ?? def);
}

/** Indica se a URL aponta para o service-core (para anexar JWT). */
export function isCoreApiUrl(url: string): boolean {
  if (useProxy()) {
    return url.startsWith('/proxy/core');
  }
  const base = resolveCoreBase();
  return url.startsWith(base);
}

/** Indica se a URL aponta para o service-iam (para anexar JWT). */
export function isIamApiUrl(url: string): boolean {
  if (useProxy()) {
    return url.startsWith('/proxy/iam');
  }
  const base = resolveIamBase();
  return url.startsWith(base);
}

function resolveDataBase(): string {
  const def = 'http://127.0.0.1:3002';
  return stripTrailingSlash(import.meta.env.VITE_API_DATA ?? def);
}

function resolveAuditBase(): string {
  const def = 'http://127.0.0.1:3003';
  return stripTrailingSlash(import.meta.env.VITE_API_AUDIT ?? def);
}

export function isDataApiUrl(url: string): boolean {
  if (useProxy()) {
    return url.startsWith('/proxy/data');
  }
  return url.startsWith(resolveDataBase());
}

export function isAuditApiUrl(url: string): boolean {
  if (useProxy()) {
    return url.startsWith('/proxy/audit');
  }
  return url.startsWith(resolveAuditBase());
}

function isProtectedAuthUrl(url: string): boolean {
  if (isCoreApiUrl(url)) {
    return !url.includes('/auth/login');
  }
  if (isIamApiUrl(url)) {
    return (
      !url.includes('/auth/login') &&
      !url.includes('/auth/google') &&
      !url.includes('/auth/refresh') &&
      !url.includes('/auth/logout')
    );
  }
  if (isDataApiUrl(url) || isAuditApiUrl(url)) {
    return !url.includes('/health');
  }
  return false;
}

function shouldAttachBearer(url: string): boolean {
  return (
    isCoreApiUrl(url) ||
    isIamApiUrl(url) ||
    isDataApiUrl(url) ||
    isAuditApiUrl(url)
  );
}

export function getStoredAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAccessToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function getStoredAuthUser(): StoredAuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuthUser;
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user: StoredAuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredRefreshToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearAuthSession(): void {
  setStoredAccessToken(null);
  setStoredRefreshToken(null);
  setStoredAuthUser(null);
}

let refreshInFlight: Promise<boolean> | null = null;

/** Renova access token via IAM; devolve true se conseguiu. */
export async function tryRefreshAccessToken(): Promise<boolean> {
  const refresh = getStoredRefreshToken();
  if (!refresh) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(apiUrl('iam', '/auth/refresh'), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        const text = await res.text();
        if (!res.ok) return false;
        const data = JSON.parse(text) as {
          accessToken?: string;
          refreshToken?: string;
        };
        if (!data.accessToken) return false;
        setStoredAccessToken(data.accessToken);
        if (data.refreshToken) setStoredRefreshToken(data.refreshToken);
        window.dispatchEvent(new Event(RESERVEHUB_AUTH_EVENT));
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/** URL absoluta ou caminho para o proxy do Vite. */
export function apiUrl(service: ApiService, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (useProxy()) {
    return `/proxy/${service}${p}`;
  }
  const key =
    service === 'core'
      ? 'VITE_API_CORE'
      : service === 'iam'
        ? 'VITE_API_IAM'
        : service === 'data'
          ? 'VITE_API_DATA'
          : 'VITE_API_AUDIT';
  const def =
    service === 'core'
      ? 'http://127.0.0.1:3000'
      : service === 'iam'
        ? 'http://127.0.0.1:3001'
        : service === 'data'
          ? 'http://127.0.0.1:3002'
          : 'http://127.0.0.1:3003';
  const base = stripTrailingSlash(import.meta.env[key] ?? def);
  return `${base}${p}`;
}

/** Mensagem legível para erros HTTP da API. */
export function formatApiError(err: unknown, serviceHint?: string): string {
  if (err instanceof CircuitOpenError) {
    const label = circuitServiceLabel(err.serviceKey);
    const sec = Math.ceil(err.retryAfterMs / 1000);
    return `O serviço ${label} está em pausa (circuit breaker aberto). Tente novamente em ${sec}s ou repõe o circuito em Health Checks.`;
  }

  const status = (err as Error & { status?: number })?.status;
  const raw = err instanceof Error ? err.message : String(err);

  if (status === 502 || status === 503 || raw.includes('Failed to fetch')) {
    const svc = serviceHint ?? 'servidor';
    return `O ${svc} não está a responder. Execute npm run rebuild:core ou npm run start:all.`;
  }
  if (status === 500) {
    try {
      const body = JSON.parse(raw) as { message?: string | string[] };
      const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      if (msg) return `Erro no servidor: ${msg}`;
    } catch {
      /* not json */
    }
    return 'Erro interno no servidor (500). Verifique se a base de dados está migrada (npm run setup:db).';
  }
  if (status === 403) {
    try {
      const body = JSON.parse(raw) as { message?: string | string[] };
      const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      if (msg?.includes('another department')) {
        return 'Este recurso pertence a outro departamento e não pode ser reservado.';
      }
      if (
        msg?.includes('Insufficient permissions') ||
        msg?.includes('Insufficient role')
      ) {
        return 'Sem permissão para aceder a este recurso.';
      }
      if (msg) return msg;
    } catch {
      /* not json */
    }
    return 'Sem permissão para esta operação.';
  }
  if (status === 409) {
    try {
      const body = JSON.parse(raw) as { message?: string | string[] };
      const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      if (msg?.includes('name already')) {
        return 'Já existe um departamento com este nome.';
      }
      if (msg?.includes('acronym already')) {
        return 'Já existe um departamento com esta sigla.';
      }
      if (msg?.includes('já está reservado') || msg?.includes('already booked')) {
        return msg.includes('já está reservado')
          ? msg
          : 'Este recurso já está reservado neste horário. Escolha outro intervalo ou outro dia.';
      }
      if (msg) return msg;
    } catch {
      /* not json */
    }
    return 'Registo em conflito (409).';
  }
  if (status === 400) {
    try {
      const body = JSON.parse(raw) as { message?: string | string[] };
      const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      if (msg) return msg;
    } catch {
      /* not json */
    }
  }
  if (raw.length > 200) return raw.slice(0, 200) + '…';
  return raw || 'Erro desconhecido';
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const key = circuitKeyFromUrl(url);

  return withCircuit(key, async () => {
    const doFetch = async (retried: boolean): Promise<T> => {
      const token = shouldAttachBearer(url) ? getStoredAccessToken() : null;
      const headers: HeadersInit = {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      };
      let res: Response;
      try {
        res = await fetch(url, { ...init, headers });
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e));
      }
      const text = await res.text();
      if (!res.ok) {
        if (
          res.status === 401 &&
          isProtectedAuthUrl(url) &&
          !retried &&
          (await tryRefreshAccessToken())
        ) {
          return doFetch(true);
        }
        if (res.status === 401 && isProtectedAuthUrl(url)) {
          clearAuthSession();
          window.dispatchEvent(new Event(RESERVEHUB_AUTH_EVENT));
        }
        const err = new Error(text || `${res.status} ${res.statusText}`) as Error & {
          status: number;
        };
        err.status = res.status;
        throw err;
      }
      if (!text) {
        return undefined as T;
      }
      return JSON.parse(text) as T;
    };
    return doFetch(false);
  });
}
