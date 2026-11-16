// games/aunty-net.js — Aunty Network. A sportsbook for drama.
// 4 gossip scenarios stacked vertically. Each has 3 diva options with decimal
// odds (1.5x-8x). Player picks one diva per scenario, stakes bet per scenario,
// then resolves the drama. Payout = sum of (bet × odds) for correct picks;
// wrong picks lose their stake. Winner is weighted by inverse odds (favorite
// wins more often), so the odds actually mean something.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto, castToPhotoURL, castPick } from "../core/photos.js";
import { CAST_LIST } from "../core/app.js";

// Gossip scenario templates. storyFn takes the winning diva's first name.
const SCENARIOS = [
  { q: "Who showed up 40 min late to brunch?",
    story: w => `${w} arrived 40 minutes late. The excuse? "Traffic." There was no traffic.` },
  { q: "Who got engaged this week?",
    story: w => `${w} flashed the ring at the table. The fiancé was not there. Nobody asked.` },
  { q: "Who left the group chat without warning?",
    story: w => `${w} quietly exited the group chat. 17 people noticed. Nobody said a word.` },
  { q: "Whose ex just walked into the club?",
    story: w => `${w}'s ex walked in. ${w} pretended not to see. Then went to the bathroom. Twice.` },
  { q: "Who 'borrowed' an outfit and didn't return it?",
    story: w => `${w} was spotted in the missing outfit. She claimed it was "always hers."` },
  { q: "Who posted the blurry selfie that broke the algorithm?",
    story: w => `${w}'s blurry selfie got 12k likes. The algorithm favors mystery. Apparently.` },
  { q: "Who brought a +1 nobody invited?",
    story: w => `${w} brought a +1. The +1 brought a +1. Nobody knew either of them.` },
  { q: "Who ordered top-shelf whisky then vanished before the bill?",
    story: w => `${w} ordered the 18-year neat. Then "took a call." Never came back.` },
  { q: "Whose new boyfriend owns 3 duvet covers?",
    story: w => `${w}'s new boyfriend owns three duvets. None of them match. She's worried.` },
  { q: "Who cried at her own birthday?",
    story: w => `${w} cried at her own birthday. The cake said "30". She's 28.` },
  { q: "Whose story got more views than the bride's?",
    story: w => `${w} posted a wedding story. It got more views than the bride's. The bride saw.` },
  { q: "Who got caught liking a 3-year-old post?",
    story: w => `${w} liked a post from 2021. At 3am. The poster screenshotted it. Naturally.` }
];

const ODDS_FAV = [1.5, 1.8, 2.0, 2.5];
const ODDS_MID = [3.0, 3.5, 4.0, 5.0];
const ODDS_LNG = [6.0, 7.0, 8.0];

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
function cap(name) { return name.charAt(0).toUpperCase() + name.slice(1); }

function buildScenarioSet(n = 4) {
  const pool = shuffle([...DIVA_IDS]);
  const chosen = shuffle(SCENARIOS).slice(0, n);
  return chosen.map(s => {
    const divas = pool.splice(0, 3);
    const fav = pick(ODDS_FAV), mid = pick(ODDS_MID), lng = pick(ODDS_LNG);
    const odds = shuffle([fav, mid, lng]);
    return {
      q: s.q,
      storyFn: s.story,
      options: divas.map((id, i) => ({ id, name: cap(DIVAS[id].name), odds: odds[i] }))
    };
  });
}

// Pick winner index weighted by inverse odds — favorite wins more often,
// so a 1.5x pick is the safe bet, an 8x pick is the longshot.
function resolveScenario(scenario) {
  const weights = scenario.options.map(o => 1 / o.odds);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < scenario.options.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return scenario.options.length - 1;
}

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb || "Bet on the gossip. Resolve the drama.", {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  const resultText = new PIXI.Text("Pick one diva per scenario. Then resolve.", {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700", fill: 0xffe9b8,
    align: "center", wordWrap: true, wordWrapWidth: W - 16
  });
  resultText.anchor.set(0.5, 0); resultText.x = W / 2; resultText.y = 26;
  c.addChild(resultText);

  // dynamic card sizing so we adapt to whatever playfield height the host gives
  const topReserved = 48;     // tagline + result text + padding
  const bottomReserved = 108; // bet row + resolve button + small gap
  const gapTotal = 12;        // 3 inter-card gaps × 4px
  const cardH = Math.max(118, Math.floor((H - topReserved - bottomReserved - gapTotal) / 4));
  const cardW = W - 16;
  const cardX = 8;
  const cardStartY = topReserved + 2;

  const qH = 30;        // scenario question text area
  const payoutH = 16;   // payout / story summary line
  const optBtnH = cardH - qH - payoutH - 8;
  const optBtnW = (cardW - 16) / 3;     // 3 options with 4px gaps
  const photoSz = Math.min(60, Math.max(40, optBtnH - 34));

  // build scenario set + state
  let scenarios = buildScenarioSet(4);
  let picks = scenarios.map(() => -1);
  let winners = scenarios.map(() => -1);
  let resolved = false;
  let resolving = false;

  const cardContainers = [];
  buildCards();

  // bet row
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    if (resolving) return;
    curBet = [10, 25, 50, 100, 250][i];
    updateResolveBtn();
  }));

  // resolve button — shows total cost (4 × curBet)
  const resolveBtn = makeButton(W - 16, 50, resolveBtnLabel(), 0xf2c76e, 0x160b20);
  resolveBtn.x = 8; resolveBtn.y = H - 50;
  resolveBtn.interactive = true; resolveBtn.buttonMode = true;
  c.addChild(resolveBtn);

  function resolveBtnLabel() {
    return resolved ? "NEW DRAMA · " + (curBet * 4) : "RESOLVE · " + (curBet * 4);
  }
  function updateResolveBtn() {
    resolveBtn.children[1].text = resolveBtnLabel();
  }

  resolveBtn.on("pointertap", async () => {
    if (resolving) return;
    sfx.click();
    if (resolved) {
      // reset and rebuild
      scenarios = buildScenarioSet(4);
      picks = scenarios.map(() => -1);
      winners = scenarios.map(() => -1);
      resolved = false;
      // tear down old cards
      for (const cc of cardContainers) {
        cc.card.destroy({ children: true });
      }
      cardContainers.length = 0;
      buildCards();
      resultText.text = "Pick one diva per scenario. Then resolve.";
      resultText.style.fill = 0xffe9b8;
      updateResolveBtn();
      return;
    }
    if (picks.some(p => p < 0)) {
      host.toast("Pick one diva in each scenario first.", 1800);
      return;
    }
    const totalCost = curBet * 4;
    if (!store.bet(totalCost)) { host.toast(t("toast.betTooHigh")); return; }
    resolving = true;
    resolveBtn.interactive = false;
    resultText.text = "Resolving the drama...";
    resultText.style.fill = 0xffe9b8;
    sfx.whoosh();

    let totalPayout = 0;
    let correctCount = 0;
    for (let i = 0; i < scenarios.length; i++) {
      const winIdx = resolveScenario(scenarios[i]);
      winners[i] = winIdx;
      const playerIdx = picks[i];
      const playerCorrect = playerIdx === winIdx;
      const cc = cardContainers[i];
      const winOpt = scenarios[i].options[winIdx];

      // highlight winning option + mark player's pick
      for (let j = 0; j < cc.optionBtns.length; j++) {
        updateOptionVisual(
          cc.optionBtns[j], optBtnW, optBtnH,
          j === playerIdx, j === winIdx, true
        );
      }
      // story replaces the question (post-resolve narrative)
      cc.qText.text = scenarios[i].storyFn(winOpt.name);

      if (playerCorrect) {
        const win = Math.floor(curBet * winOpt.odds);
        totalPayout += win;
        correctCount++;
        cc.payoutTx.text = `✓ +${win}   (${winOpt.odds.toFixed(1)}x)`;
        cc.payoutTx.style.fill = 0x57d38f;
        sfx.pop();
      } else {
        cc.payoutTx.text = `✗ −${curBet}   (winner: ${winOpt.name} @ ${winOpt.odds.toFixed(1)}x)`;
        cc.payoutTx.style.fill = 0xff5d5d;
        sfx.bonk();
      }
      await wait(420);
    }

    const net = totalPayout - totalCost;
    store.pay(totalPayout);
    store.record(game.id, totalCost, totalPayout);
    resolved = true;
    resolving = false;
    resolveBtn.interactive = true;
    updateResolveBtn();

    if (net > 0) {
      resultText.text = `${correctCount}/4 right · +${net} chips`;
      let tier = "win";
      if (correctCount >= 3) tier = "big";
      if (correctCount === 4) tier = "mega";
      if (net >= curBet * 25) tier = "jackpot";
      try { sfx[tier](); } catch (e) { sfx.win(); }
      resultText.style.fill = 0x57d38f;
      host.onWin(tier, net, {
        title: `${correctCount}/4 correct`,
        line: "Drama resolved. The aunty network delivers."
      });
    } else if (net === 0) {
      resultText.text = `${correctCount}/4 right · broke even`;
      resultText.style.fill = 0xf2c76e;
      sfx.bonk();
    } else {
      resultText.text = `${correctCount}/4 right · −${-net} chips`;
      resultText.style.fill = 0xff5d5d;
      sfx.lose();
    }
  });

  // --- card builder ---
  function buildCards() {
    for (let i = 0; i < scenarios.length; i++) {
      const sc = scenarios[i];
      const card = new PIXI.Container();
      card.x = cardX; card.y = cardStartY + i * (cardH + 4);
      c.addChild(card);

      const cardBg = new PIXI.Graphics();
      cardBg.beginFill(0x1c0e2a).drawRoundedRect(0, 0, cardW, cardH, 10).endFill();
      cardBg.beginFill(0xff2e88, 0.55).drawRoundedRect(0, 0, cardW, 3, 1).endFill();
      card.addChild(cardBg);

      const qText = new PIXI.Text(sc.q, {
        fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700", fill: 0xffe9b8,
        wordWrap: true, wordWrapWidth: cardW - 16
      });
      qText.x = 8; qText.y = 6;
      card.addChild(qText);

      const payoutTx = new PIXI.Text("", {
        fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "700", fill: 0xf2c76e,
        wordWrap: true, wordWrapWidth: cardW - 16
      });
      payoutTx.x = 8; payoutTx.y = cardH - payoutH + 1;
      card.addChild(payoutTx);

      const optionBtns = [];
      const optY = qH + 4;
      for (let j = 0; j < 3; j++) {
        const opt = sc.options[j];
        const ob = makeOptionButton(optBtnW, optBtnH, opt, photoSz);
        ob.x = 4 + j * (optBtnW + 4);
        ob.y = optY;
        ob.interactive = true; ob.buttonMode = true;
        const scenarioIdx = i, optionIdx = j;
        ob.on("pointertap", () => selectOption(scenarioIdx, optionIdx));
        card.addChild(ob);
        optionBtns.push(ob);
      }

      cardContainers.push({ card, qText, payoutTx, optionBtns });
    }
  }

  function selectOption(scenarioIdx, optionIdx) {
    if (resolved || resolving) return;
    sfx.click();
    picks[scenarioIdx] = optionIdx;
    const cc = cardContainers[scenarioIdx];
    for (let j = 0; j < cc.optionBtns.length; j++) {
      updateOptionVisual(cc.optionBtns[j], optBtnW, optBtnH, j === optionIdx, false, false);
    }
  }

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

// --- module-level helpers ---

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "700", fill: fg, align: "center"
  });
  tx.anchor.set(0.5); tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}

function makeOptionButton(w, h, opt, photoSz) {
  const btn = new PIXI.Container();
  const bg = new PIXI.Graphics();
  drawOptionBg(bg, w, h, 0x2a1a3a, 0x000000, 0);
  btn.addChild(bg);
  // photo holder (photo loads async)
  const photoHolder = new PIXI.Container();
  photoHolder.x = (w - photoSz) / 2; photoHolder.y = 4;
  btn.addChild(photoHolder);
  // name
  const nameTx = new PIXI.Text(opt.name, {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700", fill: 0xffe9b8,
    align: "center", wordWrap: true, wordWrapWidth: w - 4
  });
  nameTx.anchor.set(0.5, 0); nameTx.x = w / 2; nameTx.y = photoSz + 6;
  btn.addChild(nameTx);
  // odds
  const oddsTx = new PIXI.Text(opt.odds.toFixed(1) + "x", {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "900", fill: 0xf2c76e
  });
  oddsTx.anchor.set(0.5, 0); oddsTx.x = w / 2; oddsTx.y = photoSz + 22;
  btn.addChild(oddsTx);

  btn._bg = bg; btn._nameTx = nameTx; btn._oddsTx = oddsTx;
  loadOptionPhoto(opt, photoHolder, photoSz);
  return btn;
}

async function loadOptionPhoto(opt, holder, sz) {
  try {
    const url = friendPhoto(opt.id, Math.floor(Math.random() * 6));
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

function drawOptionBg(g, w, h, fillCol, strokeCol, strokeW) {
  g.clear();
  if (strokeW > 0) g.lineStyle(strokeW, strokeCol, 1);
  g.beginFill(fillCol).drawRoundedRect(0, 0, w, h, 8).endFill();
}

// Updates an option button's background + label colors based on state.
// State matrix:
//   selected (pre-resolve)        → gold fill + gold border + dark text
//   winning && isResolved         → dark green fill + bright green border + green odds
//   player's wrong pick && isRes. → dark red fill + red border + red odds
//   default                       → muted purple fill + cream text
function updateOptionVisual(btn, w, h, isSelected, isWinning, isResolved) {
  let fillCol = 0x2a1a3a, strokeCol = 0x000000, strokeW = 0;
  let nameCol = 0xffe9b8, oddsCol = 0xf2c76e;

  if (isResolved) {
    if (isWinning) {
      fillCol = 0x1a3a26; strokeCol = 0x57d38f; strokeW = 3;
      oddsCol = 0x57d38f; nameCol = 0x57d38f;
    } else if (isSelected) {
      // player's wrong pick
      fillCol = 0x3a1a1a; strokeCol = 0xff5d5d; strokeW = 2;
      oddsCol = 0xff5d5d; nameCol = 0xff8a8a;
    }
  } else if (isSelected) {
    fillCol = 0xf2c76e; strokeCol = 0xf2c76e; strokeW = 2;
    nameCol = 0x160b20; oddsCol = 0x160b20;
  }

  drawOptionBg(btn._bg, w, h, fillCol, strokeCol, strokeW);
  btn._nameTx.style.fill = nameCol;
  btn._oddsTx.style.fill = oddsCol;
}
