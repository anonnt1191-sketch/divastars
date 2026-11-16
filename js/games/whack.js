// games/whack.js — Whack-a-Diva. 9 holes, divas pop up, tap to whack.
// +0.3x per diva, Vedhika = +2x, The Ex = -1x. 45 seconds. Combo chains raise payout.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { CAST_LIST } from "../core/app.js";
import { castPick, castToPhotoURL } from "../core/photos.js";
import { EX } from "../data/divas.js";

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0,0,W,H).endFill();
  // ground gradient
  for (let i = 0; i < H; i += 4) {
    const t = i / H;
    bg.beginFill(0x2b1a06, 0.4 + t * 0.3).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb, {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // 3x3 hole grid
  const cols = 3;
  const holeSize = Math.min((W - 32) / cols, 110);
  const gridW = holeSize * cols;
  const gridX = (W - gridW) / 2;
  const gridY = 50;

  const holes = [];
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i/3), col = i % 3;
    const x = gridX + col * holeSize;
    const y = gridY + row * holeSize;
    // hole bg (dark)
    const hole = new PIXI.Graphics();
    hole.beginFill(0x000000, 0.7).drawEllipse(x + holeSize/2, y + holeSize - 10, holeSize/2 - 8, 12).endFill();
    c.addChild(hole);
    holes.push({ x, y, idx: i, occupied: false, sprite: null });
  }

  // state
  let curBet = 25;
  let active = false;
  let timeLeft = 45;
  let score = 0;
  let combo = 0;
  let timerInterval = null;
  let spawnInterval = null;

  // HUD
  const scoreText = new PIXI.Text("Score: 0", {
    fontFamily:"Outfit, sans-serif",fontSize:18,fontWeight:"900",fill:0xffe9b8,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  scoreText.x = 8; scoreText.y = gridY + 3 * holeSize + 16;
  c.addChild(scoreText);

  const timeText = new PIXI.Text("45", {
    fontFamily:"Outfit, sans-serif",fontSize:22,fontWeight:"900",fill:0xff2e88,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  timeText.anchor.set(1,0); timeText.x = W - 12; timeText.y = gridY + 3 * holeSize + 12;
  c.addChild(timeText);

  const comboText = new PIXI.Text("Combo: 0", {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontWeight:"700",fill:0x57d38f,align:"center"
  });
  comboText.anchor.set(0.5,0); comboText.x = W/2; comboText.y = gridY + 3 * holeSize + 50;
  c.addChild(comboText);

  function startRound() {
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    active = true;
    score = 0;
    combo = 0;
    timeLeft = 45;
    scoreText.text = "Score: 0";
    timeText.text = "45";
    comboText.text = "Combo: 0";
    sfx.whoosh();
    if (timerInterval) clearInterval(timerInterval);
    if (spawnInterval) clearInterval(spawnInterval);
    timerInterval = setInterval(() => {
      if (!active) { clearInterval(timerInterval); return; }
      timeLeft -= 0.1;
      timeText.text = Math.max(0, timeLeft).toFixed(1);
      if (timeLeft <= 0) endRound();
    }, 100);
    spawnInterval = setInterval(() => {
      if (!active) { clearInterval(spawnInterval); return; }
      spawnDiva();
    }, 600);
  }

  async function spawnDiva() {
    // find empty hole
    const empty = holes.filter(h => !h.occupied);
    if (empty.length === 0) return;
    const hole = empty[Math.floor(Math.random() * empty.length)];
    hole.occupied = true;
    // pick who pops up — 80% regular diva, 10% Vedhika (gold = +2x), 10% Ex (-1x)
    const r = Math.random();
    let cast, photoUrl, bonus, isVedhika = false, isEx = false;
    if (r < 0.1) {
      // The Ex
      cast = null;
      photoUrl = EX.photo;
      bonus = -1;
      isEx = true;
    } else if (r < 0.2) {
      // Vedhika
      cast = { key:"vedhika", name:"Vedhika", kind:"friend", id:"vedhika" };
      photoUrl = castToPhotoURL(cast);
      bonus = 2;
      isVedhika = true;
    } else {
      cast = castPick(CAST_LIST);
      photoUrl = castToPhotoURL(cast);
      bonus = 0.3;
    }
    try {
      const tex = await PIXI.Assets.load(photoUrl);
      if (!tex) { hole.occupied = false; return; }
      const sp = new PIXI.Sprite(tex);
      const sz = holeSize - 12;
      const scale = sz / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.x = hole.x + (holeSize - tex.width*scale)/2;
      sp.y = hole.y + (holeSize - tex.height*scale)/2 + 20;  // start low
      // rise from hole
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(hole.x + 4, hole.y + 4, holeSize - 8, holeSize - 16, 8).endFill();
      c.addChild(mask);
      sp.mask = mask;
      c.addChild(sp);
      hole.sprite = sp;
      hole.mask = mask;
      hole.bonus = bonus;
      hole.isVedhika = isVedhika;
      hole.isEx = isEx;
      // gold/red ring for special
      if (isVedhika || isEx) {
        const ring = new PIXI.Graphics();
        ring.lineStyle(3, isVedhika ? 0xffd700 : 0xff5d5d, 1).drawCircle(hole.x + holeSize/2, hole.y + holeSize/2, holeSize/2 - 6).endFill();
        c.addChild(ring);
        hole.ring = ring;
      }
      // rise animation
      let t = 0;
      const riseFn = (dt) => {
        t += dt;
        const targetY = hole.y + (holeSize - tex.height*scale)/2;
        sp.y += (targetY - sp.y) * 0.2;
        if (t > 50) pixiApp.ticker.remove(riseFn);
      };
      pixiApp.ticker.add(riseFn);
      // tap handler
      sp.interactive = true;
      sp.buttonMode = true;
      sp.on("pointertap", () => whack(hole));
      // auto-retreat after 1.5s if not whacked
      setTimeout(() => {
        if (hole.occupied && hole.sprite === sp) {
          retreatHole(hole);
        }
      }, 1500);
    } catch(e) {}
  }

  function retreatHole(hole) {
    if (!hole.occupied) return;
    hole.occupied = false;
    if (hole.sprite) {
      // drop down then destroy
      let t = 0;
      const dropFn = (dt) => {
        t += dt;
        hole.sprite.y += 4;
        if (t > 20) {
          pixiApp.ticker.remove(dropFn);
          c.removeChild(hole.sprite);
          if (hole.mask) { c.removeChild(hole.mask); hole.mask = null; }
          if (hole.ring) { c.removeChild(hole.ring); hole.ring = null; }
          hole.sprite.destroy();
          hole.sprite = null;
        }
      };
      pixiApp.ticker.add(dropFn);
      if (hole.sprite) hole.sprite.interactive = false;
    }
  }

  function whack(hole) {
    if (!hole.occupied || !hole.sprite) return;
    sfx.bonk();
    const bonus = hole.bonus;
    if (bonus > 0) {
      combo++;
      const comboMult = 1 + Math.min(combo, 10) * 0.1;
      const gain = bonus * comboMult;
      score += gain;
      if (hole.isVedhika) {
        sfx.big();
        host.toast("VEDHIKA! +2x", 1000);
      }
    } else {
      // The Ex
      combo = 0;
      score += bonus;  // negative
      sfx.lose();
      host.toast("THE EX! -1x", 1000);
    }
    scoreText.text = `Score: ${score.toFixed(2)}x`;
    comboText.text = `Combo: ${combo}`;
    retreatHole(hole);
  }

  function endRound() {
    active = false;
    if (timerInterval) clearInterval(timerInterval);
    if (spawnInterval) clearInterval(spawnInterval);
    // retreat all
    for (const h of holes) retreatHole(h);
    // payout
    const finalMult = Math.max(0, score);
    const win = Math.floor(curBet * finalMult);
    if (win > 0) {
      store.pay(win);
      store.record(game.id, curBet, win);
      sfx.jackpot();
      host.onWin(finalMult >= 10 ? "mega" : finalMult >= 5 ? "big" : "win", win, {
        title: `${finalMult.toFixed(2)}x · ${win} chips`,
        line: "Hammer time."
      });
    } else {
      sfx.lose();
      store.record(game.id, curBet, 0);
      host.toast("No score. Lost your bet.", 2400);
    }
    // reset for next round
    setTimeout(() => {
      scoreText.text = "Tap START to play again";
      comboText.text = "";
    }, 2000);
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
    startBtn.children[1].text = "PLAYING...";
    startBtn.interactive = false;
    setTimeout(() => {
      startBtn.children[1].text = "START · "+curBet;
      startBtn.interactive = true;
    }, 46000);
  });

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => {
    pixiApp.ticker.remove(tickerFn);
    if (timerInterval) clearInterval(timerInterval);
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
