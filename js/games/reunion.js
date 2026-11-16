// games/reunion.js — The Get-Together. Christmas Day exclusive slot.
// All 17 inner-circle divas on the reels. Higher payouts than usual.
// Vedhika pays x100 (5 in a row). Other divas pay x2-x50.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const REELS = 5, ROWS = 3;
// payouts per diva for 3/4/5 matches (left-to-right on any row)
const PAYOUTS = {};
for (const id of DIVA_IDS) {
  const diva = DIVAS[id];
  // base payout scaled by diva's price
  const base = diva.price * 2;
  PAYOUTS[id] = [0, 0, 0, base, base * 4, base * 20];
}
// Vedhika special: x100 for 5
PAYOUTS["vedhika"] = [0, 0, 0, 10, 25, 100];

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  // christmas-themed bg
  const bg = new PIXI.Graphics();
  bg.beginFill(0x0a1410, 0.75).drawRect(0, 0, W, H).endFill();
  // snow
  for (let i = 0; i < 60; i++) {
    bg.beginFill(0xffffff, Math.random() * 0.6 + 0.2).drawCircle(Math.random() * W, Math.random() * H, Math.random() * 1.8 + 0.5).endFill();
  }
  // gold border
  bg.lineStyle(4, 0xffd700, 1).drawRoundedRect(4, 4, W - 8, H - 8, 12).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text("🎄 Merry Christmas, Vedhika. The girls are home. 🎄", {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: 16, fontStyle: "italic", fontWeight: "700", fill: 0xffd700, align: "center",
    wordWrap: true, wordWrapWidth: W - 16
  });
  tagline.anchor.set(0.5, 0); tagline.x = W / 2; tagline.y = 6;
  c.addChild(tagline);

  // 5x3 slot grid
  const gridY = 40;
  const cellGap = 4;
  const cellW = (W - 16 - cellGap * (REELS - 1)) / REELS;
  const cellH = Math.min((H - gridY - 180) / ROWS, cellW * 1.2);
  const gridX = 8;
  const gridContainer = new PIXI.Container();
  gridContainer.x = gridX; gridContainer.y = gridY;
  c.addChild(gridContainer);

  // build reels
  const reelContainers = [];
  for (let i = 0; i < REELS; i++) {
    const rc = new PIXI.Container();
    rc.x = i * (cellW + cellGap);
    rc.y = 0;
    const rbg = new PIXI.Graphics();
    rbg.beginFill(0x1c0e2a).drawRoundedRect(0, 0, cellW, cellH * ROWS, 8).endFill();
    rbg.lineStyle(2, 0xffd700, 0.4).drawRoundedRect(0, 0, cellW, cellH * ROWS, 8).endFill();
    rc.addChild(rbg);
    gridContainer.addChild(rc);
    reelContainers.push(rc);
  }

  // grid state: grid[reel][row] = diva id
  let grid = [];
  let spinning = false;
  let curBet = 25;

  function newGrid() {
    grid = [];
    for (let r = 0; r < REELS; r++) {
      const col = [];
      for (let row = 0; row < ROWS; row++) {
        col.push(DIVA_IDS[Math.floor(Math.random() * DIVA_IDS.length)]);
      }
      grid.push(col);
    }
  }
  newGrid();

  async function drawGrid() {
    for (let r = 0; r < REELS; r++) {
      const rc = reelContainers[r];
      // remove old sprites (keep rbg at index 0)
      while (rc.children.length > 1) rc.removeChildAt(rc.children.length - 1);
      for (let row = 0; row < ROWS; row++) {
        const id = grid[r][row];
        try {
          const url = friendPhoto(id, Math.floor(Math.random() * 6));
          const tex = await PIXI.Assets.load(url);
          const sp = new PIXI.Sprite(tex);
          const scale = Math.min(cellW/tex.width, cellH/tex.height);
          sp.scale.set(scale);
          sp.x = (cellW - tex.width * scale) / 2;
          sp.y = row * cellH + (cellH - tex.height * scale) / 2;
          const mask = new PIXI.Graphics();
          mask.beginFill(0xffffff).drawRoundedRect(0, row * cellH, cellW, cellH, 4).endFill();
          rc.addChild(mask);
          sp.mask = mask;
          rc.addChild(sp);
          // vedhika badge
          if (id === "vedhika") {
            const badge = new PIXI.Graphics();
            badge.beginFill(0xffd700).drawRoundedRect(2, row * cellH + 2, 32, 14, 4).endFill();
            rc.addChild(badge);
            const btx = new PIXI.Text("VED", {fontFamily:"Outfit",fontSize:9,fontWeight:"900",fill:0x160b20});
            btx.x = 6; btx.y = row * cellH + 4;
            rc.addChild(btx);
          }
        } catch(e) {}
      }
    }
  }
  await drawGrid();

  // win display
  const winText = new PIXI.Text("", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900",
    fill: 0xffd700, stroke: 0x160b20, strokeThickness: 3, align: "center",
    wordWrap: true, wordWrapWidth: W - 16
  });
  winText.anchor.set(0.5, 0); winText.x = W / 2; winText.y = gridY + ROWS * cellH + 8;
  c.addChild(winText);

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; updateBtn(); }));

  const spinBtn = makeButton(W - 16, 60, "SPIN · " + curBet, 0xffd700, 0x160b20);
  spinBtn.x = 8; spinBtn.y = H - 60;
  spinBtn.interactive = true; spinBtn.buttonMode = true;
  c.addChild(spinBtn);
  function updateBtn() { spinBtn.children[1].text = "SPIN · " + curBet; }

  spinBtn.on("pointertap", async () => {
    if (spinning) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    spinning = true;
    spinBtn.interactive = false;
    sfx.whoosh();
    winText.text = "";
    newGrid();
    // staggered reel reveal
    for (let r = 0; r < REELS; r++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      // redraw just this reel
      const rc = reelContainers[r];
      while (rc.children.length > 1) rc.removeChildAt(rc.children.length - 1);
      for (let row = 0; row < ROWS; row++) {
        const id = grid[r][row];
        try {
          const url = friendPhoto(id, Math.floor(Math.random() * 6));
          const tex = await PIXI.Assets.load(url);
          const sp = new PIXI.Sprite(tex);
          const scale = Math.min(cellW/tex.width, cellH/tex.height);
          sp.scale.set(scale);
          sp.x = (cellW - tex.width * scale) / 2;
          sp.y = row * cellH + (cellH - tex.height * scale) / 2;
          const mask = new PIXI.Graphics();
          mask.beginFill(0xffffff).drawRoundedRect(0, row * cellH, cellW, cellH, 4).endFill();
          rc.addChild(mask);
          sp.mask = mask;
          rc.addChild(sp);
        } catch(e) {}
      }
      sfx.tick();
    }
    await new Promise(r => setTimeout(r, 400));

    // evaluate — check each row for 3+ matches left-to-right
    let totalWin = 0;
    const wins = [];
    for (let row = 0; row < ROWS; row++) {
      const first = grid[0][row];
      let count = 1;
      for (let r = 1; r < REELS; r++) {
        if (grid[r][row] === first) count++;
        else break;
      }
      if (count >= 3) {
        const mult = PAYOUTS[first][count] || 0;
        const win = curBet * mult;
        totalWin += win;
        wins.push({ diva: first, count, mult, win });
      }
    }

    if (totalWin > 0) {
      store.pay(totalWin);
      store.record(game.id, curBet, totalWin);
      const tier = totalWin >= curBet * 50 ? "jackpot" : totalWin >= curBet * 10 ? "mega" :
                   totalWin >= curBet * 5 ? "big" : "win";
      sfx[tier]();
      winText.text = `+${totalWin.toLocaleString("en-US")} chips`;
      const bestWin = wins.reduce((a, b) => a.mult > b.mult ? a : b);
      host.onWin(tier, totalWin, {
        title: bestWin.count + "x " + DIVAS[bestWin.diva].name + " · " + bestWin.mult + "x",
        line: tier === "jackpot" ? "VEDHIKA PAYS THE HOUSE. MERRY CHRISTMAS." : "Reunion win."
      });
    } else {
      sfx.lose();
      store.record(game.id, curBet, 0);
      winText.text = "No win. Spin again?";
    }
    spinning = false;
    spinBtn.interactive = true;
  });

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {fontFamily:"Outfit",fontSize:18,fontWeight:"700",fill:fg});
  tx.anchor.set(0.5); tx.x = w/2; tx.y = h/2;
  c.addChild(tx);
  return c;
}
