if (/(^|\.)wplace\.live$/i.test(window.location.hostname)) {
  let buttonRemoved = false;
  const buttonsByKey = {};

  const tools = [
    {
      id: 'patplacer-btn',
      key: 'patplacer',
      name: 'PatPlacer',
      svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5"><path d="M12 2C11.45 2 11 2.45 11 3V7.05C8.94 7.42 7.08 8.68 6 10.36L8 11.55C8.75 10.38 10.25 9.5 12 9.5C13.75 9.5 15.25 10.38 16 11.55L18 10.36C16.92 8.68 15.06 7.42 13 7.05V3C13 2.45 12.55 2 12 2M12 11C10.34 11 9 12.34 9 14C9 15.66 10.34 17 12 17C13.66 17 15 15.66 15 14C15 12.34 13.66 11 12 11M3 13V15.5C3 18.5 5.5 21 8.5 21H9V19H8.5C6.57 19 5 17.43 5 15.5V13H3M21 13H19V15.5C19 17.43 17.43 19 15.5 19H15V21H15.5C18.5 21 21 18.5 21 15.5V13Z" /></svg>`,
      toggle: () => window.PatPlacer?.togglePanel?.()
    },
    {
      id: 'extractor-btn',
      key: 'extractor',
      name: 'Art Extractor',
      svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5"><path d="M7,17V1H5V5H1V7H5V17A2,2 0 0,0 7,19H17V23H19V19H23V17M17,15V7H9V5H17A2,2 0 0,1 19,7V15Z" /></svg>`,
      toggle: () => window.PatPlacerExtractor?.togglePanel?.()
    },
    {
      id: 'repair-btn',
      key: 'repair',
      name: 'Repair Tool',
      svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5"><path d="M22.7 19L13.6 9.9C14.1 8 13.6 6 12.1 4.6C10.3 2.7 7.5 2.5 5.5 4.1L9.2 7.8L7.8 9.2L4.1 5.5C2.5 7.5 2.7 10.3 4.6 12.1C6 13.6 8 14.1 9.9 13.6L19 22.7C19.4 23.1 20.1 23.1 20.5 22.7L22.7 20.5C23.1 20.1 23.1 19.4 22.7 19M19.7 20.5L13.2 13.9C13.6 13.3 13.9 12.7 14 12L20.5 18.5L19.7 20.5" /></svg>`,
      toggle: () => window.PatPlacerRepair?.togglePanel?.()
    }
  ];

  function findMenuContainer() {
    const selectors = [
      '.absolute.right-2.top-2.z-30 .flex.flex-col.gap-3.items-center',
      '.absolute.right-2.top-2.z-30 .flex.flex-col.items-center',
      '.absolute.right-2.top-2.z-30 .flex.flex-col',
      '[class*="right-2"][class*="top-2"] .flex.flex-col.gap-3.items-center',
      '[class*="right-2"][class*="top-2"] .flex.flex-col'
    ];

    for (const selector of selectors) {
      const found = document.querySelector(selector);
      if (found) return found;
    }

    const existingToolBtn = document.querySelector('.btn.btn-square');
    if (existingToolBtn?.parentElement) {
      return existingToolBtn.parentElement;
    }

    return null;
  }

  function getFloatingFallbackHost() {
    let host = document.getElementById('patplacer-floating-host');
    if (host) return host;

    host = document.createElement('div');
    host.id = 'patplacer-floating-host';
    host.style.position = 'fixed';
    host.style.right = '12px';
    host.style.top = '90px';
    host.style.zIndex = '2147483000';
    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.gap = '8px';
    document.body.appendChild(host);
    return host;
  }

  function setButtonState(tool, state) {
    const button = buttonsByKey[tool.key];
    if (!button) return;

    if (state === 'loading') {
      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5 animate-spin">
          <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
        </svg>
      `;
      button.style.opacity = '0.7';
      button.style.background = '';
      button.title = `${tool.name} - Loading...`;
      button.disabled = true;
      return;
    }

    button.innerHTML = `
      ${tool.svgIcon}
    `;
    button.style.opacity = '1';
    button.style.background = state === 'loaded' ? '#4CAF50' : '';
    button.title = state === 'loaded' ? `${tool.name} - Loaded` : `${tool.name} - Click to load`;
    button.disabled = false;
  }

  async function handleToolClick(tool) {
    if (typeof tool.toggle === 'function') {
      const before = {
        patplacer: !!window.PatPlacer,
        extractor: !!window.PatPlacerExtractor,
        repair: !!window.PatPlacerRepair
      };
      tool.toggle();
      const after = {
        patplacer: !!window.PatPlacer,
        extractor: !!window.PatPlacerExtractor,
        repair: !!window.PatPlacerRepair
      };
      if (before[tool.key] && after[tool.key]) {
        return;
      }
    }

    setButtonState(tool, 'loading');

    chrome.runtime.sendMessage({ action: 'loadTool', tool: tool.key }, (response) => {
      if (response?.success) {
        setButtonState(tool, 'loaded');
      } else {
        console.error(`[PatPlacer] ${tool.name} load failed:`, response?.error);
        setButtonState(tool, 'ready');
      }
    });
  }

  function createToolButtons() {
    if (buttonRemoved) return;

    const menuContainer = findMenuContainer() || getFloatingFallbackHost();

    let wrapper = document.getElementById('patplacer-tools-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'patplacer-tools-wrapper';
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.gap = '8px';
      menuContainer.appendChild(wrapper);
    }

    for (const tool of tools) {
      if (document.getElementById(tool.id)) continue;

      const button = document.createElement('button');
      button.id = tool.id;
      button.className = 'btn btn-square shadow-md';
      button.addEventListener('click', () => handleToolClick(tool));

      buttonsByKey[tool.key] = button;
      setButtonState(tool, 'ready');
      wrapper.appendChild(button);
    }
  }

  const observer = new MutationObserver(() => {
    if (buttonRemoved) return;
    const missingAny = tools.some((tool) => !document.getElementById(tool.id));
    if (missingAny) {
      setTimeout(createToolButtons, 500);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createToolButtons);
  } else {
    createToolButtons();
  }

  setTimeout(createToolButtons, 2000);

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}



