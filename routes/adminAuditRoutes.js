// routes/adminAuditRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const Ledger = require('../models/ledgerModel');
const Vendor = require('../models/vendorModel');
const User = require('../models/userModel');

// ───────────────────────── Admin auth (JWT role) ─────────────────────────
const ALLOWED_ROLES = new Set(['admin', 'superadmin', 'ops', 'support', 'owner']);
async function adminAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.role || !ALLOWED_ROLES.has(String(decoded.role).toLowerCase())) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

// Utilities
const oid = (v) => (mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : null);
const parseDate = (s) => (s ? new Date(s) : null);

// ─────────────────────── GET /audit/cancellation-reversals ───────────────────────
// List reversal rows created due to cancellations.
// Filters (query):
//   - vendorId: limit to a specific vendor's reversals (vendor ledger debits)
//   - bookingId: limit to a specific booking
//   - accountType: vendor | user | platform  (default vendor)
//   - start, end: ISO date range filter (createdAt)
//   - page, pageSize
//   - includeLegacy: '1' to include Vendor.payoutHistory reversed items (when vendorId is provided)
router.get('/audit/cancellation-reversals', adminAuth, async (req, res) => {
  try {
    const {
      vendorId,
      bookingId,
      accountType = 'vendor',
      start,
      end,
      page: pageStr = '1',
      pageSize: pageSizeStr = '20',
      includeLegacy = '0',
    } = req.query;

    const page = Math.max(parseInt(pageStr, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(pageSizeStr, 10) || 20, 1), 100);

    // Base query targets cancellation reversals we create:
    //  - Vendor/platform: { meta.reversal: true } AND reason in ['vendor_share','platform_commission'] AND direction = 'debit'
    //  - User cashback/referral: reason in ['user_cashback_reversal','user_referral_reversal'] AND direction = 'debit'
    const q = {
      bookingId: { $exists: true, $ne: null },
      $or: [
        { 'meta.reversal': true, reason: { $in: ['vendor_share', 'platform_commission'] }, direction: 'debit' },
        { reason: { $in: ['user_cashback_reversal', 'user_referral_reversal'] }, direction: 'debit' },
      ],
    };

    if (vendorId) {
      const vId = oid(vendorId);
      if (!vId) return res.status(400).json({ message: 'Invalid vendorId' });
      q.accountType = 'vendor';
      q.accountId = vId;
    } else if (accountType) {
      q.accountType = String(accountType).toLowerCase();
    }

    if (bookingId) {
      const bId = oid(bookingId);
      if (!bId) return res.status(400).json({ message: 'Invalid bookingId' });
      q.bookingId = bId;
    }

    const startDate = parseDate(start);
    const endDate = parseDate(end);
    if (startDate || endDate) {
      q.createdAt = {};
      if (startDate) q.createdAt.$gte = startDate;
      if (endDate) q.createdAt.$lte = endDate;
    }

    const total = await Ledger.countDocuments(q);
    const rows = await Ledger.find(q)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    // Hydrate account labels (small N, admin-only; safe to do per-row lookups)
    const out = [];
    for (const r of rows) {
      const item = { ...r };
      try {
        if (r.accountType === 'vendor' && r.accountId) {
          const v = await Vendor.findById(r.accountId).select('name email').lean();
          item.accountLabel = v ? (v.name || v.email || String(r.accountId)) : String(r.accountId);
        } else if (r.accountType === 'user' && r.accountId) {
          const u = await User.findById(r.accountId).select('name email').lean();
          item.accountLabel = u ? (u.email || u.name || String(r.accountId)) : String(r.accountId);
        } else if (r.accountType === 'platform') {
          item.accountLabel = 'Platform';
        }
      } catch (_) {
        item.accountLabel = String(r.accountId || r.accountType);
      }
      out.push(item);
    }

    const resp = {
      items: out,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
      filters: {
        vendorId: vendorId || null,
        bookingId: bookingId || null,
        accountType: q.accountType || 'all',
        start: startDate || null,
        end: endDate || null,
      },
      source: 'ledger',
    };

    // Optional legacy audit view from Vendor.payoutHistory (only when vendorId provided)
    if (includeLegacy === '1' && vendorId) {
      try {
        const v = await Vendor.findById(vendorId).select('payoutHistory name email').lean();
        const legacy = (Array.isArray(v?.payoutHistory) ? v.payoutHistory : [])
          .filter(ph => String(ph.status || '').toLowerCase() === 'reversed')
          .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))
          .slice(0, 100); // cap
        resp.legacy = {
          vendor: { id: vendorId, label: v?.name || v?.email || vendorId },
          count: legacy.length,
          items: legacy.map(x => ({
            amount: x.amount,
            status: x.status,
            date: x.date || x.createdAt || null,
            note: x.note || null,
          })),
          source: 'vendor.payoutHistory',
        };
      } catch (_) {
        resp.legacy = { error: 'Failed to load legacy payoutHistory' };
      }
    }

    return res.json(resp);
  } catch (err) {
    console.error('Admin audit error:', err);
    return res.status(500).json({ message: 'Failed to fetch cancellation reversals' });
  }
});

module.exports = router;
