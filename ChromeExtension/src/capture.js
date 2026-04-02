function cleanText(input, max = 10000) {
  const text = String(input || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) : text;
}

function getDomain(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function buildUrlCapturePayload(tab, extra = {}) {
  const tabUrl = tab?.url || extra.url || '';
  const tabTitle = tab?.title || extra.title || 'Saved Page';

  return {
    type: 'url',
    title: cleanText(tabTitle, 500) || 'Saved Page',
    url: cleanText(tabUrl, 2048),
    metadata: {
      source: 'extension_tab',
      tabTitle: cleanText(tabTitle, 500),
      tabUrl: cleanText(tabUrl, 2048),
      selectedText: cleanText(extra.selectedText || '', 10000),
      domain: getDomain(tabUrl),
      capturedAt: new Date().toISOString(),
    },
  };
}

export function buildSelectionPayload(tab, selectedText) {
  const payload = buildUrlCapturePayload(tab, { selectedText });
  const text = cleanText(selectedText, 10000);

  return {
    ...payload,
    type: text ? 'text' : 'url',
    title: text ? `${payload.title} (selection)` : payload.title,
    content: text || null,
    metadata: {
      ...payload.metadata,
      source: 'extension_selection',
      selectedText: text,
    },
  };
}

export function buildNotePayload(noteText, tab = null) {
  const text = cleanText(noteText, 10000);
  if (!text) {
    throw new Error('Note cannot be empty');
  }

  return {
    type: 'text',
    title: text.slice(0, 90),
    content: text,
    url: tab?.url || null,
    metadata: {
      source: 'extension_note',
      tabTitle: tab?.title || null,
      tabUrl: tab?.url || null,
      domain: getDomain(tab?.url),
      capturedAt: new Date().toISOString(),
    },
  };
}

export function withScreenshot(payload, screenshotDataUrl) {
  if (!screenshotDataUrl) return payload;

  return {
    ...payload,
    metadata: {
      ...(payload.metadata || {}),
      screenshotDataUrl,
    },
  };
}
