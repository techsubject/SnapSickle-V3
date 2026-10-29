# SnapSickle Grid Snap

![SnapSickle logo](logo.svg)

SnapSickle adds adjustable X/Z and Y placement snapping plus a custom rotation step to DashCraft's track editor. The grid spacing and vertical placement plane follow the selected settings, so blocks can be positioned at higher Y levels while remaining aligned to the mouse.

**Current build:** v3.0.0 (extension version 3.0.0)

## Features

- Set horizontal X/Z snap spacing and vertical Y spacing from 1 to 30 units.
- Keep the visible grid footprint steady while its cell spacing follows the X/Z setting.
- Match the placement plane, object levels, and camera level spacing to the selected Y step.
- Set the angle applied by each rotate action from 1° to 359° (default 90°).
- Keep DashCraft's original cursor raycast and movement behavior.
- See whether the WASM patch was applied or why it could not be applied.

## Install in Chrome or Edge

1. Download this repository as a ZIP: select **Code → Download ZIP** on GitHub.
2. Extract the ZIP to a folder that you will keep on your computer.
3. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
4. Turn on **Developer mode**.
5. Select **Load unpacked**.
6. Choose the extracted repository folder containing `manifest.json`.
7. Make sure SnapSickle is enabled, then reload DashCraft.

Keep the extracted folder in place while the extension is installed. After downloading an updated version, load its folder and disable the older copy so only one SnapSickle build runs.

## Use

1. Open [DashCraft](https://dashcraft.io/) and enter the track editor.
2. Press **Ctrl** to open or close the SnapSickle panel.
3. Adjust **X/Z snap spacing**, **Y snap spacing**, and **Rotation step**.
4. Save your track, then reload DashCraft completely. The WASM settings apply when the game loads; slider changes do not alter an already-running game instance.
5. Reopen the editor and check the panel status. It should show **WASM patch active** and the selected values.

The setting is a spacing interval. For example, a Y step of 5 allows levels at 0, 5, 10, 15, and so on; it does not move every object to Y=5.

## Troubleshooting

### The panel does not appear

- Confirm that the loaded folder contains `manifest.json`.
- Confirm that Developer mode is enabled and SnapSickle is enabled.
- Reload DashCraft and press **Ctrl** while the editor is open.
- Disable any other SnapSickle copy to avoid competing WASM hooks.

### The panel says it is waiting for WASM

Wait for DashCraft to finish loading, then reload the page. If it still waits, the game's WASM filename may have changed; check the browser console for the patch status.

### The panel reports a build mismatch or patch failure

The patch is tied to the DashCraft WASM build this version was made for. A changed game build may require updated WASM offsets. Do not replace the original DashCraft files; report the exact status and console error.

### A setting does not take effect

Save the track and perform a full page reload after changing a slider. The panel status confirms the selected rotation step in the WASM patch; it does not report the rotation of individual placed objects.

## Permissions and data

SnapSickle runs on `https://dashcraft.io/*` and uses the browser's local extension storage for its settings. It modifies the WASM response in memory as DashCraft loads it; it does not overwrite the game's downloaded files. The extension does not send slider settings to a SnapSickle server.

## Development

This is an unpacked Manifest V3 browser extension. Its entry points are `main.js` (the page-world WASM hook) and `content.js` (the settings panel). The panel and README use the included `logo.svg`; the extension toolbar uses the included 16, 32, 48, and 128 pixel PNG icons. Load this repository's root folder through the browser's **Load unpacked** control for local development.

## Version

- Manifest version: `3.0.0`
- In-panel label: `v3.0.0`
