const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel'); // 👈 Make sure this path matches your project

const adminOnly = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    console.error('Admin auth failed:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = adminOnly;
