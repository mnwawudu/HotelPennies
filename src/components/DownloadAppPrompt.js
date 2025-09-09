// src/components/DownloadAppPrompt.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';

const SHOW_DELAY_MS = 12000; // wait 12s before showing
const COOLDOWN_MS   = 24 * 60 * 60 * 1000; // 24h after close
const HIDDEN_KEY    = 'hp-app-prompt-hidden';
const LAST_CLOSED   = 'hp-app-prompt-last-closed';

function isMobileSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const wk  = /WebKit/.test(ua);
  const isCriOS = /CriOS/.test(ua);
  return iOS && wk && !isCriOS;
}
function isAndroidChrome() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android/.test(ua) && /Chrome/.test(ua);
}

export default function DownloadAppPrompt() {
  const [visible, setVisible] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

  const platform = useMemo(() => {
    if (isAndroidChrome()) return 'android';
    if (isMobileSafari())  return 'ios';
    return null;
  }, []);

  // Decide if/when to show (no auto-hide anywhere)
  useEffect(() => {
    if (!platform) return;

    // respect permanent hide
    try {
      if (localStorage.getItem(HIDDEN_KEY) === '1') return;
    } catch {}

    // respect cooldown
    try {
      const last = Number(localStorage.getItem(LAST_CLOSED) || 0);
      if (Date.now() - last < COOLDOWN_MS) return;
    } catch {}

    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [platform]);

  const close = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(LAST_CLOSED, String(Date.now())); } catch {}
  }, []);

  const neverShow = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(HIDDEN_KEY, '1'); } catch {}
  }, []);

  const startAndroidDownload = useCallback(() => {
    const href =
      (typeof process !== 'undefined' && process.env && process.env.REACT_APP_APK_URL) ||
      '/apk/hotelpennies-latest.apk';

    // Programmatic <a download> to avoid navigation
    const a = document.createElement('a');
    a.href = href;
    a.setAttribute('download', 'HotelPennies.apk');
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // hide after user action; set cooldown
    close();
  }, [close]);

  if (!platform || !visible) return null;

  const onPrimaryClick =
    platform === 'android'
      ? startAndroidDownload
      : () => setShowIosTip(v => !v);

  return (
    <div style={wrap} role="dialog" aria-modal="false" aria-label="App install prompt">
      <div style={pill}>
        <button
          onClick={onPrimaryClick}
          style={ctaBtn}
          aria-label={platform === 'android' ? 'Download app' : 'Install app'}
          type="button"
        >
          {platform === 'android' ? 'Download app' : 'Install app'}
        </button>

        <button onClick={close} aria-label="Close" style={xBtn} type="button">×</button>
      </div>

      {/* iOS little helper bubble (no auto-hide) */}
      {platform === 'ios' && showIosTip && (
        <div style={tip}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Add to Home Screen</div>
          <div style={{ fontSize: 12, lineHeight: 1.35 }}>
            Tap the <span aria-hidden>Share</span> icon then <strong>Add to Home Screen</strong>.
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button style={tiny} onClick={() => setShowIosTip(false)} type="button">Got it</button>
            <button style={tinyGhost} onClick={neverShow} type="button">Don’t show again</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- minimal “tiny pill” styles ---- */
const wrap = {
  position: 'fixed',
  right: 12,
  bottom: 16,
  zIndex: 10000,
  width: 'auto',
  maxWidth: 'calc(100vw - 24px)',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
};

const pill = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: '#0a3d62',
  borderRadius: 999,
  boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
  padding: '6px 6px 6px 10px',
};

const ctaBtn = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '6px 8px',
  lineHeight: 1,
};

const xBtn = {
  appearance: 'none',
  border: 'none',
  background: '#0b2f4a',
  color: '#cbd5e1',
  fontSize: 18,
  lineHeight: 1,
  borderRadius: 999,
  width: 26,
  height: 26,
  cursor: 'pointer',
};

const tip = {
  marginTop: 8,
  background: '#ffffff',
  color: '#0a2540',
  border: '1px solid rgba(0,0,0,0.06)',
  borderRadius: 10,
  padding: 10,
  boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
};

const tiny = {
  appearance: 'none',
  border: '1px solid #d0d5dd',
  background: '#fff',
  color: '#0a2540',
  padding: '6px 10px',
  borderRadius: 8,
  fontSize: 12,
  cursor: 'pointer',
};

const tinyGhost = {
  ...tiny,
  borderStyle: 'dashed',
};
