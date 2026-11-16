// games/blackjack.js — 3:2 blackjack. Dealer stands on 17 (S17).
// Player: HIT / STAND / DOUBLE. Blackjack pays 3:2. Push returns bet.
// Side bet "Squad Perfect": paired first 2 cards pays x10, suited pair pays x20.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { COURT_FACES } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const SUITS = [{s:"♠",red:0},{s:"♥",red:1},{s:"♦",red:1},{s:"♣",red:0}];
const BET_LEVELS = [10,25,50,100,250];

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

// Blackjack hand value: A=11 (or 1 if bust), J/Q/K/10=10, 2-9 face.
function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.r === "A") { total += 11; aces++; }
    else if (c.r === "K" || c.r === "Q" || c.r === "J" || c.r === "10") total += 10;
    else total += parseInt(c.r, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
function isSoft(cards) {
  // soft = at least one ace still counted as 11
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.r === "A") { total += 11; aces++; }
    else if (c.r === "K" || c.r === "Q" || c.r === "J" || c.r === "10") total += 10;
    else total += parseInt(c.r, 10);
  }
  let acesAsEleven = aces;
  while (total > 21 && acesAsEleven > 0) { total -= 10; acesAsEleven--; }
  return acesAsEleven > 0;
}
function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards) === 21;
}

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
  let squadPerfect = false;
  let playerHand = [];
  let dealerHand = [];
  let deck = null;
  let betStaked = 0;       // main bet (may double)
  let sideStaked = 0;      // squad perfect
  let dealerRevealed = false;

  // --- card sizing ---
  const cardW = 90, cardH = 126, cardOff = 26;  // overlap offset

  // --- dealer area ---
  const dealerY = 36;
  const dealerLabel = new PIXI.Text("DEALER", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xff2e88});
  dealerLabel.x = 8; dealerLabel.y = dealerY;
  c.addChild(dealerLabel);
  const dealerValueTx = new PIXI.Text("", {fontFamily:"Outfit",fontSize:13,fontWeight:"700",fill:0xffe9b8});
  dealerValueTx.x = 8 + dealerLabel.width + 8; dealerValueTx.y = dealerY;
  c.addChild(dealerValueTx);
  const dealerSlot = new PIXI.Container();
  dealerSlot.x = 8; dealerSlot.y = dealerY + 18;
  c.addChild(dealerSlot);

  // --- player area ---
  const playerY = dealerY + cardH + 32;
  const playerLabel = new PIXI.Text("YOU", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xf2c76e});
  playerLabel.x = 8; playerLabel.y = playerY;
  c.addChild(playerLabel);
  const playerValueTx = new PIXI.Text("", {fontFamily:"Outfit",fontSize:13,fontWeight:"700",fill:0xffe9b8});
  playerValueTx.x = 8 + playerLabel.width + 8; playerValueTx.y = playerY;
  c.addChild(playerValueTx);
  const playerSlot = new PIXI.Container();
  playerSlot.x = 8; playerSlot.y = playerY + 18;
  c.addChild(playerSlot);

  // --- result text ---
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit",fontSize:16,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center", wordWrap:true, wordWrapWidth:W-16
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = playerY + cardH + 14;
  c.addChild(resultText);

  // --- squad perfect toggle (always visible) ---
  const squadBtnW = 180, squadBtnH = 36;
  const squadBtn = makeButton(squadBtnW, squadBtnH, "SQUAD PERFECT: OFF", 0x1c0e2a, 0xffe9b8);
  squadBtn.x = W/2 - squadBtnW/2; squadBtn.y = H - 138;
  squadBtn.interactive = true; squadBtn.buttonMode = true;
  c.addChild(squadBtn);
  squadBtn.on("pointertap", () => {
    if (dealing) return;
    sfx.click();
    squadPerfect = !squadPerfect;
    squadBtn.children[0].clear();
    squadBtn.children[0].beginFill(squadPerfect ? 0x9d4edd : 0x1c0e2a).drawRoundedRect(0,0,squadBtnW,squadBtnH,12).endFill();
    squadBtn.children[1].text = "SQUAD PERFECT: " + (squadPerfect ? "ON" : "OFF");
  });

  // --- bet row ---
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = BET_LEVELS[i]; updateDealBtn(); }));

  // --- action buttons (HIT / STAND / DOUBLE) ---
  const actionY = H - 188;
  const actBtnH = 44;
  const actBtnW = (W - 32) / 3;  // 3 buttons + 2 gaps of 8

  const hitBtn = makeButton(actBtnW, actBtnH, t("common.hit"), 0x57d38f, 0x160b20);
  hitBtn.x = 8; hitBtn.y = actionY;
  hitBtn.interactive = true; hitBtn.buttonMode = true;
  hitBtn.visible = false;
  c.addChild(hitBtn);

  const standBtn = makeButton(actBtnW, actBtnH, t("common.stand"), 0xf2c76e, 0x160b20);
  standBtn.x = 8 + actBtnW + 8; standBtn.y = actionY;
  standBtn.interactive = true; standBtn.buttonMode = true;
  standBtn.visible = false;
  c.addChild(standBtn);

  const doubleBtn = makeButton(actBtnW, actBtnH, t("common.double"), 0x57c7ff, 0x160b20);
  doubleBtn.x = 8 + 2*(actBtnW + 8); doubleBtn.y = actionY;
  doubleBtn.interactive = true; doubleBtn.buttonMode = true;
  doubleBtn.visible = false;
  c.addChild(doubleBtn);

  // --- deal button ---
  const dealBtn = makeButton(W-16, 50, t("common.deal")+" · "+curBet, 0xf2c76e, 0x160b20);
  dealBtn.x = 8; dealBtn.y = H - 50;
  dealBtn.interactive = true; dealBtn.buttonMode = true;
  c.addChild(dealBtn);

  function updateDealBtn() { dealBtn.children[1].text = t("common.deal")+" · "+curBet; }

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
      const r1 = new PIXI.Text(card.r, {fontFamily:"Outfit",fontSize:13,fontWeight:"900",fill:rankColor});
      r1.x = 3; r1.y = 2;
      cardGfx.addChild(r1);
      const s1 = new PIXI.Text(card.s, {fontFamily:"Outfit",fontSize:12,fill:rankColor});
      s1.x = 3; s1.y = 16;
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
        mask.beginFill(0xffffff).drawRoundedRect(4, 22, cardW-8, cardH-30, 3).endFill();
        cardGfx.addChild(mask);
        sp.mask = mask;
        cardGfx.addChild(sp);
      } catch(e) {}
    }
    slot.addChild(cardGfx);
  }
  function clearSlot(slot) { slot.removeChildren(); }

  function updateDealerValue(v) { dealerValueTx.text = String(v); }
  function updatePlayerValue() {
    const v = handValue(playerHand);
    playerValueTx.text = isSoft(playerHand) && v < 21 ? `${v} (soft)` : String(v);
  }

  function resetHand() {
    clearSlot(dealerSlot); clearSlot(playerSlot);
    dealerValueTx.text = ""; playerValueTx.text = "";
    resultText.text = "";
    playerHand = []; dealerHand = [];
    dealerRevealed = false;
  }

  function showPlayActions(show) {
    hitBtn.visible = show;
    standBtn.visible = show;
    // can only double on first 2 cards with enough chips
    doubleBtn.visible = show && playerHand.length === 2 && store.state.bank >= betStaked;
    dealBtn.visible = !show;
  }

  async function maybeRevealDealer() {
    if (dealerRevealed) return;
    dealerRevealed = true;
    clearSlot(dealerSlot);
    for (let i = 0; i < dealerHand.length; i++) await addCard(dealerSlot, dealerHand[i], false, i);
    sfx.card();
    updateDealerValue(handValue(dealerHand));
    await wait(450);
  }

  // --- handlers ---
  dealBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    const sideCost = squadPerfect ? curBet : 0;
    const totalCost = curBet + sideCost;
    if (!store.bet(totalCost)) { host.toast(t("toast.betTooHigh")); return; }
    dealing = true;
    betStaked = curBet;
    sideStaked = sideCost;
    dealBtn.interactive = false;
    resetHand();
    deck = newDeck();
    // deal alternating: player, dealer, player, dealer (dealer's 2nd face down)
    playerHand.push(deck.pop()); await addCard(playerSlot, playerHand[0], false, 0); sfx.card(); await wait(180);
    dealerHand.push(deck.pop()); await addCard(dealerSlot, dealerHand[0], false, 0); sfx.card(); await wait(180);
    playerHand.push(deck.pop()); await addCard(playerSlot, playerHand[1], false, 1); sfx.card(); await wait(180);
    dealerHand.push(deck.pop()); await addCard(dealerSlot, dealerHand[1], true, 1);  sfx.card(); await wait(280);

    updatePlayerValue();
    updateDealerValue(handValue([dealerHand[0]]));  // only show first card value while hole hidden

    const pBJ = isBlackjack(playerHand);
    const dBJ = isBlackjack(dealerHand);
    if (pBJ || dBJ) {
      // immediate settle — reveal + resolve
      await wait(200);
      await settle(pBJ, dBJ, false);
      dealing = false;
      dealBtn.interactive = true;
      showPlayActions(false);
      return;
    }
    dealing = false;
    showPlayActions(true);
  });

  hitBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    dealing = true;
    const card = deck.pop();
    playerHand.push(card);
    await addCard(playerSlot, card, false, playerHand.length - 1);
    sfx.card();
    updatePlayerValue();
    const v = handValue(playerHand);
    if (v > 21) {
      // bust — reveal dealer for closure, settle
      await wait(300);
      dealing = false;
      showPlayActions(false);
      await settle(false, false, true);
      dealBtn.interactive = true;
    } else if (v === 21) {
      // auto-stand on 21
      dealing = false;
      await playerStand();
    } else {
      dealing = false;
      doubleBtn.visible = false;  // can't double after hit
    }
  });

  standBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    await playerStand();
  });

  doubleBtn.on("pointertap", async () => {
    if (dealing) return;
    if (playerHand.length !== 2) return;
    if (store.state.bank < betStaked) { host.toast(t("toast.betTooHigh")); return; }
    sfx.click();
    if (!store.bet(betStaked)) { host.toast(t("toast.betTooHigh")); return; }
    betStaked += betStaked;  // doubled
    dealing = true;
    showPlayActions(false);
    const card = deck.pop();
    playerHand.push(card);
    await addCard(playerSlot, card, false, playerHand.length - 1);
    sfx.card();
    updatePlayerValue();
    await wait(400);
    const v = handValue(playerHand);
    dealing = false;
    if (v > 21) {
      await settle(false, false, true);
      dealBtn.interactive = true;
    } else {
      await playerStand();
    }
  });

  async function playerStand() {
    if (dealing) return;
    dealing = true;
    showPlayActions(false);
    await maybeRevealDealer();
    // dealer hits to 17 (stands on hard or soft 17 — S17)
    while (handValue(dealerHand) < 17) {
      const card = deck.pop();
      dealerHand.push(card);
      await addCard(dealerSlot, card, false, dealerHand.length - 1);
      sfx.card();
      updateDealerValue(handValue(dealerHand));
      await wait(420);
    }
    await wait(300);
    await settle(false, false, false);
    dealing = false;
    dealBtn.interactive = true;
  }

  async function settle(pBJ, dBJ, playerBust) {
    await maybeRevealDealer();
    // --- side bet: Squad Perfect (player's first 2 cards) ---
    let sideWin = 0;       // winnings only (profit)
    let sideReturn = 0;    // total returned to bank
    let sideNote = "";
    if (sideStaked > 0) {
      const c1 = playerHand[0], c2 = playerHand[1];
      if (c1 && c2 && c1.r === c2.r) {
        if (c1.s === c2.s) {
          sideWin = sideStaked * 20;
          sideNote = "Suited pair! x20";
        } else {
          sideWin = sideStaked * 10;
          sideNote = "Pair! x10";
        }
        sideReturn = sideStaked + sideWin;  // stake back + winnings
        store.pay(sideReturn);
      } else {
        sideNote = "Side lost.";
      }
    }

    // --- main bet ---
    const pv = handValue(playerHand);
    const dv = handValue(dealerHand);
    let mainReturn = 0;
    let title = "", line = "";

    if (pBJ && !dBJ) {
      mainReturn = Math.floor(betStaked * 2.5);  // 3:2 → bet back + 1.5x profit
      title = "BLACKJACK!";
      line = "3:2 payout. Vedhika approves the cut.";
    } else if (dBJ && !pBJ) {
      mainReturn = 0;
      title = "Dealer blackjack.";
      line = "She had it from the deal.";
    } else if (pBJ && dBJ) {
      mainReturn = betStaked;
      title = "Push.";
      line = "Both blackjack. Bet returned.";
    } else if (playerBust || pv > 21) {
      mainReturn = 0;
      title = "Bust.";
      line = `You hit ${pv}.`;
    } else if (dv > 21) {
      mainReturn = betStaked * 2;
      title = "Dealer bust!";
      line = `She hit ${dv}. You win.`;
    } else if (pv > dv) {
      mainReturn = betStaked * 2;
      title = "You win.";
      line = `${pv} beats ${dv}.`;
    } else if (pv < dv) {
      mainReturn = 0;
      title = "Dealer wins.";
      line = `${dv} beats ${pv}.`;
    } else {
      mainReturn = betStaked;
      title = "Push.";
      line = `Both ${pv}.`;
    }

    if (mainReturn > 0) store.pay(mainReturn);

    const totalWagered = betStaked + sideStaked;
    const totalReturned = mainReturn + sideReturn;
    const totalProfit = totalReturned - totalWagered;
    store.record(game.id, totalWagered, totalReturned);

    // --- result text ---
    let summary = title;
    if (totalProfit > 0) summary += `  +${totalProfit}`;
    else if (totalProfit === 0) summary += "  (push)";
    else summary += `  −${-totalProfit}`;
    if (sideNote) summary += `  ·  ${sideNote}`;
    resultText.text = summary;

    // --- celebration ---
    if (totalProfit > 0) {
      let tier = "win";
      if (pBJ || sideWin >= sideStaked * 20 || totalProfit >= betStaked * 3) tier = "big";
      if (totalProfit >= betStaked * 6) tier = "mega";
      try { sfx[tier](); } catch(e) { sfx.win(); }
      host.onWin(tier, totalProfit, {title, line});
    } else {
      sfx.lose();
    }

    betStaked = 0; sideStaked = 0;
  }

  // initial UI state
  showPlayActions(false);

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
