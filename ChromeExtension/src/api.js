import { ensureFreshToken, refreshAccessToken, resolveApiBase } from './auth.js';

async function buildAuthHeaders() {
  const session = await ensureFreshToken();
  if (!session?.accessToken) {
    throw new Error('Please login from extension popup first');
  }

  return {
    session,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
  };
}

async function postWithAutoRefresh(path, payload) {
  const apiBase = await resolveApiBase();
  const { headers } = await buildAuthHeaders();

  const send = (requestHeaders) => fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(payload),
  });

  let response = await send(headers);

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    response = await send({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${refreshed.accessToken}`,
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Capture failed (${response.status}): ${text.slice(0, 180)}`);
  }

  return response.json();
}

export async function sendExtensionCapture(payload) {
  return postWithAutoRefresh('/items/from-extension', payload);
}

export async function sendExtensionBulkCapture(items) {
  return postWithAutoRefresh('/items/bulk-from-extension', { items });
}
