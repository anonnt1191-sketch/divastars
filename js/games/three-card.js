// games/three-card.js — Three Card Poker. ANTE + optional PAIR PLUS side bet.
// Player gets 3 cards face up; dealer gets 3 face down. Choose PLAY (match ante) or FOLD.
// Dealer needs Q-high or better to qualify.
//   - Dealer doesn't qualify: ANTE pays 1:1, PLAY pushes.
//   - Dealer qualifies, player wins: both ANTE and PLAY pay 1:1.
//   - Dealer qualifies, player loses: both lose.
//   - Dealer qualifies, tie: both push.
// Pair Plus pays regardless of dealer:
//   Pair x1, Flush x4, Straight x6, Trips x30, Straight Flush x40, Mini Royal (QKA suited) x50.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { COURT_FACES } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const SUITS = [{s:"♠",red:0},{s:"♥",red:1},{s:"♦",red:1},{s:"♣",red:0}];
const BET_LEVELS = [10,25,50,100,250];
const RANK_VAL = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14};

function newDeck() {
  const d = [];
  for (const su of SUITS) for (const r of RANKS) d.push({r, s:su.s, red:su.red});
  for (let i = d.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [d[i],d[j]] = [d[j],d[i]];
  }
  return d;
}

function cardWoman(r) {
  if (COURT_FACES[r]) return COURT_FACES[r];
  return SESSION.cardFaces[r]?.id || "ann";
}
function cardPhotoURL(r) {
  return friendPhoto(cardWoman(r), Math.floor(Math.random()*6));
}

// --- 3-card poker hand evaluation ---
// Returns {type, name, sortKey, sorted}. sortKey is an array compared element-wise.
// Higher sortKey (lexicographic) = better hand.
function evaluate3(cards) {
  const sorted = [...cards].sort((a,b) => RANK_VAL[b.r] - RANK_VAL[a.r]);
  const ranks = sorted.map(c => RANK_VAL[c.r]);
  const suits = sorted.map(c => c.s);
  const isFlush = suits[0] === suits[1] && suits[1] === suits[2];
  // straight: consecutive ranks OR A-2-3 (low straight, ace plays as 1)
  const isStraight = (ranks[0]-ranks[1] === 1 && ranks[1]-ranks[2] === 1) ||
                     (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2);
  const isTrips = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const isPair = !isTrips && (ranks[0] === ranks[1] || ranks[1] === ranks[2] || ranks[0] === ranks[2]);
  // Mini Royal = Q-K-A suited
  const isMiniRoyal = isFlush && isStraight && ranks[0] === 14 && ranks[1] === 13 && ranks[2] === 12;
  // A-2-3 is the lowest straight (ace plays as 1 for ranking); otherwise high card decides.
  const isLowStraight = ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2;
  const straightHigh = isLowStraight ? 3 : ranks[0];

  let type, name, sortKey;
  if (isMiniRoyal)         { type = "mini_royal";     name = "Mini Royal";        sortKey = [7, ...ranks]; }
  else if (isStraight && isFlush) { type = "straight_flush"; name = "Straight Flush"; sortKey = [6, straightHigh]; }
  else if (isTrips)        { type = "trips";          name = "Three of a Kind";   sortKey = [5, ranks[0]]; }
  else if (isStraight)     { type = "straight";       name = "Straight";          sortKey = [4, straightHigh]; }
  else if (isFlush)        { type = "flush";          name = "Flush";             sortKey = [3, ...ranks]; }
  else if (isPair) {
    let pairRank, kicker;
    if (ranks[0] === ranks[1])      { pairRank = ranks[0]; kicker = ranks[2]; }
    else if (ranks[1] === ranks[2]) { pairRank = ranks[1]; kicker = ranks[0]; }
    else                            { pairRank = ranks[0]; kicker = ranks[1]; }
    type = "pair"; name = "Pair"; sortKey = [2, pairRank, kicker];
  } else {
    type = "high_card"; name = "High Card"; sortKey = [1, ...ranks];
  }
  return { type, name, sortKey, sorted };
}

function compareHands(a, b) {
  const len = Math.max(a.sortKey.length, b.sortKey.length);
  for (let i = 0; i < len; i++) {
    const av = a.sortKey[i] ?? 0;
    const bv = b.sortKey[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// Dealer qualifies with Q-high or better. Any pair+ auto-qualifies (beats Q-high).
function dealerQualifies(ev) {
  if (ev.type !== "high_card") return true;
  return ev.sortKey[1] >= 12;  // Q = 12
}

const PAIR_PLUS_PAY = {
  mini_royal: 50,
  straight_flush: 40,
  trips: 30,
  straight: 6,
  flush: 4,
  pair: 1,
  high_card: 0
};

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0,0,W,H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.blurb || game.tagline || "", {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // --- state ---
  let curBet = 25;
  let dealing = false;
  let pairPlus = false;
  let deck = null;
  let playerCards = [];
  let dealerCards = [];
  let anteStaked = 0;
  let ppStaked = 0;
  let playStaked = 0;

  // --- pair plus toggle (top right) ---
  const ppBtnW = 180, ppBtnH = 36;
  const ppBtn = makeButton(ppBtnW, ppBtnH, "PAIR PLUS: OFF", 0x1c0e2a, 0xffe9b8);
  ppBtn.x = W - ppBtnW - 8; ppBtn.y = 28;
  ppBtn.interactive = true; ppBtn.buttonMode = true;
  c.addChild(ppBtn);
  ppBtn.on("pointertap", () => {
    if (dealing) return;
    sfx.click();
    pairPlus = !pairPlus;
    ppBtn.children[0].clear();
    ppBtn.children[0].beginFill(pairPlus ? 0x9d4edd : 0x1c0e2a).drawRoundedRect(0,0,ppBtnW,ppBtnH,12).endFill();
    ppBtn.children[1].text = "PAIR PLUS: " + (pairPlus ? "ON" : "OFF");
  });

  // --- card sizing & layout ---
  const cardW = 90, cardH = 126, cardOff = 100;
  const handTotalW = cardW + 2 * cardOff;  // span of 3-card hand
  const handX = Math.max(8, Math.floor((W - handTotalW) / 2));

  // --- dealer area ---
  const dealerY = 80;
  const dealerLabel = new PIXI.Text("DEALER", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xff2e88});
  dealerLabel.x = 8; dealerLabel.y = dealerY;
  c.addChild(dealerLabel);
  const dealerHandTx = new PIXI.Text("", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xffe9b8});
  dealerHandTx.x = 8 + dealerLabel.width + 8; dealerHandTx.y = dealerY;
  c.addChild(dealerHandTx);
  const dealerSlot = new PIXI.Container();
  dealerSlot.x = handX; dealerSlot.y = dealerY + 18;
  c.addChild(dealerSlot);

  // --- player area ---
  const playerY = dealerY + cardH + 28;
  const playerLabel = new PIXI.Text("YOU", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xf2c76e});
  playerLabel.x = 8; playerLabel.y = playerY;
  c.addChild(playerLabel);
  const playerHandTx = new PIXI.Text("", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xffe9b8});
  playerHandTx.x = 8 + playerLabel.width + 8; playerHandTx.y = playerY;
  c.addChild(playerHandTx);
  const playerSlot = new PIXI.Container();
  playerSlot.x = handX; playerSlot.y = playerY + 18;
  c.addChild(playerSlot);

  // --- result text ---
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit",fontSize:14,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center", wordWrap:true, wordWrapWidth:W-16
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = playerY + cardH + 14;
  c.addChild(resultText);

  // --- bet row ---
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = BET_LEVELS[i]; updateBtns(); }));

  // --- decision buttons (PLAY / FOLD) — visible after deal ---
  const decisionY = H - 150;
  const decisionBtnW = (W - 24) / 2;
  const playBtn = makeButton(decisionBtnW, 44, "PLAY (+"+curBet+")", 0x57d38f, 0x160b20);
  playBtn.x = 8; playBtn.y = decisionY;
  playBtn.interactive = true; playBtn.buttonMode = true;
  playBtn.visible = false;
  c.addChild(playBtn);
  const foldBtn = makeButton(decisionBtnW, 44, t("common.fold"), 0xff5d5d, 0xffffff);
  foldBtn.x = 8 + decisionBtnW + 8; foldBtn.y = decisionY;
  foldBtn.interactive = true; foldBtn.buttonMode = true;
  foldBtn.visible = false;
  c.addChild(foldBtn);

  // --- deal button ---
  const dealBtn = makeButton(W-16, 50, t("common.deal")+" · "+curBet, 0xf2c76e, 0x160b20);
  dealBtn.x = 8; dealBtn.y = H - 50;
  dealBtn.interactive = true; dealBtn.buttonMode = true;
  c.addChild(dealBtn);
  function updateBtns() {
    dealBtn.children[1].text = t("common.deal")+" · "+curBet;
    playBtn.children[1].text = "PLAY (+"+curBet+")";
  }

  // --- card renderer ---
  async function addCard(slot, card, faceDown, index) {
    const cardGfx = new PIXI.Container();
    cardGfx.x = index * cardOff;
    cardGfx.y = 0;
    const cardBg = new PIXI.Graphics();
    cardBg.lineStyle(1, 0xf2c76e, 0.4);
    cardBg.beginFill(faceDown ? 0x7c1d3f : 0xffe9b8).drawRoundedRect(0, 0, cardW, cardH, 6).endFill();
    if (faceDown) cardBg.beginFill(0xf2c76e, 0.4).drawRoundedRect(4, 4, cardW-8, cardH-8, 4).endFill();
    cardGfx.addChild(cardBg);
    if (!faceDown) {
      const rankColor = card.red ? 0xff5d5d : 0x160b20;
      const r1 = new PIXI.Text(card.r, {fontFamily:"Outfit",fontSize:16,fontWeight:"900",fill:rankColor});
      r1.x = 4; r1.y = 3;
      cardGfx.addChild(r1);
      const s1 = new PIXI.Text(card.s, {fontFamily:"Outfit",fontSize:12,fill:rankColor});
      s1.x = 4; s1.y = 22;
      cardGfx.addChild(s1);
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
    }
    slot.addChild(cardGfx);
  }
  function clearSlot(slot) { slot.removeChildren(); }

  async function revealDealer() {
    clearSlot(dealerSlot);
    for (let i = 0; i < dealerCards.length; i++) {
      await addCard(dealerSlot, dealerCards[i], false, i);
      sfx.card();
      await wait(180);
    }
  }

  function showDecision(show) {
    playBtn.visible = show;
    foldBtn.visible = show;
    dealBtn.visible = !show;
  }

  // --- handlers ---
  dealBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    const ppCost = pairPlus ? curBet : 0;
    const totalCost = curBet + ppCost;
    if (!store.bet(totalCost)) { host.toast(t("toast.betTooHigh")); return; }
    dealing = true;
    anteStaked = curBet;
    ppStaked = ppCost;
    playStaked = 0;
    dealBtn.interactive = false;
    resultText.text = "";
    clearSlot(dealerSlot); clearSlot(playerSlot);
    dealerHandTx.text = ""; playerHandTx.text = "";
    deck = newDeck();
    playerCards = [deck.pop(), deck.pop(), deck.pop()];
    dealerCards = [deck.pop(), deck.pop(), deck.pop()];

    // deal player face up
    for (let i = 0; i < 3; i++) {
      await addCard(playerSlot, playerCards[i], false, i);
      sfx.card();
      await wait(180);
    }
    // deal dealer face down
    for (let i = 0; i < 3; i++) {
      await addCard(dealerSlot, dealerCards[i], true, i);
      sfx.card();
      await wait(180);
    }
    const pe = evaluate3(playerCards);
    playerHandTx.text = pe.name;
    dealing = false;
    showDecision(true);
  });

  foldBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    dealing = true;
    showDecision(false);
    // ante is lost; pair plus still pays if hand qualifies
    const pe = evaluate3(playerCards);
    let ppReturn = 0;
    let ppNote = "";
    if (ppStaked > 0) {
      const mult = PAIR_PLUS_PAY[pe.type];
      if (mult > 0) {
        ppReturn = ppStaked + ppStaked * mult;  // stake back + winnings
        store.pay(ppReturn);
        ppNote = `Pair Plus: ${pe.name} +${ppStaked * mult}.`;
      } else {
        ppNote = "Pair Plus: no pair.";
      }
    }
    await revealDealer();
    const de = evaluate3(dealerCards);
    dealerHandTx.text = de.name;
    const totalWagered = anteStaked + ppStaked;
    const totalReturned = ppReturn;
    store.record(game.id, totalWagered, totalReturned);
    sfx.lose();
    resultText.text = `FOLDED. Ante −${anteStaked}.` + (ppNote ? " " + ppNote : "");
    anteStaked = 0; ppStaked = 0;
    dealing = false;
    dealBtn.interactive = true;
  });

  playBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    if (store.state.bank < anteStaked) { host.toast(t("toast.betTooHigh")); return; }
    if (!store.bet(anteStaked)) { host.toast(t("toast.betTooHigh")); return; }
    dealing = true;
    showDecision(false);
    playStaked = anteStaked;  // play bet equals ante
    // reveal dealer cards
    await revealDealer();
    const pe = evaluate3(playerCards);
    const de = evaluate3(dealerCards);
    dealerHandTx.text = de.name;
    await wait(450);

    // --- settle pair plus first (pays regardless of dealer) ---
    let ppReturn = 0;
    let ppNote = "";
    if (ppStaked > 0) {
      const mult = PAIR_PLUS_PAY[pe.type];
      if (mult > 0) {
        ppReturn = ppStaked + ppStaked * mult;
        store.pay(ppReturn);
        ppNote = `Pair Plus ${pe.name} +${ppStaked * mult}.`;
      } else {
        ppNote = "Pair Plus: no pair.";
      }
    }

    // --- settle ante + play ---
    const qualifies = dealerQualifies(de);
    let mainReturn = 0;
    let title = "", line = "";
    if (!qualifies) {
      // ante pays 1:1, play pushes (returned)
      mainReturn = anteStaked * 2 + playStaked;
      title = "Dealer doesn't qualify.";
      line = `Need Q-high. Ante 1:1, Play push.`;
    } else {
      const cmp = compareHands(pe, de);
      if (cmp > 0) {
        mainReturn = anteStaked * 2 + playStaked * 2;  // both 1:1
        title = "You win!";
        line = `${pe.name} beats ${de.name}.`;
      } else if (cmp < 0) {
        mainReturn = 0;
        title = "Dealer wins.";
        line = `${de.name} beats ${pe.name}.`;
      } else {
        mainReturn = anteStaked + playStaked;  // push — both returned
        title = "Push.";
        line = `Both ${pe.name}.`;
      }
    }
    if (mainReturn > 0) store.pay(mainReturn);

    const totalWagered = anteStaked + playStaked + ppStaked;
    const totalReturned = mainReturn + ppReturn;
    const totalProfit = totalReturned - totalWagered;
    store.record(game.id, totalWagered, totalReturned);

    resultText.text = `${title} ${line}` + (ppNote ? " " + ppNote : "") +
                      (totalProfit > 0 ? `  +${totalProfit}` : totalProfit < 0 ? `  −${-totalProfit}` : "");

    if (totalProfit > 0) {
      let tier = "win";
      if (PAIR_PLUS_PAY[pe.type] >= 30) tier = "big";      // trips / SF / mini royal
      if (totalProfit >= anteStaked * 4) tier = "big";
      if (totalProfit >= anteStaked * 10) tier = "mega";
      try { sfx[tier](); } catch(e) { sfx.win(); }
      host.onWin(tier, totalProfit, {title, line: ppNote || line});
    } else {
      sfx.lose();
    }
    anteStaked = 0; ppStaked = 0; playStaked = 0;
    dealing = false;
    dealBtn.interactive = true;
  });

  // initial UI state
  showDecision(false);

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
