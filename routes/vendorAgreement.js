// routes/vendorAgreement.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Acceptance = require('../models/vendorAgreementAcceptance');

const router = express.Router();

/* -------- Minimal vendor auth (Bearer or x-auth-token) -------- */
function simpleVendorAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const token = m ? m[1] : (req.headers['x-auth-token'] || req.query.token);
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const vendorId = payload.vendorId || payload.id || payload._id || payload.sub;
    if (!vendorId) return res.status(401).json({ message: 'Unauthorized' });
    req.vendorId = vendorId;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

/* -------- Resolve the PDF path (ENV → /legal folder fallback) -------- */
function parseEnvPath(val) {
  if (!val) return null;
  try {
    // accept file:///… or plain paths
    if (/^file:\/\//i.test(val)) {
      const u = new URL(val);
      // On Windows file URLs start with /C:/…; strip leading slash
      let p = decodeURIComponent(u.pathname);
      if (process.platform === 'win32') p = p.replace(/^\/+/, '');
      const abs = path.isAbsolute(p) ? p : path.resolve(p);
      return fs.existsSync(abs) ? abs : null;
    }
    const p = path.isAbsolute(val) ? val : path.resolve(val);
    return fs.existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

function resolveAgreementPath() {
  // 1) Explicit env override
  const fromEnv = parseEnvPath(process.env.VENDOR_AGREEMENT_PDF_PATH);
  if (fromEnv) return fromEnv;

  // 2) Search common /legal directories
  const candidatesDirs = [
    path.join(__dirname, '..', 'legal'),
    path.join(process.cwd(), 'legal'),
  ];

  for (const dir of candidatesDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs
      .readdirSync(dir)
      .filter(
        (f) =>
          /\.pdf$/i.test(f) &&
          /^HotelPennies_Vendor_Agreement/i.test(f) // “HotelPennies_Vendor_Agreement.pdf” etc.
      );

    if (files.length) {
      files.sort(
        (a, b) =>
          fs.statSync(path.join(dir, b)).mtimeMs -
          fs.statSync(path.join(dir, a)).mtimeMs
      );
      return path.join(dir, files[0]);
    }
  }

  return null;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const s = fs.createReadStream(filePath);
    s.on('error', reject);
    s.on('data', (chunk) => hash.update(chunk));
    s.on('end', () => resolve(hash.digest('hex')));
  });
}

/* -------- GET /api/vendor-agreement/meta -------- */
router.get('/vendor-agreement/meta', simpleVendorAuth, async (req, res) => {
  const filePath = resolveAgreementPath();
  if (!filePath) return res.status(404).json({ message: 'Agreement not found' });
  const hash = await sha256File(filePath);
  const accepted = await Acceptance.exists({ vendorId: req.vendorId, contentHash: hash });
  res.json({ accepted: !!accepted, hash, version: null, filename: path.basename(filePath) });
});

/* -------- GET /api/vendor-agreement/file -------- */
router.get('/vendor-agreement/file', simpleVendorAuth, (req, res) => {
  const filePath = resolveAgreementPath();
  if (!filePath) return res.status(404).json({ message: 'Agreement not found' });
  res.sendFile(path.resolve(filePath));
});

/* -------- POST /api/vendor-agreement/accept -------- */
router.post('/vendor-agreement/accept', simpleVendorAuth, express.json(), async (req, res) => {
  try {
    const providedHash = String(req.body?.contentHash || '');
    const filePath = resolveAgreementPath();
    if (!filePath) return res.status(404).json({ message: 'Agreement not found' });
    const actualHash = await sha256File(filePath);
    if (!providedHash || providedHash !== actualHash) {
      return res.status(400).json({ message: 'contentHash mismatch' });
    }

    const doc = await Acceptance.findOneAndUpdate(
      { vendorId: req.vendorId, contentHash: actualHash },
      { $setOnInsert: { vendorId: req.vendorId, contentHash: actualHash, acceptedAt: new Date() } },
      { upsert: true, new: true }
    );

    res.json({ ok: true, id: doc._id });
  } catch (e) {
    if (e?.code === 11000) return res.json({ ok: true, duplicate: true });
    res.status(500).json({ message: 'Failed to record acceptance' });
  }
});

/* -------- Optional debug (non-200 only shows message in prod) -------- */
router.get('/vendor-agreement/_debug-path', simpleVendorAuth, (req, res) => {
  const p = resolveAgreementPath();
  if (!p) return res.status(404).json({ message: 'No agreement file resolved' });
  res.json({ resolvedPath: p });
});

module.exports = router;
