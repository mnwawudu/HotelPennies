// routes/adminVendorAgreement.js
'use strict';

const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');
const adminRole = require('../middleware/adminRole');

const Vendor = require('../models/vendorModel');
const Acceptance = require('../models/vendorAgreementAcceptance');

// 🔐 all routes require signed-in admin
router.use(adminAuth);

/**
 * GET /api/admin/vendor-agreement/signatures
 * Query params:
 *   search  : string (matches vendor name/email/business or hash)
 *   status  : 'all' | 'signed' | 'unsigned' (default 'all')
 *   limit   : number (default 10, max 200)
 *   offset  : number (default 0)
 *
 * Response:
 *  {
 *    data: [{
 *      vendorId, vendorName, vendorEmail, businessName,
 *      accepted, acceptedAt, version, contentHash
 *    }],
 *    total, limit, offset, nextOffset
 *  }
 */
router.get(
  '/vendor-agreement/signatures',
  adminRole(['superadmin', 'manager', 'staff', 'admin']),
  async (req, res) => {
    try {
      const search = String(req.query.search || '').trim();
      const status = (String(req.query.status || 'all').toLowerCase());
      const limit  = Math.min(Math.max(parseInt(req.query.limit  || '10', 10), 1), 200);
      const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

      // ---------- Build vendor query ----------
      const vQuery = {};
      if (search) {
        vQuery.$or = [
          { name:         { $regex: search, $options: 'i' } },
          { email:        { $regex: search, $options: 'i' } },
          { businessName: { $regex: search, $options: 'i' } },
          // fallback/aliases if your model uses other fields
          { companyName:  { $regex: search, $options: 'i' } },
        ];
      }

      // Count vendors that match search
      const total = await Vendor.countDocuments(vQuery);

      // Pull one page of vendors
      const vendors = await Vendor.find(vQuery)
        .select('_id name email businessName companyName createdAt')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean();

      // Early return if empty page
      if (!vendors.length) {
        return res.json({
          data: [],
          total,
          limit,
          offset,
          nextOffset: null,
        });
      }

      // ---------- Load latest acceptance per vendor ----------
      const idStrings = vendors.map(v => String(v._id));

      // Grab all acceptances for these vendors, latest first
      const accepts = await Acceptance.find({
        vendorId: { $in: idStrings },
      })
      .sort({ acceptedAt: -1, createdAt: -1 })
      .lean();

      // Pick latest per vendorId
      const latestByVendor = {};
      for (const a of accepts) {
        const key = String(a.vendorId);
        if (!latestByVendor[key]) {
          latestByVendor[key] = a;
        }
      }

      // ---------- Shape rows for UI ----------
      let rows = vendors.map(v => {
        const key = String(v._id);
        const a = latestByVendor[key];

        const displayName =
          v.name ||
          v.businessName ||
          v.companyName ||
          (a?.vendorName) ||
          '';

        const displayEmail =
          v.email ||
          (a?.vendorEmail) ||
          '';

        return {
          vendorId: String(v._id),
          vendorName: displayName,
          vendorEmail: displayEmail,
          businessName: v.businessName || v.companyName || '',
          accepted: !!(a && (a.accepted || a.acceptedAt)),
          acceptedAt: a?.acceptedAt || null,
          version: a?.version || null,
          contentHash: a?.contentHash || null,
        };
      });

      // Optional status filter after enrichment
      if (status === 'signed') {
        rows = rows.filter(r => r.accepted);
      } else if (status === 'unsigned') {
        rows = rows.filter(r => !r.accepted);
      }

      const nextOffset = offset + limit < total ? offset + limit : null;

      return res.json({
        data: rows,
        total,
        limit,
        offset,
        nextOffset,
      });
    } catch (e) {
      return res.status(500).json({ message: 'Failed to load vendor agreement signatures' });
    }
  }
);

module.exports = router;
