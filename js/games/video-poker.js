// games/video-poker.js — Video Poker (Jacks or Better, slot-machine styled).
// Same paytable as Squad Poker. After any win, DOUBLE OR NOTHING: wager the
// winnings on predicting the color (RED / BLACK) of the next card. Win doubles
// the winnings; lose zeros them. Repeat up to 5 times, then auto-collect.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { COURT_FACES, PHOTO_COUNTS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const SUITS = [{s:"♠",red:0},{s:"♥",red:1},{s:"♦",red:1},{s:"♣",red:0}];
const BET_LEVELS = [10,25,50,100,250];
const MAX_DOUBLES = 5;

const PAYTABLE = [
  { rank:9, name:"Royal Flush",     mult:250 },
  { rank:8, name:"Straight Flush",  mult:50  },
  { rank:7, name:"Four of a Kind",  mult:25  },
  { rank:6, name:"Full House",      mult:9   },
  { rank:5, name:"Flush",           mult:6   },
  { rank:4, name:"Straight",        mult:4   },
  { rank:3, name:"Three of a Kind", mult:3   },
  { rank:2, name:"Two Pair",        mult:2   },
  { rank:1, name:"Jacks or Better", mult:1   },
  { rank:0, name:"Nothing",         mult:0   }
];

function newDeck() {
  const d = [];
  for (const su of SUITS) for (const r of RANKS) d.push({r, s:su.s, red:su.red});
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
  const n = PHOTO_COUNTS[id] || 5;
  return friendPhoto(id, Math.floor(Math.random()*n));
}

// --- Jacks or Better 5-card evaluator (same as poker-draw) ---
function evaluate5(cards) {
  const sorted = [...cards].sort((a,b) => rankValue(b.r) - rankValue(a.r));
  const ranks = sorted.map(c => rankValue(c.r));
  const suits = sorted.map(c => c.s);
  const isFlush = suits.every(s => s === suits[0]);
  const uniqRanks = [...new Set(ranks)];
  let isStraight = false;
  if (uniqRanks.length === 5) {
    if (uniqRanks[0] - uniqRanks[4] === 4) isStraight = true;
    else if (uniqRanks[0] === 12 && uniqRanks[1] === 3 && uniqRanks[2] === 2 && uniqRanks[3] === 1 && uniqRanks[4] === 0) {
      isStraight = true; // wheel
    }
  }
  const counts = {};
  for (const r of ranks) counts[r] = (counts[r]||0) + 1;
  const countVals = Object.values(counts).sort((a,b)=>b-a);
  const groups = Object.entries(counts).sort((a,b)=>b[1]-a[1] || b[0]-a[0]).map(e=>parseInt(e[0]));
  if (isStraight && isFlush && ranks[0]===12 && ranks[4]===8) return {rank:9, name:"Royal Flush", sortKey:[9, ...ranks]};
  if (isStraight && isFlush) return {rank:8, name:"Straight Flush", sortKey:[8, ...ranks]};
  if (countVals[0]===4) return {rank:7, name:"Four of a Kind", sortKey:[7, ...groups, ...ranks.filter(r=>r!==groups[0])]};
  if (countVals[0]===3 && countVals[1]===2) return {rank:6, name:"Full House", sortKey:[6, ...groups]};
  if (isFlush) return {rank:5, name:"Flush", sortKey:[5, ...ranks]};
  if (isStraight) return {rank:4, name:"Straight", sortKey:[4, ...ranks]};
  if (countVals[0]===3) return {rank:3, name:"Three of a Kind", sortKey:[3, ...groups, ...ranks.filter(r=>r!==groups[0])]};
  if (countVals[0]===2 && countVals[1]===2) return {rank:2, name:"Two Pair", sortKey:[2, ...groups, ...ranks.filter(r=>r!==groups[0]&&r!==groups[1])]};
  if (countVals[0]===2 && groups[0] >= 9) return {rank:1, name:"Jacks or Better", sortKey:[1, ...groups, ...ranks.filter(r=>r!==groups[0])]};
  return {rank:0, name:"Nothing", sortKey:[0, ...ranks]};
}

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  // --- slot-machine styled backdrop: deep gold-brown with neon glow ---
  const bg = new PIXI.Graphics();
  bg.beginFill(0x2a1810, 0.75).drawRect(0,0,W,H).endFill();
  // golden radial-ish glow at top
  bg.beginFill(0xf2c76e, 0.08).drawRect(0, 0, W, 120).endFill();
  // neon pink strip at bottom
  bg.beginFill(0xff2e88, 0.06).drawRect(0, H-160, W, 160).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.blurb || game.tagline || "", {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xf2c76e
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // --- state ---
  let curBet = 25;
  let dealing = false;
  // phase: "idle" | "dealt" | "drawn" | "choice" (showing DOUBLE / COLLECT)
  let phase = "idle";
  let deck = null;
  let hand = [null,null,null,null,null];
  let held = [false,false,false,false,false];
  let betStaked = 0;
  // double-or-nothing state
  let pendingStake = 0;
  let pendingWinnings = 0;
  let doubleCount = 0;
  let doubleDeck = null;
  let modal = null;

  // --- paytable strip (neon) ---
  const ptItems = PAYTABLE.filter(p => p.mult > 0);
  const ptText = ptItems.map(p => `${p.name}×${p.mult}`).join("  ·  ");
  const ptTx = new PIXI.Text(ptText, {
    fontFamily:"Outfit",fontSize:12,fontWeight:"700",fill:0xf2c76e,
    align:"center", wordWrap:true, wordWrapWidth:W-16
  });
  ptTx.anchor.set(0.5,0); ptTx.x = W/2; ptTx.y = 26;
  c.addChild(ptTx);

  // --- golden marquee frame around the 5-card row ---
  const cardW = 90, cardH = 126, cardOff = 78;
  const handSpan = cardW + 4 * cardOff;
  const handX = Math.floor((W - handSpan) / 2);
  const cardY = 64;
  const frameGfx = new PIXI.Graphics();
  frameGfx.lineStyle(2, 0xf2c76e, 0.7)
         .beginFill(0x1c0e2a, 0.6)
         .drawRoundedRect(handX - 10, cardY - 8, handSpan + 20, cardH + 16, 10)
         .endFill();
  // marquee dots along the top of the frame
  for (let i = 0; i < 9; i++) {
    const x = handX - 6 + i * ((handSpan + 12) / 8);
    frameGfx.beginFill(0xff2e88, 0.85).drawCircle(x, cardY - 4, 2).endFill();
  }
  c.addChild(frameGfx);

  // --- 5 card slots ---
  const cardSlots = [];
  for (let i = 0; i < 5; i++) {
    const slot = new PIXI.Container();
    slot.x = handX + i * cardOff;
    slot.y = cardY;
    slot.interactive = true;
    slot.buttonMode = true;
    slot.hitArea = new PIXI.Rectangle(0, 0, cardW, cardH);
    c.addChild(slot);
    cardSlots.push(slot);
    slot.on("pointertap", () => {
      if (phase !== "dealt" || dealing) return;
      if (!hand[i]) return;
      sfx.click();
      held[i] = !held[i];
      renderCard(i);
    });
  }

  // --- current hand label ---
  const handLabel = new PIXI.Text("", {
    fontFamily:"Outfit",fontSize:13,fontWeight:"700",fill:0xff2e88,
    align:"center", wordWrap:true, wordWrapWidth:W-16
  });
  handLabel.anchor.set(0.5,0); handLabel.x = W/2; handLabel.y = cardY + cardH + 10;
  c.addChild(handLabel);

  // --- result text ---
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit",fontSize:18,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center", wordWrap:true, wordWrapWidth:W-16
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = cardY + cardH + 34;
  c.addChild(resultText);

  // --- bet row ---
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => {
    if (dealing || phase !== "idle") return;
    curBet = BET_LEVELS[i];
    updateMainBtn();
  }));

  // --- deal/draw button (morphs) ---
  const dealBtn = makeButton(W-16, 50, t("common.deal")+" · "+curBet, 0xf2c76e, 0x160b20);
  dealBtn.x = 8; dealBtn.y = H - 50;
  dealBtn.interactive = true; dealBtn.buttonMode = true;
  c.addChild(dealBtn);

  // --- DOUBLE / COLLECT buttons (shown after a win, replacing deal button) ---
  const choiceBtnW = (W - 16 - 8) / 2;  // 195 each
  const doubleBtn = makeButton(choiceBtnW, 50, "DOUBLE OR NOTHING", 0xff2e88, 0xffe9b8);
  doubleBtn.x = 8; doubleBtn.y = H - 50;
  doubleBtn.interactive = true; doubleBtn.buttonMode = true;
  doubleBtn.visible = false;
  c.addChild(doubleBtn);
  const collectBtn = makeButton(choiceBtnW, 50, t("common.cashOut"), 0x57d38f, 0x160b20);
  collectBtn.x = 8 + choiceBtnW + 8; collectBtn.y = H - 50;
  collectBtn.interactive = true; collectBtn.buttonMode = true;
  collectBtn.visible = false;
  c.addChild(collectBtn);

  function updateMainBtn() {
    if (phase === "idle") {
      dealBtn.children[0].clear();
      dealBtn.children[0].beginFill(0xf2c76e).drawRoundedRect(0,0,W-16,50,12).endFill();
      dealBtn.children[1].style.fill = 0x160b20;
      dealBtn.children[1].text = t("common.deal")+" · "+curBet;
    } else if (phase === "dealt") {
      dealBtn.children[0].clear();
      dealBtn.children[0].beginFill(0x57d38f).drawRoundedRect(0,0,W-16,50,12).endFill();
      dealBtn.children[1].style.fill = 0x160b20;
      dealBtn.children[1].text = t("common.draw");
    }
  }

  function showChoice(show) {
    dealBtn.visible = !show;
    doubleBtn.visible = show;
    collectBtn.visible = show;
    if (show) {
      // disable DOUBLE if max doubles reached
      doubleBtn.interactive = doubleCount < MAX_DOUBLES;
      doubleBtn.alpha = doubleCount < MAX_DOUBLES ? 1 : 0.4;
    }
  }

  // --- card renderer ---
  async function renderCard(i) {
    const slot = cardSlots[i];
    slot.removeChildren();
    const card = hand[i];
    if (!card) return;
    const cardGfx = new PIXI.Container();
    const isHeld = held[i] && phase === "dealt";
    const cardBg = new PIXI.Graphics();
    if (isHeld) cardBg.lineStyle(3, 0xff2e88, 1);
    else        cardBg.lineStyle(1, 0xf2c76e, 0.5);
    cardBg.beginFill(0xffe9b8).drawRoundedRect(0, 0, cardW, cardH, 6).endFill();
    cardGfx.addChild(cardBg);

    const rankColor = card.red ? 0xff5d5d : 0x160b20;
    const r1 = new PIXI.Text(card.r, {fontFamily:"Outfit",fontSize:14,fontWeight:"900",fill:rankColor});
    r1.x = 4; r1.y = 3; cardGfx.addChild(r1);
    const s1 = new PIXI.Text(card.s, {fontFamily:"Outfit",fontSize:14,fill:rankColor});
    s1.x = 4; s1.y = 18; cardGfx.addChild(s1);

    try {
      const url = cardPhotoURL(card.r);
      const tex = await PIXI.Assets.load(url);
      const sp = new PIXI.Sprite(tex);
      const sz = cardW - 8;
      const scale = sz / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.x = (cardW - tex.width*scale)/2;
      sp.y = (cardH - tex.height*scale)/2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(4, 28, cardW-8, cardH-36, 3).endFill();
      cardGfx.addChild(mask);
      sp.mask = mask;
      cardGfx.addChild(sp);
    } catch(e) {}

    if (isHeld) {
      const badge = new PIXI.Graphics();
      badge.beginFill(0xff2e88).drawRoundedRect(cardW/2 - 22, cardH - 18, 44, 14, 4).endFill();
      cardGfx.addChild(badge);
      const badgeTx = new PIXI.Text(t("common.hold").toUpperCase(), {fontFamily:"Outfit",fontSize:12,fontWeight:"900",fill:0xffe9b8});
      badgeTx.anchor.set(0.5); badgeTx.x = cardW/2; badgeTx.y = cardH - 11;
      cardGfx.addChild(badgeTx);
    }
    slot.addChild(cardGfx);
  }

  function clearAll() {
    for (let i = 0; i < 5; i++) {
      cardSlots[i].removeChildren();
      hand[i] = null;
      held[i] = false;
    }
    handLabel.text = "";
    resultText.text = "";
  }

  // --- DOUBLE OR NOTHING modal ---
  // Big card for the modal: 110×154
  const MOD_CARD_W = 110, MOD_CARD_H = 154;

  async function renderModalCard(slot, card, faceDown=false) {
    slot.removeChildren();
    const cardGfx = new PIXI.Container();
    const cardBg = new PIXI.Graphics();
    cardBg.lineStyle(2, 0xf2c76e, 0.8);
    if (faceDown) {
      cardBg.beginFill(0x7c1d3f).drawRoundedRect(0, 0, MOD_CARD_W, MOD_CARD_H, 8).endFill();
      cardBg.beginFill(0xf2c76e, 0.4).drawRoundedRect(8, 8, MOD_CARD_W-16, MOD_CARD_H-16, 6).endFill();
    } else {
      cardBg.beginFill(0xffe9b8).drawRoundedRect(0, 0, MOD_CARD_W, MOD_CARD_H, 8).endFill();
    }
    cardGfx.addChild(cardBg);
    if (!faceDown) {
      const rankColor = card.red ? 0xff5d5d : 0x160b20;
      const r1 = new PIXI.Text(card.r, {fontFamily:"Outfit",fontSize:20,fontWeight:"900",fill:rankColor});
      r1.x = 8; r1.y = 4; cardGfx.addChild(r1);
      const s1 = new PIXI.Text(card.s, {fontFamily:"Outfit",fontSize:16,fill:rankColor});
      s1.x = 8; s1.y = 26; cardGfx.addChild(s1);
      try {
        const url = cardPhotoURL(card.r);
        const tex = await PIXI.Assets.load(url);
        const sp = new PIXI.Sprite(tex);
        const sz = MOD_CARD_W - 12;
        const scale = sz / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = (MOD_CARD_W - tex.width*scale)/2;
        sp.y = (MOD_CARD_H - tex.height*scale)/2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(6, 40, MOD_CARD_W-12, MOD_CARD_H-48, 4).endFill();
        cardGfx.addChild(mask);
        sp.mask = mask;
        cardGfx.addChild(sp);
      } catch(e) {}
    }
    slot.addChild(cardGfx);
  }

  function openDoubleModal() {
    if (modal) return;  // never stack a second modal
    doubleDeck = newDeck();
    const prevCard = doubleDeck.pop();
    modal = new PIXI.Container();
    modal.x = 0; modal.y = 0;
    c.addChild(modal);

    // backdrop — interactive to swallow stray taps
    const backdrop = new PIXI.Graphics();
    backdrop.beginFill(0x000000, 0.85).drawRect(0,0,W,H).endFill();
    backdrop.interactive = true;
    modal.addChild(backdrop);

    // modal panel
    const panelW = Math.min(W - 16, 380);
    const panelH = 460;
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;
    const panel = new PIXI.Container();
    panel.x = panelX; panel.y = panelY;
    modal.addChild(panel);

    const panelBg = new PIXI.Graphics();
    panelBg.lineStyle(3, 0xf2c76e, 1)
           .beginFill(0x2a1810, 0.98)
           .drawRoundedRect(0, 0, panelW, panelH, 14)
           .endFill();
    // neon accent strip at top
    panelBg.beginFill(0xff2e88, 0.9).drawRoundedRect(12, 12, panelW-24, 4, 2).endFill();
    panel.addChild(panelBg);

    const title = new PIXI.Text("DOUBLE OR NOTHING", {
      fontFamily:"Outfit",fontSize:20,fontWeight:"900",fill:0xf2c76e,
      stroke:0x160b20,strokeThickness:3,align:"center"
    });
    title.anchor.set(0.5,0); title.x = panelW/2; title.y = 26;
    panel.addChild(title);

    const roundTx = new PIXI.Text(`Round ${doubleCount + 1} of ${MAX_DOUBLES}`, {
      fontFamily:"Outfit",fontSize:12,fontWeight:"700",fill:0xff2e88,align:"center"
    });
    roundTx.anchor.set(0.5,0); roundTx.x = panelW/2; roundTx.y = 56;
    panel.addChild(roundTx);

    const winLabel = new PIXI.Text("Winnings on the line:", {
      fontFamily:"Outfit",fontSize:14,fontWeight:"600",fill:0xb0b0b0,align:"center"
    });
    winLabel.anchor.set(0.5,0); winLabel.x = panelW/2; winLabel.y = 80;
    panel.addChild(winLabel);
    const winTx = new PIXI.Text(String(pendingWinnings), {
      fontFamily:"Outfit",fontSize:30,fontWeight:"900",fill:0x57d38f,align:"center"
    });
    winTx.anchor.set(0.5,0); winTx.x = panelW/2; winTx.y = 96;
    panel.addChild(winTx);

    // card display row: previous (face up) + next (face down then revealed)
    const cardsRow = new PIXI.Container();
    cardsRow.y = 150;
    panel.addChild(cardsRow);
    const prevSlot = new PIXI.Container();
    prevSlot.x = panelW/2 - MOD_CARD_W - 14;
    cardsRow.addChild(prevSlot);
    const nextSlot = new PIXI.Container();
    nextSlot.x = panelW/2 + 14;
    cardsRow.addChild(nextSlot);
    // labels under each card
    const prevLbl = new PIXI.Text("PREVIOUS", {fontFamily:"Outfit",fontSize:12,fontWeight:"700",fill:0xb0b0b0,align:"center"});
    prevLbl.anchor.set(0.5); prevLbl.x = panelW/2 - MOD_CARD_W/2 - 14; prevLbl.y = 150 + MOD_CARD_H + 6;
    panel.addChild(prevLbl);
    const nextLbl = new PIXI.Text("NEXT CARD", {fontFamily:"Outfit",fontSize:12,fontWeight:"700",fill:0xff2e88,align:"center"});
    nextLbl.anchor.set(0.5); nextLbl.x = panelW/2 + MOD_CARD_W/2 + 14; nextLbl.y = 150 + MOD_CARD_H + 6;
    panel.addChild(nextLbl);

    const promptTx = new PIXI.Text("Predict the color of the NEXT card:", {
      fontFamily:"Outfit",fontSize:12,fontWeight:"700",fill:0xffe9b8,align:"center",wordWrap:true,wordWrapWidth:panelW-24
    });
    promptTx.anchor.set(0.5,0); promptTx.x = panelW/2; promptTx.y = 326;
    panel.addChild(promptTx);

    const statusTx = new PIXI.Text("", {
      fontFamily:"Outfit",fontSize:14,fontWeight:"900",fill:0xf2c76e,
      stroke:0x160b20,strokeThickness:2,align:"center",wordWrap:true,wordWrapWidth:panelW-24
    });
    statusTx.anchor.set(0.5,0); statusTx.x = panelW/2; statusTx.y = 326;
    panel.addChild(statusTx);

    // RED / BLACK buttons
    const rbW = (panelW - 48) / 2;
    const rbY = 352;
    const redBtn = makeButton(rbW, 44, "♥ RED", 0xff5d5d, 0xffffff);
    redBtn.x = 16; redBtn.y = rbY;
    redBtn.interactive = true; redBtn.buttonMode = true;
    panel.addChild(redBtn);
    const blackBtn = makeButton(rbW, 44, "♠ BLACK", 0x1c0e2a, 0xffe9b8);
    blackBtn.x = 16 + rbW + 16; blackBtn.y = rbY;
    blackBtn.interactive = true; blackBtn.buttonMode = true;
    panel.addChild(blackBtn);

    // COLLECT button (bottom) — only shown between rounds, not during predict
    const collectInModal = makeButton(panelW - 32, 40, t("common.cashOut")+" ("+(pendingStake + pendingWinnings)+")", 0x57d38f, 0x160b20);
    collectInModal.x = 16; collectInModal.y = panelH - 50;
    collectInModal.interactive = true; collectInModal.buttonMode = true;
    collectInModal.visible = false;
    panel.addChild(collectInModal);

    // continue button (after a miss — closes modal, settles 0 winnings)
    const continueBtn = makeButton(panelW - 32, 40, t("common.close"), 0xff5d5d, 0xffffff);
    continueBtn.x = 16; continueBtn.y = panelH - 50;
    continueBtn.interactive = true; continueBtn.buttonMode = true;
    continueBtn.visible = false;
    panel.addChild(continueBtn);

    // initial render
    renderModalCard(prevSlot, prevCard, false);
    renderModalCard(nextSlot, null, true);

    function setRoundLabel() { roundTx.text = `Round ${doubleCount + 1} of ${MAX_DOUBLES}`; }
    function setWinTx() {
      winTx.text = String(pendingWinnings);
      collectInModal.children[1].text = t("common.cashOut")+" ("+(pendingStake + pendingWinnings)+")";
    }

    function setPredictMode() {
      promptTx.visible = true;
      statusTx.text = "";
      redBtn.visible = true; blackBtn.visible = true;
      redBtn.interactive = true; blackBtn.interactive = true;
      collectInModal.visible = false;
      continueBtn.visible = false;
    }
    function setRevealMode() {
      promptTx.visible = false;
      redBtn.interactive = false; blackBtn.interactive = false;
    }
    function setWinMode() {
      statusTx.text = "MATCHED! Winnings doubled.";
      statusTx.style.fill = 0x57d38f;
      redBtn.visible = false; blackBtn.visible = false;
      // if more doubles available, show DOUBLE AGAIN + COLLECT
      if (doubleCount < MAX_DOUBLES) {
        // repurpose continueBtn as "DOUBLE AGAIN"
        continueBtn.children[0].clear();
        continueBtn.children[0].beginFill(0xff2e88).drawRoundedRect(0,0,panelW-32,40,12).endFill();
        continueBtn.children[1].style.fill = 0xffe9b8;
        continueBtn.children[1].text = "DOUBLE AGAIN";
        continueBtn.visible = true;
        collectInModal.visible = true;
      } else {
        // maxed out — only COLLECT
        continueBtn.visible = false;
        collectInModal.visible = true;
      }
    }
    function setLoseMode() {
      statusTx.text = "MISSED. Winnings lost.";
      statusTx.style.fill = 0xff5d5d;
      redBtn.visible = false; blackBtn.visible = false;
      collectInModal.visible = false;
      continueBtn.children[0].clear();
      continueBtn.children[0].beginFill(0x7c1d3f).drawRoundedRect(0,0,panelW-32,40,12).endFill();
      continueBtn.children[1].style.fill = 0xffe9b8;
      continueBtn.children[1].text = t("common.close");
      continueBtn.visible = true;
    }

    async function pickColor(predictedRed) {
      setRevealMode();
      const nextCard = doubleDeck.pop();
      await wait(160);
      sfx.card();
      await renderModalCard(nextSlot, nextCard, false);
      await wait(700);
      const matched = predictedRed ? nextCard.red === 1 : nextCard.red === 0;
      if (matched) {
        sfx.win();
        pendingWinnings *= 2;
        doubleCount++;
        setWinTx();
        setWinMode();
      } else {
        sfx.lose();
        pendingWinnings = 0;
        setWinTx();
        setLoseMode();
      }
    }

    redBtn.on("pointertap", () => {
      if (!redBtn.interactive) return;
      sfx.click();
      pickColor(true);
    });
    blackBtn.on("pointertap", () => {
      if (!blackBtn.interactive) return;
      sfx.click();
      pickColor(false);
    });

    // DOUBLE AGAIN = continueBtn in win mode
    continueBtn.on("pointertap", () => {
      sfx.click();
      // If in win mode (button labelled "DOUBLE AGAIN"), start next round
      if (continueBtn.children[1].text === "DOUBLE AGAIN") {
        // deal new previous card, reset next slot
        const newPrev = doubleDeck.pop();
        renderModalCard(prevSlot, newPrev, false);
        renderModalCard(nextSlot, null, true);
        setRoundLabel();
        setPredictMode();
      } else {
        // lose mode — close
        closeDoubleModal(true);
      }
    });

    collectInModal.on("pointertap", () => {
      sfx.click();
      closeDoubleModal(true);
    });
    collectBtn.on("pointertap", () => {
      sfx.click();
      closeDoubleModal(true);
    });

    setPredictMode();
  }

  function closeDoubleModal(settle) {
    // tear down modal if present
    if (modal) {
      c.removeChild(modal);
      modal.destroy({children:true});
      modal = null;
    }
    if (settle) {
      // pay out stake + winnings
      const totalReturn = pendingStake + pendingWinnings;
      if (totalReturn > 0) store.pay(totalReturn);
      store.record(game.id, betStaked, totalReturn);
      const profit = totalReturn - betStaked;
      if (profit > 0) {
        resultText.text = `Collected: +${profit}` + (doubleCount > 0 ? `  (${doubleCount}× doubled)` : "");
        let tier = "win";
        if (profit >= betStaked * 8) tier = "big";
        if (profit >= betStaked * 20) tier = "mega";
        if (profit >= betStaked * 50) tier = "jackpot";
        try { sfx[tier](); } catch(e) { sfx.win(); }
        host.onWin(tier, profit, {title: "Cashed out", line: `+${profit} chips from video poker.`});
      } else {
        // profit === 0: lost the double-up, only stake returned
        resultText.text = "Double-up busted — stake returned.";
      }
    }
    // reset to idle
    phase = "idle";
    pendingStake = 0;
    pendingWinnings = 0;
    doubleCount = 0;
    showChoice(false);
    clearAll();
    updateMainBtn();
    dealBtn.interactive = true;
  }

  // --- handlers ---
  dealBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    if (phase === "idle") {
      if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
      dealing = true;
      betStaked = curBet;
      dealBtn.interactive = false;
      clearAll();
      deck = newDeck();
      for (let i = 0; i < 5; i++) {
        hand[i] = deck.pop();
        await renderCard(i);
        sfx.card();
        await wait(110);
      }
      const ev = evaluate5(hand);
      handLabel.text = "Current: " + ev.name;
      phase = "dealt";
      dealing = false;
      dealBtn.interactive = true;
      updateMainBtn();
    } else if (phase === "dealt") {
      dealing = true;
      dealBtn.interactive = false;
      for (let i = 0; i < 5; i++) {
        if (!held[i]) {
          hand[i] = deck.pop();
          await renderCard(i);
          sfx.card();
          await wait(110);
        }
      }
      const ev = evaluate5(hand);
      handLabel.text = ev.name;
      const mult = PAYTABLE.find(p => p.rank === ev.rank).mult;
      await wait(280);
      if (mult > 0) {
        const profit = betStaked * mult;
        // hold payout — player can double-or-nothing the profit
        pendingStake = betStaked;
        pendingWinnings = profit;
        doubleCount = 0;
        resultText.text = `${ev.name}!  ${profit} at stake`;
        sfx.win();
        phase = "choice";
        dealing = false;
        showChoice(true);
      } else {
        store.record(game.id, betStaked, 0);
        sfx.lose();
        resultText.text = `${ev.name}.  −${betStaked}`;
        phase = "drawn";
        dealing = false;
        setTimeout(() => {
          phase = "idle";
          clearAll();
          dealBtn.interactive = true;
          updateMainBtn();
        }, 1500);
      }
    }
  });

  doubleBtn.on("pointertap", () => {
    if (dealing) return;
    if (phase !== "choice") return;
    if (doubleCount >= MAX_DOUBLES) return;
    sfx.click();
    showChoice(false);
    openDoubleModal();
  });

  collectBtn.on("pointertap", () => {
    // handled via closeDoubleModal when modal open; this is the no-modal collect
    if (dealing) return;
    if (phase !== "choice") return;
    if (modal) return;  // modal has its own collect
    sfx.click();
    closeDoubleModal(true);
  });

  updateMainBtn();
  showChoice(false);
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
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:fg,align:"center"});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
