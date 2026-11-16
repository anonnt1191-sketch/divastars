// games/shoot.js — Carnival Shoot. 12 bullets. Divas pop up from carnival ledges.
// Tap to shoot. +0.15x per diva, gold-crowned divas pay x2.5. 10+ hits = sharpshooter +2x bonus.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { CAST_LIST } from "../core/app.js";
import { castPick, castToPhotoURL } from "../core/photos.js";

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0,0,W,H).endFill();
  // carnival vibes — stripes
  for (let i = 0; i < H; i += 16) {
    bg.beginFill(i % 32 === 0 ? 0x7c1d3f : 0x2b1a06, 0.3).drawRect(0, i, W, 16).endFill();
  }
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb, {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // bullets + score HUD
  let bullets = 12;
  let score = 0;
  let hits = 0;
  let curBet = 25;
  let active = false;
  let spawnInterval = null;

  const bulletsText = new PIXI.Text("Bullets: 12", {
    fontFamily:"Outfit, sans-serif",fontSize:16,fontWeight:"700",fill:0xffe9b8
  });
  bulletsText.x = 8; bulletsText.y = 28;
  c.addChild(bulletsText);

  const scoreText = new PIXI.Text("Score: 0.00x", {
    fontFamily:"Outfit, sans-serif",fontSize:16,fontWeight:"700",fill:0xf2c76e
  });
  scoreText.anchor.set(1,0); scoreText.x = W - 8; scoreText.y = 28;
  c.addChild(scoreText);

  // playfield — divas pop up here
  const fieldY = 60;
  const fieldH = H - fieldY - 100;
  const fieldContainer = new PIXI.Container();
  fieldContainer.x = 0; fieldContainer.y = fieldY;
  fieldContainer.interactive = true;
  c.addChild(fieldContainer);

  // background ledges
  for (let i = 0; i < 3; i++) {
    const ledge = new PIXI.Graphics();
    ledge.beginFill(0xf2c76e, 0.3).drawRect(0, fieldH * (i+1)/4 - 8, W, 16).endFill();
    fieldContainer.addChild(ledge);
  }

  function startRound() {
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    active = true;
    bullets = 12;
    score = 0;
    hits = 0;
    bulletsText.text = "Bullets: 12";
    scoreText.text = "Score: 0.00x";
    sfx.whoosh();
    if (spawnInterval) clearInterval(spawnInterval);
    spawnInterval = setInterval(() => {
      if (!active) { clearInterval(spawnInterval); return; }
      spawnDiva();
    }, 700);
  }

  async function spawnDiva() {
    // 3 ledges
    const ledgeIdx = Math.floor(Math.random() * 3);
    const ledgeY = fieldH * (ledgeIdx+1) / 4 - 8;
    const x = Math.random() * (W - 80) + 40;
    // 25% chance of crowned diva
    const crowned = Math.random() < 0.25;
    const cast = castPick(CAST_LIST);
    const url = castToPhotoURL(cast);
    try {
      const tex = await PIXI.Assets.load(url);
      if (!tex) return;
      const sp = new PIXI.Sprite(tex);
      const sz = 70;
      const scale = sz / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.x = x; sp.y = ledgeY - sz;
      sp.anchor.set(0.5, 1);
      sp.interactive = true;
      sp.buttonMode = true;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawCircle(x, ledgeY - sz/2, sz/2).endFill();
      fieldContainer.addChild(mask);
      sp.mask = mask;
      fieldContainer.addChild(sp);
      if (crowned) {
        // gold crown
        const crown = new PIXI.Graphics();
        crown.beginFill(0xffd700).drawPolygon([
          x-15, ledgeY-sz-10, x-10, ledgeY-sz-2, x-5, ledgeY-sz-8,
          x, ledgeY-sz-2, x+5, ledgeY-sz-8, x+10, ledgeY-sz-2, x+15, ledgeY-sz-10
        ]).endFill();
        fieldContainer.addChild(crown);
        sp.crown = crown;
      }
      sp.crowned = crowned;
      sp.cast = cast;
      sp.on("pointertap", () => shoot(sp));
      // retreat after 2s
      setTimeout(() => {
        if (sp && !sp.destroyed && sp.parent) {
          // fade out
          let t = 0;
          const fn = (dt) => {
            t += dt;
            sp.alpha -= 0.05;
            if (t > 20) {
              pixiApp.ticker.remove(fn);
              if (sp.parent) sp.parent.removeChild(sp);
              if (sp.crown && sp.crown.parent) sp.crown.parent.removeChild(sp.crown);
              if (mask && mask.parent) mask.parent.removeChild(mask);
              sp.destroy();
            }
          };
          pixiApp.ticker.add(fn);
        }
      }, 2000);
    } catch(e) {}
  }

  function shoot(sp) {
    if (!active || bullets <= 0 || !sp || sp.destroyed) return;
    bullets--;
    sfx.pop();
    sp.interactive = false;
    const mult = sp.crowned ? 2.5 : 0.15;
    score += mult;
    hits++;
    bulletsText.text = `Bullets: ${bullets}`;
    scoreText.text = `Score: ${score.toFixed(2)}x`;
    // hit effect — gold flash
    const flash = new PIXI.Graphics();
    flash.beginFill(sp.crowned ? 0xffd700 : 0xff2e88, 0.7).drawCircle(sp.x, sp.y - 35, 40).endFill();
    fieldContainer.addChild(flash);
    let t = 0;
    const fn = (dt) => {
      t += dt;
      flash.alpha -= 0.08;
      flash.scale.set(1 + t * 0.05);
      if (t > 12) {
        pixiApp.ticker.remove(fn);
        if (flash.parent) flash.parent.removeChild(flash);
        flash.destroy();
      }
    };
    pixiApp.ticker.add(fn);
    // remove diva
    if (sp.parent) sp.parent.removeChild(sp);
    if (sp.crown && sp.crown.parent) sp.crown.parent.removeChild(sp.crown);
    sp.destroy();
    // check end
    if (bullets <= 0) endRound();
  }

  function endRound() {
    active = false;
    if (spawnInterval) clearInterval(spawnInterval);
    let bonus = 0;
    if (hits >= 10) {
      bonus = 2;
      sfx.big();
      host.toast(`SHARPSHOOTER! ${hits} hits. +2x bonus.`, 2400);
    }
    const finalMult = score + bonus;
    const win = Math.floor(curBet * finalMult);
    if (win > 0) {
      store.pay(win);
      store.record(game.id, curBet, win);
      host.onWin(finalMult >= 5 ? "big" : "win", win, {
        title: `${finalMult.toFixed(2)}x · ${hits} hits`,
        line: "Carnival cleaned out."
      });
    } else {
      sfx.lose();
      store.record(game.id, curBet, 0);
      host.toast("No hits. Lost your bet.", 2400);
    }
  }

  // bet row + start button
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; }));

  const startBtn = makeButton(W-16, 60, "START · "+curBet, 0xf2c76e, 0x160b20);
  startBtn.x = 8; startBtn.y = H - 60;
  startBtn.interactive = true; startBtn.buttonMode = true;
  c.addChild(startBtn);
  startBtn.on("pointertap", () => {
    sfx.click();
    startRound();
    startBtn.interactive = false;
    startBtn.children[1].text = "PLAYING...";
    setTimeout(() => {
      startBtn.interactive = true;
      startBtn.children[1].text = "START · "+curBet;
    }, 12000);  // 12 bullets * ~1s
  });

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => {
    pixiApp.ticker.remove(tickerFn);
    if (spawnInterval) clearInterval(spawnInterval);
  };
}

function makeButton(w,h,label,bg,fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0,0,w,h,12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:18,fontWeight:"700",fill:fg});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
