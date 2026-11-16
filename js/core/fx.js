// core/fx.js — PixiJS-powered celebration engine.
// PHASE 7: per-game celebration styles (confetti/hearts/gold_rain/photo_burst/sparkles/fireworks/kaleidoscope).
// Tiers: win, big, mega, jackpot. Each tier overlays full-screen: dark backdrop, gold rays,
// flying diva photos (real photos, Ken Burns animated), animated title, multiplier pulse, particles.

import { sfx } from "./sfx.js";
import { store } from "./store.js";
import { kenBurns } from "./animations.js";

// PHASE 1: device tier detection — read from window global set by app.js, fallback to local detection
function detectTier() {
  // app.js sets this during boot — read it for accurate tier
  if (window.DD_DEVICE_TIER) return window.DD_DEVICE_TIER;
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  if (!isMobile) return "desktop";
  if (cores >= 8 && memory >= 6) return "high";
  if (cores >= 6 && memory >= 4) return "mid";
  return "low";
}
const DEVICE_TIER = detectTier();
// PHASE 1: more aggressive scaling — low=0.25, mid=0.5, high=0.85, desktop=1
const TIER_MULT = DEVICE_TIER === "low" ? 0.25 : (DEVICE_TIER === "mid" ? 0.5 : DEVICE_TIER === "high" ? 0.85 : 1);

const TIER_CONFIG = {
  win:     { color: 0xf2c76e, sound: "win",     photos: 4,  shake: 4,   rays: 8,  confetti: 30 },
  big:     { color: 0xff2e88, sound: "big",     photos: 6,  shake: 8,   rays: 12, confetti: 60 },
  mega:    { color: 0x9d4edd, sound: "mega",    photos: 9,  shake: 14,  rays: 16, confetti: 100 },
  jackpot: { color: 0xffd700, sound: "jackpot", photos: 12, shake: 22,  rays: 24, confetti: 200 }
};

// PHASE 7: per-style particle colors + shapes
const STYLE_COLORS = {
  confetti:    [0xf2c76e, 0xff2e88, 0x9d4edd, 0x57d38f, 0x57c7ff, 0xff5d5d],
  hearts:      [0xff2e88, 0xff5d5d, 0xff80ab, 0xffb3c6, 0xff006e, 0xd946ef],
  gold_rain:   [0xf2c76e, 0xffe9b8, 0xd9a441, 0xffd700, 0xffc107, 0xffb000],
  photo_burst: [0xff2e88, 0xf2c76e, 0x9d4edd, 0xd946ef],
  sparkles:    [0xffe9b8, 0xf2c76e, 0xffffff, 0xffd700, 0xfff9c3],
  fireworks:   [0xff2e88, 0xffd700, 0x57d38f, 0x57c7ff, 0xff5d5d, 0x9d4edd],
  kaleidoscope:[0xff2e88, 0x9d4edd, 0xf2c76e, 0x57d38f, 0x57c7ff, 0xff5d5d, 0xd946ef]
};

// PHASE 7: per-style particle shape renderer
function drawParticle(style, color) {
  const g = new PIXI.Graphics();
  if (style === "hearts") {
    // heart shape (two circles + triangle)
    g.beginFill(color);
    g.drawCircle(-3, -2, 4);
    g.drawCircle(3, -2, 4);
    g.moveTo(-7, -1); g.lineTo(7, -1); g.lineTo(0, 8); g.closePath();
    g.endFill();
  } else if (style === "gold_rain") {
    // gold coin
    g.beginFill(color).drawCircle(0, 0, 4).endFill();
    g.beginFill(0xffe9b8, 0.6).drawCircle(-1, -1, 1.5).endFill();
  } else if (style === "sparkles") {
    // 4-point star
    g.beginFill(color);
    g.moveTo(0, -5); g.lineTo(1, -1); g.lineTo(5, 0); g.lineTo(1, 1);
    g.lineTo(0, 5); g.lineTo(-1, 1); g.lineTo(-5, 0); g.lineTo(-1, -1); g.closePath();
    g.endFill();
  } else if (style === "fireworks") {
    // burst (lines from center)
    g.lineStyle(1, color, 0.9);
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      g.moveTo(0, 0); g.lineTo(Math.cos(ang)*5, Math.sin(ang)*5);
    }
  } else if (style === "photo_burst") {
    // small square (like a photo frame)
    g.beginFill(color, 0.7).drawRect(-3, -3, 6, 6).endFill();
    g.lineStyle(1, 0xffe9b8, 0.5).drawRect(-3, -3, 6, 6).endFill();
  } else if (style === "kaleidoscope") {
    // triangle
    g.beginFill(color);
    g.moveTo(0, -5); g.lineTo(4, 3); g.lineTo(-4, 3); g.closePath();
    g.endFill();
  } else {
    // confetti default — small square
    g.beginFill(color).drawRect(-3, -3, 6, 6).endFill();
  }
  return g;
}

// scale counts by tier
function scaleConfig(cfg) {
  return {
    ...cfg,
    photos: Math.max(2, Math.round(cfg.photos * TIER_MULT)),
    confetti: Math.max(10, Math.round(cfg.confetti * TIER_MULT)),
    rays: Math.max(4, Math.round(cfg.rays * TIER_MULT))
  };
}

const TIER_TITLES = {
  win:     ["NICE WIN", "SHE PAYS OUT", "CLEAN HIT", "MOMO MONEY", "CHIPS SECURED"],
  big:     ["BIG WIN", "THE SQUAD ROARS", "SHE DELIVERED", "HEELS ON THE TABLE", "SHE CAME TO SLAY"],
  mega:    ["MEGA WIN", "THE DEN IS SHAKING", "MAIN CHARACTER ENERGY", "SHE ATE. NO CRUMBS.", "GROUP CHAT ON FIRE"],
  jackpot: ["JACKPOT", "THE DEN EXPLODES", "WRITE HER NAME IN LIGHTS", "MOTHER IS MOTHERING", "CERTIFIED ICONIC"]
};

const TIER_LINES = {
  win:     ["The divas nod in approval.", "One momo falls. The squad cheers.", "A quiet little slay.", "She posed. It paid."],
  big:     ["Somebody alert the group chat.", "The aunties are dancing.", "Chips raining. Heels staying on.", "The Ex could never."],
  mega:    ["THE DEN IS ON ITS FEET.", "Even the DJ stopped for this.", "Vedhika approves the final cut.", "This goes in the group bio."],
  jackpot: ["The Den may never recover.", "Loud. Gold. Legendary.", "Rent Day personally congratulates you.", "Sunita's bringing the lehengas."]
};

// State: a single overlay container on the PixiJS stage
let fxLayer = null;
let activeOverlay = null;

export function initFX(app) {
  fxLayer = new PIXI.Container();
  fxLayer.zIndex = 1000;
  app.stage.addChild(fxLayer);
}

function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function showFX(app, tier, opts = {}) {
  if (!fxLayer) initFX(app);
  const cfg = scaleConfig(TIER_CONFIG[tier] || TIER_CONFIG.win);
  // PHASE 7: per-game celebration style
  const style = opts.style || "confetti";
  const styleColors = STYLE_COLORS[style] || STYLE_COLORS.confetti;
  // sound
  if (cfg.sound) try { sfx[cfg.sound](); } catch(e){}
  // haptics (mobile only)
  if (navigator.vibrate) {
    const pattern = tier === "jackpot" ? [60, 40, 80, 40, 120, 40, 200] :
                    tier === "mega"    ? [60, 40, 120] :
                    tier === "big"     ? [40, 30, 80] : [30];
    navigator.vibrate(pattern);
  }

  // clear any previous
  if (activeOverlay) { fxLayer.removeChildren(); activeOverlay = null; }

  const ov = new PIXI.Container();
  ov.zIndex = 1000;
  fxLayer.addChild(ov);
  activeOverlay = ov;

  const W = app.screen.width, H = app.screen.height;

  // dark backdrop
  const dark = new PIXI.Graphics();
  dark.beginFill(0x000000, 0.55);
  dark.drawRect(0, 0, W, H);
  dark.endFill();
  dark.alpha = 0;
  ov.addChild(dark);

  // gold rays (rotating)
  const rays = new PIXI.Graphics();
  const cx = W / 2, cy = H / 2;
  const maxR = Math.max(W, H);
  rays.lineStyle(60, cfg.color, 0.18);
  for (let i = 0; i < cfg.rays; i++) {
    const a = (i / cfg.rays) * Math.PI * 2;
    rays.moveTo(cx, cy);
    rays.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
  }
  ov.addChild(rays);

  // PHASE 7: confetti particles — per-style shape + color
  const confetti = [];
  for (let i = 0; i < cfg.confetti; i++) {
    const color = styleColors[i % styleColors.length];
    const c = drawParticle(style, color);
    c.x = cx + (Math.random() - 0.5) * W * 0.6;
    c.y = cy + (Math.random() - 0.5) * H * 0.3;
    c.vx = (Math.random() - 0.5) * 8;
    c.vy = -2 - Math.random() * 6;
    c.rot = Math.random() * Math.PI;
    c.vrot = (Math.random() - 0.5) * 0.3;
    ov.addChild(c);
    confetti.push(c);
  }

  // PHASE 7: flying diva photos — Ken Burns animated (zoom/pan while flying)
  const photoSprites = [];
  const photoStopKB = [];  // Ken Burns stop functions to clean up
  const photoPool = window.DD?.SESSION?.celebs || [];
  if (photoPool.length) {
    for (let i = 0; i < cfg.photos; i++) {
      const p = photoPool[(i * 7 + Math.floor(Math.random() * 6)) % photoPool.length];
      PIXI.Assets.load(p.url).then(tex => {
        if (!tex || !activeOverlay) return;
        const sp = new PIXI.Sprite(tex);
        const size = 90 + Math.random() * 60;
        sp.width = size; sp.height = size;
        sp.anchor.set(0.5);
        sp.x = cx + (Math.random() - 0.5) * W * 0.7;
        sp.y = H + size;  // start below screen
        sp.targetY = cy + (Math.random() - 0.5) * H * 0.5 - H * 0.1;
        sp.vx = (Math.random() - 0.5) * 4;
        sp.vy = -8 - Math.random() * 8;
        sp.rot = (Math.random() - 0.5) * 0.4;
        sp.vrot = (Math.random() - 0.5) * 0.05;
        sp.alpha = 0;
        ov.addChild(sp);
        photoSprites.push(sp);
        // PHASE 7: Ken Burns subtle zoom on the photo while it's flying
        const stopKB = kenBurns(app, sp, { zoomRange: [1, 1.08], speed: 0.8 });
        photoStopKB.push(stopKB);
      });
    }
  }

  // title text
  const title = new PIXI.Text(opts.title || randItem(TIER_TITLES[tier] || TIER_TITLES.win), {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: Math.min(64, W * 0.09),
    fontWeight: "900",
    fill: cfg.color,
    stroke: 0x160b20,
    strokeThickness: 6,
    align: "center"
  });
  title.anchor.set(0.5);
  title.x = cx;
  title.y = cy - H * 0.05;
  title.scale.set(0);
  ov.addChild(title);

  // amount text (if provided)
  let amount = null;
  if (opts.amount != null) {
    amount = new PIXI.Text((opts.amount > 0 ? "+" : "") + opts.amount.toLocaleString("en-US") + " chips", {
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize: Math.min(48, W * 0.06),
      fontWeight: "700",
      fill: 0xffe9b8,
      stroke: 0x160b20,
      strokeThickness: 4,
      align: "center"
    });
    amount.anchor.set(0.5);
    amount.x = cx;
    amount.y = cy + H * 0.04;
    amount.alpha = 0;
    ov.addChild(amount);
  }

  // sub line
  let line = null;
  if (opts.line || tier) {
    line = new PIXI.Text(opts.line || randItem(TIER_LINES[tier] || TIER_LINES.win), {
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize: Math.min(22, W * 0.032),
      fontWeight: "400",
      fill: 0xffffff,
      alpha: 0.85,
      align: "center",
      wordWrap: true,
      wordWrapWidth: W * 0.7
    });
    line.anchor.set(0.5);
    line.x = cx;
    line.y = cy + H * 0.12;
    line.alpha = 0;
    ov.addChild(line);
  }

  // animation
  let elapsed = 0;
  const DURATION = tier === "jackpot" ? 4500 : tier === "mega" ? 3500 : tier === "big" ? 2800 : 2200;
  const tickerFn = (dt) => {
    elapsed += dt * 16.67;  // approx ms per frame
    // backdrop fade in (first 200ms), hold, fade out (last 400ms)
    if (elapsed < 200) dark.alpha = elapsed / 200 * 0.7;
    else if (elapsed > DURATION - 400) dark.alpha = Math.max(0, (DURATION - elapsed) / 400) * 0.7;
    else dark.alpha = 0.7;

    // rays rotation
    rays.rotation += dt * 0.02;

    // title pop-in: elastic scale
    if (elapsed < 500) {
      const t = elapsed / 500;
      const eased = 1 - Math.pow(1 - t, 3);
      title.scale.set(eased * (1 + Math.sin(t * Math.PI * 3) * 0.1 * (1 - t)));
    } else {
      title.scale.set(1 + Math.sin(elapsed * 0.005) * 0.04);
    }

    // amount + line fade in after 400ms
    if (elapsed > 400) {
      if (amount) amount.alpha = Math.min(1, (elapsed - 400) / 300);
      if (line)   line.alpha   = Math.min(0.9, (elapsed - 600) / 400);
    }

    // photo fly-in
    for (const sp of photoSprites) {
      if (sp.destroyed) continue;
      sp.vy += 0.3;
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.rotation += sp.vrot;
      if (sp.y < sp.targetY) sp.alpha = Math.min(1, sp.alpha + 0.05);
      if (sp.y > H + 200 || sp.x < -200 || sp.x > W + 200) {
        ov.removeChild(sp); sp.destroy();
      }
    }

    // confetti fall
    for (const c of confetti) {
      c.vy += 0.25;
      c.x += c.vx;
      c.y += c.vy;
      c.rotation += c.vrot;
      if (c.y > H + 20) { c.y = -20; c.x = cx + (Math.random() - 0.5) * W * 0.6; c.vy = -2 - Math.random() * 4; }
    }

    // screen shake on the overlay
    if (cfg.shake && elapsed < 600) {
      const s = cfg.shake * (1 - elapsed / 600);
      ov.x = (Math.random() - 0.5) * s;
      ov.y = (Math.random() - 0.5) * s;
    } else { ov.x = 0; ov.y = 0; }

    if (elapsed > DURATION) {
      app.ticker.remove(tickerFn);
      // PHASE 7: stop all Ken Burns loops on flying photos
      for (const stop of photoStopKB) try { stop(); } catch(e){}
      fxLayer.removeChildren();
      activeOverlay = null;
      if (opts.onDone) opts.onDone();
    }
  };
  app.ticker.add(tickerFn);
}

// Quick toast for non-celebration messages
export function toast(app, msg, ms = 2400) {
  if (!fxLayer) initFX(app);
  const W = app.screen.width, H = app.screen.height;
  const t = new PIXI.Text(msg, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 16,
    fontWeight: "600",
    fill: 0xffffff,
    stroke: 0x160b20,
    strokeThickness: 3,
    align: "center",
    wordWrap: true,
    wordWrapWidth: W * 0.7
  });
  t.anchor.set(0.5);
  t.x = W / 2;
  t.y = H - 80;
  t.alpha = 0;
  fxLayer.addChild(t);
  let el = 0;
  const TOTAL = ms;
  const fn = (dt) => {
    el += dt * 16.67;
    if (el < 200) t.alpha = el / 200;
    else if (el > TOTAL - 300) t.alpha = Math.max(0, (TOTAL - el) / 300);
    else t.alpha = 1;
    if (el > TOTAL) { app.ticker.remove(fn); fxLayer.removeChild(t); t.destroy(); }
  };
  app.ticker.add(fn);
}
