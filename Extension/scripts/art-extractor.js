/**
 * PatPlacer Art Extractor
 * Separate tool for extracting artwork from the wplace canvas
 */

(function() {
  'use strict';

  // Prevent double initialization
  if (window.PatPlacerExtractor && window.PatPlacerExtractor.togglePanel) {
    console.log('[PatPlacer Extractor] Already loaded, toggling panel');
    window.PatPlacerExtractor.togglePanel();
    return;
  }

  // Temporary flag to prevent race conditions
  window.PatPlacerExtractor = { loading: true };

  console.log('[PatPlacer Extractor] Initializing...');

  // ============================================================
  // CONFIGURATION
  // ============================================================
  const CONFIG = {
    TILE_SIZE: 1000,
    MIN_AREA_SIZE: 1,
    MAX_AREA_SIZE: 2000,
    TILE_URL_BASE: 'https://backend.wplace.live/files/s0/tiles',
    ICON_BASE: (window.__PATPLACER_RESOURCES__ && window.__PATPLACER_RESOURCES__.iconsBaseUrl)
      ? window.__PATPLACER_RESOURCES__.iconsBaseUrl
      : 'icons/',
    // WPlace color palette (same as main tool)
    COLOR_PALETTE: []
  };

  // ============================================================
  // STATE
  // ============================================================
  const state = {
    ui: null,
    isCapturing: false,
    capturedPixels: [],
    requiredPixels: 2,
    selectionArea: null,
    isScanning: false,
    scannedPixels: [],
    totalPixels: 0,
    extractMode: 'copy', // 'copy' or 'repair'
  };

  // Fetch interceptor state
  let originalFetch = null;
  let fetchInterceptionActive = false;

  // ============================================================
  // COLOR PALETTE (loaded from main tool or hardcoded)
  // ============================================================
  function initColorPalette() {
    // Try to get from main PatPlacer if available
    if (window.PatPlacer && window.PatPlacer.getColorPalette) {
      CONFIG.COLOR_PALETTE = window.PatPlacer.getColorPalette();
      return;
    }

    // Hardcoded WPlace palette
    CONFIG.COLOR_PALETTE = [
      { id: 1, r: 0, g: 0, b: 0, name: 'Black' },
      { id: 2, r: 60, g: 60, b: 60, name: 'Dark Gray' },
      { id: 3, r: 120, g: 120, b: 120, name: 'Gray' },
      { id: 4, r: 210, g: 210, b: 210, name: 'Light Gray' },
      { id: 5, r: 255, g: 255, b: 255, name: 'White' },
      { id: 6, r: 96, g: 0, b: 24, name: 'Deep Red' },
      { id: 7, r: 237, g: 28, b: 36, name: 'Red' },
      { id: 8, r: 255, g: 127, b: 39, name: 'Orange' },
      { id: 9, r: 246, g: 170, b: 9, name: 'Gold' },
      { id: 10, r: 249, g: 221, b: 59, name: 'Yellow' },
      { id: 11, r: 255, g: 250, b: 188, name: 'Light Yellow' },
      { id: 12, r: 14, g: 185, b: 104, name: 'Dark Green' },
      { id: 13, r: 19, g: 230, b: 123, name: 'Green' },
      { id: 14, r: 135, g: 255, b: 94, name: 'Light Green' },
      { id: 15, r: 12, g: 129, b: 110, name: 'Dark Teal' },
      { id: 16, r: 16, g: 174, b: 166, name: 'Teal' },
      { id: 17, r: 19, g: 225, b: 190, name: 'Light Teal' },
      { id: 20, r: 96, g: 247, b: 242, name: 'Cyan' },
      { id: 44, r: 187, g: 250, b: 242, name: 'Light Cyan' },
      { id: 18, r: 40, g: 80, b: 158, name: 'Dark Blue' },
      { id: 19, r: 64, g: 147, b: 228, name: 'Blue' },
      { id: 21, r: 107, g: 80, b: 246, name: 'Indigo' },
      { id: 22, r: 153, g: 177, b: 251, name: 'Light Indigo' },
      { id: 23, r: 120, g: 12, b: 153, name: 'Dark Purple' },
      { id: 24, r: 170, g: 56, b: 185, name: 'Purple' },
      { id: 25, r: 224, g: 159, b: 249, name: 'Light Purple' },
      { id: 26, r: 203, g: 0, b: 122, name: 'Dark Pink' },
      { id: 27, r: 236, g: 31, b: 128, name: 'Pink' },
      { id: 28, r: 243, g: 141, b: 169, name: 'Light Pink' },
      { id: 29, r: 104, g: 70, b: 52, name: 'Dark Brown' },
      { id: 30, r: 149, g: 104, b: 42, name: 'Brown' },
      { id: 31, r: 248, g: 178, b: 119, name: 'Beige' },
      { id: 52, r: 255, g: 197, b: 165, name: 'Light Beige' },
      { id: 32, r: 170, g: 170, b: 170, name: 'Medium Gray' },
      { id: 33, r: 165, g: 14, b: 30, name: 'Dark Red' },
      { id: 34, r: 250, g: 128, b: 114, name: 'Light Red' },
      { id: 35, r: 228, g: 92, b: 26, name: 'Dark Orange' },
      { id: 37, r: 156, g: 132, b: 49, name: 'Dark Goldenrod' },
      { id: 38, r: 197, g: 173, b: 49, name: 'Goldenrod' },
      { id: 39, r: 232, g: 212, b: 95, name: 'Light Goldenrod' },
      { id: 40, r: 74, g: 107, b: 58, name: 'Dark Olive' },
      { id: 41, r: 90, g: 148, b: 74, name: 'Olive' },
      { id: 42, r: 132, g: 197, b: 115, name: 'Light Olive' },
      { id: 43, r: 15, g: 121, b: 159, name: 'Dark Cyan' },
      { id: 45, r: 125, g: 199, b: 255, name: 'Light Blue' },
      { id: 46, r: 77, g: 49, b: 184, name: 'Dark Indigo' },
      { id: 47, r: 74, g: 66, b: 132, name: 'Dark Slate Blue' },
      { id: 48, r: 122, g: 113, b: 196, name: 'Slate Blue' },
      { id: 49, r: 181, g: 174, b: 241, name: 'Light Slate Blue' },
      { id: 50, r: 255, g: 153, b: 204, name: 'Pale Pink' },
      { id: 51, r: 185, g: 122, b: 87, name: 'Tan' }
    ];
  }

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  function showAlert(message, type = 'info') {
    console.log(`[Extractor] ${type}: ${message}`);
    
    const alert = document.createElement('div');
    alert.className = 'pp-extractor-alert';
    alert.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 100001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: ppExtractorSlideIn 0.3s ease-out;
      max-width: 350px;
      ${type === 'error' ? 'background: linear-gradient(135deg, #ff4757, #ff3742);' :
        type === 'warning' ? 'background: linear-gradient(135deg, #ffa502, #ff6348);' :
        type === 'success' ? 'background: linear-gradient(135deg, #26de81, #20bf6b);' :
        'background: linear-gradient(135deg, #667eea, #764ba2);'}
    `;
    alert.textContent = message;

    // Add animation styles if not present
    if (!document.getElementById('pp-extractor-alert-styles')) {
      const style = document.createElement('style');
      style.id = 'pp-extractor-alert-styles';
      style.textContent = `
        @keyframes ppExtractorSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes ppExtractorSlideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(alert);

    setTimeout(() => {
      alert.style.animation = 'ppExtractorSlideOut 0.3s ease-in';
      setTimeout(() => alert.remove(), 300);
    }, 3500);
  }

  // ============================================================
  // PIXEL CAPTURE VIA FETCH INTERCEPTION
  // ============================================================

  function setupPixelCapture() {
    console.log('[Extractor] Setting up pixel capture via fetch interception...');

    if (!originalFetch) {
      originalFetch = window.fetch;
    }

    if (!fetchInterceptionActive) {
      window.fetch = async (url, options) => {
        // Check if this is a pixel painting request
        if (state.isCapturing &&
            typeof url === 'string' &&
            url.includes('/s0/pixel/') &&
            options && options.method === 'POST') {

          try {
            console.log('[Extractor] Intercepting pixel paint request:', url);

            const response = await originalFetch(url, options);

            if (response.ok && options.body) {
              let requestBody;
              try {
                requestBody = JSON.parse(options.body);
              } catch (e) {
                return response;
              }

              if (requestBody.coords && Array.isArray(requestBody.coords) && requestBody.coords.length >= 2) {
                const localX = requestBody.coords[0];
                const localY = requestBody.coords[1];

                const tileMatch = url.match(/\/s0\/pixel\/(\-?\d+)\/(\-?\d+)/);
                if (tileMatch) {
                  const tileX = parseInt(tileMatch[1]);
                  const tileY = parseInt(tileMatch[2]);

                  const globalX = tileX * CONFIG.TILE_SIZE + localX;
                  const globalY = tileY * CONFIG.TILE_SIZE + localY;

                  console.log(`[Extractor] Captured pixel: (${globalX}, ${globalY})`);

                  setTimeout(() => {
                    addCapturedPixel(globalX, globalY);
                  }, 100);
                }
              }
            }

            return response;
          } catch (error) {
            console.error('[Extractor] Error intercepting:', error);
            return originalFetch(url, options);
          }
        }

        return originalFetch(url, options);
      };

      fetchInterceptionActive = true;
      console.log('[Extractor] Fetch interception enabled');
    }
  }

  function restoreFetch() {
    if (originalFetch && fetchInterceptionActive) {
      window.fetch = originalFetch;
      fetchInterceptionActive = false;
      console.log('[Extractor] Fetch restored');
    }
  }

  // ============================================================
  // PIXEL CAPTURE LOGIC
  // ============================================================

  function startPixelCapture() {
    state.isCapturing = true;
    state.capturedPixels = [];
    state.selectionArea = null;
    state.scannedPixels = [];

    setupPixelCapture();
    updateUI();

    showAlert('ðŸŽ¯ Paint pixel at UPPER-LEFT corner of area', 'info');
  }

  function addCapturedPixel(worldX, worldY) {
    if (!state.isCapturing) return;
    if (state.capturedPixels.length >= state.requiredPixels) return;

    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
      showAlert('Invalid coordinates', 'error');
      return;
    }

    const pixel = {
      worldX,
      worldY,
      cornerType: state.capturedPixels.length === 0 ? 'upperLeft' : 'lowerRight',
      timestamp: Date.now()
    };

    state.capturedPixels.push(pixel);
    console.log(`[Extractor] Captured ${pixel.cornerType}: (${worldX}, ${worldY})`);

    updateUI();

    if (state.capturedPixels.length === 1) {
      showAlert(`âœ… Upper-left captured: (${worldX}, ${worldY})`, 'success');
      setTimeout(() => {
        showAlert('ðŸŽ¯ Now paint pixel at LOWER-RIGHT corner', 'info');
      }, 1500);
    } else if (state.capturedPixels.length >= state.requiredPixels) {
      showAlert(`âœ… Lower-right captured: (${worldX}, ${worldY})`, 'success');
      setTimeout(() => {
        const ok = completeAreaCapture();
        if (ok) {
          // Auto-start scan immediately after defining the area
          setTimeout(() => scanSelectedArea(), 150);
        }
      }, 1000);
    }
  }

  function completeAreaCapture() {
    state.isCapturing = false;
    restoreFetch();

    if (state.capturedPixels.length < 2) {
      showAlert('Need 2 pixels to define area', 'error');
      return false;
    }

    const pixels = state.capturedPixels;
    const minX = Math.min(...pixels.map(p => p.worldX));
    const minY = Math.min(...pixels.map(p => p.worldY));
    const maxX = Math.max(...pixels.map(p => p.worldX));
    const maxY = Math.max(...pixels.map(p => p.worldY));

    if (minX >= maxX || minY >= maxY) {
      showAlert('âŒ Invalid area selection', 'error');
      state.capturedPixels = [];
      startPixelCapture();
      return false;
    }

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    if (width < CONFIG.MIN_AREA_SIZE || height < CONFIG.MIN_AREA_SIZE) {
      showAlert(`âŒ Area too small: ${width}Ã—${height}`, 'error');
      return false;
    }

    if (width > CONFIG.MAX_AREA_SIZE || height > CONFIG.MAX_AREA_SIZE) {
      showAlert(`âŒ Area too large: ${width}Ã—${height} (max ${CONFIG.MAX_AREA_SIZE})`, 'error');
      return false;
    }

    state.selectionArea = {
      x1: minX,
      y1: minY,
      x2: maxX,
      y2: maxY,
      width,
      height,
      regionX: Math.floor(minX / CONFIG.TILE_SIZE),
      regionY: Math.floor(minY / CONFIG.TILE_SIZE)
    };

    console.log('[Extractor] Area captured:', state.selectionArea);
    showAlert(`âœ… Area: ${width}Ã—${height} pixels`, 'success');
    updateUI();
    return true;
  }

  function clearSelection() {
    state.isCapturing = false;
    state.capturedPixels = [];
    state.selectionArea = null;
    state.scannedPixels = [];
    restoreFetch();
    updateUI();
    showAlert('Selection cleared', 'info');
  }

  // ============================================================
  // TILE SCANNING
  // ============================================================

  async function scanSelectedArea() {
    if (!state.selectionArea) {
      showAlert('No area selected', 'error');
      return;
    }

    console.log('[Extractor] Starting area scan...');
    state.isScanning = true;
    state.scannedPixels = [];
    updateUI();

    try {
      const { x1, y1, x2, y2 } = state.selectionArea;
      const areaWidth = x2 - x1 + 1;
      const areaHeight = y2 - y1 + 1;

      const startTileX = Math.floor(x1 / CONFIG.TILE_SIZE);
      const startTileY = Math.floor(y1 / CONFIG.TILE_SIZE);
      const endTileX = Math.floor(x2 / CONFIG.TILE_SIZE);
      const endTileY = Math.floor(y2 / CONFIG.TILE_SIZE);

      state.totalPixels = areaWidth * areaHeight;

      for (let tileY = startTileY; tileY <= endTileY; tileY++) {
        for (let tileX = startTileX; tileX <= endTileX; tileX++) {
          try {
            console.log(`[Extractor] Processing tile (${tileX}, ${tileY})...`);

            const tileBlob = await getTileImage(tileX, tileY);
            if (!tileBlob) continue;

            const tileImageData = await processTileBlob(tileBlob);
            if (!tileImageData) continue;

            const tileStartX = tileX * CONFIG.TILE_SIZE;
            const tileStartY = tileY * CONFIG.TILE_SIZE;
            const tileEndX = tileStartX + CONFIG.TILE_SIZE;
            const tileEndY = tileStartY + CONFIG.TILE_SIZE;

            const intersectStartX = Math.max(x1, tileStartX);
            const intersectStartY = Math.max(y1, tileStartY);
            const intersectEndX = Math.min(x2 + 1, tileEndX);
            const intersectEndY = Math.min(y2 + 1, tileEndY);

            for (let globalY = intersectStartY; globalY < intersectEndY; globalY++) {
              for (let globalX = intersectStartX; globalX < intersectEndX; globalX++) {
                const localX = globalX - tileStartX;
                const localY = globalY - tileStartY;

                if (localX >= 0 && localX < tileImageData.width &&
                    localY >= 0 && localY < tileImageData.height) {

                  const pixelIndex = (localY * tileImageData.width + localX) * 4;
                  const r = tileImageData.data[pixelIndex];
                  const g = tileImageData.data[pixelIndex + 1];
                  const b = tileImageData.data[pixelIndex + 2];
                  const a = tileImageData.data[pixelIndex + 3];

                  if (a > 0) {
                    const closestColor = findClosestColor(r, g, b);

                    if (closestColor) {
                      const areaX = globalX - x1;
                      const areaY = globalY - y1;

                      state.scannedPixels.push({
                        x: areaX,
                        y: areaY,
                        worldX: globalX,
                        worldY: globalY,
                        color: closestColor,
                        rgb: { r, g, b, a }
                      });
                    }
                  }
                }
              }
            }

            updateUI();
            await new Promise(r => setTimeout(r, 1));

          } catch (error) {
            console.error(`[Extractor] Error processing tile ${tileX},${tileY}:`, error);
          }
        }
      }

      console.log(`[Extractor] Scan complete: ${state.scannedPixels.length} pixels`);
      showAlert(`âœ… Extracted ${state.scannedPixels.length} pixels`, 'success');

    } catch (error) {
      console.error('[Extractor] Scan failed:', error);
      showAlert(`âŒ Scan failed: ${error.message}`, 'error');
    } finally {
      state.isScanning = false;
      updateUI();
    }
  }

  async function getTileImage(tileX, tileY) {
    try {
      const tileUrl = `${CONFIG.TILE_URL_BASE}/${tileX}/${tileY}.png`;
      const response = await fetch(tileUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.blob();
    } catch (error) {
      console.warn(`[Extractor] Error downloading tile ${tileX},${tileY}:`, error);
      return null;
    }
  }

  async function processTileBlob(blob) {
    try {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      return new Promise((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
      });
    } catch (error) {
      console.error('[Extractor] Error processing tile blob:', error);
      return null;
    }
  }

  // ============================================================
  // COLOR MATCHING (LAB color space)
  // ============================================================

  function findClosestColor(r, g, b) {
    if (!CONFIG.COLOR_PALETTE || CONFIG.COLOR_PALETTE.length === 0) return null;

    let closestColor = null;
    let minDistance = Infinity;

    const inputLab = rgbToLab(r, g, b);

    for (const color of CONFIG.COLOR_PALETTE) {
      const paletteLab = rgbToLab(color.r, color.g, color.b);
      const deltaE = calculateDeltaE(inputLab, paletteLab);

      if (deltaE < minDistance) {
        minDistance = deltaE;
        closestColor = color;
      }
    }

    return closestColor;
  }

  function rgbToLab(r, g, b) {
    r = r / 255; g = g / 255; b = b / 255;

    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
    const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

    const xn = x / 0.95047;
    const yn = y / 1.00000;
    const zn = z / 1.08883;

    const fx = xn > 0.008856 ? Math.pow(xn, 1/3) : (7.787 * xn + 16/116);
    const fy = yn > 0.008856 ? Math.pow(yn, 1/3) : (7.787 * yn + 16/116);
    const fz = zn > 0.008856 ? Math.pow(zn, 1/3) : (7.787 * zn + 16/116);

    return {
      l: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz)
    };
  }

  function calculateDeltaE(lab1, lab2) {
    const dL = lab1.l - lab2.l;
    const dA = lab1.a - lab2.a;
    const dB = lab1.b - lab2.b;
    return Math.sqrt(dL * dL + dA * dA + dB * dB);
  }

  // ============================================================
  // EXPORT FUNCTIONS
  // ============================================================

  function exportForCopy() {
    if (!state.selectionArea || state.scannedPixels.length === 0) {
      showAlert('No data to export. Select an area and scan first.', 'error');
      return;
    }

    exportToJSON('copy');
  }

  function exportForRepair() {
    if (!state.selectionArea || state.scannedPixels.length === 0) {
      showAlert('No data to export. Select an area and scan first.', 'error');
      return;
    }

    exportToJSON('repair');
  }

  function exportToJSON(exportType) {
    console.log(`[Extractor] Exporting ${state.scannedPixels.length} pixels for ${exportType}...`);

    try {
      const filenameInput = state.ui?.querySelector('#pp-extractor-filename');
      let filename = filenameInput?.value?.trim() || '';

      if (!filename || filename === '.json') {
        // Match main tool naming convention
        filename = `patplacer-project-${Date.now()}.json`;
      } else if (!filename.endsWith('.json')) {
        filename += '.json';
      }

      const { x1, y1, width, height } = state.selectionArea;

      // Build PatPlacer v2 save format (same structure as main tool)
      const palette = [];
      const paletteMap = new Map();
      const getPaletteIdx = (r, g, b, a = 255) => {
        const key = `${r},${g},${b},${a}`;
        if (paletteMap.has(key)) return paletteMap.get(key);
        const idx = palette.length;
        palette.push([r, g, b, a]);
        paletteMap.set(key, idx);
        return idx;
      };

      // Compact pixels: [x, y, paletteIdx, wplaceColorIdx]
      const compactPixels = state.scannedPixels.map(p => ([
        p.x,
        p.y,
        getPaletteIdx(p.color.r, p.color.g, p.color.b, 255),
        p.color.id
      ]));

      const includeAnchor = exportType === 'repair';
      const anchor = includeAnchor
        ? {
          tile: { x: Math.floor(x1 / CONFIG.TILE_SIZE), y: Math.floor(y1 / CONFIG.TILE_SIZE) },
          pixel: {
            x: ((x1 % CONFIG.TILE_SIZE) + CONFIG.TILE_SIZE) % CONFIG.TILE_SIZE,
            y: ((y1 % CONFIG.TILE_SIZE) + CONFIG.TILE_SIZE) % CONFIG.TILE_SIZE
          }
        }
        : null;

      const saveData = {
        version: 2,
        savedAt: Date.now(),
        project: {
          name: exportType === 'repair' ? 'Extract (Repair)' : 'Extract (Copy)',
          anchor,
          paintingMode: 'linear'
        },
        processingSettings: {
          width,
          height,
          paintingMode: 'linear'
        },
        palette,
        pixels: compactPixels,
        progress: {
          placedCount: 0
        }
      };

      // Download
      const dataStr = JSON.stringify(saveData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(`[Extractor] Export complete: ${filename}`);

      if (exportType === 'repair') {
        showAlert(`âœ… Exported for REPAIR: ${state.scannedPixels.length} pixels with position`, 'success');
      } else {
        showAlert(`âœ… Exported for COPY: ${state.scannedPixels.length} pixels`, 'success');
      }

    } catch (error) {
      console.error('[Extractor] Export failed:', error);
      showAlert(`âŒ Export failed: ${error.message}`, 'error');
    }
  }

  // ============================================================
  // UI
  // ============================================================

  function createUI() {
    console.log('[Extractor] Creating UI...');

    // Remove existing
    const existing = document.getElementById('patplacer-extractor-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'patplacer-extractor-panel';

    const iconBase = (window.__PATPLACER_RESOURCES__ && window.__PATPLACER_RESOURCES__.iconsBaseUrl)
      ? window.__PATPLACER_RESOURCES__.iconsBaseUrl
      : 'icons/';

    panel.innerHTML = `
      <div class="pp-header" id="patplacer-extractor-header">
        <span class="pp-title">ART EXTRACTOR</span>
        <button class="pp-close-btn" id="patplacer-extractor-close">X</button>
      </div>

      <div class="pp-content" id="patplacer-extractor-content">

        <div class="pp-section">
          <div class="pp-section-title">
            <img src="${iconBase}target.png" class="pp-section-icon" alt="">Selection
          </div>
          <div class="pp-section-content">
            <div class="pp-upload-status" style="margin-bottom: 8px;">
              <span class="pp-status-badge pp-status-loaded" id="pp-extractor-status-badge">READY</span>
            </div>

            <div class="pp-info" style="margin-bottom: 10px;">
              <div class="pp-info-row">
                <span class="pp-info-label">Area</span>
                <span class="pp-info-value" id="pp-extractor-area">None</span>
              </div>
              <div class="pp-info-row">
                <span class="pp-info-label">Pixels</span>
                <span class="pp-info-value" id="pp-extractor-pixels">0</span>
              </div>
            </div>

            <div class="pp-btn-row">
              <button class="pp-btn pp-btn-small" id="pp-extractor-start"><img src="${iconBase}target.png" class="pp-btn-icon" alt="">Start</button>
              <button class="pp-btn pp-btn-small" id="pp-extractor-clear"><img src="${iconBase}trash.png" class="pp-btn-icon" alt="">Clear</button>
            </div>

            <div class="pp-info" id="pp-extractor-hint" style="margin-top: 6px; text-align: center;">
              Paint 2 pixels: upper-left then lower-right.
            </div>
          </div>
        </div>

        <div class="pp-section">
          <div class="pp-section-title">
            <img src="${iconBase}clipboard.png" onerror="this.onerror=null;this.src='${iconBase}folder.png';" class="pp-section-icon" alt="">Export
          </div>
          <div class="pp-section-content">
            <div class="pp-form-group">
              <label class="pp-label" for="pp-extractor-filename">Filename</label>
              <input type="text" class="pp-input" id="pp-extractor-filename" placeholder="artwork.json" value="">
            </div>

            <button class="pp-btn" id="pp-extractor-export-paste" disabled>
              <img src="${iconBase}clipboard.png" onerror="this.onerror=null;this.src='${iconBase}save.png';" class="pp-btn-icon" alt="">Export for Copy
            </button>
            <button class="pp-btn" id="pp-extractor-export-repair" disabled>
              <img src="${iconBase}repair.png" onerror="this.onerror=null;this.src='${iconBase}gear-pixel.png';" class="pp-btn-icon" alt="">Export for Repair
            </button>

            <div class="pp-info" style="margin-top: 10px;">
              <div class="pp-info-row">
                <span class="pp-info-label">Copy</span>
                <span class="pp-info-value">No location</span>
              </div>
              <div class="pp-info-row">
                <span class="pp-info-label">Repair</span>
                <span class="pp-info-value">With world coords</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="pp-status" id="pp-extractor-statusbar">
        <img src="${iconBase}scannerbot.png" onerror="this.onerror=null;this.src='${iconBase}monster.png';" class="pp-status-icon" alt="">
        <span id="pp-extractor-status">Ready for Extract</span>
      </div>
    `;

    document.body.appendChild(panel);
    state.ui = panel;
    panel.style.display = 'none';

    // Event listeners
    panel.querySelector('#patplacer-extractor-close').addEventListener('click', () => {
      state.ui.style.display = 'none';
    });
    panel.querySelector('#pp-extractor-start').addEventListener('click', startPixelCapture);
    panel.querySelector('#pp-extractor-clear').addEventListener('click', clearSelection);
    panel.querySelector('#pp-extractor-export-paste').addEventListener('click', exportForCopy);
    panel.querySelector('#pp-extractor-export-repair').addEventListener('click', exportForRepair);

    // Make draggable
    makeDraggable(panel);

    updateUI();
    console.log('[Extractor] UI created');
  }

  function updateUI() {
    if (!state.ui) return;

    const statusEl = state.ui.querySelector('#pp-extractor-status');
    const statusBadgeEl = state.ui.querySelector('#pp-extractor-status-badge');
    const areaEl = state.ui.querySelector('#pp-extractor-area');
    const pixelsEl = state.ui.querySelector('#pp-extractor-pixels');
    const exportCopyBtn = state.ui.querySelector('#pp-extractor-export-paste');
    const exportRepairBtn = state.ui.querySelector('#pp-extractor-export-repair');

    const statusBar = state.ui.querySelector('#pp-extractor-statusbar');

    function setBadge(text, className) {
      if (!statusBadgeEl) return;
      statusBadgeEl.textContent = text;
      statusBadgeEl.className = `pp-status-badge ${className || ''}`.trim();
    }

    function setStatusBar(text, tone) {
      if (statusEl) statusEl.textContent = text;
      if (!statusBar) return;
      statusBar.classList.remove('success', 'warning', 'error');
      if (tone) statusBar.classList.add(tone);
    }

    // Status
    if (state.isCapturing) {
      const msg = `Capturing (${state.capturedPixels.length}/${state.requiredPixels})`;
      setBadge('CAPTURING', 'pp-status-modified');
      setStatusBar(msg, 'warning');
    } else if (state.isScanning) {
      setBadge('SCANNING', 'pp-status-processed');
      setStatusBar('Scanning...', null);
    } else if (state.scannedPixels.length > 0) {
      setBadge('READY', 'pp-status-ready');
      setStatusBar('Ready for Extract', 'success');
    } else if (state.selectionArea) {
      setBadge('AREA SET', 'pp-status-loaded');
      setStatusBar('Area selected (auto extracting...)', null);
    } else {
      setBadge('READY', 'pp-status-loaded');
      setStatusBar('Ready for Extract', null);
    }

    // Area
    if (state.selectionArea) {
      areaEl.textContent = `${state.selectionArea.width}Ã—${state.selectionArea.height} px`;
    } else if (state.capturedPixels.length > 0) {
      areaEl.textContent = `${state.capturedPixels.length}/${state.requiredPixels} corners`;
    } else {
      areaEl.textContent = 'None';
    }

    // Pixels
    pixelsEl.textContent = state.scannedPixels.length.toLocaleString();

    // Export buttons
    const canExport = state.scannedPixels.length > 0;
    exportCopyBtn.disabled = !canExport;
    exportRepairBtn.disabled = !canExport;
  }

  function makeDraggable(element) {
    const header = element.querySelector('#patplacer-extractor-header') || element.querySelector('.pp-header');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      offsetX = e.clientX - element.getBoundingClientRect().left;
      offsetY = e.clientY - element.getBoundingClientRect().top;
      element.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      element.style.left = `${e.clientX - offsetX}px`;
      element.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      element.style.cursor = '';
    });
  }

  function togglePanel() {
    console.log('[Extractor] togglePanel called, state.ui:', !!state.ui, 'display:', state.ui?.style?.display);
    if (state.ui) {
      const isVisible = state.ui.style.display !== 'none';
      console.log('[Extractor] togglePanel toggling to:', isVisible ? 'none' : 'flex');
      state.ui.style.display = isVisible ? 'none' : 'flex';
      console.log('[Extractor] togglePanel done, display now:', state.ui.style.display);
    } else {
      console.log('[Extractor] togglePanel: state.ui is null!');
    }
  }

  function closeExtractor() {
    restoreFetch();
    if (state.ui) {
      state.ui.remove();
      state.ui = null;
    }
    window.PatPlacerExtractor = null;
    console.log('[Extractor] Closed');
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    console.log('[PatPlacer Extractor] Starting...');
    initColorPalette();
    createUI();
    
    // Expose API for toggle
    window.PatPlacerExtractor = {
      togglePanel,
      close: closeExtractor
    };
  }

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

