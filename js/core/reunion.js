// core/reunion.js — Reunion Mode. Activated on Dec 25 (Christmas Day).
// Special lobby state with themed content + exclusive "The Get-Together" slot.

import { DIVA_IDS, DIVAS } from "../data/divas.js";
import { friendPhoto } from "./photos.js";
import { vedhikaNote } from "./voice.js";

export function isReunionDay(date = new Date()) {
  const d = new Date(date);
  // Reunion mode active Dec 24-26 (give some buffer for timezones)
  const month = d.getMonth();  // 0-11
  const day = d.getDate();
  return month === 11 && day >= 24 && day <= 26;
}

export function reunionMarquee() {
  const notes = [
    "The girls are home. The Den is open.",
    "Merry Christmas, Vedhika. They're all here.",
    "The squad's first get-together since forever. Drinks on the house.",
    "Reunion night. Every diva showed up. As she should.",
    "Christmas at the Den. The girls brought the chaos."
  ];
  return notes[Math.floor(Math.random() * notes.length)];
}

export function reunionVedhikaNote() {
  const notes = [
    "Merry Christmas, loves. The Den missed you.",
    "Tonight's for us. The girls came home.",
    "I made this for you. Every photo. Every line. Every spin. Merry Christmas.",
    "Reunion night. All my girls in one place. The Den finally feels full.",
    "Christmas 2026. The squad's back together. This one's for the memory book."
  ];
  return notes[Math.floor(Math.random() * notes.length)];
}

// Reunion-themed slot game data
export const REUNION_GAME = {
  id: "reunion",
  name: "The Get-Together",
  blurb: "Christmas Day exclusive. All 17 inner-circle divas in one slot.",
  tagline: "Reunion Mode · all 17 divas · x100 max",
  mults: [1, 2, 3, 5, 10, 25, 50, 100],
  symbolCount: 17,
  reels: 5,
  rows: 3
};

// Get reunion-themed diva photos (all 17 inner-circle)
export function reunionPhotoPool() {
  const photos = [];
  for (const id of DIVA_IDS) {
    for (let i = 0; i < 6; i++) {
      photos.push({ url: friendPhoto(id, i), id });
    }
  }
  return photos;
}
