/* PatPlacer Repair Tool (standalone)
   Testing copy.
   - Loads a PatPlacer v2 project (save or extractor-repair)
   - Scans live tiles vs expected pixels
   - Creates fix drafts by writing into Wplace draft Map

   Requirements:
   - No anchor capture UI: uses anchor from file
   - Requires ONE manual draft placement to sync/capture the draft Map
*/

(() => {
  if (window.PatPlacerRepair && typeof window.PatPlacerRepair.togglePanel === 'function') {
    window.PatPlacerRepair.togglePanel();
    return;
  }

  if (window.PatPlacerRepair && window.PatPlacerRepair.loading) {
    return;
  }

  window.PatPlacerRepair = { loading: true };

  const CONFIG = {
    TILE_SIZE: 1000,
    CACHE_MAX_TILES: 250,
    TILE_FETCH_CONCURRENCY: 6,
    YIELD_EVERY: 2500,

    // AutoBot-style alpha threshold for "transparent/missing" detection
    TRANSPARENCY_THRESHOLD: 128,

    // Wplace palette (id -> rgb). Populated via extraction/fallback.
    COLOR_PALETTE: [],

    // User's available colors (what they can actually use)
    USER_AVAILABLE_COLORS: new Set()
  };

  // Full color map with names for reference
  const WPLACE_COLOR_MAP = [
    { id: 1, name: 'Black', r: 0, g: 0, b: 0 },
    { id: 2, name: 'Dark Gray', r: 60, g: 60, b: 60 },
    { id: 3, name: 'Gray', r: 120, g: 120, b: 120 },
    { id: 4, name: 'Light Gray', r: 210, g: 210, b: 210 },
    { id: 5, name: 'White', r: 255, g: 255, b: 255 },
    { id: 6, name: 'Deep Red', r: 96, g: 0, b: 24 },
    { id: 7, name: 'Red', r: 237, g: 28, b: 36 },
    { id: 8, name: 'Orange', r: 255, g: 127, b: 39 },
    { id: 9, name: 'Gold', r: 246, g: 170, b: 9 },
    { id: 10, name: 'Yellow', r: 249, g: 221, b: 59 },
    { id: 11, name: 'Light Yellow', r: 255, g: 250, b: 188 },
    { id: 12, name: 'Dark Green', r: 14, g: 185, b: 104 },
    { id: 13, name: 'Green', r: 19, g: 230, b: 123 },
    { id: 14, name: 'Light Green', r: 135, g: 255, b: 94 },
    { id: 15, name: 'Dark Teal', r: 12, g: 129, b: 110 },
    { id: 16, name: 'Teal', r: 16, g: 174, b: 166 },
    { id: 17, name: 'Light Teal', r: 19, g: 225, b: 190 },
    { id: 18, name: 'Dark Blue', r: 40, g: 80, b: 158 },
    { id: 19, name: 'Blue', r: 64, g: 147, b: 228 },
    { id: 20, name: 'Cyan', r: 96, g: 247, b: 242 },
    { id: 21, name: 'Indigo', r: 107, g: 80, b: 246 },
    { id: 22, name: 'Light Indigo', r: 153, g: 177, b: 251 },
    { id: 23, name: 'Dark Purple', r: 120, g: 12, b: 153 },
    { id: 24, name: 'Purple', r: 170, g: 56, b: 185 },
    { id: 25, name: 'Light Purple', r: 224, g: 159, b: 249 },
    { id: 26, name: 'Dark Pink', r: 203, g: 0, b: 122 },
    { id: 27, name: 'Pink', r: 236, g: 31, b: 128 },
    { id: 28, name: 'Light Pink', r: 243, g: 141, b: 169 },
    { id: 29, name: 'Dark Brown', r: 104, g: 70, b: 52 },
    { id: 30, name: 'Brown', r: 149, g: 104, b: 42 },
    { id: 31, name: 'Beige', r: 248, g: 178, b: 119 },
    { id: 32, name: 'Medium Gray', r: 170, g: 170, b: 170 },
    { id: 33, name: 'Dark Red', r: 165, g: 14, b: 30 },
    { id: 34, name: 'Light Red', r: 250, g: 128, b: 114 },
    { id: 35, name: 'Dark Orange', r: 228, g: 92, b: 26 },
    { id: 36, name: 'Light Tan', r: 214, g: 181, b: 148 },
    { id: 37, name: 'Dark Goldenrod', r: 156, g: 132, b: 49 },
    { id: 38, name: 'Goldenrod', r: 197, g: 173, b: 49 },
    { id: 39, name: 'Light Goldenrod', r: 232, g: 212, b: 95 },
    { id: 40, name: 'Dark Olive', r: 74, g: 107, b: 58 },
    { id: 41, name: 'Olive', r: 90, g: 148, b: 74 },
    { id: 42, name: 'Light Olive', r: 132, g: 197, b: 115 },
    { id: 43, name: 'Dark Cyan', r: 15, g: 121, b: 159 },
    { id: 44, name: 'Light Cyan', r: 187, g: 250, b: 242 },
    { id: 45, name: 'Light Blue', r: 125, g: 199, b: 255 },
    { id: 46, name: 'Dark Indigo', r: 77, g: 49, b: 184 },
    { id: 47, name: 'Dark Slate Blue', r: 74, g: 66, b: 132 },
    { id: 48, name: 'Slate Blue', r: 122, g: 113, b: 196 },
    { id: 49, name: 'Light Slate Blue', r: 181, g: 174, b: 241 },
    { id: 50, name: 'Light Brown', r: 219, g: 164, b: 99 },
    { id: 51, name: 'Dark Beige', r: 209, g: 128, b: 81 },
    { id: 52, name: 'Light Beige', r: 255, g: 197, b: 165 },
    { id: 53, name: 'Dark Peach', r: 155, g: 82, b: 73 },
    { id: 54, name: 'Peach', r: 209, g: 128, b: 120 },
    { id: 55, name: 'Light Peach', r: 250, g: 182, b: 164 },
    { id: 56, name: 'Dark Tan', r: 123, g: 99, b: 82 },
    { id: 57, name: 'Tan', r: 156, g: 132, b: 107 },
    { id: 58, name: 'Dark Slate', r: 51, g: 57, b: 65 },
    { id: 59, name: 'Slate', r: 109, g: 117, b: 141 },
    { id: 60, name: 'Light Slate', r: 179, g: 185, b: 209 },
    { id: 61, name: 'Dark Stone', r: 109, g: 100, b: 63 },
    { id: 62, name: 'Stone', r: 148, g: 140, b: 107 },
    { id: 63, name: 'Light Stone', r: 205, g: 197, b: 158 }
  ];

  const state = {
    project: null,
    pixels: [],
    palette: [],
    anchorTile: null,
    anchorPixel: null,

    tileCache: new Map(), // key: `${x},${y}` -> ImageData
    tileCacheOrder: [],
    tileUrlTemplate: null, // {prefix, suffix} => `${prefix}${x}/${y}.png${suffix}`

    draftMap: null,
    draftMapHooked: false,
    originalMapSet: null,
    hookTimeout: null,
    hookCountdown: 0,

    colorsReady: false,
    paletteSource: null, // 'live' | 'fallback' | null
    colorPickerObserver: null,

    // Track fix drafts so we can count progress by "sent" (draft keys disappearing after confirm/send)
    fixKeys: new Set(),
    fixKeysTotal: 0,
    sentWatchTimer: null,

    // Track unfixable pixels (missing colors)
    unfixableColors: new Map(), // colorIdx -> count

    lastScan: null,
    fixesDrafted: 0,
    ui: {
      panel: null,
      status: null,
      fileInfo: null,
      scanInfo: null,
      syncInfo: null,
      fixedInfo: null,
      paletteInfo: null,
      unfixableInfo: null,
      btnScan: null,
      btnPlaceFixes: null,
      btnSync: null,
      progress: null
    }
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function stopSentWatcher() {
    if (state.sentWatchTimer) {
      clearInterval(state.sentWatchTimer);
      state.sentWatchTimer = null;
    }
  }

  function startSentWatcher() {
    stopSentWatcher();
    if (!state.draftMap) return;
    if (!state.fixKeys || state.fixKeys.size === 0) return;

    const total = state.fixKeysTotal || state.fixKeys.size;
    state.sentWatchTimer = setInterval(() => {
      try {
        if (!state.draftMap) return;
        let remaining = 0;
        for (const key of state.fixKeys) {
          if (state.draftMap.has(key)) remaining++;
        }
        const sent = Math.max(0, total - remaining);
        if (state.ui.fixedInfo) {
          state.ui.fixedInfo.textContent = `Fixed: ${sent}/${total}`;
        }
        if (sent >= total) {
          stopSentWatcher();
          setProgress('All fix drafts sent!');
        }
      } catch {
        // ignore
      }
    }, 1000);
  }

  function setStatus(text) {
    if (state.ui.status) state.ui.status.textContent = String(text || '');
  }

  function setProgress(text) {
    if (state.ui.progress) state.ui.progress.textContent = String(text || '');
  }

  // ------------------------------------------------------------
  // COLOR / PALETTE
  // ------------------------------------------------------------
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => (x | 0).toString(16).padStart(2, '0')).join('');
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  function getColorName(colorIdx) {
    const c = WPLACE_COLOR_MAP.find(x => x.id === colorIdx);
    return c ? c.name : `Color #${colorIdx}`;
  }

  function findWplacePalette() {
    try {
      const candidates = ['palette', 'colors', 'colorPalette', 'COLORS', 'PALETTE'];
      for (const name of candidates) {
        if (window[name] && Array.isArray(window[name]) && window[name].length >= 16) {
          console.log(`[PatPlacer Repair] Found palette in window.${name}`);
          return window[name];
        }
      }

      // Try to find it in Svelte stores or state
      for (const key of Object.keys(window)) {
        if (key.includes('svelte') || key.includes('store')) {
          const val = window[key];
          if (val && typeof val === 'object') {
            for (const prop of Object.keys(val)) {
              const arr = val[prop];
              if (Array.isArray(arr) && arr.length >= 16 && arr.length <= 64) {
                if (typeof arr[0] === 'string' && arr[0].startsWith('#')) {
                  console.log(`[PatPlacer Repair] Found palette in ${key}.${prop}`);
                  return arr;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[PatPlacer Repair] Error searching for palette:', e);
    }
    return null;
  }

  function extractColorPaletteFromDOM() {
    const colors = [];
    const availableIds = new Set();

    try {
      // Try multiple selectors for Wplace's color picker
      const selectors = [
        '.tooltip button[id^="color-"]',  // Wplace tooltip colors
        '[class*="color"] button',
        '[class*="palette"] button',
        '[class*="picker"] button',
        'button[style*="background"]'
      ];

      for (const selector of selectors) {
        const buttons = document.querySelectorAll(selector);
        if (buttons.length >= 8) {
          console.log(`[PatPlacer Repair] Found ${buttons.length} color buttons with selector: ${selector}`);
          buttons.forEach((btn) => {
            const style = window.getComputedStyle(btn);
            const bgColor = style.backgroundColor;
            if (!bgColor || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') return;
            const rgb = bgColor.match(/\d+/g);
            if (!rgb || rgb.length < 3) return;
            const r = parseInt(rgb[0], 10);
            const g = parseInt(rgb[1], 10);
            const b = parseInt(rgb[2], 10);

            // Match to known color
            const matched = WPLACE_COLOR_MAP.find(c => c.r === r && c.g === g && c.b === b);
            if (matched) {
              // Check if not already added
              if (!availableIds.has(matched.id)) {
                colors.push({ id: matched.id, r, g, b, hex: rgbToHex(r, g, b), name: matched.name });
                availableIds.add(matched.id);
              }
            }
          });
          if (colors.length >= 8) break;
        }
      }
    } catch (e) {
      console.warn('[PatPlacer Repair] Error extracting palette from DOM:', e);
    }

    return { colors, availableIds };
  }

  function extractColorPalette() {
    let colors = [];
    let availableIds = new Set();
    let source = null;

    console.log('[PatPlacer Repair] Extracting color palette...');

    // Try window globals first
    const wplacePalette = findWplacePalette();
    if (wplacePalette && wplacePalette.length >= 16) {
      wplacePalette.forEach((item, idx) => {
        let hex, r, g, b;
        if (typeof item === 'string') {
          hex = item;
          const rgb = hexToRgb(item);
          if (!rgb) return;
          r = rgb.r; g = rgb.g; b = rgb.b;
        } else if (item && item.hex) {
          hex = item.hex;
          r = item.r; g = item.g; b = item.b;
        }
        if (hex) {
          const matched = WPLACE_COLOR_MAP.find(c => c.r === r && c.g === g && c.b === b);
          const id = matched ? matched.id : idx;
          const name = matched ? matched.name : undefined;
          colors.push({ id, r, g, b, hex, name });
          availableIds.add(id);
        }
      });
      if (colors.length >= 16) {
        source = 'live';
        console.log(`[PatPlacer Repair] Using wplace internal palette: ${colors.length} colors`);
      }
    }

    // Try DOM extraction if globals failed
    if (colors.length < 16) {
      console.log('[PatPlacer Repair] Trying DOM extraction...');
      const domResult = extractColorPaletteFromDOM();
      if (domResult.colors.length >= 8) {
        colors = domResult.colors;
        availableIds = domResult.availableIds;
        source = 'live';
        console.log(`[PatPlacer Repair] Using DOM palette: ${colors.length} colors`);
      }
    }

    // Fallback to full color map
    if (colors.length < 16) {
      console.log('[PatPlacer Repair] Using fallback palette');
      colors = WPLACE_COLOR_MAP.map(c => ({
        id: c.id,
        r: c.r,
        g: c.g,
        b: c.b,
        hex: rgbToHex(c.r, c.g, c.b),
        name: c.name
      }));
      availableIds = new Set(WPLACE_COLOR_MAP.map(c => c.id));
      source = 'fallback';
    }

    CONFIG.COLOR_PALETTE = colors;
    CONFIG.USER_AVAILABLE_COLORS = availableIds;
    state.colorsReady = true;
    state.paletteSource = source;

    console.log(`[PatPlacer Repair] Palette extracted: ${colors.length} total colors, ${availableIds.size} available, source: ${source}`);
    updatePaletteUi();
    return colors;
  }

  function updatePaletteUi() {
    if (!state.ui.paletteInfo) return;

    const count = CONFIG.USER_AVAILABLE_COLORS.size || CONFIG.COLOR_PALETTE.length;
    const source = state.paletteSource;

    if (source === 'live') {
      state.ui.paletteInfo.innerHTML = `<span style="color:#4ade80;">● Live Palette: ${count} colors</span>`;
    } else if (source === 'fallback') {
      state.ui.paletteInfo.innerHTML = `<span style="color:#fbbf24;">● Fallback Palette (open color picker to detect your colors)</span>`;
    } else {
      state.ui.paletteInfo.innerHTML = `<span style="color:#f87171;">● No Palette (open color picker)</span>`;
    }
  }

  function setupColorPickerObserver() {
    if (state.colorPickerObserver) return;

    console.log('[PatPlacer Repair] Setting up color picker observer');

    // Watch for color picker appearing in DOM
    state.colorPickerObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const el = node;
          
          // Check for tooltip (Wplace's color picker container)
          if (el.classList && (el.classList.contains('tooltip') || el.className.includes('tooltip'))) {
            console.log('[PatPlacer Repair] Tooltip detected, re-extracting palette');
            setTimeout(() => {
              extractColorPalette();
            }, 300);
            return;
          }

          // Check for color-related classes
          const className = el.className || '';
          if (typeof className === 'string' && (
            className.includes('color') ||
            className.includes('palette') ||
            className.includes('picker')
          )) {
            console.log('[PatPlacer Repair] Color element detected, re-extracting palette');
            setTimeout(() => {
              extractColorPalette();
            }, 300);
          }
        }
      }
    });

    state.colorPickerObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also try immediate extraction
    extractColorPalette();
  }

  function isColorAvailable(colorIdx) {
    // If using fallback, assume all colors available
    if (state.paletteSource === 'fallback') return true;
    return CONFIG.USER_AVAILABLE_COLORS.has(colorIdx);
  }

  function findClosestColor(r, g, b) {
    let best = null;
    let bestScore = Infinity;

    for (const c of CONFIG.COLOR_PALETTE) {
      const rmean = (c.r + r) / 2;
      const rdiff = c.r - r;
      const gdiff = c.g - g;
      const bdiff = c.b - b;
      const dist = Math.sqrt(
        (((512 + rmean) * rdiff * rdiff) >> 8) +
        4 * gdiff * gdiff +
        (((767 - rmean) * bdiff * bdiff) >> 8)
      );
      if (dist < bestScore) {
        bestScore = dist;
        best = c;
        if (dist === 0) break;
      }
    }

    return best;
  }

  function resolveColorToId(r, g, b) {
    for (const c of CONFIG.COLOR_PALETTE) {
      if (c.r === r && c.g === g && c.b === b) return c.id;
    }
    const closest = findClosestColor(r, g, b);
    return closest ? closest.id : null;
  }

  function getWplaceRgbById(colorIdx) {
    const id = Number(colorIdx);
    if (!Number.isFinite(id)) return null;
    const c = CONFIG.COLOR_PALETTE.find(x => x.id === id);
    if (!c) return null;
    return { r: c.r, g: c.g, b: c.b };
  }

  // ------------------------------------------------------------
  // TILE CACHE
  // ------------------------------------------------------------
  function tileKey(x, y) {
    return `${x},${y}`;
  }

  function rememberTileCacheOrder(key) {
    state.tileCacheOrder.push(key);
    if (state.tileCacheOrder.length > CONFIG.CACHE_MAX_TILES) {
      const oldest = state.tileCacheOrder.shift();
      if (oldest) state.tileCache.delete(oldest);
    }
  }

  function computeAbsPos(relX, relY) {
    const absPixelX = state.anchorPixel.x + relX;
    const absPixelY = state.anchorPixel.y + relY;

    const tileOffsetX = Math.floor(absPixelX / CONFIG.TILE_SIZE);
    const tileOffsetY = Math.floor(absPixelY / CONFIG.TILE_SIZE);

    const tileX = state.anchorTile.x + tileOffsetX;
    const tileY = state.anchorTile.y + tileOffsetY;

    const pixelInTileX = ((absPixelX % CONFIG.TILE_SIZE) + CONFIG.TILE_SIZE) % CONFIG.TILE_SIZE;
    const pixelInTileY = ((absPixelY % CONFIG.TILE_SIZE) + CONFIG.TILE_SIZE) % CONFIG.TILE_SIZE;

    return { tileX, tileY, pixelInTileX, pixelInTileY };
  }

  function getCachedTilePixel(tileX, tileY, px, py) {
    const key = tileKey(tileX, tileY);
    const img = state.tileCache.get(key);
    if (!img) return null;
    if (px < 0 || py < 0 || px >= img.width || py >= img.height) return null;
    const i = (py * img.width + px) * 4;
    const d = img.data;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  }

  function tryParseTileTemplateFromUrl(url) {
    try {
      const m = String(url).match(/^(.*\/)(\d+)\/(\d+)\.png(.*)$/i);
      if (!m) return null;
      return { prefix: m[1], suffix: m[4] || '' };
    } catch {
      return null;
    }
  }

  async function decodePngToImageData(blob) {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function installTileFetchInterceptor() {
    if (window.__PATPLACER_REPAIR_TILE_INTERCEPTOR_INSTALLED__) return;
    window.__PATPLACER_REPAIR_TILE_INTERCEPTOR_INSTALLED__ = true;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const resp = await originalFetch(...args);
      try {
        const url = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url);
        if (typeof url === 'string' && /\/\d+\/\d+\.png(\?|$)/.test(url)) {
          if (!state.tileUrlTemplate) {
            const t = tryParseTileTemplateFromUrl(url);
            if (t) state.tileUrlTemplate = t;
          }

          const clone = resp.clone();
          clone.blob().then(async (blob) => {
            try {
              const m = String(url).match(/\/(\d+)\/(\d+)\.png(\?|$)/);
              if (!m) return;
              const tileX = parseInt(m[1], 10);
              const tileY = parseInt(m[2], 10);
              const img = await decodePngToImageData(blob);
              const key = tileKey(tileX, tileY);
              if (!state.tileCache.has(key)) rememberTileCacheOrder(key);
              state.tileCache.set(key, img);
            } catch {
              // ignore
            }
          }).catch(() => {});
        }
      } catch {
        // ignore
      }
      return resp;
    };
  }

  async function fetchTileIfPossible(tileX, tileY) {
    const key = tileKey(tileX, tileY);
    if (state.tileCache.has(key)) return state.tileCache.get(key);

    if (!state.tileUrlTemplate) return null;

    const url = `${state.tileUrlTemplate.prefix}${tileX}/${tileY}.png${state.tileUrlTemplate.suffix}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      const img = await decodePngToImageData(blob);
      if (!state.tileCache.has(key)) rememberTileCacheOrder(key);
      state.tileCache.set(key, img);
      return img;
    } catch {
      return null;
    }
  }

  async function ensureTilesLoaded(tileList) {
    const queue = tileList.slice();
    let active = 0;

    return new Promise((resolve) => {
      const tick = async () => {
        while (active < CONFIG.TILE_FETCH_CONCURRENCY && queue.length) {
          const { x, y } = queue.shift();
          active++;
          fetchTileIfPossible(x, y).finally(() => {
            active--;
            tick();
          });
        }
        if (queue.length === 0 && active === 0) resolve();
      };
      tick();
    });
  }

  // ------------------------------------------------------------
  // DRAFT MAP SYNC
  // ------------------------------------------------------------
  function clearHookTimeout() {
    if (state.hookTimeout) {
      clearInterval(state.hookTimeout);
      state.hookTimeout = null;
    }
    state.hookCountdown = 0;
  }

  function hookDraftMapOnce() {
    if (state.draftMap) {
      // Already synced
      updateSyncUi();
      return;
    }

    if (state.draftMapHooked) {
      // Already waiting
      return;
    }

    state.draftMapHooked = true;
    state.hookCountdown = 20;

    const originalSet = Map.prototype.set;
    if (!state.originalMapSet) state.originalMapSet = originalSet;

    Map.prototype.set = function (key, value) {
      try {
        if (!state.draftMap && typeof key === 'string' && /^t=\(\d+,\d+\);p=\(\d+,\d+\);s=\d+$/.test(key)) {
          state.draftMap = this;
          clearHookTimeout();
          // Restore immediately
          Map.prototype.set = originalSet;
          updateSyncUi();
          setStatus('Sync complete! Ready to scan.');
          startSentWatcher();
        }
      } catch {
        // ignore
      }
      return originalSet.call(this, key, value);
    };

    // Countdown timer with UI feedback
    state.hookTimeout = setInterval(() => {
      state.hookCountdown--;
      updateSyncUi();
      if (state.hookCountdown <= 0) {
        clearHookTimeout();
        // Restore Map.prototype
        try {
          Map.prototype.set = originalSet;
        } catch { }
        state.draftMapHooked = false;
        updateSyncUi();
        setStatus('Sync timed out. Click Sync again.');
      }
    }, 1000);

    updateSyncUi();
  }

  function updateSyncUi() {
    if (!state.ui.syncInfo) return;

    if (state.draftMap) {
      state.ui.syncInfo.innerHTML = `<span style="color:#4ade80;">● Synced — Ready</span>`;
      if (state.ui.btnSync) {
        state.ui.btnSync.textContent = 'Synced ✓';
        state.ui.btnSync.disabled = true;
      }
    } else if (state.draftMapHooked && state.hookCountdown > 0) {
      state.ui.syncInfo.innerHTML = `<span style="color:#fbbf24;">● Waiting for draft pixel... (${state.hookCountdown}s)</span>`;
      if (state.ui.btnSync) {
        state.ui.btnSync.textContent = `Waiting... ${state.hookCountdown}s`;
        state.ui.btnSync.disabled = true;
      }
    } else {
      state.ui.syncInfo.innerHTML = `<span style="color:#94a3b8;">● Not synced — click Sync then place any draft pixel</span>`;
      if (state.ui.btnSync) {
        state.ui.btnSync.textContent = 'Sync Draft';
        state.ui.btnSync.disabled = false;
      }
    }

    updateButtonStates();
  }

  function updateButtonStates() {
    // Scan requires project loaded
    if (state.ui.btnScan) {
      state.ui.btnScan.disabled = !state.project;
    }

    // Place requires project + scan + draftMap
    const canPlace = !!(state.project && state.lastScan && state.draftMap && state.lastScan.fixes && state.lastScan.fixes.length > 0);
    if (state.ui.btnPlaceFixes) {
      state.ui.btnPlaceFixes.disabled = !canPlace;
    }
  }

  function makeDraftKey(tileX, tileY, px, py) {
    const season = 0;
    return `t=(${tileX},${tileY});p=(${px},${py});s=${season}`;
  }

  function writeDraft(tileX, tileY, px, py, wplaceColorIdx) {
    if (!state.draftMap) throw new Error('Draft map not captured');

    const key = makeDraftKey(tileX, tileY, px, py);

    let shouldCountAsDrafted = true;
    try {
      const prev = state.draftMap.get(key);
      if (prev && prev.colorIdx === wplaceColorIdx) shouldCountAsDrafted = false;
    } catch {
      // ignore
    }

    const rgb = getWplaceRgbById(wplaceColorIdx);
    const value = {
      color: { r: rgb ? rgb.r : 0, g: rgb ? rgb.g : 0, b: rgb ? rgb.b : 0, a: 255 },
      tile: [tileX, tileY],
      pixel: [px, py],
      season: 0,
      colorIdx: wplaceColorIdx
    };

    state.fixKeys.add(key);

    const mapSet = state.originalMapSet || Map.prototype.set;
    mapSet.call(state.draftMap, key, value);

    return shouldCountAsDrafted;
  }

  // ------------------------------------------------------------
  // PROJECT PARSING
  // ------------------------------------------------------------
  function parseProject(json) {
    if (!json || typeof json !== 'object') throw new Error('Invalid JSON');
    if (!Array.isArray(json.pixels) || !Array.isArray(json.palette)) throw new Error('Not a PatPlacer v2 file');

    const anchor = json?.project?.anchor;
    if (!anchor?.tile || !anchor?.pixel) {
      throw new Error('File has no anchor. Repair tool requires project.anchor for absolute positioning.');
    }

    const anchorTile = { x: Number(anchor.tile.x), y: Number(anchor.tile.y) };
    const anchorPixel = { x: Number(anchor.pixel.x), y: Number(anchor.pixel.y) };
    if (!Number.isFinite(anchorTile.x) || !Number.isFinite(anchorTile.y) || !Number.isFinite(anchorPixel.x) || !Number.isFinite(anchorPixel.y)) {
      throw new Error('Invalid anchor coordinates');
    }

    const pixels = json.pixels
      .filter(p => Array.isArray(p) && p.length >= 4)
      .map(p => ({
        x: Number(p[0]),
        y: Number(p[1]),
        paletteIdx: Number(p[2]),
        colorIdx: Number(p[3])
      }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.paletteIdx) && Number.isFinite(p.colorIdx));

    return {
      raw: json,
      name: json?.project?.name || 'Untitled',
      anchorTile,
      anchorPixel,
      palette: json.palette,
      pixels
    };
  }

  // ------------------------------------------------------------
  // SCAN
  // ------------------------------------------------------------
  async function scanNow() {
    if (!state.project) {
      alert('Load a repair/save file first.');
      return;
    }

    // Ensure palette is extracted
    if (!state.colorsReady) {
      extractColorPalette();
    }

    setStatus('Scanning…');
    setProgress('Preparing tiles…');

    const neededTiles = new Map();
    for (const p of state.pixels) {
      const abs = computeAbsPos(p.x, p.y);
      neededTiles.set(tileKey(abs.tileX, abs.tileY), { x: abs.tileX, y: abs.tileY });
    }

    const tileList = Array.from(neededTiles.values());

    if (!state.tileUrlTemplate) {
      setProgress('Tip: pan/zoom the canvas first to load tiles.');
    } else {
      setProgress(`Fetching tiles (${tileList.length})…`);
      await ensureTilesLoaded(tileList);
    }

    let correct = 0;
    let missing = 0;
    let altered = 0;
    let unknown = 0;

    const fixes = [];
    const unfixableColors = new Map(); // colorIdx -> count

    for (let i = 0; i < state.pixels.length; i++) {
      const p = state.pixels[i];
      const abs = computeAbsPos(p.x, p.y);
      const actual = getCachedTilePixel(abs.tileX, abs.tileY, abs.pixelInTileX, abs.pixelInTileY);

      const expectedId = Number(p.colorIdx);
      if (!Number.isFinite(expectedId) || expectedId <= 0) {
        continue;
      }

      if (!actual) {
        unknown++;
      } else if (actual[3] < CONFIG.TRANSPARENCY_THRESHOLD) {
        missing++;
        // Check if user has this color
        if (isColorAvailable(expectedId)) {
          fixes.push({ ...p, ...abs });
        } else {
          const prev = unfixableColors.get(expectedId) || 0;
          unfixableColors.set(expectedId, prev + 1);
        }
      } else {
        const actualId = resolveColorToId(actual[0], actual[1], actual[2]);
        if (actualId == null) {
          unknown++;
        } else if (actualId !== expectedId) {
          altered++;
          // Check if user has this color
          if (isColorAvailable(expectedId)) {
            fixes.push({ ...p, ...abs });
          } else {
            const prev = unfixableColors.get(expectedId) || 0;
            unfixableColors.set(expectedId, prev + 1);
          }
        } else {
          correct++;
        }
      }

      if (i % CONFIG.YIELD_EVERY === 0) {
        setProgress(`Scanning… ${i}/${state.pixels.length}`);
        await sleep(0);
      }
    }

    state.lastScan = {
      total: state.pixels.length,
      correct,
      missing,
      altered,
      unknown,
      fixes,
      unfixableColors
    };

    state.unfixableColors = unfixableColors;
    state.fixesDrafted = 0;
    state.fixKeys = new Set();
    state.fixKeysTotal = fixes.length;
    stopSentWatcher();

    if (state.ui.fixedInfo) {
      state.ui.fixedInfo.textContent = `Fixed: 0/${fixes.length}`;
    }

    if (state.ui.scanInfo) {
      state.ui.scanInfo.textContent = `OK: ${correct} | Missing: ${missing} | Changed: ${altered} | Uncached: ${unknown} | Fixable: ${fixes.length}`;
    }

    // Show unfixable colors
    updateUnfixableUi();

    setStatus('Scan complete');
    setProgress('');
    updateButtonStates();
  }

  function updateUnfixableUi() {
    if (!state.ui.unfixableInfo) return;

    const unfixable = state.unfixableColors;
    if (!unfixable || unfixable.size === 0) {
      state.ui.unfixableInfo.style.display = 'none';
      return;
    }

    let totalUnfixable = 0;
    const colorNames = [];
    for (const [colorIdx, count] of unfixable) {
      totalUnfixable += count;
      const name = getColorName(colorIdx);
      colorNames.push(`${name} (${count})`);
    }

    state.ui.unfixableInfo.style.display = 'block';
    state.ui.unfixableInfo.innerHTML = `
      <span style="color:#f87171;">⚠ ${totalUnfixable} unfixable (missing colors):</span><br>
      <span style="color:#94a3b8;font-size:11px;">${colorNames.join(', ')}</span>
    `;
  }

  // ------------------------------------------------------------
  // PLACE FIXES
  // ------------------------------------------------------------
  async function placeFixDrafts() {
    if (!state.lastScan) {
      alert('Scan first.');
      return;
    }
    if (!state.draftMap) {
      alert('Not synced. Click "Sync Draft", then place any draft pixel on the canvas.');
      return;
    }

    const fixes = state.lastScan.fixes || [];
    if (!fixes.length) {
      alert('No fixes needed (or all needed colors are unavailable).');
      return;
    }

    setStatus('Placing fix drafts…');
    setProgress('Writing drafts…');

    state.fixKeys = new Set();
    state.fixKeysTotal = fixes.length;
    stopSentWatcher();

    let drafted = 0;
    let attempted = 0;

    const byTile = new Map();
    for (const f of fixes) {
      const k = `${f.tileX},${f.tileY}`;
      if (!byTile.has(k)) byTile.set(k, []);
      byTile.get(k).push(f);
    }

    for (const [, tileFixes] of byTile) {
      for (let i = 0; i < tileFixes.length; i++) {
        const f = tileFixes[i];
        attempted++;
        try {
          const changed = writeDraft(f.tileX, f.tileY, f.pixelInTileX, f.pixelInTileY, f.colorIdx);
          if (changed) drafted++;
        } catch (e) {
          console.warn('[PatPlacer Repair] Failed to write draft:', e);
        }

        if (attempted % CONFIG.YIELD_EVERY === 0) {
          setProgress(`Drafted: ${drafted}/${fixes.length}`);
          await sleep(0);
        }
      }
      await sleep(0);
    }

    state.fixesDrafted = drafted;
    if (state.ui.fixedInfo) {
      state.ui.fixedInfo.textContent = `Fixed: 0/${fixes.length}`;
    }

    setStatus(`Drafts ready: ${drafted}`);
    setProgress('Use Wplace confirm/send. Progress updates as drafts clear.');
    startSentWatcher();
  }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  function makePanel() {
    const existing = document.getElementById('patplacer-repair-panel');
    if (existing) {
      state.ui.panel = existing;
      return existing;
    }

    const panel = document.createElement('div');
    panel.id = 'patplacer-repair-panel';

    panel.innerHTML = `
      <div class="pp-header">
        <div class="pp-title">
          <span>REPAIR TOOL</span>
        </div>
        <button class="pp-close-btn" title="Close">×</button>
      </div>

      <div class="pp-content">
        <div class="pp-section">
          <div class="pp-section-title">1. LOAD FILE</div>
          <div class="pp-section-content">
            <div class="pp-form-group">
              <input id="pp-repair-file" type="file" accept="application/json" class="pp-input" />
            </div>
            <div class="pp-upload-subtext" id="pp-repair-file-info">No file loaded</div>
          </div>
        </div>

        <div class="pp-repair-step-grid">
          <div class="pp-section">
            <div class="pp-section-title">2. PALETTE</div>
            <div class="pp-section-content">
              <div class="pp-upload-subtext" id="pp-repair-palette-info">
                <span style="color:#94a3b8;">● Checking...</span>
              </div>
            </div>
          </div>

          <div class="pp-section">
            <div class="pp-section-title">3. SYNC</div>
            <div class="pp-section-content">
              <div class="pp-upload-subtext" id="pp-repair-sync-info">
                <span style="color:#94a3b8;">● Not synced</span>
              </div>
              <div class="pp-btn-row" style="margin-top:8px;">
                <button class="pp-btn" id="pp-repair-sync">Sync Draft</button>
              </div>
              <div class="pp-upload-subtext" style="margin-top:4px;font-size:10px;color:#64748b;">Click, then place any draft pixel on canvas</div>
            </div>
          </div>
        </div>

        <div class="pp-section">
          <div class="pp-section-title">4. SCAN</div>
          <div class="pp-section-content">
            <div class="pp-btn-row">
              <button class="pp-btn" id="pp-repair-scan" disabled>Scan Canvas</button>
            </div>
            <div class="pp-upload-subtext" id="pp-repair-scan-info" style="margin-top:6px;">—</div>
            <div class="pp-upload-subtext" id="pp-repair-unfixable" style="margin-top:4px;display:none;"></div>
          </div>
        </div>

        <div class="pp-section">
          <div class="pp-section-title">5. FIX</div>
          <div class="pp-section-content">
            <div class="pp-btn-row">
              <button class="pp-btn" id="pp-repair-place" disabled>Place Fix Drafts</button>
            </div>
            <div class="pp-upload-status" style="margin-top:6px;">
              <div class="pp-status-badge pp-status-ready" id="pp-repair-fixed">Fixed: 0/0</div>
            </div>
            <div class="pp-upload-subtext" id="pp-repair-progress"></div>
          </div>
        </div>

        <div class="pp-section">
          <div class="pp-section-title">STATUS</div>
          <div class="pp-section-content">
            <div class="pp-upload-subtext" id="pp-repair-status">Ready</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Draggable header
    const header = panel.querySelector('.pp-header');
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    header.style.cursor = 'move';
    header.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = `${startLeft + dx}px`;
      panel.style.top = `${startTop + dy}px`;
      panel.style.right = 'auto';
    });

    window.addEventListener('mouseup', () => {
      dragging = false;
    });

    panel.querySelector('.pp-close-btn').addEventListener('click', () => {
      stopSentWatcher();
      clearHookTimeout();
      panel.style.display = 'none';
    });

    // Cache UI refs
    state.ui.panel = panel;
    state.ui.status = panel.querySelector('#pp-repair-status');
    state.ui.fileInfo = panel.querySelector('#pp-repair-file-info');
    state.ui.paletteInfo = panel.querySelector('#pp-repair-palette-info');
    state.ui.scanInfo = panel.querySelector('#pp-repair-scan-info');
    state.ui.syncInfo = panel.querySelector('#pp-repair-sync-info');
    state.ui.unfixableInfo = panel.querySelector('#pp-repair-unfixable');
    state.ui.btnScan = panel.querySelector('#pp-repair-scan');
    state.ui.btnPlaceFixes = panel.querySelector('#pp-repair-place');
    state.ui.btnSync = panel.querySelector('#pp-repair-sync');
    state.ui.progress = panel.querySelector('#pp-repair-progress');
    state.ui.fixedInfo = panel.querySelector('#pp-repair-fixed');

    // File load
    panel.querySelector('#pp-repair-file').addEventListener('change', async (e) => {
      try {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        setStatus('Loading file…');
        const text = await file.text();
        const json = JSON.parse(text);
        const proj = parseProject(json);

        state.project = proj;
        state.pixels = proj.pixels;
        state.palette = proj.palette;
        state.anchorTile = proj.anchorTile;
        state.anchorPixel = proj.anchorPixel;
        state.lastScan = null;
        state.fixesDrafted = 0;
        state.fixKeys = new Set();
        state.fixKeysTotal = 0;
        state.unfixableColors = new Map();
        stopSentWatcher();

        if (state.ui.fileInfo) {
          state.ui.fileInfo.textContent = `${proj.name} | ${state.pixels.length} pixels`;
        }
        if (state.ui.scanInfo) state.ui.scanInfo.textContent = '—';
        if (state.ui.fixedInfo) state.ui.fixedInfo.textContent = 'Fixed: 0/0';
        if (state.ui.unfixableInfo) state.ui.unfixableInfo.style.display = 'none';

        setStatus('File loaded — scan when ready');
        updateButtonStates();
      } catch (err) {
        console.error('[PatPlacer Repair] Load failed:', err);
        alert(err?.message || String(err));
        setStatus('Error loading file');
      }
    });

    // Sync button
    state.ui.btnSync.addEventListener('click', () => {
      hookDraftMapOnce();
    });

    // Scan button
    state.ui.btnScan.addEventListener('click', () => {
      scanNow().catch(err => {
        console.error('[PatPlacer Repair] Scan failed:', err);
        alert(err?.message || String(err));
        setStatus('Scan failed');
      });
    });

    // Place fixes button
    state.ui.btnPlaceFixes.addEventListener('click', () => {
      placeFixDrafts().catch(err => {
        console.error('[PatPlacer Repair] Place fixes failed:', err);
        alert(err?.message || String(err));
        setStatus('Failed to place fixes');
      });
    });

    updateSyncUi();
    updateButtonStates();

    return panel;
  }

  function togglePanel() {
    const p = document.getElementById('patplacer-repair-panel');
    console.log('[Repair] togglePanel called, panel found:', !!p, 'display:', p?.style?.display);
    if (p) {
      const newDisplay = (p.style.display === 'none') ? 'flex' : 'none';
      console.log('[Repair] togglePanel setting display to:', newDisplay);
      p.style.display = newDisplay;
      console.log('[Repair] togglePanel done, display now:', p.style.display);
    } else {
      console.log('[Repair] togglePanel: panel not in DOM, calling makePanel()');
      makePanel();
    }
  }

  function init() {
    installTileFetchInterceptor();
    setupColorPickerObserver();
    const panel = makePanel();
    panel.style.display = 'none';

    window.PatPlacerRepair = {
      togglePanel
    };
  }

  try {
    init();
  } catch (e) {
    console.error('[PatPlacer Repair] Init failed:', e);
    window.PatPlacerRepair = null;
    alert('PatPlacer Repair Tool failed to initialize: ' + (e?.message || e));
  }
})();
