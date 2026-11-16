// games/jetx.js — Classic JetX crash. Same curve as Cash Me, different visual theme (orange/red).

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { castToPhotoURL } from "../core/photos.js";

const STATE = { IDLE:"idle", FLYING:"flying", CRASHED:"crashed" };

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  // dark space bg
  const bg = new PIXI.Graphics();
  bg.beginFill(0x1a0a0a, 0.75).drawRect(0,0,W,H).endFill();
  for (let i = 0; i < 60; i++) {
    bg.beginFill(0xffffff, Math.random()*0.5+0.1).drawCircle(Math.random()*W, Math.random()*H, Math.random()*1.5).endFill();
  }
  c.addChild(bg);

  let state = STATE.IDLE;
  let curBet = 25;
  let multiplier = 1.0;
  let crashPoint = 0;
  let cashedOut = false;
  let cashedAtMult = 0;
  let pilot = null;
  let pilotPhoto = null;
  let roundStart = 0;
  let nextRoundAt = 0;
  let history = [];

  const historyContainer = new PIXI.Container();
  historyContainer.x = 6; historyContainer.y = 8;
  c.addChild(historyContainer);
  function renderHistory() {
    historyContainer.removeChildren();
    history.slice(-12).forEach((m, i) => {
      const col = m<1.5?0xff5d5d:m<3?0xf2c76e:0x57d38f;
      const p = new PIXI.Graphics();
      p.beginFill(col,0.7).drawRoundedRect(i*40,0,36,18,6).endFill();
      historyContainer.addChild(p);
      const tx = new PIXI.Text(m.toFixed(2)+"x",{fontFamily:"Outfit",fontSize:12,fontWeight:"700",fill:0x160b20});
      tx.anchor.set(0.5); tx.x = i*40+18; tx.y = 9;
      historyContainer.addChild(tx);
    });
  }
  renderHistory();

  const graphY = 36;
  const graphH = Math.min(H - graphY - 140, 320);
  const graphContainer = new PIXI.Container();
  graphContainer.y = graphY;
  c.addChild(graphContainer);
  const graphBg = new PIXI.Graphics();
  graphBg.beginFill(0x1a0a0a, 0.7).drawRoundedRect(0,0,W-8,graphH,12).endFill();
  graphContainer.addChild(graphBg);

  const multText = new PIXI.Text("1.00x",{
    fontFamily:"Outfit",fontSize:56,fontWeight:"900",fill:0xf97316,
    stroke:0x1a0a0a,strokeThickness:4
  });
  multText.anchor.set(0.5); multText.x=(W-8)/2; multText.y=graphH/2;
  graphContainer.addChild(multText);

  const statusText = new PIXI.Text(t("crash.placeBet"),{
    fontFamily:"Outfit",fontSize:14,fontStyle:"italic",fill:0xf97316
  });
  statusText.anchor.set(0.5); statusText.x=(W-8)/2; statusText.y=graphH-20;
  graphContainer.addChild(statusText);

  // jet sprite
  let jetSprite = null;
  async function loadPilot() {
    pilot = SESSION.crashPilots[Math.floor(Math.random()*SESSION.crashPilots.length)];
    if (jetSprite) { graphContainer.removeChild(jetSprite); jetSprite.destroy(); }
    const url = castToPhotoURL(pilot);
    try {
      const tex = await PIXI.Assets.load(url);
      jetSprite = new PIXI.Sprite(tex);
      jetSprite.width = 70; jetSprite.height = 70;
      jetSprite.anchor.set(0.5);
      jetSprite.x = 35; jetSprite.y = graphH - 35;
      jetSprite.alpha = 0;
      graphContainer.addChild(jetSprite);
    } catch(e) {}
  }

  const controlsY = graphY + graphH + 8;
  const controls = new PIXI.Container();
  controls.y = controlsY;
  c.addChild(controls);
  const betRow = host.betRow(curBet);
  betRow.x = 6; betRow.y = 0;
  controls.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; updateBtn(); }));
  const actionBtn = makeButton(W-16, 50, t("common.bet")+" "+curBet, 0xf97316, 0x1a0a0a);
  actionBtn.x = 8; actionBtn.y = 38;
  actionBtn.interactive = true; actionBtn.buttonMode = true;
  controls.addChild(actionBtn);
  function updateBtn() {
    const bg = actionBtn.children[0]; const tx = actionBtn.children[1];
    bg.clear();
    if (state === STATE.IDLE) {
      bg.beginFill(0xf97316).drawRoundedRect(0,0,W-16,50,12).endFill();
      tx.text = t("common.bet")+" "+curBet; tx.style.fill = 0x1a0a0a;
    } else if (state === STATE.FLYING && !cashedOut) {
      bg.beginFill(0x57d38f).drawRoundedRect(0,0,W-16,50,12).endFill();
      tx.text = t("common.cashOut")+" ("+(curBet*multiplier).toFixed(0)+")"; tx.style.fill = 0x1a0a0a;
    } else if (state === STATE.FLYING && cashedOut) {
      bg.beginFill(0x333333).drawRoundedRect(0,0,W-16,50,12).endFill();
      tx.text = t("crash.cashedOut",{m:cashedAtMult.toFixed(2)})+" · +"+(curBet*cashedAtMult).toFixed(0); tx.style.fill = 0xffffff;
    } else {
      bg.beginFill(0xff5d5d).drawRoundedRect(0,0,W-16,50,12).endFill();
      tx.text = t("crash.waitingNext"); tx.style.fill = 0xffffff;
    }
  }
  updateBtn();
  actionBtn.on("pointertap", () => {
    sfx.click();
    if (state === STATE.IDLE) {
      if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
      startRound();
    } else if (state === STATE.FLYING && !cashedOut) {
      doCashOut();
    }
  });

  function startRound() {
    state = STATE.FLYING;
    multiplier = 1.0; cashedOut = false; cashedAtMult = 0;
    roundStart = performance.now();
    const r = Math.random();
    crashPoint = r < 0.005 ? 1.0 : Math.max(1.01, 1/(1-r)*0.99 + 1);
    crashPoint = Math.min(crashPoint, 100);
    statusText.text = t("crash.placeBet");
    sfx.fly();
    loadPilot().then(() => { if (jetSprite) jetSprite.alpha = 1; });
  }
  function doCashOut() {
    if (cashedOut) return;
    cashedOut = true; cashedAtMult = multiplier;
    const win = Math.floor(curBet * multiplier);
    store.pay(win); store.record(game.id, curBet, win); sfx.win();
    host.onWin(multiplier >= 10 ? "mega" : multiplier >= 5 ? "big" : "win", win, {
      title: t("crash.cashedOut",{m:multiplier.toFixed(2)}),
      line: pilot?.name+" let you off easy."
    });
    updateBtn();
  }
  function endRound() {
    state = STATE.CRASHED;
    history.push(crashPoint);
    if (history.length > 30) history.shift();
    renderHistory();
    if (!cashedOut) {
      sfx.crash();
      statusText.text = t("crash.busted")+" @ "+crashPoint.toFixed(2)+"x";
      store.record(game.id, curBet, 0);
      host.toast(pilot?.name+" bailed. Lost "+curBet+" chips.", 3000);
    }
    nextRoundAt = performance.now() + 3500;
    updateBtn();
  }

  const tickerFn = (dt) => {
    const now = performance.now();
    if (state === STATE.FLYING) {
      const elapsed = (now - roundStart)/1000;
      // JetX: medium curve
      multiplier = Math.exp(0.20 * elapsed);
      if (multiplier >= crashPoint) { multiplier = crashPoint; endRound(); }
      multText.text = multiplier.toFixed(2)+"x";
      const heatT = Math.min(1,(multiplier-1)/10);
      const r = Math.round(0xf9 + (0xff-0xf9)*heatT);
      const g = Math.round(0x73 + (0x5d-0x73)*heatT);
      const b = Math.round(0x16 + (0x5d-0x16)*heatT);
      multText.style.fill = (r<<16)|(g<<8)|b;
      if (jetSprite) {
        const tNorm = Math.min(1, elapsed/12);
        jetSprite.x = 35 + tNorm * (W - 90);
        const yNorm = Math.min(1, Math.log(multiplier)/Math.log(50));
        jetSprite.y = graphH - 35 - yNorm * (graphH - 70);
        jetSprite.rotation = -0.2 + Math.sin(elapsed*3)*0.08;
      }
    } else if (state === STATE.CRASHED) {
      if (now > nextRoundAt) {
        state = STATE.IDLE; multiplier = 1.0;
        if (jetSprite) { graphContainer.removeChild(jetSprite); jetSprite.destroy(); jetSprite = null; }
        multText.text = "1.00x"; multText.style.fill = 0xf97316;
        statusText.text = t("crash.placeBet");
        updateBtn();
      } else {
        statusText.text = t("crash.roundIn",{s:Math.ceil((nextRoundAt-now)/1000)});
      }
    }
  };
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

function makeButton(w,h,label,bg,fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0,0,w,h,12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:16,fontWeight:"700",fill:fg});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
