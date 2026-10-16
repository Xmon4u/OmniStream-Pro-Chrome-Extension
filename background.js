// OmniStream Pro — Background Service Worker
// Captures ONLY genuine .m3u8 / HLS playlist URLs.

const tabMediaMap = new Map(); // tabId -> MediaItem[]

// ── Strict M3U8-only filter ────────────────────────────────────────────────
// Matches the path/query portion of a URL that is a real HLS playlist.
// Deliberately excludes: .ts segments, .json, .php, .html, manifest.json,
// CSS, JS, images, analytics endpoints, and ad-network calls.
const M3U8_URL_REGEX = /\.m3u8(\?|$|#)/i;
const M3U8_MIME_TYPES = [
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl'
];

// Blocklist — URL substrings that should NEVER appear in the detected list
// Note: patterns are matched against the FULL URL, but ONLY after isM3U8Url() passes,
// so ".js" here refers to non-playlist JS files, not .m3u8 URLs that happen to have
// ".js" somewhere in a path segment.
const BLOCK_PATTERNS = [
  'google-analytics', '/analytics', 'doubleclick', 'googlesyndication',
  'facebook.com', '/beacon', 'segment.io', 'hotjar', 'newrelic',
  '/ads/', 'prebid', 'moatads', 'scorecardresearch'
];

function isDuplicate(list, url) {
  return list.some(item => item.url === url || item.url.split('?')[0] === url.split('?')[0]);
}

function generateCurl(details) {
  let curl = `curl "${details.url}"`;
  if (details.requestHeaders) {
    for (const h of details.requestHeaders) {
      const name = h.name.toLowerCase();
      if (['host', 'content-length', 'connection', 'accept-encoding'].includes(name)) continue;
      const val = (h.value || '').replace(/"/g, '\\"');
      curl += ` \\\n  -H "${h.name}: ${val}"`;
    }
  }
  return curl;
}

function isBlocklisted(url) {
  const lo = url.toLowerCase();
  return BLOCK_PATTERNS.some(p => lo.includes(p));
}

function isM3U8Url(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    // Extract only the pathname (no query/hash) for the extension check
    const pathname = new URL(url).pathname;
    return /\.m3u8$/i.test(pathname);
  } catch {
    // Fallback for relative or malformed URLs
    const pathPart = url.split('?')[0].split('#')[0];
    return /\.m3u8$/i.test(pathPart);
  }
}

function detectType(url, mime) {
  // All URLs reaching here are already validated as m3u8
  return 'HLS (M3U8)';
}

function updateBadge(tabId) {
  if (tabId < 0) return;
  const list = tabMediaMap.get(tabId) || [];
  const count = list.length;
  if (count > 0) {
    chrome.action.setBadgeText({ tabId, text: count > 99 ? '99+' : String(count) });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#6366f1' }); // OmniStream Pro Indigo
    chrome.action.setBadgeTextColor({ tabId, color: '#f8fafc' });
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
}

// ── Request interceptor — only .m3u8 URLs ─────────────────────────────────
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const url = details.url;

    // Must match m3u8 AND not be blocklisted
    if (!isM3U8Url(url) || isBlocklisted(url)) return;

    if (!tabMediaMap.has(details.tabId)) tabMediaMap.set(details.tabId, []);
    const mediaList = tabMediaMap.get(details.tabId);
    if (isDuplicate(mediaList, url)) return;

    const headersObj = {};
    if (details.requestHeaders) {
      for (const h of details.requestHeaders) {
        headersObj[h.name.toLowerCase()] = h.value;
      }
    }

    const mediaItem = {
      id: 'stream_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      url,
      type: 'HLS (M3U8)',
      headers: headersObj,
      referer: headersObj['referer'] || details.initiator || '',
      origin: headersObj['origin'] || '',
      userAgent: headersObj['user-agent'] || '',
      curl: generateCurl(details),
      title: '',
      timestamp: Date.now(),
      tabId: details.tabId
    };

    chrome.tabs.get(details.tabId, (tab) => {
      if (!chrome.runtime.lastError && tab) {
        mediaItem.title = tab.title || '';
        mediaItem.domain = new URL(tab.url || url).hostname;
      }
      mediaList.push(mediaItem);
      updateBadge(details.tabId);
      chrome.storage.local.set({ [`omni_tab_${details.tabId}`]: mediaList });
    });
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders', 'extraHeaders']
);

// ── Response interceptor — catch m3u8 by MIME type ───────────────────────
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const url = details.url;
    if (isBlocklisted(url)) return;

    const respHeaders = details.responseHeaders || [];
    let contentType = '';
    let contentLength = 0;

    for (const h of respHeaders) {
      const name = h.name.toLowerCase();
      if (name === 'content-type')  contentType   = h.value || '';
      if (name === 'content-length') contentLength = parseInt(h.value || '0', 10);
    }

    const isM3U8Mime = M3U8_MIME_TYPES.some(m => contentType.toLowerCase().includes(m));
    // Also catch URLs that end in .m3u8 regardless of mime
    if (!isM3U8Mime && !isM3U8Url(url)) return;

    if (!tabMediaMap.has(details.tabId)) tabMediaMap.set(details.tabId, []);
    const mediaList = tabMediaMap.get(details.tabId);
    if (isDuplicate(mediaList, url)) return;

    const mediaItem = {
      id: 'stream_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      url,
      type: 'HLS (M3U8)',
      mime: contentType,
      size: contentLength,
      curl: `curl "${url}"`,
      timestamp: Date.now(),
      tabId: details.tabId
    };

    chrome.tabs.get(details.tabId, (tab) => {
      if (!chrome.runtime.lastError && tab) {
        mediaItem.title = tab.title || '';
        mediaItem.domain = new URL(tab.url || url).hostname;
      }
      mediaList.push(mediaItem);
      updateBadge(details.tabId);
      chrome.storage.local.set({ [`omni_tab_${details.tabId}`]: mediaList });
    });
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders', 'extraHeaders']
);

chrome.tabs.onRemoved.addListener((tabId) => {
  tabMediaMap.delete(tabId);
  chrome.storage.local.remove([`omni_tab_${tabId}`]);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  updateBadge(activeInfo.tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_TAB_MEDIA') {
    const tabId = message.tabId;
    chrome.storage.local.get([`omni_tab_${tabId}`], (res) => {
      const list = res[`omni_tab_${tabId}`] || tabMediaMap.get(tabId) || [];
      sendResponse({ success: true, list });
    });
    return true;
  }

  if (message.action === 'CLEAR_TAB_MEDIA') {
    const tabId = message.tabId;
    tabMediaMap.set(tabId, []);
    chrome.storage.local.remove([`omni_tab_${tabId}`], () => {
      updateBadge(tabId);
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'GODMODE_MEDIA_CAPTURED') {
    // God Mode also only stores genuine .m3u8 URLs
    const tabId = sender.tab ? sender.tab.id : message.tabId;
    const url = message.url || '';

    if (tabId && url && isM3U8Url(url) && !isBlocklisted(url)) {
      if (!tabMediaMap.has(tabId)) tabMediaMap.set(tabId, []);
      const mediaList = tabMediaMap.get(tabId);

      if (!isDuplicate(mediaList, url)) {
        const tabUrl = sender.tab ? sender.tab.url : '';
        const mediaItem = {
          id: 'stream_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          url,
          type: 'HLS (M3U8)',
          curl: `curl "${url}" \\\n  -H "Referer: ${tabUrl}"`,
          title: message.title || (sender.tab ? sender.tab.title : ''),
          domain: tabUrl ? new URL(tabUrl).hostname : '',
          isGodMode: true,
          timestamp: Date.now(),
          tabId
        };
        mediaList.push(mediaItem);
        updateBadge(tabId);
        chrome.storage.local.set({ [`omni_tab_${tabId}`]: mediaList });
      }
    }
    sendResponse({ success: true });
    return true;
  }

  // Send to OmniStream Pro desktop bridge on localhost:28795
  if (message.action === 'SEND_TO_OMNISTREAM') {
    const bridgeUrl = 'http://127.0.0.1:28795/add';
    fetch(bridgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.data)
    })
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => {
        sendResponse({
          success: false,
          error: 'OmniStream Pro desktop application is not running or bridge port 28795 is unreachable.'
        });
      });
    return true;
  }

  // Check OmniStream Pro Desktop Bridge
  if (message.action === 'CHECK_OMNISTREAM_BRIDGE') {
    fetch('http://127.0.0.1:28795/health', { method: 'GET' })
      .then(res => res.json())
      .then(data => sendResponse({ connected: true, data }))
      .catch(() => sendResponse({ connected: false }));
    return true;
  }

  // Browser download
  if (message.action === 'DOWNLOAD_FILE') {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename || undefined,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId });
      }
    });
    return true;
  }
});
