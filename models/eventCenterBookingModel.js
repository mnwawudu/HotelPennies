const mongoose = require('mongoose');

// (optional) load EventCenter so we can backfill vendorId if missing
let EventCenter;
try { EventCenter = require('./eventCenterModel'); } catch (_) { /* ignore */ }

// Format YYYY-MM-DD from a Date
function toDateOnlyString(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Anchor date to 12:00:00 UTC on the same calendar day
function normalizeNoonUTC(value) {
  if (!value) return value;
  const d = new Date(value);
  const y = d.getFullYear();        // use local parts to preserve chosen calendar day
  const m = d.getMonth();
  const day = d.getDate();
  return new Date(Date.UTC(y, m, day, 12, 0, 0, 0));
}

// Map loose payment method inputs → strict enum
function normalizePaymentMethod(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return v;
  if (s.startsWith('pay')) return 'Paystack';
  if (s.startsWith('flut')) return 'Flutterwave';
  return v; // let mongoose enum catch truly invalid values
}

const eventCenterBookingSchema = new mongoose.Schema({
  eventCenterId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventCenter', required: true, index: true },
  vendorId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true }, // 👈 vendor owner

  fullName: { type: String, required: true, trim: true },
  email:    { type: String, required: true, index: true, trim: true, lowercase: true },
  phone:    { type: String, required: true, trim: true },

  // Store as Date anchored at noon UTC, plus a YYYY-MM-DD string for UI/emails
  eventDate:      { type: Date, required: true, set: normalizeNoonUTC, index: true },
  eventDateLocal: { type: String, default: null }, // 'YYYY-MM-DD' for display/receipts

  guests: { type: Number, required: true, min: 1 },
  amount: { type: Number, required: true, min: 0 },

  // Accept paymentRef or paymentReference (compat)
  paymentRef:    { type: String, required: true, index: true, trim: true },
  paymentMethod: { type: String, enum: ['Paystack', 'Flutterwave'], required: true, set: normalizePaymentMethod },

  // ✅ cancel state
  canceled:         { type: Boolean, default: false, index: true },
  cancellationDate: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now }
});

// --- Pre-validate: fill gaps safely (no behavior removed) ---
eventCenterBookingSchema.pre('validate', async function(next) {
  try {
    // Allow either paymentRef or paymentReference
    if (!this.paymentRef && this.paymentReference) {
      this.paymentRef = String(this.paymentReference);
    }

    // Ensure eventDate is normalized + local string persists
    if (this.eventDate) {
      const nd = normalizeNoonUTC(this.eventDate);
      this.eventDate = nd;
      if (!this.eventDateLocal) this.eventDateLocal = toDateOnlyString(nd);
    }

    // Backfill vendorId from EventCenter if not provided
    if (!this.vendorId && this.eventCenterId && EventCenter) {
      const ec = await EventCenter.findById(this.eventCenterId).select('vendorId').lean();
      if (ec?.vendorId) this.vendorId = ec.vendorId;
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Keep eventDateLocal in sync on save (your original logic, retained)
eventCenterBookingSchema.pre('save', function(next) {
  if (this.isModified('eventDate') && this.eventDate) {
    this.eventDate = normalizeNoonUTC(this.eventDate);
    this.eventDateLocal = toDateOnlyString(this.eventDate);
  }
  next();
});

// Also normalize during updates
eventCenterBookingSchema.pre('findOneAndUpdate', function(next) {
  const u = this.getUpdate() || {};
  const s = u.$set || u;

  if (s.eventDate) {
    const nd = normalizeNoonUTC(s.eventDate);
    if (u.$set) {
      u.$set.eventDate = nd;
      u.$set.eventDateLocal = toDateOnlyString(nd);
    } else {
      u.eventDate = nd;
      u.eventDateLocal = toDateOnlyString(nd);
    }
  }

  // Accept paymentReference on updates too
  if (s.paymentReference && !s.paymentRef) {
    if (u.$set) u.$set.paymentRef = s.paymentReference;
    else u.paymentRef = s.paymentReference;
  }

  // Normalize paymentMethod case on updates
  if (s.paymentMethod) {
    const nm = normalizePaymentMethod(s.paymentMethod);
    if (u.$set) u.$set.paymentMethod = nm;
    else u.paymentMethod = nm;
  }

  next();
});

module.exports = mongoose.model('EventCenterBooking', eventCenterBookingSchema);
