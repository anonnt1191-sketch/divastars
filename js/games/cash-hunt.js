// games/cash-hunt.js — 5x4 grid of face-down tiles. Pick one to reveal a multiplier
// OR a diva photo (rare, higher payouts). After pick, all tiles reveal.
// 30% divas (x1-x50), 70% multipliers (x1-x100). Big reveal animation on the picked tile.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { CAST_LIST } from "../core/app.js";
import { castToPhotoURL, castPick } from "../core/photos.js";

const COLS = 5;
const ROWS = 4;
const TILES = COLS * ROWS;             // 20
const DIVA_COUNT = Math.round(TILES * 0.3); // 6 divas, 14 multipliers

// Rarity tables (weighted)
const DIVA_TIERS = [
  { mult: 1,  w: 30 }, { mult: 2,  w: 25 }, { mult: 5,  w: 20 },
  { mult: 10, w: 15 }, { mult: 25, w: 7 },  { mult: 50, w: 3 },
];
const MULT_TIERS = [
  { mult: 1,   w: 30 }, { mult: 2,   w: 25 }, { mult: 3,   w: 18 },
  { mult: 5,   w: 12 }, { mult: 10,  w: 8 },  { mult: 25,  w: 4 },
  { mult: 50,  w: 2 },  { mult: 100, w: 1 },
];

function weightedPick(tiers) {
  const total = tiers.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of tiers) {
    if (r < x.w) return x.mult;
    r -= x.w;
  }
  return tiers[tiers.length - 1].mult;
}

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  // bg
  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  // tagline
  const tagline = new PIXI.Text(game.tagline || game.blurb || "", {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // hint text
  const hintText = new PIXI.Text("Tap any tile. Find a diva or a big multiplier.", {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700",
    fill: 0xffe9b8, align: "center", wordWrap: true, wordWrapWidth: W - 24
  });
  hintText.anchor.set(0.5, 0);
  hintText.x = W / 2; hintText.y = 28;
  c.addChild(hintText);

  // ============ GRID ============
  const gridY = 56;
  const availW = W - 24;
  const gap = 6;
  const tileW = (availW - (COLS - 1) * gap) / COLS;
  const tileH = tileW;
  const gridW = COLS * tileW + (COLS - 1) * gap;
  const gridH = ROWS * tileH + (ROWS - 1) * gap;
  const gridX = (W - gridW) / 2;

  const tilesContainer = new PIXI.Container();
  tilesContainer.x = gridX; tilesContainer.y = gridY;
  c.addChild(tilesContainer);

  // result text below grid
  const resultText = new PIXI.Text("", {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "900", fill: 0xffe9b8,
    stroke: 0x160b20, strokeThickness: 3, align: "center",
    wordWrap: true, wordWrapWidth: W - 16
  });
  resultText.anchor.set(0.5, 0);
  resultText.x = W / 2;
  resultText.y = gridY + gridH + 12;
  c.addChild(resultText);

  // ============ BET ROW + NEW HUNT BUTTON ============
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    curBet = [10, 25, 50, 100, 250][i];
    updateBtn();
  }));

  const huntBtn = makeButton(W - 16, 60, "NEW HUNT · " + curBet, 0xf2c76e, 0x160b20);
  huntBtn.x = 8; huntBtn.y = H - 60;
  huntBtn.interactive = true; huntBtn.buttonMode = true;
  c.addChild(huntBtn);
  function updateBtn() { huntBtn.children[1].text = "NEW HUNT · " + curBet; }

  // ============ TILES STATE ============
  let tiles = [];  // { idx, row, col, gfx, kind, mult, cast, revealed }
  let pickedTileIdx = -1;
  let picked = false;
  let revealing = false;

  function buildTiles() {
    for (const t of tiles) {
      if (t.gfx.parent) t.gfx.parent.removeChild(t.gfx);
      t.gfx.destroy();
    }
    tiles = [];
    const kinds = [];
    for (let i = 0; i < DIVA_COUNT; i++) kinds.push("diva");
    for (let i = 0; i < TILES - DIVA_COUNT; i++) kinds.push("mult");
    // shuffle
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    const used = new Set();
    for (let i = 0; i < TILES; i++) {
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      const x = col * (tileW + gap);
      const y = row * (tileH + gap);
      const kind = kinds[i];
      let mult, cast = null;
      if (kind === "diva") {
        cast = castPick(CAST_LIST, used);
        used.add(cast.key);
        mult = weightedPick(DIVA_TIERS);
      } else {
        mult = weightedPick(MULT_TIERS);
      }
      const g = new PIXI.Container();
      g.x = x; g.y = y;
      drawFaceDown(g);
      g.interactive = true; g.buttonMode = true;
      g.on("pointertap", () => onTileTap(i));
      tilesContainer.addChild(g);
      tiles.push({ idx: i, row, col, gfx: g, kind, mult, cast, revealed: false });
    }
  }

  function drawFaceDown(g) {
    g.removeChildren();
    const back = new PIXI.Graphics();
    back.lineStyle(2, 0xf2c76e, 0.5)
      .beginFill(0x2b1a06)
      .drawRoundedRect(0, 0, tileW, tileH, 10)
      .endFill();
    back.lineStyle(1, 0xf2c76e, 0.25)
      .moveTo(tileW * 0.2, tileH * 0.2).lineTo(tileW * 0.8, tileH * 0.8)
      .moveTo(tileW * 0.8, tileH * 0.2).lineTo(tileW * 0.2, tileH * 0.8)
      .endFill();
    back.beginFill(0xf2c76e, 0.85).drawCircle(tileW / 2, tileH / 2, tileW * 0.22).endFill();
    g.addChild(back);
    const q = new PIXI.Text("?", {
      fontFamily: "Outfit, sans-serif", fontSize: Math.max(16, tileW * 0.4),
      fontWeight: "900", fill: 0x160b20
    });
    q.anchor.set(0.5); q.x = tileW / 2; q.y = tileH / 2;
    g.addChild(q);
  }

  function drawRevealed(g, tile, isPicked) {
    g.removeChildren();
    const color = tile.kind === "diva" ? 0xff2e88
                : tile.mult >= 100 ? 0xffd700
                : tile.mult >= 25 ? 0xff2e88
                : tile.mult >= 10 ? 0xf2c76e
                : tile.mult >= 3 ? 0x57d38f : 0xb0b0b0;
    const edge = isPicked ? 5 : 2;
    const bgGfx = new PIXI.Graphics();
    bgGfx.lineStyle(edge, color, 1)
      .beginFill(0x1c0e2a)
      .drawRoundedRect(0, 0, tileW, tileH, 10)
      .endFill();
    g.addChild(bgGfx);

    if (tile.kind === "diva" && tile.cast) {
      const url = castToPhotoURL(tile.cast);
      const photoSize = tileW - 6;
      // dark placeholder while photo loads
      const ph = new PIXI.Graphics();
      ph.beginFill(0x2b1a06).drawRoundedRect(3, 3, photoSize, photoSize, 8).endFill();
      g.addChild(ph);

      // shade + badge drawn AFTER photo loads so they sit on top
      PIXI.Assets.load(url).then(tex => {
        if (!tex || g.destroyed) return;
        const sp = new PIXI.Sprite(tex);
        const scale = photoSize / Math.min(tex.width, tex.height);
        sp.scale.set(scale);
        sp.anchor.set(0.5);
        sp.x = tileW / 2; sp.y = tileH / 2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(3, 3, photoSize, photoSize, 8).endFill();
        g.addChild(mask);
        sp.mask = mask;
        g.addChild(sp);
        addBadge(g, tile, isPicked, photoSize);
      }).catch(() => {
        addBadge(g, tile, isPicked, photoSize);
      });
    } else {
      const mt = new PIXI.Text(tile.mult + "x", {
        fontFamily: "Outfit, sans-serif", fontSize: Math.max(20, tileW * 0.5),
        fontWeight: "900", fill: color
      });
      mt.anchor.set(0.5);
      mt.x = tileW / 2; mt.y = tileH / 2;
      g.addChild(mt);
      if (isPicked) {
        const lbl = new PIXI.Text("MULTIPLIER", {
          fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "700",
          fill: 0xffe9b8, stroke: 0x000000, strokeThickness: 2
        });
        lbl.anchor.set(0.5, 0);
        lbl.x = tileW / 2; lbl.y = 4;
        g.addChild(lbl);
      }
    }
  }

  function addBadge(g, tile, isPicked, photoSize) {
    const shade = new PIXI.Graphics();
    shade.beginFill(0x000000, 0.55).drawRoundedRect(3, tileH - 22, photoSize, 19, 4).endFill();
    g.addChild(shade);
    const bt = new PIXI.Text(tile.mult + "x", {
      fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "900", fill: 0xffe9b8
    });
    bt.anchor.set(0.5, 0.5);
    bt.x = tileW / 2; bt.y = tileH - 12;
    g.addChild(bt);
    if (isPicked && tile.cast) {
      const lbl = new PIXI.Text(tile.cast.name, {
        fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "700",
        fill: 0xffe9b8, stroke: 0x000000, strokeThickness: 2
      });
      lbl.anchor.set(0.5, 0);
      lbl.x = tileW / 2; lbl.y = 4;
      g.addChild(lbl);
    }
  }

  function onTileTap(idx) {
    if (revealing || picked) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    pickedTileIdx = idx;
    picked = true;
    revealing = true;
    hintText.text = "Revealing…";
    const tile = tiles[idx];
    sfx.reveal();
    // flip animation (squash x to 0, swap to revealed, restore)
    const startTime = performance.now();
    const flipFn = () => {
      const e = (performance.now() - startTime) / 350;
      if (e < 0.5) {
        tile.gfx.scale.x = Math.max(0.02, 1 - e / 0.5);
      } else if (e < 1) {
        if (!tile.revealed) {
          tile.revealed = true;
          drawRevealed(tile.gfx, tile, true);
        }
        tile.gfx.scale.x = Math.max(0.02, (e - 0.5) / 0.5);
      } else {
        tile.gfx.scale.x = 1;
        pixiApp.ticker.remove(flipFn);
        pulsePicked(tile.gfx);
        setTimeout(revealRest, 280);
      }
    };
    pixiApp.ticker.add(flipFn);
  }

  function pulsePicked(g) {
    const start = performance.now();
    const fn = () => {
      const e = (performance.now() - start) / 600;
      if (e >= 1) {
        g.scale.set(1);
        pixiApp.ticker.remove(fn);
        return;
      }
      const s = 1 + 0.08 * Math.sin(e * Math.PI * 4);
      g.scale.set(s);
    };
    pixiApp.ticker.add(fn);
  }

  async function revealRest() {
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].revealed) continue;
      tiles[i].revealed = true;
      drawRevealed(tiles[i].gfx, tiles[i], false);
      sfx.tick();
      await new Promise(r => setTimeout(r, 45));
    }
    finalizePayout();
  }

  function finalizePayout() {
    const tile = tiles[pickedTileIdx];
    const win = Math.floor(curBet * tile.mult);
    if (win > 0) {
      store.pay(win);
      store.record(game.id, curBet, win);
      const tier = tile.mult >= 100 ? "jackpot"
                 : tile.mult >= 50 ? "mega"
                 : tile.mult >= 10 ? "big" : "win";
      const label = tile.kind === "diva"
        ? `${tile.cast.name} · ${tile.mult}x`
        : `${tile.mult}x multiplier`;
      resultText.text = `${label} · +${win}`;
      if (tier === "jackpot") sfx.jackpot();
      else if (tier === "mega") sfx.mega();
      else if (tier === "big") sfx.big();
      else sfx.win();
      host.onWin(tier, win, { title: label, line: "+" + win + " chips" });
    } else {
      store.record(game.id, curBet, 0);
      sfx.lose();
      resultText.text = `${tile.mult}x · no win`;
    }
    revealing = false;
    hintText.text = "Tap NEW HUNT for another round.";
  }

  // NEW HUNT button: rebuild face-down tiles (no bet cost; bet is paid on tile tap)
  huntBtn.on("pointertap", () => {
    if (revealing) return;
    sfx.click();
    buildTiles();
    pickedTileIdx = -1;
    picked = false;
    resultText.text = "";
    hintText.text = "Tap any tile. Find a diva or a big multiplier.";
  });

  // initial face-down grid
  buildTiles();

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);

  return function cleanup() {
    pixiApp.ticker.remove(tickerFn);
  };
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "700", fill: fg
  });
  tx.anchor.set(0.5); tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}
