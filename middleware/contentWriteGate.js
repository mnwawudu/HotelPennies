// middleware/contentWriteGate.js
const adminAuth = require('./adminAuth');
const adminRole = require('./adminRole');

const WRITE_METHODS = new Set(['POST','PUT','PATCH','DELETE']);
const PROTECTED_PREFIXES = [
  '/api/blogs',          // blogs (admin CMS)
  '/api/adverts',        // ads
  '/api/pages',          // CMS pages
  '/api/media',          // media library/uploads
  '/api/reviews'         // review moderation
];

module.exports = function contentWriteGate() {
  return (req, res, next) => {
    // allow reads
    if (!WRITE_METHODS.has(req.method)) return next();

    // gate writes if path matches a protected prefix
    const hit = PROTECTED_PREFIXES.some((p) => req.path.startsWith(p));
    if (!hit) return next();

    // chain adminAuth + role check
    adminAuth(req, res, (err) => {
      if (err) return; // adminAuth already responded if error
      return adminRole(['staff','manager','superadmin'])(req, res, next);
    });
  };
};
