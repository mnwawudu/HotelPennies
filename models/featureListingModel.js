const mongoose = require('mongoose');

const featureListingSchema = new mongoose.Schema(
  {
    // Legacy (rooms-first flow)
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
    },

    // Generic polymorphic target
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // keep optional to support legacy roomId
    },
    resourceType: {
      type: String,
      enum: [
        'room',
        'shortlet',
        'restaurant',
        'menu',
        'eventcenter',
        'tourguide',
        'chop',
        'gift',
      ],
      required: false,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },

    // 🟣 Scope
    featureType: {
      type: String,
      enum: ['local', 'global'],
      required: true,
    },
    // When featureType === 'local', we store the state that this
    // feature is allowed to appear in (derived from the resource).
    state: {
      type: String,
      required: false,
      trim: true,
    },

    // Lifecycle & gating
    isPaid: { type: Boolean, default: false },
    featuredFrom: Date,
    featuredTo: Date,
    // Explicit admin kill-switch. If true, treat as expired immediately.
    disabled: { type: Boolean, default: false },

    // Free-form metadata if needed later
    meta: {},
  },
  {
    timestamps: true,
  }
);

/**
 * Helpful indexes:
 *  - active range queries (public/admin list)
 *  - quick filters by resource type
 */
featureListingSchema.index({
  isPaid: 1,
  disabled: 1,
  featuredFrom: 1,
  featuredTo: 1,
  resourceType: 1,
});
featureListingSchema.index({ vendorId: 1, featureType: 1, resourceType: 1, isPaid: 1 });

module.exports = mongoose.model('FeatureListing', featureListingSchema);
