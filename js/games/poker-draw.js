// games/poker-draw.js — Squad Poker (5-card draw, Jacks or Better).
// DEAL five cards face up. Tap cards to HOLD (gold highlight + HOLD badge).
// DRAW replaces unheld cards. Paytable pays on the resulting 5-card hand.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { COURT_FACES, PHOTO_COUNTS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const SUITS = [{s:"♠",red:0},{s:"♥",red:1},{s:"♦",red:1},{s:"♣",red:0}];
const BET_LEVELS = [10,25,50,100,250];

// Jacks or Better paytable (rank index → multiplier).
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

// --- Jacks or Better 5-card evaluator ---
// Returns { rank, name, sortKey }. rank: 0=Nothing, 1=Jacks+, 2=TwoPair, 3=Trips,
// 4=Straight, 5=Flush, 6=FullHouse, 7=4K, 8=StraightFlush, 9=RoyalFlush.
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
  if (countVals[0]===2 && groups[0] >= 9) return {rank:1, name:"Jacks or Better", sortKey:[1, ...groups, ...ranks.filter(r=>r!==groups[0])]};
  return {rank:0, name:"Nothing", sortKey:[0, ...ranks]};
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
  // phase: "idle" (no hand) | "dealt" (can hold/draw) | "drawn" (evaluated, brief hold before reset)
  let phase = "idle";
  let deck = null;
  let hand = [null,null,null,null,null];
  let held = [false,false,false,false,false];
  let betStaked = 0;

  // --- compact paytable strip ---
  const ptItems = PAYTABLE.filter(p => p.mult > 0);
  const ptText = ptItems.map(p => `${p.name}×${p.mult}`).join("  ·  ");
  const ptTx = new PIXI.Text(ptText, {
    fontFamily:"Outfit",fontSize:12,fontWeight:"600",fill:0xb0b0b0,
    align:"center", wordWrap:true, wordWrapWidth:W-16
  });
  ptTx.anchor.set(0.5,0); ptTx.x = W/2; ptTx.y = 26;
  c.addChild(ptTx);

  // --- 5 card slots ---
  const cardW = 90, cardH = 126, cardOff = 78;
  const handSpan = cardW + 4 * cardOff;       // 384
  const handX = Math.floor((W - handSpan) / 2);
  const cardY = 56;
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
    fontFamily:"Outfit",fontSize:13,fontWeight:"700",fill:0xffe9b8,
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
    updateBtn();
  }));

  // --- deal/draw button ---
  const dealBtn = makeButton(W-16, 50, t("common.deal")+" · "+curBet, 0xf2c76e, 0x160b20);
  dealBtn.x = 8; dealBtn.y = H - 50;
  dealBtn.interactive = true; dealBtn.buttonMode = true;
  c.addChild(dealBtn);
  function updateBtn() {
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

  // --- card renderer (single slot) ---
  async function renderCard(i) {
    const slot = cardSlots[i];
    slot.removeChildren();
    const card = hand[i];
    if (!card) return;
    const cardGfx = new PIXI.Container();
    const isHeld = held[i] && phase === "dealt";
    const cardBg = new PIXI.Graphics();
    if (isHeld) cardBg.lineStyle(3, 0xf2c76e, 1);
    else        cardBg.lineStyle(1, 0xf2c76e, 0.3);
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
      badge.beginFill(0xf2c76e).drawRoundedRect(cardW/2 - 22, cardH - 18, 44, 14, 4).endFill();
      cardGfx.addChild(badge);
      const badgeTx = new PIXI.Text(t("common.hold").toUpperCase(), {fontFamily:"Outfit",fontSize:12,fontWeight:"900",fill:0x160b20});
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

  // --- handlers ---
  dealBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    if (phase === "idle") {
      // DEAL
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
      updateBtn();
    } else if (phase === "dealt") {
      // DRAW — replace unheld cards
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
        const payout = betStaked + profit;
        store.pay(payout);
        store.record(game.id, betStaked, payout);
        resultText.text = `${ev.name}!  +${profit}`;
        let tier = "win";
        if (mult >= 25) tier = "big";
        if (mult >= 50) tier = "mega";
        if (mult >= 250) tier = "jackpot";
        try { sfx[tier](); } catch(e) { sfx.win(); }
        host.onWin(tier, profit, {title: ev.name, line: `×${mult} on ${betStaked} chips.`});
      } else {
        store.record(game.id, betStaked, 0);
        sfx.lose();
        resultText.text = `${ev.name}.  −${betStaked}`;
      }
      phase = "drawn";
      dealing = false;
      // brief hold so the player can see the final hand, then reset
      setTimeout(() => {
        phase = "idle";
        clearAll();
        dealBtn.interactive = true;
        updateBtn();
      }, 1700);
    }
  });

  updateBtn();
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
