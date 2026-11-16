// games/coin-flip.js — Heads or tails. Photo coins. Simple 50/50 with x1.9 payout.

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
  bg.beginFill(0x120818, 0.75).drawRect(0,0,W,H).endFill();
  c.addChild(bg);

  const tagline = new PIXI.Text(game.tagline || game.blurb, {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xff2e88
  });
  tagline.x = 8; tagline.y = 6;
  c.addChild(tagline);

  // pick 2 cast entries for heads/tails
  const headsCast = SESSION.crashPilots[Math.floor(Math.random()*SESSION.crashPilots.length)];
  let tailsCast;
  do { tailsCast = SESSION.crashPilots[Math.floor(Math.random()*SESSION.crashPilots.length)]; }
  while (tailsCast.key === headsCast.key);

  // pick side
  let pickedSide = "heads";
  const pickY = 50;
  const pickLabel = new PIXI.Text("Pick your side:", {
    fontFamily:"Outfit, sans-serif",fontSize:15,fontWeight:"700",fill:0xffe9b8
  });
  pickLabel.anchor.set(0.5,0); pickLabel.x = W/2; pickLabel.y = pickY;
  c.addChild(pickLabel);

  const btnW = (W - 24) / 2;
  const headsBtn = makeButton(btnW, 70, "HEADS\n" + headsCast.name, pickedSide==="heads"?0xf2c76e:0x1c0e2a, pickedSide==="heads"?0x160b20:0xffffff);
  headsBtn.x = 8; headsBtn.y = pickY + 30;
  headsBtn.interactive = true; headsBtn.buttonMode = true;
  c.addChild(headsBtn);
  const tailsBtn = makeButton(btnW, 70, "TAILS\n" + tailsCast.name, pickedSide==="tails"?0xf2c76e:0x1c0e2a, pickedSide==="tails"?0x160b20:0xffffff);
  tailsBtn.x = 8 + btnW + 8; tailsBtn.y = pickY + 30;
  tailsBtn.interactive = true; tailsBtn.buttonMode = true;
  c.addChild(tailsBtn);

  function toggleSide(side) {
    sfx.click();
    pickedSide = side;
    headsBtn.children[0].clear();
    headsBtn.children[0].beginFill(pickedSide==="heads"?0xf2c76e:0x1c0e2a).drawRoundedRect(0,0,btnW,70,12).endFill();
    headsBtn.children[1].style.fill = pickedSide==="heads"?0x160b20:0xffffff;
    tailsBtn.children[0].clear();
    tailsBtn.children[0].beginFill(pickedSide==="tails"?0xf2c76e:0x1c0e2a).drawRoundedRect(0,0,btnW,70,12).endFill();
    tailsBtn.children[1].style.fill = pickedSide==="tails"?0x160b20:0xffffff;
  }
  headsBtn.on("pointertap", () => toggleSide("heads"));
  tailsBtn.on("pointertap", () => toggleSide("tails"));

  // coin display (large, center)
  const coinY = pickY + 120;
  const coinSize = Math.min(W - 80, 220);
  const coinX = W/2 - coinSize/2;
  const coinContainer = new PIXI.Container();
  coinContainer.x = coinX; coinContainer.y = coinY;
  c.addChild(coinContainer);

  // coin bg (gold disc)
  const coinBg = new PIXI.Graphics();
  coinBg.beginFill(0xf2c76e).drawCircle(coinSize/2, coinSize/2, coinSize/2).endFill();
  coinBg.beginFill(0x160b20).drawCircle(coinSize/2, coinSize/2, coinSize/2 - 4).endFill();
  coinContainer.addChild(coinBg);

  // photo (initially heads)
  let coinPhoto = null;
  async function loadCoinPhoto(side) {
    if (coinPhoto) { coinContainer.removeChild(coinPhoto); coinPhoto.destroy(); }
    const cast = side === "heads" ? headsCast : tailsCast;
    const url = castToPhotoURL(cast);
    try {
      const tex = await PIXI.Assets.load(url);
      coinPhoto = new PIXI.Sprite(tex);
      const sz = coinSize - 24;
      const scale = sz / Math.max(tex.width, tex.height);
      coinPhoto.scale.set(scale);
      coinPhoto.x = (coinSize - tex.width*scale)/2;
      coinPhoto.y = (coinSize - tex.height*scale)/2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawCircle(coinSize/2, coinSize/2, sz/2).endFill();
      coinContainer.addChild(mask);
      coinPhoto.mask = mask;
      coinContainer.addChild(coinPhoto);
    } catch(e) {}
  }
  loadCoinPhoto("heads");

  // result text
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit, sans-serif",fontSize:18,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = coinY + coinSize + 12;
  c.addChild(resultText);

  // bet row
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; }));

  const flipBtn = makeButton(W-16, 60, "FLIP · "+curBet, 0xf2c76e, 0x160b20);
  flipBtn.x = 8; flipBtn.y = H - 60;
  flipBtn.interactive = true; flipBtn.buttonMode = true;
  c.addChild(flipBtn);

  let flipping = false;
  flipBtn.on("pointertap", async () => {
    if (flipping) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    flipping = true;
    flipBtn.interactive = false;
    resultText.text = "";
    sfx.whoosh();
    // flip animation — oscillate the coin photo between heads/tails, with rotation
    const flipDuration = 1500;
    const flipStart = performance.now();
    await new Promise(r => {
      const fn = async () => {
        const elapsed = performance.now() - flipStart;
        if (elapsed < flipDuration) {
          // alternate photo
          const side = Math.floor(elapsed / 100) % 2 === 0 ? "heads" : "tails";
          await loadCoinPhoto(side);
          coinContainer.rotation = elapsed * 0.02;
          setTimeout(fn, 100);
        } else { r(); }
      };
      fn();
    });
    coinContainer.rotation = 0;
    const result = Math.random() < 0.5 ? "heads" : "tails";
    await loadCoinPhoto(result);
    sfx.bonk();
    await new Promise(r => setTimeout(r, 600));
    if (pickedSide === result) {
      const win = Math.floor(curBet * 1.9);
      store.pay(win);
      store.record(game.id, curBet, win);
      sfx.win();
      resultText.text = `${result.toUpperCase()} — +${win}`;
      host.onWin("win", win, {
        title: result.toUpperCase() + " wins",
        line: (result === "heads" ? headsCast : tailsCast).name + " came through."
      });
    } else {
      store.record(game.id, curBet, 0);
      sfx.lose();
      resultText.text = `${result.toUpperCase()} — lost ${curBet}`;
    }
    flipBtn.interactive = true;
    flipping = false;
  });

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

function makeButton(w,h,label,bg,fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0,0,w,h,12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:15,fontWeight:"700",fill:fg,align:"center"});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
