// games/crazy-time.js — Diva Time. Crazy Time-style game show.
// 16-segment wheel: 12 cash segments (1/2/5/10) + 4 bonus segments (Cash Hunt, Coin Flip,
// Pachinko, Diva Show). Player bets on a segment label (1x, 2x, 5x, or BONUS). Wheel spins.
// Cash land pays bet * value. Bonus land (only on BONUS bet) enters a mini-game; total
// win = bet * 2 (base) * mini-game multiplier.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { EX, DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto, castToPhotoURL, castPick } from "../core/photos.js";
import { CAST_LIST } from "../core/app.js";

// ----- Wheel layout (16 segments) -----
const SEG_COUNT = 16;
// 4 bonus segments at evenly-spaced positions; remaining 12 are cash.
const BONUS_POSITIONS = [0, 4, 8, 12];
const BONUS_IDS = ["cashHunt", "coinFlip", "pachinko", "divaShow"];
const BONUS_NAMES = {
  cashHunt: "CASH HUNT",
  coinFlip: "COIN FLIP",
  pachinko: "PACHINKO",
  divaShow: "DIVA SHOW",
};
// 12 cash segments: 5 ones, 4 twos, 2 fives, 1 ten
const CASH_VALUES = [1, 1, 1, 1, 1, 2, 2, 2, 2, 5, 5, 10];

const BET_AMOUNTS = [10, 25, 50, 100, 250];
const SEG_BET_LABELS = ["1", "2", "5", "bonus"];
const SEG_BET_NAMES = ["1x", "2x", "5x", "BONUS"];
const SEG_BET_COLORS = [0x57d38f, 0xf2c76e, 0xff2e88, 0xd946ef];

// Bonus base multiplier (every bonus segment is worth x2 of the bet on top of mini-game win)
const BONUS_BASE_MULT = 2;

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  // ===== background =====
  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  for (let i = 0; i < H; i += 4) {
    const a = 0.04 + (i / H) * 0.08;
    bg.beginFill(0x9d4edd, a).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb || "", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // ===== state =====
  let curBet = 25;
  let selectedBet = "1";        // "1" | "2" | "5" | "bonus"
  let spinning = false;
  let bonusActive = false;
  let spinStart = 0;
  let spinDuration = 5000;
  let startRotation = 0;
  let targetRotation = 0;
  const tickersToCleanup = [];

  // ===== build segment data =====
  const segData = [];
  {
    let ci = 0, bi = 0;
    for (let i = 0; i < SEG_COUNT; i++) {
      if (BONUS_POSITIONS.includes(i)) {
        const bonusId = BONUS_IDS[bi % BONUS_IDS.length];
        bi++;
        segData.push({ kind: "bonus", bonusId, name: BONUS_NAMES[bonusId], value: BONUS_BASE_MULT });
      } else {
        segData.push({ kind: "cash", value: CASH_VALUES[ci % CASH_VALUES.length] });
        ci++;
      }
    }
  }

  // ===== wheel geometry =====
  const wheelSize = Math.min(W - 24, H - 340);
  const wheelCx = W / 2;
  const wheelCy = 50 + wheelSize / 2;
  const wheelR = wheelSize / 2;
  const segAngle = (Math.PI * 2) / SEG_COUNT;
  const photoR = wheelR * 0.78;
  const photoSize = wheelR * 0.24;
  const labelR = wheelR * 0.95;

  // cast members per segment (random from CAST_LIST, allow repeats)
  const segCasts = [];
  const usedKeys = new Set();
  for (let i = 0; i < SEG_COUNT; i++) {
    const cast = castPick(CAST_LIST, usedKeys);
    usedKeys.add(cast.key);
    segCasts.push(cast);
  }

  const wheelContainer = new PIXI.Container();
  wheelContainer.x = wheelCx;
  wheelContainer.y = wheelCy;
  c.addChild(wheelContainer);

  // outer gold ring
  const outerRing = new PIXI.Graphics();
  outerRing.lineStyle(6, 0xf2c76e, 1)
    .beginFill(0x1c0e2a, 0)
    .drawCircle(0, 0, wheelR + 4)
    .endFill();
  outerRing.x = wheelCx; outerRing.y = wheelCy;
  c.addChild(outerRing);

  // build segments (background wedges + photos + labels)
  const segContainers = [];
  for (let i = 0; i < SEG_COUNT; i++) {
    const seg = segData[i];
    const a0 = i * segAngle - Math.PI / 2 - segAngle / 2;
    const a1 = a0 + segAngle;

    // wedge background
    const segBg = new PIXI.Graphics();
    const baseColor = seg.kind === "bonus"
      ? (i % 8 === 0 ? 0x4a0e2a : 0x2a0e3a)
      : (i % 2 === 0 ? 0x1c0e2a : 0x2b1a06);
    segBg.lineStyle(2, 0xf2c76e, 0.7);
    segBg.beginFill(baseColor);
    segBg.moveTo(0, 0);
    segBg.arc(0, 0, wheelR, a0, a1);
    segBg.closePath();
    segBg.endFill();
    wheelContainer.addChild(segBg);

    // photo at midpoint of segment, near outer edge
    const midA = (a0 + a1) / 2;
    const px = Math.cos(midA) * photoR;
    const py = Math.sin(midA) * photoR;
    const cast = segCasts[i];
    const photoUrl = castToPhotoURL(cast);
    PIXI.Assets.load(photoUrl).then(tex => {
      if (!tex || wheelContainer.destroyed) return;
      const sp = new PIXI.Sprite(tex);
      const scale = photoSize / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5);
      sp.x = px; sp.y = py;
      sp.rotation = 0;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawCircle(px, py, photoSize / 2).endFill();
      wheelContainer.addChild(mask);
      sp.mask = mask;
      wheelContainer.addChild(sp);
      // gold ring around photo
      const ring = new PIXI.Graphics();
      ring.lineStyle(2, 0xf2c76e, 0.8)
        .beginFill(0x1c0e2a, 0)
        .drawCircle(px, py, photoSize / 2 + 1)
        .endFill();
      wheelContainer.addChild(ring);
    }).catch(() => {});

    // label at very outer edge
    const lx = Math.cos(midA) * labelR;
    const ly = Math.sin(midA) * labelR;
    const labelText = seg.kind === "bonus" ? seg.name : (seg.value + "x");
    const labelColor = seg.kind === "bonus" ? 0xff2e88 : 0xffe9b8;
    const lt = new PIXI.Text(labelText, {
      fontFamily: "Outfit, sans-serif",
      fontSize: seg.kind === "bonus" ? 11 : 14,
      fontWeight: "900",
      fill: labelColor,
      stroke: 0x160b20,
      strokeThickness: 2,
      align: "center",
      wordWrap: false,
    });
    lt.anchor.set(0.5);
    lt.x = lx; lt.y = ly;
    lt.rotation = midA + Math.PI / 2;
    wheelContainer.addChild(lt);

    segContainers.push({ angle0: a0, angle1: a1, seg, cast });
  }

  // center hub
  const hubContainer = new PIXI.Container();
  hubContainer.x = wheelCx;
  hubContainer.y = wheelCy;
  c.addChild(hubContainer);
  const hubBg = new PIXI.Graphics();
  hubBg.beginFill(0xf2c76e).drawCircle(0, 0, wheelR * 0.26).endFill();
  hubBg.beginFill(0x160b20).drawCircle(0, 0, wheelR * 0.24).endFill();
  hubContainer.addChild(hubBg);
  const hubText = new PIXI.Text("SPIN", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0xf2c76e
  });
  hubText.anchor.set(0.5);
  hubContainer.addChild(hubText);

  // pointer (at top, pointing down into wheel)
  const pointer = new PIXI.Graphics();
  pointer.beginFill(0xff2e88).drawPolygon([
    wheelCx, wheelCy - wheelR - 4,
    wheelCx - 14, wheelCy - wheelR - 28,
    wheelCx + 14, wheelCy - wheelR - 28
  ]).endFill();
  pointer.beginFill(0xffe9b8).drawCircle(wheelCx, wheelCy - wheelR - 20, 5).endFill();
  c.addChild(pointer);

  // ===== result text (below wheel) =====
  const resultText = new PIXI.Text("", {
    fontFamily: "Outfit, sans-serif",
    fontSize: 16, fontWeight: "900", fill: 0xffe9b8,
    stroke: 0x160b20, strokeThickness: 3,
    align: "center", wordWrap: true, wordWrapWidth: W - 16
  });
  resultText.anchor.set(0.5, 0);
  resultText.x = W / 2;
  resultText.y = wheelCy + wheelR + 16;
  c.addChild(resultText);

  // ===== segment bet pills (4 options) =====
  const segBetRow = new PIXI.Container();
  segBetRow.x = 8;
  segBetRow.y = wheelCy + wheelR + 60;
  c.addChild(segBetRow);
  const segPills = [];
  const segPillW = Math.floor((W - 16 - 18) / 4); // 4 pills, 6px gaps
  const segPillH = 56;
  for (let i = 0; i < 4; i++) {
    const label = SEG_BET_NAMES[i];
    const bet = SEG_BET_LABELS[i];
    const color = SEG_BET_COLORS[i];
    const isActive = selectedBet === bet;
    const pill = makeSegPill(segPillW, segPillH, label, color, isActive);
    pill.x = i * (segPillW + 6);
    pill.y = 0;
    pill.interactive = true;
    pill.buttonMode = true;
    pill.on("pointertap", () => {
      if (spinning || bonusActive) return;
      sfx.click();
      selectedBet = bet;
      segPills.forEach((p, j) => {
        const on = SEG_BET_LABELS[j] === selectedBet;
        p.children[0].clear();
        p.children[0].beginFill(on ? SEG_BET_COLORS[j] : 0x1c0e2a)
          .lineStyle(2, SEG_BET_COLORS[j], on ? 1 : 0.5)
          .drawRoundedRect(0, 0, segPillW, segPillH, 10)
          .endFill();
        p.children[1].style.fill = on ? 0x160b20 : 0xffe9b8;
      });
      updateSpinBtn();
    });
    segBetRow.addChild(pill);
    segPills.push(pill);
  }

  // ===== bet amount row =====
  const betRow = host.betRow(curBet);
  betRow.x = 8;
  betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    if (spinning || bonusActive) return;
    curBet = BET_AMOUNTS[i];
    updateSpinBtn();
  }));

  // ===== spin button =====
  const spinBtn = makeButton(W - 16, 60, spinLabel(), 0xf2c76e, 0x160b20);
  spinBtn.x = 8;
  spinBtn.y = H - 50;
  spinBtn.interactive = true;
  spinBtn.buttonMode = true;
  c.addChild(spinBtn);

  function spinLabel() {
    return `SPIN · ${curBet} on ${selectedBet === "bonus" ? "BONUS" : selectedBet + "x"}`;
  }
  function updateSpinBtn() {
    spinBtn.children[1].text = spinLabel();
  }

  spinBtn.on("pointertap", () => {
    sfx.click();
    if (spinning || bonusActive) return;
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    startSpin();
  });

  // ===== bonus layer (above everything; empty when not in bonus) =====
  const bonusLayer = new PIXI.Container();
  c.addChild(bonusLayer);

  // ===== spin logic =====
  function startSpin() {
    spinning = true;
    spinStart = performance.now();
    startRotation = wheelContainer.rotation;
    const extra = Math.random() * Math.PI * 2;
    targetRotation = startRotation + Math.PI * 2 * (5 + Math.random() * 3) + extra;
    sfx.whoosh();
    resultText.text = "";
    hubContainer.removeChildren();
    hubContainer.addChild(hubBg);
    hubContainer.addChild(hubText);
    hubText.text = "...";
  }

  const tickerFn = (dt) => {
    if (!spinning) return;
    const now = performance.now();
    const elapsed = now - spinStart;
    const tt = Math.min(1, elapsed / spinDuration);
    const eased = 1 - Math.pow(1 - tt, 3);
    wheelContainer.rotation = startRotation + (targetRotation - startRotation) * eased;
    if (Math.random() < 0.05 && tt > 0.7) sfx.tick();
    if (tt >= 1) {
      spinning = false;
      onWheelStopped();
    }
  };
  pixiApp.ticker.add(tickerFn);
  tickersToCleanup.push(tickerFn);

  async function onWheelStopped() {
    // compute winning segment (reuse wheel.js logic)
    const finalRot = ((wheelContainer.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const targetAngle = (-Math.PI / 2 - finalRot + Math.PI * 2) % (Math.PI * 2);
    let winner = 0;
    let bestDist = Infinity;
    for (let i = 0; i < segContainers.length; i++) {
      const mid = (segContainers[i].angle0 + segContainers[i].angle1) / 2;
      const normMid = ((mid % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const d = Math.min(Math.abs(normMid - targetAngle), Math.PI * 2 - Math.abs(normMid - targetAngle));
      if (d < bestDist) { bestDist = d; winner = i; }
    }
    const seg = segContainers[winner].seg;
    const cast = segContainers[winner].cast;

    // show winning segment photo in hub
    showHubWinner(cast, seg);

    if (seg.kind === "cash") {
      // cash land: pays only if bet matches value (the 10x segment never matches any pill — teaser)
      if (selectedBet === String(seg.value)) {
        const win = curBet * seg.value;
        store.pay(win);
        const tier = seg.value >= 10 ? "mega" : seg.value >= 5 ? "big" : "win";
        sfx[tier]();
        resultText.text = `${seg.value}x · ${cast.name} · +${win}`;
        host.onWin(tier, win, { title: seg.value + "x · " + cast.name, line: "Cash segment hit." });
        store.record(game.id, curBet, win);
      } else {
        sfx.lose();
        resultText.text = `Landed on ${seg.value}x · bet lost`;
        store.record(game.id, curBet, 0);
      }
      updateSpinBtn();
    } else {
      // bonus land
      if (selectedBet === "bonus") {
        resultText.text = `${seg.name}! Playing bonus...`;
        sfx.big();
        await runBonusGame(seg.bonusId, cast);
      } else {
        sfx.lose();
        resultText.text = `Landed on ${seg.name} · bet lost (need BONUS bet)`;
        store.record(game.id, curBet, 0);
        updateSpinBtn();
      }
    }
  }

  function showHubWinner(cast, seg) {
    hubContainer.removeChildren();
    hubContainer.addChild(hubBg);
    const labelText = seg.kind === "bonus" ? seg.name : (seg.value + "x");
    hubText.text = labelText;
    hubContainer.addChild(hubText);
    // enlarge winning photo in center
    const winnerUrl = castToPhotoURL(cast);
    PIXI.Assets.load(winnerUrl).then(tex => {
      if (!tex || hubContainer.destroyed) return;
      const sp = new PIXI.Sprite(tex);
      const winnerSize = wheelR * 0.42;
      const scale = winnerSize / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5);
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawCircle(0, 0, winnerSize / 2).endFill();
      hubContainer.addChild(mask);
      sp.mask = mask;
      hubContainer.addChild(sp);
      const ring = new PIXI.Graphics();
      const ringColor = seg.kind === "bonus" ? 0xff2e88 : 0xffd700;
      ring.lineStyle(4, ringColor, 1)
        .beginFill(0x1c0e2a, 0)
        .drawCircle(0, 0, winnerSize / 2 + 3)
        .endFill();
      hubContainer.addChild(ring);
    }).catch(() => {});
  }

  // ===== BONUS mini-games =====
  async function runBonusGame(bonusId, triggerCast) {
    bonusActive = true;
    // dim the wheel area
    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.78).drawRect(0, 0, W, H).endFill();
    dim.interactive = true;
    bonusLayer.addChild(dim);

    const panel = new PIXI.Container();
    panel.x = W / 2;
    panel.y = H / 2;
    bonusLayer.addChild(panel);

    // panel bg
    const pw = Math.min(W - 16, 380);
    const ph = Math.min(H - 40, 580);
    const panelBg = new PIXI.Graphics();
    panelBg.lineStyle(3, 0xf2c76e, 0.8)
      .beginFill(0x1c0e2a, 0.98)
      .drawRoundedRect(-pw / 2, -ph / 2, pw, ph, 16)
      .endFill();
    panel.addChild(panelBg);

    const titleText = new PIXI.Text(BONUS_NAMES[bonusId], {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 24, fontStyle: "italic", fontWeight: "900", fill: 0xf2c76e
    });
    titleText.anchor.set(0.5, 0);
    titleText.x = 0;
    titleText.y = -ph / 2 + 12;
    panel.addChild(titleText);

    const subText = new PIXI.Text("", {
      fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "600",
      fill: 0xffe9b8, align: "center", wordWrap: true, wordWrapWidth: pw - 24
    });
    subText.anchor.set(0.5, 0);
    subText.x = 0;
    subText.y = -ph / 2 + 44;
    panel.addChild(subText);

    const contentLayer = new PIXI.Container();
    panel.addChild(contentLayer);

    const resultBanner = new PIXI.Text("", {
      fontFamily: "Outfit, sans-serif", fontSize: 22, fontWeight: "900",
      fill: 0xff2e88, stroke: 0x160b20, strokeThickness: 3, align: "center"
    });
    resultBanner.anchor.set(0.5, 1);
    resultBanner.x = 0;
    resultBanner.y = ph / 2 - 60;
    panel.addChild(resultBanner);

    return new Promise(resolve => {
      const finish = (mult) => {
        // show result then close
        const totalMult = BONUS_BASE_MULT * mult;
        const win = Math.floor(curBet * totalMult);
        resultBanner.text = `x${mult} bonus · x${BONUS_BASE_MULT} base = x${totalMult}\n+${win} chips`;
        if (win > 0) {
          store.pay(win);
          const tier = totalMult >= 50 ? "jackpot"
                     : totalMult >= 20 ? "mega"
                     : totalMult >= 8 ? "big" : "win";
          sfx[tier]();
          host.onWin(tier, win, {
            title: BONUS_NAMES[bonusId] + " · x" + totalMult,
            line: "+" + win + " chips"
          });
        } else {
          sfx.lose();
        }
        store.record(game.id, curBet, win);
        resultText.text = `${BONUS_NAMES[bonusId]} · x${totalMult} · +${win}`;
        // close panel after a beat
        setTimeout(() => {
          bonusLayer.removeChildren();
          bonusActive = false;
          updateSpinBtn();
          resolve(mult);
        }, 2200);
      };

      if (bonusId === "cashHunt") {
        subText.text = "Tap a diva. Reveal her hidden multiplier.";
        runCashHunt(contentLayer, pw, ph, subText.y + 24, finish);
      } else if (bonusId === "coinFlip") {
        subText.text = "Pick a side. Coin flips.";
        runCoinFlip(contentLayer, pw, ph, subText.y + 24, finish);
      } else if (bonusId === "pachinko") {
        subText.text = "Tap DROP. Ball finds a bucket.";
        runPachinko(contentLayer, pw, ph, subText.y + 24, finish);
      } else {
        subText.text = "Tap a diva. She reveals her multiplier.";
        runDivaShow(contentLayer, pw, ph, subText.y + 24, finish);
      }
    });
  }

  // ---- Cash Hunt: 5 face-down diva photos, pick one, reveal multiplier x5..x50 ----
  function runCashHunt(layer, pw, ph, topY, finish) {
    const cards = 5;
    const cardW = Math.min(64, (pw - 24 - (cards - 1) * 6) / cards);
    const cardH = cardW * 1.35;
    const mults = weightedPickArray([5, 8, 10, 12, 15, 20, 25, 30, 40, 50], [16, 14, 12, 10, 10, 8, 8, 6, 4, 2], cards);
    // assign random divas per card
    const casts = [];
    const usedK = new Set();
    for (let i = 0; i < cards; i++) {
      const c = castPick(CAST_LIST, usedK);
      usedK.add(c.key);
      casts.push(c);
    }
    const totalRowW = cards * cardW + (cards - 1) * 6;
    const startX = -totalRowW / 2;
    const yMid = topY + cardH / 2 + 12;

    for (let i = 0; i < cards; i++) {
      const cx = startX + i * (cardW + 6) + cardW / 2;
      const card = new PIXI.Container();
      card.x = cx;
      card.y = yMid;
      // back of card
      const back = new PIXI.Graphics();
      back.lineStyle(2, 0xf2c76e, 0.8)
        .beginFill(0x2a0e3a)
        .drawRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8)
        .endFill();
      back.beginFill(0xff2e88, 0.8).drawCircle(0, 0, cardW * 0.28).endFill();
      const qTx = new PIXI.Text("?", {
        fontFamily: "Outfit, sans-serif", fontSize: 22, fontWeight: "900", fill: 0xffe9b8
      });
      qTx.anchor.set(0.5);
      back.addChild(qTx);
      card.addChild(back);
      card.interactive = true;
      card.buttonMode = true;
      card.on("pointertap", () => {
        if (card.revealed) return;
        card.revealed = true;
        // disable all
        for (const cc of layer.children) cc.interactive = false;
        revealCard(card, casts[i], mults[i], cardW, cardH, () => {
          // also reveal others
          for (let j = 0; j < layer.children.length; j++) {
            const other = layer.children[j];
            if (other !== card && !other.revealed) {
              other.revealed = true;
              revealCard(other, casts[j], mults[j], cardW, cardH, null);
            }
          }
          setTimeout(() => finish(mults[i]), 1400);
        });
      });
      layer.addChild(card);
    }
  }

  function revealCard(card, cast, mult, cardW, cardH, onDone) {
    card.removeChildren();
    const front = new PIXI.Graphics();
    front.lineStyle(2, mult >= 25 ? 0xff2e88 : 0xf2c76e, 0.9)
      .beginFill(0x160b20)
      .drawRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8)
      .endFill();
    card.addChild(front);
    const url = castToPhotoURL(cast);
    const photoSize = Math.min(cardW - 6, cardH - 22);
    PIXI.Assets.load(url).then(tex => {
      if (!tex || card.destroyed) return;
      const sp = new PIXI.Sprite(tex);
      const scale = photoSize / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5);
      sp.x = 0;
      sp.y = -6;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(
        -photoSize / 2, -photoSize / 2 - 6, photoSize, photoSize, 6
      ).endFill();
      card.addChild(mask);
      sp.mask = mask;
      card.addChild(sp);
      sfx.reveal();
      if (onDone) onDone();
    }).catch(() => { if (onDone) onDone(); });
    const multTx = new PIXI.Text("x" + mult, {
      fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "900",
      fill: mult >= 25 ? 0xff2e88 : 0xffe9b8,
      stroke: 0x000000, strokeThickness: 2
    });
    multTx.anchor.set(0.5, 1);
    multTx.x = 0;
    multTx.y = cardH / 2 - 3;
    card.addChild(multTx);
  }

  // ---- Coin Flip: pick heads/tails, two divas, coin spins, x10 if correct else x2 ----
  function runCoinFlip(layer, pw, ph, topY, finish) {
    const usedK = new Set();
    const headsCast = castPick(CAST_LIST, usedK);
    usedK.add(headsCast.key);
    const tailsCast = castPick(CAST_LIST, usedK);
    let picked = null;

    const btnW = (pw - 24 - 6) / 2;
    const btnH = 56;
    const headsBtn = makeButton(btnW, btnH, "HEADS\n" + headsCast.name, 0x1c0e2a, 0xffe9b8);
    headsBtn.x = -btnW - 3;
    headsBtn.y = topY + 12;
    headsBtn.interactive = true; headsBtn.buttonMode = true;
    const tailsBtn = makeButton(btnW, btnH, "TAILS\n" + tailsCast.name, 0x1c0e2a, 0xffe9b8);
    tailsBtn.x = 3;
    tailsBtn.y = topY + 12;
    tailsBtn.interactive = true; tailsBtn.buttonMode = true;
    layer.addChild(headsBtn);
    layer.addChild(tailsBtn);

    function highlight() {
      const headsOn = picked === "heads";
      headsBtn.children[0].clear();
      headsBtn.children[0].beginFill(headsOn ? 0xf2c76e : 0x1c0e2a)
        .lineStyle(2, 0xf2c76e, 0.7)
        .drawRoundedRect(0, 0, btnW, btnH, 10).endFill();
      headsBtn.children[1].style.fill = headsOn ? 0x160b20 : 0xffe9b8;
      tailsBtn.children[0].clear();
      tailsBtn.children[0].beginFill(picked === "tails" ? 0xf2c76e : 0x1c0e2a)
        .lineStyle(2, 0xf2c76e, 0.7)
        .drawRoundedRect(0, 0, btnW, btnH, 10).endFill();
      tailsBtn.children[1].style.fill = picked === "tails" ? 0x160b20 : 0xffe9b8;
    }
    highlight();

    // coin graphic
    const coinR = 44;
    const coinY = topY + 12 + btnH + coinR + 16;
    const coin = new PIXI.Container();
    coin.x = 0;
    coin.y = coinY;
    layer.addChild(coin);
    const coinBg = new PIXI.Graphics();
    coinBg.beginFill(0xf2c76e).drawCircle(0, 0, coinR).endFill();
    coinBg.beginFill(0x160b20).drawCircle(0, 0, coinR - 4).endFill();
    coin.addChild(coinBg);
    const coinPhoto = new PIXI.Sprite();
    coinPhoto.anchor.set(0.5);
    coinPhoto.width = coinR * 1.7;
    coinPhoto.height = coinR * 1.7;
    coin.addChild(coinPhoto);
    const coinMask = new PIXI.Graphics();
    coinMask.beginFill(0xffffff).drawCircle(0, 0, coinR - 5).endFill();
    layer.addChild(coinMask);
    coinPhoto.mask = coinMask;

    async function setCoin(side) {
      const cast = side === "heads" ? headsCast : tailsCast;
      try {
        const tex = await PIXI.Assets.load(castToPhotoURL(cast));
        if (coinPhoto.destroyed) return;
        coinPhoto.texture = tex;
      } catch (e) {}
    }
    setCoin("heads");

    function flip() {
      const result = Math.random() < 0.5 ? "heads" : "tails";
      sfx.whoosh();
      const startT = performance.now();
      const dur = 2200;
      let lastSide = "heads";
      const fn = () => {
        const e = performance.now() - startT;
        const tt = Math.min(1, e / dur);
        const eased = 1 - Math.pow(1 - tt, 3);
        // y-scale: wobble between 1 and -1
        const wobble = Math.cos(tt * Math.PI * 14);
        coin.scale.y = Math.cos(eased * Math.PI * 8) * 0.9 + 0.1;
        if (Math.cos(e * 0.025) > 0) {
          if (lastSide !== "heads") { lastSide = "heads"; setCoin("heads"); }
        } else {
          if (lastSide !== "tails") { lastSide = "tails"; setCoin("tails"); }
        }
        coin.scale.x = 1 + Math.abs(Math.cos(e * 0.04)) * 0.05 * (1 - tt);
        if (tt >= 1) {
          pixiApp.ticker.remove(fn);
          coin.scale.set(1, 1);
          setCoin(result);
          const correct = picked === result;
          const mult = correct ? 10 : 2;
          setTimeout(() => finish(mult), 700);
        }
      };
      pixiApp.ticker.add(fn);
      tickersToCleanup.push(fn);
    }

    headsBtn.on("pointertap", () => {
      if (picked) return;
      sfx.click();
      picked = "heads";
      highlight();
      headsBtn.interactive = false;
      tailsBtn.interactive = false;
      setTimeout(flip, 350);
    });
    tailsBtn.on("pointertap", () => {
      if (picked) return;
      sfx.click();
      picked = "tails";
      highlight();
      headsBtn.interactive = false;
      tailsBtn.interactive = false;
      setTimeout(flip, 350);
    });
  }

  // ---- Pachinko: 5 peg rows, 7 buckets with mults x2..x25 ----
  function runPachinko(layer, pw, ph, topY, finish) {
    const PEG_ROWS = 5;
    const BUCKETS = 7;
    // edge high (x25, x15), center low (x2). Bell-ish.
    const BUCKET_MULTS = [25, 15, 5, 2, 5, 15, 25];
    const fieldW = pw - 24;
    const fieldH = ph - topY - 70;
    const field = new PIXI.Container();
    field.x = -fieldW / 2;
    field.y = topY + 12;
    layer.addChild(field);

    const pegRowH = (fieldH - 70) / PEG_ROWS;
    const pegs = [];
    for (let row = 0; row < PEG_ROWS; row++) {
      const count = row + 2;
      const rowY = row * pegRowH + pegRowH / 2;
      const spacing = fieldW / count;
      for (let i = 0; i < count; i++) {
        pegs.push({ x: (i + 0.5) * spacing, y: rowY });
      }
    }
    const pegG = new PIXI.Graphics();
    for (const p of pegs) {
      pegG.beginFill(0xf2c76e).drawCircle(p.x, p.y, 3).endFill();
    }
    field.addChild(pegG);

    // buckets
    const bucketTop = PEG_ROWS * pegRowH + 8;
    const bucketW = fieldW / BUCKETS;
    const bucketH = 56;
    const bucketCont = new PIXI.Container();
    bucketCont.y = bucketTop;
    field.addChild(bucketCont);
    for (let i = 0; i < BUCKETS; i++) {
      const x = i * bucketW;
      const mult = BUCKET_MULTS[i];
      const color = mult >= 25 ? 0xff2e88 : mult >= 15 ? 0xffd700 : mult >= 5 ? 0xf2c76e : 0x57d38f;
      const g = new PIXI.Graphics();
      g.lineStyle(2, color, 0.8)
        .beginFill(0x1c0e2a)
        .drawRoundedRect(x + 2, 0, bucketW - 4, bucketH, 6)
        .endFill();
      g.beginFill(color, 0.5).drawRoundedRect(x + 2, 0, bucketW - 4, 4, 2).endFill();
      bucketCont.addChild(g);
      const mt = new PIXI.Text("x" + mult, {
        fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "900",
        fill: 0xffe9b8, stroke: 0x000000, strokeThickness: 1
      });
      mt.anchor.set(0.5, 1);
      mt.x = x + bucketW / 2;
      mt.y = bucketH - 3;
      bucketCont.addChild(mt);
    }

    // drop button
    const dropBtn = makeButton(120, 38, "DROP", 0xf2c76e, 0x160b20);
    dropBtn.x = 0;
    dropBtn.y = ph / 2 - 24;
    dropBtn.interactive = true; dropBtn.buttonMode = true;
    layer.addChild(dropBtn);

    const ballLayer = new PIXI.Container();
    field.addChild(ballLayer);

    function drop() {
      dropBtn.interactive = false;
      sfx.whoosh();
      const ball = new PIXI.Graphics();
      ball.beginFill(0xff2e88).drawCircle(0, 0, 7).endFill();
      ball.beginFill(0xffe9b8).drawCircle(-2, -2, 2.5).endFill();
      ball.x = fieldW / 2;
      ball.y = -8;
      ballLayer.addChild(ball);
      const state = { x: fieldW / 2, y: -8, vx: 0, vy: 0, row: 0, settled: false, sprite: ball };

      const gravity = 540;
      const maxV = 320;
      const dts = 1 / 60;
      const fn = () => {
        if (state.settled) {
          pixiApp.ticker.remove(fn);
          return;
        }
        state.vy = Math.min(maxV, state.vy + gravity * dts);
        state.x += state.vx * dts;
        state.y += state.vy * dts;
        const targetRowY = (state.row + 0.5) * pegRowH;
        if (state.y >= targetRowY && state.row < PEG_ROWS) {
          state.y = targetRowY;
          const dir = Math.random() < 0.5 ? -1 : 1;
          state.vx = dir * 40;
          state.vy = 80;
          sfx.tick();
          state.row++;
          if (state.row >= PEG_ROWS) {
            settleBall(state);
          }
        }
        if (state.x < 6) { state.x = 6; state.vx = Math.abs(state.vx); }
        if (state.x > fieldW - 6) { state.x = fieldW - 6; state.vx = -Math.abs(state.vx); }
        state.sprite.x = state.x;
        state.sprite.y = state.y;
      };
      pixiApp.ticker.add(fn);
      tickersToCleanup.push(fn);

      function settleBall(b) {
        b.settled = true;
        const idx = Math.max(0, Math.min(BUCKETS - 1, Math.floor(b.x / bucketW)));
        const mult = BUCKET_MULTS[idx];
        const targetX = (idx + 0.5) * bucketW;
        const targetY = bucketTop + bucketH - 10;
        let el = 0;
        const settleFn = (dt) => {
          el += dt;
          b.x += (targetX - b.x) * 0.2;
          b.y += (targetY - b.y) * 0.2;
          b.sprite.x = b.x;
          b.sprite.y = b.y;
          b.sprite.alpha = Math.max(0, b.sprite.alpha - 0.04);
          if (el > 28) {
            pixiApp.ticker.remove(settleFn);
            ballLayer.removeChild(b.sprite);
            b.sprite.destroy();
            setTimeout(() => finish(mult), 500);
          }
        };
        pixiApp.ticker.add(settleFn);
        tickersToCleanup.push(settleFn);
      }
    }
    dropBtn.on("pointertap", drop);
  }

  // ---- Diva Show: 3 divas walk out, tap one, reveals x5..x15 ----
  function runDivaShow(layer, pw, ph, topY, finish) {
    const castCount = 3;
    const mults = weightedPickArray([5, 6, 8, 10, 12, 15], [22, 20, 18, 16, 14, 10], castCount);
    const usedK = new Set();
    const casts = [];
    for (let i = 0; i < castCount; i++) {
      const c = castPick(CAST_LIST, usedK);
      usedK.add(c.key);
      casts.push(c);
    }
    const cardW = Math.min(96, (pw - 24 - 12) / castCount);
    const cardH = cardW * 1.4;
    const totalW = castCount * cardW + (castCount - 1) * 6;
    const startX = -totalW / 2;
    const yMid = topY + 20 + cardH / 2;

    for (let i = 0; i < castCount; i++) {
      const cx = startX + i * (cardW + 6) + cardW / 2;
      const card = new PIXI.Container();
      card.x = cx;
      card.y = yMid;
      // frame
      const frame = new PIXI.Graphics();
      frame.lineStyle(2, 0xf2c76e, 0.8)
        .beginFill(0x160b20)
        .drawRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10)
        .endFill();
      card.addChild(frame);
      // photo (cover-fit)
      const url = castToPhotoURL(casts[i]);
      const photoSize = cardW - 8;
      PIXI.Assets.load(url).then(tex => {
        if (!tex || card.destroyed) return;
        const sp = new PIXI.Sprite(tex);
        const scale = photoSize / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.anchor.set(0.5);
        sp.y = -10;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(
          -photoSize / 2, -photoSize / 2 - 10, photoSize, photoSize, 6
        ).endFill();
        card.addChild(mask);
        sp.mask = mask;
        card.addChild(sp);
      }).catch(() => {});
      // name label
      const nameTx = new PIXI.Text(casts[i].name, {
        fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "700",
        fill: 0xffe9b8, align: "center", wordWrap: true, wordWrapWidth: cardW - 6
      });
      nameTx.anchor.set(0.5, 1);
      nameTx.x = 0;
      nameTx.y = cardH / 2 - 3;
      card.addChild(nameTx);
      card.interactive = true;
      card.buttonMode = true;
      card.on("pointertap", () => {
        for (const cc of layer.children) cc.interactive = false;
        // highlight picked
        const mult = mults[i];
        const multTx = new PIXI.Text("x" + mult, {
          fontFamily: "Outfit, sans-serif", fontSize: 22, fontWeight: "900",
          fill: mult >= 12 ? 0xff2e88 : 0xffe9b8,
          stroke: 0x000000, strokeThickness: 3
        });
        multTx.anchor.set(0.5);
        multTx.x = 0;
        multTx.y = 0;
        card.addChild(multTx);
        sfx.reveal();
        setTimeout(() => finish(mult), 1400);
      });
      layer.addChild(card);
    }
  }

  return function cleanup() {
    for (const fn of tickersToCleanup) {
      try { pixiApp.ticker.remove(fn); } catch (e) {}
    }
  };
}

// ===== helpers =====
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function weightedPickArray(values, weights, count) {
  const total = weights.reduce((s, w) => s + w, 0);
  const picked = [];
  const pool = values.map((v, i) => ({ v, w: weights[i] }));
  for (let k = 0; k < count; k++) {
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) {
        picked.push(pool[i].v);
        break;
      }
    }
  }
  // shuffle picked order
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).lineStyle(2, 0xf2c76e, 0.6).drawRoundedRect(0, 0, w, h, 10).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif",
    fontSize: 15, fontWeight: "700", fill: fg, align: "center", wordWrap: true, wordWrapWidth: w - 8
  });
  tx.anchor.set(0.5);
  tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}

function makeSegPill(w, h, label, color, active) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(active ? color : 0x1c0e2a)
    .lineStyle(2, color, active ? 1 : 0.5)
    .drawRoundedRect(0, 0, w, h, 10)
    .endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif",
    fontSize: 16, fontWeight: "900",
    fill: active ? 0x160b20 : 0xffe9b8
  });
  tx.anchor.set(0.5);
  tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}
