// games/mines.js — 5x5 grid of photo tiles. Hidden under some tiles is "The Ex" (the mine).
// Pick a tile count (3, 5, or 10 exes). Each safe reveal raises the multiplier.
// Cash out anytime. Hit The Ex and the round ends with no win.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { castToPhotoURL } from "../core/photos.js";
import { EX } from "../data/divas.js";

const EXES_OPTIONS = [3, 5, 10];
const TILE_SIZE = 80;

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  // bg
  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  // tagline
  const tagline = new PIXI.Text(game.tagline, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 11, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // state
  let exCount = 5;
  let curBet = 25;
  let grid = []; // [{cast, isEx, revealed, sprite}]
  let revealed = 0;
  let exHit = false;
  let roundActive = false;

  // exes selector
  const exRow = new PIXI.Container();
  exRow.x = 8; exRow.y = 24;
  c.addChild(exRow);
  const exPills = [];
  EXES_OPTIONS.forEach((n, i) => {
    const p = makePill(`${n} ${t("mines.exes")}`, n === exCount ? 0xf2c76e : 0x333333, n === exCount ? 0x160b20 : 0xffffff);
    p.x = i * (p.width + 4);
    p.interactive = true; p.buttonMode = true;
    p.on("pointertap", () => {
      if (roundActive) { host.toast("Round in progress."); return; }
      sfx.click();
      exCount = n;
      exPills.forEach(x => {
        x.children[0].clear();
        x.children[0].beginFill(0x333333).drawRoundedRect(0, 0, x.width, x.height, x.height/2).endFill();
        x.children[1].style.fill = 0xffffff;
      });
      p.children[0].clear();
      p.children[0].beginFill(0xf2c76e).drawRoundedRect(0, 0, p.width, p.height, p.height/2).endFill();
      p.children[1].style.fill = 0x160b20;
    });
    exPills.push(p);
    exRow.addChild(p);
  });

  // grid 5x5
  const gridCols = 5;
  const gridGfx = new PIXI.Container();
  const gridW = gridCols * TILE_SIZE + (gridCols - 1) * 6;
  const gridStartX = (W - gridW) / 2;
  const gridStartY = 70;
  c.addChild(gridGfx);

  // multiplier / status display (right side or top of grid)
  const statusBox = new PIXI.Container();
  statusBox.x = W - 90;
  statusBox.y = 70;
  c.addChild(statusBox);
  function drawStatusBox() {
    statusBox.removeChildren();
    const bg = new PIXI.Graphics();
    bg.beginFill(0x1c0e2a, 0.9).drawRoundedRect(0, 0, 80, 200, 8).endFill();
    statusBox.addChild(bg);
    const title = new PIXI.Text("STATUS", {
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize:12, fontWeight: "700", fill: 0x9d4edd
    });
    title.x = 40; title.y = 8; title.anchor.set(0.5, 0);
    statusBox.addChild(title);
    const mult = currentMultiplier();
    const mt = new PIXI.Text(mult.toFixed(2) + "x", {
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize: 18, fontWeight: "900", fill: 0xf2c76e, align: "center"
    });
    mt.anchor.set(0.5, 0); mt.x = 40; mt.y = 30;
    statusBox.addChild(mt);
    const r = new PIXI.Text(`Revealed: ${revealed}/25`, {
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize: 11, fontWeight: "600", fill: 0xffffff, align: "center"
    });
    r.anchor.set(0.5, 0); r.x = 40; r.y = 60;
    statusBox.addChild(r);
    const nextMult = nextMultiplier();
    const nm = new PIXI.Text(`Next: ${nextMult.toFixed(2)}x`, {
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize: 11, fontWeight: "700", fill: 0x57d38f, align: "center"
    });
    nm.anchor.set(0.5, 0); nm.x = 40; nm.y = 80;
    statusBox.addChild(nm);
  }

  function currentMultiplier() {
    // multiplier formula: based on number of safe reveals + total tiles + exes
    // Uses provably-fair-style formula: (25 - exCount) C revealed / 25 C revealed) ^ -1
    if (revealed === 0) return 1;
    let m = 1;
    for (let i = 0; i < revealed; i++) {
      m *= (25 - i) / (25 - exCount - i);
    }
    return m * 0.97; // 3% house edge
  }
  function nextMultiplier() {
    if (revealed >= 25 - exCount) return currentMultiplier();
    let m = 1;
    for (let i = 0; i <= revealed; i++) {
      m *= (25 - i) / (25 - exCount - i);
    }
    return m * 0.97;
  }

  // build grid
  function buildGrid() {
    gridGfx.removeChildren();
    grid = [];
    // pick cast for tiles: 25 photos from SESSION.mines, replace some with The Ex
    const castPool = [...SESSION.mines];
    // place exes at random positions
    const exPositions = new Set();
    while (exPositions.size < exCount) {
      exPositions.add(Math.floor(Math.random() * 25));
    }
    for (let i = 0; i < 25; i++) {
      const row = Math.floor(i / 5), col = i % 5;
      const x = gridStartX + col * (TILE_SIZE + 6);
      const y = gridStartY + row * (TILE_SIZE + 6);
      const tile = {
        x, y, idx: i, isEx: exPositions.has(i),
        cast: castPool[i % castPool.length],
        revealed: false,
        sprite: null
      };
      // hidden tile bg
      const hidden = new PIXI.Graphics();
      hidden.beginFill(0x2b1a06).drawRoundedRect(x, y, TILE_SIZE, TILE_SIZE, 8).endFill();
      hidden.beginFill(0xf2c76e, 0.4).drawRoundedRect(x, y, TILE_SIZE, 3, 2).endFill();
      hidden.interactive = true;
      hidden.buttonMode = true;
      hidden.on("pointertap", () => revealTile(tile));
      gridGfx.addChild(hidden);
      tile.hiddenGfx = hidden;
      grid.push(tile);
    }
    drawStatusBox();
  }
  buildGrid();

  async function revealTile(tile) {
    if (!roundActive || tile.revealed) return;
    tile.revealed = true;
    if (tile.isEx) {
      // hit the ex
      exHit = true;
      roundActive = false;
      sfx.crash();
      // show ex photo
      try {
        const tex = await PIXI.Assets.load(EX.photo);
        const sp = new PIXI.Sprite(tex);
        const scale = TILE_SIZE / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = tile.x; sp.y = tile.y;
        gridGfx.addChild(sp);
        tile.sprite = sp;
        // overlay red
        const redFlash = new PIXI.Graphics();
        redFlash.beginFill(0xff5d5d, 0.6).drawRoundedRect(tile.x, tile.y, TILE_SIZE, TILE_SIZE, 8).endFill();
        gridGfx.addChild(redFlash);
        // reveal all exes
        for (const t of grid) {
          if (t.isEx && !t.revealed) {
            t.revealed = true;
            const ex = new PIXI.Sprite(tex);
            ex.scale.set(scale);
            ex.x = t.x; ex.y = t.y;
            ex.alpha = 0.5;
            gridGfx.addChild(ex);
          }
        }
      } catch(e) {}
      store.record(game.id, curBet, 0);
      host.toast(t("mines.busted") + " Lost " + curBet + " chips.", 3000);
      // reset after delay
      setTimeout(() => {
        exHit = false;
        revealed = 0;
        buildGrid();
      }, 2500);
    } else {
      // safe reveal
      revealed++;
      sfx.reveal();
      // hide the hidden tile bg
      tile.hiddenGfx.visible = false;
      // show the photo
      try {
        const url = castToPhotoURL(tile.cast);
        const tex = await PIXI.Assets.load(url);
        const sp = new PIXI.Sprite(tex);
        const scale = TILE_SIZE / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = tile.x; sp.y = tile.y;
        // mask rounded
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(tile.x, tile.y, TILE_SIZE, TILE_SIZE, 8).endFill();
        gridGfx.addChild(mask);
        sp.mask = mask;
        gridGfx.addChild(sp);
        tile.sprite = sp;
        // pop-in animation
        sp.scale.set(scale * 0.5);
        sp.anchor.set(0);
        let el = 0;
        const fn = (dt) => {
          el += dt;
          const s = scale * (0.5 + 0.5 * Math.min(1, el / 10));
          sp.scale.set(s);
          sp.x = tile.x + (TILE_SIZE - tex.width * s) / 2;
          sp.y = tile.y + (TILE_SIZE - tex.height * s) / 2;
          if (el >= 10) pixiApp.ticker.remove(fn);
        };
        pixiApp.ticker.add(fn);
      } catch(e) {}
      drawStatusBox();
      // if all safe tiles revealed, auto cash out
      if (revealed >= 25 - exCount) {
        doCashOut();
      }
    }
  }

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; }));

  // bet button + cash out button
  const betBtn = makeButton(W - 16, 50, t("common.bet") + " " + curBet, 0xf2c76e, 0x160b20);
  betBtn.x = 8; betBtn.y = H - 50;
  betBtn.interactive = true; betBtn.buttonMode = true;
  c.addChild(betBtn);

  function updateBetBtn() {
    if (roundActive) {
      const win = Math.floor(curBet * currentMultiplier());
      betBtn.children[0].clear();
      betBtn.children[0].beginFill(0x57d38f).drawRoundedRect(0, 0, W - 16, 50, 12).endFill();
      betBtn.children[1].text = t("mines.cashOut") + " · +" + win;
      betBtn.children[1].style.fill = 0x160b20;
    } else {
      betBtn.children[0].clear();
      betBtn.children[0].beginFill(0xf2c76e).drawRoundedRect(0, 0, W - 16, 50, 12).endFill();
      betBtn.children[1].text = t("common.bet") + " " + curBet;
      betBtn.children[1].style.fill = 0x160b20;
    }
  }
  betRow.children.forEach((p) => p.on("pointertap", updateBetBtn));
  updateBetBtn();

  betBtn.on("pointertap", () => {
    sfx.click();
    if (roundActive) {
      doCashOut();
    } else {
      if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
      roundActive = true;
      revealed = 0;
      exHit = false;
      buildGrid();
      updateBetBtn();
    }
  });

  function doCashOut() {
    if (!roundActive) return;
    const mult = currentMultiplier();
    const win = Math.floor(curBet * mult);
    store.pay(win);
    store.record(game.id, curBet, win);
    sfx.win();
    roundActive = false;
    host.onWin(mult >= 10 ? "mega" : mult >= 3 ? "big" : "win", win, {
      title: mult.toFixed(2) + "x · cashed out",
      line: "The Ex didn't catch you this time."
    });
    setTimeout(() => {
      revealed = 0;
      buildGrid();
      updateBetBtn();
    }, 1800);
  }

  // tick status box to keep multiplier updated mid-round
  const tickerFn = () => { if (roundActive) drawStatusBox(); };
  pixiApp.ticker.add(tickerFn);

  return function cleanup() {
    pixiApp.ticker.remove(tickerFn);
  };
}

function makePill(text, bg, fg) {
  const c = new PIXI.Container();
  const tx = new PIXI.Text(text, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 12, fontWeight: "700", fill: fg
  });
  const padX = 10, padY = 6;
  const w = tx.width + padX * 2, h = tx.height + padY * 2;
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, h/2).endFill();
  c.addChild(g);
  tx.x = padX; tx.y = padY;
  c.addChild(tx);
  return c;
}

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
  tx.x = w/2; tx.y = h/2;
  c.addChild(tx);
  return c;
}
