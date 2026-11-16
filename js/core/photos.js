// core/photos.js — photo URL system + caching helpers for PixiJS.
// PHASE 1 PERFORMANCE: games use 256px thumbnails by default (~15KB each vs ~150KB full-res).
// Memory Book detail view uses Full-res variants.
// Three pools: inner-circle divas (friends), original pack (100), world-cast (200).

import { DIVA_IDS, PHOTO_COUNTS } from "../data/divas.js";
import { PACK_MAX, WORLD_CAST_MAX } from "../data/world-cast-names.js";

const BASE = "assets";

// PHASE 1: default photo helpers return THUMBNAILS (256px max-edge) for game use
export const friendPhoto = (id, i) => `${BASE}/thumb/friends/${id}/${id}-${i+1}.jpg`;
export const packPhoto   = (n)  => `${BASE}/thumb/pack/pack-${String(n).padStart(3,"0")}.jpg`;
export const worldPhoto  = (n)  => `${BASE}/thumb/world-cast/cast-${String(n).padStart(3,"0")}.jpg`;

// Full-res variants for Memory Book detail view only (1200px max-edge)
export const friendPhotoFull = (id, i) => `${BASE}/friends/${id}/${id}-${i+1}.jpg`;
export const packPhotoFull   = (n)  => `${BASE}/pack/pack-${String(n).padStart(3,"0")}.jpg`;
export const worldPhotoFull  = (n)  => `${BASE}/world-cast/cast-${String(n).padStart(3,"0")}.jpg`;

// Build the master pool. Every photo has a unique key, URL, name, kind, and kind-specific index.
// URLs point to thumbnails (game use). Pool also stores full URLs for Memory Book.
export function buildPool(divas, packNames, worldCast) {
  const pool = [];
  for (const id of DIVA_IDS) {
    for (let i = 0; i < PHOTO_COUNTS[id]; i++) {
      pool.push({
        key: `f:${id}:${i}`,
        url: friendPhoto(id, i),       // thumb
        urlFull: friendPhotoFull(id, i),
        name: divas[id].name,
        kind: "friend",
        id,
        idx: i
      });
    }
  }
  for (let n = 1; n <= PACK_MAX; n++) {
    const p = packNames[n-1] || { name:"Diva "+n, title:"fresh in the den" };
    pool.push({ key:`p:${n}`, url:packPhoto(n), urlFull:packPhotoFull(n), name:p.name, title:p.title, kind:"pack", pack:n });
  }
  for (let n = 1; n <= WORLD_CAST_MAX; n++) {
    const p = worldCast[n-1] || { name:"Diva "+n, title:"world-cast rookie" };
    pool.push({ key:`w:${n}`, url:worldPhoto(n), urlFull:worldPhotoFull(n), name:p.name, title:p.title, kind:"world", world:n });
  }
  return pool;
}

// Cast list — name + kind, no photo URL (used for random picks that resolve URL later)
export function buildCastList(divas, packNames, worldCast) {
  const list = [];
  for (const id of DIVA_IDS) list.push({ key:id, name:divas[id].name, kind:"friend", id });
  for (let n = 1; n <= PACK_MAX; n++) {
    const p = packNames[n-1] || { name:"Diva "+n };
    list.push({ key:"p"+n, name:p.name, kind:"pack", pack:n });
  }
  for (let n = 1; n <= WORLD_CAST_MAX; n++) {
    const p = worldCast[n-1] || { name:"Diva "+n };
    list.push({ key:"w"+n, name:p.name, kind:"world", world:n });
  }
  return list;
}

// Resolve a cast entry to a thumbnail URL (game use)
export function castToPhotoURL(cast) {
  if (cast.kind === "friend") {
    const n = PHOTO_COUNTS[cast.id] || 5;
    const i = Math.floor(Math.random() * n);
    return friendPhoto(cast.id, i);
  } else if (cast.kind === "pack") {
    return packPhoto(cast.pack);
  } else if (cast.kind === "world") {
    return worldPhoto(cast.world);
  }
  return packPhoto(1);
}

// Resolve a cast entry to a full-res URL (Memory Book detail view)
export function castToPhotoURLFull(cast) {
  if (cast.kind === "friend") {
    const n = PHOTO_COUNTS[cast.id] || 5;
    const i = Math.floor(Math.random() * n);
    return friendPhotoFull(cast.id, i);
  } else if (cast.kind === "pack") {
    return packPhotoFull(cast.pack);
  } else if (cast.kind === "world") {
    return worldPhotoFull(cast.world);
  }
  return packPhotoFull(1);
}

// Cast list pick helper — random entry, avoiding a set of already-used keys
export function castPick(castList, excl = new Set(), maxTries = 60) {
  for (let t = 0; t < maxTries; t++) {
    const c = castList[Math.floor(Math.random() * castList.length)];
    if (!excl.has(c.key)) return c;
  }
  return castList[Math.floor(Math.random() * castList.length)];
}

// PixiJS texture cache (lazy-loaded, shared across all games)
const textureCache = new Map();
export async function getTexture(url, app) {
  if (textureCache.has(url)) return textureCache.get(url);
  const tex = await PIXI.Assets.load(url);
  textureCache.set(url, tex);
  return tex;
}

// Preload a batch of textures (used at boot + when entering a game)
export async function preloadTextures(urls, onProgress) {
  let done = 0;
  const out = [];
  for (const url of urls) {
    try {
      const t = await getTexture(url);
      out.push({ url, tex:t });
    } catch (e) {
      console.warn("texture fail", url, e);
      out.push({ url, tex:null });
    }
    done++;
    if (onProgress) onProgress(done, urls.length);
  }
  return out;
}

// PHASE 1: preload all photos for a game's session pool. Call at game mount to pre-warm
// the texture cache so spins/deals don't stutter on first card draw.
export async function preloadGamePhotos(castEntries, limit = 24) {
  const urls = [];
  for (let i = 0; i < Math.min(castEntries.length, limit); i++) {
    const c = castEntries[i];
    if (!c) continue;
    urls.push(castToPhotoURL(c));
  }
  // fire-and-forget — don't block game mount
  preloadTextures(urls).catch(() => {});
}

// PHASE 1: pick N random photos from the pool for a game's symbols/tiles/etc.
export function pickPhotoPool(castList, n) {
  const shuffled = [...castList].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// PHASE 2: shared helper — render a photo into a container using contain-fit (full photo visible)
// with an optional blurred backdrop filling the letterboxed space.
// Usage: const { sprite, mask } = await addContainPhoto(parent, url, x, y, w, h, { rounded: 8, backdrop: true });
export async function addContainPhoto(parent, url, x, y, w, h, opts = {}) {
  const rounded = opts.rounded ?? 0;
  const showBackdrop = opts.backdrop ?? true;
  const maskShape = opts.maskShape ?? "rect";  // "rect" or "circle"
  try {
    const tex = await PIXI.Assets.load(url);
    // Backdrop: cover-fit fills container, dimmed
    if (showBackdrop) {
      const bg = new PIXI.Sprite(tex);
      const bgScale = Math.max(w/tex.width, h/tex.height);
      bg.scale.set(bgScale);
      bg.x = x + (w - tex.width * bgScale) / 2;
      bg.y = y + (h - tex.height * bgScale) / 2;
      bg.alpha = 0.2;
      const bgMask = new PIXI.Graphics();
      if (maskShape === "circle") bgMask.beginFill(0xffffff).drawCircle(x + w/2, y + h/2, Math.min(w, h)/2).endFill();
      else bgMask.beginFill(0xffffff).drawRoundedRect(x, y, w, h, rounded).endFill();
      parent.addChild(bgMask);
      bg.mask = bgMask;
      parent.addChild(bg);
    }
    // Foreground: contain-fit (full photo visible)
    const sp = new PIXI.Sprite(tex);
    const scale = Math.min(w/tex.width, h/tex.height);
    sp.scale.set(scale);
    sp.x = x + (w - tex.width * scale) / 2;
    sp.y = y + (h - tex.height * scale) / 2;
    const mask = new PIXI.Graphics();
    if (maskShape === "circle") mask.beginFill(0xffffff).drawCircle(x + w/2, y + h/2, Math.min(w, h)/2).endFill();
    else mask.beginFill(0xffffff).drawRoundedRect(x, y, w, h, rounded).endFill();
    parent.addChild(mask);
    sp.mask = mask;
    parent.addChild(sp);
    return { sprite: sp, mask, tex };
  } catch (e) {
    console.warn("addContainPhoto fail", url, e);
    return { sprite: null, mask: null, tex: null };
  }
}
