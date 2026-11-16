// games/dragon-tiger.js — One card to Dragon, one to Tiger. Higher card wins.
// Side bets: Dragon/Tiger suit-specific, Tie pays 8:1.

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

function drawOneCard() {
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
  // red glow on dragon side, blue glow on tiger side
  bg.beginFill(0xff5d5d, 0.1).drawRect(0, 0, W/2, H).endFill();
  bg.beginFill(0x57c7ff, 0.1).drawRect(W/2, 0, W/2, H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline, {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // pick side UI
  const pickY = 36;
  const pickLabel = new PIXI.Text("Pick your side:", {
    fontFamily:"Outfit",fontSize:13,fontWeight:"700",fill:0xffe9b8
  });
  pickLabel.x = W/2 - pickLabel.width/2; pickLabel.y = pickY;
  c.addChild(pickLabel);

  let pickedSide = "dragon";  // or "tiger" or "tie"
  const sides = [
    {id:"dragon", label:"🐉 DRAGON\nx2", color:0xff5d5d},
    {id:"tie", label:"🤝 TIE\nx8", color:0xf2c76e},
    {id:"tiger", label:"🐅 TIGER\nx2", color:0x57c7ff}
  ];
  const sideBtns = [];
  const btnW = (W - 32) / 3;
  sides.forEach((s, i) => {
    const b = makeButton(btnW, 56, s.label, s.id === pickedSide ? s.color : 0x1c0e2a, s.id === pickedSide ? 0x160b20 : 0xffffff);
    b.x = 8 + i * (btnW + 8); b.y = pickY + 24;
    b.interactive = true; b.buttonMode = true;
    b.on("pointertap", () => {
      sfx.click();
      pickedSide = s.id;
      sideBtns.forEach((x, j) => {
        const sd = sides[j];
        x.children[0].clear();
        x.children[0].beginFill(sd.id === pickedSide ? sd.color : 0x1c0e2a).drawRoundedRect(0,0,btnW,56,12).endFill();
        x.children[1].style.fill = sd.id === pickedSide ? 0x160b20 : 0xffffff;
      });
    });
    sideBtns.push(b);
    c.addChild(b);
  });

  // card slots
  const cardY = 160;
  const cardW = 130, cardH = 182;

  const dragonSlot = new PIXI.Container();
  dragonSlot.x = 20; dragonSlot.y = cardY;
  c.addChild(dragonSlot);
  const dragonLabel = new PIXI.Text("DRAGON", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xff5d5d});
  dragonLabel.x = cardW/2 - dragonLabel.width/2; dragonLabel.y = -16;
  dragonSlot.addChild(dragonLabel);

  const tigerSlot = new PIXI.Container();
  tigerSlot.x = W - cardW - 20; tigerSlot.y = cardY;
  c.addChild(tigerSlot);
  const tigerLabel = new PIXI.Text("TIGER", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0x57c7ff});
  tigerLabel.x = cardW/2 - tigerLabel.width/2; tigerLabel.y = -16;
  tigerSlot.addChild(tigerLabel);

  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit",fontSize:18,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = cardY + cardH + 16;
  c.addChild(resultText);

  async function drawCard(slot, card, faceDown=false) {
    const label = slot.getChildAt(0);
    slot.removeChildren();
    slot.addChild(label);
    const cardGfx = new PIXI.Container();
    const cardBg = new PIXI.Graphics();
    cardBg.beginFill(faceDown ? 0x7c1d3f : 0xffe9b8).drawRoundedRect(0, 0, cardW, cardH, 8).endFill();
    if (faceDown) cardBg.beginFill(0xf2c76e, 0.4).drawRoundedRect(8, 8, cardW-16, cardH-16, 6).endFill();
    cardGfx.addChild(cardBg);
    if (!faceDown) {
      const rankColor = card.red ? 0xff5d5d : 0x160b20;
      const r1 = new PIXI.Text(card.r, {fontFamily:"Outfit",fontSize:18,fontWeight:"900",fill:rankColor});
      r1.x = 6; r1.y = 4;
      cardGfx.addChild(r1);
      const s1 = new PIXI.Text(card.s, {fontFamily:"Outfit",fontSize:14,fill:rankColor});
      s1.x = 6; s1.y = 22;
      cardGfx.addChild(s1);
      try {
        const url = cardPhotoURL(card.r);
        const tex = await PIXI.Assets.load(url);
        const sp = new PIXI.Sprite(tex);
        const sz = cardW - 24;
        const scale = sz / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = (cardW - tex.width*scale)/2;
        sp.y = (cardH - tex.height*scale)/2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(12, 30, cardW-24, cardH-60, 4).endFill();
        cardGfx.addChild(mask);
        sp.mask = mask;
        cardGfx.addChild(sp);
      } catch(e) {}
    }
    slot.addChild(cardGfx);
  }

  let curBet = 25;
  let dealing = false;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; }));

  const dealBtn = makeButton(W-16, 50, t("common.deal")+" · "+curBet, 0xf2c76e, 0x160b20);
  dealBtn.x = 8; dealBtn.y = H - 50;
  dealBtn.interactive = true; dealBtn.buttonMode = true;
  c.addChild(dealBtn);

  dealBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    dealing = true;
    dealBtn.interactive = false;
    resultText.text = "";

    const dCard = drawOneCard();
    const tCard = drawOneCard();
    await drawCard(dragonSlot, dCard, true);
    await drawCard(tigerSlot, tCard, true);
    sfx.card();
    await wait(600);
    await drawCard(dragonSlot, dCard, false);
    sfx.card();
    await wait(400);
    await drawCard(tigerSlot, tCard, false);
    sfx.card();
    await wait(800);

    let winSide = null;
    if (rankValue(dCard.r) > rankValue(tCard.r)) winSide = "dragon";
    else if (rankValue(dCard.r) < rankValue(tCard.r)) winSide = "tiger";
    else winSide = "tie";

    let win = 0;
    if (pickedSide === winSide) {
      if (winSide === "tie") win = curBet * 8;
      else win = curBet * 2;
      store.pay(win);
      sfx.win();
      resultText.text = winSide.toUpperCase()+" wins! + "+win;
      host.onWin(win >= curBet*8 ? "big" : "win", win, {title:winSide.toUpperCase()+" wins", line:"You called it."});
    } else {
      sfx.lose();
      resultText.text = winSide.toUpperCase()+" wins. − "+curBet;
    }
    store.record(game.id, curBet, win);
    dealBtn.interactive = true;
    dealing = false;
  });

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeButton(w,h,label,bg,fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0,0,w,h,12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:13,fontWeight:"700",fill:fg,align:"center"});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
