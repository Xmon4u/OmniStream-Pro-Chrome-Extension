# OmniStream Pro — Browser Extension

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](manifest.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Browser-Chrome%20%7C%20Edge%20%7C%20Brave-orange.svg)](https://github.com/Xmon4u/OmniStream-Pro-Chrome-Extension)

A Chromium browser extension (Manifest V3) designed to detect and capture HLS (`.m3u8`) streaming playlists from web pages and send them directly to the OmniStream Pro desktop downloader.

## Features

- **Network Stream Sniffing**: Intercepts web traffic to identify valid `.m3u8` master and variant playlists while filtering out unrelated requests (chunks, scripts, tracking pixels).
- **Deep DOM Scanner**: Injects player inspection hooks to locate video sources dynamically generated or hidden by JavaScript players.
- **Debugger & Context Menu Restoration**: Temporarily bypasses anti-debugging loops and re-enables right-click and Developer Tools shortcuts on restricted sites.
- **Desktop Application Bridge**: Connects over a local HTTP socket (`http://127.0.0.1:28795`) to transfer stream URLs and request headers directly to the [OmniStream Pro Desktop](https://github.com/Xmon4u/OmniStream-Pro-v2) queue.
- **cURL Exporter**: Generates terminal-ready `curl` commands including current session cookies, User-Agent, and Referer headers for use in command-line downloaders.
- **Stream Queue**: Collect multiple detected playlist URLs to export or transfer in a single batch.

## Installation (Developer Mode)

Because this extension uses private localhost bridge permissions and page script hooks, install it unpacked via Developer Mode:

### 1. Download or Clone
```bash
git clone https://github.com/Xmon4u/OmniStream-Pro-Chrome-Extension.git
```
*(Or download the ZIP from [Releases](https://github.com/Xmon4u/OmniStream-Pro-Chrome-Extension/releases) and extract it to a permanent folder).*

### 2. Load into Chrome / Edge / Brave
1. Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the folder containing `manifest.json`.
5. Pin the OmniStream icon to your browser toolbar for easy access.

## How to Use

### Basic Stream Capture
1. Open any web page with an active video stream and press play.
2. Click the **OmniStream Pro** icon on your toolbar.
3. The popup displays all captured `.m3u8` playlists.
4. Choose an action:
   - **Send to App**: Sends the stream URL and headers to OmniStream Desktop.
   - **Download**: Downloads the `.m3u8` manifest file directly through the browser.
   - **Copy cURL**: Copies a complete terminal command with authentication headers.
   - **+ Queue**: Adds the link to your queue tab for batch handling.

### Deep Scan Mode
If a website delays stream loading or prevents standard network detection:
1. Open the OmniStream popup.
2. Click **Activate Deep Scan**.
3. The scanner inspects DOM `<video>` tags and monitors runtime fetch/XHR calls. Any newly uncovered playlists will appear in the stream list.

## Desktop Bridge Integration

The extension communicates with the OmniStream Pro desktop app over local port `28795`:
- **Bridge Endpoint**: `http://127.0.0.1:28795/add` and `/batch_add`
- When the desktop app is open, the bridge status shows **Connected** in the popup. Clicking **Send to App** or **Send All** forwards links and headers directly to the desktop queue.

## Project Structure

```text
OmniStream-Pro-Chrome-Extension/
├── manifest.json       # Manifest V3 extension configuration
├── background.js       # Background service worker (request listener & bridge)
├── content.js          # Content script injector
├── godmode.js          # Page-world script inspection & debugging helper
├── popup.html          # Extension popup UI
├── popup.css           # Popup dark stylesheet
├── popup.js            # Popup event handling & queue controller
├── icons/              # Extension icons (16, 32, 48, 128px)
└── README.md
```

## License

This project is licensed under the [MIT License](LICENSE).
