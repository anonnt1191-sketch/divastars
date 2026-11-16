// games/drops-wins.js — 5x3 photo slot with Drops & Wins bonus.
// Each spin: 0-3 random cells get a gold-star "drop" overlay.
// Drop bonus = drop_count * bet * 0.5. Plus 5% chance "Win Drop" event pays bet * 10 instantly.
// Uses reel-rush payline system: 10 lines, 3+ matching left-to-right pays.
// Payouts: 3-match=x2, 4-match=x5, 5-match=x10.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const REELS = 5, ROWS = 3;
const PAYLINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0],
  [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 1, 0, 1, 0]
];
const LINE_MULT = { 3: 2, 4: 5, 5: 10 };
const MAX_DROPS = 3;
const WIN_DROP_CHANCE = 0.05;
const WIN_DROP_MULT = 10;

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 11, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // layout — 5x3 reels, big cells
  const gap = 3;
  const cellSize = Math.floor((W - 16 - (REELS - 1) * gap) / REELS); // ~80px on 414-wide
  const reelH = ROWS * cellSize + (ROWS - 1) * gap;
  const reelAreaY = 32;
  const reelsW = REELS * cellSize + (REELS - 1) * gap;
  const reelX0 = Math.floor((W - reelsW) / 2);

  const reelsContainer = new PIXI.Container();
  reelsContainer.x = reelX0;
  reelsContainer.y = reelAreaY;
  c.addChild(reelsContainer);

  // build 5 reel columns
  const reelContainers = [];
  for (let i = 0; i < REELS; i++) {
    const rc = new PIXI.Container();
    rc.x = i * (cellSize + gap);
    rc.y = 0;
    const rbg = new PIXI.Graphics();
    rbg.lineStyle(2, 0xf2c76e, 0.18)
       .beginFill(0x1c0e2a)
       .drawRoundedRect(0, 0, cellSize, reelH, 8)
       .endFill();
    rc.addChild(rbg);
    reelsContainer.addChild(rc);
    reelContainers.push(rc);
  }

  // drop overlay layer (gold stars on top of cells)
  const dropLayer = new PIXI.Container();
  dropLayer.x = reelX0;
  dropLayer.y = reelAreaY;
  c.addChild(dropLayer);

  // payline overlay (gold lines on wins)
  const paylineOverlay = new PIXI.Graphics();
  paylineOverlay.x = reelX0;
  paylineOverlay.y = reelAreaY;
  c.addChild(paylineOverlay);

  // dual payout displays — line wins (left) + drop bonus (right)
  const lineWinText = new PIXI.Text("", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 14, fontWeight: "700", fill: 0xf2c76e, align: "left"
  });
  lineWinText.x = 8;
  lineWinText.y = reelAreaY + reelH + 10;
  c.addChild(lineWinText);

  const dropWinText = new PIXI.Text("", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 14, fontWeight: "700", fill: 0xffd700, align: "right"
  });
  dropWinText.anchor.set(1, 0);
  dropWinText.x = W - 8;
  dropWinText.y = reelAreaY + reelH + 10;
  c.addChild(dropWinText);

  // total win text below those
  const winText = new PIXI.Text("", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 18, fontWeight: "900", fill: 0xf2c76e,
    align: "center", stroke: 0x160b20, strokeThickness: 3
  });
  winText.anchor.set(0.5, 0);
  winText.x = W / 2;
  winText.y = reelAreaY + reelH + 38;
  c.addChild(winText);

  // state
  let grid = [];          // grid[reel][row] = symbol id
  let dropCells = [];     // array of { reel, row }
  let spinning = false;
  let curBet = 25;

  function pickSymbol() {
    return DIVA_IDS[Math.floor(Math.random() * DIVA_IDS.length)];
  }
  function photoURL(id) {
    return friendPhoto(id, Math.floor(Math.random() * 6));
  }
  function newGrid() {
    grid = [];
    for (let r = 0; r < REELS; r++) {
      const col = [];
      for (let row = 0; row < ROWS; row++) col.push(pickSymbol());
      grid.push(col);
    }
  }

  // pick 0..MAX_DROPS random cells for drop icons
  function pickDropCells() {
    dropCells = [];
    const n = Math.floor(Math.random() * (MAX_DROPS + 1)); // 0..3
    const all = [];
    for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) all.push({ reel: r, row });
    // shuffle and take n
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    for (let i = 0; i < n; i++) dropCells.push(all[i]);
  }

  function isDropCell(reel, row) {
    return dropCells.some(d => d.reel === reel && d.row === row);
  }

  async function drawGrid() {
    for (let r = 0; r < REELS; r++) {
      const rc = reelContainers[r];
      // remove old children except bg (index 0)
      for (let i = rc.children.length - 1; i >= 1; i--) {
        const ch = rc.removeChildAt(i);
        if (ch.destroy) ch.destroy();
      }
      for (let row = 0; row < ROWS; row++) {
        const id = grid[r][row];
        const cellY = row * (cellSize + gap);
        try {
          const tex = await PIXI.Assets.load(photoURL(id));
          if (rc.destroyed) continue;
          const sp = new PIXI.Sprite(tex);
          const scale = Math.min(cellSize/tex.width, cellSize/tex.height); // cover-fit
          sp.scale.set(scale);
          sp.x = (cellSize - tex.width * scale) / 2;
          sp.y = cellY + (cellSize - tex.height * scale) / 2;
          const cmask = new PIXI.Graphics();
          cmask.beginFill(0xffffff).drawRoundedRect(0, cellY, cellSize, cellSize, 6).endFill();
          rc.addChild(cmask);
          sp.mask = cmask;
          rc.addChild(sp);
          const border = new PIXI.Graphics();
          border.lineStyle(1, 0xf2c76e, 0.2)
                .drawRoundedRect(0, cellY, cellSize, cellSize, 6)
                .endFill();
          rc.addChild(border);
        } catch (e) {}
      }
    }
    drawDropOverlay();
  }

  function drawDropOverlay() {
    dropLayer.removeChildren();
    for (const d of dropCells) {
      const x = d.reel * (cellSize + gap) + cellSize - 18;
      const y = d.row * (cellSize + gap) + 4;
      // gold star (5-point)
      const star = new PIXI.Graphics();
      star.beginFill(0xffd700);
      const cx = 7, cy = 7, R = 7, r = 3;
      star.moveTo(cx, cy - R);
      for (let i = 0; i < 5; i++) {
        const a1 = -Math.PI / 2 + (i + 0.5) * (Math.PI * 2 / 5);
        const a2 = -Math.PI / 2 + (i + 1) * (Math.PI * 2 / 5);
        star.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
        star.lineTo(cx + Math.cos(a2) * R, cy + Math.sin(a2) * R);
      }
      star.closePath();
      star.endFill();
      star.x = x;
      star.y = y;
      dropLayer.addChild(star);
    }
  }

  // initial
  newGrid();
  pickDropCells();
  drawGrid();

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    curBet = [10, 25, 50, 100, 250][i]; updateSpinBtn();
  }));

  const spinBtn = makeButton(W - 16, 50, t("common.spin") + " · " + curBet, 0xf2c76e, 0x160b20);
  spinBtn.x = 8; spinBtn.y = H - 50;
  spinBtn.interactive = true; spinBtn.buttonMode = true;
  c.addChild(spinBtn);

  function updateSpinBtn() {
    spinBtn.children[1].text = t("common.spin") + " · " + curBet;
  }

  spinBtn.on("pointertap", () => { sfx.click(); spin(); });

  async function spin() {
    if (spinning) return;
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    spinning = true;
    sfx.whoosh();
    paylineOverlay.clear();
    lineWinText.text = "";
    dropWinText.text = "";
    winText.text = "";

    newGrid();
    pickDropCells();

    // staggered reel reveals
    for (let r = 0; r < REELS; r++) {
      await delay(180);
      if (r === REELS - 1) sfx.tick();
    }
    await drawGrid();

    // 1) Win Drop event (5% chance, instant)
    let winDropWin = 0;
    if (Math.random() < WIN_DROP_CHANCE) {
      winDropWin = curBet * WIN_DROP_MULT;
      sfx.big();
      host.onWin("big", winDropWin, { title: "WIN DROP!", line: "Instant bonus" });
    }

    // 2) Line wins
    const lineWins = evaluateLines();
    let lineWin = 0;
    for (const w of lineWins) lineWin += w.amount;
    if (lineWins.length > 0) {
      drawPaylines(lineWins);
    }

    // 3) Drop bonus
    const dropCount = dropCells.length;
    const dropBonus = Math.floor(dropCount * curBet * 0.5);

    const totalWin = lineWin + dropBonus + winDropWin;

    if (totalWin > 0) {
      store.pay(totalWin);
      const tier = totalWin >= curBet * 100 ? "jackpot" :
                   totalWin >= curBet * 25 ? "mega" :
                   totalWin >= curBet * 10 ? "big" : "win";
      if (lineWins.length > 0 || dropBonus > 0) sfx[tier]();
      host.onWin(tier, totalWin, {
        title: tier.toUpperCase(),
        line: dropBonus > 0 ? `${dropCount} drops collected` : ""
      });
    } else {
      sfx.lose();
    }
    store.record(game.id, curBet, totalWin);

    lineWinText.text = lineWin > 0 ? `Lines: +${lineWin.toLocaleString("en-US")}` : "";
    dropWinText.text = dropBonus > 0 ? `Drops (${dropCount}): +${dropBonus.toLocaleString("en-US")}` : "";
    winText.text = totalWin > 0 ? `Total: +${totalWin.toLocaleString("en-US")}` : "";

    spinning = false;
  }

  function evaluateLines() {
    const wins = [];
    for (let li = 0; li < PAYLINES.length; li++) {
      const line = PAYLINES[li];
      let symbol = null, count = 0;
      for (let r = 0; r < REELS; r++) {
        const s = grid[r][line[r]];
        if (symbol === null) { symbol = s; count++; }
        else if (s === symbol) count++;
        else break;
      }
      if (symbol && count >= 3) {
        const mult = LINE_MULT[count] || 0;
        wins.push({ lineIdx: li, symbol, count, amount: curBet * mult });
      }
    }
    return wins;
  }

  function drawPaylines(wins) {
    paylineOverlay.clear();
    for (const w of wins) {
      const line = PAYLINES[w.lineIdx];
      const pts = [];
      for (let r = 0; r < w.count; r++) {
        const row = line[r];
        const x = r * (cellSize + gap) + cellSize / 2;
        const y = row * (cellSize + gap) + cellSize / 2;
        pts.push(x, y);
      }
      if (pts.length >= 4) {
        paylineOverlay.lineStyle(3, 0xff2e88, 0.85)
                      .moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) paylineOverlay.lineTo(pts[i], pts[i + 1]);
        paylineOverlay.endFill();
      }
    }
  }

  return function cleanup() {};
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 16, fontWeight: "700", fill: fg
  });
  tx.anchor.set(0.5);
  tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}
