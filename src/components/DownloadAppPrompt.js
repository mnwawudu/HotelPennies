// src/components/DownloadAppPrompt.js
import React, { useEffect, useMemo, useState } from 'react';

const SHOW_DELAY_MS = 12000;                 // wait 12s before showing
const COOLDOWN_MS   = 24 * 60 * 60 * 1000;   // 24h cooldown after close/click
const APK_URL = process.env.REACT_APP_APK_URL || '/apk/hotelpennies-latest.apk';

function isAndroidChrome() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android/i.test(ua) && /Chrome/i.test(ua);
}
function isMobileSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const wk  = /WebKit/.test(ua);
  const isCriOS = /CriOS/.test(ua);
  return iOS && wk && !isCriOS; // Safari only (A2HS available here)
}
function isStandalone() {
  if (typeof window === 'undefined') return false;
  // iOS Safari uses navigator.standalone
  // Modern PWAs expose display-mode media query
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || (window.navigator && window.navigator.standalone === true);
}

export default function DownloadAppPrompt() {
  const [visible, setVisible] = useState(false);
  const [showTip, setShowTip] = useState(false);

  const platform = useMemo(() => {
    if (isAndroidChrome()) return 'android';
    if (isMobileSafari())  return 'ios';
    return null;
  }, []);

  useEffect(() => {
    if (!platform) return;
    if (platform === 'ios' && isStandalone()) return; // already “installed” as PWA

    const last = Number(localStorage.getItem('hp-app-prompt-last-closed') || 0);
    if (Date.now() - last < COOLDOWN_MS) return;

    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [platform]);

  if (!platform || !visible) return null;

  const rememberClose = () =>
    localStorage.setItem('hp-app-prompt-last-closed', String(Date.now()));

  const closeAll = () => {
    rememberClose();
    setShowTip(false);
    setVisible(false);
  };

  const downloadApk = () => {
    try {
      const apkUrl = new URL(APK_URL, window.location.href);
      const sameOrigin = apkUrl.origin === window.location.origin;
      const a = document.createElement('a');
      a.href = apkUrl.toString();
      if (sameOrigin) a.setAttribute('download', 'HotelPennies.apk');
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      window.location.href = APK_URL;
    } finally {
      closeAll();
    }
  };

  const handleClick = () => {
    if (platform === 'android') downloadApk();
    else setShowTip((v) => !v); // iOS — toggle tip
  };

  return (
    <>
      <button
        onClick={handleClick}
        aria-label={platform === 'android' ? 'Download app' : 'Install app'}
        style={pill}
      >
        {platform === 'android' ? 'Download app' : 'Install app'}
      </button>

      {platform === 'ios' && showTip && (
        <div role="dialog" aria-live="polite" style={tipWrap}>
          <div style={tipCard}>
            <div style={tipTitle}>Add to Home Screen</div>
            <div style={tipText}>
              Tap <span style={iconBox}>⃞↑</span> <span style={{opacity:.7}}>(Share)</span> &nbsp;
              then <strong>“Add to Home Screen”</strong>.
            </div>
            <button onClick={closeAll} style={tipBtn}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}

/* --- tiny pill (SofaScore-style) --- */
const pill = {
  position: 'fixed',
  top: 'max(8px, env(safe-area-inset-top))',
  right: 'max(8px, env(safe-area-inset-right))',
  zIndex: 2147483647,
  padding: '8px 12px',
  borderRadius: 9999,
  border: '1px solid rgba(0,0,0,0.08)',
  background: '#fff',
  color: '#111',
  fontWeight: 700,
  fontSize: 13,
  boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
  cursor: 'pointer',
  lineHeight: 1,
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
};

/* --- iOS tip bubble --- */
const tipWrap = {
  position: 'fixed',
  top: 'calc(max(8px, env(safe-area-inset-top)) + 40px)',
  right: 'max(8px, env(safe-area-inset-right))',
  zIndex: 2147483647,
  maxWidth: 320,
};
const tipCard = {
  background: '#fff',
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
  boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
  padding: 12,
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
};
const tipTitle = { fontSize: 14, fontWeight: 700, color: '#0a2540', marginBottom: 4 };
const tipText  = { fontSize: 13, color: '#344054', lineHeight: 1.4, marginBottom: 8 };
const tipBtn   = {
  appearance: 'none',
  border: '1px solid #d0d5dd',
  background: '#fff',
  color: '#344054',
  padding: '8px 10px',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
};
const iconBox  = {
  display: 'inline-block',
  border: '1px solid #d0d5dd',
  borderRadius: 6,
  padding: '0 4px',
  fontSize: 12,
  lineHeight: '16px',
};
