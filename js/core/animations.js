// core/animations.js — PHASE 7: animation helpers.
// Ken Burns effect on still photos (zoom/pan/rotate to simulate motion).
// Multiplier pulse overlay (animated growing number).
// Scatter anticipation glow (pulsing ring on a cell).

// Apply Ken Burns animation to a sprite. Returns a stop() function.
// opts: { zoomRange: [1, 1.15], panRange: [-10, 10], rotateRange: [-0.02, 0.02], speed: 0.5 }
export function kenBurns(app, sprite, opts = {}) {
  if (!sprite || !app) return () => {};
  const zoomMin = opts.zoomRange?.[0] ?? 1;
  const zoomMax = opts.zoomRange?.[1] ?? 1.15;
  const panMin = opts.panRange?.[0] ?? -8;
  const panMax = opts.panRange?.[1] ?? 8;
  const rotMin = opts.rotateRange?.[0] ?? -0.02;
  const rotMax = opts.rotateRange?.[1] ?? 0.02;
  const speed = opts.speed ?? 0.5;  // cycles per second

  const origX = sprite.x;
  const origY = sprite.y;
  const origScale = sprite.scale.x;
  const origRotation = sprite.rotation;
  let t = 0;
  // random phase offsets so multiple sprites don't sync
  const phaseX = Math.random() * Math.PI * 2;
  const phaseY = Math.random() * Math.PI * 2;
  const phaseZ = Math.random() * Math.PI * 2;
  const phaseR = Math.random() * Math.PI * 2;

  const fn = (dt) => {
    if (sprite.destroyed) {
      app.ticker.remove(fn);
      return;
    }
    t += dt * speed * 0.02;
    const tz = (Math.sin(t + phaseZ) + 1) / 2;  // 0..1
    const tx = (Math.sin(t + phaseX) + 1) / 2;
    const ty = (Math.sin(t + phaseY) + 1) / 2;
    const tr = (Math.sin(t + phaseR) + 1) / 2;
    const zoom = zoomMin + (zoomMax - zoomMin) * tz;
    sprite.scale.set(origScale * zoom);
    sprite.x = origX + (panMin + (panMax - panMin) * tx) * (zoom - 1) * 4;
    sprite.y = origY + (panMin + (panMax - panMin) * ty) * (zoom - 1) * 4;
    sprite.rotation = origRotation + (rotMin + (rotMax - rotMin) * tr);
  };
  app.ticker.add(fn);

  return () => {
    app.ticker.remove(fn);
    if (!sprite.destroyed) {
      sprite.scale.set(origScale);
      sprite.x = origX;
      sprite.y = origY;
      sprite.rotation = origRotation;
    }
  };
}

// Show an animated multiplier overlay that pulses and grows.
// Usage: const stop = multiplierPulse(app, parent, x, y, "5x", { color: 0xff2e88, duration: 2000 });
export function multiplierPulse(app, parent, x, y, text, opts = {}) {
  const color = opts.color ?? 0xff2e88;
  const duration = opts.duration ?? 2000;
  const fontSize = opts.fontSize ?? 48;

  const container = new PIXI.Container();
  container.x = x;
  container.y = y;
  parent.addChild(container);

  // glow ring (pulsing)
  const ring = new PIXI.Graphics();
  container.addChild(ring);

  // text
  const tx = new PIXI.Text(text, {
    fontFamily: "Outfit, sans-serif",
    fontSize: fontSize,
    fontWeight: "900",
    fill: color,
    stroke: 0x160b20,
    strokeThickness: 4,
    align: "center"
  });
  tx.anchor.set(0.5);
  container.addChild(tx);

  let t = 0;
  let scale = 0.3;
  const fn = (dt) => {
    if (container.destroyed) { app.ticker.remove(fn); return; }
    t += dt * 16.67;
    // entry: 0-300ms grow from 0.3 to 1.2 with overshoot
    if (t < 300) {
      const p = t / 300;
      scale = 0.3 + 0.9 * (1 - Math.pow(1 - p, 3)) + Math.sin(p * Math.PI) * 0.15;
    } else if (t < duration - 300) {
      // pulse
      scale = 1.0 + Math.sin((t - 300) * 0.01) * 0.06;
    } else if (t < duration) {
      // exit
      const p = (duration - t) / 300;
      scale = 1.0 * p;
      container.alpha = p;
    } else {
      app.ticker.remove(fn);
      if (container.parent) container.parent.removeChild(container);
      container.destroy({ children: true });
      return;
    }
    container.scale.set(scale);
    // redraw ring
    ring.clear();
    ring.lineStyle(4, color, 0.6 * (scale > 1 ? 1 : scale)).drawCircle(0, 0, tx.width * 0.7 * scale).endFill();
    ring.beginFill(color, 0.15 * scale).drawCircle(0, 0, tx.width * 0.7 * scale).endFill();
  };
  app.ticker.add(fn);

  return () => {
    app.ticker.remove(fn);
    if (container.parent) container.parent.removeChild(container);
    container.destroy({ children: true });
  };
}

// Scatter anticipation glow — pulses a ring around a cell to hint at a potential scatter.
// Usage: const stop = scatterGlow(app, parent, x, y, size);
export function scatterGlow(app, parent, x, y, size, opts = {}) {
  const color = opts.color ?? 0xd946ef;
  const container = new PIXI.Container();
  container.x = x + size/2;
  container.y = y + size/2;
  parent.addChild(container);

  const ring = new PIXI.Graphics();
  container.addChild(ring);

  let t = 0;
  const fn = (dt) => {
    if (container.destroyed) { app.ticker.remove(fn); return; }
    t += dt * 16.67;
    const pulse = (Math.sin(t * 0.008) + 1) / 2;  // 0..1
    const radius = size * 0.5 * (1 + pulse * 0.1);
    ring.clear();
    ring.lineStyle(3 + pulse * 2, color, 0.7 + pulse * 0.3).drawCircle(0, 0, radius).endFill();
    ring.beginFill(color, pulse * 0.2).drawCircle(0, 0, radius).endFill();
  };
  app.ticker.add(fn);

  return () => {
    app.ticker.remove(fn);
    if (container.parent) container.parent.removeChild(container);
    container.destroy({ children: true });
  };
}

// Free spins entry takeover — full-screen diva photo with voice line, fades in/out.
// Usage: freeSpinsEntry(app, parent, photoUrl, { title: "10 FREE SPINS", line: "Vedhika approves.", duration: 2500 });
export async function freeSpinsEntry(app, parent, photoUrl, opts = {}) {
  const W = app.screen.width, H = app.screen.height;
  const title = opts.title ?? "FREE SPINS";
  const line = opts.line ?? "";
  const duration = opts.duration ?? 2500;
  const color = opts.color ?? 0xd946ef;

  const overlay = new PIXI.Container();
  parent.addChild(overlay);

  // dark bg
  const dark = new PIXI.Graphics();
  dark.beginFill(0x000000, 0).drawRect(0, 0, W, H).endFill();
  overlay.addChild(dark);

  // diva photo (right side)
  let photoSprite = null;
  let stopKB = null;
  if (photoUrl) {
    try {
      const tex = await PIXI.Assets.load(photoUrl);
      if (tex && !overlay.destroyed) {
        photoSprite = new PIXI.Sprite(tex);
        const photoW = W * 0.6;
        const scale = photoW / tex.width;
        photoSprite.scale.set(scale);
        photoSprite.x = W - photoW - 8;
        photoSprite.y = (H - tex.height * scale) / 2;
        photoSprite.alpha = 0;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(photoSprite.x, photoSprite.y, photoW, tex.height * scale, 16).endFill();
        overlay.addChild(mask);
        photoSprite.mask = mask;
        overlay.addChild(photoSprite);
        // Ken Burns on the photo
        stopKB = kenBurns(app, photoSprite, { zoomRange: [1, 1.1], speed: 0.3 });
      }
    } catch(e) {}
  }

  // text panel (left)
  const titleTx = new PIXI.Text(title, {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: 32, fontStyle: "italic", fontWeight: "900", fill: color,
    stroke: 0x160b20, strokeThickness: 4, align: "center", wordWrap: true, wordWrapWidth: W * 0.4
  });
  titleTx.anchor.set(0.5, 0.5);
  titleTx.x = W * 0.25;
  titleTx.y = H * 0.4;
  titleTx.alpha = 0;
  overlay.addChild(titleTx);

  const lineTx = new PIXI.Text(line, {
    fontFamily: "Outfit, sans-serif",
    fontSize: 14, fontStyle: "italic", fill: 0xffe9b8, align: "center",
    wordWrap: true, wordWrapWidth: W * 0.4
  });
  lineTx.anchor.set(0.5, 0.5);
  lineTx.x = W * 0.25;
  lineTx.y = H * 0.55;
  lineTx.alpha = 0;
  overlay.addChild(lineTx);

  // animate
  let t = 0;
  return new Promise(resolve => {
    const fn = (dt) => {
      if (overlay.destroyed) { app.ticker.remove(fn); resolve(); return; }
      t += dt * 16.67;
      // fade in (0-500ms)
      if (t < 500) {
        const p = t / 500;
        dark.clear();
        dark.beginFill(0x000000, 0.85 * p).drawRect(0, 0, W, H).endFill();
        if (photoSprite) photoSprite.alpha = p;
        titleTx.alpha = p;
        lineTx.alpha = p;
        // title pop
        const sp = 0.5 + 0.5 * (1 - Math.pow(1 - p, 3)) + Math.sin(p * Math.PI) * 0.15;
        titleTx.scale.set(sp);
      } else if (t < duration - 500) {
        // hold
        titleTx.scale.set(1.0 + Math.sin((t - 500) * 0.005) * 0.04);
      } else if (t < duration) {
        // fade out
        const p = (duration - t) / 500;
        dark.clear();
        dark.beginFill(0x000000, 0.85 * p).drawRect(0, 0, W, H).endFill();
        if (photoSprite) photoSprite.alpha = p;
        titleTx.alpha = p;
        lineTx.alpha = p;
      } else {
        app.ticker.remove(fn);
        if (stopKB) stopKB();
        if (overlay.parent) overlay.parent.removeChild(overlay);
        overlay.destroy({ children: true });
        resolve();
      }
    };
    app.ticker.add(fn);
  });
}
