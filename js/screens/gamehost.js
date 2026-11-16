// screens/gameHost.js — generic game host shell. Wraps every game with:
// back button, bank pill, mute toggle, bet row, result card, comp row.
// POLISH: bigger buttons, bigger fonts, min 48px tap targets.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { toast } from "../core/fx.js";
import { getGame } from "../data/games-registry.js";

export async function render(pixiApp, appRef, opts = {}) {
  const { gameId, module: gameMod } = opts;
  const game = getGame(gameId);
  if (!game || !gameMod?.mount) {
    toast(pixiApp, "Game module missing mount().");
    appRef.backToLobby();
    return;
  }

  const W = pixiApp.screen.width, H = pixiApp.screen.height;
  const c = new PIXI.Container();
  pixiApp.stage.addChild(c);

  // top bar — taller for bigger buttons
  const topH = 64;
  const topBar = new PIXI.Container();
  topBar.y = 6;
  c.addChild(topBar);

  // back button — bigger, easier to tap
  const back = makeButton(80, 48, "← Back", 0x333333, 0xffffff, 14);
  back.x = 8; back.y = topH/2 - 24;
  back.interactive = true; back.buttonMode = true;
  back.on("pointertap", () => { sfx.click(); appRef.backToLobby(); });
  topBar.addChild(back);

  // game title — bigger, italic
  const title = new PIXI.Text(game.name, {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: 22, fontStyle: "italic", fontWeight: "700",
    fill: 0xf2c76e
  });
  title.x = 96; title.y = 18;
  topBar.addChild(title);

  // bank pill (right) — bigger
  const bankPill = makePill(`${store.state.bank.toLocaleString("en-US")} chips`, 0xf2c76e, 0x160b20, 14);
  bankPill.x = W - bankPill.width - 8;
  bankPill.y = topH/2 - bankPill.height/2;
  topBar.addChild(bankPill);

  // mute button — bigger
  const muteBtn = makePill(store.state.muted ? "🔇" : "🔊", 0x333333, 0xffffff, 14);
  muteBtn.x = bankPill.x - muteBtn.width - 8;
  muteBtn.y = topH/2 - muteBtn.height/2;
  muteBtn.interactive = true; muteBtn.buttonMode = true;
  muteBtn.on("pointertap", () => {
    const m = !store.state.muted;
    store.setMuted(m); sfx.muted = m; sfx.click();
    appRef.go("game", { gameId, module: gameMod });
  });
  topBar.addChild(muteBtn);

  // playfield area — PHASE 8: add atmospheric background to fill empty space
  const stageY = topH + 8;
  const stageH = H - stageY - 8;
  const stageContainer = new PIXI.Container();
  stageContainer.y = stageY;
  c.addChild(stageContainer);

  // PHASE 8: decorative atmospheric background — fills empty space with ambiance
  const stageBg = new PIXI.Graphics();
  // radial gradient effect (layered circles) — visible through semi-transparent game bg
  const cx = W / 2, cy = stageH / 2;
  const maxR = Math.max(W, stageH);
  for (let r = maxR; r > 0; r -= 40) {
    const t = r / maxR;
    const a = 0.08 + (1 - t) * 0.12;
    stageBg.beginFill(0x3a1a4a, a).drawCircle(cx, cy, r).endFill();
  }
  // gold dot pattern — visible through semi-transparent game bg
  stageBg.beginFill(0xf2c76e, 0.12);
  for (let px = 20; px < W; px += 40) {
    for (let py = 20; py < stageH; py += 40) {
      stageBg.drawCircle(px, py, 2);
    }
  }
  stageBg.endFill();
  // subtle vignette
  stageBg.beginFill(0x000000, 0).drawRect(0, 0, W, stageH).endFill();
  stageContainer.addChild(stageBg);

  // host context — bigger bet row pills
  const host = {
    pixiApp,
    app: appRef,
    stage: stageContainer,
    width: W,
    height: stageH,
    game,
    store,
    sfx,
    toast: (msg, ms) => toast(pixiApp, msg, ms),
    betRow: (initial = 25) => makeBetRow(W, initial, host),
    resultCard: (tone, titleText, amount, extra) => showResultCard(pixiApp, c, tone, titleText, amount, extra),
    compRow: () => makeCompRow(W, host),
    onWin: (tier, amount, opts) => {
      // PHASE 7: pass the game's celebration style through to FX engine
      const style = game.celebrationStyle || "confetti";
      import("../core/fx.js").then(({ showFX }) => showFX(pixiApp, tier, { ...opts, style }));
    }
  };

  let gameCleanup = null;
  try {
    gameCleanup = await gameMod.mount(host);
  } catch (e) {
    console.error(`[${gameId}] mount failed`, e);
    toast(pixiApp, "Game failed. The Den is sorry.", 3000);
    setTimeout(() => appRef.backToLobby(), 1500);
  }

  return {
    cleanup: () => {
      if (gameCleanup) try { gameCleanup(); } catch(e){}
    }
  };
}

function makeButton(w, h, label, bg, fg, fontSize = 14) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 10).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif",
    fontSize: fontSize, fontWeight: "700", fill: fg, align: "center"
  });
  tx.anchor.set(0.5);
  tx.x = w/2; tx.y = h/2;
  c.addChild(tx);
  return c;
}

function makePill(text, bg, fg, fontSize = 13) {
  const c = new PIXI.Container();
  const tx = new PIXI.Text(text, {
    fontFamily: "Outfit, sans-serif",
    fontSize: fontSize, fontWeight: "700", fill: fg
  });
  const padX = 14, padY = 9;
  const w = tx.width + padX * 2, h = tx.height + padY * 2;
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, h/2).endFill();
  c.addChild(g);
  tx.x = padX; tx.y = padY;
  c.addChild(tx);
  return c;
}

const BET_LEVELS = [10, 25, 50, 100, 250];

function makeBetRow(maxW, initial, host) {
  const c = new PIXI.Container();
  let cur = initial;
  const pills = [];
  BET_LEVELS.forEach((v, i) => {
    const p = makePill(String(v), v === initial ? 0xf2c76e : 0x333333, v === initial ? 0x160b20 : 0xffffff, 14);
    p.x = i * (p.width + 6);
    p.y = 0;
    p.interactive = true; p.buttonMode = true;
    p.on("pointertap", () => {
      sfx.click();
      cur = v;
      pills.forEach(x => {
        x.children[0].clear();
        x.children[0].beginFill(0x333333).drawRoundedRect(0, 0, x.width, x.height, x.height/2).endFill();
        x.children[1].style.fill = 0xffffff;
      });
      p.children[0].clear();
      p.children[0].beginFill(0xf2c76e).drawRoundedRect(0, 0, p.width, p.height, p.height/2).endFill();
      p.children[1].style.fill = 0x160b20;
    });
    pills.push(p);
    c.addChild(p);
  });
  c.getBet = () => cur;
  return c;
}

function showResultCard(pixiApp, parent, tone, titleText, amount, extra) {
  const W = pixiApp.screen.width, H = pixiApp.screen.height;
  const card = new PIXI.Container();
  card.x = W / 2; card.y = H / 2;
  parent.addChild(card);
  const colors = { win: 0x57d38f, lose: 0xff5d5d, push: 0xf2c76e };
  const bg = new PIXI.Graphics();
  bg.beginFill(0x1c0e2a, 0.95).drawRoundedRect(-W * 0.42, -100, W * 0.84, 200, 18).endFill();
  bg.beginFill(colors[tone] || 0xf2c76e, 0.6).drawRoundedRect(-W * 0.42, -100, W * 0.84, 5, 2).endFill();
  card.addChild(bg);
  const tx = new PIXI.Text(titleText, {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: 28, fontStyle: "italic", fontWeight: "900",
    fill: colors[tone] || 0xf2c76e, align: "center", wordWrap: true, wordWrapWidth: W * 0.7
  });
  tx.anchor.set(0.5);
  tx.y = -40;
  card.addChild(tx);
  if (amount != null) {
    const a = new PIXI.Text((amount > 0 ? "+" : "") + amount.toLocaleString("en-US") + " chips", {
      fontFamily: "Outfit, sans-serif",
      fontSize: 32, fontWeight: "900", fill: 0xffe9b8, align: "center"
    });
    a.anchor.set(0.5);
    a.y = 10;
    card.addChild(a);
  }
  if (extra) {
    const e = new PIXI.Text(extra, {
      fontFamily: "Outfit, sans-serif",
      fontSize: 15, fontWeight: "400", fill: 0xb0b0b0, align: "center"
    });
    e.anchor.set(0.5);
    e.y = 60;
    card.addChild(e);
  }
  card.alpha = 0;
  let el = 0;
  const fn = (dt) => {
    el += dt * 16.67;
    card.alpha = Math.min(1, el / 200);
    if (el > 1800) {
      card.alpha = Math.max(0, 1 - (el - 1800) / 300);
      if (el > 2200) { pixiApp.ticker.remove(fn); parent.removeChild(card); card.destroy(); }
    }
  };
  pixiApp.ticker.add(fn);
}

function makeCompRow(maxW, host) {
  const c = new PIXI.Container();
  const pill = makePill("🆘 Comps +2000", 0x7c1d3f, 0xffe9b8, 13);
  pill.interactive = true;
  pill.buttonMode = true;
  pill.on("pointertap", () => {
    if (store.comp()) {
      sfx.chip();
      host.toast(`The Den comps you 2000 chips. Comps used: ${store.state.compsUsed}`, 2400);
      c.parent?.removeChild(c);
    } else {
      host.toast("You still have chips. The Den is watching.", 2400);
    }
  });
  c.addChild(pill);
  return c;
}
