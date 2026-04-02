import { ensureFreshToken, REFRESH_ALARM_NAME, refreshAccessToken } from './auth.js';
import { sendExtensionCapture, sendExtensionBulkCapture } from './api.js';
import { buildNotePayload, buildSelectionPayload, buildUrlCapturePayload, withScreenshot } from './capture.js';
import { CONTEXT_MENU_IDS, MESSAGE_TYPES, OFFLINE_QUEUE_KEY, SYNC_ALARM_NAME } from './constants.js';

async function getQueue() {
  const data = await chrome.storage.local.get(OFFLINE_QUEUE_KEY);
  return Array.isArray(data?.[OFFLINE_QUEUE_KEY]) ? data[OFFLINE_QUEUE_KEY] : [];
}

async function setQueue(queue) {
  await chrome.storage.local.set({ [OFFLINE_QUEUE_KEY]: queue });
}

async function enqueue(payload) {
  const queue = await getQueue();
  queue.push({ payload, queuedAt: Date.now() });
  await setQueue(queue);
  return queue.length;
}

async function flushQueue() {
  const queue = await getQueue();
  if (!queue.length) {
    return { flushed: 0, pending: 0 };
  }

  try {
    const items = queue.map((entry) => entry.payload);
    const response = await sendExtensionBulkCapture(items);
    const failedIndexes = new Set((response?.data?.failed || []).map((entry) => entry.index));
    const pending = queue.filter((_, index) => failedIndexes.has(index));
    await setQueue(pending);

    return {
      flushed: queue.length - pending.length,
      pending: pending.length,
      response,
    };
  } catch {
    return { flushed: 0, pending: queue.length };
  }
}

async function createContextMenus() {
  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: CONTEXT_MENU_IDS.SAVE_PAGE,
    title: 'Save page to Linkora',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENU_IDS.SAVE_SELECTION,
    title: 'Save selection to Linkora',
    contexts: ['selection'],
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function getSelectionFromTab(tabId) {
  if (!tabId) return '';

  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_SELECTION' });
    return response?.selectedText || '';
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/contentScript.js'],
      });
      const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_SELECTION' });
      return response?.selectedText || '';
    } catch {
      return '';
    }
  }
}

async function getGraphDataFromTab(tabId) {
  if (!tabId) return null;

  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_GRAPH_2D' });
    return response?.graphData || null;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/contentScript.js'],
      });
      const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_GRAPH_2D' });
      return response?.graphData || null;
    } catch {
      return null;
    }
  }
}

async function captureScreenshot(tab) {
  try {
    return await chrome.tabs.captureVisibleTab(tab?.windowId, { format: 'png' });
  } catch {
    return null;
  }
}

async function sendOrQueue(payload) {
  try {
    const response = await sendExtensionCapture(payload);
    await flushQueue();
    return { queued: false, response };
  } catch {
    const queueSize = await enqueue(payload);
    return { queued: true, queueSize };
  }
}

async function handleCaptureTab() {
  const tab = await getActiveTab();
  const payload = buildUrlCapturePayload(tab);
  return sendOrQueue(payload);
}

async function handleCaptureSelection(providedText = '') {
  const tab = await getActiveTab();
  const selectedText = providedText || (await getSelectionFromTab(tab?.id));
  const payload = buildSelectionPayload(tab, selectedText);
  return sendOrQueue(payload);
}

async function handleCaptureScreenshot() {
  const tab = await getActiveTab();
  const basePayload = buildUrlCapturePayload(tab);
  const screenshotDataUrl = await captureScreenshot(tab);
  const payload = withScreenshot(basePayload, screenshotDataUrl);
  return sendOrQueue(payload);
}

async function handleCaptureGraph2D() {
  const tab = await getActiveTab();
  const graphData = await getGraphDataFromTab(tab?.id);

  if (!graphData?.points?.length) {
    throw new Error('No 2D graph data found on this page');
  }

  const payload = {
    type: 'text',
    title: `${tab?.title || 'Page'} graph snapshot (2D)`,
    content: JSON.stringify(
      {
        graphMode: '2d',
        axes: ['x', 'y'],
        pointCount: graphData.points.length,
        points: graphData.points,
        links: graphData.links || [],
      },
      null,
      2
    ),
    url: tab?.url || null,
    metadata: {
      source: 'extension_graph_2d',
      graphMode: '2d',
      axes: ['x', 'y'],
      pointCount: Number(graphData?.points?.length || 0),
      capturedAt: new Date().toISOString(),
      domain: (() => {
        try {
          return tab?.url ? new URL(tab.url).hostname : null;
        } catch {
          return null;
        }
      })(),
    },
  };

  return sendOrQueue(payload);
}

async function handleSaveNote(noteText) {
  const tab = await getActiveTab();
  const payload = buildNotePayload(noteText, tab);
  return sendOrQueue(payload);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_IDS.SAVE_PAGE) {
    await sendOrQueue(buildUrlCapturePayload(tab));
    return;
  }

  if (info.menuItemId === CONTEXT_MENU_IDS.SAVE_SELECTION) {
    await sendOrQueue(buildSelectionPayload(tab, info.selectionText || ''));
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const action = async () => {
    switch (message?.type) {
      case MESSAGE_TYPES.CAPTURE_TAB:
        return handleCaptureTab();
      case MESSAGE_TYPES.CAPTURE_SELECTION:
        return handleCaptureSelection(message?.selectedText || '');
      case MESSAGE_TYPES.CAPTURE_SCREENSHOT:
        return handleCaptureScreenshot();
      case MESSAGE_TYPES.CAPTURE_PAGE_GRAPH_2D:
        return handleCaptureGraph2D();
      case MESSAGE_TYPES.SAVE_NOTE:
        return handleSaveNote(message?.note || '');
      case MESSAGE_TYPES.FLUSH_QUEUE:
        return flushQueue();
      case MESSAGE_TYPES.GET_QUEUE_STATUS: {
        const queue = await getQueue();
        return { pending: queue.length };
      }
      case 'PING':
        return { pong: true };
      default:
        return { ok: false, message: 'Unknown message type' };
    }
  };

  action()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || 'Action failed' }));

  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  await createContextMenus();
  await chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: 2 });
  try {
    await ensureFreshToken();
  } catch (error) {
    console.warn('Initial token check failed:', error.message);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await createContextMenus();
  await chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: 2 });
  try {
    await ensureFreshToken();
    await flushQueue();
  } catch (error) {
    console.warn('Startup token check failed:', error.message);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm?.name === REFRESH_ALARM_NAME) {
    try {
      await refreshAccessToken();
      console.info('Extension access token refreshed');
    } catch (error) {
      console.warn('Scheduled token refresh failed:', error.message);
    }
    return;
  }

  if (alarm?.name === SYNC_ALARM_NAME) {
    await flushQueue();
  }
});
