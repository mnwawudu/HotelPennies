// ✅ models/hotelBookingModel.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

// A single room line in a booking (snapshot fields to protect against later price changes)
const RoomItemSchema = new Schema(
  {
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    // Optional snapshots to make reporting stable even if room changes later
    roomNameSnapshot: { type: String },
    roomTypeSnapshot: { type: String },

    qty: { type: Number, min: 1, default: 1 },

    // Snapshot of nightly price at time of booking
    pricePerNight: { type: Number, min: 0, required: true },

    // Optional per-line taxes/fees snapshots if you use them
    taxes: { type: Number, min: 0, default: 0 },
    fees: { type: Number, min: 0, default: 0 },

    // Computed by pre-validate: qty * nights * pricePerNight + taxes + fees
    subtotal: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const hotelBookingSchema = new Schema(
  {
    // Guest
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },

    // Stay window (applies to all rooms in this booking)
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, min: 1 }, // auto-computed

    // Hotel
    hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true },

    // ✅ NEW: Multi-room lines
    rooms: {
      type: [RoomItemSchema],
      // Back-compat validator: either rooms[] has items OR legacy 'room' + 'price' provided
      validate: {
        validator: function (arr) {
          const hasLines = Array.isArray(arr) && arr.length > 0;
          const hasLegacy = !!(this.room && (this.price || this.price === 0));
          return hasLines || hasLegacy;
        },
        message: 'At least one room line is required.',
      },
    },

    // Booking-level rollups (computed)
    currency: { type: String, default: 'NGN' },
    subtotal: { type: Number, min: 0, default: 0 }, // sum of (qty * nights * pricePerNight)
    taxes: { type: Number, min: 0, default: 0 },    // sum of room line taxes (if any)
    fees: { type: Number, min: 0, default: 0 },     // sum of room line fees (if any)
    total: { type: Number, min: 0, default: 0 },    // subtotal + taxes + fees

    // Payment
    paymentReference: { type: String },
    paymentProvider: { type: String },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },

    // Status
    canceled: { type: Boolean, default: false },
    cancellationDate: { type: Date },

    // Notes
    specialRequests: { type: String },

    // Legacy single-room fields (kept for backward compatibility with existing data)
    room: { type: Schema.Types.ObjectId, ref: 'Room' }, // legacy
    price: { type: Number },                            // legacy (interpreted as total or nightly—see pre-validate)
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

// Helpful indexes
hotelBookingSchema.index({ hotel: 1, checkIn: 1 });
hotelBookingSchema.index({ email: 1, createdAt: -1 });

// ---------- Helpers ----------
function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 1;
  const ms = new Date(checkOut).setHours(0, 0, 0, 0) - new Date(checkIn).setHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

// ---------- Pre-validate: normalize + compute subtotals/totals ----------
hotelBookingSchema.pre('validate', function (next) {
  try {
    // nights
    this.nights = calcNights(this.checkIn, this.checkOut);

    // Back-compat: If no rooms[] were provided but legacy room+price exist,
    // normalize into a single line item. We’ll treat legacy 'price' as TOTAL if it looks like a total,
    // otherwise as nightly. A simple heuristic: if price < 10x typical night, assume nightly.
    if ((!this.rooms || this.rooms.length === 0) && this.room && (this.price || this.price === 0)) {
      const priceNum = Number(this.price || 0);
      // crude heuristic—adjust as needed:
      const assumeNightly = priceNum <= 200000; // many nightly rates are well below this; tweak for your context
      const nightly = assumeNightly ? priceNum : Math.round(priceNum / this.nights) || priceNum;

      this.rooms = [
        {
          room: this.room,
          qty: 1,
          pricePerNight: nightly,
          taxes: 0,
          fees: 0,
          subtotal: 0, // computed below
        },
      ];
    }

    // Compute per-line subtotals and booking totals
    let subtotal = 0;
    let taxes = 0;
    let fees = 0;

    if (Array.isArray(this.rooms)) {
      this.rooms.forEach((line) => {
        const qty = Math.max(1, Number(line.qty || 1));
        const nightly = Math.max(0, Number(line.pricePerNight || 0));
        const base = nightly * qty * this.nights;
        const lineTaxes = Math.max(0, Number(line.taxes || 0));
        const lineFees = Math.max(0, Number(line.fees || 0));

        line.subtotal = Math.round(base + lineTaxes + lineFees);

        subtotal += base;
        taxes += lineTaxes;
        fees += lineFees;
      });
    }

    this.subtotal = Math.round(subtotal);
    this.taxes = Math.round(taxes);
    this.fees = Math.round(fees);
    this.total = Math.round(this.subtotal + this.taxes + this.fees);

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('HotelBooking', hotelBookingSchema);
