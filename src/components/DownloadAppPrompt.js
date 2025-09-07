// src/components/DownloadAppPrompt.js
import React, { useEffect, useMemo, useState } from 'react';

const SHOW_DELAY_MS = 12000;        // wait 12s before showing
const COOLDOWN_MS   = 24 * 60 * 60 * 1000; // don't re-show for 24h after "Not now"

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.hotelpennies.app';
const APPLE_URL = 'https://apps.apple.com/app/id0000000000'; // <-- replace when live

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

  const platform = useMemo(() => {
    if (isAndroidChrome()) return 'android';
    if (isMobileSafari())  return 'ios';
    return null;
  }, []);

  useEffect(() => {
    if (!platform) return;

    const hidden = localStorage.getItem('hp-app-prompt-hidden');
    if (hidden === '1') return;

    const last = Number(localStorage.getItem('hp-app-prompt-last-closed') || 0);
    if (Date.now() - last < COOLDOWN_MS) return;

    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [platform]);

  if (!platform || !visible) return null;

  const close = () => {
    setVisible(false);
    localStorage.setItem('hp-app-prompt-last-closed', String(Date.now()));
  };

  const neverShow = () => {
    setVisible(false);
    localStorage.setItem('hp-app-prompt-hidden', '1');
  };

  const storeHref = platform === 'android' ? PLAY_URL : APPLE_URL;

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={row}>
          <div style={title}>Get the HotelPennies app</div>
          <button onClick={close} aria-label="Close" style={xBtn}>×</button>
        </div>

        <div style={desc}>Faster search, easier bookings, instant updates.</div>

        <div style={actions}>
          <a href={storeHref} target="_blank" rel="noopener noreferrer" style={cta}>
            {platform === 'android' ? 'Get it on Google Play' : 'Download on the App Store'}
          </a>
          <button onClick={neverShow} style={ghost}>Not now</button>
        </div>
      </div>
    </div>
  );
}

/* ---- styles: top-right toast ---- */
const wrap = {
  position: 'fixed',
  top: 12,
  right: 12,
  zIndex: 10000,
  maxWidth: 420,
  width: 'calc(100vw - 24px)',
};

const card = {
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  borderRadius: 12,
  padding: 16,
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
};

const row = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const title = {
  fontSize: 16,
  fontWeight: 700,
  color: '#0a2540',
};

const xBtn = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  fontSize: 22,
  lineHeight: 1,
  cursor: 'pointer',
  color: '#667085',
};

const desc = {
  marginTop: 8,
  fontSize: 14,
  color: '#344054',
};

const actions = {
  display: 'flex',
  gap: 8,
  marginTop: 12,
  flexWrap: 'wrap',
};

const cta = {
  display: 'inline-block',
  padding: '10px 12px',
  borderRadius: 8,
  fontWeight: 700,
  textDecoration: 'none',
  background: '#0a3d62',
  color: '#fff',
};

const ghost = {
  appearance: 'none',
  border: '1px solid #d0d5dd',
  background: '#fff',
  color: '#344054',
  padding: '10px 12px',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
};
