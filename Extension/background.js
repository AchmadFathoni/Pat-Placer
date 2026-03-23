chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== 'loadTool') {
    return false;
  }

  const tabId = sender?.tab?.id;
  if (!tabId) {
    sendResponse({ success: false, error: 'No active tab' });
    return false;
  }

  const tool = typeof message.tool === 'string' ? message.tool : 'patplacer';

  (async () => {
    try {
      async function loadExtensionText(relativePath) {
        const url = chrome.runtime.getURL(relativePath);
        const resp = await fetch(`${url}?v=${Date.now()}`);
        if (!resp.ok) {
          throw new Error(`Failed to load ${relativePath}: ${resp.status}`);
        }
        return await resp.text();
      }

      const cssText = await loadExtensionText('styles/patplacer.css');
      const iconsBaseUrl = chrome.runtime.getURL('icons/');

      const toolMap = {
        patplacer: [
          { id: 'patplacer-image-processor-script', path: 'scripts/image-processor.js' },
          { id: 'patplacer-main-script', path: 'scripts/patplacer-main.js' }
        ],
        extractor: [
          { id: 'patplacer-extractor-script', path: 'scripts/art-extractor.js' }
        ],
        repair: [
          { id: 'patplacer-repair-script', path: 'scripts/repair-tool.js' }
        ]
      };

      const scripts = toolMap[tool] || toolMap.patplacer;
      const scriptsWithCode = [];
      for (const script of scripts) {
        scriptsWithCode.push({
          id: script.id,
          code: await loadExtensionText(script.path)
        });
      }

      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        args: [{ cssText, iconsBaseUrl, scriptsWithCode, tool }],
        func: async (assets) => {
          function injectCss(css) {
            const existing = document.getElementById('patplacer-styles-inline');
            if (existing) existing.remove();

            const style = document.createElement('style');
            style.id = 'patplacer-styles-inline';
            style.textContent = css;
            document.head.appendChild(style);
          }

          function loadScriptBlob(code, id) {
            return new Promise((resolve, reject) => {
              if (document.getElementById(id)) {
                resolve();
                return;
              }

              const blob = new Blob([code], { type: 'application/javascript' });
              const blobUrl = URL.createObjectURL(blob);

              const script = document.createElement('script');
              script.id = id;
              script.src = blobUrl;
              script.onload = () => {
                URL.revokeObjectURL(blobUrl);
                resolve();
              };
              script.onerror = () => {
                URL.revokeObjectURL(blobUrl);
                reject(new Error(`Failed loading ${id}`));
              };

              document.head.appendChild(script);
            });
          }

          window.__PATPLACER_RESOURCES__ = window.__PATPLACER_RESOURCES__ || {};
          window.__PATPLACER_RESOURCES__.iconsBaseUrl = assets.iconsBaseUrl || 'icons/';

          if (assets.tool === 'patplacer' && window.PatPlacer?.togglePanel) {
            window.PatPlacer.togglePanel();
            return;
          }
          if (assets.tool === 'extractor' && window.PatPlacerExtractor?.togglePanel) {
            window.PatPlacerExtractor.togglePanel();
            return;
          }
          if (assets.tool === 'repair' && window.PatPlacerRepair?.togglePanel) {
            window.PatPlacerRepair.togglePanel();
            return;
          }

          injectCss(assets.cssText || '');

          for (const item of assets.scriptsWithCode || []) {
            await loadScriptBlob(item.code, item.id);
          }
        }
      });

      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err?.message || String(err) });
    }
  })();

  return true;
});
