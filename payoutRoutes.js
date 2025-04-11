// ✅ POST a new payout
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { amount, status } = req.body;

    const newPayout = new Payout({
      userId: req.user.id, // ✅ This must match your schema field exactly
      amount,
      status: status || 'pending',
    });

    await newPayout.save();
    res.status(201).json(newPayout);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
