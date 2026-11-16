// games/ex-revenge.js — The Ex's Revenge. High-volatility 5x3 photo slot.
// 10 fixed paylines. 8 random divas (low-value) + WILD (Vedhika) + SCATTER (The Ex).
// Line wins: 3 = x2, 4 = x5, 5 = x25. 3+ SCATTER triggers the Revenge feature:
//   • She "steals" your current line wins (displayed in a red overlay counter).
//   • Awards 5 free spins with x5 multiplier.
//   • During free spins, 3+ more Exes pays back 2x what she stole + applies x10 mult
//     to that spin's line wins (overriding the x5 base for that spin).

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { EX, DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const REELS = 5;
const ROWS = 3;
const PAYLINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0],
  [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 1, 0, 1, 0]
];
const LINE_COLORS = [
  0xff2e88, 0xf2c76e, 0x57d38f, 0xd946ef, 0xffd700,
  0x38bdf8, 0xfb923c, 0xa855f7, 0x2dd4bf, 0xe11d48
];

const BET_AMOUNTS = [10, 25, 50, 100, 250];
const SCATTER_TRIGGER = 3;
const FREE_SPINS_AWARD = 5;
const FREE_SPIN_BASE_MULT = 5;
const FREE_SPIN_EX_MULT = 10;
const STEAL_PAYBACK_MULT = 2;

// Symbol weights per cell (tuned for high volatility):
// 4% wild, 4% scatter, 92% diva (8 divas equally weighted -> ~11.5% each).
const WILD_P = 0.04;
const SCATTER_P = 0.04;

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  // ===== background =====
  const bg = new PIXI.Graphics();
  bg.beginFill(0x0a0610, 0.75).drawRect(0, 0, W, H).endFill();
  // red gradient hint (Revenge theme)
  for (let i = 0; i < H; i += 4) {
    const a = 0.03 + (i / H) * 0.10;
    bg.beginFill(0x7c1d3f, a).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb || "", {
    fontFamily: "Outfit, sans-serif", fontSize: 12, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // ===== state =====
  // pick 8 random divas as base symbols (exclude vedhika — she's WILD)
  const baseDivaPool = DIVA_IDS.filter(id => id !== "vedhika");
  // shuffle + take 8
  const symbolDivas = shuffle(baseDivaPool).slice(0, 8);

  let curBet = 25;
  let spinning = false;
  let grid = [];
  let freeSpins = 0;
  let stolenAmount = 0;       // chips stolen by The Ex on the triggering spin
  let revengeActive = false; // whether Revenge feature is currently in progress
  const tickersToCleanup = [];
  const timeoutsToCleanup = [];

  // ===== free spins banner (top, hidden initially) =====
  const bannerH = 30;
  const bannerY = 22;
  const banner = new PIXI.Container();
  banner.x = 8;
  banner.y = bannerY;
  banner.visible = false;
  c.addChild(banner);
  const bannerBg = new PIXI.Graphics();
  bannerBg.beginFill(0x7c1d3f, 0.9).drawRoundedRect(0, 0, W - 16, bannerH, 6).endFill();
  bannerBg.beginFill(0xff2e88, 0.7).drawRoundedRect(0, 0, W - 16, 3, 2).endFill();
  banner.addChild(bannerBg);
  const bannerText = new PIXI.Text("", {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "900",
    fill: 0xffe9b8, align: "center"
  });
  bannerText.anchor.set(0.5, 0.5);
  bannerText.x = (W - 16) / 2;
  bannerText.y = bannerH / 2;
  banner.addChild(bannerText);

  function updateBanner() {
    if (freeSpins > 0 || stolenAmount > 0) {
      banner.visible = true;
      const parts = [];
      if (freeSpins > 0) parts.push(`FREE SPINS: ${freeSpins} · x${FREE_SPIN_BASE_MULT}`);
      if (stolenAmount > 0) parts.push(`STOLEN: ${stolenAmount}`);
      bannerText.text = parts.join("  ·  ");
    } else {
      banner.visible = false;
    }
  }

  // ===== reel area =====
  const reelAreaY = bannerY + bannerH + 10;
  const reelAreaH = Math.min(H - reelAreaY - 220, 320);
  const reelGap = 4;
  const reelW = (W - 16 - reelGap * (REELS - 1)) / REELS;
  const reelH = reelAreaH;
  const cellH = reelH / ROWS;

  const reelsContainer = new PIXI.Container();
  reelsContainer.x = 8;
  reelsContainer.y = reelAreaY;
  c.addChild(reelsContainer);

  const reelContainers = [];
  for (let i = 0; i < REELS; i++) {
    const rc = new PIXI.Container();
    rc.x = i * (reelW + reelGap);
    rc.y = 0;
    const rbg = new PIXI.Graphics();
    rbg.beginFill(0x1a0c1c).drawRoundedRect(0, 0, reelW, reelH, 8).endFill();
    rbg.lineStyle(2, 0x7c1d3f, 0.5)
      .beginFill(0x1a0c1c, 0)
      .drawRoundedRect(0, 0, reelW, reelH, 8)
      .endFill();
    rc.addChild(rbg);
    reelsContainer.addChild(rc);
    reelContainers.push(rc);
  }

  // paylines overlay
  const paylineOverlay = new PIXI.Graphics();
  paylineOverlay.x = 8;
  paylineOverlay.y = reelAreaY;
  c.addChild(paylineOverlay);

  // win text below reels
  const winText = new PIXI.Text("", {
    fontFamily: "Outfit, sans-serif",
    fontSize: 16, fontWeight: "900", fill: 0xffe9b8,
    stroke: 0x160b20, strokeThickness: 3,
    align: "center", wordWrap: true, wordWrapWidth: W - 16
  });
  winText.anchor.set(0.5, 0);
  winText.x = W / 2;
  winText.y = reelAreaY + reelAreaH + 6;
  c.addChild(winText);

  // ===== grid generation =====
  function pickSymbol() {
    const r = Math.random();
    if (r < WILD_P) return "wild";
    if (r < WILD_P + SCATTER_P) return "scatter";
    return symbolDivas[Math.floor(Math.random() * symbolDivas.length)];
  }

  function newGrid() {
    grid = [];
    for (let r = 0; r < REELS; r++) {
      const col = [];
      for (let row = 0; row < ROWS; row++) col.push(pickSymbol());
      grid.push(col);
    }
  }

  function symbolPhoto(id) {
    if (id === "wild") return friendPhoto("vedhika", Math.floor(Math.random() * 6));
    if (id === "scatter") return EX.photo;  // "assets/ui/boss-ex.jpg"
    return friendPhoto(id, Math.floor(Math.random() * 6));
  }

  async function drawGrid(highlightWins) {
    // clear reels (keep background at index 0)
    for (let r = 0; r < REELS; r++) {
      const rc = reelContainers[r];
      for (let i = rc.children.length - 1; i >= 1; i--) rc.removeChildAt(i);
    }
    paylineOverlay.clear();

    const drawPromises = [];
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        const id = grid[r][row];
        drawPromises.push(drawCell(r, row, id));
      }
    }
    await Promise.all(drawPromises);

    if (highlightWins && highlightWins.length > 0) {
      drawPaylines(highlightWins);
    }
  }

  async function drawCell(reelIdx, rowIdx, id) {
    const rc = reelContainers[reelIdx];
    try {
      const tex = await PIXI.Assets.load(symbolPhoto(id));
      if (!tex || rc.destroyed) return;
      const sp = new PIXI.Sprite(tex);
      // cover-fit (fill the cell completely, crop overflow)
      const scale = Math.min(reelW/tex.width, cellH/tex.height);
      sp.scale.set(scale);
      sp.x = (reelW - tex.width * scale) / 2;
      sp.y = rowIdx * cellH + (cellH - tex.height * scale) / 2;
      // cell mask
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff)
        .drawRoundedRect(0, rowIdx * cellH, reelW, cellH, 0)
        .endFill();
      rc.addChild(mask);
      sp.mask = mask;
      rc.addChild(sp);

      // badge for special symbols
      if (id === "wild" || id === "scatter") {
        const badgeColor = id === "wild" ? 0xff2e88 : 0xff5d5d;
        const badgeText = id === "wild" ? "WILD" : "EX";
        const badge = new PIXI.Graphics();
        badge.beginFill(badgeColor)
          .drawRoundedRect(2, rowIdx * cellH + 2, 36, 14, 4)
          .endFill();
        rc.addChild(badge);
        const btx = new PIXI.Text(badgeText, {
          fontFamily: "Outfit, sans-serif",
          fontSize: 9, fontWeight: "900", fill: 0xffffff
        });
        btx.x = 6; btx.y = rowIdx * cellH + 4;
        rc.addChild(btx);
        // red border for scatter
        if (id === "scatter") {
          const border = new PIXI.Graphics();
          border.lineStyle(2, 0xff5d5d, 0.9)
            .beginFill(0x1a0c1c, 0)
            .drawRoundedRect(1, rowIdx * cellH + 1, reelW - 2, cellH - 2, 0)
            .endFill();
          rc.addChild(border);
        }
      }
    } catch (e) {}
  }

  function drawPaylines(wins) {
    paylineOverlay.clear();
    for (const w of wins) {
      const line = PAYLINES[w.lineIdx];
      const color = LINE_COLORS[w.lineIdx % LINE_COLORS.length];
      // x = center of reel r; y = center of row line[r]
      paylineOverlay.lineStyle(3, color, 0.85);
      paylineOverlay.moveTo(reelW / 2, line[0] * cellH + cellH / 2);
      for (let r = 1; r < REELS; r++) {
        const x = r * (reelW + reelGap) + reelW / 2;
        const y = line[r] * cellH + cellH / 2;
        paylineOverlay.lineTo(x, y);
      }
      paylineOverlay.endFill();
    }
  }

  // initial grid
  newGrid();
  drawGrid([]);

  // ===== bet row =====
  const betRow = host.betRow(curBet);
  betRow.x = 8;
  betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    if (spinning) return;
    curBet = BET_AMOUNTS[i];
    updateSpinBtn();
  }));

  // ===== spin button =====
  const spinBtn = makeButton(W - 16, 60, spinLabel(), 0xff2e88, 0xffffff);
  spinBtn.x = 8;
  spinBtn.y = H - 50;
  spinBtn.interactive = true;
  spinBtn.buttonMode = true;
  c.addChild(spinBtn);

  function spinLabel() {
    if (freeSpins > 0) return `FREE SPIN · ${freeSpins} LEFT · x${FREE_SPIN_BASE_MULT}`;
    return `SPIN · ${curBet}`;
  }
  function updateSpinBtn() {
    spinBtn.children[1].text = spinLabel();
  }
  spinBtn.on("pointertap", () => {
    sfx.click();
    if (spinning) return;
    if (freeSpins > 0) return; // auto-spins
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    spin();
  });

  // ===== Revenge overlay (one-shot modal when triggered) =====
  const revengeOverlay = new PIXI.Container();
  revengeOverlay.x = W / 2;
  revengeOverlay.y = H / 2;
  revengeOverlay.visible = false;
  c.addChild(revengeOverlay);

  function showRevengeOverlay(stolenAmountVal) {
    revengeOverlay.removeChildren();
    revengeOverlay.visible = true;
    revengeOverlay.alpha = 0;

    // dim bg
    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.85).drawRect(-W / 2, -H / 2, W, H).endFill();
    dim.interactive = true;
    revengeOverlay.addChild(dim);

    // panel
    const pw = Math.min(W - 32, 360);
    const ph = 220;
    const panel = new PIXI.Graphics();
    panel.lineStyle(3, 0xff5d5d, 0.9)
      .beginFill(0x1a0c1c, 0.98)
      .drawRoundedRect(-pw / 2, -ph / 2, pw, ph, 16)
      .endFill();
    panel.beginFill(0xff5d5d, 0.7).drawRoundedRect(-pw / 2, -ph / 2, pw, 5, 2).endFill();
    revengeOverlay.addChild(panel);

    // Ex photo (left side)
    const exPhotoSize = 90;
    const exPhotoX = -pw / 2 + 12 + exPhotoSize / 2;
    PIXI.Assets.load(EX.photo).then(tex => {
      if (!tex || revengeOverlay.destroyed) return;
      const sp = new PIXI.Sprite(tex);
      const scale = exPhotoSize / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5);
      sp.x = exPhotoX;
      sp.y = 0;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(
        exPhotoX - exPhotoSize / 2, -exPhotoSize / 2, exPhotoSize, exPhotoSize, 8
      ).endFill();
      revengeOverlay.addChild(mask);
      sp.mask = mask;
      revengeOverlay.addChild(sp);
      // red ring
      const ring = new PIXI.Graphics();
      ring.lineStyle(3, 0xff5d5d, 1)
        .beginFill(0x1a0c1c, 0)
        .drawRoundedRect(
          exPhotoX - exPhotoSize / 2 - 2, -exPhotoSize / 2 - 2,
          exPhotoSize + 4, exPhotoSize + 4, 10
        ).endFill();
      revengeOverlay.addChild(ring);
    }).catch(() => {});

    // text (right side)
    const txX = exPhotoX + exPhotoSize / 2 + 12;
    const txW = pw / 2 - txX - 8;
    const title = new PIXI.Text("THE EX\nSTRIKES", {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 22, fontStyle: "italic", fontWeight: "900", fill: 0xff5d5d,
      align: "left", lineHeight: 24
    });
    title.anchor.set(0, 0.5);
    title.x = txX;
    title.y = -32;
    revengeOverlay.addChild(title);

    const stolenTx = new PIXI.Text(
      stolenAmountVal > 0 ? `Stole: ${stolenAmountVal}` : "Stole: nothing",
      {
        fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "700", fill: 0xffe9b8,
        wordWrap: true, wordWrapWidth: txW
      }
    );
    stolenTx.anchor.set(0, 0.5);
    stolenTx.x = txX;
    stolenTx.y = 0;
    revengeOverlay.addChild(stolenTx);

    const fsTx = new PIXI.Text(
      `+${FREE_SPINS_AWARD} free spins · x${FREE_SPIN_BASE_MULT}`,
      {
        fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "700", fill: 0xff2e88,
        wordWrap: true, wordWrapWidth: txW
      }
    );
    fsTx.anchor.set(0, 0.5);
    fsTx.x = txX;
    fsTx.y = 22;
    revengeOverlay.addChild(fsTx);

    sfx.crash();
    // fade in then out
    let el = 0;
    const fn = (dt) => {
      el += dt * 16.67;
      if (el < 250) {
        revengeOverlay.alpha = el / 250;
      } else if (el < 2000) {
        revengeOverlay.alpha = 1;
      } else if (el < 2400) {
        revengeOverlay.alpha = 1 - (el - 2000) / 400;
      } else {
        revengeOverlay.visible = false;
        revengeOverlay.alpha = 0;
        pixiApp.ticker.remove(fn);
      }
    };
    pixiApp.ticker.add(fn);
    tickersToCleanup.push(fn);
  }

  // ===== Payback overlay (when 3+ Exes during a free spin) =====
  function showPaybackOverlay(paybackAmount) {
    const ov = new PIXI.Container();
    ov.x = W / 2;
    ov.y = H / 2;
    ov.alpha = 0;
    c.addChild(ov);
    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.85).drawRect(-W / 2, -H / 2, W, H).endFill();
    dim.interactive = true;
    ov.addChild(dim);
    const pw = Math.min(W - 32, 340);
    const ph = 180;
    const panel = new PIXI.Graphics();
    panel.lineStyle(3, 0xffd700, 0.9)
      .beginFill(0x1a0c1c, 0.98)
      .drawRoundedRect(-pw / 2, -ph / 2, pw, ph, 16)
      .endFill();
    panel.beginFill(0xffd700, 0.7).drawRoundedRect(-pw / 2, -ph / 2, pw, 5, 2).endFill();
    ov.addChild(panel);
    const title = new PIXI.Text("SHE PAYS\nYOU BACK", {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 24, fontStyle: "italic", fontWeight: "900", fill: 0xffd700,
      align: "center", lineHeight: 28
    });
    title.anchor.set(0.5);
    title.y = -28;
    ov.addChild(title);
    const amtTx = new PIXI.Text(
      `+${paybackAmount} chips · x${FREE_SPIN_EX_MULT} on this spin`,
      {
        fontFamily: "Outfit, sans-serif", fontSize: 15, fontWeight: "900", fill: 0xffe9b8,
        align: "center", wordWrap: true, wordWrapWidth: pw - 16
      }
    );
    amtTx.anchor.set(0.5);
    amtTx.y = 22;
    ov.addChild(amtTx);
    sfx.big();
    let el = 0;
    const fn = (dt) => {
      el += dt * 16.67;
      if (el < 250) ov.alpha = el / 250;
      else if (el < 1800) ov.alpha = 1;
      else if (el < 2200) ov.alpha = 1 - (el - 1800) / 400;
      else {
        c.removeChild(ov);
        ov.destroy({ children: true });
        pixiApp.ticker.remove(fn);
      }
    };
    pixiApp.ticker.add(fn);
    tickersToCleanup.push(fn);
  }

  // ===== spin logic =====
  async function spin() {
    if (spinning) return;
    const isFree = freeSpins > 0;
    // Consume one free spin up-front when this is a free spin (so the banner
    // updates immediately and the remaining-count math is correct).
    if (isFree) {
      freeSpins--;
      updateBanner();
      updateSpinBtn();
    }
    const cost = isFree ? 0 : curBet;
    if (cost > 0 && !store.bet(cost)) { host.toast(t("toast.betTooHigh")); return; }
    spinning = true;
    paylineOverlay.clear();
    winText.text = "";

    sfx.whoosh();

    // generate new grid
    newGrid();

    // animate reels (stagger) — show "spinning" indicator
    winText.text = "REVEALING...";
    const animPromises = [];
    for (let r = 0; r < REELS; r++) {
      animPromises.push(animateReel(r, 350 + r * 180));
    }
    await Promise.all(animPromises);

    // evaluate
    const result = evaluate();
    const lineWinBase = result.wins.reduce((s, w) => s + w.amount, 0);

    let lineMult = 1;
    let paybackAmount = 0;
    let revengeTriggered = false;
    let paybackTriggered = false;

    if (isFree) {
      // free spin base mult
      lineMult = FREE_SPIN_BASE_MULT;
      if (result.scatterCount >= SCATTER_TRIGGER) {
        // payback 2x stolen + override mult to x10 for this spin
        paybackAmount = stolenAmount * STEAL_PAYBACK_MULT;
        lineMult = FREE_SPIN_EX_MULT;
        paybackTriggered = true;
        // reset stolen
        stolenAmount = 0;
      }
    } else {
      // base spin
      if (result.scatterCount >= SCATTER_TRIGGER) {
        // steal this spin's line wins
        stolenAmount = lineWinBase;
        freeSpins = FREE_SPINS_AWARD;
        revengeActive = true;
        revengeTriggered = true;
      }
    }

    const lineWinPaid = Math.floor(lineWinBase * lineMult);
    const totalWin = lineWinPaid + paybackAmount;

    // During Revenge trigger on base spin: line wins are STOLEN (not paid)
    const amountToPay = revengeTriggered ? paybackAmount : totalWin;
    if (amountToPay > 0) {
      store.pay(amountToPay);
    }

    // draw final grid + paylines
    await drawGrid(result.wins);

    // FX + win text
    if (revengeTriggered) {
      // show Revenge overlay
      showRevengeOverlay(stolenAmount);
      winText.text = lineWinBase > 0
        ? `STOLEN ${lineWinBase} · ${FREE_SPINS_AWARD} free spins`
        : `Nothing to steal · ${FREE_SPINS_AWARD} free spins`;
    } else if (paybackTriggered) {
      showPaybackOverlay(paybackAmount);
      winText.text = `PAYBACK +${paybackAmount} · spin x${FREE_SPIN_EX_MULT} = +${lineWinPaid}`;
    } else if (totalWin > 0) {
      const tier = totalWin >= curBet * 50 ? "jackpot"
                 : totalWin >= curBet * 15 ? "mega"
                 : totalWin >= curBet * 5 ? "big" : "win";
      sfx[tier]();
      host.onWin(tier, totalWin, {
        title: tier.toUpperCase(),
        line: isFree ? `Free spin · x${lineMult}` : "Base spin"
      });
      winText.text = `+${totalWin.toLocaleString("en-US")} chips${isFree ? ` · free spin x${lineMult}` : ""}`;
    } else {
      if (result.scatterCount > 0 && result.scatterCount < SCATTER_TRIGGER) {
        winText.text = `${result.scatterCount} Ex${result.scatterCount === 1 ? "" : "es"} (need 3)`;
      } else {
        winText.text = "No win";
      }
      sfx.lose();
    }

    store.record(game.id, cost, amountToPay);
    updateBanner();
    updateSpinBtn();

    // free-spin flow: if there are remaining free spins, schedule the next one.
    if (freeSpins > 0) {
      const tid = setTimeout(() => {
        spinning = false;
        spin();
      }, 1500);
      timeoutsToCleanup.push(tid);
    } else {
      // no free spins left — end Revenge if it was active
      if (revengeActive) {
        revengeActive = false;
        stolenAmount = 0;
        updateBanner();
      }
      spinning = false;
      updateSpinBtn();
    }
  }

  async function animateReel(reelIdx, durationMs) {
    // simple wait — actual draw happens after settle. Could add scroll polish later.
    return new Promise(r => {
      const tid = setTimeout(r, durationMs);
      timeoutsToCleanup.push(tid);
    });
  }

  function evaluate() {
    const wins = [];
    let scatterCount = 0;
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        if (grid[r][row] === "scatter") scatterCount++;
      }
    }
    // paylines — left-to-right matching (wild substitutes)
    for (let li = 0; li < PAYLINES.length; li++) {
      const line = PAYLINES[li];
      let symbol = null;
      let count = 0;
      for (let r = 0; r < REELS; r++) {
        const s = grid[r][line[r]];
        if (s === "scatter") break;       // scatter doesn't participate in lines
        if (s === "wild") { count++; continue; }  // wild substitutes
        if (symbol === null) { symbol = s; count++; }
        else if (s === symbol) count++;
        else break;
      }
      if (symbol && count >= 3) {
        const mult = count === 5 ? 25 : count === 4 ? 5 : 2;
        wins.push({ lineIdx: li, symbol, count, amount: curBet * mult });
      }
    }
    return { wins, scatterCount };
  }

  return function cleanup() {
    for (const fn of tickersToCleanup) {
      try { pixiApp.ticker.remove(fn); } catch (e) {}
    }
    for (const tid of timeoutsToCleanup) {
      try { clearTimeout(tid); } catch (e) {}
    }
  };
}

// ===== helpers =====
function shuffle(arr) {
  const b = [...arr];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).lineStyle(2, 0xffd700, 0.5).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif",
    fontSize: 16, fontWeight: "900", fill: fg, align: "center"
  });
  tx.anchor.set(0.5);
  tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}
