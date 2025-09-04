const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');
const Vendor = require('../models/vendorModel');
const Ledger = require('../models/ledgerModel'); // ⬅️ for lifetime earnings

// --- helpers ----------------------------------------------------
const sanitize = (v) => ({
  _id: v._id,
  name: v.name,
  email: v.email,
  phone: v.phone,
  address: v.address,
  kycStatus: v.kycStatus,
  isFullyVerified: !!v.isFullyVerified,
  createdAt: v.createdAt,
  status: v.status, // 'active' | 'closed'
  documents: {
    meansOfId: !!v?.documents?.meansOfId,
    cacCertificate: !!v?.documents?.cacCertificate,
    proofOfAddress: !!v?.documents?.proofOfAddress,
  },
  businessTypes: Array.isArray(v.businessTypes)
    ? v.businessTypes.map((b) => (typeof b === 'string' ? b : b?.serviceType)).filter(Boolean)
    : [],
});

// centralize your "pending" filter so list & count always match
const PENDING_FILTER = {
  kycStatus: { $in: ['PENDING', 'PROCESSING'] },
  // don't show those who are already fully verified (edge-case backfills)
  $or: [{ isFullyVerified: { $exists: false } }, { isFullyVerified: { $ne: true } }],
};

// --- NEW: RICH VENDOR LIST ----------------------------------------------------
/**
 * GET /api/admin/vendors
 */
router.get('/vendors', adminAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit || '500', 10), 1), 1000);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);

    const like = (s) => ({ $regex: s, $options: 'i' });
    const filter = q
      ? {
          $or: [
            { name: like(q) },
            { email: like(q) },
            { phone: like(q) },
            { address: like(q) },
            { state: like(q) },
            { city: like(q) },
            { 'businessTypes.serviceType': like(q) },
          ],
        }
      : {};

    const baseQuery = Vendor.find(filter).sort({ createdAt: -1 });
    if (page > 0) baseQuery.skip((page - 1) * limit).limit(limit);

    const vendors = await baseQuery.lean();
    const ids = vendors.map((v) => v._id);

    // lifetime vendor_share (credits)
    const shareAgg = await Ledger.aggregate([
      { $match: { accountType: 'vendor', accountId: { $in: ids }, reason: 'vendor_share', direction: 'credit' } },
      { $group: { _id: '$accountId', total: { $sum: '$amount' } } },
    ]);

    // cancellation reversals (debits with meta.cancelOf that point to vendor_share)
    const cancelRevAgg = await Ledger.aggregate([
      { $match: { accountType: 'vendor', accountId: { $in: ids }, reason: 'adjustment', direction: 'debit', 'meta.cancelOf': { $exists: true } } },
      { $lookup: { from: 'ledgers', localField: 'meta.cancelOf', foreignField: '_id', as: 'base' } },
      { $unwind: { path: '$base', preserveNullAndEmptyArrays: false } },
      { $match: { 'base.reason': 'vendor_share' } },
      { $group: { _id: '$accountId', total: { $sum: '$amount' } } },
    ]);

    // other adjustments (manual debits not tied to cancelOf)
    const otherAdjAgg = await Ledger.aggregate([
      { $match: {
          accountType: 'vendor',
          accountId: { $in: ids },
          reason: 'adjustment',
          direction: 'debit',
          $or: [{ 'meta.cancelOf': { $exists: false } }, { 'meta.cancelOf': null }],
      }},
      { $group: { _id: '$accountId', total: { $sum: '$amount' } } },
    ]);

    const shareMap  = new Map(shareAgg.map((r) => [String(r._id), Number(r.total || 0)]));
    const cancelMap = new Map(cancelRevAgg.map((r) => [String(r._id), Number(r.total || 0)]));
    const otherMap  = new Map(otherAdjAgg.map((r) => [String(r._id), Number(r.total || 0)]));

    const rows = vendors.map((v) => {
      const docs = v.documents || {};
      const docsOk = !!(docs.meansOfId && docs.cacCertificate && docs.proofOfAddress);
      const rawKyc = String(v.kycStatus || 'PENDING').toUpperCase();
      const displayKyc = (v.isFullyVerified || docsOk || rawKyc === 'APPROVED') ? 'APPROVED' : rawKyc;

      const vs = sanitize(v);
      const share  = shareMap.get(String(v._id))  || 0;
      const cancel = cancelMap.get(String(v._id)) || 0;
      const other  = otherMap.get(String(v._id))  || 0;
      const lifetimeNet = Math.max(0, share - (cancel + other));

      return {
        ...vs,
        // add fields the UI expects explicitly
        state: v.state || '',
        city: v.city || '',
        kycStatus: displayKyc,
        totalEarned: lifetimeNet,
      };
    });

    res.json(rows);
  } catch (err) {
    console.error('[admin] vendors rich list error:', err);
    res.status(500).json({ message: 'Failed to fetch vendors' });
  }
});

// --- LISTS ------------------------------------------------------

/**
 * GET /api/admin/vendors/pending
 * Vendors awaiting approval (PENDING / PROCESSING and not already isFullyVerified)
 */
router.get('/vendors/pending', adminAuth, async (_req, res) => {
  try {
    const rows = await Vendor.find(PENDING_FILTER)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // include state/city and rolled KYC
    const shaped = rows.map((v) => {
      const docs = v.documents || {};
      const docsOk = !!(docs.meansOfId && docs.cacCertificate && docs.proofOfAddress);
      const rawKyc = String(v.kycStatus || 'PENDING').toUpperCase();
      const displayKyc = (v.isFullyVerified || docsOk || rawKyc === 'APPROVED') ? 'APPROVED' : rawKyc;

      return {
        ...sanitize(v),
        state: v.state || '',
        city: v.city || '',
        kycStatus: displayKyc,
      };
    });

    return res.json(shaped);
  } catch (err) {
    console.error('[admin] pending vendors error:', err);
    return res.status(500).json({ message: 'Failed to fetch pending vendors' });
  }
});

/**
 * ✅ NEW: GET /api/admin/vendors/pending/count
 * Cheap count for sidebar badge on "Vendor Approvals"
 */
router.get('/vendors/pending/count', adminAuth, async (_req, res) => {
  try {
    const count = await Vendor.countDocuments(PENDING_FILTER);
    return res.json({ count });
  } catch (err) {
    console.error('[admin] pending count error:', err);
    return res.status(500).json({ message: 'Failed to fetch pending count' });
  }
});

/**
 * GET /api/admin/vendors/approved
 */
router.get('/vendors/approved', adminAuth, async (_req, res) => {
  try {
    const rows = await Vendor.find({ kycStatus: 'APPROVED' })
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();

    const shaped = rows.map((v) => ({
      ...sanitize(v),
      state: v.state || '',
      city: v.city || '',
      kycStatus: 'APPROVED',
    }));

    return res.json(shaped);
  } catch (err) {
    console.error('[admin] approved vendors error:', err);
    return res.status(500).json({ message: 'Failed to fetch approved vendors' });
  }
});

/**
 * GET /api/admin/vendors/rejected
 */
router.get('/vendors/rejected', adminAuth, async (_req, res) => {
  try {
    const rows = await Vendor.find({ kycStatus: 'REJECTED' })
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();

    const shaped = rows.map((v) => ({
      ...sanitize(v),
      state: v.state || '',
      city: v.city || '',
      kycStatus: 'REJECTED',
    }));

    return res.json(shaped);
  } catch (err) {
    console.error('[admin] rejected vendors error:', err);
    return res.status(500).json({ message: 'Failed to fetch rejected vendors' });
  }
});

// --- ACTIONS ----------------------------------------------------

/**
 * POST /api/admin/vendors/:id/approve
 */
router.post('/vendors/:id/approve', adminAuth, async (req, res) => {
  try {
    const v = await Vendor.findById(req.params.id);
    if (!v) return res.status(404).json({ message: 'Vendor not found' });

    v.kycStatus = 'APPROVED';
    v.isFullyVerified = true;
    v.kyc = v.kyc || {};
    v.kyc.checks = v.kyc.checks || {};
    if (v.kyc.checks.identity && v.kyc.checks.identity.status === 'processing') {
      v.kyc.checks.identity.status = 'approved';
      v.kyc.checks.identity.updatedAt = new Date();
    }
    if (v.kyc.checks.company && v.kyc.checks.company.status === 'processing') {
      v.kyc.checks.company.status = 'approved';
      v.kyc.checks.company.updatedAt = new Date();
    }

    await v.save();
    return res.json({ ok: true, message: 'Vendor approved', vendor: sanitize(v) });
  } catch (err) {
    console.error('[admin] approve error:', err);
    return res.status(500).json({ message: 'Failed to approve vendor' });
  }
});

/**
 * POST /api/admin/vendors/:id/reject
 */
router.post('/vendors/:id/reject', adminAuth, async (req, res) => {
  try {
    const v = await Vendor.findById(req.params.id);
    if (!v) return res.status(404).json({ message: 'Vendor not found' });

    v.kycStatus = 'REJECTED';
    v.isFullyVerified = false;
    v.kyc = v.kyc || {};
    v.kyc.checks = v.kyc.checks || {};
    if (v.kyc.checks.identity) {
      v.kyc.checks.identity.status = 'rejected';
      v.kyc.checks.identity.updatedAt = new Date();
      v.kyc.checks.identity.note = req.body?.reason || v.kyc.checks.identity.note || '';
    }
    if (v.kyc.checks.company) {
      v.kyc.checks.company.status = 'rejected';
      v.kyc.checks.company.updatedAt = new Date();
      v.kyc.checks.company.note = req.body?.reason || v.kyc.checks.company.note || '';
    }

    await v.save();
    return res.json({ ok: true, message: 'Vendor rejected', vendor: sanitize(v) });
  } catch (err) {
    console.error('[admin] reject error:', err);
    return res.status(500).json({ message: 'Failed to reject vendor' });
  }
});

/**
 * POST /api/admin/vendors/:id/suspend
 */
router.post('/vendors/:id/suspend', adminAuth, async (req, res) => {
  try {
    const v = await Vendor.findById(req.params.id);
    if (!v) return res.status(404).json({ message: 'Vendor not found' });

    v.status = 'closed';
    v.closedAt = new Date();
    await v.save();

    return res.json({ ok: true, message: 'Vendor suspended', vendor: sanitize(v) });
  } catch (err) {
    console.error('[admin] suspend error:', err);
    return res.status(500).json({ message: 'Failed to suspend vendor' });
  }
});

/**
 * POST /api/admin/vendors/:id/restore
 */
router.post('/vendors/:id/restore', adminAuth, async (req, res) => {
  try {
    const v = await Vendor.findById(req.params.id);
    if (!v) return res.status(404).json({ message: 'Vendor not found' });

    v.status = 'active';
    v.closedAt = null;
    await v.save();

    return res.json({ ok: true, message: 'Vendor restored', vendor: sanitize(v) });
  } catch (err) {
    console.error('[admin] restore error:', err);
    return res.status(500).json({ message: 'Failed to restore vendor' });
  }
});

/**
 * DELETE /api/admin/vendors/:id
 */
router.delete('/vendors/:id', adminAuth, async (req, res) => {
  try {
    const v = await Vendor.findById(req.params.id);
    if (!v) return res.status(404).json({ message: 'Vendor not found' });

    await Vendor.deleteOne({ _id: v._id });
    return res.json({ ok: true, message: 'Vendor deleted' });
  } catch (err) {
    console.error('[admin] delete error:', err);
    return res.status(500).json({ message: 'Failed to delete vendor' });
  }
});

module.exports = router;
