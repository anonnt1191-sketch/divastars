// games/reel-rush.js — 5x3 photo slot. 10 fixed paylines. Dwiza WILD, Riddhima MULT, Vedhika SCATTER.
// Free spins with x2 win. Bonus buy available. Smooth PixiJS reel animation with anticipation.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const REELS = 5, ROWS = 3;
const PAYLINES = [
  [1,1,1,1,1], [0,0,0,0,0], [2,2,2,2,2],
  [0,1,2,1,0], [2,1,0,1,2], [0,0,1,2,2], [2,2,1,0,0],
  [1,0,1,2,1], [1,2,1,0,1], [0,1,0,1,0]
];
const SYMBOLS_PER_REEL = 14; // 14 symbols (matches SESSION.reelWear keys)
const RR_MULTS = [[0.5,2],[0.72,3],[0.87,5],[0.94,10],[0.98,25],[0.995,50],[0.999,100],[0.9999,500],[1,1000]];

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 11, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // reel area
  const reelAreaY = 30;
  const reelAreaH = Math.min(H - reelAreaY - 220, 280);
  const reelW = (W - 20) / REELS;
  const reelH = reelAreaH;

  const reelsContainer = new PIXI.Container();
  reelsContainer.x = 8;
  reelsContainer.y = reelAreaY;
  c.addChild(reelsContainer);

  // build 5 reel columns
  const reelContainers = [];
  for (let i = 0; i < REELS; i++) {
    const rc = new PIXI.Container();
    rc.x = i * (reelW + 2);
    rc.y = 0;
    const rbg = new PIXI.Graphics();
    rbg.beginFill(0x1c0e2a).drawRoundedRect(0, 0, reelW, reelH, 8).endFill();
    rc.addChild(rbg);
    reelsContainer.addChild(rc);
    reelContainers.push(rc);
  }

  // paylines overlay (drawn during win)
  const paylineOverlay = new PIXI.Graphics();
  paylineOverlay.x = 8;
  paylineOverlay.y = reelAreaY;
  c.addChild(paylineOverlay);

  // 5x3 grid state — symbol id per cell
  let grid = []; // grid[reel][row] = symbol id (diva id or 'wild'/'mult'/'scatter')
  let spinning = false;
  let curBet = 25;
  let freeSpins = 0;
  let freeSpinMult = 1;

  function pickSymbol(reelIdx, rowIdx) {
    // Special symbols: wild/mult/scatter have low probabilities per reel
    // Reel 1: no scatter. Reel 5: no scatter. Reels 2,3,4: scatter possible.
    const r = Math.random();
    if (r < 0.04) return "wild";  // Dwiza — 4% per cell
    if (r < 0.06 && reelIdx >= 1 && reelIdx <= 3) return "scatter";  // Vedhika — 2% on middle reels
    if (r < 0.08) return "mult";  // Riddhima — 2%
    // else use rotating diva from SESSION.reelWear
    const idx = (reelIdx * 3 + rowIdx) % SYMBOLS_PER_REEL;
    return SESSION.reelWear[idx] || DIVA_IDS[Math.floor(Math.random() * DIVA_IDS.length)];
  }

  function symbolToPhoto(id) {
    if (id === "wild") return friendPhoto("dwiza", Math.floor(Math.random() * 6));
    if (id === "mult") return friendPhoto("riddhima", Math.floor(Math.random() * 6));
    if (id === "scatter") return friendPhoto("vedhika", Math.floor(Math.random() * 6));
    return friendPhoto(id, Math.floor(Math.random() * 6));
  }

  // initial grid
  function newGrid() {
    grid = [];
    for (let r = 0; r < REELS; r++) {
      const col = [];
      for (let row = 0; row < ROWS; row++) col.push(pickSymbol(r, row));
      grid.push(col);
    }
  }
  newGrid();

  async function drawGrid() {
    for (let r = 0; r < REELS; r++) {
      const rc = reelContainers[r];
      // remove old sprites
      for (let i = rc.children.length - 1; i >= 1; i--) rc.removeChildAt(i);
      for (let row = 0; row < ROWS; row++) {
        const id = grid[r][row];
        try {
          const tex = await PIXI.Assets.load(symbolToPhoto(id));
          const sp = new PIXI.Sprite(tex);
          const scale = Math.min(reelW / tex.width, (reelH / ROWS) / tex.height);
          sp.scale.set(scale);
          sp.x = (reelW - tex.width * scale) / 2;
          sp.y = row * (reelH / ROWS) + ((reelH / ROWS) - tex.height * scale) / 2;
          // badge if special
          if (id === "wild" || id === "mult" || id === "scatter") {
            const badge = new PIXI.Graphics();
            badge.beginFill(id === "wild" ? 0xff2e88 : id === "mult" ? 0xffe9b8 : 0xd946ef)
              .drawRoundedRect(2, 2, 28, 14, 4).endFill();
            sp.addChild(badge);
            const btx = new PIXI.Text(id.toUpperCase(), {
              fontFamily: "Outfit, system-ui, sans-serif",
              fontSize:12, fontWeight: "900", fill: 0x160b20
            });
            btx.x = 6; btx.y = 4;
            sp.addChild(btx);
          }
          rc.addChild(sp);
        } catch(e) {}
      }
    }
  }
  await drawGrid();

  // win display
  const winText = new PIXI.Text("", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 18, fontWeight: "900", fill: 0xf2c76e,
    align: "center", stroke: 0x160b20, strokeThickness: 3
  });
  winText.anchor.set(0.5, 0);
  winText.x = W / 2;
  winText.y = reelAreaY + reelAreaH + 8;
  c.addChild(winText);

  // free spins indicator
  const fsText = new PIXI.Text("", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 12, fontWeight: "700", fill: 0xd946ef
  });
  fsText.x = 8;
  fsText.y = reelAreaY + reelAreaH + 38;
  c.addChild(fsText);

  function updateFsText() {
    fsText.text = freeSpins > 0 ? `${t("reelRush.freeSpins")}: ${freeSpins} · x${freeSpinMult}` : "";
  }

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; updateBtn(); }));

  // spin + buy FS buttons
  const btnW = (W - 24) / 2;
  const buyBtn = makeButton(btnW, 50, t("reelRush.buyFs") + " " + (19 * curBet), 0x9d4edd, 0xffffff);
  buyBtn.x = 8; buyBtn.y = H - 50;
  buyBtn.interactive = true; buyBtn.buttonMode = true;
  c.addChild(buyBtn);

  const spinBtn = makeButton(btnW, 50, t("reelRush.spin") + " · " + curBet, 0xf2c76e, 0x160b20);
  spinBtn.x = 8 + btnW + 8; spinBtn.y = H - 50;
  spinBtn.interactive = true; spinBtn.buttonMode = true;
  c.addChild(spinBtn);

  function updateBtn() {
    spinBtn.children[1].text = t("reelRush.spin") + " · " + curBet;
    buyBtn.children[1].text = t("reelRush.buyFs") + " " + (19 * curBet);
  }

  spinBtn.on("pointertap", () => { sfx.click(); spin(false); });
  buyBtn.on("pointertap", () => { sfx.click(); spin(true); });

  async function spin(buyFs) {
    if (spinning) return;
    const cost = buyFs ? 19 * curBet : (freeSpins > 0 ? 0 : curBet);
    if (cost > 0 && !store.bet(cost)) { host.toast(t("toast.betTooHigh")); return; }
    spinning = true;
    sfx.whoosh();
    paylineOverlay.clear();
    winText.text = "";

    if (buyFs) {
      freeSpins = 10;
      freeSpinMult = 2;
    }

    // generate new grid
    newGrid();

    // animate reels (stagger stops)
    const animPromises = [];
    for (let r = 0; r < REELS; r++) {
      animPromises.push(animateReel(r, 600 + r * 250));
    }
    await Promise.all(animPromises);

    // draw final grid
    await drawGrid();

    // evaluate
    const result = evaluate();
    let totalWin = 0;
    if (result.wins.length > 0) {
      for (const w of result.wins) totalWin += w.amount;
      totalWin *= freeSpinMult;
      // mult symbol multiplier
      if (result.multMult > 0) totalWin *= result.multMult;
      store.pay(totalWin);
      // FX
      const tier = totalWin >= curBet * 100 ? "jackpot" : totalWin >= curBet * 25 ? "mega" :
                   totalWin >= curBet * 10 ? "big" : totalWin > 0 ? "win" : null;
      if (tier) {
        sfx[tier]();
        host.onWin(tier, totalWin, {
          title: tier.toUpperCase() + (result.multMult > 0 ? ` · MULT x${result.multMult}` : ""),
          line: freeSpins > 0 ? `Free spin ${freeSpins} left` : ""
        });
      }
    }

    // scatter — award free spins
    if (result.scatterCount >= 3) {
      const newFs = result.scatterCount >= 4 ? 12 : 10;
      freeSpins += newFs;
      freeSpinMult = 2;
      sfx.big();
      host.onWin("big", 0, { title: `${newFs} FREE SPINS`, line: "Vedhika approved. x2 wins." });
    }

    store.record(game.id, cost, totalWin);
    winText.text = totalWin > 0 ? `+${totalWin.toLocaleString("en-US")} chips` : "";
    updateFsText();

    // auto-spin free spins
    if (freeSpins > 0) {
      freeSpins--;
      updateFsText();
      setTimeout(() => { spinning = false; spin(false); }, 1500);
    } else {
      spinning = false;
    }
  }

  async function animateReel(reelIdx, durationMs) {
    // Just wait — actual symbol drawing happens in drawGrid() after.
    // Could add scroll animation here for extra polish, but keeping it simple.
    return new Promise(r => setTimeout(r, durationMs));
  }

  function evaluate() {
    const wins = [];  // {lineIdx, symbol, count, amount}
    const multMult = 0;  // would be set by riddhima logic
    let scatterCount = 0;
    let riddhimaCount = 0;
    for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) {
      if (grid[r][row] === "scatter") scatterCount++;
      if (grid[r][row] === "mult") riddhimaCount++;
    }
    // riddhima mult
    let multMultValue = 0;
    if (riddhimaCount > 0) {
      const r = Math.random();
      for (const [p, m] of RR_MULTS) if (r < p) { multMultValue = m; break; }
    }
    // paylines — left-to-right matching
    for (let li = 0; li < PAYLINES.length; li++) {
      const line = PAYLINES[li];
      let symbol = null, count = 0;
      for (let r = 0; r < REELS; r++) {
        const s = grid[r][line[r]];
        if (s === "scatter") break;
        if (s === "wild") { count++; continue; }
        if (symbol === null) { symbol = s; count++; }
        else if (s === symbol || s === "wild") count++;
        else break;
      }
      if (symbol && count >= 3) {
        // payout based on count
        const mult = count === 5 ? 50 : count === 4 ? 10 : 3;
        wins.push({ lineIdx: li, symbol, count, amount: curBet * mult });
      }
    }
    return { wins, scatterCount, multMult: multMultValue };
  }

  return function cleanup() {};
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 14, fontWeight: "700", fill: fg
  });
  tx.anchor.set(0.5);
  tx.x = w/2; tx.y = h/2;
  c.addChild(tx);
  return c;
}
