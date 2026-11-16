// games/archery.js — power meter sweeps back and forth. Tap to release.
// Bullseye pays x8, inner ring x2, outer ring x0.6, miss pays nothing.
// Target wears a fresh diva photo each shot.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { CAST_LIST } from "../core/app.js";
import { castToPhotoURL, castPick } from "../core/photos.js";

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 14, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // archery range area
  const rangeY = 30;
  const rangeH = H - rangeY - 110;

  // target
  const targetCx = W / 2;
  const targetCy = rangeY + rangeH * 0.4;
  const targetR = Math.min(W * 0.4, rangeH * 0.35);

  // bullseye rings
  const targetGfx = new PIXI.Graphics();
  // outer ring (x0.6)
  targetGfx.lineStyle(4, 0xf2c76e, 1).beginFill(0xf2c76e, 0.4).drawCircle(targetCx, targetCy, targetR).endFill();
  // inner ring (x2)
  targetGfx.lineStyle(3, 0xff2e88, 1).beginFill(0xff2e88, 0.4).drawCircle(targetCx, targetCy, targetR * 0.6).endFill();
  // bullseye (x8)
  targetGfx.lineStyle(2, 0xffe9b8, 1).beginFill(0xff5d5d, 0.7).drawCircle(targetCx, targetCy, targetR * 0.25).endFill();
  c.addChild(targetGfx);

  // diva photo on the target
  let curTarget = castPick(CAST_LIST);
  let targetPhoto = null;
  async function loadTargetPhoto() {
    if (targetPhoto) { c.removeChild(targetPhoto); targetPhoto.destroy(); }
    const url = castToPhotoURL(curTarget);
    try {
      const tex = await PIXI.Assets.load(url);
      targetPhoto = new PIXI.Sprite(tex);
      const sz = targetR * 0.4;
      const scale = sz / Math.max(tex.width, tex.height);
      targetPhoto.scale.set(scale);
      targetPhoto.anchor.set(0.5);
      targetPhoto.x = targetCx;
      targetPhoto.y = targetCy;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawCircle(targetCx, targetCy, sz/2).endFill();
      c.addChild(mask);
      targetPhoto.mask = mask;
      c.addChild(targetPhoto);
    } catch(e) {}
  }
  loadTargetPhoto();

  // diva name
  const nameText = new PIXI.Text(curTarget?.name || "", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 14, fontWeight: "700", fill: 0xffe9b8, align: "center"
  });
  nameText.anchor.set(0.5);
  nameText.x = targetCx;
  nameText.y = targetCy + targetR + 20;
  c.addChild(nameText);

  // power meter — horizontal bar that sweeps left to right
  const meterY = rangeY + rangeH - 50;
  const meterW = W - 40;
  const meterX = 20;
  const meterH = 24;

  const meterBg = new PIXI.Graphics();
  meterBg.beginFill(0x1c0e2a).drawRoundedRect(meterX, meterY, meterW, meterH, 8).endFill();
  // zones: left/right = miss zone, middle = bullseye
  const bullStart = meterX + meterW * 0.4;
  const bullEnd = meterX + meterW * 0.6;
  const innerStart = meterX + meterW * 0.25;
  const innerEnd = meterX + meterW * 0.75;
  // bullseye zone
  meterBg.beginFill(0xff5d5d, 0.4).drawRoundedRect(bullStart, meterY, bullEnd - bullStart, meterH, 4).endFill();
  // inner zone (excluding bull)
  meterBg.beginFill(0xff2e88, 0.25).drawRoundedRect(innerStart, meterY, bullStart - innerStart, meterH, 4).endFill();
  meterBg.beginFill(0xff2e88, 0.25).drawRoundedRect(bullEnd, meterY, innerEnd - bullEnd, meterH, 4).endFill();
  // outer zone
  meterBg.beginFill(0xf2c76e, 0.15).drawRoundedRect(meterX, meterY, innerStart - meterX, meterH, 4).endFill();
  meterBg.beginFill(0xf2c76e, 0.15).drawRoundedRect(innerEnd, meterY, meterX + meterW - innerEnd, meterH, 4).endFill();
  c.addChild(meterBg);

  // meter indicator
  const indicator = new PIXI.Graphics();
  indicator.beginFill(0xffe9b8).drawRect(-2, -4, 4, meterH + 8).endFill();
  indicator.x = meterX;
  indicator.y = meterY + meterH / 2;
  c.addChild(indicator);

  // arrow that flies when released
  let arrow = null;
  let arrowState = null; // {x, y, vx, vy, t}

  // bet row
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; updateBtn(); }));

  // release button
  const releaseBtn = makeButton(W - 16, 50, t("archery.release") + " · " + curBet, 0xf2c76e, 0x160b20);
  releaseBtn.x = 8; releaseBtn.y = H - 50;
  releaseBtn.interactive = true; releaseBtn.buttonMode = true;
  c.addChild(releaseBtn);
  function updateBtn() {
    releaseBtn.children[1].text = t("archery.release") + " · " + curBet;
  }

  // meter sweep state
  let meterT = 0;
  let meterDir = 1;
  let meterSpeed = 1.8; // sweeps in ~0.55s
  let canRelease = true;

  function release() {
    if (!canRelease) return;
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    canRelease = false;
    sfx.whoosh();
    // determine result based on meter position
    const meterPos = indicator.x;
    let result;
    if (meterPos >= bullStart && meterPos <= bullEnd) result = "bull";
    else if (meterPos >= innerStart && meterPos <= innerEnd) result = "inner";
    else if (meterPos >= meterX && meterPos <= meterX + meterW) result = "outer";
    else result = "miss";

    // launch arrow
    arrow = new PIXI.Graphics();
    arrow.beginFill(0xffe9b8).drawRect(0, -2, 30, 4).endFill();
    arrow.beginFill(0xff2e88).drawPolygon([[0, -2], [0, 2], [-6, 0]]).endFill();
    arrow.x = meterPos;
    arrow.y = meterY - 10;
    c.addChild(arrow);
    arrowState = { x: meterPos, y: meterY - 10, targetY: targetCy, targetX: targetCx, t: 0, result };
  }
  releaseBtn.on("pointertap", () => { sfx.click(); release(); });

  // animation loop
  const tickerFn = (dt) => {
    // meter sweep
    if (canRelease) {
      meterT += dt * 0.018 * meterDir;
      if (meterT >= 1) { meterT = 1; meterDir = -1; }
      if (meterT <= 0) { meterT = 0; meterDir = 1; }
      indicator.x = meterX + meterT * meterW;
    }
    // arrow flight
    if (arrow && arrowState) {
      arrowState.t += dt / 60;
      const t = Math.min(1, arrowState.t);
      arrowState.x = arrowState.x + (arrowState.targetX - arrowState.x) * 0.15;
      arrowState.y = arrowState.y + (arrowState.targetY - arrowState.y) * 0.15 - 30 * (1 - t);  // arc upward then settle
      arrow.x = arrowState.x;
      arrow.y = arrowState.y;
      arrow.rotation = Math.atan2(arrowState.targetY - arrow.y, arrowState.targetX - arrow.x);
      if (t >= 1) {
        // resolve
        const r = arrowState.result;
        let mult = 0, label = t("archery.miss");
        if (r === "bull") { mult = 8; label = t("archery.bullseye"); }
        else if (r === "inner") { mult = 2; label = "Inner Ring"; }
        else if (r === "outer") { mult = 0.6; label = "Outer Ring"; }
        const win = Math.floor(curBet * mult);
        if (win > 0) {
          store.pay(win);
          if (mult >= 8) sfx.big(); else sfx.win();
          host.onWin(mult >= 8 ? "big" : "win", win, { title: label, line: curTarget.name + " approves." });
        } else {
          sfx.lose();
          host.toast(label + ". Better aim next time.", 1800);
        }
        store.record(game.id, curBet, win);
        // remove arrow after delay
        setTimeout(() => {
          if (arrow) { c.removeChild(arrow); arrow.destroy(); arrow = null; }
          arrowState = null;
          // pick new target
          curTarget = castPick(CAST_LIST);
          nameText.text = curTarget.name;
          loadTargetPhoto();
          canRelease = true;
        }, 1200);
      }
    }
  };
  pixiApp.ticker.add(tickerFn);

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
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 16, fontWeight: "700", fill: fg
  });
  tx.anchor.set(0.5);
  tx.x = w/2; tx.y = h/2;
  c.addChild(tx);
  return c;
}
