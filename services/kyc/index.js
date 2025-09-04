// services/kyc/index.js
const Vendor = require('../../models/vendorModel');

const PROVIDER = (process.env.KYC_PROVIDER || 'dummy').toLowerCase();

// lazy-load provider so you can swap vendors by ENV only
let provider;
switch (PROVIDER) {
  case 'prembly': provider = require('./providers/prembly'); break;
  case 'dojah':   provider = require('./providers/dojah');   break;
  default:        provider = require('./providers/dummy');   break;
}

function now() { return new Date(); }

async function startKycChecks(vendorId) {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) return;

  // set PROCESSING
  vendor.kycStatus = 'PROCESSING';

  // Identity check (NIN/passport) if present
  if (vendor.kyc?.idType && vendor.kyc?.idType !== 'none' && vendor.kyc?.idNumber) {
    vendor.kyc.checks.identity.status = 'processing';
    vendor.kyc.checks.identity.provider = PROVIDER;
    vendor.kyc.checks.identity.updatedAt = now();
  }

  // Company check if CAC number provided
  if (vendor.kyc?.cacNumber) {
    vendor.kyc.checks.company.status = 'processing';
    vendor.kyc.checks.company.provider = PROVIDER;
    vendor.kyc.checks.company.updatedAt = now();
  }

  await vendor.save();

  // run checks asynchronously (don’t block the request)
  queueMicrotask(async () => {
    try {
      // Identity
      if (vendor.kyc?.idType !== 'none' && vendor.kyc?.idNumber) {
        try {
          const r = await provider.identityCheck({
            idType: vendor.kyc.idType,
            idNumber: vendor.kyc.idNumber,
            name: vendor.name // you can split to first/last if required
          });
          await Vendor.updateOne(
            { _id: vendor._id },
            {
              $set: {
                'kyc.checks.identity.status': r.approved ? 'approved' : 'rejected',
                'kyc.checks.identity.note': r.note || '',
                'kyc.checks.identity.updatedAt': now()
              }
            }
          );
        } catch (err) {
          await Vendor.updateOne(
            { _id: vendor._id },
            {
              $set: {
                'kyc.checks.identity.status': 'rejected',
                'kyc.checks.identity.note': `provider_error: ${err.message}`,
                'kyc.checks.identity.updatedAt': now()
              }
            }
          );
        }
      }

      // Company (CAC)
      if (vendor.kyc?.cacNumber) {
        try {
          const r = await provider.companyCheck({
            cacNumber: vendor.kyc.cacNumber,
            businessName: vendor.name // or a dedicated business name field
          });
          await Vendor.updateOne(
            { _id: vendor._id },
            {
              $set: {
                'kyc.checks.company.status': r.approved ? 'approved' : 'rejected',
                'kyc.checks.company.note': r.note || '',
                'kyc.checks.company.updatedAt': now()
              }
            }
          );
        } catch (err) {
          await Vendor.updateOne(
            { _id: vendor._id },
            {
              $set: {
                'kyc.checks.company.status': 'rejected',
                'kyc.checks.company.note': `provider_error: ${err.message}`,
                'kyc.checks.company.updatedAt': now()
              }
            }
          );
        }
      }

      // compute final status
      const v2 = await Vendor.findById(vendor._id).lean();
      const idOk  = v2?.kyc?.idType === 'none' ? true : v2?.kyc?.checks?.identity?.status === 'approved';
      const cacOk = v2?.kyc?.cacNumber ? v2?.kyc?.checks?.company?.status === 'approved' : true;

      await Vendor.updateOne(
        { _id: vendor._id },
        { $set: { kycStatus: (idOk && cacOk) ? 'APPROVED' : 'REJECTED' } }
      );
    } catch (e) {
      await Vendor.updateOne({ _id: vendor._id }, { $set: { kycStatus: 'REJECTED' } });
    }
  });
}

module.exports = { startKycChecks };
