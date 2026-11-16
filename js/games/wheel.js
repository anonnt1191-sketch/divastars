// games/wheel.js — 24-segment photo wheel. Smooth spin with cubic-bezier easing.
// POLISH: bigger segment photos, large center winner photo after spin, bigger UI.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { castToPhotoURL } from "../core/photos.js";

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb, {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontStyle: "italic", fill: 0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // wheel setup — POLISH: bigger wheel, fills most of width
  const wheelSize = Math.min(W - 32, H - 280);
  const wheelCx = W / 2;
  const wheelCy = 40 + wheelSize / 2;
  const wheelR = wheelSize / 2;
  const segments = SESSION.wheel.length;
  const segAngle = (Math.PI * 2) / segments;

  // multipliers — assign based on position.
  const multAssignments = [];
  for (let i = 0; i < segments; i++) {
    const r = Math.random();
    if (r < 0.5) multAssignments.push(pick([1, 1.5, 2, 2.5, 3]));
    else if (r < 0.85) multAssignments.push(pick([4, 5, 6, 8]));
    else if (r < 0.97) multAssignments.push(pick([10, 15, 20]));
    else multAssignments.push(25);
  }

  const wheelContainer = new PIXI.Container();
  wheelContainer.x = wheelCx;
  wheelContainer.y = wheelCy;
  c.addChild(wheelContainer);

  // outer ring (gold)
  const outerRing = new PIXI.Graphics();
  outerRing.lineStyle(6, 0xf2c76e, 1).beginFill(0x1c0e2a, 0).drawCircle(0, 0, wheelR + 4).endFill();
  c.addChild(outerRing);
  outerRing.x = wheelCx; outerRing.y = wheelCy;

  // draw wheel segments with photos — POLISH: photos at outer edge, bigger
  const segContainers = [];
  const photoR = wheelR * 0.72;  // photos positioned slightly inward
  const photoSize = wheelR * 0.30;  // PHASE 2: bigger segment photos (was 0.22)
  for (let i = 0; i < segments; i++) {
    const cast = SESSION.wheel[i];
    const mult = multAssignments[i];
    const a0 = i * segAngle - Math.PI / 2 - segAngle/2;
    const a1 = a0 + segAngle;

    // segment background
    const segBg = new PIXI.Graphics();
    const segColor = i % 2 === 0 ? 0x1c0e2a : 0x2b1a06;
    segBg.lineStyle(2, 0xf2c76e, 0.6);
    segBg.beginFill(segColor);
    segBg.moveTo(0, 0);
    segBg.arc(0, 0, wheelR, a0, a1);
    segBg.closePath();
    segBg.endFill();
    wheelContainer.addChild(segBg);

    // photo at midpoint of segment, near outer edge
    const midA = (a0 + a1) / 2;
    const px = Math.cos(midA) * photoR;
    const py = Math.sin(midA) * photoR;

    const url = castToPhotoURL(cast);
    PIXI.Assets.load(url).then(tex => {
      if (!tex || wheelContainer.destroyed) return;
      const sp = new PIXI.Sprite(tex);
      const scale = photoSize / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5);
      sp.x = px;
      sp.y = py;
      // POLISH: keep photos upright (counter-rotate the wheel's rotation effect is complex,
      // so just leave rotation 0 — photos stay upright as wheel spins under them visually)
      sp.rotation = 0;
      // circular mask
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawCircle(px, py, photoSize/2).endFill();
      wheelContainer.addChild(mask);
      sp.mask = mask;
      wheelContainer.addChild(sp);
    }).catch(()=>{});

    // multiplier label at very outer edge
    const labelR = wheelR * 0.95;
    const lx = Math.cos(midA) * labelR;
    const ly = Math.sin(midA) * labelR;
    const mt = new PIXI.Text(mult + "x", {
      fontFamily: "Outfit, sans-serif",
      fontSize: 13, fontWeight: "900", fill: 0xffe9b8
    });
    mt.anchor.set(0.5);
    mt.x = lx; mt.y = ly;
    mt.rotation = midA + Math.PI / 2;
    wheelContainer.addChild(mt);

    segContainers.push({ angle0: a0, angle1: a1, mult, cast });
  }

  // center hub — will show winner photo after spin
  const hubContainer = new PIXI.Container();
  hubContainer.x = wheelCx;
  hubContainer.y = wheelCy;
  c.addChild(hubContainer);
  // hub bg (gold circle)
  const hubBg = new PIXI.Graphics();
  hubBg.beginFill(0xf2c76e).drawCircle(0, 0, wheelR * 0.28).endFill();
  hubBg.beginFill(0x160b20).drawCircle(0, 0, wheelR * 0.26).endFill();
  hubContainer.addChild(hubBg);
  // initial center text
  const hubText = new PIXI.Text("SPIN", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0xf2c76e
  });
  hubText.anchor.set(0.5);
  hubContainer.addChild(hubText);

  // pointer (at top, pointing down into wheel)
  const pointer = new PIXI.Graphics();
  pointer.beginFill(0xff2e88).drawPolygon([
    wheelCx, wheelCy - wheelR - 6,
    wheelCx - 14, wheelCy - wheelR - 28,
    wheelCx + 14, wheelCy - wheelR - 28
  ]).endFill();
  pointer.beginFill(0xffe9b8).drawCircle(wheelCx, wheelCy - wheelR - 20, 5).endFill();
  c.addChild(pointer);

  // spin state
  let spinning = false;
  let spinStart = 0;
  let spinDuration = 5000;
  let startRotation = 0;
  let targetRotation = 0;
  let curBet = 25;

  // result text — bigger
  const resultText = new PIXI.Text("", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900",
    fill: 0xf2c76e, stroke: 0x160b20, strokeThickness: 3,
    align: "center", wordWrap: true, wordWrapWidth: W - 16
  });
  resultText.anchor.set(0.5, 0);
  resultText.x = W / 2;
  resultText.y = wheelCy + wheelR + 16;
  c.addChild(resultText);

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; updateSpinBtn(); }));

  const spinBtn = makeButton(W - 16, 60, t("wheel.spin") + " · " + curBet, 0xf2c76e, 0x160b20);
  spinBtn.x = 8; spinBtn.y = H - 60;
  spinBtn.interactive = true; spinBtn.buttonMode = true;
  c.addChild(spinBtn);

  function updateSpinBtn() {
    spinBtn.children[1].text = t("wheel.spin") + " · " + curBet;
  }

  spinBtn.on("pointertap", () => {
    sfx.click();
    if (spinning) return;
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    spinning = true;
    spinStart = performance.now();
    startRotation = wheelContainer.rotation;
    const extra = Math.random() * Math.PI * 2;
    targetRotation = startRotation + Math.PI * 2 * (5 + Math.random() * 3) + extra;
    sfx.whoosh();
    resultText.text = "";
    // clear center hub
    hubContainer.removeChildren();
    hubContainer.addChild(hubBg);
    hubContainer.addChild(hubText);
    hubText.text = "...";
  });

  const tickerFn = (dt) => {
    if (!spinning) return;
    const now = performance.now();
    const elapsed = now - spinStart;
    const t = Math.min(1, elapsed / spinDuration);
    const eased = 1 - Math.pow(1 - t, 3);
    wheelContainer.rotation = startRotation + (targetRotation - startRotation) * eased;
    if (Math.random() < 0.05 && t > 0.7) sfx.tick();

    if (t >= 1) {
      spinning = false;
      const finalRot = ((wheelContainer.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const targetAngle = (-Math.PI / 2 - finalRot + Math.PI * 2) % (Math.PI * 2);
      let winner = 0;
      let bestDist = Infinity;
      for (let i = 0; i < segContainers.length; i++) {
        const mid = (segContainers[i].angle0 + segContainers[i].angle1) / 2;
        const normMid = ((mid % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const d = Math.min(Math.abs(normMid - targetAngle), Math.PI * 2 - Math.abs(normMid - targetAngle));
        if (d < bestDist) { bestDist = d; winner = i; }
      }
      const mult = segContainers[winner].mult;
      const cast = segContainers[winner].cast;
      const win = Math.floor(curBet * mult);
      // POLISH: show large winner photo in center hub
      hubText.text = mult + "x";
      const winnerUrl = castToPhotoURL(cast);
      PIXI.Assets.load(winnerUrl).then(tex => {
        if (!tex || hubContainer.destroyed) return;
        const sp = new PIXI.Sprite(tex);
        // make winner photo larger than hub — extend beyond hub
        const winnerSize = wheelR * 0.45;
        const scale = winnerSize / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.anchor.set(0.5);
        // mask to circle
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawCircle(0, 0, winnerSize/2).endFill();
        hubContainer.addChild(mask);
        sp.mask = mask;
        hubContainer.addChild(sp);
        // gold ring around winner photo
        const ring = new PIXI.Graphics();
        ring.lineStyle(4, 0xffd700, 1).drawCircle(0, 0, winnerSize/2 + 4).endFill();
        hubContainer.addChild(ring);
      }).catch(()=>{});

      if (win > 0) {
        store.pay(win);
        sfx.win();
        resultText.text = `${mult}x · ${cast.name} · +${win}`;
        host.onWin(
          mult >= 20 ? "jackpot" : mult >= 10 ? "mega" : mult >= 5 ? "big" : "win",
          win,
          { title: mult + "x · " + cast.name }
        );
      } else {
        sfx.lose();
        resultText.text = "Wheel landed on 0x.";
      }
      store.record(game.id, curBet, win);
      updateSpinBtn();
    }
  };
  pixiApp.ticker.add(tickerFn);

  return function cleanup() {
    pixiApp.ticker.remove(tickerFn);
  };
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif",
    fontSize: 18, fontWeight: "700", fill: fg
  });
  tx.anchor.set(0.5);
  tx.x = w/2; tx.y = h/2;
  c.addChild(tx);
  return c;
}
