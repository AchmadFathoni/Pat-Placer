/**
 * Builds patplacer.user.js Tampermonkey userscript from jsDelivr CDN.
 * Usage: node build-userscript.cjs
 *
 * Override defaults via env vars: OWNER, REPO, BRANCH
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;

// ─── Auto-detect repo info from git ──────────────────────────────────────────
function getGitInfo() {
  try {
    // Use the upstream tracking remote (e.g., AchmadFathoni from refs/remotes/AchmadFathoni/tampermonkey)
    const upstream = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{upstream}', { encoding: 'utf-8' }).trim();
    const remoteName = upstream.replace(/^refs\/remotes\//, '').split('/')[0];
    const remoteUrl = execSync(`git remote get-url ${remoteName}`, { encoding: 'utf-8' }).trim();
    const m = remoteUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(?:\.git)?$/);
    const owner = m ? m[1] : 'AchmadFathoni';
    const repo = m ? m[2] : 'Pat-Placer';
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    return { owner, repo, branch };
  } catch {
    return { owner: 'AchmadFathoni', repo: 'Pat-Placer', branch: 'main' };
  }
}

const OWNER = process.env.OWNER || getGitInfo().owner;
const REPO = process.env.REPO || getGitInfo().repo;
const BRANCH = process.env.BRANCH || getGitInfo().branch;
const BASE_URL = `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${BRANCH}/Extension`;

// ─── Scripts to inject ───────────────────────────────────────────────────────
const SCRIPTS = [
  { file: 'image-processor.js', id: 'patplacer-image-processor-script' },
  { file: 'patplacer-main.js',   id: 'patplacer-main-script' },
  { file: 'art-extractor.js',   id: 'patplacer-extractor-script' },
  { file: 'repair-tool.js',     id: 'patplacer-repair-script' },
];

const injectCalls = SCRIPTS.map(s =>
  `    injectScript(BASE + '/scripts/${s.file}', '${s.id}')`
).join(',\n');

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
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  const BASE = '${BASE_URL}';

  // Set up icon base URL — tool scripts check this at runtime
  window.__PATPLACER_RESOURCES__ = window.__PATPLACER_RESOURCES__ || {};
  window.__PATPLACER_RESOURCES__.iconsBaseUrl = BASE + '/icons/';

  // Inject CSS (manually, to avoid @grant which would trigger Firefox XrayWrapper sandbox)
  (async function() {
    try {
      const resp = await fetch(BASE + '/styles/patplacer.css');
      const css = await resp.text();
      const s = document.createElement('style');
      s.id = 'patplacer-styles';
      s.textContent = css;
      document.head.appendChild(s);
    } catch (e) {
      console.error('[PP] Failed to load styles:', e);
    }
  })();

  // Helper: inject script into page context via Blob URL (CSP-safe on Firefox)
  async function injectScript(url, id) {
    if (document.getElementById(id)) return;
    try {
      const resp = await fetch(url);
      const code = await resp.text();
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const script = document.createElement('script');
      script.id = id;
      script.src = blobUrl;
      return new Promise(resolve => {
        script.onload = () => { URL.revokeObjectURL(blobUrl); resolve(); };
        script.onerror = () => { URL.revokeObjectURL(blobUrl); console.error('[PP] Script load error:', url); resolve(); };
        document.head.appendChild(script);
      });
    } catch (e) {
      console.error('[PP] Failed to load script:', url, e);
    }
  }

  // Inject all tool scripts into page context (async via Blob URLs)
  Promise.all([
${injectCalls}
  ]).then(() => {

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
    console.log('[PP] handleToolClick:', tool.key, 'toggle type:', typeof tool.toggle);
    console.log('[PP] window.PatPlacer:', !!window.PatPlacer, 'window.PatPlacerExtractor:', !!window.PatPlacerExtractor, 'window.PatPlacerRepair:', !!window.PatPlacerRepair);
    if (typeof tool.toggle === 'function') {
      console.log('[PP] calling toggle for', tool.key);
      tool.toggle();
      console.log('[PP] toggle returned for', tool.key);
    }
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

  });
})();
`;

// ─── Write the userscript ──────────────────────────────────────────────────
const outputPath = path.join(ROOT, 'patplacer.user.js');
fs.writeFileSync(outputPath, userScript, 'utf-8');

const kb = (Buffer.byteLength(userScript, 'utf-8') / 1024).toFixed(0);
console.log(`Written patplacer.user.js (${kb} KB)`);
console.log(`Base URL: ${BASE_URL}`);
console.log('Done!');
