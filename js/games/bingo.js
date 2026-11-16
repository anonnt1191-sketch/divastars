// games/bingo.js — 4x4 photo bingo card. Caller draws 30 diva balls (with photos).
// Auto-daub matching cells. Payouts: 1 line=x2, 2 lines=x5, 3+ lines=x10, blackout=x50.
// Called-balls strip at top (last 8 visible, scrolls horizontally).

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { CAST_LIST } from "../core/app.js";
import { castToPhotoURL, castPick } from "../core/photos.js";

const CARD_SIZE = 4;            // 4x4 = 16 cells
const TOTAL_DRAW = 30;          // caller draws 30 balls
const EXTRA_POOL = 14;          // ball pool = 16 card divas + 14 extras (with replacement)

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

  // ============ CALLED-BALLS STRIP (top) ============
  const stripY = 28;
  const stripH = 70;
  const stripX = 8;
  const stripW = W - 16;
  const stripContainer = new PIXI.Container();
  stripContainer.x = stripX; stripContainer.y = stripY;
  c.addChild(stripContainer);

  const stripBg = new PIXI.Graphics();
  stripBg.lineStyle(2, 0xf2c76e, 0.3)
    .beginFill(0x1c0e2a)
    .drawRoundedRect(0, 0, stripW, stripH, 10)
    .endFill();
  stripContainer.addChild(stripBg);

  const stripLabel = new PIXI.Text("Called:", {
    fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "700", fill: 0x9d4edd
  });
  stripLabel.x = 8; stripLabel.y = stripH / 2 - stripLabel.height / 2;
  stripContainer.addChild(stripLabel);

  const ballSize = stripH - 14;
  const ballsBox = new PIXI.Container();
  ballsBox.x = 64; ballsBox.y = 7;
  stripContainer.addChild(ballsBox);

  // mask the ballsBox to clip overflow
  const stripMaskW = stripW - 64 - 8;
  const stripMask = new PIXI.Graphics();
  stripMask.beginFill(0xffffff).drawRoundedRect(0, 0, stripMaskW, stripH - 14, 6).endFill();
  stripMask.x = ballsBox.x; stripMask.y = ballsBox.y;
  stripContainer.addChild(stripMask);
  ballsBox.mask = stripMask;

  const calledBalls = []; // [{ cast, cont }]

  // ============ 4x4 PHOTO CARD ============
  const cardTop = stripY + stripH + 10;
  const bottomReserve = 130;   // result text + betRow + button
  const cardAvailH = H - cardTop - bottomReserve;
  const cellSize = Math.min((W - 24) / CARD_SIZE, cardAvailH / CARD_SIZE);
  const cardW = cellSize * CARD_SIZE;
  const cardH = cellSize * CARD_SIZE;
  const cardX = (W - cardW) / 2;
  const cardY = cardTop + Math.max(0, (cardAvailH - cardH) / 2);

  // outer frame
  const frame = new PIXI.Graphics();
  frame.lineStyle(3, 0xf2c76e, 0.6)
    .beginFill(0x160b20, 0.4)
    .drawRoundedRect(cardX - 6, cardY - 6, cardW + 12, cardH + 12, 14)
    .endFill();
  c.addChild(frame);

  // cells
  let cells = [];  // { cast, idx, row, col, gfx, mark, marked }

  function buildCard() {
    for (const cell of cells) {
      if (cell.gfx.parent) cell.gfx.parent.removeChild(cell.gfx);
      cell.gfx.destroy();
    }
    cells = [];
    const used = new Set();
    for (let i = 0; i < CARD_SIZE * CARD_SIZE; i++) {
      const cast = castPick(CAST_LIST, used);
      used.add(cast.key);
      const row = Math.floor(i / CARD_SIZE);
      const col = i % CARD_SIZE;
      const x = cardX + col * cellSize;
      const y = cardY + row * cellSize;
      const cellGfx = new PIXI.Container();
      cellGfx.x = x; cellGfx.y = y;
      const bgGfx = new PIXI.Graphics();
      bgGfx.lineStyle(2, 0xf2c76e, 0.4)
        .beginFill(0x1c0e2a)
        .drawRoundedRect(2, 2, cellSize - 4, cellSize - 4, 8)
        .endFill();
      cellGfx.addChild(bgGfx);
      // photo (cover-fit, big)
      const photoSize = cellSize - 8;
      const url = castToPhotoURL(cast);
      PIXI.Assets.load(url).then(tex => {
        if (!tex || cellGfx.destroyed) return;
        const sp = new PIXI.Sprite(tex);
        const scale = photoSize / Math.min(tex.width, tex.height);
        sp.scale.set(scale);
        sp.anchor.set(0.5);
        sp.x = cellSize / 2; sp.y = cellSize / 2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(4, 4, photoSize, photoSize, 6).endFill();
        cellGfx.addChild(mask);
        sp.mask = mask;
        cellGfx.addChildAt(sp, 1); // right after bgGfx
        // darken slightly for mark contrast
        const tint = new PIXI.Graphics();
        tint.beginFill(0x000000, 0.25).drawRoundedRect(4, 4, photoSize, photoSize, 6).endFill();
        cellGfx.addChild(tint);
      }).catch(() => {});
      // name label (bottom)
      const nameTx = new PIXI.Text(cast.name, {
        fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "700",
        fill: 0xffe9b8, stroke: 0x000000, strokeThickness: 3, align: "center"
      });
      nameTx.anchor.set(0.5, 1);
      nameTx.x = cellSize / 2; nameTx.y = cellSize - 4;
      cellGfx.addChild(nameTx);
      // mark overlay (hidden until drawn)
      const mark = new PIXI.Graphics();
      mark.lineStyle(4, 0xff2e88, 1)
        .beginFill(0xff2e88, 0.45)
        .drawRoundedRect(4, 4, cellSize - 8, cellSize - 8, 8)
        .endFill();
      mark.beginFill(0xffe9b8).drawCircle(cellSize / 2, cellSize / 2, cellSize * 0.18).endFill();
      mark.alpha = 0;
      cellGfx.addChild(mark);
      c.addChild(cellGfx);
      cells.push({ cast, idx: i, row, col, gfx: cellGfx, mark, marked: false });
    }
  }

  buildCard();

  // ============ RESULT TEXT ============
  const resultText = new PIXI.Text("Pick a bet, then DRAW.", {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "900", fill: 0xffe9b8,
    stroke: 0x160b20, strokeThickness: 3, align: "center",
    wordWrap: true, wordWrapWidth: W - 16
  });
  resultText.anchor.set(0.5, 0);
  resultText.x = W / 2;
  resultText.y = cardY + cardH + 10;
  c.addChild(resultText);

  // ============ BET ROW + DRAW BUTTON ============
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    curBet = [10, 25, 50, 100, 250][i];
    updateBtn();
  }));

  const drawBtn = makeButton(W - 16, 60, "DRAW · " + curBet, 0xf2c76e, 0x160b20);
  drawBtn.x = 8; drawBtn.y = H - 60;
  drawBtn.interactive = true; drawBtn.buttonMode = true;
  c.addChild(drawBtn);
  function updateBtn() { drawBtn.children[1].text = "DRAW · " + curBet; }

  let drawing = false;

  // ============ DRAW LOGIC ============
  function findCellByKey(cast) {
    return cells.find(c => c.cast.key === cast.key);
  }

  function addCalledBall(cast) {
    const url = castToPhotoURL(cast);
    const idx = calledBalls.length;
    const bx = idx * (ballSize + 4);
    const cont = new PIXI.Container();
    cont.x = bx; cont.y = 0;
    const ring = new PIXI.Graphics();
    ring.lineStyle(2, 0xf2c76e, 0.7)
      .beginFill(0x160b20)
      .drawCircle(ballSize / 2, ballSize / 2, ballSize / 2)
      .endFill();
    cont.addChild(ring);
    ballsBox.addChild(cont);
    PIXI.Assets.load(url).then(tex => {
      if (!tex || cont.destroyed) return;
      const sp = new PIXI.Sprite(tex);
      const scale = ballSize / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5);
      sp.x = ballSize / 2; sp.y = ballSize / 2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawCircle(ballSize / 2, ballSize / 2, ballSize / 2 - 2).endFill();
      cont.addChild(mask);
      sp.mask = mask;
      cont.addChild(sp);
    }).catch(() => {});
    calledBalls.push({ cast, cont });

    // scroll to keep last 8 visible
    const totalW = calledBalls.length * (ballSize + 4);
    if (totalW > stripMaskW) {
      const targetX = -(totalW - stripMaskW);
      const startX = ballsBox.x;
      const startTime = performance.now();
      const tweenFn = () => {
        const e = Math.min(1, (performance.now() - startTime) / 250);
        const eased = 1 - Math.pow(1 - e, 3);
        ballsBox.x = startX + (targetX - startX) * eased;
        if (e >= 1) pixiApp.ticker.remove(tweenFn);
      };
      pixiApp.ticker.add(tweenFn);
    }
  }

  function countLines() {
    let lines = 0;
    // rows
    for (let r = 0; r < CARD_SIZE; r++) {
      let ok = true;
      for (let cc = 0; cc < CARD_SIZE; cc++) {
        if (!cells[r * CARD_SIZE + cc].marked) { ok = false; break; }
      }
      if (ok) lines++;
    }
    // cols
    for (let cc = 0; cc < CARD_SIZE; cc++) {
      let ok = true;
      for (let r = 0; r < CARD_SIZE; r++) {
        if (!cells[r * CARD_SIZE + cc].marked) { ok = false; break; }
      }
      if (ok) lines++;
    }
    // diagonals
    let d1 = true, d2 = true;
    for (let i = 0; i < CARD_SIZE; i++) {
      if (!cells[i * CARD_SIZE + i].marked) d1 = false;
      if (!cells[i * CARD_SIZE + (CARD_SIZE - 1 - i)].marked) d2 = false;
    }
    if (d1) lines++;
    if (d2) lines++;
    return lines;
  }

  drawBtn.on("pointertap", async () => {
    if (drawing) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    drawing = true;
    drawBtn.interactive = false;
    drawBtn.alpha = 0.5;

    // reset marks + called strip; rebuild card for variety
    for (const cell of cells) {
      cell.marked = false;
      cell.mark.alpha = 0;
    }
    calledBalls.length = 0;
    ballsBox.removeChildren();
    ballsBox.x = 64; // reset scroll
    resultText.text = "Calling the divas…";
    sfx.whoosh();

    // build ball pool: card divas + extras (with replacement)
    const ballPool = cells.map(c => c.cast);
    const usedExtras = new Set(cells.map(c => c.cast.key));
    for (let i = 0; i < EXTRA_POOL; i++) {
      const ex = castPick(CAST_LIST, usedExtras);
      usedExtras.add(ex.key);
      ballPool.push(ex);
    }
    // draw 30 with replacement
    for (let i = 0; i < TOTAL_DRAW; i++) {
      const cast = ballPool[Math.floor(Math.random() * ballPool.length)];
      addCalledBall(cast);
      const cell = findCellByKey(cast);
      if (cell && !cell.marked) {
        cell.marked = true;
        cell.mark.alpha = 1;
        sfx.pop();
      } else {
        sfx.tick();
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // payout: highest tier reached
    const lines = countLines();
    const blackout = cells.every(c => c.marked);
    let mult = 0, tier = "lose", label = "No complete lines.";
    if (blackout) {
      mult = 50; tier = "jackpot";
      label = "BLACKOUT! 50x";
    } else if (lines >= 3) {
      mult = 10; tier = "mega";
      label = `${lines} lines · 10x`;
    } else if (lines === 2) {
      mult = 5; tier = "big";
      label = "2 lines · 5x";
    } else if (lines === 1) {
      mult = 2; tier = "win";
      label = "1 line · 2x";
    }

    const win = Math.floor(curBet * mult);
    if (win > 0) {
      store.pay(win);
      store.record(game.id, curBet, win);
      if (tier === "jackpot") sfx.jackpot();
      else if (tier === "mega") sfx.mega();
      else if (tier === "big") sfx.big();
      else sfx.win();
      resultText.text = `${label} · +${win}`;
      host.onWin(tier, win, { title: label, line: "+" + win + " chips" });
    } else {
      store.record(game.id, curBet, 0);
      sfx.lose();
      resultText.text = label;
    }
    drawing = false;
    drawBtn.interactive = true;
    drawBtn.alpha = 1;
    updateBtn();
  });

  // ticker placeholder (no per-frame work, but matches pattern)
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
