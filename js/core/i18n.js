// core/i18n.js — localization. English source live; Nepali (ne-NP) + Hindi (hi-IN) stubs for Wave 4.
// String files live in /locales/<lang>.json. Architecture supports adding languages later.

let currentLang = "en";
let strings = {};
let fallback = {};

export async function loadLang(lang) {
  try {
    const res = await fetch(`locales/${lang}.json`);
    if (!res.ok) throw new Error("not found");
    strings = await res.json();
    currentLang = lang;
  } catch (e) {
    console.warn(`[i18n] lang "${lang}" not loaded, falling back to en`);
    if (lang !== "en") {
      try {
        const res = await fetch("locales/en.json");
        strings = await res.json();
        currentLang = "en";
      } catch (e2) { strings = {}; }
    }
  }
  // always load English fallback
  try {
    if (currentLang !== "en") {
      const res = await fetch("locales/en.json");
      fallback = await res.json();
    } else {
      fallback = strings;
    }
  } catch (e) {}
}

export function t(key, vars = {}) {
  let s = strings[key] ?? fallback[key] ?? key;
  if (typeof s === "string") {
    for (const k of Object.keys(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
    }
  }
  return s;
}

export function getLang() { return currentLang; }
export function setLang(lang) { return loadLang(lang); }

export const AVAILABLE_LANGS = ["en", "ne-NP", "hi-IN"];
export const LANG_LABELS = { "en":"English", "ne-NP":"नेपाली", "hi-IN":"हिन्दी" };
