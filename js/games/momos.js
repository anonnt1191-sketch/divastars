// games/momos.js — Momo Cartel. 60-second restaurant sim. Diva customers walk in,
// order N momos (1-5), tap ticket to serve. Pay = bet * size / 5. Failed orders
// (10s timeout) cost bet * 0.2. Vedhika orders 10 momos = x5 bonus (10x bet payout).

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

const ROUND_SECONDS = 60;
const ORDER_TIMEOUT_MS = 10000;
const SPAWN_MIN_MS = 1100;
const SPAWN_MAX_MS = 2200;
const MAX_CONCURRENT_ORDERS = 4;
const TICKET_W = 92;
const TICKET_H = 120;
const TICKET_GAP = 6;
const VEDHIKA_CHANCE = 0.08;

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  // background — warm restaurant interior, dark wood
  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  for (let i = 0; i < H; i += 4) {
    const tt = i / H;
    bg.beginFill(0x6b3410, 0.15 + tt * 0.25).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  const tagline = new PIXI.Text(
    game.tagline || game.blurb || "Momo Cartel. Tap orders. Don't let Vedhika wait.",
    { fontFamily: "Outfit, sans-serif", fontSize: 14, fontStyle: "italic", fill: 0xffd700 });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // ===== HUD: tips, missed, time =====
  const hudY = 30;
  const hudBg = new PIXI.Graphics();
  hudBg.beginFill(0x1c0e2a, 0.85).drawRoundedRect(8, hudY, W - 16, 36, 8).endFill();
  c.addChild(hudBg);

  const tipsLabel = new PIXI.Text("TIPS", {
    fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "700", fill: 0xb0b0b0 });
  tipsLabel.x = 18; tipsLabel.y = hudY + 4; c.addChild(tipsLabel);
  const tipsText = new PIXI.Text("0", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0xf2c76e,
    stroke: 0x160b20, strokeThickness: 2 });
  tipsText.x = 18; tipsText.y = hudY + 16; c.addChild(tipsText);

  const missedLabel = new PIXI.Text("MISSED", {
    fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "700", fill: 0xb0b0b0 });
  missedLabel.anchor.set(0.5, 0); missedLabel.x = W / 2; missedLabel.y = hudY + 4;
  c.addChild(missedLabel);
  const missedText = new PIXI.Text("0", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0xff5d5d,
    stroke: 0x160b20, strokeThickness: 2 });
  missedText.anchor.set(0.5, 0); missedText.x = W / 2; missedText.y = hudY + 16;
  c.addChild(missedText);

  const timeLabel = new PIXI.Text("TIME", {
    fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "700", fill: 0xb0b0b0 });
  timeLabel.anchor.set(1, 0); timeLabel.x = W - 18; timeLabel.y = hudY + 4;
  c.addChild(timeLabel);
  const timeText = new PIXI.Text(String(ROUND_SECONDS), {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0xffe9b8,
    stroke: 0x160b20, strokeThickness: 2 });
  timeText.anchor.set(1, 0); timeText.x = W - 18; timeText.y = hudY + 16;
  c.addChild(timeText);

  // ===== scene: counter + steamer + steam + tickets =====
  const sceneY = hudY + 44;
  const sceneH = H - sceneY - 110;

  // wooden counter at bottom
  const counter = new PIXI.Graphics();
  counter.beginFill(0x3a2410).drawRoundedRect(8, sceneY + sceneH - 24, W - 16, 24, 6).endFill();
  counter.lineStyle(2, 0x211208, 0.7).drawRoundedRect(8, sceneY + sceneH - 24, W - 16, 24, 6).endFill();
  c.addChild(counter);

  // bamboo steamer in center
  const steamerX = W / 2;
  const steamerY = sceneY + sceneH - 80;
  const steamer = new PIXI.Container();
  steamer.x = steamerX; steamer.y = steamerY;
  c.addChild(steamer);
  drawSteamer(steamer);

  const steamLayer = new PIXI.Container();
  steamLayer.x = steamerX; steamLayer.y = steamerY;
  c.addChild(steamLayer);

  // order tickets layer
  const ticketsLayer = new PIXI.Container();
  ticketsLayer.x = 0; ticketsLayer.y = sceneY + 8;
  c.addChild(ticketsLayer);

  // ===== state =====
  let curBet = 25;
  let active = false;
  let timeLeft = ROUND_SECONDS;
  let scorePool = 0;
  let missedCount = 0;
  let spawnTimeoutId = null;
  let countdownInterval = null;
  let steamInterval = null;
  let initialSpawnTimeout = null;
  const ordersActive = [];

  function pickCustomer() {
    if (Math.random() < VEDHIKA_CHANCE) {
      return { id: "vedhika", size: 10, isVedhika: true };
    }
    const id = DIVA_IDS[Math.floor(Math.random() * DIVA_IDS.length)];
    const size = 1 + Math.floor(Math.random() * 5); // 1..5
    return { id, size, isVedhika: false };
  }

  function reflowTickets() {
    const n = ordersActive.length;
    if (n === 0) return;
    const totalW = n * TICKET_W + (n - 1) * TICKET_GAP;
    const startX = Math.max(8, (W - totalW) / 2);
    for (let i = 0; i < n; i++) {
      ordersActive[i].targetX = startX + i * (TICKET_W + TICKET_GAP);
    }
  }

  function spawnOrder() {
    if (!active) return;
    if (ordersActive.length >= MAX_CONCURRENT_ORDERS) return;
    const cust = pickCustomer();
    const ticket = new PIXI.Container();
    ticket.x = -TICKET_W; // slide in from left
    ticket.y = 0;
    ticketsLayer.addChild(ticket);

    const accent = cust.isVedhika ? 0xd946ef : 0xf2c76e;

    const body = new PIXI.Graphics();
    body.beginFill(0x1c0e2a, 0.95).drawRoundedRect(0, 0, TICKET_W, TICKET_H, 10).endFill();
    body.lineStyle(2, accent, 0.85).drawRoundedRect(0, 0, TICKET_W, TICKET_H, 10).endFill();
    ticket.addChild(body);

    const photoHolder = new PIXI.Container();
    photoHolder.x = 6; photoHolder.y = 6;
    ticket.addChild(photoHolder);
    const photoMask = new PIXI.Graphics();
    photoMask.beginFill(0xffffff).drawRoundedRect(0, 0, TICKET_W - 12, 60, 8).endFill();
    photoHolder.addChild(photoMask);

    PIXI.Assets.load(friendPhoto(cust.id, Math.floor(Math.random() * 6))).then(tex => {
      if (ticket.destroyed) return;
      const sp = new PIXI.Sprite(tex);
      const aw = TICKET_W - 12, ah = 60;
      const sc = Math.min(aw/tex.width, ah/tex.height);
      sp.scale.set(sc);
      sp.x = (aw - tex.width * sc) / 2;
      sp.y = (ah - tex.height * sc) / 2;
      sp.mask = photoMask;
      photoHolder.addChild(sp);
    }).catch(() => {});

    const diva = DIVAS[cust.id];
    const nameTx = new PIXI.Text(diva?.name || cust.id, {
      fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "800", fill: 0xffe9b8 });
    nameTx.x = 6; nameTx.y = 70; ticket.addChild(nameTx);

    const orderLabel = new PIXI.Text(cust.isVedhika ? "VIRAL ORDER" : "ORDER", {
      fontFamily: "Outfit, sans-serif", fontSize: 9, fontWeight: "700", fill: accent });
    orderLabel.x = 6; orderLabel.y = 84; ticket.addChild(orderLabel);

    const sizeTx = new PIXI.Text(cust.size + " momos", {
      fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "900", fill: accent });
    sizeTx.x = 6; sizeTx.y = 94; ticket.addChild(sizeTx);

    // timeout bar
    const barBg = new PIXI.Graphics();
    barBg.beginFill(0x333333).drawRoundedRect(6, TICKET_H - 8, TICKET_W - 12, 4, 2).endFill();
    ticket.addChild(barBg);
    const barFill = new PIXI.Graphics();
    ticket.addChild(barFill);

    const tapHint = new PIXI.Text("TAP TO SERVE", {
      fontFamily: "Outfit, sans-serif", fontSize: 9, fontWeight: "800", fill: 0x57d38f, align: "center" });
    tapHint.anchor.set(0.5, 0);
    tapHint.x = TICKET_W / 2; tapHint.y = TICKET_H - 22; tapHint.alpha = 0.85;
    ticket.addChild(tapHint);

    ticket.interactive = true; ticket.buttonMode = true;
    const order = {
      container: ticket,
      divaId: cust.id,
      size: cust.size,
      isVedhika: cust.isVedhika,
      born: performance.now(),
      deadline: performance.now() + ORDER_TIMEOUT_MS,
      targetX: 0,
      barFill
    };
    ticket.on("pointertap", () => fulfillOrder(order));
    ordersActive.push(order);
    reflowTickets();
    sfx.tick();
  }

  function fulfillOrder(order) {
    if (!order || !order.container || order.container.destroyed) return;
    let win;
    if (order.isVedhika) {
      // (10 momos / 5) * x5 bonus = 10x bet
      win = curBet * 10;
      sfx.big();
      host.toast("VEDHIKA SERVED! +10x", 1400);
    } else {
      win = Math.floor(curBet * order.size / 5);
      sfx.chip();
    }
    scorePool += win;
    tipsText.text = String(scorePool);
    animateOut(order.container, true);
    removeOrder(order);
  }

  function failOrder(order) {
    if (!order || !order.container || order.container.destroyed) return;
    const cost = Math.floor(curBet * 0.2);
    scorePool = Math.max(0, scorePool - cost);
    missedCount++;
    missedText.text = String(missedCount);
    tipsText.text = String(scorePool);
    sfx.bonk();
    if (order.isVedhika) host.toast("Vedhika walked. Bad look.", 1600);
    animateOut(order.container, false);
    removeOrder(order);
  }

  function removeOrder(order) {
    const idx = ordersActive.indexOf(order);
    if (idx >= 0) ordersActive.splice(idx, 1);
    reflowTickets();
  }

  function animateOut(container, success) {
    container.interactive = false;
    let t = 0;
    const dir = success ? -1 : 1;
    const fn = (dt) => {
      t += dt * 16.67;
      container.y += dir * 4 * dt;
      container.alpha = Math.max(0, 1 - t / 350);
      container.scale.set(Math.max(0.2, 1 - t / 600));
      if (t > 400) {
        pixiApp.ticker.remove(fn);
        if (container.parent) container.parent.removeChild(container);
        try { container.destroy({ children: true }); } catch (e) {}
      }
    };
    pixiApp.ticker.add(fn);
  }

  function drawSteamer(container) {
    const w = 110;
    const tierH = 22;
    for (let i = 0; i < 2; i++) {
      const tier = new PIXI.Graphics();
      tier.beginFill(0xa3672b, 0.95).drawRoundedRect(-w / 2, i * tierH, w, tierH, 6).endFill();
      tier.lineStyle(2, 0x6b3410, 0.7).drawRoundedRect(-w / 2, i * tierH, w, tierH, 6).endFill();
      tier.lineStyle(1, 0x6b3410, 0.5);
      for (let k = -w / 2 + 12; k < w / 2; k += 14) {
        tier.moveTo(k, i * tierH + 4).lineTo(k, i * tierH + tierH - 4);
      }
      container.addChild(tier);
    }
    const lid = new PIXI.Graphics();
    lid.beginFill(0xa3672b, 1).drawRoundedRect(-w / 2, -8, w, 8, 4).endFill();
    lid.lineStyle(2, 0x6b3410, 0.7).drawRoundedRect(-w / 2, -8, w, 8, 4).endFill();
    lid.lineStyle(3, 0x6b3410, 0.9)
       .moveTo(0, -8).lineTo(0, -16)
       .moveTo(-7, -16).lineTo(7, -16);
    container.addChild(lid);
  }

  function spawnSteam() {
    if (!active) return;
    const puff = new PIXI.Graphics();
    puff.beginFill(0xffffff, 0.28).drawCircle(0, 0, 6 + Math.random() * 4).endFill();
    puff.x = (Math.random() - 0.5) * 60;
    puff.y = -20;
    steamLayer.addChild(puff);
    const drift = (Math.random() - 0.5) * 0.4;
    let t = 0;
    const fn = (dt) => {
      t += dt * 16.67;
      puff.y -= 0.5 * dt;
      puff.x += drift * dt;
      puff.alpha = Math.max(0, 0.5 - t / 1400);
      puff.scale.set(1 + t / 600);
      if (t > 1500) {
        pixiApp.ticker.remove(fn);
        if (puff.parent) puff.parent.removeChild(puff);
        puff.destroy();
      }
    };
    pixiApp.ticker.add(fn);
  }

  // ===== round flow =====
  function startRound() {
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    active = true;
    timeLeft = ROUND_SECONDS;
    scorePool = 0;
    missedCount = 0;
    tipsText.text = "0"; missedText.text = "0"; timeText.text = String(ROUND_SECONDS);
    startBtn.children[1].text = "SERVING...";
    startBtn.interactive = false;
    sfx.whoosh();

    countdownInterval = setInterval(() => {
      if (!active) { clearInterval(countdownInterval); return; }
      timeLeft -= 0.1;
      timeText.text = Math.max(0, timeLeft).toFixed(1);
      if (timeLeft <= 0) endRound();
    }, 100);

    const scheduleNext = () => {
      if (!active) return;
      const wait = SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS);
      spawnTimeoutId = setTimeout(() => {
        spawnOrder();
        scheduleNext();
      }, wait);
    };
    scheduleNext();

    steamInterval = setInterval(() => { if (active) spawnSteam(); }, 280);
    initialSpawnTimeout = setTimeout(() => { if (active) spawnOrder(); }, 400);
  }

  function endRound() {
    if (!active) return;
    active = false;
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    if (spawnTimeoutId) { clearTimeout(spawnTimeoutId); spawnTimeoutId = null; }
    if (steamInterval) { clearInterval(steamInterval); steamInterval = null; }
    if (initialSpawnTimeout) { clearTimeout(initialSpawnTimeout); initialSpawnTimeout = null; }

    // fail any remaining orders
    for (const o of [...ordersActive]) failOrder(o);

    const win = scorePool;
    if (win > 0) store.pay(win);
    store.record(game.id, curBet, win);
    const tier = win >= curBet * 30 ? "jackpot" :
                 win >= curBet * 12 ? "mega" :
                 win >= curBet * 5 ? "big" : "win";
    if (win > 0) {
      sfx[tier]();
      host.onWin(tier, win, {
        title: (missedCount === 0 ? "FLAWLESS SERVICE" : "SHIFT OVER") + " · " + win + " chips",
        line: missedCount > 0 ? "Missed " + missedCount + " orders." : "Vedhika is impressed."
      });
    } else {
      sfx.lose();
      host.toast("Cartel closed for the night. Lost " + curBet + " chips.", 2600);
    }

    setTimeout(() => {
      if (!active) {
        startBtn.children[1].text = "OPEN CARTEL · " + curBet;
        startBtn.interactive = true;
      }
    }, 1500);
  }

  // ===== controls =====
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    curBet = [10, 25, 50, 100, 250][i];
    if (!active) startBtn.children[1].text = "OPEN CARTEL · " + curBet;
  }));

  const startBtn = makeButton(W - 16, 50, "OPEN CARTEL · " + curBet, 0xf2c76e, 0x160b20);
  startBtn.x = 8; startBtn.y = H - 52;
  startBtn.interactive = true; startBtn.buttonMode = true;
  c.addChild(startBtn);
  startBtn.on("pointertap", () => { sfx.click(); startRound(); });

  // per-tick: reflow + update timeout bars + check for failures
  const tickerFn = (dt) => {
    const snap = [...ordersActive];
    const now = performance.now();
    for (const o of snap) {
      if (o.targetX != null) o.container.x += (o.targetX - o.container.x) * 0.2;
      const remain = Math.max(0, o.deadline - now);
      const frac = remain / ORDER_TIMEOUT_MS;
      o.barFill.clear();
      const w = TICKET_W - 12;
      const col = frac > 0.5 ? 0x57d38f : frac > 0.25 ? 0xf2c76e : 0xff5d5d;
      o.barFill.beginFill(col).drawRoundedRect(6, TICKET_H - 8, Math.max(2, w * frac), 4, 2).endFill();
      if (remain <= 0) failOrder(o);
    }
  };
  pixiApp.ticker.add(tickerFn);

  return function cleanup() {
    pixiApp.ticker.remove(tickerFn);
    if (countdownInterval) clearInterval(countdownInterval);
    if (spawnTimeoutId) clearTimeout(spawnTimeoutId);
    if (steamInterval) clearInterval(steamInterval);
    if (initialSpawnTimeout) clearTimeout(initialSpawnTimeout);
    active = false;
  };
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
