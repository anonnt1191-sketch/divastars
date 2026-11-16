// games/baccarat.js — Punto Banco. Bet on PLAYER, BANKER, or TIE.
// Card values: A=1, 2-9 face value, 10/J/Q/K=0. Hand value = sum mod 10.
// Natural 8 or 9 = immediate result. Player draws on 0-5; banker rules use player's third card.
// PLAYER pays 1:1. BANKER pays 0.95:1 (5% commission). TIE pays 8:1. On tie, PLAYER/BANKER push.

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

// Baccarat card value: A=1, 2-9 face value, 10/J/Q/K=0
function bacValue(r) {
  if (r === "A") return 1;
  if (r === "10" || r === "J" || r === "Q" || r === "K") return 0;
  return parseInt(r, 10);
}
function bacHand(cards) {
  return cards.reduce((s,c) => s + bacValue(c.r), 0) % 10;
}

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0,0,W,H).endFill();
  // subtle red/blue tint for player/banker sides
  bg.beginFill(0x57d38f, 0.06).drawRect(0, 0, W/2, H).endFill();
  bg.beginFill(0x57c7ff, 0.06).drawRect(W/2, 0, W/2, H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.blurb || game.tagline || "", {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // --- state ---
  let curBet = 25;
  let dealing = false;
  let pickedSide = "player";

  // --- pick side UI ---
  const pickLabel = new PIXI.Text("Pick your bet:", {
    fontFamily:"Outfit",fontSize:13,fontWeight:"700",fill:0xffe9b8
  });
  pickLabel.x = W/2 - pickLabel.width/2; pickLabel.y = 28;
  c.addChild(pickLabel);

  const sides = [
    {id:"player",  label:"PLAYER\n1:1",    color:0x57d38f},
    {id:"tie",     label:"TIE\n8:1",       color:0xf2c76e},
    {id:"banker",  label:"BANKER\n0.95:1", color:0x57c7ff}
  ];
  const sideBtns = [];
  const sideBtnW = (W - 32) / 3;
  const sideBtnH = 54;
  sides.forEach((s, i) => {
    const b = makeButton(sideBtnW, sideBtnH, s.label, s.id === pickedSide ? s.color : 0x1c0e2a, s.id === pickedSide ? 0x160b20 : 0xffffff);
    b.x = 8 + i * (sideBtnW + 8); b.y = 48;
    b.interactive = true; b.buttonMode = true;
    b.on("pointertap", () => {
      if (dealing) return;
      sfx.click();
      pickedSide = s.id;
      sideBtns.forEach((x, j) => {
        const sd = sides[j];
        x.children[0].clear();
        x.children[0].beginFill(sd.id === pickedSide ? sd.color : 0x1c0e2a).drawRoundedRect(0,0,sideBtnW,sideBtnH,12).endFill();
        x.children[1].style.fill = sd.id === pickedSide ? 0x160b20 : 0xffffff;
      });
    });
    sideBtns.push(b);
    c.addChild(b);
  });

  // --- card slots ---
  const cardW = 80, cardH = 112, cardOff = 90;

  const bankerY = 122;
  const bankerLabel = new PIXI.Text("BANKER", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0x57c7ff});
  bankerLabel.x = 8; bankerLabel.y = bankerY;
  c.addChild(bankerLabel);
  const bankerValueTx = new PIXI.Text("", {fontFamily:"Outfit",fontSize:14,fontWeight:"900",fill:0xffe9b8});
  bankerValueTx.x = 8 + bankerLabel.width + 8; bankerValueTx.y = bankerY - 1;
  c.addChild(bankerValueTx);
  const bankerSlot = new PIXI.Container();
  bankerSlot.x = 8; bankerSlot.y = bankerY + 18;
  c.addChild(bankerSlot);

  const playerY = bankerY + cardH + 28;
  const playerLabel = new PIXI.Text("PLAYER", {fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:0x57d38f});
  playerLabel.x = 8; playerLabel.y = playerY;
  c.addChild(playerLabel);
  const playerValueTx = new PIXI.Text("", {fontFamily:"Outfit",fontSize:14,fontWeight:"900",fill:0xffe9b8});
  playerValueTx.x = 8 + playerLabel.width + 8; playerValueTx.y = playerY - 1;
  c.addChild(playerValueTx);
  const playerSlot = new PIXI.Container();
  playerSlot.x = 8; playerSlot.y = playerY + 18;
  c.addChild(playerSlot);

  // --- result text ---
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit",fontSize:18,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center", wordWrap:true, wordWrapWidth:W-16
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = playerY + cardH + 18;
  c.addChild(resultText);

  // --- bet row ---
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = BET_LEVELS[i]; updateDealBtn(); }));

  // --- deal button ---
  const dealBtn = makeButton(W-16, 50, t("common.deal")+" · "+curBet, 0xf2c76e, 0x160b20);
  dealBtn.x = 8; dealBtn.y = H - 50;
  dealBtn.interactive = true; dealBtn.buttonMode = true;
  c.addChild(dealBtn);
  function updateDealBtn() { dealBtn.children[1].text = t("common.deal")+" · "+curBet; }

  // --- card renderer (always face up for baccarat) ---
  async function addCard(slot, card, index) {
    const cardGfx = new PIXI.Container();
    cardGfx.x = index * cardOff;
    cardGfx.y = 0;
    const cardBg = new PIXI.Graphics();
    cardBg.lineStyle(1, 0xf2c76e, 0.4);
    cardBg.beginFill(0xffe9b8).drawRoundedRect(0, 0, cardW, cardH, 6).endFill();
    cardGfx.addChild(cardBg);
    const rankColor = card.red ? 0xff5d5d : 0x160b20;
    const r1 = new PIXI.Text(card.r, {fontFamily:"Outfit",fontSize:14,fontWeight:"900",fill:rankColor});
    r1.x = 4; r1.y = 3;
    cardGfx.addChild(r1);
    const s1 = new PIXI.Text(card.s, {fontFamily:"Outfit",fontSize:14,fill:rankColor});
    s1.x = 4; s1.y = 19;
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
      mask.beginFill(0xffffff).drawRoundedRect(4, 26, cardW-8, cardH-34, 3).endFill();
      cardGfx.addChild(mask);
      sp.mask = mask;
      cardGfx.addChild(sp);
    } catch(e) {}
    slot.addChild(cardGfx);
  }
  function clearSlot(slot) { slot.removeChildren(); }

  // --- banker draw decision per Punto Banco rules ---
  function bankerShouldDraw(bankerTotal, playerDrew, pThirdVal) {
    if (!playerDrew) return bankerTotal <= 5;  // stands on 6,7
    if (bankerTotal <= 2) return true;
    if (bankerTotal === 3) return pThirdVal !== 8;
    if (bankerTotal === 4) return pThirdVal >= 2 && pThirdVal <= 7;
    if (bankerTotal === 5) return pThirdVal >= 4 && pThirdVal <= 7;
    if (bankerTotal === 6) return pThirdVal === 6 || pThirdVal === 7;
    return false;  // 7 stands
  }

  dealBtn.on("pointertap", async () => {
    if (dealing) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    dealing = true;
    dealBtn.interactive = false;
    resultText.text = "";
    clearSlot(bankerSlot); clearSlot(playerSlot);
    bankerValueTx.text = ""; playerValueTx.text = "";

    const deck = newDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const bankerHand = [deck.pop(), deck.pop()];

    // deal alternating: player, banker, player, banker
    await addCard(playerSlot, playerHand[0], 0); sfx.card(); await wait(180);
    await addCard(bankerSlot, bankerHand[0], 0); sfx.card(); await wait(180);
    await addCard(playerSlot, playerHand[1], 1); sfx.card(); await wait(180);
    await addCard(bankerSlot, bankerHand[1], 1); sfx.card(); await wait(360);

    const pv0 = bacHand(playerHand);
    const dv0 = bacHand(bankerHand);
    playerValueTx.text = String(pv0);
    bankerValueTx.text = String(dv0);

    const pNatural = pv0 >= 8;
    const bNatural = dv0 >= 8;

    if (!pNatural && !bNatural) {
      // player draws on 0-5; stands on 6,7
      let playerDrew = false;
      let pThirdVal = -1;
      if (pv0 <= 5) {
        const pThird = deck.pop();
        playerHand.push(pThird);
        await addCard(playerSlot, pThird, 2);
        sfx.card();
        playerDrew = true;
        pThirdVal = bacValue(pThird.r);
        await wait(360);
        playerValueTx.text = String(bacHand(playerHand));
      }
      // banker draw decision
      if (bankerShouldDraw(dv0, playerDrew, pThirdVal)) {
        const bThird = deck.pop();
        bankerHand.push(bThird);
        await addCard(bankerSlot, bThird, 2);
        sfx.card();
        await wait(360);
        bankerValueTx.text = String(bacHand(bankerHand));
      }
    }
    await wait(500);

    const finalP = bacHand(playerHand);
    const finalD = bacHand(bankerHand);
    let winSide;
    if (finalP > finalD) winSide = "player";
    else if (finalP < finalD) winSide = "banker";
    else winSide = "tie";

    // --- payouts ---
    let win = 0;             // total returned to bank
    let profit = 0;          // net profit
    let title = "", line = "";

    if (pickedSide === winSide) {
      if (winSide === "player") {
        win = curBet * 2;            // 1:1
        profit = curBet;
        title = "Player wins!";
        line = `Player ${finalP} · Banker ${finalD}.`;
      } else if (winSide === "banker") {
        win = curBet + Math.floor(curBet * 0.95);  // 0.95:1 (5% commission)
        profit = win - curBet;
        title = "Banker wins!";
        line = `Banker ${finalD} · Player ${finalP}. 5% commission.`;
      } else {  // tie
        win = curBet * 9;             // 8:1 (stake + 8x)
        profit = win - curBet;
        title = "TIE!";
        line = `Both ${finalP}. 8:1 payout.`;
      }
      store.pay(win);
      let tier = (winSide === "tie") ? "big" : "win";
      if (profit >= curBet * 8) tier = "big";
      try { sfx[tier](); } catch(e) { sfx.win(); }
      resultText.text = `${title}  +${profit}`;
      host.onWin(tier, profit, {title, line});
    } else if (winSide === "tie") {
      // tie when player bet on player/banker → push (bet returned)
      store.pay(curBet);
      sfx.bonk();
      resultText.text = `TIE — push. Bet returned.`;
    } else {
      sfx.lose();
      resultText.text = `${winSide.toUpperCase()} wins.  −${curBet}`;
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
