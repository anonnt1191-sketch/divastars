// games/quiz.js — "Who's That?" — Extreme close-up of a diva photo. Name her in 8 seconds.
// Correct pays x2 + streak bonus x0.5 per consecutive (max x5).

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { CAST_LIST } from "../core/app.js";
import { castPick, castToPhotoURL } from "../core/photos.js";

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

  // close-up photo container
  const photoY = 40;
  const photoSize = Math.min(W - 60, 280);
  const photoX = W/2 - photoSize/2;
  const photoContainer = new PIXI.Container();
  photoContainer.x = photoX; photoContainer.y = photoY;
  c.addChild(photoContainer);

  // 4 answer buttons
  const ansY = photoY + photoSize + 24;
  const ansW = (W - 24) / 2;
  const ansH = 60;
  const ansButtons = [];

  // streak display
  const streakText = new PIXI.Text("Streak: 0", {
    fontFamily:"Outfit, sans-serif",fontSize:16,fontWeight:"700",fill:0xffe9b8,align:"center"
  });
  streakText.anchor.set(0.5,0); streakText.x = W/2; streakText.y = ansY + 144;
  c.addChild(streakText);

  // timer display
  const timerText = new PIXI.Text("8", {
    fontFamily:"Outfit, sans-serif",fontSize:32,fontWeight:"900",fill:0xff2e88,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  timerText.anchor.set(0.5,0); timerText.x = W/2; timerText.y = ansY + 174;
  c.addChild(timerText);

  // result text
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit, sans-serif",fontSize:18,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = ansY + 220;
  c.addChild(resultText);

  let curBet = 25;
  let streak = 0;
  let active = false;
  let currentTarget = null;
  let timerStart = 0;
  let timerInterval = null;

  function makeAnswerButton(idx) {
    const btn = new PIXI.Container();
    btn.x = 8 + (idx % 2) * (ansW + 8);
    btn.y = ansY + Math.floor(idx/2) * (ansH + 8);
    const g = new PIXI.Graphics();
    g.beginFill(0x1c0e2a).drawRoundedRect(0, 0, ansW, ansH, 10).endFill();
    g.lineStyle(2, 0xf2c76e, 0.4).drawRoundedRect(0, 0, ansW, ansH, 10).endFill();
    btn.addChild(g);
    const tx = new PIXI.Text("", {
      fontFamily:"Outfit, sans-serif",fontSize:14,fontWeight:"700",fill:0xffe9b8,align:"center",
      wordWrap:true,wordWrapWidth:ansW-16
    });
    tx.anchor.set(0.5); tx.x = ansW/2; tx.y = ansH/2;
    btn.addChild(tx);
    btn.interactive = true; btn.buttonMode = true;
    btn.on("pointertap", () => answer(idx));
    c.addChild(btn);
    return btn;
  }
  for (let i = 0; i < 4; i++) ansButtons.push(makeAnswerButton(i));

  async function startRound() {
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    active = true;
    resultText.text = "";
    // pick 4 unique divas
    const used = new Set();
    const opts = [];
    for (let i = 0; i < 4; i++) {
      const cast = castPick(CAST_LIST, used);
      used.add(cast.key);
      opts.push(cast);
    }
    // pick target
    const targetIdx = Math.floor(Math.random() * 4);
    currentTarget = opts[targetIdx];
    // load close-up of target
    photoContainer.removeChildren();
    const url = castToPhotoURL(currentTarget);
    try {
      const tex = await PIXI.Assets.load(url);
      const sp = new PIXI.Sprite(tex);
      // ZOOM into the photo — pick a random quadrant
      const zoomFactor = 3;
      const subW = tex.width / zoomFactor;
      const subH = tex.height / zoomFactor;
      const qx = Math.floor(Math.random() * zoomFactor) * subW;
      const qy = Math.floor(Math.random() * zoomFactor) * subH;
      // crop texture via a frame
      const frame = new PIXI.Rectangle(qx, qy, subW, subH);
      const croppedTex = new PIXI.Texture(tex.baseTexture, frame);
      const cropped = new PIXI.Sprite(croppedTex);
      const scale = photoSize / Math.max(subW, subH);
      cropped.scale.set(scale);
      cropped.x = (photoSize - subW*scale)/2;
      cropped.y = (photoSize - subH*scale)/2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(0, 0, photoSize, photoSize, 16).endFill();
      photoContainer.addChild(mask);
      cropped.mask = mask;
      photoContainer.addChild(cropped);
      // gold border
      const border = new PIXI.Graphics();
      border.lineStyle(3, 0xf2c76e, 1).drawRoundedRect(0, 0, photoSize, photoSize, 16).endFill();
      photoContainer.addChild(border);
    } catch(e) {}
    // shuffle options
    for (let i = opts.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [opts[i],opts[j]] = [opts[j],opts[i]];
    }
    opts.forEach((opt, i) => {
      ansButtons[i].children[1].text = opt.name;
      ansButtons[i].opt = opt;
      ansButtons[i].interactive = true;
    });
    // start timer
    timerStart = performance.now();
    let timeLeft = 8;
    timerText.text = String(timeLeft);
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!active) { clearInterval(timerInterval); return; }
      timeLeft -= 0.1;
      timerText.text = Math.max(0, timeLeft).toFixed(1);
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        answer(-1);  // time out
      }
    }, 100);
    sfx.tick();
  }

  function answer(idx) {
    if (!active) return;
    active = false;
    if (timerInterval) clearInterval(timerInterval);
    const picked = idx >= 0 ? ansButtons[idx].opt : null;
    const correct = picked && picked.key === currentTarget.key;
    ansButtons.forEach(b => b.interactive = false);
    if (correct) {
      streak++;
      const mult = Math.min(5, 2 + streak * 0.5);
      const win = Math.floor(curBet * mult);
      store.pay(win);
      store.record(game.id, curBet, win);
      sfx.win();
      resultText.text = `CORRECT — ${currentTarget.name}! +${win}`;
      streakText.text = `Streak: ${streak}`;
      host.onWin(mult >= 5 ? "big" : "win", win, {
        title: mult.toFixed(1) + "x — " + currentTarget.name,
        line: "You know her."
      });
    } else {
      streak = 0;
      sfx.lose();
      store.record(game.id, curBet, 0);
      if (picked) {
        resultText.text = `Wrong — that's ${currentTarget.name}.`;
      } else {
        resultText.text = `Time up — that's ${currentTarget.name}.`;
      }
      streakText.text = `Streak: ${streak}`;
    }
    // next round after delay
    setTimeout(() => startRound(), 2500);
  }

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 60;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; }));

  // start first round automatically
  setTimeout(() => startRound(), 500);

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => {
    pixiApp.ticker.remove(tickerFn);
    if (timerInterval) clearInterval(timerInterval);
  };
}
