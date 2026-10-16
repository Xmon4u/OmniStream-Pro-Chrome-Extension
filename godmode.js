/**
 * OmniStream Pro — God Mode Media Sniffer & DevTools Protector
 * Injected into the page's MAIN execution world at document_start.
 * ONLY reports genuine .m3u8 HLS playlist URLs.
 */
(function() {
  'use strict';

  if (window.__OMNISTREAM_GODMODE_ACTIVE__) return;
  window.__OMNISTREAM_GODMODE_ACTIVE__ = true;

  const capturedUrls = new Set();

  // Central guard — accept ONLY real .m3u8 playlist URLs
  function isM3U8Only(url) {
    if (!url || typeof url !== 'string') return false;
    const s = url.trim();
    if (s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('javascript:')) return false;
    try {
      // Pathname-based check: e.g. /hls/1080p.m3u8?token=xyz → passes
      return /\.m3u8$/i.test(new URL(s).pathname);
    } catch {
      // Fallback for relative URLs
      return /\.m3u8$/i.test(s.split('?')[0].split('#')[0]);
    }
  }

  function notifyDetected(url, type) {
    if (!isM3U8Only(url)) return;          // strict filter — drop everything else
    const cleanUrl = url.trim();
    if (capturedUrls.has(cleanUrl)) return;
    capturedUrls.add(cleanUrl);

    window.postMessage({
      source: 'OMNISTREAM_GODMODE',
      action: 'MEDIA_DETECTED',
      url: cleanUrl,
      mediaType: 'HLS (M3U8)',
      title: document.title || ''
    }, '*');
  }

  // 1. Anti-DevTools & Anti-F12 Blocker Neutralizer
  const origFunction = window.Function;
  const FunctionHandler = function(...args) {
    if (args.length > 0) {
      const code = args[args.length - 1];
      if (typeof code === 'string' && /debugger\s*;?/i.test(code)) {
        args[args.length - 1] = code.replace(/debugger\s*;?/gi, '/* [OmniStream neutralized debugger] */');
      }
    }
    return origFunction.apply(this, args);
  };
  FunctionHandler.prototype = origFunction.prototype;
  window.Function = FunctionHandler;

  // Protect console methods
  console.clear = function() {
    console.info('[OmniStream Pro] Preserved DevTools console from webpage clear.');
  };

  // Restore right-click & keydown shortcuts (F12, Ctrl+Shift+I, etc.)
  const origAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (['contextmenu', 'keydown', 'keyup'].includes(type) && typeof listener === 'function') {
      const wrappedListener = function(event) {
        const isF12 = event.key === 'F12' || event.keyCode === 123;
        const isDevToolsShortcut = (event.ctrlKey || event.metaKey) && (
          event.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(event.key) ||
          ['U', 'u'].includes(event.key)
        );
        const isContextMenu = event.type === 'contextmenu';

        if (isF12 || isDevToolsShortcut || isContextMenu) {
          const origPreventDefault = event.preventDefault;
          const origStopPropagation = event.stopPropagation;
          const origStopImmediatePropagation = event.stopImmediatePropagation;
          event.preventDefault = () => {};
          event.stopPropagation = () => {};
          event.stopImmediatePropagation = () => {};

          try {
            return listener.apply(this, arguments);
          } finally {
            event.preventDefault = origPreventDefault;
            event.stopPropagation = origStopPropagation;
            event.stopImmediatePropagation = origStopImmediatePropagation;
          }
        }
        return listener.apply(this, arguments);
      };
      return origAddEventListener.call(this, type, wrappedListener, options);
    }
    return origAddEventListener.call(this, type, listener, options);
  };

  window.addEventListener('contextmenu', (e) => {
    e.stopImmediatePropagation ? e.stopImmediatePropagation() : null;
  }, true);

  // 2. Network Hooks (XHR & Fetch) — m3u8 only
  const origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    try { notifyDetected(url, 'HLS (M3U8)'); } catch (e) {}
    return origXHROpen.apply(this, arguments);
  };

  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      notifyDetected(url, 'HLS (M3U8)');
    } catch (e) {}
    return origFetch.apply(this, arguments);
  };

  // 3. HTMLMediaElement src hook — m3u8 only
  const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  if (originalSrcDescriptor && originalSrcDescriptor.set) {
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      set: function(val) {
        try { notifyDetected(val, 'HLS (M3U8)'); } catch (e) {}
        return originalSrcDescriptor.set.call(this, val);
      },
      get: function() { return originalSrcDescriptor.get.call(this); },
      configurable: true
    });
  }

  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function() {
    try {
      const src = this.currentSrc || this.src;
      notifyDetected(src, 'HLS (M3U8)');
    } catch (e) {}
    return origPlay.apply(this, arguments);
  };
  // Note: blob: / createObjectURL URLs are never .m3u8 and are filtered by isM3U8Only()

  // 4. Deep DOM & Script Scanner — m3u8 only
  // Regex: matches full URLs ending in .m3u8 (with optional query string)
  const M3U8_SCAN_REGEX = /https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi;

  function deepDOMScan() {
    // <video> / <audio> / <source> tags
    document.querySelectorAll('video, audio, video source, audio source').forEach(el => {
      notifyDetected(el.src || el.getAttribute('src') || '', 'HLS (M3U8)');

      // data-* attributes that may hold lazy-loaded m3u8
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-') && /\.m3u8/i.test(attr.value)) {
          notifyDetected(attr.value, 'HLS (M3U8)');
        }
      }
    });

    // Cross-origin iframes (best-effort)
    document.querySelectorAll('iframe').forEach(frame => {
      try {
        const frameDoc = frame.contentDocument || frame.contentWindow?.document;
        if (frameDoc) {
          frameDoc.querySelectorAll('video, source').forEach(el => {
            notifyDetected(el.src || el.getAttribute('src') || '', 'HLS (M3U8)');
          });
        }
      } catch (e) {
        // Cross-origin: try the iframe src itself
        notifyDetected(frame.src || '', 'HLS (M3U8)');
      }
    });

    // Inline <script> tag source scanning
    document.querySelectorAll('script').forEach(script => {
      const content = script.textContent;
      if (!content || !content.includes('.m3u8')) return;
      const matches = content.match(M3U8_SCAN_REGEX);
      if (matches) matches.forEach(m => notifyDetected(m, 'HLS (M3U8)'));
    });

    // JWPlayer integration
    if (window.jwplayer && typeof window.jwplayer === 'function') {
      try {
        const jw = window.jwplayer();
        if (jw && jw.getPlaylist) {
          const pl = jw.getPlaylist();
          if (Array.isArray(pl)) {
            pl.forEach(item => {
              notifyDetected(item.file || '', 'HLS (M3U8)');
              if (item.sources) item.sources.forEach(s => notifyDetected(s.file || '', 'HLS (M3U8)'));
            });
          }
        }
      } catch (e) {}
    }
  }

  // 5. Muted Player Stimulus Nudge
  function nudgePlayers() {
    document.querySelectorAll('video').forEach(v => {
      try {
        if (v.paused) {
          const wasMuted = v.muted;
          v.muted = true;
          v.play().then(() => {
            setTimeout(() => {
              v.pause();
              v.muted = wasMuted;
            }, 500);
          }).catch(() => {});
        }
      } catch (e) {}
    });

    document.querySelectorAll('.vjs-big-play-button, .play-button, [class*="play"], [id*="play"]').forEach(btn => {
      try {
        if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
          btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }
      } catch (e) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', deepDOMScan);
  } else {
    deepDOMScan();
  }

  const observer = new MutationObserver(() => {
    deepDOMScan();
  });
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('message', (event) => {
    if (event.data && event.data.target === 'OMNISTREAM_GODMODE_INJECT') {
      if (event.data.action === 'FORCE_SCAN') {
        nudgePlayers();
        deepDOMScan();
      }
    }
  });

  console.log('[OmniStream Pro] God Mode media detector and devtools guard initialized.');
})();
