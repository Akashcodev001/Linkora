import { checkTokenValidity, ensureFreshToken, loginWithGitHub, loginWithGoogle, logout, REFRESH_ALARM_NAME, refreshAccessToken } from './auth.js';
import { MESSAGE_TYPES } from './constants.js';
import { getAuthSession } from './storage.js';

const statusText = document.getElementById('statusText');
const providerText = document.getElementById('providerText');
const expiryText = document.getElementById('expiryText');
const issuedAtText = document.getElementById('issuedAtText');
const backendText = document.getElementById('backendText');
const expiresInText = document.getElementById('expiresInText');
const refreshAtText = document.getElementById('refreshAtText');
const updatedAtText = document.getElementById('updatedAtText');
const message = document.getElementById('message');
const queueText = document.getElementById('queueText');
const noteInput = document.getElementById('noteInput');

const googleBtn = document.getElementById('googleBtn');
const githubBtn = document.getElementById('githubBtn');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const capturePageBtn = document.getElementById('capturePageBtn');
const captureSelectionBtn = document.getElementById('captureSelectionBtn');
const captureScreenshotBtn = document.getElementById('captureScreenshotBtn');
const captureGraph2dBtn = document.getElementById('captureGraph2dBtn');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const syncQueueBtn = document.getElementById('syncQueueBtn');

const RECEIVER_MISSING_ERROR = 'Could not establish connection. Receiving end does not exist.';

function formatExpiry(expiresAt) {
  if (!expiresAt) return 'Unknown';
  const ms = Number(expiresAt) - Date.now();
  if (ms <= 0) return 'Expired';
  const mins = Math.max(1, Math.floor(ms / 60000));
  return `in ${mins} min`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatRemaining(expiresAt) {
  if (!expiresAt) return '-';
  const ms = Number(expiresAt) - Date.now();
  if (ms <= 0) return 'expired';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

async function renderDebug(session) {
  const alarm = await chrome.alarms.get(REFRESH_ALARM_NAME);
  backendText.textContent = session?.apiBase || '-';
  issuedAtText.textContent = formatDateTime(session?.issuedAt);
  expiresInText.textContent = formatRemaining(session?.expiresAt);
  refreshAtText.textContent = formatDateTime(alarm?.scheduledTime);
  updatedAtText.textContent = formatDateTime(session?.updatedAt);
}

function setMessage(text = '', type = '') {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function setBusy(isBusy) {
  [
    googleBtn,
    githubBtn,
    refreshBtn,
    logoutBtn,
    capturePageBtn,
    captureSelectionBtn,
    captureScreenshotBtn,
    captureGraph2dBtn,
    saveNoteBtn,
    syncQueueBtn,
  ].forEach((btn) => {
    btn.disabled = isBusy;
  });
}

function isReceiverMissingError(error) {
  return String(error?.message || '').includes(RECEIVER_MISSING_ERROR);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function safeSendMessage(payload, retries = 2) {
  let lastError = null;

  for (let i = 0; i <= retries; i += 1) {
    try {
      const response = await chrome.runtime.sendMessage(payload);
      return response;
    } catch (error) {
      lastError = error;
      if (!isReceiverMissingError(error) || i === retries) {
        throw error;
      }

      await sleep(200 * (i + 1));
    }
  }

  throw lastError || new Error('Message dispatch failed');
}

async function ensureBackgroundReady() {
  try {
    const pong = await safeSendMessage({ type: 'PING' }, 1);
    return Boolean(pong?.ok || pong?.data?.pong || pong?.pong);
  } catch {
    return false;
  }
}

async function runCapture(type, payload = {}) {
  const response = await safeSendMessage({ type, ...payload });
  if (!response?.ok) {
    throw new Error(response?.error || 'Capture failed');
  }

  if (type === MESSAGE_TYPES.FLUSH_QUEUE) {
    const flushed = Number(response?.data?.flushed || 0);
    const pending = Number(response?.data?.pending || 0);
    setMessage(`Queue synced. Flushed ${flushed}, pending ${pending}`, 'success');
    await updateQueueStatus();
    return;
  }

  const isQueued = Boolean(response?.data?.queued);
  if (isQueued) {
    const queueSize = Number(response?.data?.queueSize || 0);
    setMessage(`Saved offline. Pending queue: ${queueSize}`, 'success');
  } else {
    setMessage('Saved to Linkora', 'success');
  }

  await updateQueueStatus();
}

async function updateQueueStatus() {
  let pending = 0;

  try {
    const queueResponse = await safeSendMessage({ type: MESSAGE_TYPES.GET_QUEUE_STATUS });
    pending = Number(queueResponse?.data?.pending || 0);
  } catch {
    pending = 0;
  }

  queueText.textContent = `Offline queue: ${pending}`;
}

async function renderStatus() {
  const session = await getAuthSession();

  if (!session?.accessToken) {
    statusText.textContent = 'Not logged in';
    providerText.textContent = 'Provider: -';
    expiryText.textContent = 'Token expiry: -';
    await renderDebug(null);
    queueText.textContent = 'Offline queue: 0';
    return;
  }

  const validity = await checkTokenValidity();

  statusText.textContent = validity.valid ? 'Logged in' : 'Session invalid';
  providerText.textContent = `Provider: ${String(session.provider || 'unknown')}`;
  expiryText.textContent = `Token expires: ${formatExpiry(session.expiresAt)}`;
  await renderDebug(session);
  await updateQueueStatus();
}

async function withAction(action, successText) {
  setBusy(true);
  setMessage('');

  try {
    await action();
    await renderStatus();
    setMessage(successText, 'success');
  } catch (error) {
    setMessage(error?.message || 'Action failed', 'error');
  } finally {
    setBusy(false);
  }
}

googleBtn.addEventListener('click', () => withAction(loginWithGoogle, 'Google login successful'));
githubBtn.addEventListener('click', () => withAction(loginWithGitHub, 'GitHub login successful'));
refreshBtn.addEventListener('click', () => withAction(refreshAccessToken, 'Token refreshed'));
logoutBtn.addEventListener('click', () => withAction(logout, 'Logged out'));
capturePageBtn.addEventListener('click', () => withAction(() => runCapture(MESSAGE_TYPES.CAPTURE_TAB), 'Page captured'));
captureSelectionBtn.addEventListener('click', () => withAction(() => runCapture(MESSAGE_TYPES.CAPTURE_SELECTION), 'Selection captured'));
captureScreenshotBtn.addEventListener('click', () => withAction(() => runCapture(MESSAGE_TYPES.CAPTURE_SCREENSHOT), 'Screenshot captured'));
captureGraph2dBtn.addEventListener('click', () => withAction(() => runCapture(MESSAGE_TYPES.CAPTURE_PAGE_GRAPH_2D), '2D graph captured'));
saveNoteBtn.addEventListener('click', () => withAction(
  () => runCapture(MESSAGE_TYPES.SAVE_NOTE, { note: noteInput.value }),
  'Note captured'
));
syncQueueBtn.addEventListener('click', () => withAction(() => runCapture(MESSAGE_TYPES.FLUSH_QUEUE), 'Queue sync triggered'));

(async function bootstrap() {
  setBusy(true);

  try {
    const ready = await ensureBackgroundReady();
    if (!ready) {
      setMessage('Extension worker is waking up. Retry in a moment.', 'error');
    }
    await ensureFreshToken();
    await renderStatus();
  } catch (error) {
    if (isReceiverMissingError(error)) {
      setMessage('Extension connection is initializing. Please reopen popup.', 'error');
    } else {
      setMessage(error?.message || 'Failed to initialize auth', 'error');
    }
  } finally {
    setBusy(false);
  }
})();
