// core/voice.js — voice bible system. Each diva has lines for greet / winSmall / winBig / winMega
// / jackpot / lose / bonus / idle. Used across games for personality-driven dialogue.

import { DIVAS } from "../data/divas.js";

// pick a random line for a diva + mood
export function line(divaId, mood = "winSmall") {
  const d = DIVAS[divaId];
  if (!d || !d.voice || !d.voice[mood]) return "";
  const arr = d.voice[mood];
  return arr[Math.floor(Math.random() * arr.length)];
}

// lobby marquee — rotating teasers, vedhika's notes, diva taunts
const MARQUEE_LINES = [
  "Vedhika has notes on your last spin.",
  "The Ex is in the building. Hide your chips.",
  "Sunita's wearing the lehenga. Rent just went up.",
  "Kallie broke the wheel again. We don't know how.",
  "Ann got us a table. Don't ask how.",
  "Dwiza has her eye on your luck. And your outfit.",
  "Garima ordered bottle service. For two.",
  "Nikki wore the same fit. As always. As intended.",
  "The group chat is alive. 412 unread. All of them fire.",
  "Shalini's been on the floor since soundcheck.",
  "Soumya red-dot-dot-dot. Center of attention. Always.",
  "Riddhima clashing tonight. Pink, gold, leopard. On purpose.",
  "Vedhika says: stay for the final cut.",
  "Priyanka has the math. You don't.",
  "Nitz has gold on gold on gold. As usual.",
  "Sarita's laugh audible from the parking lot. Bring earplugs.",
  "Kanchan brought the whole squad. As she does.",
  "Shreya just posted this. Already viral.",
  "Pinky's section has a rope. The rope has a name.",
  "The Den is open. The girls are waiting."
];

export function marqueeLine() {
  return MARQUEE_LINES[Math.floor(Math.random() * MARQUEE_LINES.length)];
}

// Vedhika's Note — shown briefly at app open. Personal hostess voice.
const VEDHIKA_NOTES = [
  "The girls are restless tonight.",
  "Kallie broke the wheel again. We're not fixing it.",
  "Sunita brought new lehengas. Three of them.",
  "The Ex tried to crash. We bounced her.",
  "Vibe check: passed. Barely.",
  "I signed off on every spin tonight. Even the bad ones.",
  "Group chat on fire. Momo budget doubled.",
  "Rent Day came early. He wants his money.",
  "Garima ordered bottle service. We're letting her.",
  "The DJ played my song. As he should.",
  "Vedhika's final cut: this one's for the squad.",
  "Everyone showed up. As they should."
];

export function vedhikaNote() {
  return VEDHIKA_NOTES[Math.floor(Math.random() * VEDHIKA_NOTES.length)];
}

// Daily diva rotation — one featured per day
import { DIVA_IDS } from "../data/divas.js";
export function divaOfTheDay() {
  const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return DIVA_IDS[day % DIVA_IDS.length];
}
