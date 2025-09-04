// routes/kycRoutes.js

// ====== SMTP + Nodemailer TRACE (no behavior change) ======
// Enable by setting EMAIL_TRACE=1 in your environment.
// Logs stack traces for any SMTP socket attempt (587/465 on localhost)
// and any nodemailer.createTransport() call anywhere in the process.
if (process.env.EMAIL_TRACE === '1') {
  try {
    const net = require('net');
    const tls = require('tls');
    const nodemailerTrace = require('nodemailer');

    // Wrap low-level socket connects to catch ANY SMTP attempt (even outside nodemailer)
    function wrapConnect(original, label) {
      return function (...args) {
        let port, host;
        if (typeof args[0] === 'object' && args[0] !== null) {
          port = args[0].port;
          host = args[0].host || 'localhost';
        } else {
          port = args[0];
          host = args[1] || 'localhost';
        }
        const isLocal = !host || host === '127.0.0.1' || host === 'localhost';
        const isSmtpPort = port === 587 || port === 465;

        if (isSmtpPort && isLocal) {
          console.error(`[SMTP-TRACE] ${label} -> ${host}:${port}`);
          console.trace('[SMTP-TRACE] Socket connect stack');
        }
        return original.apply(this, args);
      };
    }
    net.connect = wrapConnect(net.connect, 'net.connect');
    tls.connect = wrapConnect(tls.connect, 'tls.connect');

    // Wrap nodemailer.createTransport to see who/what config creates a transport
    const realCreateTransport = nodemailerTrace.createTransport;
    function redact(conf) {
      try {
        const c = JSON.parse(JSON.stringify(conf || {}));
        if (c.auth && c.auth.pass) c.auth.pass = '***';
        if (c.auth && c.auth.user) c.auth.user = String(c.auth.user);
        return c;
      } catch {
        return conf;
      }
    }
    nodemailerTrace.createTransport = function (...args) {
      const conf = args[0] || {};
      console.warn('[SMTP-TRACE] nodemailer.createTransport called with:', redact(conf));
      console.trace('[SMTP-TRACE] createTransport stack');
      return realCreateTransport.apply(this, args); // no behavior change
    };

    console.info('[SMTP-TRACE] Enabled. Set EMAIL_TRACE=0 to disable.');
  } catch (e) {
    console.warn('[SMTP-TRACE] Failed to enable trace:', e?.message || e);
  }
}
// ====== end SMTP + Nodemailer TRACE ======

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');

const Vendor = require('../models/vendorModel');
const { startKycChecks } = require('../services/kyc');

/* ---------------- Vendor auth (unchanged) ---------------- */
function vendorAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.role !== 'vendor') return res.status(403).json({ message: 'Forbidden' });
    req.vendorId = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
  }
}

/* ---------------- Existing: start checks (unchanged) ---------------- */
router.post('/vendor/kyc/submit', vendorAuth, async (req, res) => {
  const { idType, idNumber, cacNumber } = req.body;

  const vendor = await Vendor.findById(req.vendorId);
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

  vendor.kyc = vendor.kyc || {};
  if (idType)    vendor.kyc.idType    = idType;
  if (idNumber)  vendor.kyc.idNumber  = idNumber;
  if (cacNumber) vendor.kyc.cacNumber = cacNumber;

  vendor.kyc.checks = vendor.kyc.checks || {};
  if (idType && idNumber) {
    vendor.kyc.checks.identity = {
      status: 'processing',
      note: '',
      provider: process.env.KYC_PROVIDER || 'dummy',
      updatedAt: new Date()
    };
  }
  if (cacNumber) {
    vendor.kyc.checks.company = {
      status: 'processing',
      note: '',
      provider: process.env.KYC_PROVIDER || 'dummy',
      updatedAt: new Date()
    };
  }

  vendor.kycStatus = 'PROCESSING';
  await vendor.save();

  // manual-only? OK if startKycChecks is a no-op internally
  await startKycChecks(vendor._id);

  res.json({ message: 'KYC checks started', kycStatus: vendor.kycStatus });
});

/* ---------------- Existing: poll status (unchanged) ---------------- */
router.get('/vendor/kyc/status', vendorAuth, async (req, res) => {
  const v = await Vendor.findById(req.vendorId).lean();
  if (!v) return res.status(404).json({ message: 'Vendor not found' });
  res.json({ kycStatus: v.kycStatus, checks: v.kyc?.checks || {}, isFullyVerified: v.isFullyVerified });
});

/* ---------------- NEW: docs submit -> email admin ---------------- */

// Upload in memory; email buffers as attachments
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 }, // 10MB each
  fileFilter: (req, file, cb) => {
    const OK = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
    if (OK.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only PDF or image files (JPG/PNG/WEBP/GIF) are allowed'));
  }
}).fields([
  { name: 'meansOfId',      maxCount: 1 },
  { name: 'cacCertificate', maxCount: 1 },
  { name: 'proofOfAddress', maxCount: 1 }
]);

// Keep behavior: Gmail when present; else dev-safe jsonTransport
function makeTransport() {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    // Explicit TLS to Gmail (no localhost)
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  // Dev fallback — no network (won't 127.0.0.1)
  return nodemailer.createTransport({ jsonTransport: true });
}

// POST /api/vendor/kyc/submit-files
router.post('/vendor/kyc/submit-files', vendorAuth, (req, res, next) => {
  upload(req, res, err => {
    if (err) return res.status(400).json({ ok: false, message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;

    const vendor = await Vendor.findById(req.vendorId);
    if (!vendor) return res.status(404).json({ ok: false, message: 'Vendor not found' });

    // Re-submit guard: if any doc already submitted, block
    if (vendor.documents?.meansOfId || vendor.documents?.cacCertificate || vendor.documents?.proofOfAddress) {
      return res.status(409).json({
        ok: false,
        code: 'ALREADY_SUBMITTED',
        message: 'Documents already submitted. Please wait for review or contact support to update.'
      });
    }

    const files = req.files || {};
    const moid = files.meansOfId?.[0];
    const cac  = files.cacCertificate?.[0];
    const poa  = files.proofOfAddress?.[0];

    if (!moid || !cac || !poa) {
      return res.status(400).json({
        ok: false,
        message: 'meansOfId, cacCertificate, and proofOfAddress are all required'
      });
    }

    if (!adminEmail) {
      return res.status(500).json({
        ok: false,
        message: 'ADMIN_EMAIL not configured on server'
      });
    }

    const attachments = [
      { filename: moid.originalname || 'means-of-id',      content: moid.buffer, contentType: moid.mimetype },
      { filename: cac.originalname  || 'cac-certificate',  content: cac.buffer,  contentType: cac.mimetype  },
      { filename: poa.originalname  || 'proof-of-address', content: poa.buffer,  contentType: poa.mimetype  },
    ];

    const transporter = makeTransport();
    const subject = `[HotelPennies] KYC docs: ${vendor.businessName || vendor.name || vendor.email || vendor._id}`;
    const html = `
      <div style="font-family:Arial,sans-serif">
        <h2>KYC document submission</h2>
        <p><b>Vendor:</b> ${vendor.businessName || vendor.name || ''}</p>
        <p><b>Email:</b> ${vendor.email || ''}</p>
        <p><b>Phone:</b> ${vendor.phone || ''}</p>
        <p><b>Address:</b> ${vendor.address || ''}</p>
        <p>Attached: Means of ID, CAC Certificate, and Proof of Address.</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.GMAIL_USER || adminEmail,
      replyTo: vendor.email || undefined,
      to: adminEmail,
      subject,
      html,
      attachments,
    });

    // Mark as submitted + processing so UI ticks immediately
    vendor.documents = vendor.documents || {};
    vendor.documents.meansOfId = true;
    vendor.documents.cacCertificate = true;
    vendor.documents.proofOfAddress = true;
    vendor.kycStatus = 'PROCESSING';
    await vendor.save();

    return res.json({ ok: true });
  } catch (e) {
    console.error('KYC submit-files error:', e);
    const msg = e?.message || 'Failed to submit documents';
    return res.status(500).json({ ok: false, message: msg });
  }
});

module.exports = router;
