// OmniStream Pro — Popup Script v2

let currentTabId   = null;
let currentTabUrl  = '';
let currentTabHost = '';
let detectedStreams = [];
let downloadQueue   = [];

/* ── DOM refs ─────────────────────────────────────────── */
const $dom = id => document.getElementById(id);
const currentDomainEl   = $dom('currentDomain');
const bridgeStatusEl    = $dom('bridgeStatus');
const bridgeTextStatusEl= $dom('bridgeTextStatus');
const godModeBtn        = $dom('godModeBtn');
const godBtnText        = $dom('godBtnText');
const detectedCountEl   = $dom('detectedCount');
const queueCountEl      = $dom('queueCount');
const detectedListEl    = $dom('detectedList');
const queueListEl       = $dom('queueList');
const clearDetectedBtn  = $dom('clearDetectedBtn');
const clearQueueBtn     = $dom('clearQueueBtn');
const sendAllBtn        = $dom('sendAllToDesktopBtn');
const recheckBridgeBtn  = $dom('recheckBridgeBtn');
const toastEl           = $dom('toast');

/* ── SVG icons ────────────────────────────────────────── */
const ICONS = {
  download:  `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  queue:     `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  desktop:   `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  curl:      `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  send:      `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  remove:    `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  trash:     `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`
};

/* ── Helpers ──────────────────────────────────────────── */
let _toastTimer = null;
function showToast(text, ms = 2400) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

/**
 * Extract the clean filename from a URL path.
 * e.g. https://cdn.example.com/hls/1080p.m3u8?token=xxx → "1080p.m3u8"
 */
function extractFilename(url) {
  try {
    const pathname = new URL(url).pathname;
    const seg = pathname.split('/').filter(Boolean);
    const last = seg[seg.length - 1] || '';
    return last || 'stream';
  } catch {
    const idx = url.lastIndexOf('/');
    const raw = url.substring(idx + 1).split('?')[0];
    return raw || 'stream';
  }
}

/**
 * Returns true only for genuine .m3u8 playlist URLs.
 * UI-side safety net — matches the same logic as background.js.
 */
function isM3U8(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    return /\.m3u8$/i.test(new URL(url).pathname);
  } catch {
    return /\.m3u8$/i.test(url.split('?')[0].split('#')[0]);
  }
}

/**
 * Determine the CSS tag class — all streams here are HLS.
 */
function typeTag(typeStr) {
  return { cls: 'tag-hls', label: 'HLS' };
}

function copyText(text, msg = 'Copied to clipboard') {
  navigator.clipboard.writeText(text).then(() => showToast(msg)).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast(msg);
  });
}

/* ── Init ─────────────────────────────────────────────── */
async function init() {
  setupTabs();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    currentTabId  = tab.id;
    currentTabUrl = tab.url || '';
    try {
      const u = new URL(currentTabUrl);
      currentTabHost = u.hostname;
      currentDomainEl.textContent = u.hostname;
    } catch {
      currentDomainEl.textContent = 'Active Tab';
    }
    loadDetectedStreams();
  }

  loadDownloadQueue();
  checkBridge();
}

function setupTabs() {
  const btns  = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.tab-pane');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b  => b.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = document.getElementById(btn.dataset.tab);
      if (pane) pane.classList.add('active');
    });
  });
}

/* ── Data loading ─────────────────────────────────────── */
function loadDetectedStreams() {
  if (!currentTabId) return;
  chrome.runtime.sendMessage({ action: 'GET_TAB_MEDIA', tabId: currentTabId }, res => {
    if (res && res.success) {
      detectedStreams = res.list || [];
      renderDetected();
    }
  });
}

function loadDownloadQueue() {
  chrome.storage.local.get(['omnistream_download_queue'], res => {
    downloadQueue = res.omnistream_download_queue || [];
    renderQueue();
  });
}

function saveQueue() {
  chrome.storage.local.set({ omnistream_download_queue: downloadQueue }, renderQueue);
}

function checkBridge() {
  chrome.runtime.sendMessage({ action: 'CHECK_OMNISTREAM_BRIDGE' }, res => {
    if (res && res.connected) {
      bridgeStatusEl.classList.add('connected');
      bridgeTextStatusEl.textContent = 'Connected (v' + (res.data?.version || '1.0') + ')';
      bridgeTextStatusEl.className = 'status-online';
    } else {
      bridgeStatusEl.classList.remove('connected');
      bridgeTextStatusEl.textContent = 'Disconnected';
      bridgeTextStatusEl.className = 'status-offline';
    }
  });
}

/* ── Empty state HTML ─────────────────────────────────── */
function emptyHTML(title, hint) {
  return `<div class="empty-state">
    <div class="empty-graphic">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#2a3a55" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="3"/>
        <line x1="7"  y1="2"  x2="7"  y2="22"/>
        <line x1="17" y1="2"  x2="17" y2="22"/>
        <line x1="2"  y1="12" x2="22" y2="12"/>
        <line x1="2"  y1="7"  x2="7"  y2="7"/>
        <line x1="2"  y1="17" x2="7"  y2="17"/>
        <line x1="17" y1="17" x2="22" y2="17"/>
        <line x1="17" y1="7"  x2="22" y2="7"/>
      </svg>
    </div>
    <div class="empty-title">${title}</div>
    <div class="empty-hint">${hint}</div>
  </div>`;
}

/* ── Render: Detected Streams ─────────────────────────── */
function renderDetected() {
  // UI-side safety filter: only genuine .m3u8 URLs
  const m3u8Streams = detectedStreams.filter(item => isM3U8(item.url));
  detectedCountEl.textContent = m3u8Streams.length;

  if (m3u8Streams.length === 0) {
    detectedListEl.innerHTML = emptyHTML(
      'No .m3u8 streams detected yet',
      'Play a video on the page, or click <strong>ACTIVATE GOD MODE SCAN</strong> above.'
    );
    return;
  }

  detectedListEl.innerHTML = '';
  m3u8Streams.forEach(item => {
    const card = buildStreamCard(item, false);
    detectedListEl.appendChild(card);
  });
}

/* ── Render: Download Queue ───────────────────────────── */
function renderQueue() {
  queueCountEl.textContent = downloadQueue.length;

  if (downloadQueue.length === 0) {
    queueListEl.innerHTML = emptyHTML(
      'Download queue is empty',
      'Click <strong>+ Queue</strong> on any detected stream to batch them here.'
    );
    return;
  }

  queueListEl.innerHTML = '';
  downloadQueue.forEach((item, idx) => {
    const card = buildStreamCard(item, true, idx);
    queueListEl.appendChild(card);
  });
}

/* ── Build stream card ────────────────────────────────── */
function buildStreamCard(item, isQueue, queueIndex) {
  const card = document.createElement('div');
  card.className = 'video-card';

  const filename = extractFilename(item.url);
  const { cls, label } = typeTag(item.type);

  // Show the full URL but truncated in a monospace row
  const safeUrl = String(item.url).replace(/"/g, '&quot;');
  const safeFile = escapeHtml(filename);

  let metaChips = '';
  if (item.isGodMode) metaChips += `<span class="meta-chip godmode">GOD MODE</span>`;
  if (item.size > 0)  metaChips += `<span class="meta-chip">${fmtSize(item.size)}</span>`;

  if (!isQueue) {
    // Detected tab card — actions: Download (full width), Queue + Desktop, cURL
    card.innerHTML = `
      <div class="card-filename">
        <span class="filename-text" title="${safeUrl}">${safeFile}</span>
        <span class="tag-badge ${cls}">${label}</span>
      </div>
      <div class="card-url-row" title="${safeUrl}">${safeUrl}</div>
      ${metaChips ? `<div class="card-meta">${metaChips}</div>` : ''}
      <div class="card-actions">
        <button class="card-btn btn-download" data-action="download">
          ${ICONS.download}<span>Download</span>
        </button>
        <button class="card-btn btn-queue" data-action="queue">
          ${ICONS.queue}<span>+ Queue</span>
        </button>
        <button class="card-btn btn-desktop" data-action="desktop">
          ${ICONS.desktop}<span>Send to App</span>
        </button>
        <button class="card-btn btn-curl" data-action="curl">
          ${ICONS.curl}<span>Copy cURL</span>
        </button>
      </div>
    `;
    card.querySelector('[data-action="download"]').onclick  = () => actionDownload(item);
    card.querySelector('[data-action="queue"]').onclick     = () => actionQueue(item);
    card.querySelector('[data-action="desktop"]').onclick   = () => actionDesktop(item);
    card.querySelector('[data-action="curl"]').onclick      = () => actionCurl(item);
  } else {
    // Queue tab card — actions: Send + Download + cURL + Remove
    card.innerHTML = `
      <div class="card-filename">
        <span class="filename-text" title="${safeUrl}">${safeFile}</span>
        <span class="tag-badge ${cls}">${label}</span>
      </div>
      <div class="card-url-row" title="${safeUrl}">${safeUrl}</div>
      <div class="card-actions">
        <button class="card-btn btn-download" data-action="download">
          ${ICONS.download}<span>Download</span>
        </button>
        <button class="card-btn btn-desktop" data-action="desktop">
          ${ICONS.send}<span>Send to App</span>
        </button>
        <button class="card-btn btn-curl" data-action="curl">
          ${ICONS.curl}<span>Copy cURL</span>
        </button>
        <button class="card-btn btn-remove" data-action="remove">
          ${ICONS.remove}<span>Remove</span>
        </button>
      </div>
    `;
    card.querySelector('[data-action="download"]').onclick  = () => actionDownload(item);
    card.querySelector('[data-action="desktop"]').onclick   = () => actionDesktop(item);
    card.querySelector('[data-action="curl"]').onclick      = () => actionCurl(item);
    card.querySelector('[data-action="remove"]').onclick    = () => {
      downloadQueue.splice(queueIndex, 1);
      saveQueue();
      showToast('Removed from queue');
    };
  }

  return card;
}

/* ── Actions ──────────────────────────────────────────── */
function actionDownload(item) {
  const filename = extractFilename(item.url).replace(/[\\/:*?"<>|]/g, '_');
  chrome.runtime.sendMessage({ action: 'DOWNLOAD_FILE', url: item.url, filename }, res => {
    if (res && res.success) showToast('Download started in browser');
    else showToast('Browser download failed — use cURL or Send to App');
  });
}

function actionQueue(item) {
  if (downloadQueue.some(q => q.url === item.url)) {
    showToast('Already in queue');
    return;
  }
  downloadQueue.push({ ...item, addedAt: Date.now(), status: 'ready' });
  saveQueue();
  showToast('Added to download queue');
}

function actionDesktop(item) {
  const payload = {
    url: item.url,
    title: extractFilename(item.url),
    curl: item.curl || `curl "${item.url}"`,
    referer: item.referer || currentTabUrl,
    origin: item.origin || '',
    userAgent: item.userAgent || navigator.userAgent,
    headers: item.headers || {},
    autoStart: true
  };
  chrome.runtime.sendMessage({ action: 'SEND_TO_OMNISTREAM', data: payload }, res => {
    if (res && res.success) {
      showToast('Sent to OmniStream Pro Desktop');
      checkBridge();
    } else {
      showToast('App offline — cURL copied instead', 3000);
      copyText(payload.curl, 'cURL command copied');
    }
  });
}

function actionCurl(item) {
  const cmd = item.curl || `curl "${item.url}"`;
  copyText(cmd, 'cURL command copied to clipboard');
}

/* ── God Mode ─────────────────────────────────────────── */
godModeBtn.addEventListener('click', () => {
  if (godModeBtn.classList.contains('scanning')) return;
  godModeBtn.classList.add('scanning');
  godBtnText.textContent = 'SCANNING — DEEP DOM PROBE...';

  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, { action: 'TRIGGER_GOD_MODE_SCAN' }, () => {});
  }

  setTimeout(() => {
    loadDetectedStreams();
    godModeBtn.classList.remove('scanning');
    godBtnText.textContent = 'ACTIVATE GOD MODE SCAN';
    showToast('God Mode scan complete');
  }, 1400);
});

/* ── Clear / Bulk actions ─────────────────────────────── */
clearDetectedBtn.addEventListener('click', () => {
  if (!currentTabId) return;
  chrome.runtime.sendMessage({ action: 'CLEAR_TAB_MEDIA', tabId: currentTabId }, () => {
    detectedStreams = [];
    renderDetected();
    showToast('Cleared detected streams');
  });
});

clearQueueBtn.addEventListener('click', () => {
  downloadQueue = [];
  saveQueue();
  showToast('Queue cleared');
});

sendAllBtn.addEventListener('click', () => {
  if (downloadQueue.length === 0) { showToast('Queue is empty'); return; }
  downloadQueue.forEach((item, i) => setTimeout(() => actionDesktop(item), i * 280));
  showToast(`Sending ${downloadQueue.length} stream(s) to OmniStream Pro`);
});

recheckBridgeBtn.addEventListener('click', () => {
  showToast('Checking connection...');
  checkBridge();
});

$dom('openDesktopHelp').addEventListener('click', e => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://github.com/Xmon4u/NetMirror-MultiAudio-Downloader' });
});

/* ── Utility ──────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

/* ── Boot ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
