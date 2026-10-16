# OmniStream Pro — Chrome Extension

<div align="center">
  <img src="icons/icon128.png" alt="OmniStream Pro Logo" width="96" height="96">
  <br><br>
  <strong>Universal HLS / M3U8 Stream Sniffer & Downloader for Google Chrome</strong>
  <br><br>
  <a href="https://github.com/Xmon4u/OmniStream-Pro-Chrome-Extension/releases/latest"><img src="https://img.shields.io/badge/Release-v1.0.0-6366f1?style=for-the-badge&logo=github" alt="Release"></a>
  <a href="https://developer.chrome.com/docs/extensions/mv3/intro/"><img src="https://img.shields.io/badge/Manifest-V3-38bdf8?style=for-the-badge&logo=google-chrome" alt="Manifest V3"></a>
  <a href="https://github.com/Xmon4u/OmniStream-Pro-MultiAudio-Video-Downloader"><img src="https://img.shields.io/badge/Desktop%20Bridge-OmniStream%20Pro-10b981?style=for-the-badge" alt="Desktop Bridge"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge" alt="MIT License"></a>
</div>

---

## Overview

**OmniStream Pro** is a Google Chrome extension (Manifest V3) that detects, captures, and extracts `.m3u8` HLS video streams from any website.

It uses a strict 3-layer filter that automatically blocks noise (JSON, PHP, HTML, CSS, JavaScript, TS video segments, ads, analytics) and surfaces only pure, playable `.m3u8` master and variant playlists.

---

## Key Features

- **Pure `.m3u8` Detection**: Captures authentic HLS playlist URLs with clean filename displays (e.g., `1080p.m3u8`, `master.m3u8`).
- **God Mode Deep Scanner**: Bypasses player restrictions, deep-scans the DOM, injects player hooks, and uncovers hidden or obfuscated streams.
- **Anti-DevTools / F12 Unblocker**: Disables anti-debugging traps, re-enables right-click, context menus, and Developer Tools shortcuts.
- **One-Click Browser Download**: Save the `.m3u8` playlist file directly via Chrome's download manager.
- **Copy cURL with Headers**: Copies a terminal-ready `curl` command including all session cookies, User-Agent, and Referer headers.
- **Download Queue**: Queue multiple detected streams and batch-process them.
- **OmniStream Pro Desktop Bridge**: Connects directly to the [OmniStream Pro Desktop Application](https://github.com/Xmon4u/OmniStream-Pro-MultiAudio-Video-Downloader) (`localhost:28795`) for 16x parallel segment downloads and multi-audio MKV muxing.

---

## Installation (Load Unpacked)

> No Chrome Web Store required. Install directly using Chrome's Developer Mode.

### Step 1 — Download Release
1. Go to [GitHub Releases](https://github.com/Xmon4u/OmniStream-Pro-Chrome-Extension/releases/latest).
2. Download **`OmniStream-Pro-Chrome-Extension-v1.0.0.zip`**.

### Step 2 — Extract the ZIP
1. Right-click the downloaded `.zip` file → **Extract All...**
2. Choose a permanent directory (e.g., `C:\Extensions\OmniStream-Pro-Chrome-Extension`).

> **Note:** Do not delete or move this folder after installing, as Chrome loads the extension directly from it.

### Step 3 — Load in Google Chrome
1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the extracted folder containing `manifest.json`.
5. Click **Select Folder**.

Pin the extension icon to your Chrome toolbar for quick access.

---

## How to Use

### 1. Automatic Stream Detection
1. Navigate to any website with a video or live stream.
2. Start playing the video.
3. Click the **OmniStream Pro** icon in your Chrome toolbar.
4. The **Streams** tab will list all detected `.m3u8` playlist URLs.

### 2. God Mode Scanner
If a website delays stream loading or hides its player source:
1. Open the OmniStream Pro popup.
2. Click **Activate God Mode Scan**.
3. God Mode will inspect video elements, scan inline scripts, and hook fetch/XHR calls. Any discovered `.m3u8` streams will appear in your stream list.

### 3. Action Buttons
For each detected stream:
- **Download**: Downloads the `.m3u8` file to your computer.
- **+ Queue**: Adds the stream to your batch queue tab.
- **Send to App**: Forwards the URL and all request headers to the OmniStream Pro Desktop Application for multi-track audio downloading and MKV muxing.
- **Copy cURL**: Copies the complete cURL command with request headers to your clipboard for use with `ffmpeg` or `N_m3u8DL-RE`.

---

## Desktop Application Integration

OmniStream Pro Extension integrates with the **OmniStream Pro Desktop** application:

- **Repository**: [OmniStream-Pro-MultiAudio-Video-Downloader](https://github.com/Xmon4u/OmniStream-Pro-MultiAudio-Video-Downloader)
- **Local Port**: `http://127.0.0.1:28795`

When the desktop app is running, the **Bridge** indicator turns green (`Connected`). Clicking **Send to App** or **Send All** forwards streams directly to the desktop engine for high-speed download with all audio tracks preserved.

---

## 3-Layer M3U8 Filtering Architecture

```
[ Web Traffic ]
       │
       ▼
1. background.js (webRequest)   ──▶  Strict pathname regex (/\.m3u8$/i)
       │
       ▼
2. godmode.js (DOM & API Sniffer)──▶  Strict isM3U8Only() filter
       │
       ▼
3. popup.js (UI Renderer)       ──▶  UI safety check & filename extractor
       │
       ▼
[ Pure .m3u8 Streams Displayed in UI ]
```

**Filtered Out**: `.json`, `.php`, `.html`, `.js`, `.css`, `.ts` (video segments), ad networks, tracking beacons, and analytics.

---

## Project Structure

```
omnistream_extension/
├── manifest.json       # Chrome Manifest V3 configuration
├── background.js       # Background service worker (network sniffer & desktop bridge)
├── content.js          # Content script bridge for web pages
├── godmode.js          # Injected MAIN-world scanner & DevTools unblocker
├── popup.html          # Extension popup user interface
├── popup.css           # Modern dark-mode UI styling
├── popup.js            # Popup controller, UI events, and queue manager
├── icons/              # Extension icons (16px, 32px, 48px, 128px)
├── LICENSE             # MIT License
└── README.md           # Documentation & instructions
```

---

## Author

**XMON4U** — [GitHub: @Xmon4u](https://github.com/Xmon4u)

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
