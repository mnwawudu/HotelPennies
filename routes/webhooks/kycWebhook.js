const express = require('express');
const crypto = require('crypto');
const Vendor = require('../../models/vendorModel');
const router = express.Router();

function verifySig(req, secret, headerName = 'x-signature') {
  const sig = req.headers[headerName];
  if (!sig) return false;
  const h = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(h));
}

router.post('/webhooks/kyc/:provider', express.json({ type: '*/*' }), async (req, res) => {
  const provider = req.params.provider.toLowerCase();
  const secret = process.env.KYC_WEBHOOK_SECRET || 'dev';
  if (!verifySig(req, secret)) return res.status(401).end();

  // Map provider payload → updates you need (pseudo below)
  const { vendorId, type, approved, note } = req.body; // adapt to provider shape

  const set = {};
  if (type === 'identity') {
    set['kyc.checks.identity.status'] = approved ? 'approved' : 'rejected';
    set['kyc.checks.identity.note'] = note || '';
    set['kyc.checks.identity.provider'] = provider;
    set['kyc.checks.identity.updatedAt'] = new Date();
  } else if (type === 'company') {
    set['kyc.checks.company.status'] = approved ? 'approved' : 'rejected';
    set['kyc.checks.company.note'] = note || '';
    set['kyc.checks.company.provider'] = provider;
    set['kyc.checks.company.updatedAt'] = new Date();
  }

  await Vendor.updateOne({ _id: vendorId }, { $set: set });

  // recompute final status
  const v = await Vendor.findById(vendorId).lean();
  const idOk  = v?.kyc?.idType === 'none' ? true : v?.kyc?.checks?.identity?.status === 'approved';
  const cacOk = v?.kyc?.cacNumber ? v?.kyc?.checks?.company?.status === 'approved' : true;
  await Vendor.updateOne({ _id: vendorId }, { $set: { kycStatus: (idOk && cacOk) ? 'APPROVED' : 'REJECTED' } });

  res.status(200).end();
});

module.exports = router;
