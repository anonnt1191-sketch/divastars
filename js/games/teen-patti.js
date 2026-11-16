// games/teen-patti.js — Teen Patti (Farash). Indian 3-card poker vs 1 AI diva dealer.
// Boot (ante) is the bet. Both player and dealer get 3 cards.
// Player chooses PLAY (call = 1x boot if blind, 2x boot if seen) or FOLD.
// Optional SEE: pay 1x boot upgrade to flip player cards face up; then PLAY costs 2x boot.
// Hand ranking (high → low): Trio > Pure Sequence > Sequence > Color > Pair > High Card.
//   Trio of Aces is the top hand.
// Side bet Pair Plus (separate stake, pays regardless of showdown):
//   Pair x1, Color (flush) x3, Sequence (straight) x6, Pure Sequence x12, Trio x30, Trio of Aces x50.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { COURT_FACES, DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const SUITS = [{ s:"♠", red:0 }, { s:"♥", red:1 }, { s:"♦", red:1 }, { s:"♣", red:0 }];
const BET_LEVELS = [10, 25, 50, 100, 250];
const RANK_VAL = { "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14 };

function newDeck() {
  const d = [];
  for (const su of SUITS) for (const r of RANKS) d.push({ r, s:su.s, red:su.red });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardWoman(r) {
  if (COURT_FACES[r]) return COURT_FACES[r];
  return SESSION.cardFaces[r]?.id || "ann";
}
function cardPhotoURL(r) {
  return friendPhoto(cardWoman(r), Math.floor(Math.random() * 6));
}

function divaName(id) {
  return DIVAS[id]?.name || id.charAt(0).toUpperCase() + id.slice(1);
}

// --- 3-card Teen Patti evaluator ---
// Returns { type, name, sortKey }. Higher sortKey (lexicographic) = better hand.
function evaluate3(cards) {
  const sorted = [...cards].sort((a,b) => RANK_VAL[b.r] - RANK_VAL[a.r]);
  const ranks = sorted.map(c => RANK_VAL[c.r]);
  const suits = sorted.map(c => c.s);
  const isFlush = suits[0] === suits[1] && suits[1] === suits[2];
  // straight: consecutive ranks OR A-2-3 (low straight, ace plays as 1)
  const isLowStraight = ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2;
  const isStraight = (ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1) || isLowStraight;
  const isTrips = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const isPair = !isTrips && (ranks[0] === ranks[1] || ranks[1] === ranks[2] || ranks[0] === ranks[2]);
  const straightHigh = isLowStraight ? 3 : ranks[0];

  let type, name, sortKey;
  if (isTrips) {
    if (ranks[0] === 14) { type = "trio_aces";    name = "Trio of Aces";    sortKey = [6, 14]; }
    else                 { type = "trio";         name = "Trio";            sortKey = [6, ranks[0]]; }
  }
  else if (isStraight && isFlush) { type = "pure_sequence"; name = "Pure Sequence"; sortKey = [5, straightHigh]; }
  else if (isStraight)            { type = "sequence";      name = "Sequence";      sortKey = [4, straightHigh]; }
  else if (isFlush)               { type = "color";         name = "Color";         sortKey = [3, ...ranks]; }
  else if (isPair) {
    let pairRank, kicker;
    if (ranks[0] === ranks[1])      { pairRank = ranks[0]; kicker = ranks[2]; }
    else if (ranks[1] === ranks[2]) { pairRank = ranks[1]; kicker = ranks[0]; }
    else                            { pairRank = ranks[0]; kicker = ranks[1]; }
    type = "pair"; name = "Pair"; sortKey = [2, pairRank, kicker];
  } else {
    type = "high_card"; name = "High Card"; sortKey = [1, ...ranks];
  }
  return { type, name, sortKey };
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

const PAIR_PLUS_PAY = {
  trio_aces: 50,
  trio: 30,
  pure_sequence: 12,
  sequence: 6,
  color: 3,
  pair: 1,
  high_card: 0
};

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.blurb || game.tagline || "", {
    fontFamily: "Outfit, sans-serif", fontSize: 11, fontStyle: "italic", fill: 0xff2e88
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
  let bootStaked = 0;     // ante
  let callStaked = 0;     // call (1x or 2x boot)
  let ppStaked = 0;       // pair plus side bet
  let isSeen = false;     // true after SEE upgrade
  let dealerId = pick(DIVA_IDS);

  // --- pair plus toggle (top right) ---
  const ppBtnW = 168, ppBtnH = 30;
  const ppBtn = makeButton(ppBtnW, ppBtnH, "PAIR PLUS: OFF", 0x1c0e2a, 0xffe9b8);
  ppBtn.x = W - ppBtnW - 8; ppBtn.y = 22;
  ppBtn.interactive = true; ppBtn.buttonMode = true;
  c.addChild(ppBtn);
  ppBtn.on("pointertap", () => {
    if (dealing) return;
    sfx.click();
    pairPlus = !pairPlus;
    ppBtn.children[0].clear();
    ppBtn.children[0].beginFill(pairPlus ? 0x9d4edd : 0x1c0e2a).drawRoundedRect(0, 0, ppBtnW, ppBtnH, 12).endFill();
    ppBtn.children[1].text = "PAIR PLUS: " + (pairPlus ? "ON" : "OFF");
  });

  // --- dealer avatar + name (top left) ---
  const dealerLabel = new PIXI.Text("DEALER", {
    fontFamily: "Outfit", fontSize: 11, fontWeight: "700", fill: 0xff2e88
  });
  dealerLabel.x = 8; dealerLabel.y = 22;
  c.addChild(dealerLabel);
  const dealerNameTx = new PIXI.Text(divaName(dealerId), {
    fontFamily: "Outfit", fontSize: 11, fontWeight: "700", fill: 0xffe9b8
  });
  dealerNameTx.x = 8 + dealerLabel.width + 8; dealerNameTx.y = 22;
  c.addChild(dealerNameTx);

  // --- card sizing & layout ---
  const cardW = 92, cardH = 128, cardOff = 100;
  const handTotalW = cardW + 2 * cardOff;
  const handX = Math.max(6, Math.floor((W - handTotalW) / 2));

  const dealerY = 50;
  const dealerSlot = new PIXI.Container();
  dealerSlot.x = handX; dealerSlot.y = dealerY;
  c.addChild(dealerSlot);
  const dealerHandTx = new PIXI.Text("", {
    fontFamily: "Outfit", fontSize: 11, fontWeight: "700", fill: 0xffe9b8
  });
  dealerHandTx.x = W / 2; dealerHandTx.anchor.set(0.5, 0); dealerHandTx.y = dealerY + cardH + 6;
  c.addChild(dealerHandTx);

  const playerY = dealerY + cardH + 36;
  const playerLabel = new PIXI.Text("YOU · BLIND", {
    fontFamily: "Outfit", fontSize: 11, fontWeight: "700", fill: 0xf2c76e
  });
  playerLabel.x = 8; playerLabel.y = playerY;
  c.addChild(playerLabel);
  const playerSlot = new PIXI.Container();
  playerSlot.x = handX; playerSlot.y = playerY + 18;
  c.addChild(playerSlot);
  const playerHandTx = new PIXI.Text("", {
    fontFamily: "Outfit", fontSize: 11, fontWeight: "700", fill: 0xffe9b8
  });
  playerHandTx.x = W / 2; playerHandTx.anchor.set(0.5, 0); playerHandTx.y = playerY + 18 + cardH + 6;
  c.addChild(playerHandTx);

  // --- result text ---
  const resultText = new PIXI.Text("", {
    fontFamily: "Outfit", fontSize: 14, fontWeight: "900", fill: 0xf2c76e,
    stroke: 0x160b20, strokeThickness: 3, align: "center",
    wordWrap: true, wordWrapWidth: W - 16
  });
  resultText.anchor.set(0.5, 0); resultText.x = W / 2;
  resultText.y = playerHandTx.y + 18;
  c.addChild(resultText);

  // --- bet row ---
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    if (dealing) return;
    curBet = BET_LEVELS[i]; updateBtns();
  }));

  // --- decision buttons (SEE / PLAY / FOLD) ---
  const decisionY = H - 150;
  const decisionBtnW = (W - 24) / 3;   // 3 buttons when blind
  const decisionBtnW2 = (W - 16) / 2;  // 2 buttons when seen
  const seeBtn  = makeButton(decisionBtnW, 44, "SEE · +" + curBet, 0x9d4ddd, 0xffffff);
  seeBtn.x = 8; seeBtn.y = decisionY;
  seeBtn.interactive = true; seeBtn.buttonMode = true; seeBtn.visible = false;
  c.addChild(seeBtn);
  const playBtn = makeButton(decisionBtnW, 44, "PLAY · +" + curBet, 0x57d38f, 0x160b20);
  playBtn.x = 8 + decisionBtnW + 8; playBtn.y = decisionY;
  playBtn.interactive = true; playBtn.buttonMode = true; playBtn.visible = false;
  c.addChild(playBtn);
  const foldBtn = makeButton(decisionBtnW, 44, t("common.fold"), 0xff5d5d, 0xffffff);
  foldBtn.x = 8 + (decisionBtnW + 8) * 2; foldBtn.y = decisionY;
  foldBtn.interactive = true; foldBtn.buttonMode = true; foldBtn.visible = false;
  c.addChild(foldBtn);

  // --- deal button ---
  const dealBtn = makeButton(W - 16, 50, t("common.deal") + " · " + curBet, 0xf2c76e, 0x160b20);
  dealBtn.x = 8; dealBtn.y = H - 50;
  dealBtn.interactive = true; dealBtn.buttonMode = true;
  c.addChild(dealBtn);
  function updateBtns() {
    dealBtn.children[1].text = t("common.deal") + " · " + curBet;
    seeBtn.children[1].text  = "SEE · +" + curBet;
    // PLAY button shows the cost based on blind/seen state
    const callCost = isSeen ? curBet * 2 : curBet;
    playBtn.children[1].text = "PLAY · +" + callCost;
  }

  // --- card renderer ---
  async function addCard(slot, card, faceDown, index) {
    const cardGfx = new PIXI.Container();
    cardGfx.x = index * cardOff; cardGfx.y = 0;
    const cardBg = new PIXI.Graphics();
    cardBg.lineStyle(1, 0xf2c76e, 0.4);
    cardBg.beginFill(faceDown ? 0x7c1d3f : 0xffe9b8).drawRoundedRect(0, 0, cardW, cardH, 6).endFill();
    if (faceDown) cardBg.beginFill(0xf2c76e, 0.4).drawRoundedRect(4, 4, cardW - 8, cardH - 8, 4).endFill();
    cardGfx.addChild(cardBg);
    if (!faceDown) {
      const rankColor = card.red ? 0xff5d5d : 0x160b20;
      const r1 = new PIXI.Text(card.r, { fontFamily:"Outfit", fontSize:16, fontWeight:"900", fill:rankColor });
      r1.x = 4; r1.y = 3; cardGfx.addChild(r1);
      const s1 = new PIXI.Text(card.s, { fontFamily:"Outfit", fontSize:12, fill:rankColor });
      s1.x = 4; s1.y = 22; cardGfx.addChild(s1);
      try {
        const url = cardPhotoURL(card.r);
        const tex = await PIXI.Assets.load(url);
        const sp = new PIXI.Sprite(tex);
        const sz = cardW - 8;
        const scale = sz / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = (cardW - tex.width * scale) / 2;
        sp.y = (cardH - tex.height * scale) / 2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(4, 28, cardW - 8, cardH - 36, 3).endFill();
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

  async function revealPlayer() {
    clearSlot(playerSlot);
    for (let i = 0; i < playerCards.length; i++) {
      await addCard(playerSlot, playerCards[i], false, i);
      sfx.card();
      await wait(180);
    }
  }

  function setDecision(mode) {
    // mode: "none" | "blind" | "seen"
    const showDecision = mode !== "none";
    dealBtn.visible = !showDecision;
    if (mode === "blind") {
      seeBtn.visible = true; playBtn.visible = true; foldBtn.visible = true;
      seeBtn.x = 8; playBtn.x = 8 + decisionBtnW + 8; foldBtn.x = 8 + (decisionBtnW + 8) * 2;
      const pw = decisionBtnW;
      seeBtn.children[0].clear(); seeBtn.children[0].beginFill(0x9d4ddd).drawRoundedRect(0,0,pw,44,12).endFill();
      playBtn.children[0].clear(); playBtn.children[0].beginFill(0x57d38f).drawRoundedRect(0,0,pw,44,12).endFill();
      foldBtn.children[0].clear(); foldBtn.children[0].beginFill(0xff5d5d).drawRoundedRect(0,0,pw,44,12).endFill();
    } else if (mode === "seen") {
      seeBtn.visible = false; playBtn.visible = true; foldBtn.visible = true;
      playBtn.x = 8; foldBtn.x = 8 + decisionBtnW2 + 8;
      playBtn.children[0].clear(); playBtn.children[0].beginFill(0x57d38f).drawRoundedRect(0,0,decisionBtnW2,44,12).endFill();
      foldBtn.children[0].clear(); foldBtn.children[0].beginFill(0xff5d5d).drawRoundedRect(0,0,decisionBtnW2,44,12).endFill();
    } else {
      seeBtn.visible = false; playBtn.visible = false; foldBtn.visible = false;
    }
  }

  // --- deal handler ---
  dealBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    const ppCost = pairPlus ? curBet : 0;
    const totalCost = curBet + ppCost;
    if (!store.bet(totalCost)) { host.toast(t("toast.betTooHigh")); return; }
    dealing = true;
    bootStaked = curBet;
    ppStaked = ppCost;
    callStaked = 0;
    isSeen = false;
    dealBtn.interactive = false;
    resultText.text = "";
    clearSlot(dealerSlot); clearSlot(playerSlot);
    dealerHandTx.text = ""; playerHandTx.text = "";
    playerLabel.text = "YOU · BLIND";
    // pick a fresh dealer diva each round for variety
    dealerId = pick(DIVA_IDS);
    dealerNameTx.text = divaName(dealerId);

    deck = newDeck();
    playerCards = [deck.pop(), deck.pop(), deck.pop()];
    dealerCards = [deck.pop(), deck.pop(), deck.pop()];

    // deal player face down (blind)
    for (let i = 0; i < 3; i++) {
      await addCard(playerSlot, playerCards[i], true, i);
      sfx.card();
      await wait(170);
    }
    // deal dealer face down
    for (let i = 0; i < 3; i++) {
      await addCard(dealerSlot, dealerCards[i], true, i);
      sfx.card();
      await wait(170);
    }
    dealing = false;
    updateBtns();
    setDecision("blind");
  });

  // --- SEE handler (upgrade blind → seen) ---
  // Standard Teen Patti: looking is free — but the subsequent PLAY call doubles (1x → 2x boot).
  seeBtn.on("pointertap", async () => {
    if (dealing) return;
    if (isSeen) return;
    sfx.click();
    dealing = true;
    isSeen = true;
    // reveal player's cards
    await revealPlayer();
    const pe = evaluate3(playerCards);
    playerHandTx.text = pe.name;
    playerLabel.text = "YOU · SEEN";
    dealing = false;
    updateBtns();
    setDecision("seen");
  });

  // --- FOLD handler ---
  foldBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    dealing = true;
    setDecision("none");
    // boot + (call if any) lost. Pair Plus still settles on player's hand.
    const pe = evaluate3(playerCards);
    let ppReturn = 0, ppNote = "";
    if (ppStaked > 0) {
      const mult = PAIR_PLUS_PAY[pe.type];
      if (mult > 0) {
        ppReturn = ppStaked + ppStaked * mult;
        store.pay(ppReturn);
        ppNote = `Pair Plus ${pe.name} +${ppStaked * mult}.`;
      } else {
        ppNote = "Pair Plus: nothing.";
      }
    }
    // reveal dealer for show
    await revealDealer();
    const de = evaluate3(dealerCards);
    dealerHandTx.text = de.name;
    // if player was blind, also reveal player for show
    if (!isSeen) await revealPlayer();

    const totalWagered = bootStaked + callStaked + ppStaked;
    const totalReturned = ppReturn;
    store.record(game.id, totalWagered, totalReturned);
    sfx.lose();
    const lostAmt = bootStaked + callStaked;
    resultText.text = `FOLDED. −${lostAmt}.` + (ppNote ? " " + ppNote : "");
    bootStaked = 0; callStaked = 0; ppStaked = 0;
    dealing = false;
    dealBtn.interactive = true;
  });

  // --- PLAY handler (showdown) ---
  playBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    const callCost = isSeen ? curBet * 2 : curBet;
    if (store.state.bank < callCost) { host.toast(t("toast.betTooHigh")); return; }
    if (!store.bet(callCost)) { host.toast(t("toast.betTooHigh")); return; }
    dealing = true;
    setDecision("none");
    callStaked = callCost;

    // if player was blind, reveal their cards now
    if (!isSeen) await revealPlayer();
    const pe = evaluate3(playerCards);
    playerHandTx.text = pe.name;

    // reveal dealer
    await revealDealer();
    const de = evaluate3(dealerCards);
    dealerHandTx.text = de.name;
    await wait(500);

    // --- settle Pair Plus (independent of showdown) ---
    let ppReturn = 0, ppNote = "";
    if (ppStaked > 0) {
      const mult = PAIR_PLUS_PAY[pe.type];
      if (mult > 0) {
        ppReturn = ppStaked + ppStaked * mult;
        store.pay(ppReturn);
        ppNote = `Pair Plus ${pe.name} +${ppStaked * mult}.`;
      } else {
        ppNote = "Pair Plus: nothing.";
      }
    }

    // --- settle boot + call ---
    const cmp = compareHands(pe, de);
    let mainReturn = 0, title = "", line = "";
    if (cmp > 0) {
      // win: boot + call returned + win equal to call
      mainReturn = bootStaked + callStaked + callStaked;
      title = "You win!";
      line = `${pe.name} beats ${de.name}.`;
      sfx.win();
    } else if (cmp < 0) {
      mainReturn = 0;
      title = "Dealer wins.";
      line = `${de.name} beats ${pe.name}.`;
      sfx.lose();
    } else {
      // tie: boot returned (call is lost)
      mainReturn = bootStaked;
      title = "Tie.";
      line = `Both ${pe.name}. Boot returned.`;
      sfx.bonk();
    }
    if (mainReturn > 0) store.pay(mainReturn);

    const totalWagered = bootStaked + callStaked + ppStaked;
    const totalReturned = mainReturn + ppReturn;
    const totalProfit = totalReturned - totalWagered;
    store.record(game.id, totalWagered, totalReturned);

    resultText.text = `${title} ${line}` + (ppNote ? " " + ppNote : "") +
      (totalProfit > 0 ? `  +${totalProfit}` : totalProfit < 0 ? `  −${-totalProfit}` : "");

    if (totalProfit > 0) {
      let tier = "win";
      if (PAIR_PLUS_PAY[pe.type] >= 30 || totalProfit >= curBet * 6) tier = "big";
      if (totalProfit >= curBet * 15) tier = "mega";
      if (pe.type === "trio_aces") tier = "jackpot";
      try { sfx[tier](); } catch(e) { sfx.win(); }
      host.onWin(tier, totalProfit, { title, line: ppNote || line });
    }

    bootStaked = 0; callStaked = 0; ppStaked = 0; isSeen = false;
    dealing = false;
    dealBtn.interactive = true;
  });

  // initial UI
  setDecision("none");
  updateBtns();

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit", fontSize: 13, fontWeight: "700", fill: fg, align: "center"
  });
  tx.anchor.set(0.5); tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}
