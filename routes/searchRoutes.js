const express = require('express');
const router = express.Router();

const Hotel = require('../models/hotelModel');
const Shortlet = require('../models/shortletModel');
const Restaurant = require('../models/restaurantModel');
const EventCenter = require('../models/eventCenterModel');
const Chop = require('../models/chopModel');
const Gift = require('../models/giftModel');
const TourGuide = require('../models/tourGuideModel');

/* ----------------------------------------------------------------
   CONFIG (override in .env if needed)
----------------------------------------------------------------- */
const CHEAP_MAX_NGN = Number(process.env.SEARCH_CHEAP_MAX_NGN || 15000);   // cheap = ≤ ₦15k
const LUXURY_MIN_NGN = Number(process.env.SEARCH_LUXURY_MIN_NGN || 200000);

// Nigeria default: breakfast ≈ restaurant. 'hard' means require any breakfast/restaurant signal.
// 'soft' means boost via breakfast but don't require it. 'off' disables linkage.
const BREAKFAST_COUNTS_AS_RESTAURANT = String(
  process.env.SEARCH_BREAKFAST_COUNTS_AS_RESTAURANT || 'hard' // 'off' | 'soft' | 'hard'
).toLowerCase();

const FILLER = new Set([
  'cheap','affordable','budget','luxury','premium',
  'with','and','in','at','near','around','state','city',
  'hotel','hotels','shortlet','shortlets','lodge','lodges',
  'restaurant','restaurants','eventcenter','event','eventcenters',
  'hall','halls','gift','gifts','chop','chops','tours','tour','tourguide','tourguides',
  'breakfast','complimentary','free'
]);

// Location aliases (extend anytime — lowercased)
const LOCATION_ALIASES = {
  'ph': 'port harcourt',
  'phc': 'port harcourt',
  'fct': 'abuja',
  'abuja fct': 'abuja',
  'vi': 'victoria island',
  'v.i.': 'victoria island',
  'ikj': 'ikeja',
  'lag': 'lagos',
  'vgc': 'vgc lekki',
  'ajah': 'ajah lagos',
  'ikorodu': 'ikorodu lagos',
  'gwarinpa': 'gwarinpa abuja',
  'wuse': 'wuse abuja',
  'garki': 'garki abuja',
};

// Amenity aliases (all normalized to canonical keys)
const AMENITY_ALIASES = {
  pool: ['pool','swimming','swimmingpool','swimming-pool','swim','poolside'],
  gym: ['gym','fitness','fitnesscenter','fitness-centre','workout'],
  restaurant: [
    'restaurant','dining','eatery','on-site-restaurant','onsiterestaurant'
  ],
  parking: ['park','parking','carpark','car-park','parkinglot','freeparking','parking-space','parkingspace'],
  breakfast: ['breakfast','free breakfast','complimentary breakfast','continental breakfast','buffet breakfast']
};

const AMENITY_KEYS = Object.keys(AMENITY_ALIASES);

// Utility
const norm = (s='') => String(s).toLowerCase().trim();
const like = (val) => new RegExp(val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

// Parse free text (q)
function parseQuery(raw) {
  const q = norm(raw || '');
  const tokens = q.split(/\s+/).filter(Boolean);

  // Types
  const wants = {
    hotels: /(hotel|hotels|lodge|lodges)/i.test(q),
    shortlets: /(shortlet|shortlets)/i.test(q),
    restaurants: /(restaurant|restaurants)/i.test(q),
    eventcenters: /(event\s?center|eventcenter|halls?|hall)/i.test(q),
    chops: /chops/i.test(q),
    gifts: /gifts?/i.test(q),
    tourguides: /(tour\s?guides?|tours?)/i.test(q),
  };
  const isBroad = !Object.values(wants).some(Boolean);

  // Price intent
  const wantsCheap = /(cheap|affordable|budget)/i.test(q);
  const wantsLuxury = /(luxury|premium)/i.test(q);

  // Amenity hints from free text
  const textAmenities = new Set();
  for (const key of AMENITY_KEYS) {
    const aliases = AMENITY_ALIASES[key];
    if (aliases.some(a => new RegExp(`\\b${a}\\b`, 'i').test(q))) {
      textAmenities.add(key);
    }
  }
  if (/\bbreakfast(s)?\b/i.test(q)) textAmenities.add('breakfast');

  // Build location string (strip fillers & amenity/type words, then alias)
  const rawLocationTokens = tokens
    .filter(t => !FILLER.has(t))
    .filter(t => !AMENITY_KEYS.some(k => AMENITY_ALIASES[k].includes(t)));

  const expanded = rawLocationTokens.map(t => LOCATION_ALIASES[t] || t);
  const location = expanded.join(' ').trim();

  return { wants, isBroad, wantsCheap, wantsLuxury, textAmenities: [...textAmenities], location, rawText: q };
}

// Build location match: name/city/state/address/description
function buildLocationMatch(location) {
  if (!location) return null;
  const rx = like(location);
  return {
    $or: [
      { city: rx },
      { state: rx },
      { address: rx },
      { name: rx },
      { description: rx },
    ]
  };
}

/**
 * Amenity matcher that works with:
 *  1) amenities: ["Free Breakfast","Gym",...]
 *  2) amenities: { gym: true, pool: true, restaurant: true, ... }
 *  3) flat booleans: hasGym / gym / features.gym
 *  4) special breakfast booleans: breakfastIncluded / complimentaryBreakfast / freeBreakfast
 * It also implements the breakfast⇔restaurant policy for Nigeria.
 */
function buildAmenityMatch(keys) {
  if (!keys?.length) return null;

  const canonical = new Set(keys.map(k => norm(k)));

  // If restaurant requested, optionally include breakfast signals (policy)
  const includeBreakfastViaPolicy = canonical.has('restaurant') && BREAKFAST_COUNTS_AS_RESTAURANT === 'hard';
  if (includeBreakfastViaPolicy) canonical.add('breakfast');

  const orsForAllRequested = [];

  for (const key of canonical) {
    const cap = key.charAt(0).toUpperCase() + key.slice(1);
    const aliasSet = AMENITY_ALIASES[key] || [key];
    const rx = new RegExp(aliasSet.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');

    // Array-of-strings shape: amenities: [...]
    const arrayExpr = {
      $gt: [
        {
          $size: {
            $filter: {
              input: {
                $cond: [
                  { $isArray: '$amenities' },
                  '$amenities',
                  [] // if not array, avoid pipeline error
                ]
              },
              as: 'am',
              cond: { $regexMatch: { input: '$$am', regex: rx } }
            }
          }
        },
        0
      ]
    };

    // Object-of-booleans shape: amenities: { gym: true, ... }
    // Check common paths directly to keep the pipeline simple/fast
    const objectBoolExpr = {
      $or: [
        { [`amenities.${key}`]: true },
        { [`amenities.has${cap}`]: true },
        { [`amenities.features.${key}`]: true },
      ]
    };

    // Flat booleans / feature flags people often add
    const flatBoolExpr = {
      $or: [
        { [`has${cap}`]: true },
        { [key]: true },
        { [`features.${key}`]: true },
      ]
    };

    // Breakfast extras (very common)
    const breakfastExtras = (key === 'breakfast')
      ? {
          $or: [
            { breakfastIncluded: true },
            { complimentaryBreakfast: true },
            { freeBreakfast: true },
            { ['amenities.breakfastIncluded']: true },
            { ['amenities.complimentaryBreakfast']: true },
            { ['amenities.freeBreakfast']: true },
          ]
        }
      : null;

    const anyTrueForKey = {
      $or: [
        { $expr: arrayExpr },
        objectBoolExpr,
        flatBoolExpr,
        ...(breakfastExtras ? [breakfastExtras] : [])
      ]
    };

    orsForAllRequested.push(anyTrueForKey);
  }

  // Require ALL requested amenity keys (AND). If you prefer ANY, switch to {$or: orsForAllRequested}
  return { $and: orsForAllRequested };
}

function buildPriceMatch({ wantsCheap, wantsLuxury }) {
  const clauses = [];
  if (wantsCheap) {
    clauses.push({ $or: [{ price: { $lte: CHEAP_MAX_NGN } }, { promoPrice: { $lte: CHEAP_MAX_NGN } }] });
  }
  if (wantsLuxury) {
    clauses.push({ $or: [{ price: { $gte: LUXURY_MIN_NGN } }, { promoPrice: { $gte: LUXURY_MIN_NGN } }] });
  }
  if (!clauses.length) return null;
  return { $and: clauses };
}

// Compose a query for a given collection type
function buildQueryFor(type, { location, amenities, wantsCheap, wantsLuxury }) {
  const and = [];
  const loc = buildLocationMatch(location);
  if (loc) and.push(loc);

  // Apply amenity filters only to lodging-style collections
  const amenityTargets = new Set(['hotels','shortlets','eventcenters']);
  if (amenities?.length && amenityTargets.has(type)) {
    const amen = buildAmenityMatch(amenities);
    if (amen) and.push(amen);
  }

  const price = buildPriceMatch({ wantsCheap, wantsLuxury });
  if (price && (type === 'hotels' || type === 'shortlets')) and.push(price);

  return and.length ? { $and: and } : {};
}

/* ----------------------------------------------------------------
   SEARCH
   - Accepts ?q= and/or ?location= / ?city=
   - Accepts explicit:
       ?amenities=pool,gym,restaurant  (breakfast→restaurant handled by policy)
       ?cheap=1
       ?intents=hotels,shortlets,...
   - Fallback: if hotels/shortlets/eventcenters empty with amenity filter,
               re-run WITHOUT amenity filter (keeps users from seeing blanks)
----------------------------------------------------------------- */
router.get('/', async (req, res) => {
  try {
    const raw =
      req.query.q ||
      req.query.location ||
      req.query.city ||
      '';

    const parsed = parseQuery(raw);

    // overlay explicit query params from client (belt & braces)
    const intentsParam = String(req.query.intents || '')
      .split(',')
      .map(s => norm(s))
      .filter(Boolean);

    const amenitiesParam = String(req.query.amenities || '')
      .split(',')
      .map(s => norm(s))
      .filter(Boolean);

    const mergedAmenities = new Set([
      ...parsed.textAmenities,
      ...amenitiesParam
    ]);
    const amenities = [...mergedAmenities];

    const wantsCheap = parsed.wantsCheap || ['1','true','yes'].includes(String(req.query.cheap || '').toLowerCase());
    const wantsLuxury = parsed.wantsLuxury;

    const location = parsed.location || norm(req.query.location || req.query.city || '');

    // Decide which collections to hit. If explicit intents present, they win.
    const wants = parsed.wants;
    const isBroad = !intentsParam.length && parsed.isBroad;

    const runHotels      = (isBroad || wants.hotels)      || intentsParam.includes('hotels');
    const runShortlets   = (isBroad || wants.shortlets)   || intentsParam.includes('shortlets');
    const runRestaurants = (isBroad || wants.restaurants) || intentsParam.includes('restaurants');
    const runEventCtrs   = (isBroad || wants.eventcenters)|| intentsParam.includes('eventcenters');
    const runChops       = (isBroad || wants.chops)       || intentsParam.includes('chops');
    const runGifts       = (isBroad || wants.gifts)       || intentsParam.includes('gifts');
    const runGuides      = (isBroad || wants.tourguides)  || intentsParam.includes('tourguides');

    // Sorting: if cheap, prioritize lowest price/promoPrice; otherwise default order
    const cheapSortStage = wantsCheap ? { $sort: { promoPrice: 1, price: 1 } } : null;

    const agg = (type, Model, match) => {
      const p = [{ $match: match }];
      if (cheapSortStage && (type === 'hotels' || type === 'shortlets' || type === 'eventcenters')) {
        p.push(cheapSortStage);
      }
      return Model.aggregate(p).limit(500);
    };

    const matchFor = (type, useAmenities = true) =>
      buildQueryFor(type, {
        location,
        amenities: useAmenities ? amenities : [],
        wantsCheap,
        wantsLuxury
      });

    // 1) Primary queries
    const [
      hotels1,
      shortlets1,
      restaurants1,
      eventcenters1,
      chops1,
      gifts1,
      tourguides1
    ] = await Promise.all([
      runHotels      ? agg('hotels',       Hotel,       matchFor('hotels', true))       : Promise.resolve([]),
      runShortlets   ? agg('shortlets',    Shortlet,    matchFor('shortlets', true))    : Promise.resolve([]),
      runRestaurants ? agg('restaurants',  Restaurant,  matchFor('restaurants', true))  : Promise.resolve([]),
      runEventCtrs   ? agg('eventcenters', EventCenter, matchFor('eventcenters', true)) : Promise.resolve([]),
      runChops       ? agg('chops',        Chop,        matchFor('chops', true))        : Promise.resolve([]),
      runGifts       ? agg('gifts',        Gift,        matchFor('gifts', true))        : Promise.resolve([]),
      runGuides      ? agg('tourguides',   TourGuide,   matchFor('tourguides', true))   : Promise.resolve([]),
    ]);

    let hotels = hotels1;
    let shortlets = shortlets1;
    let eventcenters = eventcenters1;

    // 2) Graceful fallback if amenity filter made lists empty
    const hadAmenityFilter = amenities.length > 0;

    const needHotelsFallback = runHotels && hadAmenityFilter && hotels1.length === 0;
    const needShortletsFallback = runShortlets && hadAmenityFilter && shortlets1.length === 0;
    const needEventCtrsFallback = runEventCtrs && hadAmenityFilter && eventcenters1.length === 0;

    if (needHotelsFallback || needShortletsFallback || needEventCtrsFallback) {
      const [
        hotels2,
        shortlets2,
        eventcenters2
      ] = await Promise.all([
        needHotelsFallback      ? agg('hotels',       Hotel,       matchFor('hotels', false))       : Promise.resolve(hotels1),
        needShortletsFallback   ? agg('shortlets',    Shortlet,    matchFor('shortlets', false))    : Promise.resolve(shortlets1),
        needEventCtrsFallback   ? agg('eventcenters', EventCenter, matchFor('eventcenters', false)) : Promise.resolve(eventcenters1),
      ]);
      hotels = hotels2;
      shortlets = shortlets2;
      eventcenters = eventcenters2;
    }

    // 3) Breakfast ⇔ Restaurant “soft” boost (optional; does not filter, just sorts slightly)
    const needsSoftBoost = BREAKFAST_COUNTS_AS_RESTAURANT === 'soft' && amenities.includes('restaurant');
    if (needsSoftBoost && (hotels?.length || shortlets?.length)) {
      const boost = (arr) => [...arr].sort((a, b) => {
        const ab = !!(a.breakfastIncluded || a.complimentaryBreakfast || a.freeBreakfast ||
                      a?.amenities?.breakfastIncluded || a?.amenities?.complimentaryBreakfast || a?.amenities?.freeBreakfast);
        const bb = !!(b.breakfastIncluded || b.complimentaryBreakfast || b.freeBreakfast ||
                      b?.amenities?.breakfastIncluded || b?.amenities?.complimentaryBreakfast || b?.amenities?.freeBreakfast);
        return (bb ? 1 : 0) - (ab ? 1 : 0);
      });
      if (hotels?.length) hotels = boost(hotels);
      if (shortlets?.length) shortlets = boost(shortlets);
    }

    // Minimal quick logging (safe in prod)
    console.log('[search] q=%s | loc=%s | intents=%o | amenities=%o | cheap=%s | out={H:%d S:%d R:%d E:%d C:%d G:%d T:%d}',
      req.query.q || req.query.city || req.query.location || '',
      location,
      intentsParam,
      amenities,
      wantsCheap,
      (hotels || []).length,
      (shortlets || []).length,
      (restaurants1 || []).length,
      (eventcenters || []).length,
      (chops1 || []).length,
      (gifts1 || []).length,
      (tourguides1 || []).length
    );

    res.json({
      hotels,
      shortlets,
      restaurants: restaurants1,
      eventcenters,
      chops: chops1,
      gifts: gifts1,
      tourguides: tourguides1
    });
  } catch (err) {
    console.error('❌ Search error:', err);
    res.status(500).json({ message: 'Failed to search listings' });
  }
});

/* ----------------------------------------------------------------
   SUGGESTIONS (typeahead)
----------------------------------------------------------------- */
router.get('/suggest', async (req, res) => {
  try {
    const q = norm(req.query.q || '');
    if (!q) return res.json({ suggestions: [] });

    const alias = LOCATION_ALIASES[q] || null;
    const rx = like(alias || q);

    const collectDistinct = async (Model, fields) => {
      const ors = fields.map(f => ({ [f]: rx }));
      const docs = await Model.find({ $or: ors }).select(fields.join(' ')).limit(100).lean();
      const out = new Set();
      docs.forEach(d => fields.forEach(f => d[f] && out.add(d[f])));
      return [...out];
    };

    const [a,b,c,d,e,f,g] = await Promise.all([
      collectDistinct(Hotel,       ['city','state','name']),
      collectDistinct(Shortlet,    ['city','state','name']),
      collectDistinct(Restaurant,  ['city','state','name']),
      collectDistinct(EventCenter, ['city','state','name']),
      collectDistinct(Chop,        ['city','state','name']),
      collectDistinct(Gift,        ['city','state','name']),
      collectDistinct(TourGuide,   ['city','state','name']),
    ]);

    const set = new Set([].concat(a,b,c,d,e,f,g).filter(Boolean).map(norm));
    const suggestions = [...set]
      .map(s => s.replace(/\s+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()))
      .slice(0, 12);

    res.json({ suggestions });
  } catch (err) {
    console.error('❌ Suggest error:', err);
    res.status(500).json({ suggestions: [] });
  }
});

module.exports = router;
