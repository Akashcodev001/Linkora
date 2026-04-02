chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_SELECTION') {
    const selectedText = String(window.getSelection ? window.getSelection().toString() : '').trim();
    sendResponse({
      selectedText,
      pageTitle: document.title || '',
      pageUrl: location.href,
    });

    return true;
  }

  if (message?.type === 'GET_PAGE_GRAPH_2D') {
    const script = document.getElementById('linkora-graph-export');
    if (!script?.textContent) {
      sendResponse({ graphData: null });
      return true;
    }

    try {
      const graphData = JSON.parse(script.textContent);
      sendResponse({ graphData });
    } catch {
      sendResponse({ graphData: null });
    }

    return true;
  }

  return undefined;
});
