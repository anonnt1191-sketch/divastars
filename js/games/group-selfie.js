// games/group-selfie.js — Group Selfie. Pick 3-5 divas from a roster of 8.
// Each pair has a per-session "chemistry" score (0-100). Payout = sum of pairwise
// chemistry * bet / 100. Perfect Squad: 5 selected, all pairs > 50 → x10 multiplier.
// Chemistry web shown as colored lines between selected divas (gold=high, gray=low).

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const ROSTER_SIZE = 8;
const MAX_SELECTED = 5;
const MIN_SELECTED = 3;
const PERFECT_THRESHOLD = 50;

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  // background — pink/gold party vibe
  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  for (let i = 0; i < H; i += 4) {
    bg.beginFill(0xff2e88, 0.04 + (i / H) * 0.05).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb || "Pick the squad. Read the chemistry.",
    { fontFamily: "Outfit, sans-serif", fontSize: 14, fontStyle: "italic", fill: 0xff2e88 });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // ===== roster: 8 divas, always include vedhika =====
  const roster = shuffle(DIVA_IDS).slice(0, ROSTER_SIZE);
  if (!roster.includes("vedhika")) roster[Math.floor(Math.random() * roster.length)] = "vedhika";

  // chemistry matrix (symmetric, 0-100, 0 on diagonal)
  const chemistry = {};
  for (const a of roster) {
    chemistry[a] = chemistry[a] || {};
    for (const b of roster) {
      if (a === b) { chemistry[a][b] = 0; continue; }
      if (chemistry[b] && chemistry[b][a] != null) { chemistry[a][b] = chemistry[b][a]; continue; }
      chemistry[a][b] = Math.floor(Math.random() * 101);
    }
  }

  // ===== selfie preview (top) =====
  const innerW = W - 16;
  const previewH = 150;
  const previewY = 30;

  const previewBg = new PIXI.Graphics();
  previewBg.beginFill(0x1c0e2a, 0.7).drawRoundedRect(8, previewY, innerW, previewH, 12).endFill();
  c.addChild(previewBg);

  const previewContainer = new PIXI.Container();
  previewContainer.x = 8; previewContainer.y = previewY;
  c.addChild(previewContainer);

  const webLayer = new PIXI.Graphics();
  previewContainer.addChild(webLayer);
  const selContainer = new PIXI.Container();
  previewContainer.addChild(selContainer);

  const previewHint = new PIXI.Text("Tap divas below to build your squad", {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "600", fill: 0xb0b0b0, align: "center"
  });
  previewHint.anchor.set(0.5);
  previewHint.x = innerW / 2; previewHint.y = previewH / 2;
  previewContainer.addChild(previewHint);

  const payoutText = new PIXI.Text("", {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "900", fill: 0xf2c76e,
    align: "center", stroke: 0x160b20, strokeThickness: 3
  });
  payoutText.anchor.set(0.5, 1);
  payoutText.x = innerW / 2; payoutText.y = previewH - 8;
  previewContainer.addChild(payoutText);

  // ===== roster grid 4x2 =====
  const gridCols = 4, gridRows = 2, gap = 6;
  const cardW = Math.floor((innerW - (gridCols - 1) * gap) / gridCols);
  const cardH = Math.floor(cardW * 1.2);
  const gridW = gridCols * cardW + (gridCols - 1) * gap;
  const gridX = Math.floor((W - gridW) / 2);
  const gridY = previewY + previewH + 10;

  const rosterContainer = new PIXI.Container();
  rosterContainer.x = gridX; rosterContainer.y = gridY;
  c.addChild(rosterContainer);

  // ===== state =====
  const selected = []; // ordered ids
  const cards = [];    // { id, container, photoIdx, ring, badgeBg, badgeTx }
  let curBet = 25;

  for (let i = 0; i < roster.length; i++) {
    const id = roster[i];
    const row = Math.floor(i / gridCols), col = i % gridCols;
    const card = new PIXI.Container();
    card.x = col * (cardW + gap);
    card.y = row * (cardH + gap);
    rosterContainer.addChild(card);

    const cardBg = new PIXI.Graphics();
    cardBg.beginFill(0x1c0e2a).drawRoundedRect(0, 0, cardW, cardH, 10).endFill();
    card.addChild(cardBg);

    const photoHolder = new PIXI.Container();
    card.addChild(photoHolder);

    const photoIdx = Math.floor(Math.random() * 6);
    const photoUrl = friendPhoto(id, photoIdx);
    PIXI.Assets.load(photoUrl).then(tex => {
      if (card.destroyed) return;
      const photoAreaH = cardH - 18;
      const sp = new PIXI.Sprite(tex);
      const sc = Math.min(cardW/tex.width, photoAreaH/tex.height);
      sp.scale.set(sc);
      sp.x = (cardW - tex.width * sc) / 2;
      sp.y = (photoAreaH - tex.height * sc) / 2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(0, 0, cardW, photoAreaH, 10).endFill();
      photoHolder.addChild(mask);
      sp.mask = mask;
      photoHolder.addChild(sp);
    }).catch(() => {});

    const diva = DIVAS[id];
    const nameTx = new PIXI.Text(diva?.name || id, {
      fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700", fill: 0xffe9b8, align: "center"
    });
    nameTx.anchor.set(0.5, 1);
    nameTx.x = cardW / 2; nameTx.y = cardH - 3;
    card.addChild(nameTx);

    const ring = new PIXI.Graphics();
    ring.lineStyle(3, 0xffd700, 1).drawRoundedRect(0, 0, cardW, cardH, 10).endFill();
    ring.alpha = 0;
    card.addChild(ring);

    const badgeBg = new PIXI.Graphics();
    badgeBg.beginFill(0xffd700).drawCircle(0, 0, 11).endFill();
    badgeBg.x = cardW - 12; badgeBg.y = 12; badgeBg.alpha = 0;
    card.addChild(badgeBg);
    const badgeTx = new PIXI.Text("", {
      fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "900", fill: 0x160b20
    });
    badgeTx.anchor.set(0.5); badgeTx.x = cardW - 12; badgeTx.y = 12; badgeTx.alpha = 0;
    card.addChild(badgeTx);

    card.interactive = true; card.buttonMode = true;
    card.on("pointertap", () => { sfx.click(); toggleSelect(id); });

    cards.push({ id, container: card, photoIdx, ring, badgeBg, badgeTx });
  }

  // ===== bet row + selfie button =====
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    curBet = [10, 25, 50, 100, 250][i]; updateButton();
  }));

  const selfieBtn = makeButton(W - 16, 50, "TAKE SELFIE", 0xf2c76e, 0x160b20);
  selfieBtn.x = 8; selfieBtn.y = H - 52;
  selfieBtn.interactive = true; selfieBtn.buttonMode = true;
  c.addChild(selfieBtn);
  selfieBtn.on("pointertap", () => {
    sfx.click();
    if (selected.length < MIN_SELECTED) {
      host.toast("Pick " + MIN_SELECTED + "+ divas first.", 1400);
      return;
    }
    takeSelfie();
  });

  function updateButton() {
    const tx = selfieBtn.children[1];
    if (selected.length < MIN_SELECTED) {
      tx.text = "PICK " + (MIN_SELECTED - selected.length) + " MORE";
    } else {
      const proj = projectedPayout();
      tx.text = "TAKE SELFIE · ~" + proj.chips + " chips" + (proj.perfect ? " ★" : "");
    }
  }

  function projectedPayout() {
    if (selected.length < MIN_SELECTED) return { chips: 0, perfect: false, sum: 0 };
    let sum = 0, perfect = true;
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const v = chemistry[selected[i]][selected[j]];
        sum += v;
        if (v <= PERFECT_THRESHOLD) perfect = false;
      }
    }
    let mult = sum / 100;
    const perfectSquad = selected.length === MAX_SELECTED && perfect;
    if (perfectSquad) mult *= 10;
    return { chips: Math.floor(curBet * mult), perfect: perfectSquad, sum, mult };
  }

  function toggleSelect(id) {
    const idx = selected.indexOf(id);
    if (idx >= 0) selected.splice(idx, 1);
    else {
      if (selected.length >= MAX_SELECTED) {
        host.toast("Max " + MAX_SELECTED + " divas.", 1200);
        return;
      }
      selected.push(id);
    }
    updateSelectionVisuals();
    updateButton();
  }

  function updateSelectionVisuals() {
    for (const card of cards) {
      const idx = selected.indexOf(card.id);
      card.ring.alpha = idx >= 0 ? 1 : 0;
      card.badgeBg.alpha = idx >= 0 ? 1 : 0;
      card.badgeTx.alpha = idx >= 0 ? 1 : 0;
      card.badgeTx.text = idx >= 0 ? String(idx + 1) : "";
      card.container.alpha = idx >= 0 ? 1 : 0.62;
    }
    drawPreview();
  }

  function drawPreview() {
    webLayer.clear();
    // clear previous children (pills + score labels added on prior draws)
    for (let i = webLayer.children.length - 1; i >= 0; i--) {
      const ch = webLayer.children[i];
      webLayer.removeChild(ch);
      try { ch.destroy?.({ children: true }); } catch (e) {}
    }
    // clear previous selection sprites
    for (let i = selContainer.children.length - 1; i >= 0; i--) {
      const ch = selContainer.children[i];
      selContainer.removeChild(ch);
      try { ch.destroy?.({ children: true }); } catch (e) {}
    }

    if (selected.length === 0) {
      previewHint.text = "Tap divas below to build your squad";
      previewHint.alpha = 1;
      payoutText.text = "";
      return;
    }
    previewHint.alpha = 0;

    const n = selected.length;
    const slotW = Math.min(78, (innerW - (n - 1) * 8) / n);
    const slotH = Math.min(110, previewH - 40);
    const totalW = n * slotW + (n - 1) * 8;
    const startX = (innerW - totalW) / 2;
    const centerY = previewH / 2 - 8;

    const slots = [];
    for (let i = 0; i < n; i++) {
      const id = selected[i];
      const slot = new PIXI.Container();
      slot.x = startX + i * (slotW + 8);
      slot.y = centerY - slotH / 2;
      selContainer.addChild(slot);

      const ph = new PIXI.Container();
      slot.addChild(ph);

      const border = new PIXI.Graphics();
      border.lineStyle(2, 0xffd700, 0.9).drawRoundedRect(0, 0, slotW, slotH, 10).endFill();
      slot.addChild(border);

      const numBg = new PIXI.Graphics();
      numBg.beginFill(0xffd700).drawCircle(0, 0, 11).endFill();
      numBg.x = slotW - 8; numBg.y = 8;
      slot.addChild(numBg);
      const numTx = new PIXI.Text(String(i + 1), {
        fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "900", fill: 0x160b20
      });
      numTx.anchor.set(0.5); numTx.x = slotW - 8; numTx.y = 8;
      slot.addChild(numTx);

      const cardEntry = cards.find(c => c.id === id);
      const photoIdx = cardEntry?.photoIdx ?? 0;
      const url = friendPhoto(id, photoIdx);
      PIXI.Assets.load(url).then(tex => {
        if (slot.destroyed) return;
        const sp = new PIXI.Sprite(tex);
        const sc = Math.min(slotW/tex.width, slotH/tex.height);
        sp.scale.set(sc);
        sp.x = (slotW - tex.width * sc) / 2;
        sp.y = (slotH - tex.height * sc) / 2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(0, 0, slotW, slotH, 10).endFill();
        ph.addChild(mask);
        sp.mask = mask;
        ph.addChild(sp);
      }).catch(() => {});

      slots.push({ id, x: slot.x + slotW / 2, y: slot.y + slotH / 2 });
    }

    // chemistry web — lines between every pair, colored by score
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i], b = slots[j];
        const v = chemistry[a.id][b.id];
        const col = v > 70 ? 0xffd700 : v > PERFECT_THRESHOLD ? 0xf2c76e : v > 30 ? 0xff9e5d : 0x707080;
        const alpha = 0.45 + v / 220;
        webLayer.lineStyle(2 + Math.floor(v / 28), col, alpha)
               .moveTo(a.x, a.y)
               .lineTo(b.x, b.y);
        // pill with the score at midpoint
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const pill = new PIXI.Graphics();
        pill.beginFill(0x160b20, 0.88).drawRoundedRect(-15, -9, 30, 18, 6).endFill();
        pill.x = mx; pill.y = my;
        webLayer.addChild(pill);
        const pillTx = new PIXI.Text(String(v), {
          fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "800", fill: col
        });
        pillTx.anchor.set(0.5); pillTx.x = mx; pillTx.y = my;
        webLayer.addChild(pillTx);
      }
    }

    const proj = projectedPayout();
    if (proj.perfect) {
      payoutText.text = "PERFECT SQUAD! ~" + proj.chips + " chips (x10)";
      payoutText.style.fill = 0xffd700;
    } else if (proj.chips > 0) {
      payoutText.text = "~" + proj.chips + " chips";
      payoutText.style.fill = 0xf2c76e;
    } else {
      payoutText.text = "";
    }
  }

  async function takeSelfie() {
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    selfieBtn.interactive = false;
    sfx.whoosh();

    // camera flash on preview
    const flash = new PIXI.Graphics();
    flash.beginFill(0xffffff, 0.9).drawRoundedRect(0, 0, innerW, previewH, 12).endFill();
    previewContainer.addChild(flash);
    let t0 = 0;
    const flashFn = (dt) => {
      t0 += dt * 16.67;
      flash.alpha = Math.max(0, 1 - t0 / 480);
      if (t0 > 520) {
        pixiApp.ticker.remove(flashFn);
        previewContainer.removeChild(flash);
        flash.destroy();
      }
    };
    pixiApp.ticker.add(flashFn);
    await delay(520);

    const proj = projectedPayout();
    const win = proj.chips;
    store.pay(win);
    store.record(game.id, curBet, win);
    const tier = win >= curBet * 50 ? "jackpot" :
                 win >= curBet * 20 ? "mega" :
                 win >= curBet * 5 ? "big" : "win";
    if (win > 0) {
      sfx[tier]();
      host.onWin(tier, win, {
        title: proj.perfect ? "PERFECT SQUAD!" : selected.length + "-DIVA SELFIE",
        line: proj.perfect ? "Vedhika approved the squad." : "Squad chemistry: " + proj.sum
      });
    } else {
      sfx.lose();
      host.toast("Squad didn't make the cut. Lost " + curBet + " chips.", 2400);
    }
    selfieBtn.interactive = true;
    updateButton();
  }

  updateSelectionVisuals();
  updateButton();

  return function cleanup() {
    // no persistent tickers — animations clean themselves up
  };
}

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

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
