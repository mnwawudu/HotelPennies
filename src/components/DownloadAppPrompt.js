// src/components/DownloadAppPrompt.js
import React, { useEffect, useMemo, useState } from 'react';

const SHOW_DELAY_MS = 5000;                 // was 12000 — make it snappier
const COOLDOWN_MS   = 24 * 60 * 60 * 1000;  // 24h

const ANDROID_APK_URL =
  process.env.REACT_APP_ANDROID_APK_URL || '/app/HotelPennies.apk';

// ——— broader detection (any Android/iOS browser) ———
function isAndroidWeb() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  return /Android/i.test(ua);
}
function isIOSWeb() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/i.test(ua);
}

export default function DownloadAppPrompt() {
  const [visible, setVisible] = useState(false);

  const platform = useMemo(() => {
    if (isAndroidWeb()) return 'android';
    if (isIOSWeb())     return 'ios';
    return null;
  }, []);

  useEffect(() => {
    // Dev helpers: force via ?showAppPrompt=1 (ignores cooldown/hidden)
    const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const force = qp?.get('showAppPrompt') === '1';

    if (!platform) return;

    // Don’t show if permanently hidden (unless forced)
    const hidden = !force && localStorage.getItem('hp-app-prompt-hidden') === '1';
    if (hidden) return;

    // Cooldown after closing (unless forced)
    const last = Number(localStorage.getItem('hp-app-prompt-last-closed') || 0);
    if (!force && Date.now() - last < COOLDOWN_MS) return;

    const t = setTimeout(() => setVisible(true), force ? 0 : SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [platform]);

  // Expose a global for QA: window.hpForceShowAppPrompt()
  useEffect(() => {
    window.hpForceShowAppPrompt = () => {
      try {
        localStorage.removeItem('hp-app-prompt-hidden');
        localStorage.removeItem('hp-app-prompt-last-closed');
      } catch {}
      setVisible(true);
    };
    return () => { delete window.hpForceShowAppPrompt; };
  }, []);

  if (!platform || !visible) return null;

  const close = () => {
    setVisible(false);
    localStorage.setItem('hp-app-prompt-last-closed', String(Date.now()));
  };

  const neverShow = () => {
    setVisible(false);
    localStorage.setItem('hp-app-prompt-hidden', '1');
  };

  const handlePrimary = () => {
    if (platform === 'android') {
      // Direct APK download (same-origin recommended)
      const a = document.createElement('a');
      a.href = ANDROID_APK_URL;
      a.download = 'HotelPennies.apk';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    // iOS: cannot download apps outside App Store — prompt A2HS
    alert('Install on iPhone: Share ▸ Add to Home Screen to get the HotelPennies app-like experience.');
  };

  return (
    <div style={wrap} role="dialog" aria-live="polite" aria-label="Install app">
      <div style={pill}>
        <button onClick={handlePrimary} style={pillBtn}
          aria-label={platform === 'android' ? 'Download app' : 'Install app'}>
          {platform === 'android' ? 'Download app' : 'Install app'}
        </button>
        <button onClick={neverShow} style={ghost} aria-label="Not now">Not now</button>
        <button onClick={close} aria-label="Close" style={xBtn}>×</button>
      </div>
    </div>
  );
}

/* styles: tiny pill, top-right */
const wrap = {
  position: 'fixed',
  top: 12, right: 12, zIndex: 10000,
  maxWidth: 360, width: 'calc(100vw - 24px)'
};
const pill = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  borderRadius: 999, padding: '8px 8px 8px 12px',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
};
const pillBtn = {
  appearance: 'none', border: 'none',
  background: '#0a3d62', color: '#fff',
  padding: '8px 12px', borderRadius: 999, fontWeight: 700, cursor: 'pointer'
};
const ghost = {
  appearance: 'none', border: '1px solid #d0d5dd',
  background: '#fff', color: '#344054',
  padding: '8px 12px', borderRadius: 999, fontWeight: 600, cursor: 'pointer'
};
const xBtn = {
  appearance: 'none', border: 'none', background: 'transparent',
  fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#667085', padding: 6
};
