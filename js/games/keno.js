// games/keno.js — Pick 10 numbers from 1-40. The game draws 10 random numbers.
// Match count pays: 0=x0, 1=x0, 2=x0, 3=x1, 4=x2, 5=x5, 6=x10, 7=x25, 8=x50, 9=x100, 10=x500.
// Photos of divas appear as draw balls.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { castToPhotoURL } from "../core/photos.js";

const MAX_NUM = 40;
const PICK_COUNT = 10;
const PAYOUTS = [0, 0, 0, 1, 2, 5, 10, 25, 50, 100, 500];

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

  // pick state
  let picked = new Set();
  let drawn = new Set();
  let curBet = 25;
  let drawing = false;

  // number grid (5x8 = 40)
  const gridStartY = 40;
  const cellSize = Math.min((W - 16) / 8, 38);
  const gridW = cellSize * 8;
  const gridX = (W - gridW) / 2;
  const cells = [];
  for (let n = 1; n <= MAX_NUM; n++) {
    const row = Math.floor((n-1)/8), col = (n-1)%8;
    const x = gridX + col * cellSize;
    const y = gridStartY + row * cellSize;
    const cellGfx = new PIXI.Container();
    cellGfx.x = x; cellGfx.y = y;
    const bgGfx = new PIXI.Graphics();
    bgGfx.beginFill(0x1c0e2a).drawRoundedRect(0, 0, cellSize-3, cellSize-3, 6).endFill();
    cellGfx.addChild(bgGfx);
    const tx = new PIXI.Text(String(n), {
      fontFamily:"Outfit, sans-serif",fontSize:14,fontWeight:"700",fill:0xffe9b8
    });
    tx.anchor.set(0.5); tx.x = (cellSize-3)/2; tx.y = (cellSize-3)/2;
    cellGfx.addChild(tx);
    cellGfx.interactive = true;
    cellGfx.buttonMode = true;
    cellGfx.on("pointertap", () => togglePick(n));
    c.addChild(cellGfx);
    cells.push({ n, gfx: cellGfx, bg: bgGfx, tx });
  }

  function togglePick(n) {
    if (drawing) return;
    sfx.click();
    if (picked.has(n)) {
      picked.delete(n);
      cells[n-1].bg.clear();
      cells[n-1].bg.beginFill(0x1c0e2a).drawRoundedRect(0, 0, cellSize-3, cellSize-3, 6).endFill();
      cells[n-1].tx.style.fill = 0xffe9b8;
    } else {
      if (picked.size >= PICK_COUNT) {
        host.toast(`Max ${PICK_COUNT} picks. Unpick one first.`, 1800);
        return;
      }
      picked.add(n);
      cells[n-1].bg.clear();
      cells[n-1].bg.beginFill(0xf2c76e).drawRoundedRect(0, 0, cellSize-3, cellSize-3, 6).endFill();
      cells[n-1].tx.style.fill = 0x160b20;
    }
    pickedCountText.text = `Picked: ${picked.size} / ${PICK_COUNT}`;
    drawBtn.interactive = picked.size === PICK_COUNT;
    drawBtn.alpha = picked.size === PICK_COUNT ? 1 : 0.5;
  }

  // picked count
  const pickedCountText = new PIXI.Text(`Picked: 0 / ${PICK_COUNT}`, {
    fontFamily:"Outfit, sans-serif",fontSize:15,fontWeight:"700",fill:0xffe9b8,align:"center"
  });
  pickedCountText.anchor.set(0.5,0); pickedCountText.x = W/2;
  pickedCountText.y = gridStartY + 5 * cellSize + 12;
  c.addChild(pickedCountText);

  // draw balls area — photos of drawn numbers
  const ballsY = pickedCountText.y + 28;
  const ballSize = 50;
  const ballsContainer = new PIXI.Container();
  ballsContainer.x = 8; ballsContainer.y = ballsY;
  c.addChild(ballsContainer);
  const ballsLabel = new PIXI.Text("Draws:", {
    fontFamily:"Outfit, sans-serif",fontSize:13,fontWeight:"700",fill:0x9d4edd
  });
  ballsLabel.x = 0; ballsLabel.y = 0;
  ballsContainer.addChild(ballsLabel);

  // result text
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit, sans-serif",fontSize:16,fontWeight:"900",fill:0xffe9b8,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = ballsY + 60;
  c.addChild(resultText);

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; }));

  const drawBtn = makeButton(W-16, 60, "DRAW · "+curBet, 0xf2c76e, 0x160b20);
  drawBtn.x = 8; drawBtn.y = H - 60;
  drawBtn.interactive = false;
  drawBtn.alpha = 0.5;
  drawBtn.buttonMode = true;
  c.addChild(drawBtn);

  drawBtn.on("pointertap", async () => {
    if (drawing || picked.size !== PICK_COUNT) return;
    sfx.click();
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    drawing = true;
    drawBtn.interactive = false;
    drawn = new Set();
    ballsContainer.removeChildren();
    ballsContainer.addChild(ballsLabel);
    sfx.whoosh();
    // draw 10 unique numbers
    const allNums = [];
    for (let n = 1; n <= MAX_NUM; n++) allNums.push(n);
    for (let i = allNums.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [allNums[i],allNums[j]] = [allNums[j],allNums[i]];
    }
    const draws = allNums.slice(0, PICK_COUNT);
    for (let i = 0; i < draws.length; i++) {
      const n = draws[i];
      drawn.add(n);
      // mark cell
      const cell = cells[n-1];
      if (picked.has(n)) {
        cell.bg.clear();
        cell.bg.beginFill(0x57d38f).drawRoundedRect(0, 0, cellSize-3, cellSize-3, 6).endFill();
        cell.tx.style.fill = 0x160b20;
      } else {
        cell.bg.clear();
        cell.bg.beginFill(0xff5d5d).drawRoundedRect(0, 0, cellSize-3, cellSize-3, 6).endFill();
        cell.tx.style.fill = 0x160b20;
      }
      // add ball photo
      const ballIdx = i;
      const cast = SESSION.crashPilots[n % SESSION.crashPilots.length];
      const url = castToPhotoURL(cast);
      PIXI.Assets.load(url).then(tex => {
        if (!tex || ballsContainer.destroyed) return;
        const sp = new PIXI.Sprite(tex);
        const scale = ballSize / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.x = 60 + ballIdx * (ballSize + 6);
        sp.y = -10;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawCircle(60 + ballIdx * (ballSize + 6) + ballSize/2, ballSize/2 - 10, ballSize/2).endFill();
        ballsContainer.addChild(mask);
        sp.mask = mask;
        ballsContainer.addChild(sp);
        // number badge
        const numBadge = new PIXI.Graphics();
        numBadge.beginFill(0x160b20).drawRoundedRect(60 + ballIdx * (ballSize + 6) + ballSize - 18, ballSize - 24, 16, 14, 3).endFill();
        ballsContainer.addChild(numBadge);
        const numTx = new PIXI.Text(String(n), {fontFamily:"Outfit",fontSize:10,fontWeight:"900",fill:0xffe9b8});
        numTx.x = 60 + ballIdx * (ballSize + 6) + ballSize - 16;
        numTx.y = ballSize - 22;
        ballsContainer.addChild(numTx);
      }).catch(()=>{});
      sfx.pop();
      await new Promise(r => setTimeout(r, 300));
    }
    // count matches
    let matches = 0;
    for (const n of drawn) if (picked.has(n)) matches++;
    const mult = PAYOUTS[matches] || 0;
    const win = Math.floor(curBet * mult);
    if (win > 0) {
      store.pay(win);
      store.record(game.id, curBet, win);
      sfx.win();
      resultText.text = `${matches} matches · ${mult}x · +${win}`;
      host.onWin(mult >= 50 ? "mega" : mult >= 10 ? "big" : "win", win, {
        title: `${matches} matches · ${mult}x`,
        line: "The divas favored you."
      });
    } else {
      store.record(game.id, curBet, 0);
      sfx.lose();
      resultText.text = `${matches} matches · no win`;
    }
    drawing = false;
    drawBtn.interactive = true;
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
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:18,fontWeight:"700",fill:fg});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
