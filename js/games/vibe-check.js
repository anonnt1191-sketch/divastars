// games/vibe-check.js — Wheel of vibes. Each segment is a vibe with a modifier.
// Landing a vibe grants a session-long bonus that stacks across OTHER games (cross-game meta).
// Vibe Check itself pays x1-x10 per spin.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { VIBES } from "../data/divas.js";

const VIBE_KEYS = Object.keys(VIBES);
const SEG_MULT = [1, 1, 2, 1, 2, 1, 3, 1, 2, 1, 5, 1];  // 12 segments, mostly x1, rare x5

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0,0,W,H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb, {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // wheel setup
  const wheelSize = Math.min(W - 32, H - 260);
  const wheelCx = W / 2;
  const wheelCy = 40 + wheelSize / 2;
  const wheelR = wheelSize / 2;
  const segments = SEG_MULT.length;
  const segAngle = (Math.PI * 2) / segments;

  const wheelContainer = new PIXI.Container();
  wheelContainer.x = wheelCx;
  wheelContainer.y = wheelCy;
  c.addChild(wheelContainer);

  // outer ring
  const outerRing = new PIXI.Graphics();
  outerRing.lineStyle(6, 0xf2c76e, 1).drawCircle(wheelCx, wheelCy, wheelR + 4).endFill();
  c.addChild(outerRing);

  // draw segments with vibe names
  for (let i = 0; i < segments; i++) {
    const vibe = VIBES[VIBE_KEYS[i % VIBE_KEYS.length]];
    const mult = SEG_MULT[i];
    const a0 = i * segAngle - Math.PI / 2 - segAngle/2;
    const a1 = a0 + segAngle;
    const segBg = new PIXI.Graphics();
    const segColor = mult >= 5 ? 0xff2e88 : mult >= 2 ? 0x9d4edd : 0x1c0e2a;
    segBg.lineStyle(2, 0xf2c76e, 0.6);
    segBg.beginFill(segColor, 0.85);
    segBg.moveTo(0, 0);
    segBg.arc(0, 0, wheelR, a0, a1);
    segBg.closePath();
    segBg.endFill();
    wheelContainer.addChild(segBg);
    // label
    const midA = (a0 + a1) / 2;
    const labelR = wheelR * 0.7;
    const lx = Math.cos(midA) * labelR;
    const ly = Math.sin(midA) * labelR;
    if (mult >= 2) {
      const mt = new PIXI.Text(mult + "x", {
        fontFamily:"Outfit, sans-serif",fontSize:18,fontWeight:"900",fill:0xffe9b8
      });
      mt.anchor.set(0.5); mt.x = lx; mt.y = ly;
      wheelContainer.addChild(mt);
    }
    // vibe name at outer edge
    const nameR = wheelR * 0.92;
    const nx = Math.cos(midA) * nameR;
    const ny = Math.sin(midA) * nameR;
    const nt = new PIXI.Text(vibe.name.split(" ")[0], {
      fontFamily:"Outfit, sans-serif",fontSize:10,fontWeight:"700",fill:0xffe9b8
    });
    nt.anchor.set(0.5); nt.x = nx; nt.y = ny;
    nt.rotation = midA + Math.PI / 2;
    wheelContainer.addChild(nt);
  }

  // center hub
  const hubBg = new PIXI.Graphics();
  hubBg.beginFill(0xf2c76e).drawCircle(wheelCx, wheelCy, wheelR * 0.18).endFill();
  hubBg.beginFill(0x160b20).drawCircle(wheelCx, wheelCy, wheelR * 0.16).endFill();
  c.addChild(hubBg);
  const hubText = new PIXI.Text("SPIN", {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontWeight:"900",fill:0xf2c76e
  });
  hubText.anchor.set(0.5); hubText.x = wheelCx; hubText.y = wheelCy;
  c.addChild(hubText);

  // pointer
  const pointer = new PIXI.Graphics();
  pointer.beginFill(0xff2e88).drawPolygon([
    wheelCx, wheelCy - wheelR - 6,
    wheelCx - 14, wheelCy - wheelR - 28,
    wheelCx + 14, wheelCy - wheelR - 28
  ]).endFill();
  c.addChild(pointer);

  // result + active vibes display
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit, sans-serif",fontSize:18,fontWeight:"900",fill:0xffe9b8,
    stroke:0x160b20,strokeThickness:3,align:"center",wordWrap:true,wordWrapWidth:W-16
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = wheelCy + wheelR + 16;
  c.addChild(resultText);

  // show active vibes from store
  const activeVibesText = new PIXI.Text("Active vibes: none", {
    fontFamily:"Outfit, sans-serif",fontSize:13,fontWeight:"600",fill:0x57d38f,align:"center"
  });
  activeVibesText.anchor.set(0.5,0); activeVibesText.x = W/2; activeVibesText.y = wheelCy + wheelR + 50;
  c.addChild(activeVibesText);

  function updateActiveVibes() {
    const vibes = store.state.vibes || [];
    activeVibesText.text = vibes.length > 0
      ? `Active vibes: ${vibes.map(id => VIBES[id]?.name).join(", ")}`
      : "No active vibes. Spin to gain one.";
  }
  updateActiveVibes();

  // spin state
  let spinning = false;
  let spinStart = 0;
  const spinDuration = 4000;
  let startRotation = 0;
  let targetRotation = 0;
  let curBet = 25;

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; updateBtn(); }));

  const spinBtn = makeButton(W-16, 60, "SPIN · "+curBet, 0xf2c76e, 0x160b20);
  spinBtn.x = 8; spinBtn.y = H - 60;
  spinBtn.interactive = true; spinBtn.buttonMode = true;
  c.addChild(spinBtn);
  function updateBtn() { spinBtn.children[1].text = "SPIN · "+curBet; }

  spinBtn.on("pointertap", () => {
    sfx.click();
    if (spinning) return;
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    spinning = true;
    spinStart = performance.now();
    startRotation = wheelContainer.rotation;
    targetRotation = startRotation + Math.PI * 2 * (4 + Math.random()*2) + Math.random() * Math.PI * 2;
    sfx.whoosh();
    resultText.text = "";
  });

  const tickerFn = (dt) => {
    if (!spinning) return;
    const elapsed = performance.now() - spinStart;
    const tt = Math.min(1, elapsed / spinDuration);
    const eased = 1 - Math.pow(1 - tt, 3);
    wheelContainer.rotation = startRotation + (targetRotation - startRotation) * eased;
    if (Math.random() < 0.05 && tt > 0.7) sfx.tick();
    if (tt >= 1) {
      spinning = false;
      const finalRot = ((wheelContainer.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const targetAngle = (-Math.PI / 2 - finalRot + Math.PI * 2) % (Math.PI * 2);
      let winner = 0, bestDist = Infinity;
      for (let i = 0; i < segments; i++) {
        const mid = i * segAngle - Math.PI / 2;
        const normMid = ((mid % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const d = Math.min(Math.abs(normMid - targetAngle), Math.PI * 2 - Math.abs(normMid - targetAngle));
        if (d < bestDist) { bestDist = d; winner = i; }
      }
      const mult = SEG_MULT[winner];
      const vibeKey = VIBE_KEYS[winner % VIBE_KEYS.length];
      const vibe = VIBES[vibeKey];
      const win = Math.floor(curBet * mult);
      if (win > 0) {
        store.pay(win);
        sfx.win();
      } else {
        sfx.lose();
      }
      store.record(game.id, curBet, win);
      // grant vibe to store
      if (!store.state.vibes) store.state.vibes = [];
      if (!store.state.vibes.includes(vibeKey)) {
        store.state.vibes.push(vibeKey);
        store.save();
      }
      resultText.text = `${vibe.name} (${mult}x) · +${win} chips · VIBE ACTIVATED`;
      updateActiveVibes();
      host.onWin(mult >= 5 ? "big" : "win", win, {
        title: vibe.name + " · " + mult + "x",
        line: vibe.flavor
      });
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
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:18,fontWeight:"700",fill:fg});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
