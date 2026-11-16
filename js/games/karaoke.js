// games/karaoke.js — Karaoke Night. Notes fall in 3 lanes; tap the hit zone.
// Perfect = 100 pts, Good = 50 pts, Miss = 0. Combo multiplier: 5+ perfect = x2, 10+ = x3.
// 30-second song, ~60 notes. Payout = score / 1000 * bet.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { castToPhotoURL, castPick } from "../core/photos.js";
import { CAST_LIST } from "../core/app.js";

const ROUND_TIME = 30;
const LANES = 3;
const PERFECT_WINDOW = 26;
const GOOD_WINDOW = 60;
const FALL_TIME = 1.7;   // seconds for a note to fall from top to hit line

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  // ── Background: stage + spotlight ─────────────────────────────────────────
  const bg = new PIXI.Graphics();
  bg.beginFill(0x0a0612, 0.75).drawRect(0, 0, W, H).endFill();
  bg.beginFill(0xf2c76e, 0.08).drawPolygon([W / 2, 0, W * 0.10, H, W * 0.90, H]).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb || "Hit the notes. Hold the combo.", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 4;
  c.addChild(tagline);

  // ── Singing diva at top ───────────────────────────────────────────────────
  const singY = 8, singH = 80;
  const singer = new PIXI.Container();
  singer.x = W / 2; singer.y = singY + singH / 2;
  c.addChild(singer);
  const singerCast = CAST_LIST.find(x => x.kind === "friend" && x.id === "vedhika") || castPick(CAST_LIST);
  (async () => {
    try {
      const tex = await PIXI.Assets.load(castToPhotoURL(singerCast));
      const sp = new PIXI.Sprite(tex);
      const sz = 70;
      const scale = sz / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5);
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawCircle(0, 0, sz / 2).endFill();
      singer.addChild(mask);
      sp.mask = mask;
      singer.addChild(sp);
      const ring = new PIXI.Graphics();
      ring.lineStyle(3, 0xffd700, 1).drawCircle(0, 0, sz / 2 + 3).endFill();
      singer.addChild(ring);
      const mic = new PIXI.Graphics();
      mic.beginFill(0x333333).drawRoundedRect(sz / 2 - 2, -4, 16, 8, 3).endFill();
      mic.beginFill(0xff2e88).drawCircle(sz / 2 + 14, 0, 5).endFill();
      singer.addChild(mic);
    } catch (e) {}
  })();

  // musical notes floating beside the singer
  const noteSym = new PIXI.Text("♪ ♫ ♪", {
    fontFamily: "Outfit, sans-serif", fontSize: 22, fontWeight: "900", fill: 0xffd700,
    stroke: 0x0a0612, strokeThickness: 2
  });
  noteSym.anchor.set(0.5);
  noteSym.x = W / 2 - 80; noteSym.y = singY + singH / 2;
  c.addChild(noteSym);

  // ── HUD ───────────────────────────────────────────────────────────────────
  const scoreText = new PIXI.Text("SCORE: 0", {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "900", fill: 0xffe9b8,
    stroke: 0x0a0612, strokeThickness: 3
  });
  scoreText.x = 8; scoreText.y = 22;
  c.addChild(scoreText);

  const timeText = new PIXI.Text("30", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0xff2e88,
    stroke: 0x0a0612, strokeThickness: 3
  });
  timeText.anchor.set(1, 0);
  timeText.x = W - 8; timeText.y = 22;
  c.addChild(timeText);

  const comboText = new PIXI.Text("", {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "900", fill: 0x57d38f,
    stroke: 0x0a0612, strokeThickness: 2, align: "right"
  });
  comboText.anchor.set(1, 0);
  comboText.x = W - 8; comboText.y = 44;
  c.addChild(comboText);

  // ── Playfield — 3 lanes ───────────────────────────────────────────────────
  const fieldY = singY + singH + 8;
  const fieldH = H - fieldY - 110;
  const laneW = W / LANES;
  const hitY = fieldH - 50;

  const field = new PIXI.Container();
  field.x = 0; field.y = fieldY;
  c.addChild(field);

  // lane backgrounds + dividers
  const laneBg = new PIXI.Graphics();
  for (let i = 0; i < LANES; i++) {
    laneBg.beginFill(i % 2 === 0 ? 0x15082a : 0x1a0a35, 0.5).drawRect(i * laneW, 0, laneW, fieldH).endFill();
  }
  laneBg.lineStyle(2, 0xf2c76e, 0.3);
  for (let i = 1; i < LANES; i++) {
    laneBg.moveTo(i * laneW, 0).lineTo(i * laneW, fieldH);
  }
  field.addChild(laneBg);

  // hit zone bar
  const hitBar = new PIXI.Graphics();
  hitBar.beginFill(0xff2e88, 0.18).drawRect(0, hitY - GOOD_WINDOW, W, GOOD_WINDOW * 2).endFill();
  hitBar.beginFill(0xff2e88, 0.30).drawRect(0, hitY - PERFECT_WINDOW, W, PERFECT_WINDOW * 2).endFill();
  hitBar.lineStyle(2, 0xff2e88, 1).moveTo(0, hitY).lineTo(W, hitY);
  field.addChild(hitBar);

  // pick 3 lane divas + preload textures
  const laneCasts = [];
  const used = new Set();
  for (let i = 0; i < LANES; i++) {
    const cc = castPick(CAST_LIST, used);
    used.add(cc.key);
    laneCasts.push(cc);
  }
  const laneTexs = await Promise.all(
    laneCasts.map(cc => PIXI.Assets.load(castToPhotoURL(cc)).catch(() => null)));

  // hit zone buttons (3, with diva photos)
  const hitButtons = [];
  for (let i = 0; i < LANES; i++) {
    const btn = new PIXI.Container();
    btn.x = i * laneW + laneW / 2;
    btn.y = hitY;
    const r = Math.min(laneW / 2 - 8, 26);
    const ringG = new PIXI.Graphics();
    ringG.lineStyle(3, 0xf2c76e, 1).drawCircle(0, 0, r + 2).endFill();
    btn.addChild(ringG);
    const tex = laneTexs[i];
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      const scale = r * 2 / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5);
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawCircle(0, 0, r).endFill();
      btn.addChild(mask);
      sp.mask = mask;
      btn.addChild(sp);
    }
    btn.r = r;
    field.addChild(btn);
    hitButtons.push(btn);
  }

  // full-lane tap surfaces
  const laneSurfaces = [];
  for (let i = 0; i < LANES; i++) {
    const surf = new PIXI.Graphics();
    surf.beginFill(0xffffff, 0).drawRect(i * laneW, 0, laneW, fieldH).endFill();
    surf.interactive = true;
    surf.on("pointerdown", () => tapLane(i));
    field.addChild(surf);
    laneSurfaces.push(surf);
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let active = false;
  let timeLeft = ROUND_TIME;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let perfectCount = 0;
  let goodCount = 0;
  let missCount = 0;
  let curBet = 25;
  let timerInterval = null;
  let spawnInterval = null;
  const notes = [];

  function spawnNote(lane) {
    const note = {
      lane, y: -30,
      vy: (hitY + 30) / FALL_TIME,
      hit: false, missed: false, result: null,
      popping: false, popT: 0, missT: 0, remove: false,
      sprite: null, r: 0
    };
    const cont = new PIXI.Container();
    cont.x = lane * laneW + laneW / 2;
    cont.y = note.y;
    const r = Math.min(laneW / 2 - 10, 22);
    const disc = new PIXI.Graphics();
    disc.beginFill(0xff2e88, 0.9).drawCircle(0, 0, r + 2).endFill();
    cont.addChild(disc);
    const tex = laneTexs[lane];
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      const scale = r * 2 / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5);
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawCircle(0, 0, r).endFill();
      cont.addChild(mask);
      sp.mask = mask;
      cont.addChild(sp);
    }
    note.sprite = cont;
    note.r = r;
    field.addChild(cont);
    notes.push(note);
  }

  function tapLane(lane) {
    if (!active) return;
    let best = null, bestDist = Infinity;
    for (const n of notes) {
      if (n.hit || n.missed) continue;
      if (n.lane !== lane) continue;
      const dist = Math.abs(n.y - hitY);
      if (dist < bestDist) { bestDist = dist; best = n; }
    }
    if (!best || bestDist > GOOD_WINDOW) {
      flashHit(lane, 0x666666, 0.3);
      return;
    }
    best.hit = true;
    if (bestDist < PERFECT_WINDOW) {
      best.result = "perfect";
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      perfectCount++;
      const mult = combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
      score += 100 * mult;
      sfx.pop();
      flashHit(lane, 0x57d38f, 1);
      showJudgment(lane, "PERFECT", 0x57d38f, mult);
    } else {
      best.result = "good";
      combo = 0;
      goodCount++;
      score += 50;
      sfx.tick();
      flashHit(lane, 0xf2c76e, 0.7);
      showJudgment(lane, "GOOD", 0xf2c76e, 1);
    }
    scoreText.text = "SCORE: " + score;
    updateComboText();
    best.popping = true;
    best.popT = 0;
  }

  function flashHit(lane, color, intensity) {
    const btn = hitButtons[lane];
    const flash = new PIXI.Graphics();
    flash.beginFill(color, intensity).drawCircle(0, 0, btn.r + 8).endFill();
    flash.x = btn.x; flash.y = btn.y;
    field.addChild(flash);
    let elapsed = 0;
    const fn = (dt) => {
      elapsed += dt / 60;
      flash.alpha = Math.max(0, 1 - elapsed * 4);
      flash.scale.set(1 + elapsed * 2);
      if (elapsed > 0.3) {
        pixiApp.ticker.remove(fn);
        if (flash.parent) flash.parent.removeChild(flash);
        flash.destroy();
      }
    };
    pixiApp.ticker.add(fn);
  }

  function showJudgment(lane, text, color, mult) {
    const tx = new PIXI.Text(text + (mult > 1 ? " x" + mult : ""), {
      fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "900", fill: color,
      stroke: 0x0a0612, strokeThickness: 3, align: "center"
    });
    tx.anchor.set(0.5);
    tx.x = lane * laneW + laneW / 2;
    tx.y = hitY - 40;
    field.addChild(tx);
    let elapsed = 0;
    const fn = (dt) => {
      elapsed += dt / 60;
      tx.y -= 30 * dt / 60;
      tx.alpha = Math.max(0, 1 - elapsed * 2);
      if (elapsed > 0.6) {
        pixiApp.ticker.remove(fn);
        if (tx.parent) tx.parent.removeChild(tx);
        tx.destroy();
      }
    };
    pixiApp.ticker.add(fn);
  }

  function updateComboText() {
    if (combo >= 10) comboText.text = "COMBO x" + combo + " (x3!)";
    else if (combo >= 5) comboText.text = "COMBO x" + combo + " (x2)";
    else if (combo > 0) comboText.text = "COMBO x" + combo;
    else comboText.text = "";
  }

  function startRound() {
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    active = true;
    timeLeft = ROUND_TIME;
    score = 0;
    combo = 0;
    maxCombo = 0;
    perfectCount = 0;
    goodCount = 0;
    missCount = 0;
    scoreText.text = "SCORE: 0";
    timeText.text = ROUND_TIME;
    comboText.text = "";
    sfx.whoosh();
    if (timerInterval) clearInterval(timerInterval);
    if (spawnInterval) clearInterval(spawnInterval);
    timerInterval = setInterval(() => {
      if (!active) { clearInterval(timerInterval); return; }
      timeLeft -= 0.1;
      timeText.text = Math.max(0, timeLeft).toFixed(1);
      if (timeLeft <= 0) endRound();
    }, 100);
    // ~60 notes over 30s: base 525ms + 18% chance of a chord second note
    spawnInterval = setInterval(() => {
      if (!active) { clearInterval(spawnInterval); return; }
      spawnNote(Math.floor(Math.random() * LANES));
      if (Math.random() < 0.18) {
        const l2 = Math.floor(Math.random() * LANES);
        setTimeout(() => { if (active) spawnNote(l2); }, 220);
      }
    }, 525);
  }

  function endRound() {
    active = false;
    if (timerInterval) clearInterval(timerInterval);
    if (spawnInterval) clearInterval(spawnInterval);
    for (const n of notes) {
      if (n.sprite && n.sprite.parent) n.sprite.parent.removeChild(n.sprite);
    }
    notes.length = 0;
    const payout = Math.floor(score / 1000 * curBet);
    store.record(game.id, curBet, payout);
    if (payout > 0) {
      store.pay(payout);
      const tier = payout >= curBet * 8 ? "mega" : payout >= curBet * 3 ? "big" : "win";
      if (tier === "mega") sfx.mega(); else if (tier === "big") sfx.big(); else sfx.win();
      host.onWin(tier, payout, {
        title: score + " pts · " + perfectCount + " perfect",
        line: "max combo x" + maxCombo
      });
    } else {
      sfx.lose();
      host.toast("Off-key tonight. Try again.", 2200);
    }
    updateStartBtn();
  }

  // ── Bet row + start ───────────────────────────────────────────────────────
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    curBet = [10, 25, 50, 100, 250][i]; updateStartBtn();
  }));

  const startBtn = makeButton(W - 16, 50, "SING · " + curBet, 0xf2c76e, 0x160b20);
  startBtn.x = 8; startBtn.y = H - 55;
  startBtn.interactive = true; startBtn.buttonMode = true;
  c.addChild(startBtn);
  function updateStartBtn() {
    startBtn.children[1].text = active ? "SINGING..." : "SING · " + curBet;
  }
  startBtn.on("pointertap", () => {
    if (active) return;
    sfx.click();
    startRound();
    updateStartBtn();
    setTimeout(() => { if (!active) updateStartBtn(); }, ROUND_TIME * 1000 + 500);
  });

  // ── Ticker: move notes + detect misses ────────────────────────────────────
  const tickerFn = (dt) => {
    const dts = Math.min(dt / 60, 0.04);
    for (const n of notes) {
      if (n.popping) {
        n.popT += dts;
        if (n.sprite) {
          n.sprite.scale.x *= 1 + dts * 4;
          n.sprite.scale.y *= 1 + dts * 4;
          n.sprite.alpha = Math.max(0, n.sprite.alpha - dts * 5);
        }
        if (n.popT > 0.3) {
          if (n.sprite && n.sprite.parent) n.sprite.parent.removeChild(n.sprite);
          n.sprite = null;
          n.remove = true;
        }
        continue;
      }
      if (n.missed) {
        n.missT += dts;
        if (n.sprite) n.sprite.alpha = Math.max(0, n.sprite.alpha - dts * 2);
        if (n.missT > 0.5) {
          if (n.sprite && n.sprite.parent) n.sprite.parent.removeChild(n.sprite);
          n.sprite = null;
          n.remove = true;
        }
        continue;
      }
      n.y += n.vy * dts;
      if (n.sprite) n.sprite.y = n.y;
      if (n.y > hitY + GOOD_WINDOW) {
        n.missed = true;
        combo = 0;
        missCount++;
        updateComboText();
        sfx.lose();
      }
    }
    for (let i = notes.length - 1; i >= 0; i--) {
      if (notes[i].remove) notes.splice(i, 1);
    }
  };
  pixiApp.ticker.add(tickerFn);

  return function cleanup() {
    pixiApp.ticker.remove(tickerFn);
    if (timerInterval) clearInterval(timerInterval);
    if (spawnInterval) clearInterval(spawnInterval);
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
