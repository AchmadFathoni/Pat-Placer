# AGENTS.md — PatPlacer

Chrome Manifest V3 browser extension for overlaying pixel art templates on wplace.live.

## Architecture

```
Extension/                 ← load this folder as unpacked extension in chrome://extensions
├── manifest.json          ← MV3 entrypoint
├── background.js          ← service worker: loads tool scripts into page MAIN world on demand
├── content.js             ← content script: injects toolbar buttons into wplace.live UI
├── content-script.js      ← IDENTICAL copy of content.js (only content.js is in manifest)
├── popup.html / popup.js  ← extension action popup (NOT referenced in manifest action yet)
├── scripts/
│   ├── patplacer-main.js  ← main UI panel, image upload, draft placement (~6200 lines)
│   ├── image-processor.js ← image resizing, dithering, color matching
│   ├── art-extractor.js   ← extracts pixel art from the wplace canvas
│   └── repair-tool.js     ← repairs/restores placed pixel art
├── styles/
│   └── patplacer.css      ← all extension UI styles
└── popup/                 ← alternate popup (not wired in manifest)
```

## Key facts

- **No build step, no bundler, no package manager.** This is vanilla JS loaded as an unpacked extension. There is no `package.json`, no tests, no lint config.
- **Install:** Open `chrome://extensions` → Enable Developer mode → Load unpacked → select the `Extension/` directory.
- **After extension reload: reload the wplace.live tab.** The content script runs at `document_idle` and persists until the page refreshes. The background worker reloads, but scripts already injected into MAIN world stay stale until the tab is refreshed.
- **Only works on `wplace.live`.** The content script and host permissions are scoped to `*.wplace.live`.
- **Scripts run in MAIN world** (not content-script isolated world). The background.js service worker fetches tool scripts as text, creates Blob URLs, and injects `<script>` tags into the page. This means tool scripts share the page's `window` scope.
- **Lazy-loaded tools.** The content script injects three toolbar buttons (PatPlacer, Art Extractor, Repair Tool). Clicking one sends a message to the background worker, which injects the corresponding scripts on-demand. The main tool requires both `image-processor.js` and `patplacer-main.js` (order matters: processor first).
- **`content-script.js` is a stale duplicate of `content.js`.** Only `content.js` is registered in `manifest.json`. If you change one, change both or delete the stale copy.

## Common agent mistakes to avoid

- **Don't add `"type": "module"` to manifest or assume ES module support.** Scripts are plain IIFEs injected as `<script>` tags.
- **Don't assume window globals in the content script carry over to the main tool scripts** — they run in different worlds. The main tool scripts run in MAIN world; content.js runs in the content script isolated world.
- **Don't change `content.js` without checking `content-script.js`** (or better, delete the stale copy).
- **Don't add a `default_popup` in the manifest without deciding which popup variant to use** — root-level `popup.html` and `popup/popup.html` are different implementations.
- **The extension's `web_accessible_resources` lists `scripts/*.js`** but in practice, scripts are loaded via Blob URLs injected by the background worker, not fetched directly from the extension bundle.
- **`Patplacer.zip`** in the Extension folder is a distribution artifact. Don't modify it inline; rebuild if needed.
- **Progress saves at placement time, not paint-confirmation time.** wplace's Paint button uses an opaque API (not `fetch`, `XMLHttpRequest`, or `sendBeacon`), so it cannot be intercepted from MAIN world. Progress is saved to IndexedDB immediately after drafts are pushed to wplace's draft Map in `placeNextBatch()`.
- **IndexedDB key schema:** `PatPlacerDB` v2 uses out-of-line keys. If the store was created with v1 (in-line keys), `onupgradeneeded` drops and recreates it. Any agent touching the `IDB` module must bump `DB_VERSION` on schema changes.
