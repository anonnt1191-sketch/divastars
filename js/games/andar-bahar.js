// games/andar-bahar.js — Indian luck game. A joker card is dealt. Player bets ANDAR (inside)
// or BAHAR (outside). Cards are dealt alternately to andar/bahar until one matches the joker's rank.

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
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline, {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // joker card (top center)
  const jokerW = 100, jokerH = 140;
  const jokerSlot = new PIXI.Container();
  jokerSlot.x = W/2 - jokerW/2; jokerSlot.y = 40;
  c.addChild(jokerSlot);
  const jokerLabel = new PIXI.Text("JOKER", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xf2c76e});
  jokerLabel.x = jokerW/2 - jokerLabel.width/2; jokerLabel.y = -16;
  jokerSlot.addChild(jokerLabel);

  // pick side
  const pickY = 200;
  const pickLabel = new PIXI.Text("Where will the match land?", {
    fontFamily:"Outfit",fontSize:13,fontWeight:"700",fill:0xffe9b8
  });
  pickLabel.x = W/2 - pickLabel.width/2; pickLabel.y = pickY;
  c.addChild(pickLabel);

  let pickedSide = "andar";
  const andarBtn = makeButton((W-24)/2, 56, "ANDAR (inside)\nx1.9", pickedSide==="andar"?0xf2c76e:0x1c0e2a, pickedSide==="andar"?0x160b20:0xffffff);
  andarBtn.x = 8; andarBtn.y = pickY + 24;
  andarBtn.interactive = true; andarBtn.buttonMode = true;
  c.addChild(andarBtn);
  const baharBtn = makeButton((W-24)/2, 56, "BAHAR (outside)\nx1.9", pickedSide==="bahar"?0xf2c76e:0x1c0e2a, pickedSide==="bahar"?0x160b20:0xffffff);
  baharBtn.x = andarBtn.x + andarBtn.width + 8; baharBtn.y = pickY + 24;
  baharBtn.interactive = true; baharBtn.buttonMode = true;
  c.addChild(baharBtn);
  andarBtn.on("pointertap", () => {
    sfx.click();
    pickedSide = "andar";
    andarBtn.children[0].clear();
    andarBtn.children[0].beginFill(0xf2c76e).drawRoundedRect(0,0,andarBtn.width,56,12).endFill();
    andarBtn.children[1].style.fill = 0x160b20;
    baharBtn.children[0].clear();
    baharBtn.children[0].beginFill(0x1c0e2a).drawRoundedRect(0,0,baharBtn.width,56,12).endFill();
    baharBtn.children[1].style.fill = 0xffffff;
  });
  baharBtn.on("pointertap", () => {
    sfx.click();
    pickedSide = "bahar";
    baharBtn.children[0].clear();
    baharBtn.children[0].beginFill(0xf2c76e).drawRoundedRect(0,0,baharBtn.width,56,12).endFill();
    baharBtn.children[1].style.fill = 0x160b20;
    andarBtn.children[0].clear();
    andarBtn.children[0].beginFill(0x1c0e2a).drawRoundedRect(0,0,andarBtn.width,56,12).endFill();
    andarBtn.children[1].style.fill = 0xffffff;
  });

  // andar/bahar card rows
  const rowY = pickY + 100;
  const andarRow = new PIXI.Container();
  andarRow.x = 8; andarRow.y = rowY;
  c.addChild(andarRow);
  const andarLabel = new PIXI.Text("ANDAR", {fontFamily:"Outfit",fontSize:12,fontWeight:"700",fill:0xf2c76e});
  andarLabel.x = 0; andarLabel.y = -12;
  andarRow.addChild(andarLabel);

  const baharRow = new PIXI.Container();
  baharRow.x = 8; baharRow.y = rowY + 70;
  c.addChild(baharRow);
  const baharLabel = new PIXI.Text("BAHAR", {fontFamily:"Outfit",fontSize:12,fontWeight:"700",fill:0xf2c76e});
  baharLabel.x = 0; baharLabel.y = -12;
  baharRow.addChild(baharLabel);

  // result text
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit",fontSize:18,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = H - 160;
  c.addChild(resultText);

  async function drawJoker(card) {
    const label = jokerSlot.getChildAt(0);
    jokerSlot.removeChildren();
    jokerSlot.addChild(label);
    const cardGfx = new PIXI.Container();
    const cardBg = new PIXI.Graphics();
    cardBg.beginFill(0xffe9b8).drawRoundedRect(0, 0, jokerW, jokerH, 8).endFill();
    cardGfx.addChild(cardBg);
    const rankColor = card.red ? 0xff5d5d : 0x160b20;
    const r1 = new PIXI.Text(card.r, {fontFamily:"Outfit",fontSize:16,fontWeight:"900",fill:rankColor});
    r1.x = 4; r1.y = 4;
    cardGfx.addChild(r1);
    try {
      const url = cardPhotoURL(card.r);
      const tex = await PIXI.Assets.load(url);
      const sp = new PIXI.Sprite(tex);
      const sz = jokerW - 12;
      const scale = sz / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.x = (jokerW - tex.width*scale)/2;
      sp.y = (jokerH - tex.height*scale)/2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(6, 24, jokerW-12, jokerH-48, 4).endFill();
      cardGfx.addChild(mask);
      sp.mask = mask;
      cardGfx.addChild(sp);
    } catch(e) {}
    jokerSlot.addChild(cardGfx);
  }

  function appendMiniCard(row, card, totalInRow) {
    const cardW = 28, cardH = 40;
    const cardGfx = new PIXI.Container();
    cardGfx.x = totalInRow * 32;
    cardGfx.y = 0;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xffe9b8).drawRoundedRect(0, 0, cardW, cardH, 3).endFill();
    cardGfx.addChild(bg);
    const rankColor = card.red ? 0xff5d5d : 0x160b20;
    const r1 = new PIXI.Text(card.r, {fontFamily:"Outfit",fontSize:12,fontWeight:"900",fill:rankColor});
    r1.x = 2; r1.y = 2;
    cardGfx.addChild(r1);
    row.addChild(cardGfx);
    return cardGfx;
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
    // clear rows
    andarRow.removeChildren(); andarRow.addChild(andarLabel);
    baharRow.removeChildren(); baharRow.addChild(baharLabel);
    resultText.text = "";

    const joker = drawOneCard();
    await drawJoker(joker);
    sfx.card();
    await wait(800);

    // deal alternately andar, bahar, andar, bahar...
    let andarCount = 0, baharCount = 0;
    let matchSide = null;
    let totalDeals = 0;
    while (!matchSide && totalDeals < 60) {
      const card = drawOneCard();
      const isAndar = totalDeals % 2 === 0;  // andar first
      if (isAndar) {
        appendMiniCard(andarRow, card, andarCount);
        andarCount++;
      } else {
        appendMiniCard(baharRow, card, baharCount);
        baharCount++;
      }
      sfx.card();
      totalDeals++;
      await wait(300);
      if (card.r === joker.r) {
        matchSide = isAndar ? "andar" : "bahar";
      }
    }

    let win = 0;
    if (pickedSide === matchSide) {
      win = Math.floor(curBet * 1.9);
      store.pay(win);
      sfx.win();
      resultText.text = matchSide.toUpperCase()+" matched! + "+win;
      host.onWin("win", win, {title:matchSide.toUpperCase()+" wins", line:"You read it right."});
    } else {
      sfx.lose();
      resultText.text = matchSide.toUpperCase()+" matched. − "+curBet;
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
