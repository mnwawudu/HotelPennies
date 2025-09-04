// middleware/adminRole.js
module.exports = function (allowedRoles) {
  return (req, res, next) => {
    const { role } = req.user; // decoded from token
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};
