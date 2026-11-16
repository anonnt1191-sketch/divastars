// games/plinko.js — drop a chip through 10 peg rows into 11 photo buckets.
// Smooth physics: ball position computed analytically per frame using delta time.
// Each bucket wears a photo; multiplier depends on risk level.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { castToPhotoURL } from "../core/photos.js";

const RISK_MULTS = {
  low:  [0.4, 0.7, 1.0, 1.3, 1.8, 2.0, 1.8, 1.3, 1.0, 0.7, 0.4].reverse(),  // edges low
  med:  [0.3, 0.6, 1.0, 1.5, 2.5, 3.0, 2.5, 1.5, 1.0, 0.6, 0.3].reverse(),
  high: [0.2, 0.5, 1.0, 2.0, 5.0, 9.0, 5.0, 2.0, 1.0, 0.5, 0.2].reverse()
};

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  // bg
  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  // tagline
  const tagline = new PIXI.Text(game.tagline, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 14, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // playfield
  const fieldY = 30;
  const fieldH = H - fieldH_safe();
  const fieldX = 8;
  const fieldW = W - 16;

  // risk selector
  let risk = "med";
  const riskRow = new PIXI.Container();
  riskRow.x = 8; riskRow.y = 24;
  c.addChild(riskRow);
  const riskOptions = [["low", t("plinko.low")], ["med", t("plinko.med")], ["high", t("plinko.high")]];
  const riskPills = [];
  riskOptions.forEach(([k, label], i) => {
    const p = makePill(label, k === risk ? 0xf2c76e : 0x333333, k === risk ? 0x160b20 : 0xffffff);
    p.x = i * (p.width + 4);
    p.interactive = true; p.buttonMode = true;
    p.on("pointertap", () => {
      sfx.click();
      risk = k;
      riskPills.forEach(x => {
        x.children[0].clear();
        x.children[0].beginFill(0x333333).drawRoundedRect(0, 0, x.width, x.height, x.height/2).endFill();
        x.children[1].style.fill = 0xffffff;
      });
      p.children[0].clear();
      p.children[0].beginFill(0xf2c76e).drawRoundedRect(0, 0, p.width, p.height, p.height/2).endFill();
      p.children[1].style.fill = 0x160b20;
      drawBuckets();
    });
    riskPills.push(p);
    riskRow.addChild(p);
  });

  // pegs (10 rows, alternating count)
  const pegRows = 10;
  const pegContainer = new PIXI.Container();
  pegContainer.x = fieldX;
  pegContainer.y = fieldY + 30;
  c.addChild(pegContainer);

  const bucketsTop = fieldY + 30 + pegRows * 36 + 20;
  const bucketW = fieldW / 11;
  const bucketH = 70;
  const bucketContainer = new PIXI.Container();
  bucketContainer.x = fieldX;
  bucketContainer.y = bucketsTop;
  c.addChild(bucketContainer);

  // build pegs
  const pegs = []; // [{x, y}]
  for (let row = 0; row < pegRows; row++) {
    const count = row + 3;  // 3, 4, 5... 12
    const rowY = row * 36;
    const rowSpacing = fieldW / count;
    for (let i = 0; i < count; i++) {
      const px = (i + 0.5) * rowSpacing;
      pegs.push({ x: px, y: rowY });
    }
  }
  // draw pegs
  const pegGfx = new PIXI.Graphics();
  for (const p of pegs) {
    pegGfx.beginFill(0xf2c76e).drawCircle(p.x, p.y, 4).endFill();
  }
  pegContainer.addChild(pegGfx);

  // buckets
  const bucketSprites = [];
  const bucketMultTexts = [];
  async function drawBuckets() {
    bucketContainer.removeChildren();
    bucketSprites.length = 0;
    bucketMultTexts.length = 0;
    const mults = RISK_MULTS[risk];
    for (let i = 0; i < 11; i++) {
      const cast = SESSION.plinko[i] || SESSION.crashPilots[i];
      const url = castToPhotoURL(cast);
      const x = i * bucketW;

      // bucket bg
      const bgGfx = new PIXI.Graphics();
      bgGfx.beginFill(0x1c0e2a).drawRoundedRect(x + 2, 0, bucketW - 4, bucketH, 8).endFill();
      const color = mults[i] >= 5 ? 0xff2e88 : mults[i] >= 2 ? 0xf2c76e : mults[i] >= 1 ? 0x57d38f : 0xff5d5d;
      bgGfx.beginFill(color, 0.6).drawRoundedRect(x + 2, 0, bucketW - 4, 4, 2).endFill();
      bucketContainer.addChild(bgGfx);

      // photo
      try {
        const tex = await PIXI.Assets.load(url);
        const sp = new PIXI.Sprite(tex);
        const sz = bucketW - 12;
        const scale = sz / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = x + (bucketW - tex.width * scale) / 2;
        sp.y = 8;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(x + 4, 6, bucketW - 8, sz, 6).endFill();
        bucketContainer.addChild(mask);
        sp.mask = mask;
        bucketContainer.addChild(sp);
        bucketSprites.push(sp);
      } catch(e) { bucketSprites.push(null); }

      // multiplier label
      const mt = new PIXI.Text(mults[i] + "x", {
        fontFamily: "Outfit, system-ui, sans-serif",
        fontSize: 12, fontWeight: "900", fill: 0xffe9b8, align: "center"
      });
      mt.anchor.set(0.5, 1);
      mt.x = x + bucketW/2;
      mt.y = bucketH - 4;
      bucketContainer.addChild(mt);
      bucketMultTexts.push(mt);
    }
  }
  await drawBuckets();

  // bet row + drop button
  const betRow = host.betRow(25);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);

  let curBet = 25;
  betRow.children.forEach((p, i) => {
    p.on("pointertap", () => { curBet = [10, 25, 50, 100, 250][i]; });
  });

  const dropBtn = makeButton(W - 16, 50, t("plinko.drop") + " · " + curBet, 0xf2c76e, 0x160b20);
  dropBtn.x = 8; dropBtn.y = H - 50;
  dropBtn.interactive = true; dropBtn.buttonMode = true;
  c.addChild(dropBtn);

  function updateDropBtn() {
    dropBtn.children[1].text = t("plinko.drop") + " · " + curBet;
  }
  betRow.children.forEach((p, i) => p.on("pointertap", updateDropBtn));

  // balls in flight
  const balls = []; // [{x, y, vx, vy, sprite, row, settled}]
  const ballContainer = new PIXI.Container();
  ballContainer.x = fieldX;
  ballContainer.y = fieldY + 30;
  c.addChild(ballContainer);

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
      sprite: ball, x: fieldW/2, y: -10, vx: 0, vy: 0,
      row: 0, settled: false
    });
  }
  dropBtn.on("pointertap", dropBall);

  // physics loop
  const pegRowH = 36;
  const gravity = 600; // px/s^2
  const maxV = 350;

  const tickerFn = (dt) => {
    const dts = dt / 60; // dt is in frames at 60fps; convert to seconds approx
    for (const b of balls) {
      if (b.settled) continue;
      // gravity
      b.vy = Math.min(maxV, b.vy + gravity * dts);
      // add a small random horizontal drift on each peg hit
      b.x += b.vx * dts;
      b.y += b.vy * dts;
      // peg collisions — at each row, when y crosses the peg row, push left or right
      const targetRowY = b.row * pegRowH;
      if (b.y >= targetRowY && b.row < pegRows) {
        b.y = targetRowY;
        // 50/50 left or right
        const dir = Math.random() < 0.5 ? -1 : 1;
        b.vx = dir * 40;
        b.vy = 80; // small bounce
        sfx.tick();
        b.row++;
        if (b.row >= pegRows) {
          // settle into a bucket — determine which bucket based on x position
          const bucketIdx = Math.max(0, Math.min(10, Math.floor(b.x / bucketW)));
          settleBall(b, bucketIdx);
        }
      }
      // update sprite
      b.sprite.x = b.x;
      b.sprite.y = b.y;
      // bounds — keep within field
      if (b.x < 10) { b.x = 10; b.vx = Math.abs(b.vx); }
      if (b.x > fieldW - 10) { b.x = fieldW - 10; b.vx = -Math.abs(b.vx); }
    }
  };
  pixiApp.ticker.add(tickerFn);

  function settleBall(ball, bucketIdx) {
    ball.settled = true;
    const mults = RISK_MULTS[risk];
    const mult = mults[bucketIdx];
    const win = Math.floor(curBet * mult);
    if (win > 0) {
      store.pay(win);
      sfx.coin();
    } else {
      sfx.lose();
    }
    store.record(game.id, curBet, win);
    // animate ball settling to bucket center
    const targetX = (bucketIdx + 0.5) * bucketW;
    const targetY = bucketsTop - fieldY - 30 + bucketH - 12;
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
          host.onWin(win >= curBet * 5 ? "big" : "win", win, {
            title: mult + "x bucket",
            line: `+${win} chips`
          });
        }
      }
    };
    pixiApp.ticker.add(animFn);
  }

  function fieldH_safe() { return Math.max(300, 320); }

  return function cleanup() {
    pixiApp.ticker.remove(tickerFn);
  };
}

function makePill(text, bg, fg) {
  const c = new PIXI.Container();
  const tx = new PIXI.Text(text, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 12, fontWeight: "700", fill: fg
  });
  const padX = 10, padY = 6;
  const w = tx.width + padX * 2, h = tx.height + padY * 2;
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, h/2).endFill();
  c.addChild(g);
  tx.x = padX; tx.y = padY;
  c.addChild(tx);
  return c;
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 16, fontWeight: "700", fill: fg, align: "center"
  });
  tx.anchor.set(0.5);
  tx.x = w/2; tx.y = h/2;
  c.addChild(tx);
  return c;
}
