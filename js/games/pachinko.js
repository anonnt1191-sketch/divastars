// games/pachinko.js — Pachinko field with 8 rows of pegs feeding 9 photo buckets.
// Multipliers: edges high (x25), center low (x1) — bell-shaped distribution.
// Each drop lights the winning bucket + enlarges its diva photo in a top display.
// Multiple balls per round (one bet per ball).

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { CAST_LIST } from "../core/app.js";
import { castToPhotoURL, castPick } from "../core/photos.js";

const PEG_ROWS = 8;
const BUCKETS = 9;
const MULTS = [25, 10, 5, 2, 1, 2, 5, 10, 25]; // edges high, center low

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  // bg
  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  // tagline
  const tagline = new PIXI.Text(game.tagline || game.blurb || "", {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // ============ WINNER DISPLAY (top-center) ============
  const dispY = 28;
  const dispH = 110;
  const dispW = W - 24;
  const display = new PIXI.Container();
  display.x = W / 2; display.y = dispY + dispH / 2;
  c.addChild(display);

  function drawDisplayBg() {
    const g = new PIXI.Graphics();
    g.lineStyle(2, 0xf2c76e, 0.4)
      .beginFill(0x160b20, 0.6)
      .drawRoundedRect(-dispW / 2, -dispH / 2, dispW, dispH, 12)
      .endFill();
    return g;
  }
  const displayBg = drawDisplayBg();
  display.addChild(displayBg);
  const displayText = new PIXI.Text("DROP A BALL", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900",
    fill: 0xf2c76e, align: "center"
  });
  displayText.anchor.set(0.5);
  display.addChild(displayText);

  // ============ PLAYFIELD ============
  const fieldY = dispY + dispH + 10;
  const fieldH = H - fieldY - 110;
  const fieldX = 12;
  const fieldW = W - 24;

  // peg container
  const pegContainer = new PIXI.Container();
  pegContainer.x = fieldX; pegContainer.y = fieldY;
  c.addChild(pegContainer);

  const pegRowH = (fieldH - 86) / PEG_ROWS; // leave 86px for buckets
  const pegs = [];
  for (let row = 0; row < PEG_ROWS; row++) {
    const count = row + 2;            // 2,3,4,5,6,7,8,9
    const rowY = row * pegRowH + pegRowH / 2;
    const rowSpacing = fieldW / count;
    for (let i = 0; i < count; i++) {
      pegs.push({ x: (i + 0.5) * rowSpacing, y: rowY });
    }
  }
  const pegGfx = new PIXI.Graphics();
  for (const p of pegs) {
    pegGfx.beginFill(0xf2c76e).drawCircle(p.x, p.y, 4).endFill();
    pegGfx.beginFill(0xffe9b8, 0.6).drawCircle(p.x - 1, p.y - 1, 1.5).endFill();
  }
  pegContainer.addChild(pegGfx);

  // bucket container
  const bucketTop = PEG_ROWS * pegRowH + 10;
  const bucketW = fieldW / BUCKETS;
  const bucketH = 76;
  const bucketContainer = new PIXI.Container();
  bucketContainer.x = fieldX; bucketContainer.y = fieldY + bucketTop;
  c.addChild(bucketContainer);

  // pick 9 unique divas for buckets
  const usedCasts = new Set();
  const bucketCasts = [];
  for (let i = 0; i < BUCKETS; i++) {
    const cast = castPick(CAST_LIST, usedCasts);
    usedCasts.add(cast.key);
    bucketCasts.push(cast);
  }

  const bucketGfx = [];
  const bucketPhotoSp = [];
  for (let i = 0; i < BUCKETS; i++) {
    const cast = bucketCasts[i];
    const mult = MULTS[i];
    const x = i * bucketW;
    const g = new PIXI.Graphics();
    drawBucket(g, x, mult);
    bucketContainer.addChild(g);
    bucketGfx.push(g);
    // photo
    const url = castToPhotoURL(cast);
    const photoSize = bucketW - 8;
    PIXI.Assets.load(url).then(tex => {
      if (!tex || bucketContainer.destroyed) return;
      const sp = new PIXI.Sprite(tex);
      const scale = photoSize / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.x = x + 4;
      sp.y = 6;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(x + 4, 4, photoSize, photoSize, 6).endFill();
      bucketContainer.addChild(mask);
      sp.mask = mask;
      bucketContainer.addChild(sp);
      bucketPhotoSp.push({ i, sp });
    }).catch(() => {});
  }

  function drawBucket(g, x, mult) {
    const color = mult >= 25 ? 0xff2e88
                : mult >= 10 ? 0xffd700
                : mult >= 5 ? 0xf2c76e
                : mult >= 2 ? 0x57d38f : 0xff5d5d;
    g.lineStyle(2, color, 0.8)
      .beginFill(0x1c0e2a)
      .drawRoundedRect(x + 2, 0, bucketW - 4, bucketH, 8)
      .endFill();
    g.beginFill(color, 0.6).drawRoundedRect(x + 2, 0, bucketW - 4, 6, 4).endFill();
    const mt = new PIXI.Text(mult + "x", {
      fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "900",
      fill: 0xffe9b8, stroke: 0x000000, strokeThickness: 2
    });
    mt.anchor.set(0.5, 1);
    mt.x = x + bucketW / 2;
    mt.y = bucketH - 3;
    g.addChild(mt);
  }

  // ball container
  const ballContainer = new PIXI.Container();
  ballContainer.x = fieldX; ballContainer.y = fieldY;
  c.addChild(ballContainer);

  const balls = [];

  // ============ BET ROW + DROP BUTTON ============
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    curBet = [10, 25, 50, 100, 250][i];
    updateBtn();
  }));

  const dropBtn = makeButton(W - 16, 60, "DROP BALL · " + curBet, 0xf2c76e, 0x160b20);
  dropBtn.x = 8; dropBtn.y = H - 60;
  dropBtn.interactive = true; dropBtn.buttonMode = true;
  c.addChild(dropBtn);
  function updateBtn() { dropBtn.children[1].text = "DROP BALL · " + curBet; }

  dropBtn.on("pointertap", dropBall);

  function dropBall() {
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    sfx.whoosh();
    const ball = new PIXI.Graphics();
    ball.beginFill(0xff2e88).drawCircle(0, 0, 8).endFill();
    ball.beginFill(0xffe9b8).drawCircle(-2, -2, 3).endFill();
    ball.x = fieldW / 2;
    ball.y = -10;
    ballContainer.addChild(ball);
    balls.push({
      sprite: ball, x: fieldW / 2, y: -10, vx: 0, vy: 0,
      row: 0, settled: false
    });
  }

  // ============ PHYSICS LOOP ============
  const gravity = 700;
  const maxV = 380;

  const tickerFn = (dt) => {
    const dts = dt / 60;
    for (const b of balls) {
      if (b.settled) continue;
      b.vy = Math.min(maxV, b.vy + gravity * dts);
      b.x += b.vx * dts;
      b.y += b.vy * dts;
      // peg row collision: at each row midpoint, deflect left/right
      const targetRowY = (b.row + 0.5) * pegRowH;
      if (b.y >= targetRowY && b.row < PEG_ROWS) {
        b.y = targetRowY;
        const dir = Math.random() < 0.5 ? -1 : 1;
        b.vx = dir * 50;
        b.vy = 90;
        sfx.tick();
        b.row++;
        if (b.row >= PEG_ROWS) {
          const bucketIdx = Math.max(0, Math.min(BUCKETS - 1, Math.floor(b.x / bucketW)));
          settleBall(b, bucketIdx);
        }
      }
      b.sprite.x = b.x;
      b.sprite.y = b.y;
      if (b.x < 8) { b.x = 8; b.vx = Math.abs(b.vx); }
      if (b.x > fieldW - 8) { b.x = fieldW - 8; b.vx = -Math.abs(b.vx); }
    }
  };
  pixiApp.ticker.add(tickerFn);

  function settleBall(ball, bucketIdx) {
    ball.settled = true;
    const mult = MULTS[bucketIdx];
    const cast = bucketCasts[bucketIdx];
    const win = Math.floor(curBet * mult);
    if (win > 0) {
      store.pay(win);
      sfx.coin();
    } else {
      sfx.lose();
    }
    store.record(game.id, curBet, win);

    flashBucket(bucketIdx);
    showWinner(cast, mult, win);

    // animate ball settling to bucket center, then fade
    const targetX = (bucketIdx + 0.5) * bucketW;
    const targetY = bucketTop + bucketH - 12;
    let el = 0;
    const animFn = (dt) => {
      el += dt;
      ball.x += (targetX - ball.x) * 0.2;
      ball.y += (targetY - ball.y) * 0.2;
      ball.sprite.x = ball.x;
      ball.sprite.y = ball.y;
      ball.sprite.alpha = Math.max(0, ball.sprite.alpha - 0.04);
      if (el > 30) {
        pixiApp.ticker.remove(animFn);
        ballContainer.removeChild(ball.sprite);
        ball.sprite.destroy();
        const idx = balls.indexOf(ball);
        if (idx >= 0) balls.splice(idx, 1);
        if (win > 0) {
          const tier = mult >= 25 ? "mega"
                     : mult >= 10 ? "big" : "win";
          host.onWin(tier, win, {
            title: mult + "x · " + cast.name,
            line: "+" + win + " chips"
          });
        }
      }
    };
    pixiApp.ticker.add(animFn);
  }

  function flashBucket(idx) {
    const g = bucketGfx[idx];
    const start = performance.now();
    const fn = () => {
      const e = (performance.now() - start) / 800;
      if (e >= 1) {
        g.alpha = 1;
        pixiApp.ticker.remove(fn);
        return;
      }
      g.alpha = 0.4 + 0.6 * Math.abs(Math.sin(e * Math.PI * 6));
    };
    pixiApp.ticker.add(fn);
  }

  function showWinner(cast, mult, win) {
    // clear display, redraw
    display.removeChildren();
    const newBg = drawDisplayBg();
    display.addChild(newBg);

    const photoSize = dispH - 16;
    // text on the LEFT half, photo on the RIGHT
    const textX = -dispW / 2 + 14;
    const title = new PIXI.Text(cast.name, {
      fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900",
      fill: 0xffe9b8, stroke: 0x000000, strokeThickness: 2, align: "left"
    });
    title.anchor.set(0, 0.5);
    title.x = textX;
    title.y = -18;
    display.addChild(title);

    const subColor = mult >= 25 ? 0xff2e88
                   : mult >= 10 ? 0xffd700
                   : mult >= 2 ? 0xf2c76e : 0xff5d5d;
    const sub = new PIXI.Text(`${mult}x · ${win > 0 ? "+" + win + " chips" : "no win"}`, {
      fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700", fill: subColor
    });
    sub.anchor.set(0, 0.5);
    sub.x = textX;
    sub.y = 14;
    display.addChild(sub);

    // photo on right
    const url = castToPhotoURL(cast);
    const photoCx = dispW / 2 - photoSize / 2 - 8;
    const photoCy = 0;
    PIXI.Assets.load(url).then(tex => {
      if (!tex || display.destroyed) return;
      const sp = new PIXI.Sprite(tex);
      const scale = photoSize / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5);
      sp.x = photoCx; sp.y = photoCy;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(photoCx - photoSize / 2, photoCy - photoSize / 2, photoSize, photoSize, 10).endFill();
      display.addChild(mask);
      sp.mask = mask;
      display.addChild(sp);
      // gold ring
      const ring = new PIXI.Graphics();
      ring.lineStyle(3, 0xffd700, 0.85)
        .drawRoundedRect(photoCx - photoSize / 2 - 2, photoCy - photoSize / 2 - 2, photoSize + 4, photoSize + 4, 12)
        .endFill();
      display.addChild(ring);
    }).catch(() => {});
  }

  return function cleanup() {
    pixiApp.ticker.remove(tickerFn);
  };
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "700", fill: fg
  });
  tx.anchor.set(0.5); tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}
