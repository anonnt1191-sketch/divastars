// games/sic-bo.js — Three dice. Photo faces on each die.
// Bets: Big (11-17, x1), Small (4-10, x1), Odd (x1), Even (x1), Specific triple (x24), Any triple (x8), Single die (x1/x2/x3), Sum (varies).

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { castToPhotoURL } from "../core/photos.js";

// pick 6 cast entries to put on the dice faces
const DICE_CASTS = SESSION.crashPilots.slice(0, 6);

export async function mount(host) {
  const { pixiApp, stage, width: W, height: H, game } = host;
  const c = new PIXI.Container();
  stage.addChild(c);

  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818, 0.75).drawRect(0,0,W,H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline, {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // dice display area
  const diceY = 40;
  const diceSize = 100;
  const diceContainers = [];

  for (let i = 0; i < 3; i++) {
    const dc = new PIXI.Container();
    dc.x = W/2 - diceSize*1.5 - 8 + i * (diceSize + 8);
    dc.y = diceY;
    c.addChild(dc);
    diceContainers.push(dc);
  }

  async function renderDice(faces) {
    for (let i = 0; i < 3; i++) {
      const dc = diceContainers[i];
      dc.removeChildren();
      // dice bg
      const dbg = new PIXI.Graphics();
      dbg.beginFill(0xffe9b8).drawRoundedRect(0, 0, diceSize, diceSize, 12).endFill();
      dc.addChild(dbg);
      // photo for face
      const cast = DICE_CASTS[faces[i]-1];
      const url = castToPhotoURL(cast);
      try {
        const tex = await PIXI.Assets.load(url);
        const sp = new PIXI.Sprite(tex);
        const sz = diceSize - 16;
        const scale = sz / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = (diceSize - tex.width*scale)/2;
        sp.y = (diceSize - tex.height*scale)/2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(8, 8, diceSize-16, diceSize-16, 8).endFill();
        dc.addChild(mask);
        sp.mask = mask;
        dc.addChild(sp);
      } catch(e) {}
      // number badge
      const badge = new PIXI.Graphics();
      badge.beginFill(0x160b20).drawRoundedRect(diceSize-24, diceSize-24, 20, 20, 4).endFill();
      dc.addChild(badge);
      const n = new PIXI.Text(String(faces[i]), {fontFamily:"Outfit",fontSize:12,fontWeight:"900",fill:0xffe9b8});
      n.anchor.set(0.5); n.x = diceSize-14; n.y = diceSize-14;
      dc.addChild(n);
    }
  }
  // initial render
  await renderDice([1,1,1]);

  // result text
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit",fontSize:16,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center",
    wordWrap:true,wordWrapWidth:W-16
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = diceY + diceSize + 16;
  c.addChild(resultText);

  // bet selection
  const betsY = diceY + diceSize + 60;
  const betOptions = [
    {id:"small", label:"SMALL\n4-10", mult:1},
    {id:"big", label:"BIG\n11-17", mult:1},
    {id:"odd", label:"ODD", mult:1},
    {id:"even", label:"EVEN", mult:1},
    {id:"triple-any", label:"ANY\nTRIPLE\nx8", mult:8},
    {id:"triple-1", label:"3xONE\nx24", mult:24},
    {id:"triple-6", label:"3xSIX\nx24", mult:24},
    {id:"single-1", label:"ANY 1\nx1-x3", mult:0}
  ];
  let pickedBet = "small";
  const btnW = (W - 24) / 4;
  const btnH = 50;
  const betBtns = [];
  betOptions.forEach((b, i) => {
    const col = b.id === pickedBet ? 0xf2c76e : 0x1c0e2a;
    const fg = b.id === pickedBet ? 0x160b20 : 0xffffff;
    const btn = makeButton(btnW, btnH, b.label, col, fg);
    btn.x = 8 + (i % 4) * (btnW + 4);
    btn.y = betsY + Math.floor(i / 4) * (btnH + 4);
    btn.interactive = true; btn.buttonMode = true;
    btn.on("pointertap", () => {
      sfx.click();
      pickedBet = b.id;
      betBtns.forEach((x, j) => {
        const bb = betOptions[j];
        x.children[0].clear();
        x.children[0].beginFill(bb.id === pickedBet ? 0xf2c76e : 0x1c0e2a).drawRoundedRect(0,0,btnW,btnH,8).endFill();
        x.children[1].style.fill = bb.id === pickedBet ? 0x160b20 : 0xffffff;
      });
    });
    betBtns.push(btn);
    c.addChild(btn);
  });

  // bet row
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; }));

  const rollBtn = makeButton(W-16, 50, "ROLL · "+curBet, 0xf2c76e, 0x160b20);
  rollBtn.x = 8; rollBtn.y = H - 50;
  rollBtn.interactive = true; rollBtn.buttonMode = true;
  c.addChild(rollBtn);

  let rolling = false;
  rollBtn.on("pointertap", async () => {
    if (rolling) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    rolling = true;
    rollBtn.interactive = false;
    resultText.text = "";

    // roll animation — flicker faces for 1.5s
    sfx.whoosh();
    const flickerStart = performance.now();
    await new Promise(resolve => {
      const fn = async () => {
        const elapsed = performance.now() - flickerStart;
        if (elapsed < 1500) {
          await renderDice([1+Math.floor(Math.random()*6), 1+Math.floor(Math.random()*6), 1+Math.floor(Math.random()*6)]);
          setTimeout(fn, 80);
        } else {
          resolve();
        }
      };
      fn();
    });

    // final result
    const faces = [1+Math.floor(Math.random()*6), 1+Math.floor(Math.random()*6), 1+Math.floor(Math.random()*6)];
    await renderDice(faces);
    sfx.bonk();
    await wait(500);

    const sum = faces[0] + faces[1] + faces[2];
    const isTriple = faces[0] === faces[1] && faces[1] === faces[2];
    const isOdd = sum % 2 === 1;
    const isBig = sum >= 11 && sum <= 17;
    const isSmall = sum >= 4 && sum <= 10;

    let win = 0;
    let label = "";
    if (pickedBet === "small" && isSmall && !isTriple) { win = curBet*2; label = "SMALL wins!"; }
    else if (pickedBet === "big" && isBig && !isTriple) { win = curBet*2; label = "BIG wins!"; }
    else if (pickedBet === "odd" && isOdd && !isTriple) { win = curBet*2; label = "ODD wins!"; }
    else if (pickedBet === "even" && !isOdd && !isTriple) { win = curBet*2; label = "EVEN wins!"; }
    else if (pickedBet === "triple-any" && isTriple) { win = curBet*8; label = "ANY TRIPLE!"; }
    else if (pickedBet === "triple-1" && isTriple && faces[0]===1) { win = curBet*24; label = "TRIPLE 1!"; }
    else if (pickedBet === "triple-6" && isTriple && faces[0]===6) { win = curBet*24; label = "TRIPLE 6!"; }
    else if (pickedBet === "single-1") {
      const count = faces.filter(f => f === 1).length;
      if (count > 0) { win = curBet * count; label = `${count}x ONE — ${count}x payout`; }
    }
    // triples lose all non-triple bets (house edge)

    if (win > 0) {
      store.pay(win);
      sfx.win();
      resultText.text = `${label} +${win} (sum: ${sum})`;
      host.onWin(win >= curBet*8 ? "big" : "win", win, {title:label, line:`Roll: ${faces.join("+")} = ${sum}`});
    } else {
      sfx.lose();
      resultText.text = `Lost. Roll: ${faces.join("+")} = ${sum}${isTriple?" (TRIPLE)":""}`;
    }
    store.record(game.id, curBet, win);
    rollBtn.interactive = true;
    rolling = false;
  });

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeButton(w,h,label,bg,fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0,0,w,h,8).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:12,fontWeight:"700",fill:fg,align:"center"});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
