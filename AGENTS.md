# AGENTS.md — PatPlacer

Chrome Manifest V3 browser extension for overlaying pixel art templates on wplace.live.

## Architecture

```
Extension/                 ← load this folder as unpacked extension in chrome://extensions
├── manifest.json          ← MV3 entrypoint
├── background.js          ← service worker: loads tool scripts into page MAIN world on demand
├── content.js             ← content script: injects toolbar buttons into wplace.live UI
├── popup.html / popup.js  ← extension action popup (NOT referenced in manifest action)
├── scripts/
│   ├── patplacer-main.js  ← main UI panel, image upload, draft placement (~6500 lines)
│   ├── image-processor.js ← image resizing, dithering, color matching
│   ├── art-extractor.js   ← extracts pixel art from the wplace canvas
│   └── repair-tool.js     ← repairs/restores placed pixel art
└── styles/
    └── patplacer.css      ← all extension UI styles
```

## Key facts

- **No build step, no bundler, no package manager.** This is vanilla JS loaded as an unpacked extension. There is no `package.json`, no tests, no lint config.
- **Install:** Open `chrome://extensions` → Enable Developer mode → Load unpacked → select the `Extension/` directory.
- **After extension reload: reload the wplace.live tab.** The content script runs at `document_idle` and persists until the page refreshes. The background worker reloads, but scripts already injected into MAIN world stay stale until the tab is refreshed.
- **Only works on `wplace.live`.** The content script and host permissions are scoped to `*.wplace.live`.
- **Scripts run in MAIN world** (not content-script isolated world). The background.js service worker fetches tool scripts as text, creates Blob URLs, and injects `<script>` tags into the page. This means tool scripts share the page's `window` scope.
- **Lazy-loaded tools.** The content script injects three toolbar buttons (PatPlacer, Art Extractor, Repair Tool). Clicking one sends a message to the background worker, which injects the corresponding scripts on-demand. The main tool requires both `image-processor.js` and `patplacer-main.js` (order matters: processor first).

## Common agent mistakes to avoid

- **Don't add `"type": "module"` to manifest or assume ES module support.** Scripts are plain IIFEs injected as `<script>` tags.
- **Don't assume window globals in the content script carry over to the main tool scripts** — they run in different worlds. The main tool scripts run in MAIN world; content.js runs in the content script isolated world.
- **Don't add a `default_popup` in the manifest without careful consideration** — root-level `popup.html` and `popup.js` are not wired in the manifest's `action`.
- **The extension's `web_accessible_resources` lists `scripts/*.js`** but in practice, scripts are loaded via Blob URLs injected by the background worker, not fetched directly from the extension bundle.
- **`Patplacer.zip`** in the Extension folder is a distribution artifact. Don't modify it inline; rebuild if needed.
- **Progress saves at placement time, not paint-confirmation time.** wplace's Paint button uses an opaque API (not `fetch`, `XMLHttpRequest`, or `sendBeacon`), so it cannot be intercepted from MAIN world. Progress is saved to IndexedDB immediately after drafts are pushed to wplace's draft Map in `placeNextBatch()`.
- **IndexedDB key schema:** `PatPlacerDB` v2 uses out-of-line keys. If the store was created with v1 (in-line keys), `onupgradeneeded` drops and recreates it. Any agent touching the `IDB` module must bump `DB_VERSION` on schema changes.

## Userscript build (`build-userscript.cjs`)

`node build-userscript.cjs` produces `patplacer.user.js` — a self-contained Tampermonkey/Greasemonkey userscript. It has **zero npm dependencies** (only built-in `fs` and `path`).

**How it works:**
1. Reads source files from `Extension/` (4 JS tool scripts, `patplacer.css`, functional `.png` icons).
2. Base64-encodes icon PNGs into `data:` URIs stored in an in-memory map. Aesthetic/decorative icons (alien, dragon, wizard, etc.) are excluded.
3. Transforms JS icon path references — replaces `ICON_BASE`/`iconBase` variable declarations with `""`, and rewrites `` `${iconBase}name.png` `` patterns to `__PP_ICON('name.png')` calls. The runtime `__PP_ICON` function looks up the pre-embedded base64 map.
4. Assembles a single IIFE with the Tampermonkey metadata block, an inline icon-injection `<script>` tag, CSS via `GM_addStyle()`, all 4 tool scripts injected into MAIN world, and the button-injection logic (from `content.js`) with a `MutationObserver`.

**Why no external resources:** Everything is inlined — CSS is escaped as a JS string literal, JS sources are embedded as script tags, icons are base64 data URIs, SVG button icons are inline strings. No network requests, no CDN, no `npm install`.
