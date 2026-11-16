// games/roulette.js — Den Roulette. European 37-pocket wheel.
// Pocket 0 = The Ex (green). Pockets 1–36 wear diva faces from SESSION.roulette.
// Bets: RED/BLACK, ODD/EVEN, LOW(1-18)/HIGH(19-36) x2; DOZENS, COLUMNS x3; STRAIGHT UP x35.
// Wheel spins clockwise (ease-out cubic), ball orbits counter-clockwise and lands on the winner.
// History strip shows last 10 results.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { EX } from "../data/divas.js";
import { castToPhotoURL } from "../core/photos.js";

const BET_LEVELS = [10, 25, 50, 100, 250];

// Standard European wheel order (37 pockets, starting at 0 going clockwise).
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function isRed(n)     { return RED_SET.has(n); }
function isBlack(n)   { return n !== 0 && !RED_SET.has(n); }
function colorName(n) { return n === 0 ? "Green" : (isRed(n) ? "Red" : "Black"); }
function pocketDiva(n) {
  if (n === 0) return { name: "The Ex" };
  const entry = SESSION.roulette[n - 1];
  return entry?.cast || { name: "Diva" };
}

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.blurb || game.tagline || "", {
    fontFamily: "Outfit, sans-serif", fontSize: 11, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // --- state ---
  let curBet = 25;
  const bets = new Map();   // key → amount
  const history = [];       // last 10 winning numbers
  let spinning = false;

  // --- history strip (top, last 10 results) ---
  const historyContainer = new PIXI.Container();
  historyContainer.x = 8; historyContainer.y = 22;
  c.addChild(historyContainer);
  const hCellW = 28, hCellH = 22;
  function renderHistory() {
    historyContainer.removeChildren();
    for (let i = 0; i < 10; i++) {
      const n = history[i];
      const x = i * (hCellW + 2);
      const g = new PIXI.Graphics();
      const color = n == null ? 0x1c0e2a
        : n === 0 ? 0x117a35
        : isRed(n) ? 0xc0392b : 0x1a1a1a;
      g.lineStyle(1, 0xf2c76e, 0.3).beginFill(color).drawRoundedRect(0, 0, hCellW, hCellH, 3).endFill();
      g.x = x;
      historyContainer.addChild(g);
      if (n != null) {
        const tx = new PIXI.Text(String(n), {
          fontFamily: "Outfit", fontSize: 11, fontWeight: "700", fill: 0xffffff
        });
        tx.anchor.set(0.5); tx.x = x + hCellW / 2; tx.y = hCellH / 2;
        historyContainer.addChild(tx);
      }
    }
  }
  renderHistory();

  // --- result text ---
  const resultText = new PIXI.Text("Place your bets and tap SPIN.", {
    fontFamily: "Outfit", fontSize: 13, fontWeight: "900", fill: 0xf2c76e,
    stroke: 0x160b20, strokeThickness: 3, align: "center",
    wordWrap: true, wordWrapWidth: W - 16
  });
  resultText.anchor.set(0.5, 0); resultText.x = W / 2; resultText.y = 50;
  c.addChild(resultText);

  // --- wheel ---
  const wheelR = Math.min(100, Math.max(78, Math.floor((H - 460) / 2)));
  const wheelCx = W / 2;
  const wheelCy = 80 + wheelR;
  const segAngle = (Math.PI * 2) / 37;

  const wheelHolder = new PIXI.Container();
  wheelHolder.x = wheelCx; wheelHolder.y = wheelCy;
  c.addChild(wheelHolder);

  // outer ring
  const outerRing = new PIXI.Graphics();
  outerRing.lineStyle(3, 0xf2c76e, 0.85).drawCircle(0, 0, wheelR + 6).endFill();
  outerRing.lineStyle(1, 0xf2c76e, 0.3).drawCircle(0, 0, wheelR + 10).endFill();
  wheelHolder.addChild(outerRing);

  const wheelContainer = new PIXI.Container();
  wheelHolder.addChild(wheelContainer);

  // segments
  for (let i = 0; i < 37; i++) {
    const num = WHEEL_ORDER[i];
    const a0 = -Math.PI / 2 + i * segAngle;
    const a1 = a0 + segAngle;
    const color = num === 0 ? 0x117a35 : (isRed(num) ? 0xc0392b : 0x1a1a1a);
    const seg = new PIXI.Graphics();
    seg.lineStyle(1, 0xf2c76e, 0.4);
    seg.beginFill(color).moveTo(0, 0).arc(0, 0, wheelR, a0, a1).closePath().endFill();
    wheelContainer.addChild(seg);
    // number label at outer edge
    const midA = (a0 + a1) / 2;
    const labelR = wheelR * 0.86;
    const lx = Math.cos(midA) * labelR;
    const ly = Math.sin(midA) * labelR;
    const tx = new PIXI.Text(String(num), {
      fontFamily: "Outfit", fontSize:12, fontWeight: "700", fill: 0xffffff
    });
    tx.anchor.set(0.5); tx.x = lx; tx.y = ly;
    tx.rotation = midA + Math.PI / 2;
    wheelContainer.addChild(tx);
  }

  // center photo of The Ex
  try {
    const tex = await PIXI.Assets.load(EX.photo);
    const sp = new PIXI.Sprite(tex);
    const sz = wheelR * 0.5;
    const scale = sz / Math.max(tex.width, tex.height);
    sp.scale.set(scale);
    sp.anchor.set(0.5);
    const centerMask = new PIXI.Graphics();
    centerMask.beginFill(0xffffff).drawCircle(0, 0, sz / 2).endFill();
    wheelHolder.addChild(centerMask);
    sp.mask = centerMask;
    wheelHolder.addChild(sp);
    // ring around center photo
    const centerRing = new PIXI.Graphics();
    centerRing.lineStyle(2, 0xf2c76e, 0.8).drawCircle(0, 0, sz / 2 + 2).endFill();
    wheelHolder.addChild(centerRing);
  } catch(e) {}

  // pointer at top (downward triangle)
  const pointer = new PIXI.Graphics();
  pointer.beginFill(0xffe9b8).drawPolygon([0, 4, -9, -10, 9, -10]).endFill();
  pointer.beginFill(0xff2e88).drawCircle(0, -10, 4).endFill();
  pointer.x = wheelCx; pointer.y = wheelCy - wheelR - 6;
  c.addChild(pointer);

  // ball (white circle with dark outline)
  const ballR = wheelR - 10;
  const ball = new PIXI.Graphics();
  ball.lineStyle(1, 0x160b20, 0.5).beginFill(0xffffff).drawCircle(0, 0, 5).endFill();
  ball.beginFill(0xffe9b8, 0.6).drawCircle(-1.5, -1.5, 2).endFill();
  c.addChild(ball);
  ball.x = wheelCx + ballR;
  ball.y = wheelCy;

  // --- betting grid ---
  const cellSize = 28;
  const gridTotalW = cellSize * 14;   // 0 + 12 numbers + col
  const gridX = Math.floor((W - gridTotalW) / 2);
  const gridY = wheelCy + wheelR + 18;
  const gridContainer = new PIXI.Container();
  gridContainer.x = gridX; gridContainer.y = gridY;
  c.addChild(gridContainer);

  const betCells = {};   // key → cell container

  function makeCell(x, y, w, h, label, bgColor, fgColor, key, fontSize = 11) {
    const cell = new PIXI.Container();
    cell.x = x; cell.y = y;
    const g = new PIXI.Graphics();
    g.lineStyle(1, 0xf2c76e, 0.4).beginFill(bgColor).drawRoundedRect(0, 0, w, h, 3).endFill();
    cell.addChild(g);
    const tx = new PIXI.Text(label, {
      fontFamily: "Outfit", fontSize, fontWeight: "700", fill: fgColor
    });
    tx.anchor.set(0.5); tx.x = w / 2; tx.y = h / 2;
    cell.addChild(tx);
    cell.interactive = true; cell.buttonMode = true;
    cell.on("pointertap", () => toggleBet(key));
    cell._w = w; cell._h = h;
    cell._chipGfx = null;
    cell._chipLabel = null;
    gridContainer.addChild(cell);
    betCells[key] = cell;
    return cell;
  }

  function makeNumberCell(num, x, y, w, h) {
    const color = num === 0 ? 0x117a35 : (isRed(num) ? 0xc0392b : 0x1a1a1a);
    return makeCell(x, y, w, h, String(num), color, 0xffffff, "straight:" + num, num === 0 ? 13 : 11);
  }

  // 0 cell (spans 3 rows tall)
  makeNumberCell(0, 0, 0, cellSize, cellSize * 3);
  // 12 cols × 3 rows
  for (let col = 0; col < 12; col++) {
    for (let row = 0; row < 3; row++) {
      const num = col * 3 + (3 - row);
      const x = cellSize + col * cellSize;
      const y = row * cellSize;
      makeNumberCell(num, x, y, cellSize, cellSize);
    }
  }
  // column bet cells (right of grid, one per row)
  for (let row = 0; row < 3; row++) {
    const colIdx = 3 - row;   // row 0 → col 3, row 1 → col 2, row 2 → col 1
    const x = cellSize + 12 * cellSize;
    const y = row * cellSize;
    makeCell(x, y, cellSize, cellSize, "2:1", 0x1c0e2a, 0xffe9b8, "col:" + colIdx, 8);
  }

  // --- dozens row ---
  const dozensY = cellSize * 3 + 4;
  const dozensContainer = new PIXI.Container();
  dozensContainer.x = gridX + cellSize; dozensContainer.y = gridY + dozensY;
  c.addChild(dozensContainer);
  const dozenW = (12 * cellSize - 8) / 3;
  function makeDozen(i) {
    const w = dozenW, h = 26;
    const cell = new PIXI.Container();
    cell.x = i * (dozenW + 4); cell.y = 0;
    const g = new PIXI.Graphics();
    g.lineStyle(1, 0xf2c76e, 0.4).beginFill(0x1c0e2a).drawRoundedRect(0, 0, w, h, 4).endFill();
    cell.addChild(g);
    const tx = new PIXI.Text(`${i * 12 + 1}-${(i + 1) * 12}`, {
      fontFamily: "Outfit", fontSize: 11, fontWeight: "700", fill: 0xffe9b8
    });
    tx.anchor.set(0.5); tx.x = w / 2; tx.y = h / 2;
    cell.addChild(tx);
    cell.interactive = true; cell.buttonMode = true;
    cell.on("pointertap", () => toggleBet("dozen:" + (i + 1)));
    cell._w = w; cell._h = h; cell._chipGfx = null; cell._chipLabel = null;
    dozensContainer.addChild(cell);
    betCells["dozen:" + (i + 1)] = cell;
  }
  for (let i = 0; i < 3; i++) makeDozen(i);

  // --- outside bets row ---
  const outsideY = dozensY + 30;
  const outsideContainer = new PIXI.Container();
  outsideContainer.x = gridX + cellSize; outsideContainer.y = gridY + outsideY;
  c.addChild(outsideContainer);
  const outsideW = (12 * cellSize - 16) / 6;
  const outsideBets = [
    { key: "low",   label: "1-18",  color: 0x1c0e2a },
    { key: "even",  label: "EVEN",  color: 0x1c0e2a },
    { key: "red",   label: "RED",   color: 0xc0392b },
    { key: "black", label: "BLACK", color: 0x1a1a1a },
    { key: "odd",   label: "ODD",   color: 0x1c0e2a },
    { key: "high",  label: "19-36", color: 0x1c0e2a }
  ];
  outsideBets.forEach((b, i) => {
    const w = outsideW, h = 26;
    const cell = new PIXI.Container();
    cell.x = i * (outsideW + 4); cell.y = 0;
    const g = new PIXI.Graphics();
    g.lineStyle(1, 0xf2c76e, 0.4).beginFill(b.color).drawRoundedRect(0, 0, w, h, 4).endFill();
    cell.addChild(g);
    const tx = new PIXI.Text(b.label, {
      fontFamily: "Outfit", fontSize:12, fontWeight: "700", fill: 0xffffff
    });
    tx.anchor.set(0.5); tx.x = w / 2; tx.y = h / 2;
    cell.addChild(tx);
    cell.interactive = true; cell.buttonMode = true;
    cell.on("pointertap", () => toggleBet(b.key));
    cell._w = w; cell._h = h; cell._chipGfx = null; cell._chipLabel = null;
    outsideContainer.addChild(cell);
    betCells[b.key] = cell;
  });

  // --- chip indicator on a cell ---
  function renderChip(cell, amount) {
    if (cell._chipGfx) { cell.removeChild(cell._chipGfx); cell._chipGfx = null; }
    if (cell._chipLabel) { cell.removeChild(cell._chipLabel); cell._chipLabel = null; }
    if (amount > 0) {
      const chip = new PIXI.Graphics();
      chip.lineStyle(1, 0x160b20, 0.7).beginFill(0xf2c76e).drawCircle(cell._w / 2, cell._h / 2, 9).endFill();
      chip.beginFill(0xffe9b8, 0.4).drawCircle(cell._w / 2 - 2, cell._h / 2 - 2, 3).endFill();
      cell.addChild(chip);
      cell._chipGfx = chip;
      const lbl = new PIXI.Text(String(amount), {
        fontFamily: "Outfit", fontSize:12, fontWeight: "900", fill: 0x160b20
      });
      lbl.anchor.set(0.5); lbl.x = cell._w / 2; lbl.y = cell._h / 2;
      cell.addChild(lbl);
      cell._chipLabel = lbl;
    }
  }

  function toggleBet(key) {
    if (spinning) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    const cur = bets.get(key) || 0;
    bets.set(key, cur + curBet);
    renderChip(betCells[key], cur + curBet);
    updateTotal();
  }

  function clearBets() {
    if (spinning) return;
    if (bets.size === 0) return;
    sfx.click();
    let refund = 0;
    for (const v of bets.values()) refund += v;
    if (refund > 0) store.pay(refund);
    bets.clear();
    for (const key of Object.keys(betCells)) renderChip(betCells[key], 0);
    updateTotal();
  }

  // --- total wagered text ---
  const totalText = new PIXI.Text("Total wagered: 0", {
    fontFamily: "Outfit", fontSize: 12, fontWeight: "700", fill: 0xffe9b8
  });
  totalText.anchor.set(0.5, 0); totalText.x = W / 2;
  totalText.y = gridY + outsideY + 34;
  c.addChild(totalText);
  function updateTotal() {
    let total = 0;
    for (const v of bets.values()) total += v;
    totalText.text = "Total wagered: " + total;
  }

  // --- bet row ---
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    if (spinning) return;
    curBet = BET_LEVELS[i];
  }));

  // --- spin & clear buttons ---
  const btnW = (W - 16 - 8) / 2;
  const spinBtn = makeButton(btnW, 50, t("wheel.spin"), 0xf2c76e, 0x160b20);
  spinBtn.x = 8; spinBtn.y = H - 50;
  spinBtn.interactive = true; spinBtn.buttonMode = true;
  c.addChild(spinBtn);
  const clearBtn = makeButton(btnW, 50, "CLEAR", 0xff5d5d, 0xffffff);
  clearBtn.x = 8 + btnW + 8; clearBtn.y = H - 50;
  clearBtn.interactive = true; clearBtn.buttonMode = true;
  c.addChild(clearBtn);

  spinBtn.on("pointertap", () => {
    if (spinning) return;
    if (bets.size === 0) { host.toast("Place a bet first, darling."); return; }
    startSpin();
  });
  clearBtn.on("pointertap", clearBets);

  // --- spin animation state ---
  let spinStart = 0;
  const spinDuration = 5200;
  let wheelStartRot = 0, wheelTargetRot = 0;
  let ballStartAngle = 0, ballTargetAngle = 0;
  let winningNumber = 0;

  function startSpin() {
    sfx.click();
    spinning = true;
    spinBtn.interactive = false; clearBtn.interactive = false;
    winningNumber = Math.floor(Math.random() * 37);
    const idx = WHEEL_ORDER.indexOf(winningNumber);
    // segment idx midpoint in wheel local frame (segments start at top, clockwise)
    // we want pocketMidLocal + wheelRot ≡ -π/2 (mod 2π)  →  wheelRot ≡ -(idx+0.5)*segAngle
    let endRot = -((idx + 0.5) * segAngle);
    endRot = ((endRot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const turns = 5 + Math.floor(Math.random() * 3);
    wheelStartRot = wheelContainer.rotation;
    wheelTargetRot = wheelStartRot + turns * Math.PI * 2 + endRot;
    // ball: random start, ends at top (-π/2), counter-clockwise (decreasing angle)
    ballStartAngle = Math.random() * Math.PI * 2;
    let delta = (-Math.PI / 2) - ballStartAngle;
    while (delta > 0) delta -= Math.PI * 2;   // ensure CCW (negative)
    const ballTurns = 3 + Math.floor(Math.random() * 2);
    ballTargetAngle = ballStartAngle + delta - ballTurns * Math.PI * 2;
    spinStart = performance.now();
    resultText.text = "No more bets…";
    sfx.whoosh();
  }

  function settleBets(n) {
    const diva = pocketDiva(n);
    const cname = colorName(n);
    // win conditions
    const isWin = {
      red:   n !== 0 && isRed(n),
      black: n !== 0 && isBlack(n),
      odd:   n !== 0 && n % 2 === 1,
      even:  n !== 0 && n % 2 === 0,
      low:   n >= 1 && n <= 18,
      high:  n >= 19 && n <= 36,
      "dozen:1": n >= 1 && n <= 12,
      "dozen:2": n >= 13 && n <= 24,
      "dozen:3": n >= 25 && n <= 36,
      "col:1": n !== 0 && n % 3 === 1,
      "col:2": n !== 0 && n % 3 === 2,
      "col:3": n !== 0 && n % 3 === 0
    };
    let totalWin = 0;
    let totalWagered = 0;
    const wins = [];
    for (const [key, amount] of bets) {
      totalWagered += amount;
      let won = false, mult = 0;
      if (key === "straight:" + n) { won = true; mult = 35; }
      else if (key.startsWith("straight:")) { won = false; }
      else if (key.startsWith("dozen:") || key.startsWith("col:")) {
        if (isWin[key]) { won = true; mult = 3; }
      } else {
        if (isWin[key]) { won = true; mult = 2; }
      }
      if (won) {
        totalWin += amount + amount * mult;
        wins.push(`${key} +${amount * mult}`);
      }
    }
    if (totalWin > 0) store.pay(totalWin);
    store.record(game.id, totalWagered, totalWin);
    const profit = totalWin - totalWagered;
    resultText.text = `${n} · ${cname} · ${diva.name}   ${profit > 0 ? "+" + profit : profit < 0 ? "−" + (-profit) : "0"} chips`;

    // history
    history.unshift(n);
    if (history.length > 10) history.pop();
    renderHistory();

    if (profit > 0) {
      let tier = "win";
      if (profit >= totalWagered * 5) tier = "big";
      if (profit >= totalWagered * 15 || wins.some(w => w.startsWith("straight:"))) tier = "mega";
      if (n === 0 && wins.some(w => w.startsWith("straight:0"))) tier = "jackpot";
      try { sfx[tier](); } catch(e) { sfx.win(); }
      host.onWin(tier, profit, {
        title: `${n} · ${diva.name}`,
        line: wins.slice(0, 2).join(", ") || cname
      });
    } else {
      sfx.lose();
      host.toast(`${n} · ${cname} · ${diva.name}. No wins this round.`, 2400);
    }

    // clear bets visually
    bets.clear();
    for (const key of Object.keys(betCells)) renderChip(betCells[key], 0);
    updateTotal();
    spinning = false;
    spinBtn.interactive = true; clearBtn.interactive = true;
  }

  const tickerFn = () => {
    if (!spinning) return;
    const elapsed = performance.now() - spinStart;
    const tt = Math.min(1, elapsed / spinDuration);
    const eased = 1 - Math.pow(1 - tt, 3);
    wheelContainer.rotation = wheelStartRot + (wheelTargetRot - wheelStartRot) * eased;
    const ballAngle = ballStartAngle + (ballTargetAngle - ballStartAngle) * eased;
    ball.x = wheelCx + Math.cos(ballAngle) * ballR;
    ball.y = wheelCy + Math.sin(ballAngle) * ballR;
    if (Math.random() < 0.07 && tt > 0.55) sfx.tick();
    if (tt >= 1) {
      // snap to final
      wheelContainer.rotation = wheelTargetRot;
      ball.x = wheelCx + Math.cos(-Math.PI / 2) * ballR;
      ball.y = wheelCy + Math.sin(-Math.PI / 2) * ballR;
      settleBets(winningNumber);
    }
  };
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
    fontFamily: "Outfit", fontSize: 14, fontWeight: "700", fill: fg, align: "center"
  });
  tx.anchor.set(0.5); tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}
