// routes/adminLedgerRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const Ledger = require('../models/ledgerModel');

/* -------- Admin auth (role-based) -------- */
const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Accept any of these roles as "admin"
    const role = String(decoded.role || '').toLowerCase();
    if (!['admin', 'superadmin', 'ops'].includes(role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.admin = { id: decoded.id, role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

/* -------- Helpers -------- */
const isObjectId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

/**
 * GET /api/admin/ledger/audit
 * Query params:
 *  - accountType: 'user' | 'vendor' | 'platform'
 *  - accountId: ObjectId (optional when accountType='platform')
 *  - bookingId: ObjectId
 *  - reason: enum from model
 *  - direction: 'credit' | 'debit'
 *  - status: 'pending' | 'available'
 *  - dateFrom, dateTo: ISO datetime
 *  - page (default 1), pageSize (default 50, max 200)
 */
router.get('/audit', adminAuth, async (req, res) => {
  try {
    const {
      accountType,
      accountId,
      bookingId,
      reason,
      direction,
      status,
      dateFrom,
      dateTo,
    } = req.query;

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '50', 10), 1), 200);

    const filter = {};

    if (accountType) filter.accountType = String(accountType).toLowerCase();
    if (accountId && isObjectId(accountId)) filter.accountId = new mongoose.Types.ObjectId(accountId);
    if (bookingId && isObjectId(bookingId)) filter.bookingId = new mongoose.Types.ObjectId(bookingId);
    if (reason) filter.reason = String(reason);
    if (direction) filter.direction = String(direction);
    if (status) filter.status = String(status);

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const [total, rows, sums] = await Promise.all([
      Ledger.countDocuments(filter),
      Ledger.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      // quick aggregates for the current filter
      Ledger.aggregate([
        { $match: Object.keys(filter).length ? filter : {} },
        {
          $group: {
            _id: '$direction',
            amount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    let totalCredits = 0;
    let totalDebits = 0;
    for (const g of sums) {
      if (g._id === 'credit') totalCredits = g.amount || 0;
      if (g._id === 'debit') totalDebits = g.amount || 0;
    }

    res.json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
      totals: {
        credits: totalCredits,
        debits: totalDebits,
        net: totalCredits - totalDebits,
      },
      rows,
    });
  } catch (err) {
    console.error('Admin ledger audit error:', err);
    res.status(500).json({ message: 'Failed to load ledger audit' });
  }
});

module.exports = router;
