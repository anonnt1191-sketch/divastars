// games/pinball.js — Photo Pinball. Real table: 5 photo bumpers, 2 slingshots, 2 flippers.
// Tap left half = left flipper, right half = right flipper. Z / M keys also work.
// 3 balls per round. Payout = points / 5000 * bet. Bumper photos reshuffle each ball.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { castToPhotoURL, castPick } from "../core/photos.js";
import { CAST_LIST } from "../core/app.js";

const POINTS_PER_UNIT = 5000;   // payout = floor(score / 5000 * bet)

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  // ── Background ────────────────────────────────────────────────────────────
  const bg = new PIXI.Graphics();
  bg.beginFill(0x0d0815, 0.75).drawRect(0, 0, W, H).endFill();
  for (let i = 0; i < H; i += 4) {
    const tt = i / H;
    bg.beginFill(0x2a1245, 0.10 + (1 - tt) * 0.20).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb || "Slap the bumpers. Save the ball.", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 4;
  c.addChild(tagline);

  // ── HUD ───────────────────────────────────────────────────────────────────
  const ballsText = new PIXI.Text("BALLS: 3", {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "900", fill: 0xffe9b8,
    stroke: 0x160b20, strokeThickness: 3
  });
  ballsText.x = 8; ballsText.y = 22;
  c.addChild(ballsText);

  const scoreText = new PIXI.Text("SCORE: 0", {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "900", fill: 0xf2c76e,
    stroke: 0x160b20, strokeThickness: 3, align: "right"
  });
  scoreText.anchor.set(1, 0);
  scoreText.x = W - 8; scoreText.y = 22;
  c.addChild(scoreText);

  // ── Playfield ─────────────────────────────────────────────────────────────
  const fieldX = 8, fieldY = 44;
  const fieldW = W - 16;
  const fieldH = H - fieldY - 110;

  const field = new PIXI.Container();
  field.x = fieldX; field.y = fieldY;
  c.addChild(field);

  // frame
  const frame = new PIXI.Graphics();
  frame.beginFill(0x180a28).drawRect(0, 0, fieldW, fieldH).endFill();
  frame.lineStyle(3, 0xf2c76e, 1);
  frame.moveTo(0, 0).lineTo(0, fieldH);
  frame.moveTo(fieldW, 0).lineTo(fieldW, fieldH);
  frame.moveTo(0, 0).lineTo(fieldW, 0);
  field.addChild(frame);

  // Flipper geometry
  const flipperY = fieldH - 36;
  const leftPivotX = fieldW * 0.30;
  const rightPivotX = fieldW * 0.70;
  const flipperLen = 54;
  const flipperW = 16;

  // angled inlane walls (visual + collision)
  const wallGfx = new PIXI.Graphics();
  wallGfx.lineStyle(3, 0x7c1d3f, 1);
  wallGfx.moveTo(0, fieldH * 0.62).lineTo(leftPivotX - 38, flipperY + 6);
  wallGfx.moveTo(fieldW, fieldH * 0.62).lineTo(rightPivotX + 38, flipperY + 6);
  field.addChild(wallGfx);

  // ── Bumpers (5) ───────────────────────────────────────────────────────────
  const bumperR = 26;
  const bumperPositions = [
    { x: fieldW * 0.25, y: fieldH * 0.20 },
    { x: fieldW * 0.75, y: fieldH * 0.20 },
    { x: fieldW * 0.50, y: fieldH * 0.32 },
    { x: fieldW * 0.32, y: fieldH * 0.46 },
    { x: fieldW * 0.68, y: fieldH * 0.46 }
  ];
  const bumpers = bumperPositions.map(p => ({
    x: p.x, y: p.y, r: bumperR, hitFlash: 0,
    ring: null, sprite: null, mask: null, cast: null, baseScale: 1
  }));
  const bumperLayer = new PIXI.Container();
  field.addChild(bumperLayer);

  async function reshuffleBumpers() {
    bumperLayer.removeChildren();
    const used = new Set();
    for (const b of bumpers) {
      b.cast = castPick(CAST_LIST, used);
      used.add(b.cast.key);
      b.ring = null; b.sprite = null; b.mask = null;
    }
    const urls = bumpers.map(b => castToPhotoURL(b.cast));
    const texs = await Promise.all(urls.map(u => PIXI.Assets.load(u).catch(() => null)));
    for (let i = 0; i < bumpers.length; i++) {
      const b = bumpers[i];
      // ring (centered at 0,0 so we can scale from center)
      const ring = new PIXI.Graphics();
      ring.lineStyle(3, 0xff2e88, 1).drawCircle(0, 0, b.r + 2).endFill();
      ring.x = b.x; ring.y = b.y;
      ring.alpha = 0.5;
      bumperLayer.addChild(ring);
      b.ring = ring;
      const tex = texs[i];
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        const sz = b.r * 2 - 6;
        const scale = sz / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.anchor.set(0.5);
        sp.x = b.x; sp.y = b.y;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawCircle(0, 0, b.r - 3).endFill();
        mask.x = b.x; mask.y = b.y;
        bumperLayer.addChild(mask);
        sp.mask = mask;
        bumperLayer.addChild(sp);
        b.sprite = sp; b.mask = mask; b.baseScale = scale;
      }
    }
  }
  await reshuffleBumpers();

  // ── Slingshots (2) ────────────────────────────────────────────────────────
  const slings = [
    { x: 50, y: fieldH * 0.74, r: 22, hitFlash: 0,
      pts: [[6, fieldH*0.58], [6, fieldH*0.90], [50, fieldH*0.74]] },
    { x: fieldW - 50, y: fieldH * 0.74, r: 22, hitFlash: 0,
      pts: [[fieldW-6, fieldH*0.58], [fieldW-6, fieldH*0.90], [fieldW-50, fieldH*0.74]] }
  ];
  const slingsGfx = new PIXI.Graphics();
  function drawSlings() {
    slingsGfx.clear();
    for (const s of slings) {
      slingsGfx.lineStyle(2, 0xff2e88, 1);
      slingsGfx.beginFill(s.hitFlash > 0 ? 0xffe9b8 : 0x4a1a30, 0.85);
      slingsGfx.moveTo(s.pts[0][0], s.pts[0][1]);
      slingsGfx.lineTo(s.pts[1][0], s.pts[1][1]);
      slingsGfx.lineTo(s.pts[2][0], s.pts[2][1]);
      slingsGfx.closePath();
      slingsGfx.endFill();
    }
  }
  field.addChild(slingsGfx);
  drawSlings();

  // ── Flippers (2) ──────────────────────────────────────────────────────────
  const flippers = [
    { pivotX: leftPivotX, pivotY: flipperY,
      restAngle: 0.45, upAngle: -0.45, angle: 0.45,
      active: false, activeTime: -1, side: "left" },
    { pivotX: rightPivotX, pivotY: flipperY,
      restAngle: Math.PI - 0.45, upAngle: Math.PI + 0.45, angle: Math.PI - 0.45,
      active: false, activeTime: -1, side: "right" }
  ];
  const flipperGfx = new PIXI.Graphics();
  field.addChild(flipperGfx);

  function drawFlippers() {
    flipperGfx.clear();
    for (const f of flippers) {
      const cos = Math.cos(f.angle), sin = Math.sin(f.angle);
      const px = -sin, py = cos;            // perpendicular
      const hw = flipperW / 2;
      const tipX = f.pivotX + cos * flipperLen;
      const tipY = f.pivotY + sin * flipperLen;
      const color = f.active ? 0xff2e88 : 0xf2c76e;
      flipperGfx.beginFill(color);
      flipperGfx.drawPolygon([
        f.pivotX + px * hw, f.pivotY + py * hw,
        f.pivotX - px * hw, f.pivotY - py * hw,
        tipX - px * hw, tipY - py * hw,
        tipX + px * hw, tipY + py * hw
      ]);
      flipperGfx.endFill();
      flipperGfx.beginFill(color).drawCircle(tipX, tipY, hw).endFill();
      flipperGfx.beginFill(0xffe9b8).drawCircle(f.pivotX, f.pivotY, 7).endFill();
    }
  }
  drawFlippers();

  // ── Tap surface (transparent, covers whole field) ─────────────────────────
  const hitArea = new PIXI.Graphics();
  hitArea.beginFill(0xffffff, 0).drawRect(0, 0, fieldW, fieldH).endFill();
  hitArea.interactive = true;
  field.addChild(hitArea);

  function pressLeft() {
    if (!flippers[0].active) { flippers[0].activeTime = performance.now(); sfx.click(); }
    flippers[0].active = true;
  }
  function releaseLeft() { flippers[0].active = false; }
  function pressRight() {
    if (!flippers[1].active) { flippers[1].activeTime = performance.now(); sfx.click(); }
    flippers[1].active = true;
  }
  function releaseRight() { flippers[1].active = false; }

  hitArea.on("pointerdown", (e) => {
    const lx = e.global.x - field.x;
    if (lx < fieldW / 2) pressLeft();
    else pressRight();
  });

  const globalUpFn = () => { releaseLeft(); releaseRight(); };
  window.addEventListener("pointerup", globalUpFn);
  window.addEventListener("pointercancel", globalUpFn);

  const keyDownFn = (e) => {
    const k = e.key.toLowerCase();
    if (k === "z" || k === "arrowleft") pressLeft();
    if (k === "m" || k === "/" || k === "arrowright") pressRight();
  };
  const keyUpFn = (e) => {
    const k = e.key.toLowerCase();
    if (k === "z" || k === "arrowleft") releaseLeft();
    if (k === "m" || k === "/" || k === "arrowright") releaseRight();
  };
  window.addEventListener("keydown", keyDownFn);
  window.addEventListener("keyup", keyUpFn);

  // ── Ball + physics state ──────────────────────────────────────────────────
  let balls = 3;
  let score = 0;
  let curBet = 25;
  let active = false;
  let ball = null;
  const ballLayer = new PIXI.Container();
  field.addChild(ballLayer);

  function spawnBall() {
    ball = {
      x: fieldW * 0.5 + (Math.random() - 0.5) * 50,
      y: 24,
      vx: (Math.random() - 0.5) * 120,
      vy: 80
    };
    const sp = new PIXI.Graphics();
    sp.beginFill(0xffe9b8).drawCircle(0, 0, 9).endFill();
    sp.beginFill(0xff2e88, 0.7).drawCircle(-2.5, -2.5, 3.5).endFill();
    sp.x = ball.x; sp.y = ball.y;
    ballLayer.addChild(sp);
    ball.sprite = sp;
    sfx.whoosh();
  }

  // ── Bet row + start button ────────────────────────────────────────────────
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) =>
    p.on("pointertap", () => { curBet = [10, 25, 50, 100, 250][i]; updateStartBtn(); }));

  const startBtn = makeButton(W - 16, 50, "PLAY · " + curBet, 0xf2c76e, 0x160b20);
  startBtn.x = 8; startBtn.y = H - 55;
  startBtn.interactive = true; startBtn.buttonMode = true;
  c.addChild(startBtn);
  function updateStartBtn() {
    startBtn.children[1].text = active ? "PLAYING..." : "PLAY · " + curBet;
  }

  startBtn.on("pointertap", () => {
    if (active) return;
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    sfx.click();
    active = true;
    balls = 3;
    score = 0;
    ballsText.text = "BALLS: 3";
    scoreText.text = "SCORE: 0";
    reshuffleBumpers();
    spawnBall();
    updateStartBtn();
  });

  function drainBall() {
    if (ball && ball.sprite) { ballLayer.removeChild(ball.sprite); ball.sprite.destroy(); }
    ball = null;
    balls--;
    ballsText.text = "BALLS: " + Math.max(0, balls);
    sfx.lose();
    if (balls <= 0) {
      endRound();
    } else {
      reshuffleBumpers();
      setTimeout(() => { if (active) spawnBall(); }, 700);
    }
  }

  function endRound() {
    active = false;
    if (ball && ball.sprite) { ballLayer.removeChild(ball.sprite); ball.sprite.destroy(); ball = null; }
    const payout = Math.floor(score / POINTS_PER_UNIT * curBet);
    if (payout > 0) {
      store.pay(payout);
      store.record(game.id, curBet, payout);
      const tier = payout >= curBet * 10 ? "mega" : payout >= curBet * 4 ? "big" : "win";
      if (tier === "mega") sfx.mega(); else if (tier === "big") sfx.big(); else sfx.win();
      host.onWin(tier, payout, { title: score + " pts", line: "+" + payout + " chips" });
    } else {
      sfx.lose();
      store.record(game.id, curBet, 0);
      host.toast("No payout. Bumpers next time.", 2200);
    }
    updateStartBtn();
  }

  // ── Physics ticker ────────────────────────────────────────────────────────
  const tickerFn = (dt) => {
    const dts = Math.min(dt / 60, 0.04);
    updateFlipperAngles(dts);
    drawFlippers();
    decayFlashes(dts);
    if (!active || !ball) return;

    // gravity
    ball.vy += 1200 * dts;
    const maxV = 750;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > maxV) { ball.vx = ball.vx / sp * maxV; ball.vy = ball.vy / sp * maxV; }
    ball.x += ball.vx * dts;
    ball.y += ball.vy * dts;

    // side + top walls
    if (ball.x < 9) { ball.x = 9; ball.vx = Math.abs(ball.vx) * 0.7; sfx.tick(); }
    if (ball.x > fieldW - 9) { ball.x = fieldW - 9; ball.vx = -Math.abs(ball.vx) * 0.7; sfx.tick(); }
    if (ball.y < 9) { ball.y = 9; ball.vy = Math.abs(ball.vy) * 0.7; }

    // bumpers (100 pts each slap)
    for (const b of bumpers) {
      const dx = ball.x - b.x, dy = ball.y - b.y;
      const d = Math.hypot(dx, dy);
      const minD = 9 + b.r;
      if (d < minD && d > 0.01) {
        const nx = dx / d, ny = dy / d;
        ball.x = b.x + nx * minD;
        ball.y = b.y + ny * minD;
        const dot = ball.vx * nx + ball.vy * ny;
        ball.vx = (ball.vx - 2 * dot * nx) * 0.85 + nx * 260;
        ball.vy = (ball.vy - 2 * dot * ny) * 0.85 + ny * 260;
        score += 100;
        scoreText.text = "SCORE: " + score;
        b.hitFlash = 1;
        sfx.pop();
      }
    }

    // slingshots (50 pts each)
    for (const s of slings) {
      const dx = ball.x - s.x, dy = ball.y - s.y;
      const d = Math.hypot(dx, dy);
      const minD = 9 + s.r;
      if (d < minD && d > 0.01) {
        const nx = dx / d, ny = dy / d;
        ball.x = s.x + nx * minD;
        ball.y = s.y + ny * minD;
        const dot = ball.vx * nx + ball.vy * ny;
        ball.vx = (ball.vx - 2 * dot * nx) * 0.7 + nx * 300;
        ball.vy = (ball.vy - 2 * dot * ny) * 0.7 + ny * 300;
        score += 50;
        scoreText.text = "SCORE: " + score;
        s.hitFlash = 1;
        sfx.bonk();
      }
    }

    // angled inlane walls
    reflectFromLine(ball, 0, fieldH * 0.62, leftPivotX - 38, flipperY + 6);
    reflectFromLine(ball, fieldW, fieldH * 0.62, rightPivotX + 38, flipperY + 6);

    // flippers
    for (const f of flippers) handleFlipperCollision(f);

    // drain
    if (ball.y > fieldH + 12) { drainBall(); return; }

    ball.sprite.x = ball.x;
    ball.sprite.y = ball.y;
  };
  pixiApp.ticker.add(tickerFn);

  function updateFlipperAngles(dts) {
    for (const f of flippers) {
      const target = f.active ? f.upAngle : f.restAngle;
      const diff = target - f.angle;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), 25 * dts);
      f.angle += step;
    }
  }

  function handleFlipperCollision(f) {
    if (!ball) return;
    const tipX = f.pivotX + Math.cos(f.angle) * flipperLen;
    const tipY = f.pivotY + Math.sin(f.angle) * flipperLen;
    const cp = closestPointOnSegment(ball.x, ball.y, f.pivotX, f.pivotY, tipX, tipY);
    const dx = ball.x - cp.x, dy = ball.y - cp.y;
    const d = Math.hypot(dx, dy);
    const minD = 9 + flipperW / 2;
    if (d < minD && d > 0.01) {
      const nx = dx / d, ny = dy / d;
      ball.x = cp.x + nx * minD;
      ball.y = cp.y + ny * minD;
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx = (ball.vx - 2 * dot * nx) * 0.8;
      ball.vy = (ball.vy - 2 * dot * ny) * 0.8;
      const swingTime = (performance.now() - f.activeTime) / 1000;
      // active-swing boost: launch the ball up
      if (f.active && swingTime < 0.18) {
        const boost = 480;
        ball.vy -= boost * 0.7;
        ball.vx += (f.side === "left" ? 1 : -1) * boost * 0.35;
        sfx.bonk();
      }
    }
  }

  function decayFlashes(dts) {
    for (const b of bumpers) {
      if (b.hitFlash > 0) {
        b.hitFlash = Math.max(0, b.hitFlash - dts * 3);
        if (b.ring) b.ring.alpha = 0.4 + b.hitFlash * 0.6;
        if (b.sprite) {
          const s = b.baseScale * (1 + b.hitFlash * 0.25);
          b.sprite.scale.set(s);
        }
      }
    }
    let dirty = false;
    for (const s of slings) {
      if (s.hitFlash > 0) { s.hitFlash = Math.max(0, s.hitFlash - dts * 4); dirty = true; }
    }
    if (dirty) drawSlings();
  }

  function reflectFromLine(b, x1, y1, x2, y2) {
    const cp = closestPointOnSegment(b.x, b.y, x1, y1, x2, y2);
    const dx = b.x - cp.x, dy = b.y - cp.y;
    const d = Math.hypot(dx, dy);
    const minD = 11;
    if (d < minD && d > 0.01) {
      const nx = dx / d, ny = dy / d;
      b.x = cp.x + nx * minD;
      b.y = cp.y + ny * minD;
      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) {
        b.vx = (b.vx - 2 * dot * nx) * 0.8;
        b.vy = (b.vy - 2 * dot * ny) * 0.8;
      }
    }
  }

  return function cleanup() {
    pixiApp.ticker.remove(tickerFn);
    window.removeEventListener("pointerup", globalUpFn);
    window.removeEventListener("pointercancel", globalUpFn);
    window.removeEventListener("keydown", keyDownFn);
    window.removeEventListener("keyup", keyUpFn);
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────
function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let tt = ((px - x1) * dx + (py - y1) * dy) / len2;
  tt = Math.max(0, Math.min(1, tt));
  return { x: x1 + tt * dx, y: y1 + tt * dy };
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "700", fill: fg, align: "center"
  });
  tx.anchor.set(0.5);
  tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}
