# PatPlacer — Firefox

Browser extension for overlaying pixel art templates on [wplace.live](https://wplace.live).

## Install (temporary — development)

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `Extension/manifest.json`

The addon unloads when Firefox restarts. Repeat these steps after each restart.

## Install (permanent — signed)

For a permanent install that survives browser restarts:

1. Sign the extension at [Mozilla Add-on Developer Hub](https://addons.mozilla.org/developers/)
2. Download the signed `.xpi`
3. In Firefox: Menu → Add-ons and Themes → gear icon → Install Add-on From File → select the `.xpi`

## Requirements

- **Firefox 128 or later** — the extension uses `world: 'MAIN'` in `scripting.executeScript()` to inject scripts into the page context. This API requires Firefox 128+.
- Visit `about:config` and ensure `extensions.manifestV3.enabled` is `true` (default since Firefox 109).

## Differences from Chrome

| Feature | Chrome | Firefox |
|---------|--------|---------|
| Install | `chrome://extensions` → Load unpacked | `about:debugging` → Load Temporary Add-on |
| `unlimitedStorage` permission | Needed for >10 MB storage | Ignored — storage is unlimited by default |
| `cookies` permission | Was declared (now removed) | Removed — never used by code |
| Persistent install | Unpacked persists across restarts | Temporary addon unloads on restart |
| Service worker lifecycle | Persistent-ish | Aggressively terminated, auto-restarted |

## Troubleshooting

**Addon doesn't appear on wplace.live:** Reload the wplace.live tab after loading/updating the addon. The content script runs at page load and persists — a running tab has the old scripts.

**World 'MAIN' not supported:** Update Firefox to version 128 or later.

**Progress not saving:** Check the browser console (Ctrl+Shift+J) for `[PatPlacer]` logs. Common issues are stale IndexedDB from a Chrome session — click **Delete** in the PatPlacer panel and place a fresh batch.
