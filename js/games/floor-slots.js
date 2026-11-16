// games/floor-slots.js — REBUILT version of the original game.
// 5 floors · 3 reels · shop roguelike · bosses · roguelike progression.
// Preserves the original game design; reimplemented on PixiJS for smooth 60fps animation.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { DIVAS, DIVA_IDS, BOSSES, FLOORS, VIBES } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";
import { line as voiceLine } from "../core/voice.js";

const ST_DIVAS = ["ann","garima","kajal","soumya","sunita","nikki","vedhika"];
const ST_COUNTS = [4, 4, 4, 3, 3, 3, 1];  // 22 weighted symbol slots

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;

  const c = new PIXI.Container();
  stage.addChild(c);

  // state
  const S = {
    floorIdx: 0,
    spinsLeft: 12,
    floorScore: 0,
    target: FLOORS[0].target,
    boss: FLOORS[0].boss,
    bossQuirkActive: false,
    owned: ["ann", "garima", "kajal"],  // starter squad
    vibes: [],
    spinning: false,
    reels: [null, null, null],
    reelStop: [false, false, false],
    runEnded: false
  };

  // bg
  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0, 0, W, H).endFill();
  // gradient
  for (let i = 0; i < H; i += 4) {
    const a = 0.04 + (i / H) * 0.1;
    bg.beginFill(0x9d4edd, a).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  // header — floor name + target + spins + score
  const headerY = 6;
  const floorName = new PIXI.Text(`Floor ${S.floorIdx + 1}: ${FLOORS[S.floorIdx].name}`, {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: 18, fontStyle: "italic", fontWeight: "700", fill: 0xf2c76e
  });
  floorName.x = 8; floorName.y = headerY;
  c.addChild(floorName);

  const targetText = new PIXI.Text("", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 12, fontWeight: "600", fill: 0xffe9b8
  });
  targetText.x = 8; targetText.y = headerY + 24;
  c.addChild(targetText);

  function updateHeader() {
    floorName.text = `Floor ${S.floorIdx + 1}: ${FLOORS[S.floorIdx].name}`;
    targetText.text = `Target: ${S.target} · Spins left: ${S.spinsLeft} · Score: ${S.floorScore}`;
  }
  updateHeader();

  // boss banner (if active)
  const bossBanner = new PIXI.Container();
  bossBanner.x = 8; bossBanner.y = headerY + 48;
  c.addChild(bossBanner);
  function drawBossBanner() {
    bossBanner.removeChildren();
    if (!S.boss) return;
    const boss = BOSSES[S.boss];
    const bg = new PIXI.Graphics();
    bg.beginFill(0x7c1d3f, 0.9).drawRoundedRect(0, 0, W - 16, 32, 8).endFill();
    bossBanner.addChild(bg);
    const tx = new PIXI.Text(`⚠ ${boss.name}: ${boss.quirk}`, {
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize: 11, fontWeight: "600", fill: 0xffe9b8,
      wordWrap: true, wordWrapWidth: W - 24
    });
    tx.x = 6; tx.y = 8;
    bossBanner.addChild(tx);
  }
  drawBossBanner();

  // reels area — POLISH: bigger reels (1 column wider), taller to fit bigger photos
  const reelAreaY = headerY + 90;
  const reelAreaH = Math.min(H - reelAreaY - 220, 380);
  const reelGap = 6;
  const reelW = (W - 16 - reelGap * 2) / 3;
  const reelH = reelAreaH;

  const reelsContainer = new PIXI.Container();
  reelsContainer.x = 8;
  reelsContainer.y = reelAreaY;
  c.addChild(reelsContainer);

  // build 3 reel columns
  const reelSprites = [[],[],[]];  // current sprites per reel
  const reelContainers = [];
  for (let i = 0; i < 3; i++) {
    const rc = new PIXI.Container();
    rc.x = i * (reelW + reelGap);
    rc.y = 0;
    const rbg = new PIXI.Graphics();
    rbg.beginFill(0x1c0e2a).drawRoundedRect(0, 0, reelW, reelH, 12).endFill();
    rbg.lineStyle(2, 0xf2c76e, 0.4).beginFill(0x1c0e2a, 0).drawRoundedRect(0, 0, reelW, reelH, 12).endFill();
    rc.addChild(rbg);
    reelsContainer.addChild(rc);
    reelContainers.push(rc);
  }

  // POLISH: draw initial reels on mount so the screen isn't empty
  function drawInitialReels() {
    for (let r = 0; r < 3; r++) {
      const rc = reelContainers[r];
      // pick a random symbol from owned squad
      const id = S.owned[Math.floor(Math.random() * S.owned.length)];
      const url = friendPhoto(id, Math.floor(Math.random() * 6));
      PIXI.Assets.load(url).then(tex => {
        if (!tex || rc.destroyed) return;
        const sp = new PIXI.Sprite(tex);
        // cover-fit (fill the reel completely, crop overflow)
        const scale = Math.min(reelW/tex.width, reelH/tex.height);
        sp.scale.set(scale);
        sp.x = (reelW - tex.width * scale) / 2;
        sp.y = (reelH - tex.height * scale) / 2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(0, 0, reelW, reelH, 12).endFill();
        rc.addChild(mask);
        sp.mask = mask;
        rc.addChild(sp);
      }).catch(() => {});
    }
  }
  drawInitialReels();

  // owned-divas strip
  const ownedStripY = reelAreaY + reelAreaH + 8;
  const ownedStrip = new PIXI.Container();
  ownedStrip.x = 8;
  ownedStrip.y = ownedStripY;
  c.addChild(ownedStrip);
  function drawOwnedStrip() {
    ownedStrip.removeChildren();
    const title = new PIXI.Text("Squad:", {
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize: 11, fontWeight: "700", fill: 0x9d4edd
    });
    title.x = 0; title.y = 0;
    ownedStrip.addChild(title);
    let xx = 50;
    for (const id of S.owned) {
      const diva = DIVAS[id];
      const url = friendPhoto(id, 0);
      PIXI.Assets.load(url).then(tex => {
        if (!tex) return;
        const sp = new PIXI.Sprite(tex);
        const sz = 36;
        const scale = sz / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = xx;
        sp.y = 0;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(xx, 0, sz, sz, 6).endFill();
        ownedStrip.addChild(mask);
        sp.mask = mask;
        ownedStrip.addChild(sp);
        const nameTx = new PIXI.Text(diva.name, {
          fontFamily: "Outfit, system-ui, sans-serif",
          fontSize:12, fontWeight: "600", fill: 0xffe9b8
        });
        nameTx.x = xx + sz/2 - nameTx.width/2;
        nameTx.y = sz + 2;
        ownedStrip.addChild(nameTx);
      }).catch(()=>{});
      xx += 42;
    }
  }
  drawOwnedStrip();

  // spin button
  const spinBtn = makeButton(W - 16, 50, t("floorSlots.spin") + " (5)", 0xf2c76e, 0x160b20);
  spinBtn.x = 8; spinBtn.y = H - 50;
  spinBtn.interactive = true; spinBtn.buttonMode = true;
  c.addChild(spinBtn);
  spinBtn.on("pointertap", () => { sfx.click(); spin(); });

  // result text (between reels and button)
  const resultText = new PIXI.Text("", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 14, fontWeight: "600", fill: 0xffe9b8,
    align: "center", wordWrap: true, wordWrapWidth: W - 16
  });
  resultText.anchor.set(0.5, 0);
  resultText.x = W / 2;
  resultText.y = ownedStripY + 60;
  c.addChild(resultText);

  // spin logic — pick 3 random divas from owned + weighted symbol pool
  function pickSymbol() {
    // pick from owned (with weighted ST_DIVAS — original game used ST_COUNTS for fairness)
    const pool = S.owned;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async function spin() {
    if (S.spinning) return;
    if (S.spinsLeft <= 0) { endFloor(); return; }
    S.spinning = true;
    S.spinsLeft--;
    sfx.whoosh();
    resultText.text = "";

    // pick final symbols
    const finalSymbols = [pickSymbol(), pickSymbol(), pickSymbol()];

    // boss quirk: flaker = 50% chance one reel scores 0
    const flakedReel = S.boss === "flaker" && Math.random() < 0.5 ? Math.floor(Math.random() * 3) : -1;

    // animate reels spinning — each reel spins for varying duration, decelerating
    for (let i = 0; i < 3; i++) {
      animateReel(i, finalSymbols[i], i * 600 + 1200, flakedReel === i);
    }

    // wait for all reels to stop
    await new Promise(r => setTimeout(r, 1800));

    // calculate score
    let spinScore = 0;
    const triple = finalSymbols[0] === finalSymbols[1] && finalSymbols[1] === finalSymbols[2];
    const pair = finalSymbols[0] === finalSymbols[1] || finalSymbols[1] === finalSymbols[2] || finalSymbols[0] === finalSymbols[2];

    for (let i = 0; i < 3; i++) {
      if (i === flakedReel) continue;  // flaked reel scores 0
      const id = finalSymbols[i];
      const diva = DIVAS[id];
      spinScore += diva.base;
      // diva-specific rules
      if (id === "ann") spinScore += 3;
      if (id === "soumya" && i === 1) spinScore += 5;
      if (id === "sunita" && S.boss) spinScore += 8;
      if (id === "nitz" && triple) spinScore += 2;
      if (id === "priyanka") spinScore += 3;  // absentees
      if (id === "pinky") spinScore += 2;
      if (id === "kajal") spinScore += 3;
      if (id === "riddhima") spinScore += 4;
      if (id === "sarita") spinScore += 1;
      if (id === "kallie" && Math.random() < 0.4) spinScore = 0;  // chaos
      if (id === "vedhika") spinScore += 14;
    }

    // pair / triple bonuses
    if (triple) spinScore += 10;
    else if (pair) spinScore += 4;
    if (S.vibes.includes("vibeCheck") && pair) spinScore += 4;
    if (S.vibes.includes("gremlin") && Math.random() < 1/6) spinScore *= 3;
    if (S.vibes.includes("groupChat")) {
      const unique = new Set(finalSymbols).size;
      spinScore += unique * 2;
    }

    // boss: rent = every spin after first costs 2
    if (S.boss === "rent" && S.spinsLeft < 11) spinScore = Math.floor(spinScore / 2);

    // shalini's first-spin bonus
    if (S.floorScore === 0 && S.owned.includes("shalini")) spinScore *= 2;

    S.floorScore += spinScore;
    updateHeader();

    // voice line for the winning diva (if triple or pair)
    if (triple || pair) {
      const winningId = finalSymbols.find((id, i, arr) => arr.indexOf(id) !== i);
      if (winningId) {
        const mood = spinScore > 20 ? "winBig" : "winSmall";
        const vl = voiceLine(winningId, mood);
        if (vl) resultText.text = vl;
      }
    }

    sfx.tickUp();
    if (spinScore > 0) sfx.coin();

    S.spinning = false;

    // check floor cleared
    if (S.floorScore >= S.target) {
      setTimeout(() => clearFloor(), 800);
    } else if (S.spinsLeft <= 0) {
      setTimeout(() => endFloor(), 800);
    }
  }

  async function animateReel(reelIdx, finalId, durationMs, flaked) {
    const rc = reelContainers[reelIdx];
    // clear current sprites
    for (const sp of reelSprites[reelIdx]) { if (sp && !sp.destroyed) rc.removeChild(sp); }
    reelSprites[reelIdx] = [];

    // create a vertical strip of 6 photos that scrolls downward, ending on finalId
    const stripHeight = reelH * 4;  // scroll 4x height
    const stripContainer = new PIXI.Container();
    rc.addChild(stripContainer);

    const photoCount = 6;
    const photos = [];
    for (let i = 0; i < photoCount; i++) {
      const id = i === photoCount - 1 ? finalId : DIVA_IDS[Math.floor(Math.random() * DIVA_IDS.length)];
      try {
        const tex = await PIXI.Assets.load(friendPhoto(id, Math.floor(Math.random() * 6)));
        const sp = new PIXI.Sprite(tex);
        const scale = reelW / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = 0;
        sp.y = i * reelH - reelH * 2;  // start above
        sp.width = reelW;
        sp.height = reelH;
        stripContainer.addChild(sp);
        photos.push(sp);
      } catch(e) {}
    }

    // animate scroll: from y=0 (showing photo at index 2) to y=stripHeight (showing final photo)
    const startY = 0;
    const endY = reelH * 4;  // scroll down 4 reel-heights
    const startT = performance.now();
    let lastTickIdx = -1;
    return new Promise(resolve => {
      const fn = () => {
        const elapsed = performance.now() - startT;
        const t = Math.min(1, elapsed / durationMs);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        stripContainer.y = startY + (endY - startY) * eased;
        // tick sound as it scrolls
        const idx = Math.floor(stripContainer.y / reelH);
        if (idx !== lastTickIdx && t < 0.9) {
          lastTickIdx = idx;
          if (Math.random() < 0.3) sfx.tick();
        }
        if (t >= 1) {
          pixiApp.ticker.remove(fn);
          // mask to reel area
          const mask = new PIXI.Graphics();
          mask.beginFill(0xffffff).drawRoundedRect(0, 0, reelW, reelH, 12).endFill();
          rc.addChild(mask);
          stripContainer.mask = mask;
          if (flaked) {
            // show a flaked-out overlay (dim + "0")
            const overlay = new PIXI.Graphics();
            overlay.beginFill(0x000000, 0.7).drawRoundedRect(0, 0, reelW, reelH, 12).endFill();
            rc.addChild(overlay);
            const flakeTx = new PIXI.Text("FLAKED", {
              fontFamily: "Outfit, system-ui, sans-serif",
              fontSize: 14, fontWeight: "900", fill: 0xff5d5d, align: "center"
            });
            flakeTx.anchor.set(0.5);
            flakeTx.x = reelW/2; flakeTx.y = reelH/2;
            rc.addChild(flakeTx);
          }
          resolve();
        }
      };
      pixiApp.ticker.add(fn);
    });
  }

  function clearFloor() {
    sfx.big();
    // bonus chips = floor_score
    const bonus = S.floorScore;
    store.pay(bonus);
    host.onWin("big", bonus, {
      title: t("floorSlots.victory"),
      line: FLOORS[S.floorIdx].name + " cleared."
    });
    // open shop
    openShop();
  }

  function endFloor() {
    sfx.lose();
    S.runEnded = true;
    // convert floor_score to chips as consolation
    const consolation = Math.floor(S.floorScore * 0.5);
    if (consolation > 0) store.pay(consolation);
    host.toast(t("floorSlots.gameOver") + " Got " + consolation + " chips back.", 4000);
    setTimeout(() => {
      // reset run
      S.floorIdx = 0;
      S.spinsLeft = 12;
      S.floorScore = 0;
      S.target = FLOORS[0].target;
      S.boss = FLOORS[0].boss;
      S.runEnded = false;
      updateHeader();
      drawBossBanner();
      drawOwnedStrip();
    }, 2500);
  }

  function openShop() {
    // simple shop modal: 3 vibes + 3 divas to hire
    const modal = new PIXI.Container();
    modal.x = W/2;
    modal.y = H/2;
    c.addChild(modal);
    const modalBg = new PIXI.Graphics();
    modalBg.beginFill(0x000000, 0.85).drawRect(-W/2, -H/2, W, H).endFill();
    modalBg.interactive = true;
    modal.addChild(modalBg);

    const cardBg = new PIXI.Graphics();
    cardBg.beginFill(0x1c0e2a, 0.98).drawRoundedRect(-W*0.4, -H*0.4, W*0.8, H*0.8, 16).endFill();
    modal.addChild(cardBg);

    const title = new PIXI.Text("THE SHOP", {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 24, fontStyle: "italic", fontWeight: "900", fill: 0xf2c76e
    });
    title.anchor.set(0.5, 0);
    title.x = 0; title.y = -H*0.38;
    modal.addChild(title);

    const sub = new PIXI.Text("Hire a diva or pick a vibe for the next floor.", {
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize: 12, fontWeight: "400", fill: 0xff2e88, align: "center"
    });
    sub.anchor.set(0.5, 0);
    sub.x = 0; sub.y = -H*0.32;
    modal.addChild(sub);

    // pick 3 divas not in owned
    const notOwned = DIVA_IDS.filter(id => !S.owned.includes(id));
    const shopDivas = [...notOwned].sort(() => Math.random() - 0.5).slice(0, 3);
    // pick 3 vibes not owned
    const notOwnedVibes = Object.values(VIBES).filter(v => !S.vibes.includes(v.id));
    const shopVibes = [...notOwnedVibes].sort(() => Math.random() - 0.5).slice(0, 3);

    let y = -H * 0.25;
    shopDivas.forEach(divaId => {
      const diva = DIVAS[divaId];
      const row = new PIXI.Container();
      row.x = -W*0.35;
      row.y = y;
      modal.addChild(row);
      // photo
      PIXI.Assets.load(friendPhoto(divaId, 0)).then(tex => {
        const sp = new PIXI.Sprite(tex);
        const sz = 48;
        const scale = sz / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = 0; sp.y = 0;
        row.addChild(sp);
      });
      const name = new PIXI.Text(diva.name + " (" + diva.title + ")", {
        fontFamily: "Outfit, system-ui, sans-serif",
        fontSize: 12, fontWeight: "700", fill: 0xffe9b8
      });
      name.x = 60; name.y = 0;
      row.addChild(name);
      const rule = new PIXI.Text(diva.rule, {
        fontFamily: "Outfit, system-ui, sans-serif",
        fontSize:12, fontWeight: "400", fill: 0xb0b0b0,
        wordWrap: true, wordWrapWidth: W * 0.5
      });
      rule.x = 60; rule.y = 16;
      row.addChild(rule);
      const hireBtn = makeButton(80, 30, t("floorSlots.hire", { name: diva.name }).split(" ").slice(-2).join(" ") || "HIRE", 0xf2c76e, 0x160b20);
      hireBtn.x = W*0.32; hireBtn.y = 12;
      hireBtn.interactive = true; hireBtn.buttonMode = true;
      hireBtn.on("pointertap", () => {
        if (store.state.bank >= diva.price) {
          store.bet(diva.price);
          S.owned.push(divaId);
          sfx.chip();
          c.removeChild(modal);
          nextFloor();
        } else {
          host.toast(t("toast.betTooHigh"));
        }
      });
      row.addChild(hireBtn);
      y += 80;
    });

    shopVibes.forEach(vibe => {
      const row = new PIXI.Container();
      row.x = -W*0.35;
      row.y = y;
      modal.addChild(row);
      const name = new PIXI.Text(vibe.name + " (vibe)", {
        fontFamily: "Outfit, system-ui, sans-serif",
        fontSize: 12, fontWeight: "700", fill: 0xffe9b8
      });
      name.x = 60; name.y = 0;
      row.addChild(name);
      const rule = new PIXI.Text(vibe.rule, {
        fontFamily: "Outfit, system-ui, sans-serif",
        fontSize:12, fontWeight: "400", fill: 0xb0b0b0,
        wordWrap: true, wordWrapWidth: W * 0.5
      });
      rule.x = 60; rule.y = 16;
      row.addChild(rule);
      const buyBtn = makeButton(80, 30, "BUY " + vibe.price, 0x9d4edd, 0xffffff);
      buyBtn.x = W*0.32; buyBtn.y = 12;
      buyBtn.interactive = true; buyBtn.buttonMode = true;
      buyBtn.on("pointertap", () => {
        if (store.state.bank >= vibe.price) {
          store.bet(vibe.price);
          S.vibes.push(vibe.id);
          sfx.chip();
          c.removeChild(modal);
          nextFloor();
        } else {
          host.toast(t("toast.betTooHigh"));
        }
      });
      row.addChild(buyBtn);
      y += 70;
    });

    // skip button
    const skipBtn = makeButton(120, 36, t("floorSlots.skip"), 0x333333, 0xffffff);
    skipBtn.x = 0; skipBtn.y = H*0.35;
    skipBtn.interactive = true; skipBtn.buttonMode = true;
    skipBtn.on("pointertap", () => { sfx.click(); c.removeChild(modal); nextFloor(); });
    modal.addChild(skipBtn);
  }

  function nextFloor() {
    S.floorIdx++;
    if (S.floorIdx >= FLOORS.length) {
      // game complete — victory
      sfx.jackpot();
      const win = 5000;
      store.pay(win);
      host.onWin("jackpot", win, { title: "DEN CONQUERED", line: "All 5 floors cleared. The squad salutes you." });
      setTimeout(() => {
        S.floorIdx = 0;
        S.spinsLeft = 12;
        S.floorScore = 0;
        S.target = FLOORS[0].target;
        S.boss = FLOORS[0].boss;
        updateHeader();
        drawBossBanner();
        drawOwnedStrip();
      }, 4000);
      return;
    }
    S.spinsLeft = 12;
    S.floorScore = 0;
    S.target = FLOORS[S.floorIdx].target;
    S.boss = FLOORS[S.floorIdx].boss;
    if (S.boss) {
      host.toast(t("floorSlots.bossArrives", { name: BOSSES[S.boss].name }), 3000);
    }
    updateHeader();
    drawBossBanner();
    drawOwnedStrip();
  }

  return function cleanup() {};
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 8).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 12, fontWeight: "700", fill: fg, align: "center"
  });
  tx.anchor.set(0.5);
  tx.x = w/2; tx.y = h/2;
  c.addChild(tx);
  return c;
}
