// middleware/adminRole.js
module.exports = function adminRole(allowed) {
  const allowedSet = new Set(
    (Array.isArray(allowed) ? allowed : [allowed]).map(String)
  );
  return (req, res, next) => {
    const role = req.admin?.role || req.user?.role;
    if (!role) return res.status(401).json({ message: 'Not authenticated' });
    if (!allowedSet.has(role)) return res.status(403).json({ message: 'Access denied' });
    return next();
  };
};
