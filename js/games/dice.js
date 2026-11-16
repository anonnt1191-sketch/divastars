// games/dice.js — Roll over. Pick a target number (1-100). Roll under target wins.
// Higher target = higher chance, lower payout. Lower target = lower chance, higher payout.

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

  // dice photo (the "dice" is a diva photo with a number overlay)
  const diceY = 60;
  const diceSize = Math.min(W - 80, 240);
  const diceX = W/2 - diceSize/2;
  const diceContainer = new PIXI.Container();
  diceContainer.x = diceX; diceContainer.y = diceY;
  c.addChild(diceContainer);

  // pick a random diva for the dice face
  const diceCast = SESSION.crashPilots[Math.floor(Math.random()*SESSION.crashPilots.length)];
  const diceUrl = castToPhotoURL(diceCast);
  let dicePhoto = null;
  PIXI.Assets.load(diceUrl).then(tex => {
    if (!tex) return;
    dicePhoto = new PIXI.Sprite(tex);
    const scale = diceSize / Math.max(tex.width, tex.height);
    dicePhoto.scale.set(scale);
    dicePhoto.x = (diceSize - tex.width*scale)/2;
    dicePhoto.y = (diceSize - tex.height*scale)/2;
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff).drawRoundedRect(0, 0, diceSize, diceSize, 20).endFill();
    diceContainer.addChild(mask);
    dicePhoto.mask = mask;
    diceContainer.addChild(dicePhoto);
    // gold border
    const border = new PIXI.Graphics();
    border.lineStyle(4, 0xf2c76e, 1).drawRoundedRect(0, 0, diceSize, diceSize, 20).endFill();
    diceContainer.addChild(border);
  }).catch(()=>{});

  // roll result display
  const rollText = new PIXI.Text("—", {
    fontFamily:"Outfit, sans-serif",fontSize:64,fontWeight:"900",fill:0xffe9b8,
    stroke:0x160b20,strokeThickness:6,align:"center"
  });
  rollText.anchor.set(0.5); rollText.x = diceSize/2; rollText.y = diceSize/2;
  diceContainer.addChild(rollText);

  // target slider
  const sliderY = diceY + diceSize + 24;
  const sliderW = W - 32;
  const sliderX = 16;
  const sliderH = 36;

  // labels above slider
  const targetLabel = new PIXI.Text("Target: roll OVER this to win", {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontWeight:"600",fill:0xffe9b8,align:"center"
  });
  targetLabel.anchor.set(0.5,0); targetLabel.x = W/2; targetLabel.y = sliderY - 24;
  c.addChild(targetLabel);

  // slider track
  const sliderTrack = new PIXI.Graphics();
  sliderTrack.beginFill(0x1c0e2a).drawRoundedRect(sliderX, sliderY, sliderW, sliderH, 18).endFill();
  // chance zones (green=win zone, red=lose zone) — depends on target
  c.addChild(sliderTrack);
  const winZone = new PIXI.Graphics();
  c.addChild(winZone);
  const loseZone = new PIXI.Graphics();
  c.addChild(loseZone);

  // slider knob
  const knob = new PIXI.Graphics();
  knob.beginFill(0xf2c76e).drawCircle(0, 0, 18).endFill();
  knob.beginFill(0x160b20).drawCircle(0, 0, 8).endFill();
  knob.y = sliderY + sliderH/2;
  knob.x = sliderX + sliderW * 0.5;
  knob.interactive = true;
  knob.buttonMode = true;
  c.addChild(knob);

  let target = 50;  // initial target (roll over 50 to win)

  function redrawZones() {
    winZone.clear();
    loseZone.clear();
    // win zone = right of target (roll > target)
    const winW = sliderW * (100 - target) / 100;
    winZone.beginFill(0x57d38f, 0.5).drawRoundedRect(sliderX + sliderW - winW, sliderY, winW, sliderH, 18).endFill();
    // lose zone = left of target (roll <= target)
    const loseW = sliderW * target / 100;
    loseZone.beginFill(0xff5d5d, 0.35).drawRoundedRect(sliderX, sliderY, loseW, sliderH, 18).endFill();
    targetLabel.text = `Roll OVER ${target} to win · ${(100-target).toFixed(1)}% chance · ${(100/(100-target)).toFixed(2)}x payout`;
  }
  redrawZones();

  // drag knob
  let dragging = false;
  knob.on("pointerdown", () => { dragging = true; });
  knob.on("pointermove", (e) => {
    if (!dragging) return;
    const x = Math.max(sliderX, Math.min(sliderX + sliderW, e.global.x));
    knob.x = x;
    target = Math.round((x - sliderX) / sliderW * 100);
    redrawZones();
  });
  const endDrag = () => { dragging = false; };
  knob.on("pointerup", endDrag);
  knob.on("pointerupoutside", endDrag);

  // bet row
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; updateBtn(); }));

  const rollBtn = makeButton(W-16, 60, "ROLL · "+curBet, 0xf2c76e, 0x160b20);
  rollBtn.x = 8; rollBtn.y = H - 60;
  rollBtn.interactive = true; rollBtn.buttonMode = true;
  c.addChild(rollBtn);
  function updateBtn() { rollBtn.children[1].text = "ROLL · "+curBet; }

  let rolling = false;
  rollBtn.on("pointertap", async () => {
    if (rolling) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    rolling = true;
    rollBtn.interactive = false;
    sfx.whoosh();
    // flicker numbers
    const flickerStart = performance.now();
    await new Promise(r => {
      const fn = () => {
        const elapsed = performance.now() - flickerStart;
        if (elapsed < 1500) {
          rollText.text = String(Math.floor(Math.random()*100)+1);
          setTimeout(fn, 60);
        } else { r(); }
      };
      fn();
    });
    const result = Math.floor(Math.random()*100)+1;
    rollText.text = String(result);
    sfx.bonk();
    await new Promise(r => setTimeout(r, 500));

    const won = result > target;
    const mult = 100 / (100 - target);
    const win = won ? Math.floor(curBet * mult) : 0;
    if (won) {
      store.pay(win);
      sfx.win();
      host.onWin(mult >= 5 ? "big" : "win", win, {
        title: `${result} > ${target} · ${mult.toFixed(2)}x`,
        line: diceCast.name + " rolled for you."
      });
    } else {
      sfx.lose();
      host.toast(`${result} ≤ ${target}. Lost ${curBet} chips.`, 2400);
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
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:18,fontWeight:"700",fill:fg});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
