// core/session.js — per-session randomizer.
// FIXED forever: inner-circle names, court card assignments (J/Q/K/A), bosses, Ex identity,
// Reel Rush role assignments (Dwiza WILD, Riddhima MULT, Vedhika SCATTER), paytables.
// RANDOM each session: roulette pockets, wheel segments, card faces 2-10, scratch cast,
// reel symbol faces, celebration photo order.

import { DIVA_IDS, COURT_FACES } from "../data/divas.js";
import { castPick } from "./photos.js";

export const SESSION = {};

export function sessionInit(castList) {
  // Reel Rush: 14 non-special symbol slots wear rotating divas (faces only; pays fixed)
  const others = shuffle(DIVA_IDS.filter(id => id !== "dwiza" && id !== "riddhima" && id !== "vedhika"));
  SESSION.reelWear = {};
  for (let i = 0; i < 14; i++) SESSION.reelWear[i] = others[i % others.length];

  // Roulette: 36 pockets owned by cast (distribution sums to 36), green zero = The Ex (fixed)
  const dist = [1,1,1,1,2,2,2,2,2,2,2,2,2,3,3,3,5];
  const cast = shuffle(castList);
  let ci = 0;
  SESSION.roulette = [];
  for (const c of dist) {
    const w = cast[ci++];
    for (let k = 0; k < c; k++) SESSION.roulette.push({ count:c, cast:w });
  }

  // Squad wheel: 24 segments
  SESSION.wheel = Array.from({ length:24 }, () => castPick(castList));

  // Card faces 2-10: distinct women, shared across all card games this session
  SESSION.cardFaces = {};
  const used = new Set(), usedNames = new Set();
  for (const r of ["2","3","4","5","6","7","8","9","10"]) {
    let c = castPick(castList, used);
    let guard = 0;
    while (usedNames.has(c.name) && guard++ < 50) c = castPick(castList, used);
    used.add(c.key); usedNames.add(c.name);
    SESSION.cardFaces[r] = c;
  }

  // Scratch prize cast (12 winners)
  SESSION.scratch = Array.from({ length:12 }, () => ({
    cast: castPick(castList),
    prize: pick([1.5, 2, 2.5, 3, 4, 5, 8, 10, 15, 25, 40, 100])
  }));

  // Celebration photo pool — shuffled full pool
  SESSION.celebs = shuffle(window.DD?.POOL || []);

  // Crash game cast — pick 8 divas for crash pilot rotation
  SESSION.crashPilots = shuffle(castList).slice(0, 8);

  // Mines cast — 24 photos for mines tiles (1 will be The Ex)
  SESSION.mines = shuffle(castList).slice(0, 24);

  // Plinko buckets — 11 photos
  SESSION.plinko = shuffle(castList).slice(0, 11);
}

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
