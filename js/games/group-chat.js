// games/group-chat.js — 5x5 chat-bubble cluster slot. Same diva 5+ connected = win.
// 5-cluster x2, 6 x5, 7 x10, 8 x25, 9+ x50. Cascades "send" winning bubbles.
// Viral Message: vedhika bubble in any win = x2 bonus. Group Chat Pings (10% per spin):
// free reshuffle + guaranteed planted 5-cluster. Bubbles are chat-shaped with a tail.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const N = 5;
const MULT = { 5: 2, 6: 5, 7: 10, 8: 25 }; // 9+ uses 50
const PING_CHANCE = 0.10;
const MAX_WIN_MULT = 10000;
const TAIL_H = 8;

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  // background — chat thread dark blue
  const bg = new PIXI.Graphics();
  bg.beginFill(0x0e1626, 0.75).drawRect(0, 0, W, H).endFill();
  for (let i = 0; i < H; i += 4) {
    bg.beginFill(0x1a2540, 0.12 + (i / H) * 0.10).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  const tagline = new PIXI.Text(
    game.tagline || game.blurb || "Group Chat. Same diva 5+ = win. Viral = x2.",
    { fontFamily: "Outfit, sans-serif", fontSize: 14, fontStyle: "italic", fill: 0x6cc0ff });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // grid sizing
  const gap = 6;
  const cellSize = Math.floor((W - 16 - (N - 1) * gap) / N);
  const gridPx = N * cellSize + (N - 1) * gap;
  const gridX = Math.floor((W - gridPx) / 2);
  const gridY = 30;

  const gridBg = new PIXI.Graphics();
  gridBg.lineStyle(2, 0x6cc0ff, 0.25)
        .beginFill(0x141d33, 0.85)
        .drawRoundedRect(gridX - 8, gridY - 8, gridPx + 16, gridPx + 16, 14)
        .endFill();
  c.addChild(gridBg);

  const cellsContainer = new PIXI.Container();
  cellsContainer.x = gridX; cellsContainer.y = gridY;
  c.addChild(cellsContainer);

  const highlightLayer = new PIXI.Graphics();
  highlightLayer.x = gridX; highlightLayer.y = gridY;
  c.addChild(highlightLayer);

  const winText = new PIXI.Text("", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0x6cc0ff,
    align: "center", stroke: 0x0a1020, strokeThickness: 3
  });
  winText.anchor.set(0.5, 0);
  winText.x = W / 2; winText.y = gridY + gridPx + 14;
  c.addChild(winText);

  // state
  let grid = [];
  let spinning = false;
  let curBet = 25;

  function pickSymbol() {
    return DIVA_IDS[Math.floor(Math.random() * DIVA_IDS.length)];
  }
  function photoURL(id) {
    return friendPhoto(id, Math.floor(Math.random() * 6));
  }
  function isVedhika(id) { return id === "vedhika"; }

  function newGrid() {
    grid = [];
    for (let r = 0; r < N; r++) {
      const row = [];
      for (let col = 0; col < N; col++) row.push(pickSymbol());
      grid.push(row);
    }
  }

  async function drawGrid() {
    const removed = cellsContainer.removeChildren();
    for (const ch of removed) { try { ch.destroy({ children: true }); } catch (e) {} }
    for (let r = 0; r < N; r++) {
      for (let col = 0; col < N; col++) {
        await drawCell(r, col);
      }
    }
  }

  async function drawCell(r, col) {
    const id = grid[r][col];
    const sp = new PIXI.Container();
    // pivot to center so the send animation shrinks toward middle
    sp.x = col * (cellSize + gap) + cellSize / 2;
    sp.y = r * (cellSize + gap) + cellSize / 2;
    sp.pivot.set(cellSize / 2, cellSize / 2);
    cellsContainer.addChild(sp);

    try {
      const tex = await PIXI.Assets.load(photoURL(id));
      if (sp.destroyed) return;

      // bubble body — rounded rect with a small tail at bottom-left
      const bubble = new PIXI.Graphics();
      bubble.beginFill(0x243756, 0.95)
             .drawRoundedRect(0, 0, cellSize, cellSize - TAIL_H, 12)
             .endFill();
      bubble.beginFill(0x243756, 0.95)
             .moveTo(6, cellSize - TAIL_H)
             .lineTo(6 + 10, cellSize - TAIL_H)
             .lineTo(4, cellSize)
             .closePath()
             .endFill();
      sp.addChild(bubble);

      const pad = 4;
      const photoW = cellSize - pad * 2;
      const photoH = cellSize - TAIL_H - pad * 2;
      const sprite = new PIXI.Sprite(tex);
      const sc = Math.min(photoW/tex.width, photoH/tex.height);
      sprite.scale.set(sc);
      sprite.x = pad + (photoW - tex.width * sc) / 2;
      sprite.y = pad + (photoH - tex.height * sc) / 2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(pad, pad, photoW, photoH, 8).endFill();
      sp.addChild(mask);
      sprite.mask = mask;
      sp.addChild(sprite);

      if (isVedhika(id)) {
        const glow = new PIXI.Graphics();
        glow.lineStyle(2, 0xd946ef, 0.85)
             .drawRoundedRect(0, 0, cellSize, cellSize - TAIL_H, 12)
             .endFill();
        sp.addChild(glow);
      }
    } catch (e) {}
  }

  // initial
  newGrid();
  drawGrid();

  // bet row + spin
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    curBet = [10, 25, 50, 100, 250][i]; updateSpinBtn();
  }));

  const spinBtn = makeButton(W - 16, 50, t("common.spin") + " · " + curBet, 0x6cc0ff, 0x0a1020);
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
    highlightLayer.clear();

    newGrid();
    // Group Chat Pings — 10% chance: free reshuffle + guaranteed 5-cluster
    const pinged = Math.random() < PING_CHANCE;
    if (pinged) {
      plantGuaranteedCluster();
      host.toast("GROUP CHAT PINGS! Free reshuffle + a 5-cluster is brewing.", 2400);
      sfx.reveal();
    }
    await drawGrid();

    let totalWin = 0;
    let cascadeCount = 0;
    let viralHits = 0;
    while (true) {
      const wins = evaluate();
      if (wins.length === 0) break;
      cascadeCount++;
      let cascadeWin = 0;
      for (const w of wins) {
        let amt = w.amount;
        if (w.hasVedhika) { amt *= 2; viralHits++; }
        cascadeWin += amt;
      }
      totalWin += cascadeWin;
      drawHighlights(wins);
      sfx.reveal();
      await delay(450);
      await animateSend(wins);
      applyCascade(wins);
      sfx.pop();
      await drawGrid();
      await delay(140);
    }

    if (totalWin > 0) {
      totalWin = Math.min(totalWin, curBet * MAX_WIN_MULT);
      store.pay(totalWin);
      const tier = totalWin >= curBet * 100 ? "jackpot" :
                   totalWin >= curBet * 25 ? "mega" :
                   totalWin >= curBet * 10 ? "big" : "win";
      sfx[tier]();
      let title = viralHits > 0 ? "VIRAL " : "";
      title += tier.toUpperCase();
      if (cascadeCount > 1) title += " · " + cascadeCount + "x CASCADE";
      if (pinged) title += " · PINGS";
      host.onWin(tier, totalWin, {
        title,
        line: viralHits > 0 ? "Vedhika went viral in the chat." : "Cluster pays"
      });
    } else {
      sfx.lose();
    }
    store.record(game.id, curBet, totalWin);
    winText.text = totalWin > 0
      ? "+" + totalWin.toLocaleString("en-US") + " chips" + (viralHits > 0 ? " · VIRAL x2" : "")
      : "";

    spinning = false;
  }

  // Plant a guaranteed connected 5-cluster of one diva into the grid.
  function plantGuaranteedCluster() {
    const id = DIVA_IDS[Math.floor(Math.random() * DIVA_IDS.length)];
    const shapes = [
      [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],   // row
      [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],   // col
      [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],   // L
      [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1]],   // T
      [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3]],   // S
      [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]],   // square+1
    ];
    const sh = shapes[Math.floor(Math.random() * shapes.length)];
    const maxR = sh.reduce((m, [r]) => Math.max(m, r), 0);
    const maxC = sh.reduce((m, [, cc]) => Math.max(m, cc), 0);
    const r0 = Math.floor(Math.random() * (N - maxR));
    const c0 = Math.floor(Math.random() * (N - maxC));
    for (const [dr, dc] of sh) grid[r0 + dr][c0 + dc] = id;
  }

  // flood-fill connected clusters of the same symbol; wins = clusters of size >=5
  function evaluate() {
    const visited = Array.from({ length: N }, () => new Array(N).fill(false));
    const wins = [];
    for (let r = 0; r < N; r++) {
      for (let col = 0; col < N; col++) {
        if (visited[r][col]) continue;
        const sym = grid[r][col];
        const queue = [[r, col]];
        const cells = [];
        visited[r][col] = true;
        while (queue.length) {
          const [cr, cc] = queue.shift();
          cells.push({ r: cr, col: cc });
          for (const [nr, nc] of [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]]) {
            if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
            if (visited[nr][nc]) continue;
            if (grid[nr][nc] === sym) {
              visited[nr][nc] = true;
              queue.push([nr, nc]);
            }
          }
        }
        if (cells.length >= 5) {
          const mult = cells.length >= 9 ? 50 : MULT[cells.length];
          wins.push({
            symbol: sym, cells, size: cells.length,
            amount: mult * curBet,
            hasVedhika: (sym === "vedhika")
          });
        }
      }
    }
    return wins;
  }

  function drawHighlights(wins) {
    highlightLayer.clear();
    for (const w of wins) {
      const col = w.hasVedhika ? 0xd946ef : 0xffd700;
      for (const cell of w.cells) {
        const x = cell.col * (cellSize + gap);
        const y = cell.r * (cellSize + gap);
        highlightLayer.lineStyle(3, col, 0.9)
                      .drawRoundedRect(x - 2, y - 2, cellSize + 4, cellSize, 10)
                      .endFill();
      }
    }
  }

  // winning bubbles shrink + drift up + fade, like messages being sent
  async function animateSend(wins) {
    const promises = [];
    for (const w of wins) {
      for (const cell of w.cells) {
        const sp = cellsContainer.children[cell.r * N + cell.col];
        if (!sp) continue;
        promises.push(new Promise(resolve => {
          let t = 0;
          const fn = (dt) => {
            t += dt * 16.67;
            sp.scale.set(Math.max(0.1, 1 - t / 320));
            sp.alpha = Math.max(0, 1 - t / 320);
            sp.x += 0.5 * dt;
            sp.y -= 0.6 * dt;
            if (t > 360) {
              pixiApp.ticker.remove(fn);
              resolve();
            }
          };
          pixiApp.ticker.add(fn);
        }));
      }
    }
    await Promise.all(promises);
  }

  // remove winning cells, gravity-drop survivors down per column, fill from top
  function applyCascade(wins) {
    const marked = new Set();
    for (const w of wins) for (const cell of w.cells) marked.add(cell.r + "," + cell.col);
    for (let col = 0; col < N; col++) {
      const survivors = [];
      for (let r = N - 1; r >= 0; r--) {
        if (!marked.has(r + "," + col)) survivors.push(grid[r][col]);
      }
      const fresh = [];
      while (fresh.length + survivors.length < N) fresh.push(pickSymbol());
      const newCol = fresh.concat(survivors.reverse());
      for (let r = 0; r < N; r++) grid[r][col] = newCol[r];
    }
  }

  return function cleanup() {
    // no persistent tickers — spin loop uses async/await + setTimeout-style delays
  };
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
