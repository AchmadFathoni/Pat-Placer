# PatPlacer OpenSource Extension

This folder is a fully standalone Chrome extension build of PatPlacer.

## What this build does
- Runs directly from local extension files.
- Does not require online activation or patplacer.dev session validation.
- Does not require extension popup/menu interaction.
- Injects local assets:
   - `styles/patplacer.css`
   - `scripts/image-processor.js`
   - `scripts/patplacer-main.js`

## Install (Developer mode)
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `opensource version`.

## Use
1. Open `https://wplace.live`.
2. Click the PatPlacer sidebar button injected into the wplace UI.

## Notes
- Main script runs in page context (MAIN world) so draft hooks and map logic work.
