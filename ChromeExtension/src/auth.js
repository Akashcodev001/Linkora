import { clearAuthSession, getAuthSession, setAuthSession, shouldRefreshSoon } from './storage.js';

const API_BASE_CANDIDATES = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:5000',
  'http://localhost:8000',
];
const REFRESH_ALARM_NAME = 'linkora-token-refresh';
const API_BASE_STORAGE_KEY = 'linkora_api_base';
let cachedApiBase = null;

function normalizeOrigin(value) {
  if (!value) return null;

  try {
    const parsed = new URL(String(value));
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function getOriginsFromHostPermissions() {
  const hosts = chrome.runtime.getManifest()?.host_permissions || [];
  return hosts
    .map((host) => {
      if (!host.startsWith('http://') && !host.startsWith('https://')) {
        return null;
      }

      return host.replace(/\/\*$/, '');
    })
    .map(normalizeOrigin)
    .filter(Boolean);
}

async function withTimeout(promise, timeoutMs = 3000) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
  });

  return Promise.race([promise, timeout]);
}

async function isBackendReachable(origin) {
  const healthUrl = `${origin}/health`;

  try {
    await withTimeout(fetch(healthUrl, { method: 'GET' }), 3000);
    return true;
  } catch {
    return false;
  }
}

async function getStoredApiBase() {
  const data = await chrome.storage.local.get(API_BASE_STORAGE_KEY);
  return data?.[API_BASE_STORAGE_KEY] || null;
}

async function setStoredApiBase(apiBase) {
  await chrome.storage.local.set({
    [API_BASE_STORAGE_KEY]: apiBase,
  });
}

async function resolveApiBase() {
  if (cachedApiBase) return cachedApiBase;

  const stored = normalizeOrigin(await getStoredApiBase());
  const manifestOrigins = getOriginsFromHostPermissions();
  const candidates = Array.from(new Set([stored, ...API_BASE_CANDIDATES, ...manifestOrigins].filter(Boolean)));

  for (const origin of candidates) {
    const reachable = await isBackendReachable(origin);
    if (!reachable) continue;

    cachedApiBase = `${origin}/api`;
    await setStoredApiBase(origin);
    return cachedApiBase;
  }

  throw new Error('Linkora backend is not reachable. Start backend server and verify localhost port.');
}

async function toUrl(path) {
  const apiBase = await resolveApiBase();
  return `${apiBase}${path}`;
}

function parseTokensFromCallback(redirectUrl) {
  const url = new URL(redirectUrl);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const query = url.searchParams;

  const accessToken = hash.get('accessToken') || query.get('accessToken');
  const refreshToken = hash.get('refreshToken') || query.get('refreshToken');
  const expiresIn = Number(hash.get('expiresIn') || query.get('expiresIn') || 900);

  if (!accessToken || !refreshToken) return null;

  return {
    accessToken,
    refreshToken,
    issuedAt: Date.now(),
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

async function launchProviderOAuth(provider) {
  const redirectUri = chrome.identity.getRedirectURL('oauth2');
  const apiBase = await resolveApiBase();
  const authUrl = `${apiBase}/auth/${provider}?client=extension&redirect_uri=${encodeURIComponent(redirectUri)}`;

  let callbackUrl;

  try {
    callbackUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });
  } catch (error) {
    throw new Error(`Authorization page could not be loaded. ${error?.message || 'Verify backend is running and OAuth callback URLs are configured.'}`);
  }

  const tokens = parseTokensFromCallback(callbackUrl);
  if (!tokens) {
    throw new Error('OAuth callback did not include tokens. Backend must return accessToken/refreshToken to extension redirect URI.');
  }

  await setAuthSession({
    provider,
    apiBase,
    ...tokens,
  });

  await scheduleTokenRefresh(tokens.expiresAt);
  return tokens;
}

export async function loginWithGoogle() {
  return launchProviderOAuth('google');
}

export async function loginWithGitHub() {
  return launchProviderOAuth('github');
}

export async function refreshAccessToken() {
  const session = await getAuthSession();
  if (!session?.refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(await toUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  if (!response.ok) {
    await clearAuthSession();
    throw new Error(`Refresh failed (${response.status})`);
  }

  const payload = await response.json();
  const accessToken = payload?.data?.accessToken || payload?.accessToken;
  if (!accessToken) {
    throw new Error('Refresh response missing access token');
  }

  const nextSession = {
    ...session,
    accessToken,
    apiBase: session?.apiBase || (await resolveApiBase()),
    issuedAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  };

  await setAuthSession(nextSession);
  await scheduleTokenRefresh(nextSession.expiresAt);
  return nextSession;
}

export async function logout() {
  const session = await getAuthSession();

  try {
    if (session?.refreshToken && session?.accessToken) {
      await fetch(await toUrl('/auth/logout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    }
  } catch {
    // Best-effort backend logout; local session must still be cleared.
  }

  await chrome.alarms.clear(REFRESH_ALARM_NAME);
  await clearAuthSession();
}

export async function ensureFreshToken() {
  const session = await getAuthSession();
  if (!session) return null;

  if (shouldRefreshSoon(session.expiresAt)) {
    return refreshAccessToken();
  }

  return session;
}

export async function checkTokenValidity() {
  const session = await ensureFreshToken();
  if (!session?.accessToken) {
    return { valid: false, reason: 'missing_session' };
  }

  const response = await fetch(await toUrl('/auth/token-check'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
    credentials: 'include',
  });

  if (response.ok) {
    return { valid: true };
  }

  if (response.status === 401) {
    await clearAuthSession();
  }

  return {
    valid: false,
    reason: `status_${response.status}`,
  };
}

export async function scheduleTokenRefresh(expiresAt) {
  const refreshAtMs = Math.max(Date.now() + 30 * 1000, Number(expiresAt) - 2 * 60 * 1000);
  const when = Math.ceil(refreshAtMs / 1000);

  await chrome.alarms.clear(REFRESH_ALARM_NAME);
  await chrome.alarms.create(REFRESH_ALARM_NAME, { when: when * 1000 });
}

export { REFRESH_ALARM_NAME };
export { resolveApiBase };
