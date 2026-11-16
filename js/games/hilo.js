// games/hilo.js — A photo card hides its rank. Call HIGHER or LOWER. Streak multiplies.
// Correct = x1.45 streak mult. Tie = keep streak alive for free. Wrong = round ends.
// Cash out any time.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { COURT_FACES } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const SUITS = [{s:"♠",red:0},{s:"♥",red:1},{s:"♦",red:1},{s:"♣",red:0}];
function rankValue(r) { return RANKS.indexOf(r); }
function cardWoman(r) { return COURT_FACES[r] || SESSION.cardFaces[r]?.id || "ann"; }
function cardPhotoURL(r) { return friendPhoto(cardWoman(r), Math.floor(Math.random()*6)); }
function drawCard() {
  const su = SUITS[Math.floor(Math.random()*4)];
  const r = RANKS[Math.floor(Math.random()*RANKS.length)];
  return { r, s:su.s, red:su.red };
}

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

  // card display
  const cardW = 160, cardH = 224;
  const cardX = W/2 - cardW/2;
  const cardY = 60;
  const cardSlot = new PIXI.Container();
  cardSlot.x = cardX; cardSlot.y = cardY;
  c.addChild(cardSlot);

  // streak multiplier display
  const streakText = new PIXI.Text("Streak: 0 · Mult: 1.00x", {
    fontFamily:"Outfit, sans-serif",fontSize:18,fontWeight:"700",fill:0xffe9b8,align:"center"
  });
  streakText.anchor.set(0.5,0); streakText.x = W/2; streakText.y = cardY + cardH + 16;
  c.addChild(streakText);

  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit, sans-serif",fontSize:16,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = cardY + cardH + 50;
  c.addChild(resultText);

  async function drawCardInSlot(card, faceDown=false) {
    cardSlot.removeChildren();
    const cardGfx = new PIXI.Container();
    const cardBg = new PIXI.Graphics();
    cardBg.lineStyle(3, 0xf2c76e, 0.8).beginFill(faceDown ? 0x7c1d3f : 0xffe9b8).drawRoundedRect(0, 0, cardW, cardH, 12).endFill();
    cardGfx.addChild(cardBg);
    if (!faceDown) {
      const rankColor = card.red ? 0xff5d5d : 0x160b20;
      const r1 = new PIXI.Text(card.r, {fontFamily:"Outfit",fontSize:24,fontWeight:"900",fill:rankColor});
      r1.x = 10; r1.y = 8;
      cardGfx.addChild(r1);
      const s1 = new PIXI.Text(card.s, {fontFamily:"Outfit",fontSize:18,fill:rankColor});
      s1.x = 10; s1.y = 36;
      cardGfx.addChild(s1);
      try {
        const url = cardPhotoURL(card.r);
        const tex = await PIXI.Assets.load(url);
        const sp = new PIXI.Sprite(tex);
        const sz = cardW - 24;
        const scale = sz / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = (cardW - tex.width*scale)/2;
        sp.y = (cardH - tex.height*scale)/2 + 20;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(12, 60, cardW-24, cardH-80, 8).endFill();
        cardGfx.addChild(mask);
        sp.mask = mask;
        cardGfx.addChild(sp);
      } catch(e) {}
    } else {
      // pattern
      const pat = new PIXI.Graphics();
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 12; j++) {
          pat.beginFill(0xf2c76e, 0.3).drawCircle(20+i*16, 20+j*16, 4).endFill();
        }
      }
      cardGfx.addChild(pat);
    }
    cardSlot.addChild(cardGfx);
  }

  // state
  let curCard = null;
  let streak = 0;
  let streakMult = 1.0;
  let active = false;
  let curBet = 25;

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 160;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; }));

  // HIGHER / LOWER / CASH OUT buttons
  const btnW = (W - 24) / 3;
  const startBtn = makeButton(btnW, 56, "START", 0xf2c76e, 0x160b20);
  startBtn.x = 8; startBtn.y = H - 95;
  startBtn.interactive = true; startBtn.buttonMode = true;
  c.addChild(startBtn);

  const higherBtn = makeButton(btnW, 56, "▲ HIGHER", 0x57d38f, 0x160b20);
  higherBtn.x = 8; higherBtn.y = H - 95;
  higherBtn.interactive = true; higherBtn.buttonMode = true;
  higherBtn.visible = false;
  c.addChild(higherBtn);

  const lowerBtn = makeButton(btnW, 56, "▼ LOWER", 0xff5d5d, 0x160b20);
  lowerBtn.x = 8 + btnW + 8; lowerBtn.y = H - 95;
  lowerBtn.interactive = true; lowerBtn.buttonMode = true;
  lowerBtn.visible = false;
  c.addChild(lowerBtn);

  const cashOutBtn = makeButton(btnW, 56, "CASH OUT", 0x9d4edd, 0xffffff);
  cashOutBtn.x = 8 + (btnW + 8)*2; cashOutBtn.y = H - 95;
  cashOutBtn.interactive = true; cashOutBtn.buttonMode = true;
  cashOutBtn.visible = false;
  c.addChild(cashOutBtn);

  function updateButtons() {
    if (active) {
      startBtn.visible = false;
      higherBtn.visible = true;
      lowerBtn.visible = true;
      cashOutBtn.visible = streak > 0;
      cashOutBtn.children[1].text = "OUT (+" + Math.floor(curBet * streakMult) + ")";
    } else {
      startBtn.visible = true;
      startBtn.children[1].text = streak > 0 ? "NEW ROUND" : "START · " + curBet;
      higherBtn.visible = false;
      lowerBtn.visible = false;
      cashOutBtn.visible = false;
    }
  }

  async function startRound() {
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    active = true;
    streak = 0;
    streakMult = 1.0;
    resultText.text = "";
    curCard = drawCard();
    await drawCardInSlot(curCard, false);
    sfx.card();
    streakText.text = `Streak: 0 · Mult: 1.00x · Bet: ${curBet}`;
    updateButtons();
  }

  async function guess(dir) {
    if (!active) return;
    sfx.click();
    const prevCard = curCard;
    const newCard = drawCard();
    await drawCardInSlot(newCard, true);
    sfx.card();
    await new Promise(r => setTimeout(r, 400));
    await drawCardInSlot(newCard, false);
    sfx.reveal();
    await new Promise(r => setTimeout(r, 600));

    const prevV = rankValue(prevCard.r);
    const newV = rankValue(newCard.r);
    let result;
    if (newV === prevV) {
      result = "TIE — streak alive";
      sfx.tick();
    } else if ((dir === "higher" && newV > prevV) || (dir === "lower" && newV < prevV)) {
      streak++;
      streakMult = Math.pow(1.45, streak);
      result = `CORRECT · streak ${streak}`;
      sfx.pop();
    } else {
      result = "WRONG — round over";
      sfx.lose();
      active = false;
      store.record(game.id, curBet, 0);
      host.toast("Wrong call. Lost " + curBet + " chips.", 2200);
    }
    curCard = newCard;
    streakText.text = `Streak: ${streak} · Mult: ${streakMult.toFixed(2)}x · Bet: ${curBet}`;
    resultText.text = result;
    updateButtons();
  }

  function cashOut() {
    if (!active || streak === 0) return;
    const win = Math.floor(curBet * streakMult);
    store.pay(win);
    store.record(game.id, curBet, win);
    sfx.win();
    host.onWin(streakMult >= 10 ? "mega" : streakMult >= 5 ? "big" : "win", win, {
      title: streakMult.toFixed(2) + "x · cashed out",
      line: `Streak of ${streak}`
    });
    active = false;
    streak = 0;
    streakMult = 1.0;
    resultText.text = "+ " + win + " chips";
    updateButtons();
  }

  startBtn.on("pointertap", () => { sfx.click(); startRound(); });
  higherBtn.on("pointertap", () => guess("higher"));
  lowerBtn.on("pointertap", () => guess("lower"));
  cashOutBtn.on("pointertap", cashOut);

  // initial state — show a face-down card
  drawCardInSlot({r:"A",s:"♠",red:0}, true);
  updateButtons();

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

function makeButton(w,h,label,bg,fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0,0,w,h,12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:fg});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
