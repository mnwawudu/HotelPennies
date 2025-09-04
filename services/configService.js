// services/configService.js
// Runtime config with DB-first, ENV-second, default-last strategy.
// Now with key ALIASES so camelCase (admin UI) and snake_case (ledger) both work.

const Setting = require('../models/settingModel');

let CACHE = Object.create(null);

// Map of the keys your ledger uses → alternate admin/UI keys we also accept.
const ALIASES = new Map([
  // lodging / hotel
  ['platform_pct_lodging',        ['platformPctLodging']],
  ['cashback_pct_lodging',        ['cashbackPctHotel', 'cashbackPctLodging', 'cashbackPct']],
  ['referral_pct_lodging',        ['referralPctHotel', 'referralPctLodging', 'referralPct']],

  // default non-lodging
  ['platform_pct_default',        ['platformPctDefault']],

  // flags
  ['platform_matures_with_vendor',['platformMaturesWithVendor']],
]);

function readFromCacheWithAlias(key) {
  // 1) direct
  if (Object.prototype.hasOwnProperty.call(CACHE, key)) return CACHE[key];

  // 2) alias list
  const alts = ALIASES.get(key);
  if (Array.isArray(alts)) {
    for (const alt of alts) {
      if (Object.prototype.hasOwnProperty.call(CACHE, alt)) {
        return CACHE[alt];
      }
    }
  }

  // 3) also try the reverse direction (camelCase ask with snake stored)
  for (const [snake, list] of ALIASES.entries()) {
    if (list.includes(key) && Object.prototype.hasOwnProperty.call(CACHE, snake)) {
      return CACHE[snake];
    }
  }

  // 4) not found
  return undefined;
}

/** Load settings from DB into memory. */
async function load(force = false) {
  if (!force && Object.keys(CACHE).length) return CACHE;
  const docs = await Setting.find({}).lean();
  CACHE = Object.fromEntries(docs.map(d => [d.key, d.value]));
  return CACHE;
}

/** Force-refresh cache (use on startup or after admin updates). */
async function prime() {
  return load(true);
}

/** ENV → Number; if missing or invalid, return def. */
function envNumber(name, def) {
  if (!(name in process.env)) return def;
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : def;
}

/** ENV → Boolean; recognizes: 1/true/yes/on and 0/false/no/off. */
function envBool(name, def) {
  const raw = String(process.env[name] ?? '').toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false;
  return def;
}

/**
 * Get a numeric value stored as a FRACTION (0..1).
 * - DB: if number > 1, normalize to fraction (divide by 100).
 * - ENV: if number > 1, assume percent and divide by 100.
 * - Default: defFraction (already a fraction).
 */
function getFraction(key, envName, defFraction) {
  const fromDb = readFromCacheWithAlias(key);
  if (typeof fromDb === 'number') {
    return fromDb > 1 ? fromDb / 100 : fromDb; // tolerate wrong units in DB
  }
  const envVal = envNumber(envName, null);
  if (envVal === null) return defFraction;
  return envVal > 1 ? envVal / 100 : envVal;
}

/** Get a plain number from DB or ENV or default. */
function getNumber(key, envName, defNumber) {
  const fromDb = readFromCacheWithAlias(key);
  if (typeof fromDb === 'number') return fromDb;
  return envNumber(envName, defNumber);
}

/** Get a boolean from DB or ENV or default. */
function getBoolean(key, envName, defBool) {
  const fromDb = readFromCacheWithAlias(key);
  if (typeof fromDb === 'boolean') return fromDb;
  return envBool(envName, defBool);
}

module.exports = {
  load,
  prime,
  getFraction,
  getNumber,
  getBoolean,
};
