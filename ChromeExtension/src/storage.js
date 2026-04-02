const AUTH_STORAGE_KEY = 'linkora_auth_session';

export async function getAuthSession() {
  const data = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  return data?.[AUTH_STORAGE_KEY] || null;
}

export async function setAuthSession(session) {
  await chrome.storage.local.set({
    [AUTH_STORAGE_KEY]: {
      ...session,
      updatedAt: Date.now(),
    },
  });
}

export async function clearAuthSession() {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
}

export function shouldRefreshSoon(expiresAt, thresholdMs = 2 * 60 * 1000) {
  if (!expiresAt) return false;
  return Date.now() >= Number(expiresAt) - thresholdMs;
}
