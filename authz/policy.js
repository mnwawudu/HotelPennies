// authz/policy.js
// Map roles -> permissions. Keep minimal now; expand later.
const ROLE_PERMS = {
  superadmin: ['*'],
  admin: ['vendor:*','user:view','content:manage','payout:view','ledger:read'],
  'admin.ops': ['vendor:*','user:view','content:manage','payout:view','ledger:read'],
  'finance.maker': ['payout:view','payout:process','ledger:read'],
  'finance.checker': ['payout:view','payout:approve','payout:cancel','ledger:read'],
  support: ['vendor:view','user:view','payout:view'],
  'content.editor': ['content:manage'],
  'analyst.ro': ['ledger:read','payout:view','vendor:view','user:view'],
  'auditor.ro': ['ledger:read','adminlog:view'],
};

function expandPerms(admin) {
  const roles = (Array.isArray(admin.roles) ? admin.roles : [])
    .concat(admin.role ? [admin.role] : []);
  const viaRoles = roles.flatMap(r => ROLE_PERMS[r] || []);
  return new Set([...(admin.perms || []), ...viaRoles]);
}

function hasPerm(admin, need) {
  const p = expandPerms(admin);
  if (p.has('*')) return true;
  if (p.has(need)) return true;
  const [dom] = String(need).split(':');
  return p.has(`${dom}:*`);
}

exports.requirePerm = (...needs) => (req, res, next) => {
  const a = req.admin;
  if (!a) return res.status(401).json({ message: 'Unauthorized' });
  const ok = needs.some(n => hasPerm(a, n));
  if (!ok) return res.status(403).json({ message: 'Forbidden' });
  return next();
};
