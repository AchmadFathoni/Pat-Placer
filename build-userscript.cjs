/**
 * Builds patplacer.user.js Tampermonkey userscript from Chrome Extension source.
 * Usage: node build-userscript.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const EXT = path.join(ROOT, 'Extension');
const ICONS_DIR = path.join(EXT, 'icons');
const SCRIPTS_DIR = path.join(EXT, 'scripts');
const STYLES_DIR = path.join(EXT, 'styles');

// ─── Read and base64-encode icons ──────────────────────────────────────────
const icons = {};
const iconFiles = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.png'));
iconFiles.forEach(f => {
  const data = fs.readFileSync(path.join(ICONS_DIR, f));
  icons[f] = `data:image/png;base64,${data.toString('base64')}`;
});
console.log(`Encoded ${iconFiles.length} icons`);

// ─── Read source files ─────────────────────────────────────────────────────
const cssContent = fs.readFileSync(path.join(STYLES_DIR, 'patplacer.css'), 'utf-8');
const imageProcessorCode = fs.readFileSync(path.join(SCRIPTS_DIR, 'image-processor.js'), 'utf-8');
const patPlacerMainCode = fs.readFileSync(path.join(SCRIPTS_DIR, 'patplacer-main.js'), 'utf-8');
const artExtractorCode = fs.readFileSync(path.join(SCRIPTS_DIR, 'art-extractor.js'), 'utf-8');
const repairToolCode = fs.readFileSync(path.join(SCRIPTS_DIR, 'repair-tool.js'), 'utf-8');

// ─── Transform JS: Replace icon references ─────────────────────────────────
// Replaces ${iconBase}name.png → ${__PP_ICON('name.png')}
// Neutralizes const ICON_BASE / iconBase declarations
function transformIconRefs(code) {
  // Neutralize iconBase/ICON_BASE variable declarations
  code = code.replace(
    /const\s+ICON_BASE\s*=\s*\([^)]*\)\s*\?\s*[^:]*\s*:\s*'[^']*';/g,
    'const ICON_BASE = "";'
  );
  code = code.replace(
    /const\s+iconBase\s*=\s*\([^)]*\)\s*\?\s*[^:]*\s*:\s*'[^']*';/g,
    'const iconBase = "";'
  );

  // Neutralize ICON_BASE in CONFIG objects
  code = code.replace(
    /ICON_BASE:\s*\(window\.__PATPLACER_RESOURCES__\s*&&\s*window\.__PATPLACER_RESOURCES__\.iconsBaseUrl\)\s*\?\s*window\.__PATPLACER_RESOURCES__\.iconsBaseUrl\s*:\s*'icons\/'/g,
    'ICON_BASE: ""'
  );

  // Replace ${iconBase}name.png → ${__PP_ICON('name.png')}
  code = code.replace(/\$\{iconBase\}([\w-]+)\.png/g, '${__PP_ICON(\'$1.png\')}');
  code = code.replace(/\$\{ICON_BASE\}([\w-]+)\.png/g, '${__PP_ICON(\'$1.png\')}');
  code = code.replace(/\$\{CONFIG\.ICON_BASE\}([\w-]+)\.png/g, '${__PP_ICON(\'$1.png\')}');

  // Replace iconBase + 'name.png' pattern (string concat)
  code = code.replace(/iconBase\s*\+\s*'([\w-]+)\.png'/g, '__PP_ICON(\'$1.png\')');
  code = code.replace(/ICON_BASE\s*\+\s*'([\w-]+)\.png'/g, '__PP_ICON(\'$1.png\')');
  code = code.replace(/CONFIG\.ICON_BASE\s*\+\s*'([\w-]+)\.png'/g, '__PP_ICON(\'$1.png\')');

  return code;
}

const processedPatplacerMain = transformIconRefs(patPlacerMainCode);
const processedArtExtractor = transformIconRefs(artExtractorCode);
const processedRepairTool = transformIconRefs(repairToolCode);
// image-processor.js doesn't use icons

// ─── Escape code for embedding as JavaScript string literal ─────────────────
function jsStringEscape(code) {
  return code
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

// ─── Generate @resource lines + resource key map ──────────────────────────
let resourceLines = '';
let resourceKeyMap = '';
for (const name of iconFiles) {
  const key = 'ICON_' + name.replace(/[.-]/g, '_').toUpperCase();
  const data = fs.readFileSync(path.join(ICONS_DIR, name));
  resourceLines += `// @resource     ${key} data:image/png;base64,${data.toString('base64')}\n`;
  resourceKeyMap += `  '${name}': '${key}',\n`;
}

// ─── Generate icon resolution runtime code ─────────────────────────────────
const iconResolutionCode = `
  // Resolve icon URLs via GM_getResourceURL and inject into page context
  const ICON_RESOURCE_MAP = {
${resourceKeyMap}  };
  const resolvedIconUrls = {};
  for (const [name, key] of Object.entries(ICON_RESOURCE_MAP)) {
    resolvedIconUrls[name] = GM_getResourceURL(key);
  }

  const iconInjectScript = document.createElement('script');
  iconInjectScript.id = 'patplacer-icons-inject';
  iconInjectScript.textContent = 'window.__PATPLACER_ICONS__ = ' + JSON.stringify(resolvedIconUrls) + ';' +
    'window.__PP_ICON = function(name) { return window.__PATPLACER_ICONS__ && window.__PATPLACER_ICONS__[name] || ""; };' +
    'window.__PATPLACER_RESOURCES__ = window.__PATPLACER_RESOURCES__ || {};' +
    'window.__PATPLACER_RESOURCES__.iconsBaseUrl = "";' +
    'console.log("[PatPlacer] Icons ready: " + Object.keys(window.__PATPLACER_ICONS__).length);';
  document.head.appendChild(iconInjectScript);
`;

// ─── Assemble the userscript ───────────────────────────────────────────────
const userScript = `// ==UserScript==
// @name         PatPlacer
// @namespace    com.patplacer
// @version      1.0.0
// @description  Precision pixel art placement tool for wplace.live — includes PatPlacer, Art Extractor, and Repair Tool
// @author       PatPlacer Team
// @match        https://wplace.live/*
// @match        https://*.wplace.live/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wplace.live
// @grant        GM_getResourceURL
// @grant        GM_addStyle
${resourceLines}// ==/UserScript==

(function() {
  'use strict';
${iconResolutionCode}
  // Inject CSS
  GM_addStyle('${jsStringEscape(cssContent)}');

  // Helper: inject script code into page context
  function injectScript(code, id) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.textContent = code;
    document.head.appendChild(script);
  }

  // Inject all tool scripts into page context
  injectScript('${jsStringEscape(imageProcessorCode)}', 'patplacer-image-processor-script');
  injectScript('${jsStringEscape(processedPatplacerMain)}', 'patplacer-main-script');
  injectScript('${jsStringEscape(processedArtExtractor)}', 'patplacer-extractor-script');
  injectScript('${jsStringEscape(processedRepairTool)}', 'patplacer-repair-script');

  // ─── Button injection (from content.js) ────────────────────────────────
  if (!/(^|\\.)wplace\\.live\$/i.test(window.location.hostname)) return;

  const buttonsByKey = {};

  const tools = [
    {
      id: 'patplacer-btn', key: 'patplacer', name: 'PatPlacer',
      svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5"><path d="M12 2C11.45 2 11 2.45 11 3V7.05C8.94 7.42 7.08 8.68 6 10.36L8 11.55C8.75 10.38 10.25 9.5 12 9.5C13.75 9.5 15.25 10.38 16 11.55L18 10.36C16.92 8.68 15.06 7.42 13 7.05V3C13 2.45 12.55 2 12 2M12 11C10.34 11 9 12.34 9 14C9 15.66 10.34 17 12 17C13.66 17 15 15.66 15 14C15 12.34 13.66 11 12 11M3 13V15.5C3 18.5 5.5 21 8.5 21H9V19H8.5C6.57 19 5 17.43 5 15.5V13H3M21 13H19V15.5C19 17.43 17.43 19 15.5 19H15V21H15.5C18.5 21 21 18.5 21 15.5V13Z"/></svg>',
      toggle: () => { if (window.PatPlacer && typeof window.PatPlacer.togglePanel === 'function') window.PatPlacer.togglePanel(); }
    },
    {
      id: 'extractor-btn', key: 'extractor', name: 'Art Extractor',
      svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5"><path d="M7 17V1H5v4H1v2h4v10a2 2 0 002 2h10v4h2v-4h4v-2M17 15V7H9V5h8a2 2 0 012 2v8z"/></svg>',
      toggle: () => { if (window.PatPlacerExtractor && typeof window.PatPlacerExtractor.togglePanel === 'function') window.PatPlacerExtractor.togglePanel(); }
    },
    {
      id: 'repair-btn', key: 'repair', name: 'Repair Tool',
      svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5"><path d="M22.7 19L13.6 9.9C14.1 8 13.6 6 12.1 4.6 10.3 2.7 7.5 2.5 5.5 4.1l3.7 3.7-1.4 1.4L4.1 5.5C2.5 7.5 2.7 10.3 4.6 12.1 6 13.6 8 14.1 9.9 13.6L19 22.7c.4.4 1.1.4 1.5 0l2.2-2.2c.4-.4.4-1.1 0-1.5M19.7 20.5l-6.5-6.6c.4-.6.7-1.2.8-1.9l6.5 6.5-.8.8z"/></svg>',
      toggle: () => { if (window.PatPlacerRepair && typeof window.PatPlacerRepair.togglePanel === 'function') window.PatPlacerRepair.togglePanel(); }
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
    for (const sel of selectors) { const f = document.querySelector(sel); if (f) return f; }
    const btn = document.querySelector('.btn.btn-square');
    return btn && btn.parentElement ? btn.parentElement : null;
  }

  function getFloatingFallbackHost() {
    let h = document.getElementById('patplacer-floating-host');
    if (h) return h;
    h = document.createElement('div');
    h.id = 'patplacer-floating-host';
    Object.assign(h.style, {position:'fixed',right:'12px',top:'90px',zIndex:'2147483000',display:'flex',flexDirection:'column',gap:'8px'});
    document.body.appendChild(h);
    return h;
  }

  function setButtonState(tool, state) {
    const btn = buttonsByKey[tool.key];
    if (!btn) return;
    if (state === 'loading') {
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5 animate-spin"><path d="M12 4V2A10 10 0 002 12h2a8 8 0 018-8z"/></svg>';
      btn.style.opacity = '0.7'; btn.style.background = ''; btn.title = tool.name + ' - Loading...'; btn.disabled = true; return;
    }
    btn.innerHTML = tool.svgIcon;
    btn.style.opacity = '1'; btn.style.background = state === 'loaded' ? '#4CAF50' : '';
    btn.title = state === 'loaded' ? tool.name + ' - Loaded' : tool.name;
    btn.disabled = false;
  }

  function handleToolClick(tool) {
    const before = {
      patplacer: !!(window.PatPlacer && window.PatPlacer.togglePanel),
      extractor: !!(window.PatPlacerExtractor && window.PatPlacerExtractor.togglePanel),
      repair: !!(window.PatPlacerRepair && window.PatPlacerRepair.togglePanel)
    };
    if (typeof tool.toggle === 'function') tool.toggle();
    setTimeout(() => {
      const after = {
        patplacer: !!(window.PatPlacer && window.PatPlacer.togglePanel),
        extractor: !!(window.PatPlacerExtractor && window.PatPlacerExtractor.togglePanel),
        repair: !!(window.PatPlacerRepair && window.PatPlacerRepair.togglePanel)
      };
      if (!before[tool.key] && after[tool.key]) setButtonState(tool, 'loaded');
      else if (before[tool.key] && after[tool.key]) setButtonState(tool, 'loaded');
    }, 300);
  }

  function createToolButtons() {
    const menu = findMenuContainer() || getFloatingFallbackHost();
    let wrapper = document.getElementById('patplacer-tools-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'patplacer-tools-wrapper';
      Object.assign(wrapper.style, {display:'flex',flexDirection:'column',gap:'8px'});
      menu.appendChild(wrapper);
    }
    for (const tool of tools) {
      if (document.getElementById(tool.id)) continue;
      const btn = document.createElement('button');
      btn.id = tool.id;
      btn.className = 'btn btn-square shadow-md';
      btn.addEventListener('click', () => handleToolClick(tool));
      buttonsByKey[tool.key] = btn;
      setButtonState(tool, 'loaded');
      wrapper.appendChild(btn);
    }
  }

  const observer = new MutationObserver(() => {
    if (tools.some(t => !document.getElementById(t.id))) setTimeout(createToolButtons, 500);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createToolButtons);
  else createToolButtons();
  setTimeout(createToolButtons, 2000);
  observer.observe(document.body, { childList: true, subtree: true });

})();
`;

// ─── Write the userscript ──────────────────────────────────────────────────
const outputPath = path.join(ROOT, 'patplacer.user.js');
fs.writeFileSync(outputPath, userScript, 'utf-8');

const kb = (Buffer.byteLength(userScript, 'utf-8') / 1024).toFixed(0);
console.log('Written patplacer.user.js (' + kb + ' KB)');
console.log('Done!');
