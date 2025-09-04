// services/kyc/providers/dummy.js
// Simulates approvals so you can test the flow without a real vendor.
module.exports = {
  // returns { approved: boolean, note?: string }
  async identityCheck({ idType, idNumber, name }) {
    // Toy logic: NIN length 11 approves; passport length >= 6 approves
    const ok = (idType === 'nin' && String(idNumber).length === 11)
            || (idType === 'passport' && String(idNumber).length >= 6);
    return { approved: !!ok, note: ok ? 'auto-approved (dummy)' : 'auto-rejected (dummy)' };
  },
  async companyCheck({ cacNumber, businessName }) {
    const ok = String(cacNumber).trim().length >= 6;
    return { approved: !!ok, note: ok ? 'CAC looks valid (dummy)' : 'CAC number too short (dummy)' };
  }
};
