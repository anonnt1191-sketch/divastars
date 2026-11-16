// games/cash-me.js — REDESIGNED Phase 3: idle cash machine.
// A money printer that auto-spits cash. Multiplier ticks up over time.
// Tap CRANK to boost multiplier (+0.1x per crank, 5% jam chance per crank).
// Cash out anytime. Machine can jam on its own at a random point ( Aviator-style crash).
// The longer you wait, the higher the multiplier but higher jam risk.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { castToPhotoURL } from "../core/photos.js";
import { DIVAS } from "../data/divas.js";

const STATE = { IDLE:"idle", PRINTING:"printing", JAMMED:"jammed", CASHED:"cashed" };

export async function mount(host) {
  const { pixiApp, stage, width: W, height: stageH, game } = host;
  const H = stageH;
  const c = new PIXI.Container();
  stage.addChild(c);

  // PHASE 3: cash machine visual — full-bleed diva operator photo on left, machine on right
  // Background: rich gold/green casino colors
  const bg = new PIXI.Graphics();
  bg.beginFill(0x0a1a0a, 0.75).drawRect(0, 0, W, H).endFill();
  // emerald gradient
  for (let i = 0; i < H; i += 4) {
    const t = i / H;
    const r = Math.round(0x0a + (0x1a - 0x0a) * t);
    const g = Math.round(0x1a + (0x3a - 0x1a) * t);
    const b = Math.round(0x0a + (0x1a - 0x0a) * t);
    bg.beginFill((r<<16)|(g<<8)|b).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  // diva operator photo (left side, large)
  const operatorCast = SESSION.crashPilots[Math.floor(Math.random()*SESSION.crashPilots.length)];
  const operatorUrl = castToPhotoURL(operatorCast);
  const opPhotoW = Math.min(W * 0.45, 200);
  const opPhotoH = H - 100;
  const opPhotoX = 8;
  const opPhotoY = 40;
  PIXI.Assets.load(operatorUrl).then(tex => {
    if (!tex) return;
    // contain-fit backdrop
    const backdrop = new PIXI.Sprite(tex);
    const bgScale = Math.max(opPhotoW/tex.width, opPhotoH/tex.height);
    backdrop.scale.set(bgScale);
    backdrop.x = opPhotoX + (opPhotoW - tex.width*bgScale)/2;
    backdrop.y = opPhotoY + (opPhotoH - tex.height*bgScale)/2;
    backdrop.alpha = 0.25;
    const bgMask = new PIXI.Graphics();
    bgMask.beginFill(0xffffff).drawRoundedRect(opPhotoX, opPhotoY, opPhotoW, opPhotoH, 12).endFill();
    c.addChild(bgMask);
    backdrop.mask = bgMask;
    c.addChild(backdrop);
    // foreground contain
    const sp = new PIXI.Sprite(tex);
    const scale = Math.min(opPhotoW/tex.width, opPhotoH/tex.height);
    sp.scale.set(scale);
    sp.x = opPhotoX + (opPhotoW - tex.width*scale)/2;
    sp.y = opPhotoY + (opPhotoH - tex.height*scale)/2;
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff).drawRoundedRect(opPhotoX, opPhotoY, opPhotoW, opPhotoH, 12).endFill();
    c.addChild(mask);
    sp.mask = mask;
    c.addChild(sp);
    // gold border
    const border = new PIXI.Graphics();
    border.lineStyle(3, 0xf2c76e, 1).drawRoundedRect(opPhotoX, opPhotoY, opPhotoW, opPhotoH, 12).endFill();
    c.addChild(border);
  }).catch(()=>{});

  // operator name
  const opName = new PIXI.Text(operatorCast?.name || "The Cashier", {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: 16, fontStyle: "italic", fontWeight: "700", fill: 0xffe9b8, align: "center"
  });
  opName.anchor.set(0.5, 0); opName.x = opPhotoX + opPhotoW/2; opName.y = opPhotoY + opPhotoH + 4;
  c.addChild(opName);

  // Cash machine visual (right side)
  const machineX = opPhotoX + opPhotoW + 12;
  const machineW = W - machineX - 8;
  const machineY = 40;
  const machineH = H - 100;
  const machine = new PIXI.Graphics();
  // machine body
  machine.lineStyle(3, 0xf2c76e, 1);
  machine.beginFill(0x1a3a1a).drawRoundedRect(machineX, machineY, machineW, machineH, 16).endFill();
  // display window
  machine.beginFill(0x000000).drawRoundedRect(machineX + 8, machineY + 8, machineW - 16, machineH * 0.35, 8).endFill();
  // gold trim
  machine.lineStyle(2, 0xf2c76e, 0.6).drawRoundedRect(machineX + 8, machineY + 8, machineW - 16, machineH * 0.35, 8).endFill();
  // printer slot
  machine.beginFill(0x000000).drawRoundedRect(machineX + 16, machineY + machineH * 0.55, machineW - 32, 12, 4).endFill();
  c.addChild(machine);

  // multiplier display (big, in the machine window)
  const multText = new PIXI.Text("1.00x", {
    fontFamily: "Outfit, sans-serif", fontSize: 48, fontWeight: "900", fill: 0x57d38f,
    stroke: 0x000000, strokeThickness: 3, align: "center"
  });
  multText.anchor.set(0.5); multText.x = machineX + machineW/2; multText.y = machineY + machineH * 0.18;
  c.addChild(multText);

  // status text
  const statusText = new PIXI.Text(t("crash.placeBet"), {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontStyle: "italic", fill: 0xffe9b8, align: "center"
  });
  statusText.anchor.set(0.5); statusText.x = machineX + machineW/2; statusText.y = machineY + machineH * 0.36;
  c.addChild(statusText);

  // crank button (big, gold)
  const crankBtnW = machineW - 24;
  const crankBtnH = 60;
  const crankBtn = new PIXI.Container();
  crankBtn.x = machineX + 12;
  crankBtn.y = machineY + machineH * 0.65;
  const crankBg = new PIXI.Graphics();
  crankBg.beginFill(0xf2c76e).drawRoundedRect(0, 0, crankBtnW, crankBtnH, 12).endFill();
  crankBtn.addChild(crankBg);
  const crankTx = new PIXI.Text("CRANK (+0.1x)", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0x160b20, align: "center"
  });
  crankTx.anchor.set(0.5); crankTx.x = crankBtnW/2; crankTx.y = crankBtnH/2;
  crankBtn.addChild(crankTx);
  crankBtn.interactive = true;
  crankBtn.buttonMode = true;
  crankBtn.visible = false;
  c.addChild(crankBtn);

  // cash out button (below crank)
  const cashBtnW = machineW - 24;
  const cashBtnH = 50;
  const cashBtn = new PIXI.Container();
  cashBtn.x = machineX + 12;
  cashBtn.y = crankBtn.y + crankBtnH + 8;
  const cashBg = new PIXI.Graphics();
  cashBg.beginFill(0x57d38f).drawRoundedRect(0, 0, cashBtnW, cashBtnH, 10).endFill();
  cashBtn.addChild(cashBg);
  const cashTx = new PIXI.Text("CASH OUT", {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "900", fill: 0x160b20, align: "center"
  });
  cashTx.anchor.set(0.5); cashTx.x = cashBtnW/2; cashTx.y = cashBtnH/2;
  cashBtn.addChild(cashTx);
  cashBtn.interactive = true;
  cashBtn.buttonMode = true;
  cashBtn.visible = false;
  c.addChild(cashBtn);

  // start button (replaces crank/cash when idle)
  const startBtn = new PIXI.Container();
  startBtn.x = machineX + 12;
  startBtn.y = machineY + machineH * 0.65;
  const startBg = new PIXI.Graphics();
  startBg.beginFill(0xf2c76e).drawRoundedRect(0, 0, crankBtnW, crankBtnH + cashBtnH + 8, 12).endFill();
  startBtn.addChild(startBg);
  const startTx = new PIXI.Text("START PRINTER\n· " + 25 + " chips ·", {
    fontFamily: "Outfit, sans-serif", fontSize: 20, fontWeight: "900", fill: 0x160b20, align: "center"
  });
  startTx.anchor.set(0.5); startTx.x = crankBtnW/2; startTx.y = (crankBtnH + cashBtnH + 8)/2;
  startBtn.addChild(startTx);
  startBtn.interactive = true;
  startBtn.buttonMode = true;
  c.addChild(startBtn);

  // flying cash particles container
  const cashLayer = new PIXI.Container();
  c.addChild(cashLayer);
  const flyingCash = [];

  // state
  let state = STATE.IDLE;
  let curBet = 25;
  let multiplier = 1.0;
  let jamPoint = 0;
  let printStart = 0;
  let nextCashAt = 0;
  let history = [];

  // history strip
  const historyY = 8;
  const historyContainer = new PIXI.Container();
  historyContainer.x = opPhotoX; historyContainer.y = historyY;
  c.addChild(historyContainer);
  function renderHistory() {
    historyContainer.removeChildren();
    history.slice(-8).forEach((m, i) => {
      const col = m < 2 ? 0xff5d5d : m < 5 ? 0xf2c76e : 0x57d38f;
      const p = new PIXI.Graphics();
      p.beginFill(col, 0.8).drawRoundedRect(i * 36, 0, 32, 18, 6).endFill();
      historyContainer.addChild(p);
      const tx = new PIXI.Text(m.toFixed(1)+"x", {fontFamily:"Outfit",fontSize:10,fontWeight:"700",fill:0x160b20});
      tx.anchor.set(0.5); tx.x = i*36+16; tx.y = 9;
      historyContainer.addChild(tx);
    });
  }

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 50;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    curBet = [10, 25, 50, 100, 250][i];
    if (state === STATE.IDLE) startTx.text = "START PRINTER\n· " + curBet + " chips ·";
  }));

  function updateButtons() {
    if (state === STATE.IDLE) {
      startBtn.visible = true;
      crankBtn.visible = false;
      cashBtn.visible = false;
      startTx.text = "START PRINTER\n· " + curBet + " chips ·";
    } else if (state === STATE.PRINTING) {
      startBtn.visible = false;
      crankBtn.visible = true;
      cashBtn.visible = true;
      cashTx.text = "CASH OUT · +" + Math.floor(curBet * multiplier);
    } else if (state === STATE.JAMMED || state === STATE.CASHED) {
      startBtn.visible = true;
      crankBtn.visible = false;
      cashBtn.visible = false;
      startTx.text = state === STATE.JAMMED ? "JAMMED · TRY AGAIN" : "PLAY AGAIN";
    }
  }
  updateButtons();

  function startRound() {
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    state = STATE.PRINTING;
    multiplier = 1.0;
    printStart = performance.now();
    nextCashAt = printStart + 200;
    // jam point: Aviator-style distribution, biased toward low
    const r = Math.random();
    jamPoint = r < 0.01 ? 1.0 : Math.max(1.05, 1/(1-r) * 0.85 + 1.2);
    jamPoint = Math.min(jamPoint, 50);
    statusText.text = "PRINTER RUNNING";
    sfx.fly();
    updateButtons();
  }

  function crank() {
    if (state !== STATE.PRINTING) return;
    sfx.click();
    multiplier += 0.1;
    // 5% jam chance per crank
    if (Math.random() < 0.05) {
      jam();
      return;
    }
    // spawn cash particle
    spawnCashParticle();
  }

  function cashOut() {
    if (state !== STATE.PRINTING) return;
    state = STATE.CASHED;
    const win = Math.floor(curBet * multiplier);
    store.pay(win);
    store.record(game.id, curBet, win);
    sfx.win();
    history.push(multiplier);
    if (history.length > 30) history.shift();
    renderHistory();
    statusText.text = "CASHED: " + multiplier.toFixed(2) + "x · +" + win;
    host.onWin(multiplier >= 10 ? "mega" : multiplier >= 5 ? "big" : "win", win, {
      title: multiplier.toFixed(2) + "x cashed out",
      line: operatorCast?.name + " printed you rich."
    });
    updateButtons();
  }

  function jam() {
    state = STATE.JAMMED;
    sfx.crash();
    history.push(multiplier);
    if (history.length > 30) history.shift();
    renderHistory();
    store.record(game.id, curBet, 0);
    statusText.text = "JAMMED @ " + multiplier.toFixed(2) + "x · -" + curBet;
    host.toast("Machine jammed! Lost " + curBet + " chips.", 2500);
    updateButtons();
  }

  function spawnCashParticle() {
    const bill = new PIXI.Graphics();
    bill.beginFill(0x57d38f).drawRoundedRect(0, 0, 24, 14, 2).endFill();
    bill.beginFill(0xffe9b8).drawCircle(12, 7, 3).endFill();
    bill.x = machineX + machineW/2 + (Math.random()-0.5)*40;
    bill.y = machineY + machineH * 0.55 + 6;
    bill.vx = (Math.random()-0.5) * 3;
    bill.vy = -3 - Math.random() * 4;
    bill.rot = (Math.random()-0.5) * 0.2;
    bill.vrot = (Math.random()-0.5) * 0.1;
    bill.life = 60;
    cashLayer.addChild(bill);
    flyingCash.push(bill);
  }

  startBtn.on("pointertap", () => { sfx.click(); if (state === STATE.IDLE || state === STATE.JAMMED || state === STATE.CASHED) startRound(); });
  crankBtn.on("pointertap", crank);
  cashBtn.on("pointertap", cashOut);

  const tickerFn = (dt) => {
    const now = performance.now();
    if (state === STATE.PRINTING) {
      // auto-print: multiplier grows slowly over time
      const elapsed = (now - printStart) / 1000;
      multiplier = Math.max(multiplier, 1.0 + elapsed * 0.15);  // +0.15x per second baseline
      // auto-spawn cash particles
      if (now > nextCashAt) {
        spawnCashParticle();
        nextCashAt = now + 200 + Math.random() * 300;
      }
      // auto-jam check
      if (multiplier >= jamPoint) {
        jam();
      }
      // update display
      multText.text = multiplier.toFixed(2) + "x";
      // color shift: green → gold → pink as it grows
      const heatT = Math.min(1, (multiplier - 1) / 10);
      const r = Math.round(0x57 + (0xff - 0x57) * heatT);
      const g = Math.round(0xd3 + (0x2e - 0xd3) * heatT);
      const b = Math.round(0x8f + (0x88 - 0x8f) * heatT);
      multText.style.fill = (r << 16) | (g << 8) | b;
      cashTx.text = "CASH OUT · +" + Math.floor(curBet * multiplier);
    }
    // animate flying cash
    for (let i = flyingCash.length - 1; i >= 0; i--) {
      const b = flyingCash[i];
      b.vy += 0.15;
      b.x += b.vx;
      b.y += b.vy;
      b.rotation += b.vrot;
      b.life -= dt;
      b.alpha = Math.max(0, b.life / 60);
      if (b.life <= 0 || b.y > H) {
        cashLayer.removeChild(b);
        b.destroy();
        flyingCash.splice(i, 1);
      }
    }
  };
  pixiApp.ticker.add(tickerFn);

  return function cleanup() {
    pixiApp.ticker.remove(tickerFn);
  };
}
