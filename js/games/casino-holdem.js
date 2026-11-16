// games/casino-holdem.js — Casino Hold'em.
// Player bets ANTE, gets 2 hole cards face up; dealer gets 2 face down.
// Flop (3 community cards) dealt. Player must CALL (= ANTE) or FOLD.
// Turn + River dealt. Dealer needs pair of 4s or better to qualify.
//   - Dealer doesn't qualify: ANTE pays 1:1, CALL pushes.
//   - Dealer qualifies: best 5-of-7 (2 hole + 5 community) decides winner.
//     ANTE pays 1:1 if player wins (or pushes on tie); CALL pays 1:1 if player wins.
// Ante Bonus pays on player's final hand regardless of qualification:
//   Royal Flush ×100, Straight Flush ×20, Four of a Kind ×4, Straight ×1.
// (Interpretation note: spec says "Trips x4" — taken as Four of a Kind here, the
//  standard Casino Hold'em Ante Bonus tier between SF and Straight.)

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { COURT_FACES, PHOTO_COUNTS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const SUITS = [{s:"♠",red:0},{s:"♥",red:1},{s:"♦",red:1},{s:"♣",red:0}];
const BET_LEVELS = [10,25,50,100,250];

// Ante Bonus — paid on player's best 5-of-7 hand, regardless of dealer qualification.
// Indexed by evaluator rank (9=RF, 8=SF, 7=4K, 6=FH, 5=Flush, 4=Straight, 3=Trips,
// 2=TwoPair, 1=Pair, 0=HighCard).
const ANTE_BONUS = {
  9: 100,  // Royal Flush
  8: 20,   // Straight Flush
  7: 4,    // Four of a Kind  (spec: "Trips x4" — interpreted as 4K, the standard ante bonus tier)
  4: 1     // Straight
};

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

// --- General 5-card evaluator (returns "Pair" for ANY pair, not just JoB) ---
// rank: 0=HighCard, 1=Pair, 2=TwoPair, 3=Trips, 4=Straight, 5=Flush,
//       6=FullHouse, 7=4K, 8=StraightFlush, 9=RoyalFlush.
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
      isStraight = true; // wheel A-2-3-4-5
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
  if (countVals[0]===2) return {rank:1, name:"Pair", sortKey:[1, ...groups, ...ranks.filter(r=>r!==groups[0])]};
  return {rank:0, name:"High Card", sortKey:[0, ...ranks]};
}

function compareHands(a, b) {
  const len = Math.max(a.sortKey.length, b.sortKey.length);
  for (let i = 0; i < len; i++) {
    const av = a.sortKey[i] ?? 0, bv = b.sortKey[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// Best 5 of 7: iterate all C(7,5)=21 combinations and pick the max by compareHands.
function evaluate7(cards) {
  const n = cards.length;
  let best = null;
  for (let a=0; a<n-4; a++)
    for (let b=a+1; b<n-3; b++)
      for (let c=b+1; c<n-2; c++)
        for (let d=c+1; d<n-1; d++)
          for (let e=d+1; e<n; e++) {
            const ev = evaluate5([cards[a],cards[b],cards[c],cards[d],cards[e]]);
            if (!best || compareHands(ev, best) > 0) best = ev;
          }
  return best;
}

// Dealer qualifies with a pair of 4s or better.
// ev.rank 0 (High Card) → no. ev.rank 1 (Pair) → qualify if pair rank index >= 2 (= "4").
// ev.rank >= 2 → always qualifies.
function dealerQualifies(ev) {
  if (ev.rank === 0) return false;
  if (ev.rank === 1) return ev.sortKey[1] >= 2;
  return true;
}

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0,0,W,H).endFill();
  // felt-green tint across the play area
  bg.beginFill(0x0f3a2a, 0.18).drawRect(0, 30, W, H - 180).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.blurb || game.tagline || "", {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // --- state ---
  let curBet = 25;
  let dealing = false;
  let phase = "idle";  // idle | dealt (awaiting call/fold) | showdown | done
  let deck = null;
  let playerCards = [];
  let dealerCards = [];
  let community = [];   // up to 5 community cards
  let anteStaked = 0;
  let callStaked = 0;

  // --- layout ---
  const holeW = 80, holeH = 110, holeOff = 88;
  const holeSpan = holeW + holeOff;
  const holeX = Math.floor((W - holeSpan) / 2);
  const commW = 64, commH = 90, commOff = 70;
  const commSpan = commW + 4 * commOff;
  const commX = Math.floor((W - commSpan) / 2);

  const dealerY = 36;
  const commY = 168;
  const playerY = 296;

  // --- dealer area ---
  const dealerLabel = new PIXI.Text("DEALER", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xff2e88});
  dealerLabel.x = 8; dealerLabel.y = dealerY;
  c.addChild(dealerLabel);
  const dealerHandTx = new PIXI.Text("", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xffe9b8});
  dealerHandTx.x = 8 + dealerLabel.width + 8; dealerHandTx.y = dealerY;
  c.addChild(dealerHandTx);
  const dealerSlot = new PIXI.Container();
  dealerSlot.x = holeX; dealerSlot.y = dealerY + 14;
  c.addChild(dealerSlot);

  // --- community area ---
  const commLabel = new PIXI.Text("COMMUNITY", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xf2c76e});
  commLabel.x = 8; commLabel.y = commY;
  c.addChild(commLabel);
  const commSlot = new PIXI.Container();
  commSlot.x = commX; commSlot.y = commY + 14;
  c.addChild(commSlot);

  // --- player area ---
  const playerLabel = new PIXI.Text("YOU", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xf2c76e});
  playerLabel.x = 8; playerLabel.y = playerY;
  c.addChild(playerLabel);
  const playerHandTx = new PIXI.Text("", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0xffe9b8});
  playerHandTx.x = 8 + playerLabel.width + 8; playerHandTx.y = playerY;
  c.addChild(playerHandTx);
  const playerSlot = new PIXI.Container();
  playerSlot.x = holeX; playerSlot.y = playerY + 14;
  c.addChild(playerSlot);

  // --- result text ---
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit",fontSize:14,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center", wordWrap:true, wordWrapWidth:W-16
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = playerY + holeH + 12;
  c.addChild(resultText);

  // --- bet row ---
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => {
    if (dealing || phase !== "idle") return;
    curBet = BET_LEVELS[i];
    updateBtns();
  }));

  // --- decision buttons: CALL / FOLD (replacing the deal row) ---
  const decisionY = H - 150;
  const decBtnW = (W - 24) / 2;
  const callBtn = makeButton(decBtnW, 44, t("common.call").toUpperCase()+" +"+curBet, 0x57d38f, 0x160b20);
  callBtn.x = 8; callBtn.y = decisionY;
  callBtn.interactive = true; callBtn.buttonMode = true;
  callBtn.visible = false;
  c.addChild(callBtn);
  const foldBtn = makeButton(decBtnW, 44, t("common.fold").toUpperCase(), 0xff5d5d, 0xffffff);
  foldBtn.x = 8 + decBtnW + 8; foldBtn.y = decisionY;
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
    callBtn.children[1].text = t("common.call").toUpperCase()+" +"+curBet;
  }

  // --- card renderer (one card into a slot at given offset) ---
  async function addCard(slot, card, faceDown, index, w, h, off) {
    const cardGfx = new PIXI.Container();
    cardGfx.x = index * off;
    cardGfx.y = 0;
    const cardBg = new PIXI.Graphics();
    cardBg.lineStyle(1, 0xf2c76e, 0.4);
    cardBg.beginFill(faceDown ? 0x7c1d3f : 0xffe9b8).drawRoundedRect(0, 0, w, h, 6).endFill();
    if (faceDown) cardBg.beginFill(0xf2c76e, 0.4).drawRoundedRect(4, 4, w-8, h-8, 4).endFill();
    cardGfx.addChild(cardBg);
    if (!faceDown && card) {
      const isHole = (w === holeW);
      const rankColor = card.red ? 0xff5d5d : 0x160b20;
      const r1 = new PIXI.Text(card.r, {fontFamily:"Outfit",fontSize:isHole?15:13,fontWeight:"900",fill:rankColor});
      r1.x = 4; r1.y = 3; cardGfx.addChild(r1);
      const s1 = new PIXI.Text(card.s, {fontFamily:"Outfit",fontSize:isHole?12:10,fill:rankColor});
      s1.x = 4; s1.y = isHole ? 20 : 17;
      cardGfx.addChild(s1);
      try {
        const url = cardPhotoURL(card.r);
        const tex = await PIXI.Assets.load(url);
        const sp = new PIXI.Sprite(tex);
        const sz = w - 8;
        const scale = sz / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = (w - tex.width*scale)/2;
        sp.y = (h - tex.height*scale)/2;
        const mask = new PIXI.Graphics();
        const maskY = isHole ? 26 : 22;
        const maskH = h - (isHole ? 34 : 30);
        mask.beginFill(0xffffff).drawRoundedRect(4, maskY, w-8, maskH, 3).endFill();
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
      await addCard(dealerSlot, dealerCards[i], false, i, holeW, holeH, holeOff);
      sfx.card();
      await wait(160);
    }
  }

  function showDecision(show) {
    callBtn.visible = show;
    foldBtn.visible = show;
    dealBtn.visible = !show;
  }

  // --- handlers ---
  dealBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    if (phase !== "idle") return;
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    dealing = true;
    anteStaked = curBet;
    callStaked = 0;
    dealBtn.interactive = false;
    resultText.text = "";
    dealerHandTx.text = ""; playerHandTx.text = "";
    clearSlot(dealerSlot); clearSlot(playerSlot); clearSlot(commSlot);
    deck = newDeck();
    playerCards = [deck.pop(), deck.pop()];
    dealerCards = [deck.pop(), deck.pop()];
    community = [deck.pop(), deck.pop(), deck.pop()];

    // deal player hole (face up)
    for (let i = 0; i < 2; i++) {
      await addCard(playerSlot, playerCards[i], false, i, holeW, holeH, holeOff);
      sfx.card();
      await wait(180);
    }
    // deal dealer hole (face down)
    for (let i = 0; i < 2; i++) {
      await addCard(dealerSlot, dealerCards[i], true, i, holeW, holeH, holeOff);
      sfx.card();
      await wait(180);
    }
    // deal flop (3 community face up)
    for (let i = 0; i < 3; i++) {
      await addCard(commSlot, community[i], false, i, commW, commH, commOff);
      sfx.card();
      await wait(180);
    }
    // face-down placeholders for turn + river
    await addCard(commSlot, null, true, 3, commW, commH, commOff);
    await addCard(commSlot, null, true, 4, commW, commH, commOff);

    // show current player hand strength (2 hole + 3 flop)
    const pe = evaluate7([...playerCards, ...community]);
    playerHandTx.text = pe.name;

    phase = "dealt";
    dealing = false;
    showDecision(true);
  });

  foldBtn.on("pointertap", async () => {
    if (dealing) return;
    if (phase !== "dealt") return;
    sfx.click();
    dealing = true;
    showDecision(false);
    // ante forfeited; no call placed
    store.record(game.id, anteStaked, 0);
    sfx.lose();
    resultText.text = `Folded.  Ante −${anteStaked}`;
    anteStaked = 0;
    phase = "done";
    dealing = false;
    setTimeout(() => {
      phase = "idle";
      clearSlot(dealerSlot); clearSlot(playerSlot); clearSlot(commSlot);
      dealerHandTx.text = ""; playerHandTx.text = ""; resultText.text = "";
      community = []; playerCards = []; dealerCards = [];
      dealBtn.interactive = true;
      showDecision(false);
    }, 1700);
  });

  callBtn.on("pointertap", async () => {
    if (dealing) return;
    if (phase !== "dealt") return;
    sfx.click();
    if (store.state.bank < anteStaked) { host.toast(t("toast.betTooHigh")); return; }
    if (!store.bet(anteStaked)) { host.toast(t("toast.betTooHigh")); return; }
    dealing = true;
    showDecision(false);
    callStaked = anteStaked;

    // deal turn (4th community)
    const turn = deck.pop();
    community.push(turn);
    clearSlot(commSlot);
    for (let i = 0; i < 4; i++) await addCard(commSlot, community[i], false, i, commW, commH, commOff);
    await addCard(commSlot, null, true, 4, commW, commH, commOff);
    sfx.card();
    await wait(380);

    // deal river (5th community)
    const river = deck.pop();
    community.push(river);
    clearSlot(commSlot);
    for (let i = 0; i < 5; i++) await addCard(commSlot, community[i], false, i, commW, commH, commOff);
    sfx.card();
    await wait(380);

    // update player hand label
    const pe = evaluate7([...playerCards, ...community]);
    playerHandTx.text = pe.name;

    // reveal dealer hole cards
    await revealDealer();
    const de = evaluate7([...dealerCards, ...community]);
    dealerHandTx.text = de.name;
    await wait(450);

    // --- settle ---
    const bonusMult = ANTE_BONUS[pe.rank] || 0;
    const bonusReturn = anteStaked * bonusMult;

    let mainReturn = 0;
    let title = "", line = "";
    const qualifies = dealerQualifies(de);
    if (!qualifies) {
      // ante 1:1, call push
      mainReturn = anteStaked * 2 + callStaked;
      title = "Dealer doesn't qualify.";
      line = `Need pair of 4s+. Ante 1:1, Call push.`;
    } else {
      const cmp = compareHands(pe, de);
      if (cmp > 0) {
        mainReturn = anteStaked * 2 + callStaked * 2;  // both 1:1
        title = "You win!";
        line = `${pe.name} beats ${de.name}.`;
      } else if (cmp < 0) {
        mainReturn = 0;
        title = "Dealer wins.";
        line = `${de.name} beats ${pe.name}.`;
      } else {
        mainReturn = anteStaked + callStaked;  // push
        title = "Push.";
        line = `Both ${pe.name}.`;
      }
    }
    const totalReturn = mainReturn + bonusReturn;
    if (totalReturn > 0) store.pay(totalReturn);
    const totalWagered = anteStaked + callStaked;
    store.record(game.id, totalWagered, totalReturn);
    const profit = totalReturn - totalWagered;

    let summary = title + " " + line;
    if (bonusMult > 0) summary += `  Ante Bonus ×${bonusMult}.`;
    if (profit > 0) summary += `  +${profit}`;
    else if (profit === 0) summary += "  (push)";
    else summary += `  −${-profit}`;
    resultText.text = summary;

    if (profit > 0) {
      let tier = "win";
      if (bonusMult >= 4 || profit >= anteStaked * 4) tier = "big";
      if (bonusMult >= 20 || profit >= anteStaked * 10) tier = "mega";
      if (bonusMult >= 100) tier = "jackpot";
      try { sfx[tier](); } catch(e) { sfx.win(); }
      host.onWin(tier, profit, {title, line: bonusMult > 0 ? `Bonus ×${bonusMult} · ${line}` : line});
    } else if (profit === 0) {
      sfx.click();
    } else {
      sfx.lose();
    }

    anteStaked = 0; callStaked = 0;
    phase = "done";
    dealing = false;
    setTimeout(() => {
      phase = "idle";
      clearSlot(dealerSlot); clearSlot(playerSlot); clearSlot(commSlot);
      dealerHandTx.text = ""; playerHandTx.text = ""; resultText.text = "";
      community = []; playerCards = []; dealerCards = [];
      dealBtn.interactive = true;
      showDecision(false);
    }, 2200);
  });

  // initial UI state
  showDecision(false);
  updateBtns();

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
