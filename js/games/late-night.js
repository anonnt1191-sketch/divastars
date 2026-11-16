// games/late-night.js — Late Night Didi. Teen Patti variant with squad AI.
// Player vs 3 AI divas. Each AI has a personality-driven play style:
//   kallie    = chaos bluffer (raises with anything 30% of the time)
//   ann       = calm value player (only raises with pair+)
//   priyanka  = overthinker (calls everything, rarely raises)
//   vedhika   = editor's cut (folds marginal, raises strong)
//   sunita    = wedding MVP (calls calmly, raises with sequence+)
//   kajal     = red dress (aggressive — raises 40% when she can)
// Player picks 3 opponents from a roster of 6 divas before each hand.
// Standard Teen Patti ranking: Trio > Pure Sequence > Sequence > Color > Pair > High Card.
// Boot (ante) = bet. One raise round max per hand (player → AIs → optional player call).

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { COURT_FACES, DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto, castToPhotoURL, castPick } from "../core/photos.js";
import { CAST_LIST } from "../core/app.js";

// --- card data ---
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const SUITS = [{ s:"♠", red:0 }, { s:"♥", red:1 }, { s:"♦", red:1 }, { s:"♣", red:0 }];
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
  const cf = SESSION.cardFaces?.[r];
  if (cf?.id) return cf.id;
  return DIVA_IDS[Math.floor(Math.random() * DIVA_IDS.length)];
}
function cardPhotoURL(r) {
  return friendPhoto(cardWoman(r), Math.floor(Math.random() * 6));
}

// --- 3-card Teen Patti evaluator (mirrors teen-patti.js) ---
function evaluate3(cards) {
  const sorted = [...cards].sort((a,b) => RANK_VAL[b.r] - RANK_VAL[a.r]);
  const ranks = sorted.map(c => RANK_VAL[c.r]);
  const suits = sorted.map(c => c.s);
  const isFlush = suits[0] === suits[1] && suits[1] === suits[2];
  const isLowStraight = ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2;
  const isStraight = (ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1) || isLowStraight;
  const isTrips = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const isPair = !isTrips && (ranks[0] === ranks[1] || ranks[1] === ranks[2] || ranks[0] === ranks[2]);
  const straightHigh = isLowStraight ? 3 : ranks[0];
  let type, name, sortKey;
  if (isTrips) {
    if (ranks[0] === 14) { type = "trio_aces";    name = "Trio of Aces";    sortKey = [6, 14]; }
    else                 { type = "trio";         name = "Trio";            sortKey = [6, ranks[0]]; }
  } else if (isStraight && isFlush) { type = "pure_sequence"; name = "Pure Sequence"; sortKey = [5, straightHigh]; }
  else if (isStraight)              { type = "sequence";      name = "Sequence";      sortKey = [4, straightHigh]; }
  else if (isFlush)                 { type = "color";         name = "Color";         sortKey = [3, ...ranks]; }
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
    const av = a.sortKey[i] ?? 0, bv = b.sortKey[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// 0..1 strength for AI decisions
function handStrength(ev) {
  return ({
    high_card: 0.10, pair: 0.25, color: 0.45, sequence: 0.55,
    pure_sequence: 0.70, trio: 0.85, trio_aces: 1.0
  })[ev.type] ?? 0.10;
}

// --- roster & personalities ---
const PERSONALITIES = {
  kallie:    { name: "Chaos Bluffer",  desc: "Raises with anything. 30% of the time." },
  ann:       { name: "Calm Value",     desc: "Only raises with pair or better." },
  priyanka:  { name: "Overthinker",    desc: "Calls everything. Rarely raises." },
  vedhika:   { name: "Editor's Cut",   desc: "Folds marginal. Raises strong." },
  sunita:    { name: "Wedding MVP",    desc: "Calls calmly. Raises sequences." },
  kajal:     { name: "Red Dress",      desc: "Aggressive. Raises 40% when she can." }
};
const ROSTER = ["kallie", "ann", "priyanka", "vedhika", "sunita", "kajal"];

function aiDecide(personality, strength, currentStake, canRaise) {
  switch (personality) {
    case "kallie":
      if (canRaise && Math.random() < 0.30) return "raise";
      return "call";
    case "ann":
      if (strength < 0.20 && currentStake >= 2) return "fold";
      if (strength >= 0.25 && canRaise && Math.random() < 0.30) return "raise";
      return "call";
    case "priyanka":
      if (strength >= 0.70 && canRaise && Math.random() < 0.15) return "raise";
      if (strength < 0.10 && currentStake >= 4) return "fold";
      return "call";
    case "vedhika":
      if (strength < 0.20 && currentStake >= 2) return "fold";
      if (strength >= 0.55 && canRaise && Math.random() < 0.40) return "raise";
      return "call";
    case "sunita":
      if (strength < 0.15 && currentStake >= 4) return "fold";
      if (strength >= 0.55 && canRaise && Math.random() < 0.25) return "raise";
      return "call";
    case "kajal":
      if (canRaise && Math.random() < 0.40) return "raise";
      if (strength < 0.15 && currentStake >= 4) return "fold";
      return "call";
  }
  return "call";
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function divaName(id) { return cap(DIVAS[id]?.name || id); }

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb || "Three divas. One pot. Late night.", {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // bet row + bottom button slot
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    if (busy) return;
    curBet = [10, 25, 50, 100, 250][i];
  }));

  // bottom action button (DEAL / NEW HAND / none during hand)
  const bottomBtn = makeButton(W - 16, 50, "DEAL · " + curBet, 0xf2c76e, 0x160b20);
  bottomBtn.x = 8; bottomBtn.y = H - 50;
  bottomBtn.interactive = true; bottomBtn.buttonMode = true;
  c.addChild(bottomBtn);

  // game content container (roster or hand)
  const content = new PIXI.Container();
  content.y = 28;
  c.addChild(content);

  // state
  let busy = false;
  let playerFolded = false;   // set true if player folds during turn 2 (inside aiRound)
  let screen = "";  // "roster" | "hand"
  let selectedAis = [];        // array of 3 diva ids
  let ais = [];                // array of { id, personality, slot, cardSlots, hand, folded, contributedStake }
  let playerCards = [];
  let pot = 0;
  let stake = 1;               // current stake (multiples of bet)
  let playerStake = 0;         // player's contributed stake (multiples of bet)
  let playerContributed = 0;   // actual chips deducted from bank

  // --- roster screen ---
  function renderRoster() {
    content.removeChildren();
    screen = "roster";
    selectedAis = [];

    const header = new PIXI.Text("Pick 3 opponents", {
      fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0xffe9b8
    });
    header.x = 8; header.y = 0;
    content.addChild(header);

    const sub = new PIXI.Text("Tap to select. The other 3 sit out.", {
      fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "400", fill: 0xb0b0b0
    });
    sub.x = 8; sub.y = 24;
    content.addChild(sub);

    const cardW = (W - 32) / 3;
    const cardH = 180;
    const startY = 50;
    const rosterCards = [];
    for (let i = 0; i < ROSTER.length; i++) {
      const id = ROSTER[i];
      const row = Math.floor(i / 3), col = i % 3;
      const cx = 8 + col * (cardW + 8);
      const cy = startY + row * (cardH + 8);
      const card = makeRosterCard(cardW, cardH, id);
      card.x = cx; card.y = cy;
      card.interactive = true; card.buttonMode = true;
      card.on("pointertap", () => toggleRosterPick(i));
      content.addChild(card);
      rosterCards.push(card);
    }

    function toggleRosterPick(idx) {
      if (busy) return;
      sfx.click();
      const id = ROSTER[idx];
      const i = selectedAis.indexOf(id);
      if (i >= 0) {
        selectedAis.splice(i, 1);
      } else {
        if (selectedAis.length >= 3) {
          host.toast("You've already picked 3.", 1400);
          return;
        }
        selectedAis.push(id);
      }
      // update visuals
      for (let j = 0; j < ROSTER.length; j++) {
        updateRosterCardVisual(rosterCards[j], ROSTER[j], selectedAis.includes(ROSTER[j]), selectedAis.indexOf(ROSTER[j]));
      }
      updateBottomBtn();
    }

    updateBottomBtn();
  }

  // --- hand screen ---
  function renderHand() {
    content.removeChildren();
    screen = "hand";
    pot = 0;
    stake = 1;
    playerStake = 0;
    playerContributed = 0;
    ais = [];

    // layout
    const aiColW = (W - 24) / 3;
    const aiPhotoSz = Math.min(80, aiColW - 24);
    const aiCardW = 44, aiCardH = 62, aiCardOff = 24;

    // AI section: 3 columns with photo + name + 3 face-down cards
    for (let i = 0; i < 3; i++) {
      const id = selectedAis[i];
      const col = new PIXI.Container();
      col.x = 8 + i * aiColW + Math.floor((aiColW - aiPhotoSz) / 2);
      col.y = 0;
      content.addChild(col);

      // photo holder
      const photoHolder = new PIXI.Container();
      photoHolder.x = 0; photoHolder.y = 0;
      col.addChild(photoHolder);
      loadPhotoHolder(photoHolder, id, aiPhotoSz);

      // name
      const nameTx = new PIXI.Text(divaName(id), {
        fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700", fill: 0xffe9b8, align: "center"
      });
      nameTx.anchor.set(0.5, 0);
      nameTx.x = aiPhotoSz / 2; nameTx.y = aiPhotoSz + 4;
      col.addChild(nameTx);

      // personality tag
      const tagTx = new PIXI.Text(PERSONALITIES[id].name, {
        fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "400", fill: 0xff2e88, align: "center"
      });
      tagTx.anchor.set(0.5, 0);
      tagTx.x = aiPhotoSz / 2; tagTx.y = aiPhotoSz + 22;
      col.addChild(tagTx);

      // card slots (face-down initially)
      const cardSlots = [];
      const cardsY = aiPhotoSz + 40;
      const cardsTotalW = aiCardW + 2 * aiCardOff;
      const cardsX = (aiPhotoSz - cardsTotalW) / 2;
      for (let k = 0; k < 3; k++) {
        const slot = new PIXI.Container();
        slot.x = cardsX + k * aiCardOff; slot.y = cardsY;
        col.addChild(slot);
        cardSlots.push(slot);
      }

      // status text (below cards) — shows CALL/RAISE/FOLD when AI acts
      const statusTx = new PIXI.Text("", {
        fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "700", fill: 0xf2c76e, align: "center"
      });
      statusTx.anchor.set(0.5, 0);
      statusTx.x = aiPhotoSz / 2; statusTx.y = cardsY + aiCardH + 4;
      col.addChild(statusTx);

      ais.push({
        id, personality: id, slot: col, cardSlots, statusTx,
        hand: [], folded: false, contributedStake: 1  // ante
      });
    }

    // pot display (center)
    const potY = 178;
    const potBg = new PIXI.Graphics();
    potBg.beginFill(0x1c0e2a).drawRoundedRect(8, potY, W - 16, 36, 10).endFill();
    potBg.beginFill(0xf2c76e, 0.45).drawRoundedRect(8, potY, W - 16, 3, 1).endFill();
    content.addChild(potBg);
    const potLabel = new PIXI.Text("POT", {
      fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700", fill: 0xff2e88
    });
    potLabel.x = 18; potLabel.y = potY + (36 - potLabel.height) / 2;
    content.addChild(potLabel);
    const potTx = new PIXI.Text("0", {
      fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0xf2c76e, align: "right"
    });
    potTx.anchor.set(1, 0);
    potTx.x = W - 18; potTx.y = potY + (36 - potTx.height) / 2;
    content.addChild(potTx);

    // action buttons row (CALL / RAISE / FOLD)
    const actionY = 224;
    const actionH = 48;
    const actionW3 = (W - 24) / 3;
    const actionW2 = (W - 16) / 2;
    const callBtn  = makeButton(actionW3, actionH, "CALL · +0",   0x57d38f, 0x160b20);
    const raiseBtn = makeButton(actionW3, actionH, "RAISE · +"+curBet, 0xf2c76e, 0x160b20);
    const foldBtn  = makeButton(actionW3, actionH, t("common.fold"), 0xff5d5d, 0xffffff);
    callBtn.y = actionY; raiseBtn.y = actionY; foldBtn.y = actionY;
    callBtn.visible = raiseBtn.visible = foldBtn.visible = false;
    content.addChild(callBtn); content.addChild(raiseBtn); content.addChild(foldBtn);

    function layoutAction3() {
      callBtn.visible = raiseBtn.visible = foldBtn.visible = true;
      callBtn.x = 8; raiseBtn.x = 8 + actionW3 + 8; foldBtn.x = 8 + (actionW3 + 8) * 2;
      // resize buttons to actionW3 + recenter text
      [callBtn, raiseBtn, foldBtn].forEach(b => {
        const g = b.children[0];
        g.clear();
        g.beginFill(g._bgCol || 0x000000).drawRoundedRect(0, 0, actionW3, actionH, 12).endFill();
        b.children[1].x = actionW3 / 2;
      });
    }
    function layoutAction2() {
      callBtn.visible = true; foldBtn.visible = true; raiseBtn.visible = false;
      callBtn.x = 8; foldBtn.x = 8 + actionW2 + 8;
      [callBtn, foldBtn].forEach(b => {
        const g = b.children[0];
        g.clear();
        g.beginFill(g._bgCol || 0x000000).drawRoundedRect(0, 0, actionW2, actionH, 12).endFill();
        b.children[1].x = actionW2 / 2;
      });
    }
    function hideActions() {
      callBtn.visible = raiseBtn.visible = foldBtn.visible = false;
    }
    function setActionLabel(btn, label) {
      btn.children[1].text = label;
    }

    // result text
    const resultText = new PIXI.Text("", {
      fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "900", fill: 0xf2c76e,
      stroke: 0x160b20, strokeThickness: 2, align: "center",
      wordWrap: true, wordWrapWidth: W - 16
    });
    resultText.anchor.set(0.5, 0);
    resultText.x = W / 2; resultText.y = 282;
    content.addChild(resultText);

    // player label
    const playerLabelY = 318;
    const playerLabel = new PIXI.Text("YOU · ", {
      fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700", fill: 0xf2c76e
    });
    playerLabel.x = 8; playerLabel.y = playerLabelY;
    content.addChild(playerLabel);
    const playerHandTx = new PIXI.Text("", {
      fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700", fill: 0xffe9b8
    });
    playerHandTx.x = 8 + playerLabel.width; playerHandTx.y = playerLabelY;
    content.addChild(playerHandTx);

    // player card slots
    const pCardW = 100, pCardH = 140, pCardOff = 108;
    const pTotalW = pCardW + 2 * pCardOff;
    const pX = Math.floor((W - pTotalW) / 2);
    const pY = playerLabelY + 22;
    const playerSlots = [];
    for (let k = 0; k < 3; k++) {
      const slot = new PIXI.Container();
      slot.x = pX + k * pCardOff; slot.y = pY;
      content.addChild(slot);
      playerSlots.push(slot);
    }

    function updatePot() { potTx.text = String(pot); }
    function updatePlayerLabel() {
      if (playerCards.length === 3) {
        const ev = evaluate3(playerCards);
        playerHandTx.text = ev.name + (playerStake > 1 ? ` · stake ${playerStake}×` : "");
      } else {
        playerHandTx.text = "";
      }
    }

    // --- card renderer (works for both AI small cards & player big cards) ---
    async function renderCard(slot, card, faceDown, w, h) {
      slot.removeChildren();
      const cardGfx = new PIXI.Container();
      const cardBg = new PIXI.Graphics();
      cardBg.lineStyle(1, 0xf2c76e, 0.35);
      cardBg.beginFill(faceDown ? 0x7c1d3f : 0xffe9b8).drawRoundedRect(0, 0, w, h, 6).endFill();
      if (faceDown) cardBg.beginFill(0xf2c76e, 0.35).drawRoundedRect(3, 3, w - 6, h - 6, 4).endFill();
      cardGfx.addChild(cardBg);
      if (!faceDown) {
        const rankColor = card.red ? 0xff5d5d : 0x160b20;
        const fontSize = w >= 80 ? 18 : 13;
        const suitFontSize = w >= 80 ? 14 : 11;
        const r1 = new PIXI.Text(card.r, { fontFamily:"Outfit", fontSize, fontWeight:"900", fill:rankColor });
        r1.x = 3; r1.y = 2; cardGfx.addChild(r1);
        const s1 = new PIXI.Text(card.s, { fontFamily:"Outfit", fontSize:suitFontSize, fill:rankColor });
        s1.x = 3; s1.y = 2 + fontSize + 2; cardGfx.addChild(s1);
        if (w >= 80) {
          // mirror at bottom-right
          const r2 = new PIXI.Text(card.r, { fontFamily:"Outfit", fontSize, fontWeight:"900", fill:rankColor });
          r2.anchor.set(1, 1); r2.x = w - 3; r2.y = h - 2; cardGfx.addChild(r2);
          const s2 = new PIXI.Text(card.s, { fontFamily:"Outfit", fontSize:suitFontSize, fill:rankColor });
          s2.anchor.set(1, 1); s2.x = w - 3; s2.y = h - 2 - fontSize - 2; cardGfx.addChild(s2);
        }
        // photo in center
        try {
          const url = cardPhotoURL(card.r);
          const tex = await PIXI.Assets.load(url);
          const sp = new PIXI.Sprite(tex);
          const sz = w - 6;
          const scale = sz / Math.max(tex.width, tex.height);
          sp.scale.set(scale);
          sp.x = (w - tex.width * scale) / 2;
          sp.y = (h - tex.height * scale) / 2 + (w >= 80 ? 0 : 0);
          const mask = new PIXI.Graphics();
          const maskY = w >= 80 ? 26 : 16;
          const maskH = h - maskY - (w >= 80 ? 26 : 12);
          mask.beginFill(0xffffff).drawRoundedRect(3, maskY, w - 6, Math.max(8, maskH), 3).endFill();
          cardGfx.addChild(mask);
          sp.mask = mask;
          cardGfx.addChild(sp);
        } catch (e) {}
      }
      slot.addChild(cardGfx);
    }

    // --- deal ---
    async function dealHand() {
      busy = true;
      playerFolded = false;
      bottomBtn.interactive = false;
      // ante: player pays bet; each AI "antes" from fictional stack
      if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); busy = false; bottomBtn.interactive = true; return; }
      playerContributed = curBet;
      playerStake = 1;
      pot = 4 * curBet;
      stake = 1;
      updatePot();
      resultText.text = "";
      for (const ai of ais) {
        ai.folded = false; ai.contributedStake = 1; ai.hand = [];
        ai.statusTx.text = ""; ai.statusTx.style.fill = 0xf2c76e;
      }

      // build deck and deal
      const deck = newDeck();
      playerCards = [deck.pop(), deck.pop(), deck.pop()];
      for (const ai of ais) ai.hand = [deck.pop(), deck.pop(), deck.pop()];

      // deal animation: player gets 3 face-up, AIs get 3 face-down each
      for (let k = 0; k < 3; k++) {
        await renderCard(playerSlots[k], playerCards[k], false, pCardW, pCardH);
        sfx.card();
        await wait(120);
      }
      for (const ai of ais) {
        for (let k = 0; k < 3; k++) {
          await renderCard(ai.cardSlots[k], ai.hand[k], true, aiCardW, aiCardH);
          sfx.card();
          await wait(80);
        }
      }
      updatePlayerLabel();

      // player's first turn: CALL / RAISE / FOLD
      promptPlayerTurn1();
      busy = false;
    }

    function clearActionListeners() {
      callBtn.removeAllListeners("pointertap");
      raiseBtn.removeAllListeners("pointertap");
      foldBtn.removeAllListeners("pointertap");
    }
    function disableActions() {
      callBtn.interactive = false; raiseBtn.interactive = false; foldBtn.interactive = false;
    }

    function promptPlayerTurn1() {
      // CALL = go to showdown with current stake (no extra); RAISE = double stake, pay (stake)×bet extra
      const raiseCost = curBet * stake;  // raising from stake to 2*stake costs stake*bet
      setActionLabel(callBtn, "CALL · +0");
      setActionLabel(raiseBtn, "RAISE · +" + raiseCost);
      layoutAction3();
      clearActionListeners();
      callBtn.interactive = true; raiseBtn.interactive = true; foldBtn.interactive = true;
      callBtn.on("pointertap", () => onPlayerCall1());
      raiseBtn.on("pointertap", () => onPlayerRaise1());
      foldBtn.on("pointertap", () => onPlayerFold());
    }

    async function onPlayerCall1() {
      disableActions();
      sfx.click();
      hideActions();
      busy = true;
      resultText.text = "You call. The squad decides...";
      resultText.style.fill = 0xffe9b8;
      // AIs each decide based on hand strength + personality (kallie can still raise even on a call)
      await aiRound(stake < 4);
      if (playerFolded) { busy = false; return; }
      await showdown();
      busy = false;
    }

    async function onPlayerRaise1() {
      disableActions();
      sfx.click();
      const raiseCost = curBet * stake;
      if (store.state.bank < raiseCost) {
        host.toast(t("toast.betTooHigh"));
        // re-enable actions so player can choose differently
        callBtn.interactive = true; raiseBtn.interactive = true; foldBtn.interactive = true;
        return;
      }
      if (!store.bet(raiseCost)) {
        host.toast(t("toast.betTooHigh"));
        callBtn.interactive = true; raiseBtn.interactive = true; foldBtn.interactive = true;
        return;
      }
      playerContributed += raiseCost;
      playerStake = stake * 2;
      stake = stake * 2;
      pot += raiseCost;  // player's raise added
      hideActions();
      busy = true;
      updatePot();
      updatePlayerLabel();
      resultText.text = `You raise to ${stake}× bet. The squad responds...`;
      resultText.style.fill = 0xffe9b8;
      sfx.chip();
      await aiRound(stake < 4);
      if (playerFolded) { busy = false; return; }
      await showdown();
      busy = false;
    }

    async function onPlayerFold() {
      disableActions();
      sfx.click();
      hideActions();
      busy = true;
      playerFolded = true;
      resultText.text = "You folded.";
      resultText.style.fill = 0xff5d5d;
      store.record(game.id, playerContributed, 0);
      sfx.lose();
      // reveal AI hands for show
      for (const ai of ais) {
        await revealAi(ai);
      }
      await wait(800);
      finishHand(-playerContributed, "You folded.", "Better luck next hand.");
      busy = false;
    }

    async function aiRound(canRaise) {
      for (const ai of ais) {
        if (ai.folded) continue;
        await wait(420);
        const ev = evaluate3(ai.hand);
        const strength = handStrength(ev);
        const action = aiDecide(ai.personality, strength, stake, canRaise && stake < 4);
        if (action === "fold") {
          ai.folded = true;
          ai.statusTx.text = "FOLD";
          ai.statusTx.style.fill = 0xff5d5d;
          sfx.bonk();
        } else if (action === "raise" && canRaise && stake < 4) {
          // AI raises: stake doubles. AI must pay (newStake - contributedStake)*bet
          // to match through the new stake (covers both the call and the raise).
          stake = stake * 2;
          const aiPayment = (stake - ai.contributedStake) * curBet;
          ai.contributedStake = stake;
          pot += aiPayment;
          ai.statusTx.text = `RAISE → ${stake}×`;
          ai.statusTx.style.fill = 0xf2c76e;
          updatePot();
          sfx.chip();
        } else {
          // call: AI matches current stake
          const addStake = stake - ai.contributedStake;
          if (addStake > 0) {
            ai.contributedStake = stake;
            pot += addStake * curBet;
            updatePot();
          }
          ai.statusTx.text = "CALL";
          ai.statusTx.style.fill = 0x57d38f;
          sfx.tick();
        }
      }
      // if any AI raised beyond player's stake, player gets a final call/fold turn
      if (stake > playerStake) {
        await promptPlayerTurn2();
      }
    }

    function promptPlayerTurn2() {
      return new Promise(resolve => {
        const callCost = (stake - playerStake) * curBet;
        setActionLabel(callBtn, "CALL · +" + callCost);
        layoutAction2();
        clearActionListeners();
        callBtn.interactive = true; foldBtn.interactive = true;
        resultText.text = `An AI raised to ${stake}×. Call (+${callCost}) or fold?`;
        resultText.style.fill = 0xffe9b8;
        callBtn.on("pointertap", async () => {
          disableActions();
          if (store.state.bank < callCost) {
            host.toast(t("toast.betTooHigh"));
            // re-enable so player can fold instead
            callBtn.interactive = true; foldBtn.interactive = true;
            return;
          }
          if (!store.bet(callCost)) {
            host.toast(t("toast.betTooHigh"));
            callBtn.interactive = true; foldBtn.interactive = true;
            return;
          }
          hideActions();
          playerContributed += callCost;
          playerStake = stake;
          pot += callCost;
          updatePot();
          updatePlayerLabel();
          sfx.chip();
          resolve();
        });
        foldBtn.on("pointertap", async () => {
          disableActions();
          hideActions();
          playerFolded = true;
          store.record(game.id, playerContributed, 0);
          sfx.lose();
          for (const ai of ais) if (!ai.folded) await revealAi(ai);
          await wait(600);
          finishHand(-playerContributed, "You folded to the raise.", "The squad took the pot.");
          resolve();
        });
      });
    }

    async function revealAi(ai) {
      for (let k = 0; k < 3; k++) {
        await renderCard(ai.cardSlots[k], ai.hand[k], false, aiCardW, aiCardH);
        sfx.card();
        await wait(140);
      }
      const ev = evaluate3(ai.hand);
      ai.statusTx.text = ev.name;
      ai.statusTx.style.fill = 0xffe9b8;
    }

    async function showdown() {
      // reveal all non-folded AI hands
      for (const ai of ais) {
        if (!ai.folded) await revealAi(ai);
      }
      await wait(500);

      const playerEv = evaluate3(playerCards);
      // find best among non-folded (including player)
      let winner = "player";
      let winnerEv = playerEv;
      let winnerName = "You";
      for (const ai of ais) {
        if (ai.folded) continue;
        const aiEv = evaluate3(ai.hand);
        const cmp = compareHands(aiEv, winnerEv);
        if (cmp > 0) {
          winner = "ai";
          winnerEv = aiEv;
          winnerName = divaName(ai.id);
        }
      }

      const playerWon = winner === "player";
      const potBefore = pot;
      if (playerWon) {
        store.pay(pot);
        store.record(game.id, playerContributed, pot);
        const profit = pot - playerContributed;
        resultText.text = `You win! ${playerEv.name} · +${profit}`;
        resultText.style.fill = 0x57d38f;
        let tier = "win";
        if (profit >= curBet * 4) tier = "big";
        if (profit >= curBet * 10) tier = "mega";
        if (playerEv.type === "trio_aces") tier = "jackpot";
        try { sfx[tier](); } catch (e) { sfx.win(); }
        host.onWin(tier, profit, {
          title: `${playerEv.name} — you win`,
          line: `${winnerName} took the pot of ${potBefore}.`
        });
        finishHand(profit, "You win.", `${playerEv.name} took the pot.`);
      } else {
        store.record(game.id, playerContributed, 0);
        resultText.text = `${winnerName} wins with ${winnerEv.name}. −${playerContributed}`;
        resultText.style.fill = 0xff5d5d;
        sfx.lose();
        finishHand(-playerContributed, `${winnerName} wins.`, `${winnerEv.name} took the pot.`);
      }
    }

    function finishHand(profit, title, line) {
      // show NEW HAND button (still on hand screen)
      bottomBtn.children[1].text = "NEW HAND";
      bottomBtn.interactive = true;
      busy = false;
      // tapping NEW HAND returns to roster to pick opponents again
      // (rebind is handled in main bottomBtn handler)
    }

    // --- bottom button bindings (state-aware) ---
    // We rebind bottomBtn.on("pointertap") each time the screen changes.
    // First, clear and bind for the current screen.

    bindBottomBtn();

    function bindBottomBtn() {
      bottomBtn.removeAllListeners();
      if (screen === "roster") {
        bottomBtn.children[1].text = "DEAL · " + curBet;
        bottomBtn.on("pointertap", async () => {
          if (busy) return;
          if (selectedAis.length !== 3) {
            host.toast("Pick exactly 3 opponents.", 1400);
            return;
          }
          sfx.click();
          renderHand();
          bindBottomBtn();
          await dealHand();
        });
      } else if (screen === "hand") {
        // initial label set by dealHand; after showdown, NEW HAND
        bottomBtn.children[1].text = "...";
        bottomBtn.interactive = false;
        bottomBtn.on("pointertap", () => {
          if (busy) return;
          sfx.click();
          // return to roster
          renderRoster();
          bindBottomBtn();
        });
      }
    }
  }

  // mount-level updateBottomBtn (called from renderRoster and bindBottomBtn)
  function updateBottomBtn() {
    if (screen === "roster") {
      bottomBtn.children[1].text = selectedAis.length === 3
        ? "DEAL · " + curBet
        : `PICK ${3 - selectedAis.length} MORE`;
      bottomBtn.interactive = selectedAis.length === 3;
    }
  }

  // initial screen: roster
  renderRoster();

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

// --- module helpers ---

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  g._bgCol = bg;  // stash for resize redraws
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700", fill: fg, align: "center"
  });
  tx.anchor.set(0.5); tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}

function makeRosterCard(w, h, divaId) {
  const card = new PIXI.Container();
  const bg = new PIXI.Graphics();
  bg.lineStyle(2, 0x3a2548, 1);
  bg.beginFill(0x1c0e2a).drawRoundedRect(0, 0, w, h, 10).endFill();
  card.addChild(bg);
  // photo holder
  const photoSz = Math.min(80, w - 16);
  const photoHolder = new PIXI.Container();
  photoHolder.x = (w - photoSz) / 2; photoHolder.y = 10;
  card.addChild(photoHolder);
  loadPhotoHolder(photoHolder, divaId, photoSz);
  // name
  const nameTx = new PIXI.Text(divaName(divaId), {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "900", fill: 0xffe9b8, align: "center"
  });
  nameTx.anchor.set(0.5, 0); nameTx.x = w / 2; nameTx.y = 10 + photoSz + 6;
  card.addChild(nameTx);
  // personality name
  const persTx = new PIXI.Text(PERSONALITIES[divaId].name, {
    fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "700", fill: 0xff2e88, align: "center"
  });
  persTx.anchor.set(0.5, 0); persTx.x = w / 2; persTx.y = 10 + photoSz + 24;
  card.addChild(persTx);
  // personality desc (wrapped)
  const descTx = new PIXI.Text(PERSONALITIES[divaId].desc, {
    fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "400", fill: 0xb0b0b0,
    align: "center", wordWrap: true, wordWrapWidth: w - 8
  });
  descTx.anchor.set(0.5, 0); descTx.x = w / 2; descTx.y = 10 + photoSz + 42;
  card.addChild(descTx);
  // selection indicator (top-right corner, hidden by default)
  const selBadge = new PIXI.Graphics();
  selBadge.beginFill(0xf2c76e).drawCircle(0, 0, 12).endFill();
  selBadge.x = w - 14; selBadge.y = 14;
  selBadge.visible = false;
  card.addChild(selBadge);
  const selNum = new PIXI.Text("1", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "900", fill: 0x160b20
  });
  selNum.anchor.set(0.5); selNum.x = w - 14; selNum.y = 14;
  selNum.visible = false;
  card.addChild(selNum);
  card._bg = bg; card._selBadge = selBadge; card._selNum = selNum;
  return card;
}

function updateRosterCardVisual(card, divaId, isSelected, pickIdx) {
  card._bg.clear();
  if (isSelected) {
    card._bg.lineStyle(3, 0xf2c76e, 1);
    card._bg.beginFill(0x2a1a3a).drawRoundedRect(0, 0, card.width, card.height, 10).endFill();
  } else {
    card._bg.lineStyle(2, 0x3a2548, 1);
    card._bg.beginFill(0x1c0e2a).drawRoundedRect(0, 0, card.width, card.height, 10).endFill();
  }
  if (isSelected) {
    card._selBadge.visible = true;
    card._selNum.visible = true;
    card._selNum.text = String(pickIdx + 1);
  } else {
    card._selBadge.visible = false;
    card._selNum.visible = false;
  }
}

async function loadPhotoHolder(holder, divaId, sz) {
  // bg placeholder
  const ph = new PIXI.Graphics();
  ph.beginFill(0x2a1a3a).drawRoundedRect(0, 0, sz, sz, 6).endFill();
  holder.addChild(ph);
  try {
    const url = friendPhoto(divaId, Math.floor(Math.random() * 6));
    const tex = await PIXI.Assets.load(url);
    const sp = new PIXI.Sprite(tex);
    const scale = sz / Math.max(tex.width, tex.height);
    sp.scale.set(scale);
    sp.x = (sz - tex.width * scale) / 2;
    sp.y = (sz - tex.height * scale) / 2;
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff).drawRoundedRect(0, 0, sz, sz, 6).endFill();
    holder.addChild(mask);
    sp.mask = mask;
    holder.addChild(sp);
  } catch (e) {}
}
