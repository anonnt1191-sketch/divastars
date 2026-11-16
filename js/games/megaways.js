// games/megaways.js — 6-reel Megaways photo slot. Variable reel heights 2-7 per spin,
// up to 117,649 ways. Vedhika WILD substitutes. Cascade wins with chain reactions.
// Anticipation: if first 3 reels match, reel 4 reveals slower.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const REELS = 6;
const MIN_H = 2, MAX_H = 7;
const WILD_ID = "vedhika";
// run-length → multiplier: 3=x1, 4=x5, 5=x25, 6=x100
const RUN_MULT = [0, 0, 0, 1, 5, 25, 100];
const MAX_WIN_MULT = 50000; // safety cap per spin

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  // tagline
  const tagline = new PIXI.Text(game.tagline || game.blurb, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 11, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // layout — 6 reels across full width, each reel column has variable cell count
  const cellSize = Math.floor((W - 16 - 5 * 3) / REELS); // ~60px on 414-wide
  const gap = 3;
  const reelColW = cellSize;
  const reelMaxH = MAX_H * cellSize; // 420px
  const reelAreaY = 32;
  const reelAreaH = Math.min(reelMaxH, H - reelAreaY - 210);

  // if reelAreaH is too small, scale cells down so 7 fit
  const usableCell = Math.min(cellSize, Math.floor(reelAreaH / MAX_H));
  const finalCell = Math.max(40, usableCell);
  const finalMaxH = finalCell * MAX_H;

  const reelsContainer = new PIXI.Container();
  reelsContainer.x = Math.floor((W - (REELS * finalCell + (REELS - 1) * gap)) / 2);
  reelsContainer.y = reelAreaY;
  c.addChild(reelsContainer);

  // build reel columns — each column is its own container with a mask
  const reelContainers = [];
  for (let i = 0; i < REELS; i++) {
    const rc = new PIXI.Container();
    rc.x = i * (finalCell + gap);
    rc.y = 0;
    const rbg = new PIXI.Graphics();
    rbg.lineStyle(2, 0xf2c76e, 0.18)
       .beginFill(0x1c0e2a)
       .drawRoundedRect(0, 0, finalCell, finalMaxH, 6)
       .endFill();
    rc.addChild(rbg);
    // mask so cells outside the visible area are clipped (we render full strip)
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff).drawRoundedRect(0, 0, finalCell, finalMaxH, 6).endFill();
    reelsContainer.addChild(mask);
    rc.mask = mask;
    reelsContainer.addChild(rc);
    reelContainers.push(rc);
  }

  // Ways counter — big and prominent at top of play area
  const waysBg = new PIXI.Graphics();
  waysBg.lineStyle(2, 0xf2c76e, 0.5)
        .beginFill(0x1c0e2a)
        .drawRoundedRect(0, 0, 180, 28, 14)
        .endFill();
  waysBg.x = W / 2 - 90;
  waysBg.y = reelAreaY + finalMaxH + 6;
  c.addChild(waysBg);

  const waysText = new PIXI.Text("0 WAYS", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 16, fontWeight: "900", fill: 0xf2c76e, align: "center"
  });
  waysText.anchor.set(0.5, 0.5);
  waysText.x = W / 2;
  waysText.y = waysBg.y + 14;
  c.addChild(waysText);

  // win display
  const winText = new PIXI.Text("", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 18, fontWeight: "900", fill: 0xf2c76e,
    align: "center", stroke: 0x160b20, strokeThickness: 3
  });
  winText.anchor.set(0.5, 0);
  winText.x = W / 2;
  winText.y = waysBg.y + 36;
  c.addChild(winText);

  // state
  let grid = [];          // grid[r] = array of symbol ids (length = reel height)
  let reelHeights = [];   // current height per reel
  let spinning = false;
  let curBet = 25;
  let cleanupFns = [];

  function pickSymbol() {
    // Vedhika WILD — ~4% chance; else random diva
    if (Math.random() < 0.04) return WILD_ID;
    return DIVA_IDS[Math.floor(Math.random() * DIVA_IDS.length)];
  }

  function photoURL(id) {
    return friendPhoto(id, Math.floor(Math.random() * 6));
  }

  function rollHeights() {
    reelHeights = [];
    for (let i = 0; i < REELS; i++) {
      reelHeights.push(MIN_H + Math.floor(Math.random() * (MAX_H - MIN_H + 1)));
    }
  }

  function newGrid() {
    rollHeights();
    grid = [];
    for (let r = 0; r < REELS; r++) {
      const col = [];
      for (let i = 0; i < reelHeights[r]; i++) col.push(pickSymbol());
      grid.push(col);
    }
  }

  function countWays() {
    let ways = 1;
    for (let r = 0; r < REELS; r++) ways *= reelHeights[r];
    return ways;
  }

  function updateWaysText() {
    const w = countWays();
    waysText.text = w.toLocaleString("en-US") + " WAYS";
  }

  // Build sprites for one reel. We render the visible cells only.
  async function drawReel(r) {
    const rc = reelContainers[r];
    // remove children except the bg (index 0)
    for (let i = rc.children.length - 1; i >= 1; i--) {
      const ch = rc.removeChildAt(i);
      if (ch.destroy) ch.destroy();
    }
    const col = grid[r];
    const n = col.length;
    const cellH = finalCell;
    for (let row = 0; row < n; row++) {
      const id = col[row];
      const cellY = row * cellH;
      try {
        const tex = await PIXI.Assets.load(photoURL(id));
        if (rc.destroyed) return;
        const sp = new PIXI.Sprite(tex);
        const scale = Math.min(finalCell/tex.width, finalCell/tex.height); // cover-fit
        sp.scale.set(scale);
        sp.x = (finalCell - tex.width * scale) / 2;
        sp.y = cellY + (finalCell - tex.height * scale) / 2;
        // mask sprite to cell bounds (cover-fit crops overflow)
        const cmask = new PIXI.Graphics();
        cmask.beginFill(0xffffff).drawRoundedRect(0, cellY, finalCell, finalCell, 4).endFill();
        rc.addChild(cmask);
        sp.mask = cmask;
        rc.addChild(sp);
        // gold border per cell
        const border = new PIXI.Graphics();
        border.lineStyle(1, 0xf2c76e, 0.25)
              .drawRoundedRect(0, cellY, finalCell, finalCell, 4)
              .endFill();
        rc.addChild(border);
        // WILD badge
        if (id === WILD_ID) {
          const badge = new PIXI.Graphics();
          badge.beginFill(0xd946ef)
               .drawRoundedRect(2, cellY + 2, 34, 14, 4)
               .endFill();
          rc.addChild(badge);
          const btx = new PIXI.Text("WILD", {
            fontFamily: "Outfit, system-ui, sans-serif",
            fontSize: 9, fontWeight: "900", fill: 0xffe9b8
          });
          btx.x = 5; btx.y = cellY + 4;
          rc.addChild(btx);
        }
      } catch (e) {}
    }
  }

  async function drawAllReels() {
    await Promise.all(Array.from({ length: REELS }, (_, r) => drawReel(r)));
  }

  // initialize grid
  newGrid();
  updateWaysText();
  drawAllReels();

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    curBet = [10, 25, 50, 100, 250][i]; updateSpinBtn();
  }));

  // spin button
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
    winText.text = "";

    // fresh grid + heights
    newGrid();
    updateWaysText();

    // animate reel reveals — staggered. Anticipation: if first 3 reels share any symbol,
    // slow down reel 4 reveal.
    const baseDelay = 280;
    const promises = [];
    for (let r = 0; r < REELS; r++) {
      let delay = baseDelay + r * 220;
      // anticipation on reel 4 (index 3)
      if (r === 3 && hasLeftRun(3)) delay += 600;
      promises.push(revealReel(r, delay));
    }
    await Promise.all(promises);

    await drawAllReels();

    // cascade wins loop
    let totalWin = 0;
    let cascadeCount = 0;
    while (true) {
      const wins = evaluate();
      if (wins.length === 0) break;
      cascadeCount++;
      let cascadeWin = 0;
      for (const w of wins) cascadeWin += w.amount;
      cascadeWin = Math.min(cascadeWin, curBet * MAX_WIN_MULT);
      totalWin += cascadeWin;

      // highlight winning cells briefly
      await delay(380);
      // remove winning symbols and refill from top
      removeWinningCells(wins);
      sfx.pop();
      await drawAllReels();
      await delay(120);
    }

    if (totalWin > 0) {
      store.pay(totalWin);
      const tier = totalWin >= curBet * 100 ? "jackpot" :
                   totalWin >= curBet * 25 ? "mega" :
                   totalWin >= curBet * 10 ? "big" : "win";
      sfx[tier]();
      host.onWin(tier, totalWin, {
        title: tier.toUpperCase() + (cascadeCount > 1 ? ` · ${cascadeCount} CASCADES` : ""),
        line: `${countWays().toLocaleString("en-US")} ways`
      });
    } else {
      sfx.lose();
    }
    store.record(game.id, curBet, totalWin);
    winText.text = totalWin > 0 ? `+${totalWin.toLocaleString("en-US")} chips` : "";

    spinning = false;
  }

  // Check if there's a run across first N reels (any symbol that appears on every one of them,
  // counting wilds). Used for anticipation on reel 4.
  function hasLeftRun(n) {
    // get candidates from reel 0
    const cands = new Set(grid[0]);
    for (let r = 1; r < n; r++) {
      const next = new Set();
      const rset = new Set(grid[r]);
      for (const s of cands) {
        if (rset.has(s) || rset.has(WILD_ID) || s === WILD_ID) next.add(s);
      }
      cands.clear();
      for (const s of next) cands.add(s);
    }
    return cands.size > 0;
  }

  function revealReel(r, delayMs) {
    return new Promise(resolve => {
      // brief flash effect via ticker
      const start = performance.now();
      const fn = () => {
        const el = performance.now() - start;
        if (el >= delayMs) {
          pixiApp.ticker.remove(fn);
          sfx.tick();
          resolve();
        }
      };
      pixiApp.ticker.add(fn);
      cleanupFns.push(() => pixiApp.ticker.remove(fn));
    });
  }

  // Evaluate wins. Returns array of { symbol, runLen, cells, amount }
  function evaluate() {
    const wins = [];
    // collect candidate symbols present on reel 0 (excluding pure-wild runs handled separately)
    const seen = new Set();
    for (const id of grid[0]) seen.add(id);
    // also consider wild-only: vedhika pays as itself only if pure wild run (treat as a symbol)
    for (const sym of seen) {
      // for each symbol, find longest left-to-right run where each reel contains sym or wild
      let runLen = 0;
      const perReelMatches = [];
      for (let r = 0; r < REELS; r++) {
        const col = grid[r];
        let cnt = 0;
        for (const cell of col) {
          if (cell === sym || cell === WILD_ID) cnt++;
        }
        if (cnt > 0) {
          runLen++;
          perReelMatches.push(cnt);
        } else break;
      }
      if (runLen >= 3) {
        const ways = perReelMatches.reduce((a, b) => a * b, 1);
        const mult = RUN_MULT[runLen] || 0;
        if (mult > 0) {
          // collect winning cell coords for cascade removal
          const cells = [];
          for (let r = 0; r < runLen; r++) {
            const col = grid[r];
            for (let row = 0; row < col.length; row++) {
              if (col[row] === sym || col[row] === WILD_ID) cells.push({ reel: r, row });
            }
          }
          const amount = Math.min(ways * mult * curBet, curBet * MAX_WIN_MULT);
          wins.push({ symbol: sym, runLen, cells, amount });
        }
      }
    }
    return wins;
  }

  // Remove winning cells, then drop remaining cells down within each reel + refill from top
  function removeWinningCells(wins) {
    const marked = new Set(); // "r,row"
    for (const w of wins) {
      for (const c of w.cells) marked.add(c.reel + "," + c.row);
    }
    for (let r = 0; r < REELS; r++) {
      const kept = [];
      for (let row = 0; row < grid[r].length; row++) {
        if (!marked.has(r + "," + row)) kept.push(grid[r][row]);
      }
      // refill from top
      const deficit = reelHeights[r] - kept.length;
      const fresh = [];
      for (let i = 0; i < deficit; i++) fresh.push(pickSymbol());
      grid[r] = fresh.concat(kept);
    }
  }

  return function cleanup() {
    for (const fn of cleanupFns) try { fn(); } catch (e) {}
    cleanupFns = [];
  };
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
