// games/war.js — Casino War. Deal 1 card each to player and dealer. Higher card wins.
// Tie = "war" — both burn 3 cards face down, deal 1 face up each. Higher wins; tie pays extra.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { COURT_FACES } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const SUITS = [{s:"♠",red:0},{s:"♥",red:1},{s:"♦",red:1},{s:"♣",red:0}];

function newDeck() {
  const d = [];
  for (const su of SUITS) for (const r of RANKS) d.push({r, s:su.s, red:su.red});
  // shuffle
  for (let i = d.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [d[i],d[j]] = [d[j],d[i]];
  }
  return d;
}

function rankValue(r) { return RANKS.indexOf(r); }

function cardWoman(r) {
  if (COURT_FACES[r]) return COURT_FACES[r];
  return SESSION.cardFaces[r]?.id || "ann";
}

function cardPhotoURL(r) {
  const id = cardWoman(r);
  return friendPhoto(id, Math.floor(Math.random()*6));
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

  // card display area
  const cardY = 80;
  const cardW = 120, cardH = 168;

  // dealer card (left)
  const dealerSlot = new PIXI.Container();
  dealerSlot.x = (W - cardW*2 - 20)/2;
  dealerSlot.y = cardY;
  c.addChild(dealerSlot);
  const dealerLabel = new PIXI.Text("DEALER", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xff2e88});
  dealerLabel.x = cardW/2 - dealerLabel.width/2; dealerLabel.y = -16;
  dealerSlot.addChild(dealerLabel);

  // player card (right)
  const playerSlot = new PIXI.Container();
  playerSlot.x = dealerSlot.x + cardW + 20;
  playerSlot.y = cardY;
  c.addChild(playerSlot);
  const playerLabel = new PIXI.Text("YOU", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xf2c76e});
  playerLabel.x = cardW/2 - playerLabel.width/2; playerLabel.y = -16;
  playerSlot.addChild(playerLabel);

  // result text
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit",fontSize:18,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = cardY + cardH + 16;
  c.addChild(resultText);

  async function drawCard(slot, card, faceDown=false) {
    slot.removeChildren();
    const label = slot.getChildAt(0);  // keep label
    slot.removeChildren();
    slot.addChild(label);

    const cardGfx = new PIXI.Container();
    const cardBg = new PIXI.Graphics();
    cardBg.beginFill(faceDown ? 0x7c1d3f : 0xffe9b8).drawRoundedRect(0, 0, cardW, cardH, 8).endFill();
    if (faceDown) {
      cardBg.beginFill(0xf2c76e, 0.4).drawRoundedRect(8, 8, cardW-16, cardH-16, 6).endFill();
    }
    cardGfx.addChild(cardBg);

    if (!faceDown) {
      // rank in corner
      const rankColor = card.red ? 0xff5d5d : 0x160b20;
      const rankTx = new PIXI.Text(card.r, {fontFamily:"Outfit",fontSize:18,fontWeight:"900",fill:rankColor});
      rankTx.x = 6; rankTx.y = 4;
      cardGfx.addChild(rankTx);
      const suitTx = new PIXI.Text(card.s, {fontFamily:"Outfit",fontSize:14,fill:rankColor});
      suitTx.x = 6; suitTx.y = 22;
      cardGfx.addChild(suitTx);
      // mirror at bottom
      const rankTx2 = new PIXI.Text(card.r, {fontFamily:"Outfit",fontSize:18,fontWeight:"900",fill:rankColor});
      rankTx2.anchor.set(1,1); rankTx2.x = cardW-6; rankTx2.y = cardH-4;
      cardGfx.addChild(rankTx2);
      const suitTx2 = new PIXI.Text(card.s, {fontFamily:"Outfit",fontSize:14,fill:rankColor});
      suitTx2.anchor.set(1,1); suitTx2.x = cardW-6; suitTx2.y = cardH-22;
      cardGfx.addChild(suitTx2);

      // diva photo in center (for court cards)
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

  // bet row + button
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; updateBtn(); }));

  const dealBtn = makeButton(W-16, 50, t("common.deal")+" · "+curBet, 0xf2c76e, 0x160b20);
  dealBtn.x = 8; dealBtn.y = H - 50;
  dealBtn.interactive = true; dealBtn.buttonMode = true;
  c.addChild(dealBtn);
  function updateBtn() { dealBtn.children[1].text = t("common.deal")+" · "+curBet; }

  let dealing = false;
  dealBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    dealing = true;
    dealBtn.interactive = false;
    resultText.text = "";

    const deck = newDeck();
    const pCard = deck.pop();
    const dCard = deck.pop();

    // deal animation: face-down cards first
    await drawCard(dealerSlot, dCard, true);
    await drawCard(playerSlot, pCard, true);
    sfx.card();
    await wait(600);

    // flip
    await drawCard(dealerSlot, dCard, false);
    sfx.card();
    await wait(400);
    await drawCard(playerSlot, pCard, false);
    sfx.card();
    await wait(800);

    if (rankValue(pCard.r) > rankValue(dCard.r)) {
      // win
      const win = curBet * 2;
      store.pay(win);
      store.record(game.id, curBet, win);
      sfx.win();
      resultText.text = "+ "+win+" chips";
      host.onWin("win", win, {title:"Higher card wins", line:"You took it."});
    } else if (rankValue(pCard.r) < rankValue(dCard.r)) {
      // lose
      store.record(game.id, curBet, 0);
      sfx.lose();
      resultText.text = "− "+curBet+" chips";
      host.toast("Dealer wins. −"+curBet+" chips.", 2000);
    } else {
      // tie — go to war
      resultText.text = "TIE — WAR!";
      sfx.bonk();
      await wait(1500);
      // burn 3 cards each
      const burn1 = deck.pop(), burn2 = deck.pop(), burn3 = deck.pop();
      const burn4 = deck.pop(), burn5 = deck.pop(), burn6 = deck.pop();
      // deal new face-up cards
      const pCard2 = deck.pop();
      const dCard2 = deck.pop();
      await drawCard(dealerSlot, dCard2, false);
      await drawCard(playerSlot, pCard2, false);
      sfx.card();
      await wait(800);
      if (rankValue(pCard2.r) > rankValue(dCard2.r)) {
        // war win pays 3:1
        const win = curBet * 3;
        store.pay(win);
        store.record(game.id, curBet, win);
        sfx.big();
        resultText.text = "WAR WON! + "+win;
        host.onWin("big", win, {title:"War won", line:"Survived the tiebreaker."});
      } else if (rankValue(pCard2.r) < rankValue(dCard2.r)) {
        store.record(game.id, curBet, 0);
        sfx.lose();
        resultText.text = "War lost. − "+curBet;
      } else {
        // double tie — player auto-wins by war rules (tie after tie pays 2:1)
        const win = curBet * 2;
        store.pay(win);
        store.record(game.id, curBet, win);
        sfx.win();
        resultText.text = "DOUBLE TIE — PAID + "+win;
        host.onWin("win", win, {title:"Double tie pays", line:"House mercy rule."});
      }
    }
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
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:16,fontWeight:"700",fill:fg});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
