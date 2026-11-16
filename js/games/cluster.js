// games/cluster.js — 5x5 Cluster Pays photo slot. 5+ same divas touching = win.
// Cascades chain within one paid spin. Gold ring highlights winning clusters.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const GRID_N = 5;
const MULT = { 5: 2, 6: 5, 7: 10, 8: 25 }; // 9+ uses 50
const MAX_WIN_MULT = 10000;

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

  // cell sizing — aim for ~70px cells on 414-wide
  const gap = 4;
  const cellSize = Math.floor((W - 16 - (GRID_N - 1) * gap) / GRID_N);
  const gridPx = GRID_N * cellSize + (GRID_N - 1) * gap;
  const gridX = Math.floor((W - gridPx) / 2);
  const gridY = 32;

  const gridBg = new PIXI.Graphics();
  gridBg.lineStyle(2, 0xf2c76e, 0.3)
        .beginFill(0x1c0e2a)
        .drawRoundedRect(gridX - 6, gridY - 6, gridPx + 12, gridPx + 12, 10)
        .endFill();
  c.addChild(gridBg);

  // container for cells — children indexed by row*GRID_N + col
  const cellsContainer = new PIXI.Container();
  cellsContainer.x = gridX;
  cellsContainer.y = gridY;
  c.addChild(cellsContainer);

  // highlight overlay (gold rings around winning clusters)
  const highlightLayer = new PIXI.Graphics();
  highlightLayer.x = gridX;
  highlightLayer.y = gridY;
  c.addChild(highlightLayer);

  // win text
  const winText = new PIXI.Text("", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 18, fontWeight: "900", fill: 0xf2c76e,
    align: "center", stroke: 0x160b20, strokeThickness: 3
  });
  winText.anchor.set(0.5, 0);
  winText.x = W / 2;
  winText.y = gridY + gridPx + 14;
  c.addChild(winText);

  // state: grid[row][col] = symbol id
  let grid = [];
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
    for (let r = 0; r < GRID_N; r++) {
      const row = [];
      for (let col = 0; col < GRID_N; col++) row.push(pickSymbol());
      grid.push(row);
    }
  }

  async function drawGrid() {
    cellsContainer.removeChildren();
    for (let r = 0; r < GRID_N; r++) {
      for (let col = 0; col < GRID_N; col++) {
        const id = grid[r][col];
        const sp = new PIXI.Container();
        sp.x = col * (cellSize + gap);
        sp.y = r * (cellSize + gap);
        try {
          const tex = await PIXI.Assets.load(photoURL(id));
          if (sp.destroyed) continue;
          const sprite = new PIXI.Sprite(tex);
          const scale = Math.min(cellSize/tex.width, cellSize/tex.height); // cover-fit
          sprite.scale.set(scale);
          sprite.x = (cellSize - tex.width * scale) / 2;
          sprite.y = (cellSize - tex.height * scale) / 2;
          const cmask = new PIXI.Graphics();
          cmask.beginFill(0xffffff).drawRoundedRect(0, 0, cellSize, cellSize, 6).endFill();
          sp.addChild(cmask);
          sprite.mask = cmask;
          sp.addChild(sprite);
          const border = new PIXI.Graphics();
          border.lineStyle(1, 0xf2c76e, 0.25)
                .drawRoundedRect(0, 0, cellSize, cellSize, 6)
                .endFill();
          sp.addChild(border);
        } catch (e) {}
        cellsContainer.addChild(sp);
      }
    }
  }

  // initial
  newGrid();
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
    winText.text = "";
    highlightLayer.clear();

    newGrid();
    await drawGrid();

    let totalWin = 0;
    let cascadeCount = 0;
    while (true) {
      const wins = evaluate();
      if (wins.length === 0) break;
      cascadeCount++;
      let cascadeWin = 0;
      for (const w of wins) cascadeWin += w.amount;
      totalWin += cascadeWin;

      // draw gold rings around winning clusters
      drawHighlights(wins);
      sfx.reveal();
      await delay(550);

      // remove winning cells, drop remaining, refill from top
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
      host.onWin(tier, totalWin, {
        title: tier.toUpperCase() + (cascadeCount > 1 ? ` · ${cascadeCount}x CASCADE` : ""),
        line: "Cluster pays"
      });
    } else {
      sfx.lose();
    }
    store.record(game.id, curBet, totalWin);
    winText.text = totalWin > 0 ? `+${totalWin.toLocaleString("en-US")} chips` : "";

    spinning = false;
  }

  // Flood-fill connected clusters of the same symbol. Returns array of
  // { symbol, cells: [{r, col}], size, amount }
  function evaluate() {
    const visited = Array.from({ length: GRID_N }, () => new Array(GRID_N).fill(false));
    const wins = [];
    for (let r = 0; r < GRID_N; r++) {
      for (let col = 0; col < GRID_N; col++) {
        if (visited[r][col]) continue;
        const sym = grid[r][col];
        // BFS
        const queue = [[r, col]];
        const cells = [];
        visited[r][col] = true;
        while (queue.length) {
          const [cr, cc] = queue.shift();
          cells.push({ r: cr, col: cc });
          const neighbors = [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]];
          for (const [nr, nc] of neighbors) {
            if (nr < 0 || nr >= GRID_N || nc < 0 || nc >= GRID_N) continue;
            if (visited[nr][nc]) continue;
            if (grid[nr][nc] === sym) {
              visited[nr][nc] = true;
              queue.push([nr, nc]);
            }
          }
        }
        const size = cells.length;
        if (size >= 5) {
          const mult = size >= 9 ? 50 : MULT[size];
          wins.push({ symbol: sym, cells, size, amount: mult * curBet });
        }
      }
    }
    return wins;
  }

  function drawHighlights(wins) {
    highlightLayer.clear();
    for (const w of wins) {
      for (const cell of w.cells) {
        const x = cell.col * (cellSize + gap);
        const y = cell.r * (cellSize + gap);
        highlightLayer.lineStyle(3, 0xffd700, 0.9)
                      .drawRoundedRect(x - 2, y - 2, cellSize + 4, cellSize + 4, 8)
                      .endFill();
      }
    }
  }

  // Remove winning cells, gravity drops remaining cells down within each column,
  // new random symbols fill the empty slots from the top.
  function applyCascade(wins) {
    const marked = new Set();
    for (const w of wins) {
      for (const cell of w.cells) marked.add(cell.r + "," + cell.col);
    }
    // per column: collect survivors (top to bottom), then prepend fresh cells
    for (let col = 0; col < GRID_N; col++) {
      const survivors = [];
      for (let r = GRID_N - 1; r >= 0; r--) {
        if (!marked.has(r + "," + col)) survivors.push(grid[r][col]);
      }
      // survivors are now bottom-first; pad top with fresh
      const fresh = [];
      while (fresh.length + survivors.length < GRID_N) fresh.push(pickSymbol());
      // assemble from top to bottom: fresh[0..n-1] then survivors reversed
      const newCol = fresh.concat(survivors.reverse());
      for (let r = 0; r < GRID_N; r++) grid[r][col] = newCol[r];
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
