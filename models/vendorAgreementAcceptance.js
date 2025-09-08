const mongoose = require('mongoose');
const { Schema } = mongoose;

const VendorAgreementAcceptanceSchema = new Schema(
  {
    vendorId:   { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    contentHash:{ type: String, required: true, index: true }, // hash of the PDF you served
    version:    { type: String, default: null },               // optional “v1”, etc.
    acceptedAt: { type: Date, default: Date.now },             // when they clicked Agree
    meta:       { type: Schema.Types.Mixed },                  // ip, userAgent, etc. if you store
  },
  {
    timestamps: true,
    collection: 'vendor_agreement_acceptances',
  }
);

// Prevent duplicate acceptances for the same document hash (optional but sensible)
VendorAgreementAcceptanceSchema.index({ vendorId: 1, contentHash: 1 }, { unique: true });

// 👇 The important part: reuse compiled model if it exists
module.exports =
  mongoose.models.VendorAgreementAcceptance ||
  mongoose.model('VendorAgreementAcceptance', VendorAgreementAcceptanceSchema);
