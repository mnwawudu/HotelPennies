// src/pages/AdminCommissions.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../utils/axiosConfig';

const FIELDS = [
  { key: 'platform_pct_lodging', label: 'Platform % (Hotels & Shortlets)', min: 0, max: 100, step: 0.1 },
  { key: 'cashback_pct_lodging', label: 'User Cashback % (Hotels & Shortlets)', min: 0, max: 100, step: 0.1 },
  { key: 'referral_pct_lodging', label: 'User Referral % (Hotels & Shortlets)', min: 0, max: 100, step: 0.1 },

  // NEW: Event Center
  { key: 'platform_pct_event_center', label: 'Platform % (Event Center)', min: 0, max: 100, step: 0.1 },
  { key: 'cashback_pct_event_center', label: 'User Cashback % (Event Center)', min: 0, max: 100, step: 0.1 },
  { key: 'referral_pct_event_center', label: 'User Referral % (Event Center)', min: 0, max: 100, step: 0.1 },

  { key: 'platform_pct_default', label: 'Platform % (Other Categories)', min: 0, max: 100, step: 0.1 },
];

const toPercent = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? Math.round(n * 10000) / 100 : n;
};

export default function AdminCommissions() {
  const token = useMemo(() => localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken'), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [values, setValues] = useState({
    platform_pct_lodging: 15,
    cashback_pct_lodging: 3,
    referral_pct_lodging: 3,
    platform_pct_event_center: 15,
    cashback_pct_event_center: 0,
    referral_pct_event_center: 0,
    platform_pct_default: 15,
    platform_matures_with_vendor: false,
  });

  const headers = useMemo(
    () => ({ Authorization: token ? `Bearer ${token}` : undefined }),
    [token]
  );

  async function fetchSettings() {
    setLoading(true);
    setError('');
    setOk('');
    try {
      const resp = await axios.get('/api/admin/settings', { headers });
      const s = resp.data || {};
      setValues((v) => ({
        ...v,
        platform_pct_lodging: toPercent(s.platformPctLodging ?? v.platform_pct_lodging),
        cashback_pct_lodging: toPercent(s.cashbackPctHotel ?? v.cashback_pct_lodging),
        referral_pct_lodging: toPercent(s.referralPctHotel ?? v.referral_pct_lodging),

        platform_pct_event_center: toPercent(s.platformPctEventCenter ?? v.platform_pct_event_center),
        cashback_pct_event_center: toPercent(s.cashbackPctEventCenter ?? v.cashback_pct_event_center),
        referral_pct_event_center: toPercent(s.referralPctEventCenter ?? v.referral_pct_event_center),

        platform_pct_default: toPercent(s.platformPctDefault ?? v.platform_pct_default),
        platform_matures_with_vendor: Boolean(s.platformMaturesWithVendor ?? v.platform_matures_with_vendor),
      }));
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setNum = (key, val) => {
    const n = Number(val);
    setValues((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
  };

  const save = async () => {
    setBusy(true);
    setError('');
    setOk('');
    try {
      // Send camelCase keys the server accepts (will normalize to fractions)
      const payload = {
        // lodging
        platformPctLodging: values.platform_pct_lodging,
        cashbackPctHotel: values.cashback_pct_lodging,
        referralPctHotel: values.referral_pct_lodging,

        // event
        platformPctEventCenter: values.platform_pct_event_center,
        cashbackPctEventCenter: values.cashback_pct_event_center,
        referralPctEventCenter: values.referral_pct_event_center,

        // defaults
        platformPctDefault: values.platform_pct_default,

        // flags
        platformMaturesWithVendor: values.platform_matures_with_vendor,
      };

      await axios.put('/api/admin/settings', payload, { headers });
      setOk('Settings saved. New bookings will use these values immediately.');
      await fetchSettings();
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to save settings');
    } finally {
      setBusy(false);
    }
  };

  const resetToEnv = async () => {
    setBusy(true);
    setError('');
    setOk('');
    try {
      try {
        await axios.post('/api/admin/settings/reset', {}, { headers });
      } catch {}
      await fetchSettings();
      setOk('Settings reloaded.');
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to reset/reload settings');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page" style={{ maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>Commission & Cashback</h2>
      <p style={{ color: '#555', marginTop: -6 }}>
        Control platform %, cashback and referral for bookings. Values are stored as fractions (e.g. 0.15).
      </p>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {ok && <p className="success">{ok}</p>}

      {!loading && (
        <div className="card" style={{ background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            {FIELDS.map((f) => (
              <div key={f.key} style={{ display: 'grid', gap: 6 }}>
                <label><strong>{f.label}</strong></label>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={values[f.key]}
                  onChange={(e) => setNum(f.key, e.target.value)}
                  style={{ width: 260 }}
                />
              </div>
            ))}

            <div style={{ marginTop: 10 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={values.platform_matures_with_vendor}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, platform_matures_with_vendor: e.target.checked }))
                  }
                />
                Platform commission matures with vendor (hold until vendor release time)
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              <button onClick={resetToEnv} disabled={busy}>Reload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
