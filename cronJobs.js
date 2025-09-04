const cron = require('node-cron');
const Booking = require('./models/bookingModel');

const completePendingBookings = async () => {
  const now = new Date();

  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago

  const bookings = await Booking.find({
    status: 'pending',
    $or: [
      { checkInDate: { $lte: now } },
      { date: { $lte: cutoff } }
    ]
  });

  for (const booking of bookings) {
    booking.status = 'completed';
    await booking.save();
  }

  console.log(`${bookings.length} bookings marked as completed`);
};

// Run every midnight
cron.schedule('0 0 * * *', () => {
  console.log('Running auto-complete cron...');
  completePendingBookings();
});
