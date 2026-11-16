// games/call-break.js — Call Break (Nepali trick-taking).
// 4 players (you + 3 AI divas). One hand of 5 tricks. Spades are trump.
// Before play, each player calls how many tricks they'll win (1–5).
// Player to the left of dealer leads. Must follow suit if possible; if void, anything (incl. trump).
// Highest of led suit wins, unless trumped — then highest trump wins. Trick winner leads next.
// Scoring: exact call = +call; overtrick = +call + 0.1 each; undertrick = -call.
// After 5 tricks: player wins outright → +bet*2 (paid bet*3 back); ties an AI → +bet*0.5
// (paid bet*1.5 back); loses → −bet.

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
const TRUMP = "♠";

function newDeck() {
  const d = [];
  for (const su of SUITS) for (const r of RANKS) d.push({ r, s:su.s, red:su.red });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function divaName(id) {
  return DIVAS[id]?.name || id.charAt(0).toUpperCase() + id.slice(1);
}
function cardWoman(r) {
  if (COURT_FACES[r]) return COURT_FACES[r];
  return SESSION.cardFaces[r]?.id || "ann";
}
function cardPhotoURL(r) {
  return friendPhoto(cardWoman(r), Math.floor(Math.random() * 6));
}

// AI call heuristic: trumps + half the high cards, with small noise.
function aiCall(hand) {
  const trumps = hand.filter(c => c.s === TRUMP).length;
  const high = hand.filter(c => ["A","K","Q","J"].includes(c.r)).length;
  let call = trumps + Math.ceil(high / 2);
  if (Math.random() < 0.4) call += 1;
  return Math.max(1, Math.min(5, call));
}

// AI card choice. If tricks already made, dump lowest legal; else try to win with highest.
function aiChooseCard(player, ledSuit) {
  const hasLed = ledSuit && player.hand.some(c => c.s === ledSuit);
  const legal = hasLed ? player.hand.filter(c => c.s === ledSuit) : [...player.hand];
  if (player.tricksWon >= player.call) {
    legal.sort((a,b) => RANK_VAL[a.r] - RANK_VAL[b.r]);  // lowest
  } else {
    legal.sort((a,b) => RANK_VAL[b.r] - RANK_VAL[a.r]);  // highest
  }
  return legal[0];
}

// Resolve trick: highest trump if any (and led suit wasn't trump), else highest of led suit.
function resolveTrick(trick, ledSuit) {
  if (ledSuit !== TRUMP) {
    const trumps = trick.filter(t => t.card.s === TRUMP);
    if (trumps.length > 0) {
      trumps.sort((a,b) => RANK_VAL[b.card.r] - RANK_VAL[a.card.r]);
      return trick.indexOf(trumps[0]);
    }
  }
  const led = trick.filter(t => t.card.s === ledSuit);
  led.sort((a,b) => RANK_VAL[b.card.r] - RANK_VAL[a.card.r]);
  return trick.indexOf(led[0]);
}

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
  let phase = "idle";   // idle | calling | playing | done
  let players = [];     // 4 players: 0=player(south), 1=left(west), 2=top(north), 3=right(east)
  let dealerIdx = 0;
  let leadIdx = 0;
  let currentTrick = [];
  let ledSuit = null;
  let trickNum = 0;
  let playerResolve = null;   // deferred promise for player card tap

  // --- AI diva panels (top row) ---
  const aiIds = shuffle(DIVA_IDS).slice(0, 3);
  const aiPanels = [];
  const panelW = 120, panelH = 84;
  const panelY = 20;
  // layout: left panel, center panel, right panel
  const panelXs = [
    8,
    Math.floor((W - panelW) / 2),
    W - panelW - 8
  ];
  // map: AI1=west(left panel idx 0), AI2=north(center panel idx 1), AI3=east(right panel idx 2)
  // player indices: 0=south(player), 1=west, 2=north, 3=east
  // so panel index = playerIdx - 1 (for AI players 1,2,3)
  for (let i = 0; i < 3; i++) {
    const panel = makePlayerPanel(panelW, panelH, aiIds[i]);
    panel.x = panelXs[i]; panel.y = panelY;
    c.addChild(panel);
    aiPanels.push(panel);
  }

  // --- trick area (center) ---
  const trickCenterY = panelY + panelH + 90;   // ~194
  const trickCx = W / 2;
  const trickCardW = 64, trickCardH = 90;
  const trickContainer = new PIXI.Container();
  c.addChild(trickContainer);

  // positions for each player's card in the trick (in trick area local coords)
  const trickPositions = [
    { x: trickCx - trickCardW/2,            y: trickCenterY + 6 },         // 0 south (player, below)
    { x: trickCx - trickCardW - 4,          y: trickCenterY - trickCardH/2 }, // 1 west
    { x: trickCx - trickCardW/2,            y: trickCenterY - trickCardH - 6 }, // 2 north
    { x: trickCx + 4,                       y: trickCenterY - trickCardH/2 }  // 3 east
  ];

  // winner highlight ring
  const winnerRing = new PIXI.Graphics();
  winnerRing.visible = false;
  c.addChild(winnerRing);
  function showWinnerRing(playerIdx) {
    winnerRing.clear();
    winnerRing.visible = true;
    let cx, cy, w, h;
    if (playerIdx === 0) {
      cx = W/2; cy = H - 200 + 49; w = W - 16; h = 98;
    } else {
      const panel = aiPanels[playerIdx - 1];
      cx = panel.x + panelW/2; cy = panel.y + panelH/2; w = panelW; h = panelH;
    }
    winnerRing.lineStyle(3, 0xf2c76e, 0.9).drawRoundedRect(cx - w/2 - 3, cy - h/2 - 3, w + 6, h + 6, 12);
  }
  function hideWinnerRing() { winnerRing.visible = false; }

  // --- player info text (above hand) ---
  const playerStatusY = H - 220;
  const playerStatus = new PIXI.Text("", {
    fontFamily: "Outfit", fontSize: 12, fontWeight: "700", fill: 0xf2c76e, align: "center"
  });
  playerStatus.anchor.set(0.5, 0); playerStatus.x = W / 2; playerStatus.y = playerStatusY;
  c.addChild(playerStatus);

  // --- player hand (bottom) ---
  const handY = H - 200;
  const handCardW = 64, handCardH = 90;
  const handGap = 6;
  const handTotalW = 5 * handCardW + 4 * handGap;
  const handStartX = Math.floor((W - handTotalW) / 2);
  const playerHandContainer = new PIXI.Container();
  playerHandContainer.y = handY;
  c.addChild(playerHandContainer);

  // --- player call badge (under hand status) ---
  const playerCallBadge = new PIXI.Text("", {
    fontFamily: "Outfit", fontSize: 11, fontWeight: "700", fill: 0xffe9b8
  });
  playerCallBadge.anchor.set(0.5, 0); playerCallBadge.x = W/2; playerCallBadge.y = handY + handCardH + 4;
  c.addChild(playerCallBadge);

  // --- bet row ---
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    if (phase !== "idle") return;
    curBet = BET_LEVELS[i];
    dealBtn.children[1].text = t("common.deal") + " · " + curBet;
  }));

  // --- deal button ---
  const dealBtn = makeButton(W - 16, 50, t("common.deal") + " · " + curBet, 0xf2c76e, 0x160b20);
  dealBtn.x = 8; dealBtn.y = H - 50;
  dealBtn.interactive = true; dealBtn.buttonMode = true;
  c.addChild(dealBtn);

  // --- call buttons row (replaces deal button area when calling) ---
  const callBtnW = (W - 16 - 4 * 6) / 5;   // 5 buttons, 6px gap
  const callBtns = [];
  for (let i = 0; i < 5; i++) {
    const b = makeButton(callBtnW, 50, String(i + 1), 0x57d38f, 0x160b20);
    b.x = 8 + i * (callBtnW + 6); b.y = H - 50;
    b.interactive = true; b.buttonMode = true; b.visible = false;
    c.addChild(b);
    b.on("pointertap", () => onPlayerCall(i + 1));
    callBtns.push(b);
  }
  const callPrompt = new PIXI.Text("CALL YOUR TRICKS (1–5)", {
    fontFamily: "Outfit", fontSize: 12, fontWeight: "700", fill: 0xffe9b8, align: "center"
  });
  callPrompt.anchor.set(0.5, 0); callPrompt.x = W/2; callPrompt.y = H - 122;
  callPrompt.visible = false;
  c.addChild(callPrompt);

  function setBottom(mode) {
    // mode: "deal" | "call" | "playing" | "done"
    if (mode === "deal") {
      dealBtn.visible = true; dealBtn.interactive = true;
      callPrompt.visible = false;
      callBtns.forEach(b => b.visible = false);
    } else if (mode === "call") {
      dealBtn.visible = false;
      callPrompt.visible = true;
      callBtns.forEach(b => b.visible = true);
    } else {
      dealBtn.visible = false;
      callPrompt.visible = false;
      callBtns.forEach(b => b.visible = false);
    }
  }

  // --- helper: render small card sprite ---
  function makeSmallCard(card, w, h) {
    const g = new PIXI.Container();
    const bg2 = new PIXI.Graphics();
    bg2.lineStyle(1, 0xf2c76e, 0.4);
    bg2.beginFill(0xffe9b8).drawRoundedRect(0, 0, w, h, 5).endFill();
    g.addChild(bg2);
    const rankColor = card.red ? 0xff5d5d : 0x160b20;
    const r1 = new PIXI.Text(card.r, { fontFamily:"Outfit", fontSize: 12, fontWeight:"900", fill: rankColor });
    r1.x = 3; r1.y = 2; g.addChild(r1);
    const s1 = new PIXI.Text(card.s, { fontFamily:"Outfit", fontSize:12, fill: rankColor });
    s1.x = 3; s1.y = 16; g.addChild(s1);
    // small photo
    try {
      const url = cardPhotoURL(card.r);
      PIXI.Assets.load(url).then(tex => {
        const sp = new PIXI.Sprite(tex);
        const sz = w - 6;
        const scale = sz / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = (w - tex.width * scale) / 2;
        sp.y = (h - tex.height * scale) / 2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(3, 22, w - 6, h - 28, 3).endFill();
        g.addChild(mask);
        sp.mask = mask;
        g.addChild(sp);
      }).catch(() => {});
    } catch(e) {}
    return g;
  }

  // --- AI panel renderer ---
  function makePlayerPanel(w, h, divaId) {
    const panel = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.lineStyle(1, 0xf2c76e, 0.3).beginFill(0x1c0e2a, 0.85).drawRoundedRect(0, 0, w, h, 8).endFill();
    panel.addChild(g);
    // avatar circle
    const avSize = 32;
    const avMask = new PIXI.Graphics();
    avMask.beginFill(0xffffff).drawCircle(avSize/2 + 6, avSize/2 + 6, avSize/2).endFill();
    panel.addChild(avMask);
    const avUrl = friendPhoto(divaId, Math.floor(Math.random() * 6));
    PIXI.Assets.load(avUrl).then(tex => {
      const sp = new PIXI.Sprite(tex);
      const sz = avSize;
      const scale = sz / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.x = 6 + (avSize - tex.width * scale) / 2;
      sp.y = 6 + (avSize - tex.height * scale) / 2;
      sp.mask = avMask;
      panel.addChild(sp);
    }).catch(() => {});
    // name
    const name = new PIXI.Text(divaName(divaId), {
      fontFamily: "Outfit", fontSize: 11, fontWeight: "700", fill: 0xffe9b8
    });
    name.x = avSize + 12; name.y = 6;
    panel.addChild(name);
    // call badge
    const callTx = new PIXI.Text("CALL: —", {
      fontFamily: "Outfit", fontSize: 11, fontWeight: "700", fill: 0xf2c76e
    });
    callTx.x = avSize + 12; callTx.y = 22;
    panel.addChild(callTx);
    // tricks won
    const wonTx = new PIXI.Text("WON: 0", {
      fontFamily: "Outfit", fontSize: 11, fontWeight: "700", fill: 0xffe9b8
    });
    wonTx.x = avSize + 12; wonTx.y = 38;
    panel.addChild(wonTx);
    // hand size (small)
    const handTx = new PIXI.Text("cards: 0", {
      fontFamily: "Outfit", fontSize:12, fill: 0xb0b0b0
    });
    handTx.x = avSize + 12; handTx.y = 54;
    panel.addChild(handTx);
    panel._callTx = callTx;
    panel._wonTx = wonTx;
    panel._handTx = handTx;
    return panel;
  }

  function updateAIPanel(playerIdx) {
    if (playerIdx === 0) {
      playerCallBadge.text = "CALL: " + players[0].call + "  ·  WON: " + players[0].tricksWon;
      return;
    }
    const panel = aiPanels[playerIdx - 1];
    const p = players[playerIdx];
    panel._callTx.text = "CALL: " + p.call;
    panel._wonTx.text = "WON: " + p.tricksWon;
    panel._handTx.text = "cards: " + p.hand.length;
  }

  // --- player hand render ---
  function renderPlayerHand(highlightLegal = false) {
    playerHandContainer.removeChildren();
    const p = players[0];
    if (!p) return;
    p.hand.forEach((card, i) => {
      const cardGfx = makeSmallCard(card, handCardW, handCardH);
      cardGfx.x = handStartX + i * (handCardW + handGap);
      cardGfx.y = 0;
      // determine legality
      let legal = true;
      if (highlightLegal && ledSuit) {
        const hasLed = p.hand.some(c => c.s === ledSuit);
        if (hasLed && card.s !== ledSuit) legal = false;
      }
      if (!legal) {
        cardGfx.alpha = 0.35;
      } else if (highlightLegal) {
        cardGfx.interactive = true;
        cardGfx.buttonMode = true;
        cardGfx.on("pointertap", () => onPlayerCardTap(card));
      }
      playerHandContainer.addChild(cardGfx);
    });
  }

  // --- trick card render ---
  function renderTrickCard(playerIdx, card) {
    const pos = trickPositions[playerIdx];
    const g = makeSmallCard(card, trickCardW, trickCardH);
    g.x = pos.x; g.y = pos.y;
    trickContainer.addChild(g);
  }

  // --- deal handler ---
  dealBtn.on("pointertap", async () => {
    if (phase !== "idle") return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    // reset
    trickContainer.removeChildren();
    hideWinnerRing();
    playerStatus.text = "";
    // build players
    players = [
      { id:"you", name:"YOU", isPlayer:true, hand:[], call:0, tricksWon:0, score:0 },
      { id:aiIds[0], name:divaName(aiIds[0]), isPlayer:false, hand:[], call:0, tricksWon:0, score:0 },
      { id:aiIds[1], name:divaName(aiIds[1]), isPlayer:false, hand:[], call:0, tricksWon:0, score:0 },
      { id:aiIds[2], name:divaName(aiIds[2]), isPlayer:false, hand:[], call:0, tricksWon:0, score:0 }
    ];
    // deal 5 cards each
    const deck = newDeck();
    for (let i = 0; i < 5; i++) {
      for (let p = 0; p < 4; p++) {
        players[p].hand.push(deck.pop());
      }
    }
    // sort player's hand by suit then rank
    const suitOrder = { "♠":0, "♥":1, "♦":2, "♣":3 };
    players[0].hand.sort((a,b) => {
      if (a.s !== b.s) return suitOrder[a.s] - suitOrder[b.s];
      return RANK_VAL[b.r] - RANK_VAL[a.r];
    });
    // dealer rotates each round (random for variety)
    dealerIdx = Math.floor(Math.random() * 4);
    // player to left of dealer leads
    leadIdx = (dealerIdx + 1) % 4;
    trickNum = 0;
    currentTrick = []; ledSuit = null;
    // compute AI calls
    for (let i = 1; i < 4; i++) players[i].call = aiCall(players[i].hand);
    // update panels
    for (let i = 0; i < 4; i++) updateAIPanel(i);
    // show player hand
    renderPlayerHand(false);
    // enter calling phase
    phase = "calling";
    setBottom("call");
    playerStatus.text = "Make your call.";
  });

  function onPlayerCall(callVal) {
    if (phase !== "calling") return;
    sfx.click();
    players[0].call = callVal;
    updateAIPanel(0);
    phase = "playing";
    setBottom("playing");
    // start the trick loop
    runHand();
  }

  async function runHand() {
    let nextLead = leadIdx;
    for (trickNum = 1; trickNum <= 5; trickNum++) {
      await playTrick(nextLead);
      // nextLead = winner of last trick
      nextLead = resolveTrick(currentTrick, ledSuit);
      players[nextLead].tricksWon++;
      updateAIPanel(nextLead);
      showWinnerRing(nextLead);
      sfx.win();
      await wait(900);
      hideWinnerRing();
      // clear trick area
      trickContainer.removeChildren();
      currentTrick = []; ledSuit = null;
      renderPlayerHand(false);
      await wait(250);
    }
    // tally scores
    for (const p of players) {
      if (p.tricksWon === p.call) p.score = p.call;
      else if (p.tricksWon > p.call) p.score = p.call + 0.1 * (p.tricksWon - p.call);
      else p.score = -p.call;
    }
    finishHand();
  }

  async function playTrick(leadIdxArg) {
    let curIdx = leadIdxArg;
    ledSuit = null;
    // if player leads, enable their hand
    for (let i = 0; i < 4; i++) {
      const p = players[curIdx];
      let card;
      if (p.isPlayer) {
        playerStatus.text = `Trick ${trickNum}/5 · Your turn.`;
        renderPlayerHand(true);
        card = await waitForPlayerCard();
        playerStatus.text = "";
      } else {
        playerStatus.text = `Trick ${trickNum}/5 · ${p.name} thinking…`;
        await wait(650 + Math.random() * 400);
        card = aiChooseCard(p, ledSuit);
      }
      // remove from hand
      const ci = p.hand.indexOf(card);
      p.hand.splice(ci, 1);
      // add to trick
      currentTrick.push({ player: p, card });
      if (i === 0) ledSuit = card.s;
      renderTrickCard(curIdx, card);
      sfx.card();
      // after a play, disable the player's hand taps until next turn
      if (p.isPlayer) renderPlayerHand(false);
      updateAIPanel(curIdx);
      curIdx = (curIdx + 1) % 4;
    }
  }

  function waitForPlayerCard() {
    renderPlayerHand(true);
    // re-render with legality based on ledSuit (already done)
    return new Promise(resolve => { playerResolve = resolve; });
  }

  function onPlayerCardTap(card) {
    if (!playerResolve) return;
    // verify legal
    const p = players[0];
    if (ledSuit) {
      const hasLed = p.hand.some(c => c.s === ledSuit);
      if (hasLed && card.s !== ledSuit) return;  // illegal, ignore
    }
    sfx.click();
    const r = playerResolve;
    playerResolve = null;
    r(card);
  }

  function finishHand() {
    phase = "done";
    // determine result
    const playerScore = players[0].score;
    const oppScores = [1,2,3].map(i => players[i].score);
    const maxOpp = Math.max(...oppScores);
    let payout = 0, tier = "lose", title = "", line = "";
    if (playerScore > maxOpp) {
      payout = curBet * 3;   // bet*3 returned (net +2x)
      tier = playerScore >= 4 ? "big" : "win";
      title = "You took the pot!";
      line = `You ${playerScore.toFixed(1)} · best opp ${maxOpp.toFixed(1)}.`;
      sfx.big();
    } else if (playerScore === maxOpp) {
      payout = Math.floor(curBet * 1.5);  // bet*1.5 returned (net +0.5x)
      tier = "win";
      title = "Tied at the top.";
      line = `You ${playerScore.toFixed(1)} · opp ${maxOpp.toFixed(1)}.`;
      sfx.win();
    } else {
      payout = 0;
      tier = "lose";
      title = "You lost the pot.";
      line = `You ${playerScore.toFixed(1)} · best opp ${maxOpp.toFixed(1)}.`;
      sfx.lose();
    }
    if (payout > 0) store.pay(payout);
    store.record(game.id, curBet, payout);
    const profit = payout - curBet;
    playerStatus.text = `${title}  ${line}  ${profit > 0 ? "+" + profit : profit < 0 ? "−" + (-profit) : "0"} chips`;
    if (tier !== "lose") host.onWin(tier, profit, { title, line });
    setBottom("deal");
    dealBtn.children[1].text = t("common.deal") + " · " + curBet;
    phase = "idle";
  }

  setBottom("deal");

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => {
    pixiApp.ticker.remove(tickerFn);
    if (playerResolve) { const r = playerResolve; playerResolve = null; r(null); }
  };
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit", fontSize: 14, fontWeight: "700", fill: fg, align: "center"
  });
  tx.anchor.set(0.5); tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}
