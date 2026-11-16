// games/memory.js — Memory Match. 16 cards (4x4) with 8 diva photos. Find pairs.
// Each pair pays +15%, clearing the whole board pays +60%, every combo step adds +5%.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { CAST_LIST } from "../core/app.js";
import { castPick, castToPhotoURL } from "../core/photos.js";

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

  // pick 8 unique divas for pairs
  const used = new Set();
  const pairs = [];
  for (let i = 0; i < 8; i++) {
    const cast = castPick(CAST_LIST, used);
    used.add(cast.key);
    pairs.push(cast, {...cast});  // 2 copies
  }
  // shuffle
  for (let i = pairs.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [pairs[i],pairs[j]] = [pairs[j],pairs[i]];
  }

  // grid 4x4
  const cols = 4;
  const cellSize = Math.min((W - 24) / cols, 100);
  const gridW = cellSize * cols;
  const gridX = (W - gridW) / 2;
  const gridY = 50;

  // state
  let flipped = []; // indices of currently flipped cards
  let matched = new Set();
  let combo = 0;
  let totalMatches = 0;
  let curBet = 25;
  let started = false;

  // payout display
  const payoutText = new PIXI.Text("Tap a card to start", {
    fontFamily:"Outfit, sans-serif",fontSize:15,fontWeight:"700",fill:0xffe9b8,align:"center"
  });
  payoutText.anchor.set(0.5,0); payoutText.x = W/2; payoutText.y = gridY + 4 * cellSize + 16;
  c.addChild(payoutText);

  // build cards
  const cards = [];
  for (let i = 0; i < 16; i++) {
    const row = Math.floor(i/4), col = i % 4;
    const x = gridX + col * cellSize;
    const y = gridY + row * cellSize;
    const cardContainer = new PIXI.Container();
    cardContainer.x = x; cardContainer.y = y;
    // face down (back)
    const back = new PIXI.Graphics();
    back.beginFill(0x7c1d3f).drawRoundedRect(0, 0, cellSize-4, cellSize-4, 8).endFill();
    back.beginFill(0xf2c76e, 0.5).drawRoundedRect(4, 4, cellSize-12, cellSize-12, 6).endFill();
    back.beginFill(0xff2e88).drawCircle((cellSize-4)/2, (cellSize-4)/2, 12).endFill();
    back.interactive = true;
    back.buttonMode = true;
    cardContainer.addChild(back);
    cardContainer.backGfx = back;
    cardContainer.cast = pairs[i];
    cardContainer.idx = i;
    c.addChild(cardContainer);
    cards.push(cardContainer);

    back.on("pointertap", () => flipCard(i));
  }

  async function flipCard(idx) {
    if (matched.has(idx) || flipped.includes(idx) || flipped.length >= 2) return;
    if (!started) {
      if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
      started = true;
      payoutText.text = "Find the pairs!";
    }
    sfx.card();
    flipped.push(idx);
    // flip animation: scale x to 0, swap back/photo, scale back to 1
    const card = cards[idx];
    card.backGfx.visible = false;
    const url = castToPhotoURL(card.cast);
    try {
      const tex = await PIXI.Assets.load(url);
      if (tex && !card.destroyed) {
        const photo = new PIXI.Sprite(tex);
        const scale = (cellSize - 8) / Math.max(tex.width, tex.height);
        photo.scale.set(scale);
        photo.x = (cellSize - 4 - tex.width*scale)/2;
        photo.y = (cellSize - 4 - tex.height*scale)/2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(0, 0, cellSize-4, cellSize-4, 8).endFill();
        card.addChild(mask);
        photo.mask = mask;
        card.addChild(photo);
        card.photo = photo;
      }
    } catch(e) {}

    if (flipped.length === 2) {
      await new Promise(r => setTimeout(r, 600));
      const [a, b] = flipped;
      if (cards[a].cast.key === cards[b].cast.key) {
        // match!
        matched.add(a); matched.add(b);
        totalMatches++;
        combo++;
        sfx.pop();
        // pulse matched cards
        for (const i of [a, b]) {
          const goldRing = new PIXI.Graphics();
          goldRing.lineStyle(3, 0xffd700, 1).drawRoundedRect(0, 0, cellSize-4, cellSize-4, 8).endFill();
          cards[i].addChild(goldRing);
        }
        const mult = 0.15 + combo * 0.05;
        const win = Math.floor(curBet * mult);
        store.pay(win);
        sfx.coin();
        payoutText.text = `Match! +${win} (combo ${combo})`;
      } else {
        // miss — flip back
        combo = 0;
        sfx.lose();
        for (const i of [a, b]) {
          const card = cards[i];
          if (card.photo) { card.removeChild(card.photo); card.photo.destroy(); card.photo = null; }
          card.backGfx.visible = true;
        }
        payoutText.text = "No match. Combo reset.";
      }
      flipped = [];
      // check completion
      if (matched.size === 16) {
        const bonus = Math.floor(curBet * 0.6);
        store.pay(bonus);
        sfx.jackpot();
        host.onWin("jackpot", bonus + curBet, {
          title: "BOARD CLEARED",
          line: "Every diva found her pair."
        });
        payoutText.text = `BOARD CLEARED! +${bonus} bonus`;
        setTimeout(() => {
          host.app.backToLobby();
          host.app.openGame("memory");
        }, 3500);
      } else if (matched.size === 14) {
        // 7/8 pairs done — show progress
        payoutText.text = `7/8 pairs. One more to clear.`;
      }
    }
  }

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 100;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; }));

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}
