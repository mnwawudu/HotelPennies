import React from "react";

/**
 * DownloadAppPrompt
 * - Shows on mobile only
 * - Waits `delayMs` before showing
 * - Remembers "Remind me later" and "No thanks" with localStorage expiries
 * - If PWA "beforeinstallprompt" is available, shows an "Install Web App" button
 *
 * Props:
 *  - playUrl: Google Play link (e.g., https://play.google.com/store/apps/details?id=com.your.app)
 *  - appStoreUrl: Apple App Store link (e.g., https://apps.apple.com/app/id1234567890)
 *  - delayMs: ms to wait before showing (default 5000)
 *  - remindDays: days to snooze when clicking "Remind me later" (default 7)
 *  - neverDays: days to hide after "No thanks" (default 180)
 */
export default function DownloadAppPrompt({
  playUrl = "#",
  appStoreUrl = "#",
  delayMs = 5000,
  remindDays = 7,
  neverDays = 180,
}) {
  const [visible, setVisible] = React.useState(false);
  const [installEvt, setInstallEvt] = React.useState(null);

  const KEY_NEXT = "hp_app_prompt_next";
  const now = () => Date.now();
  const inStandalone =
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    (window.navigator && window.navigator.standalone); // iOS Safari

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Gate: only show on mobile, not in standalone/PWA mode
  const allowShow = isMobile && !inStandalone;

  // Respect snooze/never timers
  function canShowNow() {
    const nextAt = Number(localStorage.getItem(KEY_NEXT) || "0");
    return nextAt <= now();
  }

  function setNext(days) {
    const ms = days * 24 * 60 * 60 * 1000;
    localStorage.setItem(KEY_NEXT, String(now() + ms));
  }

  // Delay show after first mount
  React.useEffect(() => {
    if (!allowShow || !canShowNow()) return;
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [allowShow, delayMs]);

  // Capture beforeinstallprompt (PWA “Install”)
  React.useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible) return null;

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="hp-appprompt-title">
      <div style={styles.modal}>
        <button
          aria-label="Close"
          onClick={() => {
            setVisible(false);
            setNext(neverDays); // treat X as "No thanks"
          }}
          style={styles.close}
        >
          ✕
        </button>

        <h3 id="hp-appprompt-title" style={{ marginTop: 0, marginBottom: 8 }}>Get the HotelPennies App</h3>
        <p style={{ marginTop: 0, color: "#333" }}>
          Book faster, get updates, and manage trips on the go.
        </p>

        <div style={styles.btnRow}>
          {playUrl !== "#" && (
            <a href={playUrl} target="_blank" rel="noreferrer" style={styles.cta}>
              Get it on Google Play
            </a>
          )}
          {appStoreUrl !== "#" && (
            <a href={appStoreUrl} target="_blank" rel="noreferrer" style={styles.ctaAlt}>
              Download on the App Store
            </a>
          )}
          {installEvt && (
            <button
              style={styles.ctaGhost}
              onClick={async () => {
                installEvt.prompt();
                try {
                  await installEvt.userChoice;
                } catch {}
                setInstallEvt(null); // only prompt once
                setVisible(false);
                setNext(neverDays);
              }}
            >
              Install Web App
            </button>
          )}
        </div>

        <div style={styles.footerRow}>
          <button
            style={styles.linkBtn}
            onClick={() => {
              setVisible(false);
              setNext(remindDays);
            }}
          >
            Remind me later
          </button>
          <button
            style={styles.linkBtn}
            onClick={() => {
              setVisible(false);
              setNext(neverDays);
            }}
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    padding: 18,
    position: "relative",
  },
  close: {
    position: "absolute",
    top: 8,
    right: 8,
    background: "transparent",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    lineHeight: 1,
  },
  btnRow: {
    display: "grid",
    gap: 8,
    marginTop: 12,
  },
  cta: {
    display: "inline-block",
    textAlign: "center",
    padding: "12px 14px",
    borderRadius: 10,
    background: "#0a3d62",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 700,
  },
  ctaAlt: {
    display: "inline-block",
    textAlign: "center",
    padding: "12px 14px",
    borderRadius: 10,
    background: "#111",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 700,
  },
  ctaGhost: {
    display: "inline-block",
    textAlign: "center",
    padding: "12px 14px",
    borderRadius: 10,
    background: "#f2f4f7",
    color: "#0a3d62",
    border: "1px solid #d0d5dd",
    fontWeight: 700,
  },
  footerRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 8,
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: "#0a3d62",
    textDecoration: "underline",
    padding: 8,
    cursor: "pointer",
  },
};
