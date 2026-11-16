// games/tika.js — Tika Ceremony. A blessing/scatter slot.
// 3x3 grid of diva photos. Each spin, 0-6 random cells get a red "tika" mark
// (forehead dot) with a particle burst. Each tika pays bet × 0.5. If 3+ tikas
// land on cells of the same diva, bonus = bet × 5 × (count − 2). If 6+ tikas
// total across the grid, full ceremony bonus = bet × 10. The grid uses 3 unique
// divas distributed 3/3/3 so the same-diva bonus is achievable.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto, castToPhotoURL, castPick } from "../core/photos.js";
import { CAST_LIST } from "../core/app.js";

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb || "Land the tika. Bless the diva.", {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // --- sizing ---
  // Reserve space: top(tagline+banner) = 70, diva panel = 100, bet = 50, button = 50, paddings = 24
  const topReserved = 70;
  const bottomReserved = 110;
  const panelH = 100;
  const gap = 10;
  const availForGrid = H - topReserved - panelH - bottomReserved - 16;
  const maxCellByW = Math.floor((W - 16 - 2 * gap) / 3);
  const maxCellByH = Math.floor((availForGrid - 2 * gap) / 3);
  const cellSize = Math.max(80, Math.min(130, Math.min(maxCellByW, maxCellByH)));
  const gridW = 3 * cellSize + 2 * gap;
  const gridH = 3 * cellSize + 2 * gap;
  const gridX = Math.floor((W - gridW) / 2);
  const gridY = topReserved + 4;

  // --- top payout banner ---
  const bannerH = 44;
  const banner = new PIXI.Graphics();
  banner.beginFill(0x1c0e2a).drawRoundedRect(8, 24, W - 16, bannerH, 10).endFill();
  banner.beginFill(0xf2c76e, 0.45).drawRoundedRect(8, 24, W - 16, 3, 1).endFill();
  c.addChild(banner);
  const tikaCountTx = new PIXI.Text("TIKAS: 0 / 9", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0xffe9b8
  });
  tikaCountTx.x = 18; tikaCountTx.y = 24 + (bannerH - tikaCountTx.height) / 2;
  c.addChild(tikaCountTx);
  const totalTx = new PIXI.Text("TOTAL: +0", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0xf2c76e, align: "right"
  });
  totalTx.anchor.set(1, 0);
  totalTx.x = W - 18; totalTx.y = 24 + (bannerH - totalTx.height) / 2;
  c.addChild(totalTx);

  // --- grid ---
  // 3 unique divas distributed 3/3/3 across 9 cells (shuffled placement)
  const gridDivaIds = shuffle([...DIVA_IDS]).slice(0, 3);
  const cellDivas = buildGridDistribution(gridDivaIds);  // array of 9 diva ids
  const cells = [];  // each: { container, divaId, hasTika, tikaGfx, photoHolder }

  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3), col = i % 3;
    const cx = gridX + col * (cellSize + gap);
    const cy = gridY + row * (cellSize + gap);
    const cell = new PIXI.Container();
    cell.x = cx; cell.y = cy;
    c.addChild(cell);

    // cell bg (dark recessed frame)
    const cellBg = new PIXI.Graphics();
    cellBg.lineStyle(2, 0x3a2548, 1);
    cellBg.beginFill(0x0a0410).drawRoundedRect(0, 0, cellSize, cellSize, 8).endFill();
    cell.addChild(cellBg);

    // photo holder (photo loads async)
    const photoHolder = new PIXI.Container();
    photoHolder.x = 4; photoHolder.y = 4;
    cell.addChild(photoHolder);

    // diva name label (bottom strip)
    const nameTx = new PIXI.Text(cap(DIVAS[cellDivas[i]].name), {
      fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "700", fill: 0xffe9b8, align: "center"
    });
    nameTx.anchor.set(0.5, 0); nameTx.x = cellSize / 2; nameTx.y = cellSize - 16;
    cell.addChild(nameBg(cellSize, nameTx.height));
    cell.addChild(nameTx);

    cells.push({
      container: cell, divaId: cellDivas[i], hasTika: false,
      tikaGfx: null, photoHolder, photoSize: cellSize - 8
    });
  }

  // load all 9 photos (fire-and-forget)
  for (const cell of cells) {
    loadCellPhoto(cell);
  }

  // --- diva bonus panel (below grid) ---
  const panelY = gridY + gridH + 10;
  const panel = new PIXI.Graphics();
  panel.beginFill(0x1c0e2a).drawRoundedRect(8, panelY, W - 16, panelH, 10).endFill();
  panel.beginFill(0x9d4edd, 0.4).drawRoundedRect(8, panelY, W - 16, 3, 1).endFill();
  c.addChild(panel);
  const panelTitle = new PIXI.Text("DIVA BONUSES (3+ tikas = 5× bet)", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "700", fill: 0xffe9b8
  });
  panelTitle.x = 16; panelTitle.y = panelY + 6;
  c.addChild(panelTitle);

  // one row per diva (3 rows)
  const divaRows = [];
  const rowH = 24;
  const rowStartY = panelY + 24;
  const rowMargin = 8;
  const rowW = W - 16 - 2 * rowMargin;
  for (let i = 0; i < gridDivaIds.length; i++) {
    const id = gridDivaIds[i];
    const ry = rowStartY + i * (rowH + 2);
    // mini photo
    const miniHolder = new PIXI.Container();
    miniHolder.x = 16; miniHolder.y = ry;
    c.addChild(miniHolder);
    drawMiniPhoto(miniHolder, id, rowH);
    // name
    const nameTx = new PIXI.Text(cap(DIVAS[id].name), {
      fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700", fill: 0xffe9b8
    });
    nameTx.x = 16 + rowH + 8; nameTx.y = ry + (rowH - nameTx.height) / 2;
    c.addChild(nameTx);
    // tika count for this diva
    const countTx = new PIXI.Text("0 / 3", {
      fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "700", fill: 0xff2e88, align: "right"
    });
    countTx.anchor.set(1, 0);
    countTx.x = W - 16 - rowMargin; countTx.y = ry + (rowH - countTx.height) / 2;
    c.addChild(countTx);
    // bonus indicator (right side)
    const bonusTx = new PIXI.Text("", {
      fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "900", fill: 0x57d38f, align: "right"
    });
    bonusTx.anchor.set(1, 0);
    bonusTx.x = W - 16 - rowMargin - 60; bonusTx.y = ry + (rowH - bonusTx.height) / 2;
    c.addChild(bonusTx);

    divaRows.push({ id, countTx, bonusTx });
  }

  // --- result text ---
  const resultText = new PIXI.Text("Tap SPIN to begin the ceremony.", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "700", fill: 0xb0b0b0,
    align: "center", wordWrap: true, wordWrapWidth: W - 16
  });
  resultText.anchor.set(0.5, 0); resultText.x = W / 2;
  resultText.y = panelY + panelH + 4;
  c.addChild(resultText);

  // --- bet row ---
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    if (spinning) return;
    curBet = [10, 25, 50, 100, 250][i];
    updateSpinBtn();
  }));

  // --- spin button ---
  let spinning = false;
  const spinBtn = makeButton(W - 16, 50, "SPIN · " + curBet, 0xf2c76e, 0x160b20);
  spinBtn.x = 8; spinBtn.y = H - 50;
  spinBtn.interactive = true; spinBtn.buttonMode = true;
  c.addChild(spinBtn);
  function updateSpinBtn() {
    spinBtn.children[1].text = "SPIN · " + curBet;
  }

  spinBtn.on("pointertap", async () => {
    if (spinning) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    spinning = true;
    spinBtn.interactive = false;
    resultText.text = "The ceremony begins...";
    resultText.style.fill = 0xffe9b8;

    // clear previous tikas
    clearAllTikas();
    for (const row of divaRows) {
      row.bonusTx.text = "";
      row.countTx.text = "0 / 3";
      row.countTx.style.fill = 0xff2e88;
    }
    totalTx.text = "TOTAL: +0";
    tikaCountTx.text = "TIKAS: 0 / 9";
    sfx.whoosh();
    await wait(180);

    // roll tika count (0-6 uniform) and pick cells
    const tikaCount = Math.floor(Math.random() * 7);
    const cellIndices = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, tikaCount);

    // animate tika drop on each cell, staggered
    for (let k = 0; k < cellIndices.length; k++) {
      const idx = cellIndices[k];
      dropTika(cells[idx]);
      sfx.pop();
      // update tika counter live
      tikaCountTx.text = `TIKAS: ${k + 1} / 9`;
      await wait(130);
    }

    await wait(250);

    // --- calculate payout ---
    // count tikas per diva
    const countsByDiva = {};
    for (const id of gridDivaIds) countsByDiva[id] = 0;
    for (const idx of cellIndices) {
      countsByDiva[cells[idx].divaId]++;
    }

    const tikaWins = Math.floor(tikaCount * curBet * 0.5);
    let divaBonusTotal = 0;
    const divaBonuses = [];  // { id, count, amount }
    for (const id of gridDivaIds) {
      const cnt = countsByDiva[id];
      if (cnt >= 3) {
        const amount = Math.floor(curBet * 5 * (cnt - 2));
        divaBonusTotal += amount;
        divaBonuses.push({ id, count: cnt, amount });
      }
    }
    const ceremonyBonus = tikaCount >= 6 ? Math.floor(curBet * 10) : 0;
    const totalPayout = tikaWins + divaBonusTotal + ceremonyBonus;

    // update diva rows
    for (const row of divaRows) {
      const cnt = countsByDiva[row.id];
      row.countTx.text = `${cnt} / 3`;
      if (cnt >= 3) {
        const amount = Math.floor(curBet * 5 * (cnt - 2));
        row.bonusTx.text = `BONUS +${amount}`;
        row.bonusTx.style.fill = 0x57d38f;
        row.countTx.style.fill = 0x57d38f;
      } else {
        row.bonusTx.text = cnt >= 2 ? `${3 - cnt} more...` : "";
        row.bonusTx.style.fill = 0xb0b0b0;
        row.countTx.style.fill = 0xff2e88;
      }
    }

    // update banner
    tikaCountTx.text = `TIKAS: ${tikaCount} / 9`;
    totalTx.text = `TOTAL: +${totalPayout}`;

    // payout detail in result text
    const parts = [];
    if (tikaWins > 0) parts.push(`Tika wins +${tikaWins}`);
    if (divaBonusTotal > 0) {
      const names = divaBonuses.map(b => cap(DIVAS[b.id].name)).join(", ");
      parts.push(`Diva bonus (${names}) +${divaBonusTotal}`);
    }
    if (ceremonyBonus > 0) parts.push(`Ceremony bonus +${ceremonyBonus}`);
    resultText.text = parts.length ? parts.join("  •  ") : `No tikas this spin. −${curBet}.`;

    // settle
    const net = totalPayout - curBet;
    if (totalPayout > 0) store.pay(totalPayout);
    store.record(game.id, curBet, totalPayout);

    if (net > 0) {
      let tier = "win";
      if (ceremonyBonus > 0 || divaBonusTotal >= curBet * 5) tier = "big";
      if (ceremonyBonus > 0 && divaBonusTotal > 0) tier = "mega";
      if (net >= curBet * 15) tier = "jackpot";
      try { sfx[tier](); } catch (e) { sfx.win(); }
      resultText.style.fill = 0x57d38f;
      host.onWin(tier, net, {
        title: ceremonyBonus > 0 ? "Full Ceremony!" : divaBonusTotal > 0 ? "Diva Blessed" : "Tika Wins",
        line: resultText.text
      });
    } else if (net === 0) {
      resultText.style.fill = 0xf2c76e;
      sfx.bonk();
    } else {
      resultText.style.fill = 0xff5d5d;
      sfx.lose();
    }

    spinning = false;
    spinBtn.interactive = true;
    updateSpinBtn();
  });

  // --- tika mark helpers ---
  function dropTika(cell) {
    if (cell.tikaGfx) {
      cell.container.removeChild(cell.tikaGfx);
      cell.tikaGfx.destroy();
    }
    cell.hasTika = true;
    const cx = cellSize / 2;
    const cy = Math.max(18, cellSize * 0.20);
    const tika = new PIXI.Graphics();
    // outer red dot
    tika.beginFill(0xcc1f3a).drawCircle(cx, cy, Math.max(8, cellSize * 0.11)).endFill();
    // inner darker red
    tika.beginFill(0x8b0a1f).drawCircle(cx, cy, Math.max(5, cellSize * 0.075)).endFill();
    // tiny white highlight
    tika.beginFill(0xffe9e0, 0.85).drawCircle(cx - 3, cy - 3, Math.max(1.5, cellSize * 0.02)).endFill();
    cell.container.addChild(tika);
    cell.tikaGfx = tika;
    // pop-in animation
    animatePop(tika);
    // particle burst
    spawnParticleBurst(cell.container, cx, cy, 0xff3344);
  }

  function clearAllTikas() {
    for (const cell of cells) {
      if (cell.tikaGfx) {
        cell.container.removeChild(cell.tikaGfx);
        cell.tikaGfx.destroy();
        cell.tikaGfx = null;
      }
      cell.hasTika = false;
    }
  }

  function animatePop(gfx) {
    gfx.scale.set(0);
    const start = performance.now();
    const fn = () => {
      const t = Math.min(1, (performance.now() - start) / 240);
      // easeOutBack: overshoots slightly past 1 then settles
      const c1 = 1.70158, c3 = c1 + 1;
      const s = t === 0 ? 0 : 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      gfx.scale.set(Math.max(0, s));
      if (t >= 1) {
        gfx.scale.set(1);
        pixiApp.ticker.remove(fn);
      }
    };
    pixiApp.ticker.add(fn);
  }

  function spawnParticleBurst(parent, x, y, color) {
    const N = 8;
    for (let i = 0; i < N; i++) {
      const p = new PIXI.Graphics();
      p.beginFill(color).drawCircle(0, 0, 2.5).endFill();
      p.x = x; p.y = y;
      parent.addChild(p);
      const angle = (Math.PI * 2 * i) / N + Math.random() * 0.4;
      const dist = 18 + Math.random() * 14;
      const tx = x + Math.cos(angle) * dist;
      const ty = y + Math.sin(angle) * dist;
      const start = performance.now();
      const fn = () => {
        const t = Math.min(1, (performance.now() - start) / 280);
        p.x = x + (tx - x) * t;
        p.y = y + (ty - y) * t;
        p.alpha = 1 - t;
        if (t >= 1) {
          pixiApp.ticker.remove(fn);
          parent.removeChild(p);
          p.destroy();
        }
      };
      pixiApp.ticker.add(fn);
    }
  }

  async function loadCellPhoto(cell) {
    try {
      const url = friendPhoto(cell.divaId, Math.floor(Math.random() * 6));
      const tex = await PIXI.Assets.load(url);
      const sp = new PIXI.Sprite(tex);
      const sz = cell.photoSize;
      const scale = sz / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.x = (sz - tex.width * scale) / 2;
      sp.y = (sz - tex.height * scale) / 2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(0, 0, sz, sz, 6).endFill();
      cell.photoHolder.addChild(mask);
      sp.mask = mask;
      cell.photoHolder.addChild(sp);
    } catch (e) {}
  }

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

// --- module helpers ---

function buildGridDistribution(divaIds) {
  // each diva appears exactly 3 times across the 9 cells, shuffled
  const arr = [];
  for (const id of divaIds) for (let i = 0; i < 3; i++) arr.push(id);
  return shuffle(arr);
}

function nameBg(cellW, nameH) {
  const g = new PIXI.Graphics();
  g.beginFill(0x160b20, 0.7).drawRoundedRect(0, cellW - nameH - 4, cellW, nameH + 4, 4).endFill();
  return g;
}

async function drawMiniPhoto(holder, divaId, sz) {
  const bg = new PIXI.Graphics();
  bg.beginFill(0x2a1a3a).drawRoundedRect(0, 0, sz, sz, 4).endFill();
  holder.addChild(bg);
  try {
    const url = friendPhoto(divaId, Math.floor(Math.random() * 6));
    const tex = await PIXI.Assets.load(url);
    const sp = new PIXI.Sprite(tex);
    const scale = sz / Math.max(tex.width, tex.height);
    sp.scale.set(scale);
    sp.x = (sz - tex.width * scale) / 2;
    sp.y = (sz - tex.height * scale) / 2;
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff).drawRoundedRect(0, 0, sz, sz, 4).endFill();
    holder.addChild(mask);
    sp.mask = mask;
    holder.addChild(sp);
  } catch (e) {}
}

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
