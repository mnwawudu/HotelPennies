const mongoose = require('mongoose');

const restaurantBookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional for guest booking
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },

  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },

  bookingType: {
    type: String,
    enum: ['reservation', 'delivery'],
    required: true
  },

  guests: { type: Number }, // for reservations
  reservationTime: { type: Date }, // for reservations

  deliveryLocation: { type: String }, // for deliveries
  pickupOptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PickupDelivery' }, // optional

  menuItems: [
    {
      title: String,
      price: Number,
      quantity: { type: Number, default: 1 }
    }
  ],

  totalPrice: { type: Number, required: true },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  paymentProvider: String,
  paymentReference: String,

  canceled: { type: Boolean, default: false },
  cancellationDate: Date,

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RestaurantBooking', restaurantBookingSchema);
