// games/hold-spin.js — 3x3 photo slot with Hold & Spin bonus.
// Land 3 same divas in any horizontal row → bonus: matching divas lock,
// 3 respins, new matching divas lock + reset to 3 respins, until out of respins
// or all 9 cells locked. Payout = locked^2 * bet / 10. Full grid = x100 bet bonus.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const ROWS = 3, COLS = 3;

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

  // layout — big 3x3 grid
  const gap = 6;
  const cellSize = Math.floor((W - 16 - 2 * gap) / COLS); // ~134 on 414-wide → cap at 120
  const cell = Math.min(cellSize, 120);
  const gridPx = COLS * cell + (COLS - 1) * gap;
  const gridX = Math.floor((W - gridPx) / 2);
  const gridY = 60;

  // grid backdrop
  const gridBg = new PIXI.Graphics();
  gridBg.lineStyle(2, 0xf2c76e, 0.3)
        .beginFill(0x1c0e2a)
        .drawRoundedRect(gridX - 8, gridY - 8, gridPx + 16, gridPx + 16, 12)
        .endFill();
  c.addChild(gridBg);

  // cellsContainer holds 9 cell containers indexed row*COLS + col
  const cellsContainer = new PIXI.Container();
  cellsContainer.x = gridX;
  cellsContainer.y = gridY;
  c.addChild(cellsContainer);

  // locked indicator overlay (gold ring around locked cells)
  const lockLayer = new PIXI.Graphics();
  lockLayer.x = gridX;
  lockLayer.y = gridY;
  c.addChild(lockLayer);

  // respins / status banner above the grid
  const bannerBg = new PIXI.Graphics();
  bannerBg.lineStyle(2, 0xf2c76e, 0.5)
          .beginFill(0x1c0e2a)
          .drawRoundedRect(0, 0, W - 16, 32, 8)
          .endFill();
  bannerBg.x = 8; bannerBg.y = 24;
  c.addChild(bannerBg);

  const bannerText = new PIXI.Text("", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 14, fontWeight: "700", fill: 0xf2c76e, align: "center"
  });
  bannerText.anchor.set(0.5, 0.5);
  bannerText.x = W / 2;
  bannerText.y = 24 + 16;
  c.addChild(bannerText);

  // win display below grid
  const winText = new PIXI.Text("", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 18, fontWeight: "900", fill: 0xf2c76e,
    align: "center", stroke: 0x160b20, strokeThickness: 3
  });
  winText.anchor.set(0.5, 0);
  winText.x = W / 2;
  winText.y = gridY + gridPx + 18;
  c.addChild(winText);

  // state
  let grid = [];          // grid[r][c] = symbol id
  let locked = [];        // locked[r][c] = boolean
  let spinning = false;
  let curBet = 25;
  let cleanupFns = [];

  function pickSymbol() {
    return DIVA_IDS[Math.floor(Math.random() * DIVA_IDS.length)];
  }
  function photoURL(id) {
    return friendPhoto(id, Math.floor(Math.random() * 6));
  }
  function newGrid() {
    grid = [];
    locked = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [], lk = [];
      for (let c = 0; c < COLS; c++) { row.push(pickSymbol()); lk.push(false); }
      grid.push(row); locked.push(lk);
    }
  }

  async function drawGrid() {
    cellsContainer.removeChildren();
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const id = grid[r][col];
        const sp = new PIXI.Container();
        sp.x = col * (cell + gap);
        sp.y = r * (cell + gap);
        try {
          const tex = await PIXI.Assets.load(photoURL(id));
          if (sp.destroyed) continue;
          const sprite = new PIXI.Sprite(tex);
          const scale = Math.min(cell/tex.width, cell/tex.height); // cover-fit
          sprite.scale.set(scale);
          sprite.x = (cell - tex.width * scale) / 2;
          sprite.y = (cell - tex.height * scale) / 2;
          const cmask = new PIXI.Graphics();
          cmask.beginFill(0xffffff).drawRoundedRect(0, 0, cell, cell, 8).endFill();
          sp.addChild(cmask);
          sprite.mask = cmask;
          sp.addChild(sprite);
          const border = new PIXI.Graphics();
          border.lineStyle(1, 0xf2c76e, 0.25)
                .drawRoundedRect(0, 0, cell, cell, 8)
                .endFill();
          sp.addChild(border);
        } catch (e) {}
        cellsContainer.addChild(sp);
      }
    }
    drawLocks();
  }

  function drawLocks() {
    lockLayer.clear();
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        if (!locked[r][col]) continue;
        const x = col * (cell + gap);
        const y = r * (cell + gap);
        lockLayer.lineStyle(3, 0xffd700, 0.95)
                 .drawRoundedRect(x - 3, y - 3, cell + 6, cell + 6, 10)
                 .endFill();
      }
    }
  }

  // initial
  newGrid();
  drawGrid();
  bannerText.text = "Match a row to trigger HOLD & SPIN";

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

    // fresh grid (no locks yet)
    newGrid();
    await drawGrid();

    // check rows for 3-in-a-row
    let bonusSym = null;
    let bonusRows = [];
    for (let r = 0; r < ROWS; r++) {
      if (grid[r][0] === grid[r][1] && grid[r][1] === grid[r][2]) {
        if (!bonusSym) { bonusSym = grid[r][0]; bonusRows.push(r); }
        else if (grid[r][0] === bonusSym) bonusRows.push(r);
      }
    }

    if (bonusSym) {
      // trigger Hold & Spin
      sfx.big();
      host.onWin("big", 0, { title: "HOLD & SPIN", line: `Locked ${bonusSym}` });
      // lock all matching diva cells across grid
      for (let r = 0; r < ROWS; r++) {
        for (let col = 0; col < COLS; col++) {
          if (grid[r][col] === bonusSym) locked[r][col] = true;
        }
      }
      await drawGrid();
      const win = await runHoldAndSpin(bonusSym);
      store.pay(win);
      store.record(game.id, curBet, win);
      const tier = win >= curBet * 100 ? "jackpot" :
                   win >= curBet * 25 ? "mega" :
                   win >= curBet * 10 ? "big" : "win";
      sfx[tier]();
      host.onWin(tier, win, { title: tier.toUpperCase(), line: "Hold & Spin resolved" });
      winText.text = `+${win.toLocaleString("en-US")} chips`;
      bannerText.text = "Match a row to trigger HOLD & SPIN";
      spinning = false;
      return;
    }

    // no bonus — small consolation check: any 2-in-row matches? no payout otherwise.
    // Per spec, only hold&spin pays. So no win here.
    sfx.lose();
    store.record(game.id, curBet, 0);
    winText.text = "";
    spinning = false;
  }

  async function runHoldAndSpin(bonusSym) {
    let respins = 3;
    bannerText.text = `HOLD & SPIN · ${respins} respins left`;

    while (respins > 0) {
      // count locked
      const lockedCount = countLocked();
      if (lockedCount >= ROWS * COLS) break; // full grid

      respins--;
      // reroll all non-locked cells
      for (let r = 0; r < ROWS; r++) {
        for (let col = 0; col < COLS; col++) {
          if (!locked[r][col]) grid[r][col] = pickSymbol();
        }
      }
      sfx.whoosh();
      await delay(280);
      await drawGrid();
      bannerText.text = `HOLD & SPIN · ${respins} respins left`;

      // check for newly landed matching divas → lock + reset
      let newLocks = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let col = 0; col < COLS; col++) {
          if (!locked[r][col] && grid[r][col] === bonusSym) {
            locked[r][col] = true;
            newLocks++;
          }
        }
      }
      if (newLocks > 0) {
        sfx.reveal();
        await drawGrid();
        respins = 3; // reset
        bannerText.text = `LOCKED +${newLocks} · respins reset`;
        await delay(450);
        bannerText.text = `HOLD & SPIN · ${respins} respins left`;
      }
    }

    const lockedCount = countLocked();
    const fullGrid = lockedCount >= ROWS * COLS;
    let payout = Math.floor(lockedCount * lockedCount * curBet / 10);
    if (fullGrid) {
      payout += curBet * 100;
      sfx.jackpot();
      host.onWin("jackpot", 0, { title: "FULL GRID!", line: "All 9 divas locked" });
    }
    return payout;
  }

  function countLocked() {
    let n = 0;
    for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) if (locked[r][col]) n++;
    return n;
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
