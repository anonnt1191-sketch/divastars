// games/fishing.js — Diva Fishing. Fish swim across; tap to fire bullets at them.
// Small fast = x5, Medium = x2, Large slow = x1, Mermaid (gold-crowned) = x25.
// Each shot costs bet/10. 30 seconds per round. Net payout settled at end.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { castToPhotoURL, castPick } from "../core/photos.js";
import { CAST_LIST } from "../core/app.js";

const ROUND_TIME = 30;

const FISH_TYPES = [
  { name: "small",   mult: 5,  size: 56,  speed: 150, weight: 0.45, color: 0x57d38f },
  { name: "medium",  mult: 2,  size: 76,  speed: 95,  weight: 0.30, color: 0xf2c76e },
  { name: "large",   mult: 1,  size: 100, speed: 55,  weight: 0.18, color: 0xff5d5d },
  { name: "mermaid", mult: 25, size: 92,  speed: 70,  weight: 0.07, color: 0xffd700, crowned: true }
];

function pickFishType() {
  const r = Math.random();
  let acc = 0;
  for (const ty of FISH_TYPES) {
    acc += ty.weight;
    if (r < acc) return ty;
  }
  return FISH_TYPES[0];
}

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  // ── Background: underwater gradient ───────────────────────────────────────
  const bg = new PIXI.Graphics();
  bg.beginFill(0x041830, 0.75).drawRect(0, 0, W, H).endFill();
  for (let i = 0; i < H; i += 4) {
    const tt = i / H;
    bg.beginFill(0x0a3a5c, 0.20 + tt * 0.30).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb || "Hook the divas. Mind the mermaids.", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontStyle: "italic", fill: 0x9fd8ff
  });
  tagline.x = 8; tagline.y = 4;
  c.addChild(tagline);

  // ── HUD ───────────────────────────────────────────────────────────────────
  const timeText = new PIXI.Text("TIME: 30", {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "900", fill: 0xffe9b8,
    stroke: 0x041830, strokeThickness: 3
  });
  timeText.x = 8; timeText.y = 22;
  c.addChild(timeText);

  const wonText = new PIXI.Text("WON: 0", {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "900", fill: 0xf2c76e,
    stroke: 0x041830, strokeThickness: 3, align: "right"
  });
  wonText.anchor.set(1, 0);
  wonText.x = W - 8; wonText.y = 22;
  c.addChild(wonText);

  const shotsText = new PIXI.Text("shots: 0", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "700", fill: 0x9fd8ff
  });
  shotsText.anchor.set(1, 0);
  shotsText.x = W - 8; shotsText.y = 44;
  c.addChild(shotsText);

  // ── Playfield ─────────────────────────────────────────────────────────────
  const fieldY = 64;
  const fieldH = H - fieldY - 110;
  const field = new PIXI.Container();
  field.x = 0; field.y = fieldY;
  c.addChild(field);

  // transparent tap surface
  const tapSurface = new PIXI.Graphics();
  tapSurface.beginFill(0xffffff, 0).drawRect(0, 0, W, fieldH).endFill();
  tapSurface.interactive = true;
  field.addChild(tapSurface);

  const fishLayer = new PIXI.Container();
  field.addChild(fishLayer);
  const bulletLayer = new PIXI.Container();
  field.addChild(bulletLayer);

  // ── Turret at bottom-center ───────────────────────────────────────────────
  const turretX = W / 2;
  const turretY = fieldH - 15;
  const turret = new PIXI.Container();
  turret.x = turretX; turret.y = turretY;
  c.addChild(turret);
  const turretBase = new PIXI.Graphics();
  turretBase.beginFill(0x333333).drawCircle(0, 0, 18).endFill();
  turretBase.beginFill(0xf2c76e).drawCircle(0, 0, 12).endFill();
  turret.addChild(turretBase);
  const turretBarrel = new PIXI.Graphics();
  turretBarrel.beginFill(0xff2e88).drawRoundedRect(-4, -24, 8, 24, 2).endFill();
  turret.addChild(turretBarrel);
  turretBarrel.rotation = -Math.PI / 2;   // pointing up

  // ── State ─────────────────────────────────────────────────────────────────
  let active = false;
  let timeLeft = ROUND_TIME;
  let totalWon = 0;
  let totalWagered = 0;
  let shotsFired = 0;
  let curBet = 25;
  let shotCost = Math.max(1, Math.floor(curBet / 10));
  let timerInterval = null;
  let spawnInterval = null;
  let lastLowToast = 0;

  const fish = [];    // { x, y, vx, type, alive, dying, deathT, size, dir, sprite }
  const bullets = []; // { x, y, vx, vy, life, sprite }

  function startRound() {
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    active = true;
    timeLeft = ROUND_TIME;
    totalWon = 0;
    totalWagered = curBet;     // ante — shots cost more on top
    shotsFired = 0;
    shotCost = Math.max(1, Math.floor(curBet / 10));
    timeText.text = "TIME: " + ROUND_TIME;
    wonText.text = "WON: 0";
    shotsText.text = "shots: 0";
    sfx.whoosh();
    if (timerInterval) clearInterval(timerInterval);
    if (spawnInterval) clearInterval(spawnInterval);
    timerInterval = setInterval(() => {
      if (!active) { clearInterval(timerInterval); return; }
      timeLeft -= 0.1;
      timeText.text = "TIME: " + Math.max(0, timeLeft).toFixed(1);
      if (timeLeft <= 0) endRound();
    }, 100);
    spawnInterval = setInterval(() => {
      if (!active) { clearInterval(spawnInterval); return; }
      spawnFish();
    }, 550);
    for (let i = 0; i < 3; i++) setTimeout(() => { if (active) spawnFish(); }, i * 200);
  }

  function spawnFish() {
    const ty = pickFishType();
    const fromLeft = Math.random() < 0.5;
    const dir = fromLeft ? 1 : -1;
    const y = 30 + Math.random() * Math.max(50, fieldH - 140);
    const x = fromLeft ? -ty.size : W + ty.size;
    const cast = castPick(CAST_LIST);
    const f = {
      x, y, vx: dir * ty.speed, type: ty, alive: true, dying: false, deathT: 0,
      size: ty.size, dir, sprite: null
    };
    buildFishSprite(f, cast, ty);
    fish.push(f);
  }

  async function buildFishSprite(f, cast, ty) {
    const cont = new PIXI.Container();
    cont.x = f.x; cont.y = f.y;
    const front = f.dir;
    const body = new PIXI.Graphics();
    // body
    body.beginFill(ty.color, 0.85).drawEllipse(0, 0, ty.size / 2, ty.size / 3).endFill();
    // tail
    const tailX = -front * ty.size / 2;
    body.beginFill(ty.color, 0.85).drawPolygon([
      tailX, -ty.size / 5,
      tailX - front * 12, 0,
      tailX, ty.size / 5
    ]).endFill();
    // eye
    const eyeX = front * ty.size / 4;
    body.beginFill(0xffffff).drawCircle(eyeX, -ty.size / 8, 4).endFill();
    body.beginFill(0x160b20).drawCircle(eyeX + front, -ty.size / 8, 2).endFill();
    cont.addChild(body);
    // crown for mermaid
    if (ty.crowned) {
      const crown = new PIXI.Graphics();
      crown.beginFill(0xffd700).drawPolygon([
        -12, -ty.size / 3, -8, -ty.size / 3 - 8, -4, -ty.size / 3 - 2,
        0, -ty.size / 3 - 10, 4, -ty.size / 3 - 2, 8, -ty.size / 3 - 8, 12, -ty.size / 3
      ]).endFill();
      cont.addChild(crown);
    }
    f.sprite = cont;
    fishLayer.addChild(cont);
    // async photo
    try {
      const url = castToPhotoURL(cast);
      const tex = await PIXI.Assets.load(url);
      if (!f.alive) return;
      const sp = new PIXI.Sprite(tex);
      const sz = ty.size * 0.5;
      const scale = sz / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5);
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawCircle(0, 0, sz / 2).endFill();
      cont.addChild(mask);
      sp.mask = mask;
      cont.addChild(sp);
    } catch (e) {}
  }

  function fire(tx, ty_) {
    if (!active) return;
    if (store.state.bank < shotCost) {
      if (performance.now() - lastLowToast > 1500) {
        host.toast("Out of chip shots!", 1200);
        lastLowToast = performance.now();
      }
      return;
    }
    store.bet(shotCost);
    totalWagered += shotCost;
    shotsFired++;
    shotsText.text = "shots: " + shotsFired;
    sfx.pop();
    const dx = tx - turretX, dy = ty_ - turretY;
    const d = Math.hypot(dx, dy) || 1;
    const speed = 720;
    const vx = dx / d * speed;
    const vy = dy / d * speed;
    turretBarrel.rotation = Math.atan2(dy, dx);
    const bullet = { x: turretX, y: turretY, vx, vy, life: 1.4, sprite: null };
    const sp = new PIXI.Graphics();
    sp.beginFill(0xffe9b8).drawCircle(0, 0, 5).endFill();
    sp.beginFill(0xff2e88).drawCircle(0, 0, 3).endFill();
    sp.x = turretX; sp.y = turretY;
    bulletLayer.addChild(sp);
    bullet.sprite = sp;
    bullets.push(bullet);
  }

  tapSurface.on("pointerdown", (e) => {
    const lx = e.global.x;
    const ly = e.global.y - fieldY;
    fire(lx, ly);
  });

  function killFish(f) {
    if (!f.alive) return;
    f.alive = false;
    f.dying = true;
    f.deathT = 0;
    const payout = shotCost * f.type.mult;
    totalWon += payout;
    if (payout > 0) store.pay(payout);
    wonText.text = "WON: " + totalWon;
    if (f.type.crowned) { sfx.big(); host.toast("MERMAID! +" + payout, 1400); }
    else if (f.type.mult >= 5) sfx.coin();
    else sfx.tick();
  }

  function endRound() {
    active = false;
    if (timerInterval) clearInterval(timerInterval);
    if (spawnInterval) clearInterval(spawnInterval);
    const net = totalWon - totalWagered;
    store.record(game.id, totalWagered, totalWon);
    if (net > 0) {
      const tier = net >= curBet * 8 ? "mega" : net >= curBet * 3 ? "big" : "win";
      if (tier === "mega") sfx.mega(); else if (tier === "big") sfx.big(); else sfx.win();
      host.onWin(tier, totalWon, {
        title: totalWon + " chips caught",
        line: "+" + net + " net"
      });
    } else if (totalWon > 0) {
      sfx.lose();
      host.toast("Boat leaks. -" + Math.abs(net) + " net.", 2200);
    } else {
      sfx.lose();
      host.toast("No catches. Boat's empty.", 2200);
    }
    updateStartBtn();
  }

  // ── Bet row + start ───────────────────────────────────────────────────────
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => {
    curBet = [10, 25, 50, 100, 250][i];
    shotCost = Math.max(1, Math.floor(curBet / 10));
    updateStartBtn();
  }));

  const startBtn = makeButton(W - 16, 50, "START · " + curBet, 0xf2c76e, 0x160b20);
  startBtn.x = 8; startBtn.y = H - 55;
  startBtn.interactive = true; startBtn.buttonMode = true;
  c.addChild(startBtn);
  function updateStartBtn() {
    startBtn.children[1].text = active ? "PLAYING..." : "START · " + curBet;
  }
  startBtn.on("pointertap", () => {
    if (active) return;
    sfx.click();
    startRound();
    updateStartBtn();
    setTimeout(() => { if (!active) updateStartBtn(); }, ROUND_TIME * 1000 + 500);
  });

  // ── Ticker ────────────────────────────────────────────────────────────────
  const tickerFn = (dt) => {
    const dts = Math.min(dt / 60, 0.04);
    // fish move + death animation
    for (const f of fish) {
      if (f.dying) {
        f.deathT += dts;
        if (f.sprite) {
          f.sprite.scale.x *= 1 - dts * 2;
          f.sprite.scale.y *= 1 - dts * 2;
          f.sprite.alpha = Math.max(0, f.sprite.alpha - dts * 2);
          f.sprite.rotation += dts * 4;
        }
        if (f.deathT > 0.6) {
          if (f.sprite && f.sprite.parent) f.sprite.parent.removeChild(f.sprite);
          f.sprite = null;
          f.dying = false;
        }
        continue;
      }
      if (!f.alive) continue;
      f.x += f.vx * dts;
      if (f.sprite) { f.sprite.x = f.x; f.sprite.y = f.y; }
      if (f.dir > 0 && f.x > W + f.size + 20) f.alive = false;
      if (f.dir < 0 && f.x < -f.size - 20) f.alive = false;
    }
    // cleanup
    for (let i = fish.length - 1; i >= 0; i--) {
      const f = fish[i];
      if (!f.alive && !f.dying) {
        if (f.sprite && f.sprite.parent) f.sprite.parent.removeChild(f.sprite);
        fish.splice(i, 1);
      }
    }
    // bullets
    for (const b of bullets) {
      b.x += b.vx * dts;
      b.y += b.vy * dts;
      b.life -= dts;
      if (b.sprite) { b.sprite.x = b.x; b.sprite.y = b.y; }
      for (const f of fish) {
        if (!f.alive) continue;
        const dx = b.x - f.x, dy = b.y - f.y;
        if (Math.hypot(dx, dy) < f.size / 2) {
          killFish(f);
          b.life = 0;
          break;
        }
      }
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.life <= 0 || b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > fieldH + 20) {
        if (b.sprite && b.sprite.parent) b.sprite.parent.removeChild(b.sprite);
        bullets.splice(i, 1);
      }
    }
  };
  pixiApp.ticker.add(tickerFn);

  return function cleanup() {
    pixiApp.ticker.remove(tickerFn);
    if (timerInterval) clearInterval(timerInterval);
    if (spawnInterval) clearInterval(spawnInterval);
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
  tx.anchor.set(0.5);
  tx.x = w / 2; tx.y = h / 2;
  c.addChild(tx);
  return c;
}
