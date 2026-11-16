// games/limbo.js — Pick a target multiplier. The wheel lands on a random multiplier.
// If the result is >= your target, you win (target x your bet). Otherwise, lose.
// Higher target = lower chance, higher payout.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { castToPhotoURL } from "../core/photos.js";

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0,0,W,H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb, {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // diva photo (large)
  const photoSize = Math.min(W - 80, 220);
  const photoX = W/2 - photoSize/2;
  const photoY = 40;
  const photoCast = SESSION.crashPilots[Math.floor(Math.random()*SESSION.crashPilots.length)];
  const photoUrl = castToPhotoURL(photoCast);
  PIXI.Assets.load(photoUrl).then(tex => {
    if (!tex) return;
    const sp = new PIXI.Sprite(tex);
    const scale = photoSize / Math.max(tex.width, tex.height);
    sp.scale.set(scale);
    sp.x = photoX; sp.y = photoY;
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff).drawRoundedRect(photoX, photoY, photoSize, photoSize, 16).endFill();
    c.addChild(mask);
    sp.mask = mask;
    c.addChild(sp);
    const border = new PIXI.Graphics();
    border.lineStyle(3, 0xf2c76e, 1).drawRoundedRect(photoX, photoY, photoSize, photoSize, 16).endFill();
    c.addChild(border);
  }).catch(()=>{});

  // result multiplier (big, centered on photo)
  const resultText = new PIXI.Text("?", {
    fontFamily:"Outfit, sans-serif",fontSize:56,fontWeight:"900",fill:0xffe9b8,
    stroke:0x160b20,strokeThickness:5,align:"center"
  });
  resultText.anchor.set(0.5); resultText.x = W/2; resultText.y = photoY + photoSize/2;
  c.addChild(resultText);

  // target display + buttons
  const targetY = photoY + photoSize + 24;
  const targetLabel = new PIXI.Text("Target Multiplier", {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontWeight:"600",fill:0xffe9b8,align:"center"
  });
  targetLabel.anchor.set(0.5,0); targetLabel.x = W/2; targetLabel.y = targetY;
  c.addChild(targetLabel);

  // target value with - / + buttons
  let target = 2.0;
  const targetValText = new PIXI.Text(target.toFixed(2) + "x", {
    fontFamily:"Outfit, sans-serif",fontSize:36,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  targetValText.anchor.set(0.5,0); targetValText.x = W/2; targetValText.y = targetY + 24;
  c.addChild(targetValText);

  const minusBtn = makeButton(60, 60, "−", 0x333333, 0xffffff);
  minusBtn.x = 30; minusBtn.y = targetY + 18;
  minusBtn.interactive = true; minusBtn.buttonMode = true;
  minusBtn.on("pointertap", () => {
    sfx.click();
    target = Math.max(1.01, target - 0.1);
    targetValText.text = target.toFixed(2) + "x";
    updateChance();
  });
  c.addChild(minusBtn);

  const plusBtn = makeButton(60, 60, "+", 0x333333, 0xffffff);
  plusBtn.x = W - 90; plusBtn.y = targetY + 18;
  plusBtn.interactive = true; plusBtn.buttonMode = true;
  plusBtn.on("pointertap", () => {
    sfx.click();
    target = Math.min(100, target + 0.1);
    targetValText.text = target.toFixed(2) + "x";
    updateChance();
  });
  c.addChild(plusBtn);

  const chanceText = new PIXI.Text("", {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontWeight:"700",fill:0x57d38f,align:"center"
  });
  chanceText.anchor.set(0.5,0); chanceText.x = W/2; chanceText.y = targetY + 76;
  c.addChild(chanceText);

  function updateChance() {
    // P(win) = 1/target (with 1% house edge)
    const prob = Math.max(0.005, 0.99 / target);
    chanceText.text = `Win chance: ${(prob*100).toFixed(2)}% · Payout: ${target.toFixed(2)}x`;
  }
  updateChance();

  // bet row
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; }));

  const rollBtn = makeButton(W-16, 60, "ROLL · "+curBet, 0xf2c76e, 0x160b20);
  rollBtn.x = 8; rollBtn.y = H - 60;
  rollBtn.interactive = true; rollBtn.buttonMode = true;
  c.addChild(rollBtn);

  let rolling = false;
  rollBtn.on("pointertap", async () => {
    if (rolling) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    rolling = true;
    rollBtn.interactive = false;
    sfx.whoosh();
    // flicker
    const flickerStart = performance.now();
    await new Promise(r => {
      const fn = () => {
        const elapsed = performance.now() - flickerStart;
        if (elapsed < 1500) {
          resultText.text = (Math.random()*20).toFixed(2) + "x";
          setTimeout(fn, 50);
        } else { r(); }
      };
      fn();
    });
    // final result — uniform[1, 100], with house edge
    const r = Math.random() * 0.99;  // 0 to 0.99
    const result = Math.max(1.0, 1 / (1 - r));  // inverse distribution
    resultText.text = result.toFixed(2) + "x";
    sfx.bonk();
    await new Promise(r => setTimeout(r, 600));

    const won = result >= target;
    const win = won ? Math.floor(curBet * target) : 0;
    if (won) {
      store.pay(win);
      sfx.win();
      host.onWin(target >= 10 ? "mega" : target >= 5 ? "big" : "win", win, {
        title: result.toFixed(2) + "x ≥ " + target.toFixed(2) + "x",
        line: photoCast.name + " brought it home."
      });
    } else {
      sfx.lose();
      host.toast(`${result.toFixed(2)}x < ${target.toFixed(2)}x. Lost ${curBet} chips.`, 2400);
    }
    store.record(game.id, curBet, win);
    rollBtn.interactive = true;
    rolling = false;
  });

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

function makeButton(w,h,label,bg,fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0,0,w,h,12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:24,fontWeight:"900",fill:fg});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
