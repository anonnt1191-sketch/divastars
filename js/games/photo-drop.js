// games/photo-drop.js — Pick a diva. She drops a photo from her camera roll.
// If photo matches target composition (red dress / golden hour / etc), win her multiplier.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { CAST_LIST } from "../core/app.js";
import { castPick, castToPhotoURL } from "../core/photos.js";

const COMPOSITIONS = [
  { id:"red-dress", label:"Red Dress", match: cast => cast.id === "kajal" || cast.id === "soumya", mult: 5 },
  { id:"golden-hour", label:"Golden Hour", match: cast => cast.id === "kanchan" || cast.id === "sunita", mult: 4 },
  { id:"iconic-fit", label:"Iconic Fit", match: cast => cast.id === "nikki", mult: 6 },
  { id:"gold-everything", label:"Gold Everything", match: cast => cast.id === "nitz", mult: 5 },
  { id:"red-carpet", label:"Red Carpet", match: cast => cast.id === "vedhika", mult: 10 },
  { id:"late-night", label:"Late Night", match: cast => cast.id === "shalini" || cast.id === "ann", mult: 4 },
  { id:"chaos", label:"Chaos Energy", match: cast => cast.id === "kallie", mult: 8 },
];

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

  // pick composition
  let target = COMPOSITIONS[Math.floor(Math.random() * COMPOSITIONS.length)];

  // target display
  const targetText = new PIXI.Text(`Target: ${target.label} (${target.mult}x)`, {
    fontFamily:"Outfit, sans-serif",fontSize:16,fontWeight:"700",fill:0xf2c76e,align:"center"
  });
  targetText.anchor.set(0.5,0); targetText.x = W/2; targetText.y = 36;
  c.addChild(targetText);

  // diva picker — 3 divas to choose from
  const used = new Set();
  const divas = [];
  for (let i = 0; i < 3; i++) {
    const cast = castPick(CAST_LIST, used);
    used.add(cast.key);
    divas.push(cast);
  }

  const pickY = 80;
  const cardW = (W - 32) / 3;
  const cardH = 140;
  const divaCards = [];
  divas.forEach((cast, i) => {
    const card = new PIXI.Container();
    card.x = 8 + i * (cardW + 8);
    card.y = pickY;
    const cardBg = new PIXI.Graphics();
    cardBg.beginFill(0x1c0e2a).drawRoundedRect(0, 0, cardW, cardH, 12).endFill();
    cardBg.lineStyle(2, 0xf2c76e, 0.4).drawRoundedRect(0, 0, cardW, cardH, 12).endFill();
    card.addChild(cardBg);
    // photo
    const url = castToPhotoURL(cast);
    PIXI.Assets.load(url).then(tex => {
      if (!tex || card.destroyed) return;
      const sp = new PIXI.Sprite(tex);
      const sz = cardW - 12;
      const scale = sz / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.x = (cardW - tex.width*scale)/2;
      sp.y = 8;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(6, 6, cardW-12, cardH-40, 8).endFill();
      card.addChild(mask);
      sp.mask = mask;
      card.addChild(sp);
    }).catch(()=>{});
    const nameTx = new PIXI.Text(cast.name, {
      fontFamily:"Outfit, sans-serif",fontSize:12,fontWeight:"700",fill:0xffe9b8,align:"center"
    });
    nameTx.anchor.set(0.5,1); nameTx.x = cardW/2; nameTx.y = cardH - 4;
    card.addChild(nameTx);
    card.interactive = true; card.buttonMode = true;
    card.cast = cast;
    card.on("pointertap", () => pickDiva(i));
    c.addChild(card);
    divaCards.push(card);
  });

  // drop area
  const dropY = pickY + cardH + 16;
  const dropSize = Math.min(W - 60, 240);
  const dropX = W/2 - dropSize/2;
  const dropContainer = new PIXI.Container();
  dropContainer.x = dropX; dropContainer.y = dropY;
  c.addChild(dropContainer);

  const dropHint = new PIXI.Text("Pick a diva above to drop a photo", {
    fontFamily:"Outfit, sans-serif",fontSize:14,fontStyle:"italic",fill:0xb0b0b0,align:"center"
  });
  dropHint.anchor.set(0.5); dropHint.x = dropSize/2; dropHint.y = dropSize/2;
  dropContainer.addChild(dropHint);

  // result text
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit, sans-serif",fontSize:18,fontWeight:"900",fill:0xf2c76e,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = dropY + dropSize + 12;
  c.addChild(resultText);

  let curBet = 25;
  let picked = false;

  async function pickDiva(idx) {
    if (picked) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    picked = true;
    divaCards.forEach(card => card.interactive = false);
    dropContainer.removeChildren();
    const cast = divaCards[idx].cast;
    // pick a random photo of this diva
    const url = castToPhotoURL(cast);
    try {
      const tex = await PIXI.Assets.load(url);
      const sp = new PIXI.Sprite(tex);
      const scale = dropSize / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.x = (dropSize - tex.width*scale)/2;
      sp.y = (dropSize - tex.height*scale)/2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(0, 0, dropSize, dropSize, 16).endFill();
      dropContainer.addChild(mask);
      sp.mask = mask;
      dropContainer.addChild(sp);
      const border = new PIXI.Graphics();
      border.lineStyle(3, 0xf2c76e, 1).drawRoundedRect(0, 0, dropSize, dropSize, 16).endFill();
      dropContainer.addChild(border);
    } catch(e) {}

    sfx.reveal();
    await new Promise(r => setTimeout(r, 800));

    // check match
    const match = target.match(cast);
    if (match) {
      const win = Math.floor(curBet * target.mult);
      store.pay(win);
      store.record(game.id, curBet, win);
      sfx.win();
      resultText.text = `MATCH! ${target.label} · +${win}`;
      host.onWin(target.mult >= 8 ? "big" : "win", win, {
        title: `${target.label} · ${target.mult}x`,
        line: cast.name + " delivered the shot."
      });
    } else {
      store.record(game.id, curBet, 0);
      sfx.lose();
      resultText.text = `No match. ${cast.name} didn't fit ${target.label}.`;
    }

    // offer new round
    setTimeout(() => {
      host.app.backToLobby();
      host.app.openGame("photo-drop");
    }, 3000);
  }

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 60;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; }));

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}
