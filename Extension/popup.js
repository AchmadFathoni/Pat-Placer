async function getActiveWplaceTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');
  if (!tab.url || !tab.url.startsWith('https://wplace.live/')) {
    throw new Error('Open https://wplace.live first');
  }
  return tab;
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.color = isError ? '#fca5a5' : '#93c5fd';
}

async function loadTool() {
  const tab = await getActiveWplaceTab();
  const res = await chrome.tabs.sendMessage(tab.id, { type: 'patplacer.load' }).catch(() => null);

  if (res?.ok) {
    setStatus('Tool load requested successfully.');
    return;
  }

  // Fallback: direct background call
  const fallback = await chrome.runtime.sendMessage({ action: 'loadTool' });
  if (fallback?.success) {
    setStatus('Tool loaded (fallback).');
  } else {
    throw new Error(fallback?.error || 'Failed to load tool');
  }
}

async function toggleTool() {
  const tab = await getActiveWplaceTab();
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: () => {
      if (window.PatPlacer && typeof window.PatPlacer.togglePanel === 'function') {
        window.PatPlacer.togglePanel();
        return { ok: true };
      }
      return { ok: false };
    }
  });

  if (result?.[0]?.result?.ok) {
    setStatus('Panel toggled.');
  } else {
    setStatus('Tool not loaded yet. Use Load Tool first.', true);
  }
}

document.getElementById('load-btn').addEventListener('click', async () => {
  try {
    setStatus('Loading...');
    await loadTool();
  } catch (e) {
    setStatus(e.message || String(e), true);
  }
});

document.getElementById('toggle-btn').addEventListener('click', async () => {
  try {
    await toggleTool();
  } catch (e) {
    setStatus(e.message || String(e), true);
  }
});
