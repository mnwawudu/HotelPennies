const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../userModel"); // ← corrected path
const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, password, referredBy } = req.body;
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      referredBy: referredBy || null,
    });

    if (referredBy) {
      const referrer = await User.findOne({ email: referredBy });
      if (referrer) {
        referrer.referralCount += 1;
        referrer.commission += 500; // ₦500 reward
        await referrer.save();
      }
    }

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "mySuperSecretKey123", {
      expiresIn: "7d",
    });

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        referredBy: user.referredBy,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "mySuperSecretKey123", {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        referredBy: user.referredBy,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
