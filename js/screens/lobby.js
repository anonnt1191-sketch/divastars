// screens/lobby.js — central hub. Mobile-first grid of all game tiles,
// Vedhika's Note marquee, Diva of the Day, bank pill, daily bonus, language switcher, mute toggle.
// POLISH: photo thumbnails on every tile, bigger UI fonts, bigger tap targets.
import { t, getLang, setLang, AVAILABLE_LANGS, LANG_LABELS } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { toast } from "../core/fx.js";
import { GAMES, GAME_CATEGORIES, REUNION_GAME } from "../data/games-registry.js";
import { DIVAS, DIVA_IDS, UI_BG } from "../data/divas.js";
import { vedhikaNote, divaOfTheDay } from "../core/voice.js";
import { friendPhoto, packPhoto, worldPhoto } from "../core/photos.js";
import { isReunionDay, reunionMarquee, reunionVedhikaNote } from "../core/reunion.js";
import { createTicker } from "../core/ticker.js";

// Cache one random photo per game (stable across re-renders within a session)
const tilePhotoCache = new Map();
function getTilePhoto(gameId) {
  if (tilePhotoCache.has(gameId)) return tilePhotoCache.get(gameId);
  // pick a random photo from the pool — prefer inner-circle for variety
  const pool = Math.random();
  let url;
  if (pool < 0.4) {
    // inner-circle friend
    const id = DIVA_IDS[Math.floor(Math.random() * DIVA_IDS.length)];
    url = friendPhoto(id, Math.floor(Math.random() * 6));
  } else if (pool < 0.7) {
    // pack photo
    url = packPhoto(1 + Math.floor(Math.random() * 100));
  } else {
    // world cast
    url = worldPhoto(1 + Math.floor(Math.random() * 200));
  }
  tilePhotoCache.set(gameId, url);
  return url;
}

export async function render(pixiApp, appRef) {
  const W = pixiApp.screen.width, H = pixiApp.screen.height;
  const c = new PIXI.Container();
  pixiApp.stage.addChild(c);

  // PHASE 4: full-bleed rotating photo background.
  // Build a pool of background photos: 5 UI_BG.title photos + 17 inner-circle diva photos.
  // Rotate every 30s with a 1s fade. Vedhika always in rotation.
  const bgPool = [
    ...UI_BG.title,
    ...DIVA_IDS.map(id => friendPhoto(id, 0))
  ];
  const bgContainer = new PIXI.Container();
  c.addChild(bgContainer);
  let bgSprite1 = null, bgSprite2 = null;  // two layers for crossfade
  let bgIdx = 0;
  let bgNextSwapAt = 0;
  let bgCrossfading = false;

  async function loadBgSprite(url) {
    try {
      const tex = await PIXI.Assets.load(url);
      const sp = new PIXI.Sprite(tex);
      // cover-fit to fill screen
      const scale = Math.max(W/tex.width, H/tex.height);
      sp.scale.set(scale);
      sp.x = (W - tex.width*scale)/2;
      sp.y = (H - tex.height*scale)/2;
      sp.alpha = 0;
      return sp;
    } catch(e) { return null; }
  }

  async function swapBg() {
    const url = bgPool[bgIdx % bgPool.length];
    bgIdx++;
    const newSp = await loadBgSprite(url);
    if (!newSp) return;
    bgContainer.addChild(newSp);
    // fade out old, fade in new (1s)
    const oldSp = bgSprite1;
    bgSprite1 = newSp;
    bgCrossfading = true;
    let el = 0;
    const fn = (dt) => {
      el += dt * 16.67;
      const t = Math.min(1, el / 1000);
      newSp.alpha = t * 0.55;  // cap at 55% for legibility
      if (oldSp) oldSp.alpha = Math.max(0, 0.55 * (1 - t));
      if (t >= 1) {
        pixiApp.ticker.remove(fn);
        if (oldSp) { bgContainer.removeChild(oldSp); oldSp.destroy(); }
        bgCrossfading = false;
      }
    };
    pixiApp.ticker.add(fn);
  }
  // initial bg
  await swapBg();
  bgNextSwapAt = performance.now() + 30000;

  // dark overlay for legibility (on top of bg)
  const dark = new PIXI.Graphics();
  dark.beginFill(0x120818, 0.55).drawRect(0, 0, W, H).endFill();
  c.addChild(dark);

  // bg swap ticker — checks every frame if it's time to swap
  const bgSwapFn = () => {
    if (!bgCrossfading && performance.now() > bgNextSwapAt) {
      swapBg();
      bgNextSwapAt = performance.now() + 30000;
    }
  };
  pixiApp.ticker.add(bgSwapFn);

  // top bar — bigger pills, more spacing
  const topH = 64;
  const topBar = new PIXI.Container();
  topBar.y = 8;
  c.addChild(topBar);

  // bank pill (bigger)
  const bankPill = makePill(`${store.state.bank.toLocaleString("en-US")} chips`, 0xf2c76e, 0x160b20, 14);
  bankPill.x = 12;
  bankPill.y = topH / 2;
  topBar.addChild(bankPill);

  // VIP tier pill
  const vipPill = makePill(store.state.vipTier, 0x9d4edd, 0xffffff, 11);
  vipPill.x = 12 + bankPill.width + 8;
  vipPill.y = topH / 2;
  topBar.addChild(vipPill);

  // daily bonus button (right side, bigger)
  const dayMs = 24 * 60 * 60 * 1000;
  const canClaim = Date.now() - store.state.lastDailyClaim >= dayMs;
  const dailyBtn = makePill(canClaim ? "🎁 Daily" : `${Math.ceil((dayMs - (Date.now() - store.state.lastDailyClaim)) / 3600000)}h`, 0xff2e88, 0xffffff, 13);
  dailyBtn.x = W - dailyBtn.width - 12;
  dailyBtn.y = topH / 2;
  dailyBtn.interactive = canClaim;
  dailyBtn.buttonMode = canClaim;
  dailyBtn.on("pointertap", () => {
    sfx.chip();
    const reward = store.claimDaily();
    if (reward > 0) {
      toast(pixiApp, `Daily bonus: +${reward.toLocaleString("en-US")} chips (streak ${store.state.dailyStreak})`, 3000);
      appRef.go("lobby");
    }
  });
  topBar.addChild(dailyBtn);

  // mute toggle
  const muteBtn = makePill(store.state.muted ? "🔇" : "🔊", 0x333333, 0xffffff, 14);
  muteBtn.x = dailyBtn.x - muteBtn.width - 8;
  muteBtn.y = topH / 2;
  muteBtn.interactive = true;
  muteBtn.buttonMode = true;
  muteBtn.on("pointertap", () => {
    const m = !store.state.muted;
    store.setMuted(m);
    sfx.muted = m;
    sfx.click();
    appRef.go("lobby");
  });
  topBar.addChild(muteBtn);

  // language switcher
  const langBtn = makePill(LANG_LABELS[getLang()] || "EN", 0x2b1a06, 0xf2c76e, 12);
  langBtn.x = muteBtn.x - langBtn.width - 8;
  langBtn.y = topH / 2;
  langBtn.interactive = true;
  langBtn.buttonMode = true;
  let langIdx = AVAILABLE_LANGS.indexOf(getLang());
  langBtn.on("pointertap", async () => {
    sfx.click();
    langIdx = (langIdx + 1) % AVAILABLE_LANGS.length;
    await setLang(AVAILABLE_LANGS[langIdx]);
    appRef.go("lobby");
  });
  topBar.addChild(langBtn);

  // PHASE 4: continuous horizontal ticker — replaces static marquee
  const reunion = isReunionDay();
  const tickerY = topH + 6;
  const tickerH = 30;
  const ticker = createTicker(pixiApp, c, {
    y: tickerY,
    height: tickerH,
    speed: 0.6,
    fontSize: 13,
    bgColor: reunion ? 0x2a1a0a : 0x160b20,
    textColor: reunion ? 0xffd700 : 0xff2e88
  });

  // Reunion Mode banner (only on Dec 24-26) — sits right below ticker
  if (reunion) {
    const reunionBanner = new PIXI.Graphics();
    reunionBanner.beginFill(0x7c1d3f, 0.9).drawRoundedRect(8, tickerY + tickerH + 4, W - 16, 36, 8).endFill();
    reunionBanner.lineStyle(2, 0xffd700, 0.6).drawRoundedRect(8, tickerY + tickerH + 4, W - 16, 36, 8).endFill();
    c.addChild(reunionBanner);
    const reunionTx = new PIXI.Text("🎄 REUNION MODE ACTIVE · The Get-Together slot unlocked 🎄", {
      fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "700", fill: 0xffd700, align: "center"
    });
    reunionTx.anchor.set(0.5, 0.5);
    reunionTx.x = W / 2; reunionTx.y = tickerY + tickerH + 22;
    c.addChild(reunionTx);
  }

  // Diva of the Day — bigger banner, tightened spacing
  const dotdId = divaOfTheDay();
  const dotd = DIVAS[dotdId];
  const dotdY = reunion ? (tickerY + tickerH + 48) : (tickerY + tickerH + 8);
  const dotdH = Math.min(180, H * 0.2);

  const dotdContainer = new PIXI.Container();
  dotdContainer.x = 8;
  dotdContainer.y = dotdY;
  c.addChild(dotdContainer);

  // dotd photo (bigger) — PHASE 7: Ken Burns animated
  let dotdStopKB = null;
  try {
    const dotdUrl = friendPhoto(dotdId, Math.floor(Math.random() * 6));
    const tex = await PIXI.Assets.load(dotdUrl);
    const sp = new PIXI.Sprite(tex);
    const photoSize = dotdH - 16;
    // contain-fit
    const scale = Math.min(photoSize/tex.width, photoSize/tex.height);
    sp.scale.set(scale);
    sp.x = 8 + (photoSize - tex.width * scale) / 2;
    sp.y = 8 + (photoSize - tex.height * scale) / 2;
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff).drawRoundedRect(8, 8, photoSize, photoSize, 12).endFill();
    dotdContainer.addChild(mask);
    sp.mask = mask;
    dotdContainer.addChild(sp);
    // PHASE 7: Ken Burns subtle motion
    const { kenBurns } = await import("../core/animations.js");
    dotdStopKB = kenBurns(pixiApp, sp, { zoomRange: [1, 1.08], speed: 0.4 });
  } catch(e){}

  // dotd card bg
  const dotdCard = new PIXI.Graphics();
  dotdCard.beginFill(0x1c0e2a, 0.92).drawRoundedRect(0, 0, W - 16, dotdH, 16).endFill();
  dotdCard.beginFill(0xf2c76e, 0.4).drawRoundedRect(0, 0, 4, dotdH, 2).endFill();
  dotdContainer.addChildAt(dotdCard, 0);

  // dotd text (bigger fonts)
  const dotdTitle = new PIXI.Text(`${t("lobby.divaOfDay")}: ${dotd.name}`, {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: 22, fontStyle: "italic", fontWeight: "700", fill: 0xf2c76e
  });
  dotdTitle.x = dotdH + 16; dotdTitle.y = 16;
  dotdContainer.addChild(dotdTitle);

  const dotdSub = new PIXI.Text(`"${dotd.title}"`, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 14, fontWeight: "400", fill: 0xffe9b8, fontStyle: "italic"
  });
  dotdSub.x = dotdH + 16; dotdSub.y = 46;
  dotdContainer.addChild(dotdSub);

  const dotdRule = new PIXI.Text(dotd.rule, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 13, fontWeight: "400", fill: 0xb0b0b0,
    wordWrap: true, wordWrapWidth: W - dotdH - 50
  });
  dotdRule.x = dotdH + 16; dotdRule.y = 72;
  dotdContainer.addChild(dotdRule);

  // scrollable games grid — bigger tiles with photos
  const gridY = dotdY + dotdH + 12;
  const gridH = H - gridY - 20;
  const gridContainer = new PIXI.Container();
  gridContainer.y = gridY;
  c.addChild(gridContainer);

  const gridMask = new PIXI.Graphics();
  gridMask.beginFill(0xffffff).drawRect(0, gridY, W, gridH).endFill();
  c.addChild(gridMask);
  gridContainer.mask = gridMask;

  // bigger tiles: 2 columns, taller
  const gap = 10;
  const cols = 2;
  const tileW = (W - 24 - gap * (cols - 1)) / cols;
  const tileH = 180;  // taller to fit photo
  let row = 0, col = 0;

  const sortedGames = reunion ? [REUNION_GAME, ...GAMES] : [...GAMES];
  sortedGames.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.cat !== b.cat) return a.cat.localeCompare(b.cat);
    return a.wave - b.wave;
  });

  for (const game of sortedGames) {
    const tx = 8 + col * (tileW + gap);
    const ty = row * (tileH + gap);
    const tile = await makeGameTile(game, tileW, tileH, appRef);
    tile.x = tx;
    tile.y = ty;
    gridContainer.addChild(tile);
    col++;
    if (col >= cols) { col = 0; row++; }
  }
  const gridContentH = (row + 1) * (tileH + gap);

  // touch scrolling
  let dragStart = null, scrollY = 0, maxScroll = Math.max(0, gridContentH - gridH);
  const clampScroll = (y) => Math.max(-maxScroll, Math.min(0, y));
  gridContainer.interactive = true;
  gridContainer.on("pointerdown", (e) => {
    dragStart = { y: e.global.y, scroll: scrollY };
  });
  gridContainer.on("pointermove", (e) => {
    if (!dragStart) return;
    const dy = e.global.y - dragStart.y;
    scrollY = clampScroll(dragStart.scroll + dy);
    gridContainer.y = gridY + scrollY;
  });
  const endDrag = () => { dragStart = null; };
  gridContainer.on("pointerup", endDrag);
  gridContainer.on("pointerupoutside", endDrag);

  // memory book button — fixed bottom, bigger
  const mbBtn = makePill(`♡ ${t("lobby.memoryBook")}`, 0x7c1d3f, 0xffe9b8, 13);
  mbBtn.x = 8;
  mbBtn.y = H - mbBtn.height - 12;
  mbBtn.interactive = true;
  mbBtn.buttonMode = true;
  mbBtn.on("pointertap", () => { sfx.click(); appRef.go("memoryBook"); });
  c.addChild(mbBtn);

  // PHASE 6: Guide button (next to Memory Book)
  const guideBtn = makePill("? Guide", 0x2b1a06, 0xf2c76e, 13);
  guideBtn.x = 8 + mbBtn.width + 8;
  guideBtn.y = H - guideBtn.height - 12;
  guideBtn.interactive = true;
  guideBtn.buttonMode = true;
  guideBtn.on("pointertap", () => { sfx.click(); appRef.go("guide"); });
  c.addChild(guideBtn);

  return { cleanup: () => {
    if (ticker && ticker.destroy) ticker.destroy();
    pixiApp.ticker.remove(bgSwapFn);
    if (dotdStopKB) try { dotdStopKB(); } catch(e){}
  } };
}

async function makeGameTile(game, w, h, appRef) {
  const c = new PIXI.Container();

  const isUnlocked = game.wave === 1 || store.state.unlockedGames.includes(game.id);
  const isComing = game.wave > 1;

  // card bg
  const bg = new PIXI.Graphics();
  bg.beginFill(isUnlocked ? 0x1c0e2a : 0x14081c, 0.95).drawRoundedRect(0, 0, w, h, 14).endFill();
  if (game.featured) {
    bg.beginFill(0xf2c76e, 0.6).drawRoundedRect(0, 0, w, 4, 2).endFill();
  }
  c.addChild(bg);

  // PHOTO THUMBNAIL — contain-fit (full photo visible) with blurred backdrop filling empty space
  const photoH = h - 70;  // leave 70px for text at bottom
  const photoUrl = getTilePhoto(game.id);
  try {
    const tex = await PIXI.Assets.load(photoUrl);
    // Backdrop: cover-fit (fills container) at low alpha for visual fill
    const backdrop = new PIXI.Sprite(tex);
    const bgScale = Math.max(w/tex.width, photoH/tex.height);
    backdrop.scale.set(bgScale);
    backdrop.x = (w - tex.width * bgScale) / 2;
    backdrop.y = (photoH - tex.height * bgScale) / 2;
    backdrop.alpha = 0.25;
    if (!isUnlocked) backdrop.alpha = 0.1;
    const bgMask = new PIXI.Graphics();
    bgMask.beginFill(0xffffff).drawRoundedRect(0, 0, w, photoH + 14, 14).endFill();
    c.addChild(bgMask);
    backdrop.mask = bgMask;
    c.addChild(backdrop);
    // Dark overlay on backdrop for legibility
    const darkOverlay = new PIXI.Graphics();
    darkOverlay.beginFill(0x120818, 0.5).drawRoundedRect(0, 0, w, photoH + 14, 14).endFill();
    c.addChild(darkOverlay);
    // Foreground: contain-fit (full photo visible, no cropping)
    const sp = new PIXI.Sprite(tex);
    const scale = Math.min(w/tex.width, photoH/tex.height);
    sp.scale.set(scale);
    sp.x = (w - tex.width * scale) / 2;
    sp.y = (photoH - tex.height * scale) / 2;
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff).drawRoundedRect(0, 0, w, photoH + 14, 14).endFill();
    c.addChild(mask);
    sp.mask = mask;
    if (!isUnlocked) sp.alpha = 0.5;
    c.addChild(sp);
  } catch(e) {}

  // gradient overlay on photo bottom for text legibility
  const gradOverlay = new PIXI.Graphics();
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * 0.85;
    gradOverlay.beginFill(0x120818, a).drawRect(0, photoH - 30 + i, w, 1).endFill();
  }
  c.addChild(gradOverlay);

  // NEW badge
  if (game.isNew) {
    const newBg = new PIXI.Graphics();
    newBg.beginFill(0xff2e88, 0.95).drawRoundedRect(w - 60, 8, 52, 22, 6).endFill();
    c.addChild(newBg);
    const newTx = new PIXI.Text("NEW", {
      fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "900", fill: 0xffffff, align: "center"
    });
    newTx.anchor.set(0.5);
    newTx.x = w - 34; newTx.y = 19;
    c.addChild(newTx);
  }

  // category icon
  const catLabel = GAME_CATEGORIES[game.cat]?.icon || "";
  if (catLabel) {
    const catBg = new PIXI.Graphics();
    catBg.beginFill(0x160b20, 0.85).drawRoundedRect(8, 8, 32, 26, 6).endFill();
    c.addChild(catBg);
    const catIco = new PIXI.Text(catLabel, {
      fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "700", fill: 0x9d4edd, align: "center"
    });
    catIco.anchor.set(0.5);
    catIco.x = 24; catIco.y = 21;
    c.addChild(catIco);
  }

  // game name (bigger)
  const name = new PIXI.Text(game.name, {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: 18, fontStyle: "italic", fontWeight: "700",
    fill: isUnlocked ? 0xffe9b8 : 0x888888,
    wordWrap: true, wordWrapWidth: w - 16
  });
  name.x = 8; name.y = photoH - 28;
  c.addChild(name);

  // blurb
  const blurb = new PIXI.Text(game.blurb, {
    fontFamily: "Outfit, sans-serif",
    fontSize: 12, fontWeight: "400", fill: isUnlocked ? 0xb0b0b0 : 0x666666,
    wordWrap: true, wordWrapWidth: w - 16
  });
  blurb.x = 8; blurb.y = photoH + 6;
  c.addChild(blurb);

  // status / CTA (bigger)
  let statusText, statusColor;
  if (isUnlocked) {
    statusText = "▶ PLAY";
    statusColor = 0xf2c76e;
  } else {
    statusText = `${t("lobby.comingSoon", { n: game.wave })}`;
    statusColor = 0xff2e88;
  }
  const status = new PIXI.Text(statusText, {
    fontFamily: "Outfit, sans-serif",
    fontSize: 14, fontWeight: "900", fill: statusColor
  });
  status.x = 8; status.y = h - 24;
  c.addChild(status);

  c.interactive = true;
  c.buttonMode = true;
  if (isUnlocked) {
    c.on("pointertap", () => {
      sfx.click();
      appRef.openGame(game.id);
    });
  } else {
    c.on("pointertap", () => {
      sfx.click();
      toast(appRef.pixiApp, t("toast.gameLocked", { n: game.wave }));
    });
  }

  return c;
}

function makePill(text, bg, fg, fontSize = 13) {
  const c = new PIXI.Container();
  const tx = new PIXI.Text(text, {
    fontFamily: "Outfit, sans-serif",
    fontSize: fontSize, fontWeight: "700", fill: fg
  });
  const padX = 14, padY = 8;
  const w = tx.width + padX * 2, h = tx.height + padY * 2;
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, h/2).endFill();
  c.addChild(g);
  tx.x = padX; tx.y = padY;
  c.addChild(tx);
  return c;
}
