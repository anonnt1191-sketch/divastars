// games/scooty-race.js — Scooty Race. 5 divas race scooties across the screen.
// Back a diva at her odds. Win 1st = bet * odds. 2nd = bet/2 back. 3rd+ = lose.
// Kallie has 20% chance to wheelie: either boost massively or crash (DNF).

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { castToPhotoURL, castPick } from "../core/photos.js";
import { CAST_LIST } from "../core/app.js";

const RACERS = 5;
const ODDS_POOL = [1.5, 2, 2.5, 3, 4, 5, 7, 10];
const LANE_COLORS = [0x7c1d3f, 0x1d4a7c, 0x1d7c4a, 0x7c5a1d, 0x4a1d7c];

function pickOdds() {
  return ODDS_POOL[Math.floor(Math.random() * ODDS_POOL.length)];
}

function ordinal(n) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return n + "th";
}

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  // ── Background: sunset gradient ───────────────────────────────────────────
  const bg = new PIXI.Graphics();
  bg.beginFill(0x100a1a, 0.75).drawRect(0, 0, W, H).endFill();
  for (let i = 0; i < H; i += 4) {
    const tt = i / H;
    const r = Math.floor(0x2a + tt * 0x10);
    const g = Math.floor(0x10 + tt * 0x08);
    const b = Math.floor(0x30 + tt * 0x20);
    bg.beginFill((r << 16) | (g << 8) | b, 0.5).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb || "Back a diva. Hold your breath.", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 4;
  c.addChild(tagline);

  // ── Track geometry ────────────────────────────────────────────────────────
  const trackTop = 40;
  const trackBottom = H - 130;
  const trackH = trackBottom - trackTop;
  const laneH = trackH / RACERS;
  const trackLeft = 16;
  const trackRight = W - 16;
  const trackW = trackRight - trackLeft;
  const finishX = trackRight - 30;
  const startX = trackLeft + 40;

  // track graphics: lanes + start + finish line
  const trackGfx = new PIXI.Graphics();
  trackGfx.beginFill(0x1a0a2a, 0.4).drawRect(trackLeft, trackTop, trackW, trackH).endFill();
  trackGfx.lineStyle(1, 0xf2c76e, 0.3);
  for (let i = 1; i < RACERS; i++) {
    trackGfx.moveTo(trackLeft, trackTop + i * laneH).lineTo(trackRight, trackTop + i * laneH);
  }
  // start line
  trackGfx.lineStyle(2, 0xffffff, 0.5).moveTo(startX, trackTop).lineTo(startX, trackBottom);
  // finish line (checkered)
  for (let y = 0; y < trackH; y += 12) {
    trackGfx.beginFill(((y / 12) | 0) % 2 === 0 ? 0xffffff : 0x000000, 0.7)
      .drawRect(finishX, trackTop + y, 6, 12).endFill();
  }
  c.addChild(trackGfx);

  // ── Layers ────────────────────────────────────────────────────────────────
  const scooterLayer = new PIXI.Container();
  c.addChild(scooterLayer);
  const cardLayer = new PIXI.Container();
  c.addChild(cardLayer);
  const resultLayer = new PIXI.Container();
  c.addChild(resultLayer);

  // ── State ─────────────────────────────────────────────────────────────────
  let racers = [];
  let selectedIdx = -1;
  let raceActive = false;
  let raceOver = false;
  let finishOrder = [];
  let curBet = 25;

  async function setupRace() {
    cardLayer.removeChildren();
    scooterLayer.removeChildren();
    resultLayer.removeChildren();
    racers = [];
    selectedIdx = -1;
    raceActive = false;
    raceOver = false;
    finishOrder = [];

    // pick 5 cast — ensure Kallie is included for wheelie drama
    const shuffled = [...CAST_LIST].sort(() => Math.random() - 0.5).slice(0, RACERS);
    const kallie = CAST_LIST.find(x => x.kind === "friend" && x.id === "kallie");
    if (kallie && !shuffled.includes(kallie)) shuffled[0] = kallie;

    for (let i = 0; i < RACERS; i++) {
      const cast = shuffled[i];
      const odds = pickOdds();
      const skill = 0.45 + (1 / odds) * 0.55;  // higher odds = lower avg skill
      const r = {
        idx: i, cast, odds, skill,
        x: startX,
        baseSpeed: 130 + Math.random() * 40,
        finished: false, dnf: false,
        boosted: false, willCrashAt: -1, crashTriggered: false,
        sprite: null,
        laneY: trackTop + i * laneH + laneH / 2
      };
      // Kallie 20% wheelie — boost or crash
      if (cast.kind === "friend" && cast.id === "kallie") {
        if (Math.random() < 0.20) {
          if (Math.random() < 0.5) r.boosted = true;
          else r.willCrashAt = 0.30 + Math.random() * 0.40;
        }
      }
      racers.push(r);
    }

    buildBetCards();
    await buildScooters();
    scooterLayer.visible = false;
    cardLayer.visible = true;
    updateStartBtn();
  }

  function buildBetCards() {
    cardLayer.removeChildren();
    const cardW = W - 32;
    const cardH = laneH - 8;
    for (let i = 0; i < racers.length; i++) {
      const r = racers[i];
      const card = new PIXI.Container();
      card.x = W / 2;
      card.y = trackTop + i * laneH + laneH / 2;
      // bg
      const bgG = new PIXI.Graphics();
      bgG.beginFill(0x241035, 0.88).drawRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10).endFill();
      bgG.lineStyle(1, LANE_COLORS[i], 1).drawRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10).endFill();
      card.addChild(bgG);
      // selection highlight
      const hl = new PIXI.Graphics();
      hl.lineStyle(3, 0xff2e88, 1).drawRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10).endFill();
      hl.visible = false;
      card.addChild(hl);
      card.highlight = hl;
      // photo
      const photoR = Math.min(28, cardH / 2 - 6);
      const photoX = -cardW / 2 + photoR + 14;
      const ringG = new PIXI.Graphics();
      ringG.lineStyle(2, LANE_COLORS[i], 1).drawCircle(photoX, 0, photoR + 2).endFill();
      card.addChild(ringG);
      (async () => {
        try {
          const tex = await PIXI.Assets.load(castToPhotoURL(r.cast));
          const sp = new PIXI.Sprite(tex);
          const scale = photoR * 2 / Math.max(tex.width, tex.height);
          sp.scale.set(scale);
          sp.anchor.set(0.5);
          sp.x = photoX;
          const mask = new PIXI.Graphics();
          mask.beginFill(0xffffff).drawCircle(photoX, 0, photoR).endFill();
          card.addChild(mask);
          sp.mask = mask;
          card.addChild(sp);
        } catch (e) {}
      })();
      // name + title
      const nameTx = new PIXI.Text(r.cast.name, {
        fontFamily: "Outfit, sans-serif", fontSize: 15, fontWeight: "900", fill: 0xffe9b8
      });
      nameTx.anchor.set(0, 0.5);
      nameTx.x = photoX + photoR + 16;
      nameTx.y = -8;
      card.addChild(nameTx);
      const titleTx = new PIXI.Text(r.cast.title || r.cast.kind, {
        fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "400", fill: 0xb0a0c0
      });
      titleTx.anchor.set(0, 0.5);
      titleTx.x = nameTx.x;
      titleTx.y = 10;
      card.addChild(titleTx);
      // odds (right side)
      const oddsTx = new PIXI.Text(r.odds + "x", {
        fontFamily: "Outfit, sans-serif", fontSize: 24, fontWeight: "900", fill: 0xf2c76e,
        stroke: 0x160b20, strokeThickness: 2
      });
      oddsTx.anchor.set(1, 0.5);
      oddsTx.x = cardW / 2 - 14;
      oddsTx.y = 0;
      card.addChild(oddsTx);
      // tap hint
      const hintTx = new PIXI.Text("tap to back", {
        fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "400", fill: 0x807090
      });
      hintTx.anchor.set(1, 0.5);
      hintTx.x = oddsTx.x - 60;
      hintTx.y = 0;
      card.hintTx = hintTx;
      card.addChild(hintTx);

      card.interactive = true;
      card.buttonMode = true;
      card.on("pointertap", () => {
        if (raceActive || raceOver) return;
        sfx.click();
        selectedIdx = i;
        refreshCardSelection();
        updateStartBtn();
      });
      cardLayer.addChild(card);
    }
  }

  function refreshCardSelection() {
    for (let i = 0; i < cardLayer.children.length; i++) {
      const card = cardLayer.children[i];
      const sel = i === selectedIdx;
      card.highlight.visible = sel;
      if (card.hintTx) {
        card.hintTx.text = sel ? "✓ BACKED" : "tap to back";
        card.hintTx.style.fill = sel ? 0x57d38f : 0x807090;
      }
    }
  }

  async function buildScooters() {
    scooterLayer.removeChildren();
    for (const r of racers) {
      const cont = new PIXI.Container();
      cont.x = r.x;
      cont.y = r.laneY;
      const bodyColor = LANE_COLORS[r.idx];
      // body
      const body = new PIXI.Graphics();
      body.beginFill(bodyColor).drawRoundedRect(-22, -8, 44, 16, 6).endFill();
      body.beginFill(bodyColor, 0.7).drawRoundedRect(-10, -16, 20, 12, 4).endFill();  // seat fairing
      // wheels
      body.beginFill(0x222222).drawCircle(-16, 10, 7).drawCircle(16, 10, 7).endFill();
      body.beginFill(0x999999).drawCircle(-16, 10, 3).drawCircle(16, 10, 3).endFill();
      // handlebar
      body.lineStyle(3, 0x999999).moveTo(18, -6).lineTo(24, -16);
      body.lineStyle(2, 0x333333).moveTo(22, -16).lineTo(30, -16);
      cont.addChild(body);
      // rider head (diva photo)
      try {
        const tex = await PIXI.Assets.load(castToPhotoURL(r.cast));
        const sp = new PIXI.Sprite(tex);
        const sz = 26;
        const scale = sz / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.anchor.set(0.5);
        sp.x = -2; sp.y = -24;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawCircle(sp.x, sp.y, sz / 2).endFill();
        cont.addChild(mask);
        sp.mask = mask;
        cont.addChild(sp);
        // helmet rim
        const rim = new PIXI.Graphics();
        rim.lineStyle(2, bodyColor, 1).drawCircle(sp.x, sp.y, sz / 2 + 1).endFill();
        cont.addChild(rim);
      } catch (e) {}
      // odds label above
      const oddsTx = new PIXI.Text(r.odds + "x", {
        fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "900",
        fill: 0xf2c76e, stroke: 0x160b20, strokeThickness: 2
      });
      oddsTx.anchor.set(0.5);
      oddsTx.x = 0; oddsTx.y = -42;
      cont.addChild(oddsTx);
      r.sprite = cont;
      scooterLayer.addChild(cont);
    }
  }

  function startRace() {
    cardLayer.visible = false;
    scooterLayer.visible = true;
    raceActive = true;
    sfx.whoosh();
    host.toast("GO!", 800);
  }

  function endRace() {
    raceOver = true;
    raceActive = false;
    // append DNFs to finishOrder
    for (const r of racers) {
      if (!finishOrder.includes(r)) finishOrder.push(r);
    }
    // show place badges
    for (let i = 0; i < finishOrder.length; i++) {
      const r = finishOrder[i];
      if (!r.sprite) continue;
      const place = r.dnf ? "DNF" : ordinal(i + 1);
      const color = i === 0 ? 0xffd700 : i === 1 ? 0xc0c0c0 : i === 2 ? 0xcd7f32 : 0x888888;
      const placeTx = new PIXI.Text(place, {
        fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900",
        fill: color, stroke: 0x160b20, strokeThickness: 3
      });
      placeTx.anchor.set(0.5);
      placeTx.x = 0; placeTx.y = -62;
      r.sprite.addChild(placeTx);
    }
    // payout
    const sel = racers[selectedIdx];
    let payout = 0;
    let place = "—";
    if (sel) {
      if (sel.dnf) {
        place = "DNF";
        payout = 0;
      } else {
        place = ordinal(finishOrder.indexOf(sel) + 1);
        if (place === "1st") payout = Math.floor(curBet * sel.odds);
        else if (place === "2nd") payout = Math.floor(curBet / 2);
        else payout = 0;
      }
    }
    store.record(game.id, curBet, payout);
    if (payout > 0) {
      store.pay(payout);
      const tier = payout >= curBet * 8 ? "mega" : payout >= curBet * 3 ? "big" : "win";
      if (tier === "mega") sfx.mega(); else if (tier === "big") sfx.big(); else sfx.win();
      host.onWin(tier, payout, {
        title: sel.cast.name + " finished " + place,
        line: "+" + payout + " chips"
      });
    } else {
      sfx.lose();
      host.toast(sel ? sel.cast.name + " didn't place. Bet lost." : "No diva backed.", 2400);
    }
    updateStartBtn();
  }

  // ── Bet row + start button ────────────────────────────────────────────────
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    curBet = [10, 25, 50, 100, 250][i]; updateStartBtn();
  }));

  const startBtn = makeButton(W - 16, 50, "PICK A DIVA", 0xf2c76e, 0x160b20);
  startBtn.x = 8; startBtn.y = H - 55;
  startBtn.interactive = true; startBtn.buttonMode = true;
  c.addChild(startBtn);
  function updateStartBtn() {
    let label;
    if (raceActive) label = "RACING...";
    else if (raceOver) label = "NEW RACE";
    else if (selectedIdx >= 0) label = "START · " + curBet;
    else label = "PICK A DIVA";
    startBtn.children[1].text = label;
  }
  startBtn.on("pointertap", () => {
    if (raceActive) return;
    sfx.click();
    if (raceOver) {
      setupRace();
      return;
    }
    if (selectedIdx < 0) { host.toast("Pick a diva to back first.", 1500); return; }
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    startRace();
    updateStartBtn();
  });

  // ── Ticker: advance racers ────────────────────────────────────────────────
  const tickerFn = (dt) => {
    if (!raceActive) return;
    const dts = Math.min(dt / 60, 0.04);
    let allDone = true;
    for (const r of racers) {
      if (r.finished || r.dnf) continue;
      allDone = false;
      // Kallie crash trigger
      if (r.willCrashAt > 0 && !r.crashTriggered) {
        const progress = (r.x - startX) / (finishX - startX);
        if (progress >= r.willCrashAt) {
          r.crashTriggered = true;
          r.dnf = true;
          sfx.crash();
          host.toast(r.cast.name + " crashed! DNF.", 1800);
          if (r.sprite) r.sprite.rotation = Math.PI / 2.2;
          continue;
        }
      }
      // speed with random walk variance
      const variance = 0.6 + Math.random() * 0.5;
      let speed = r.baseSpeed * r.skill * variance;
      if (r.boosted) speed *= 2.4;
      r.x += speed * dts;
      if (r.sprite) r.sprite.x = r.x;
      // wheelie wobble for boosted Kallie
      if (r.boosted && r.sprite) {
        r.sprite.rotation = -0.20 + Math.sin(performance.now() / 90) * 0.06;
      }
      // finish line
      if (r.x >= finishX) {
        r.x = finishX;
        r.finished = true;
        finishOrder.push(r);
        sfx.coin();
        if (r.sprite) r.sprite.rotation = 0;
      }
    }
    if (allDone && !raceOver) endRace();
  };
  pixiApp.ticker.add(tickerFn);

  // ── Init ──────────────────────────────────────────────────────────────────
  await setupRace();

  return function cleanup() {
    pixiApp.ticker.remove(tickerFn);
  };
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "700", fill: fg, align: "center"
  });
  tx.anchor.set(0.5);
  tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}
