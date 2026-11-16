// games/scratch.js — 3x3 gold foil grid. Scratch (tap) cells to reveal photos.
// Match 3 of the same diva to win her printed prize (x1.5 to x100 bet).

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

  // 3x3 grid of cells
  const gridSize = Math.min(W - 32, 320);
  const cellSize = (gridSize - 16) / 3;  // 3 cells with 8px gaps
  const gridX = W/2 - gridSize/2;
  const gridY = 50;
  const gridContainer = new PIXI.Container();
  gridContainer.x = gridX; gridContainer.y = gridY;
  c.addChild(gridContainer);

  // pick 12 cast entries with prizes — same as SESSION.scratch
  const scratchCast = SESSION.scratch;
  // pick 9 cells for this card (with potential 3-of-a-kind)
  // Strategy: 35% chance of having a winning combo (3 same), 65% random
  const cells = [];
  const isWinCard = Math.random() < 0.35;
  if (isWinCard) {
    // pick a winning combo
    const winIdx = Math.floor(Math.random() * scratchCast.length);
    const winning = scratchCast[winIdx];
    // place winning diva at 3 random positions
    const positions = [0,1,2,3,4,5,6,7,8];
    for (let i = positions.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [positions[i],positions[j]] = [positions[j],positions[i]];
    }
    const winPositions = new Set(positions.slice(0, 3));
    for (let i = 0; i < 9; i++) {
      if (winPositions.has(i)) {
        cells.push({ ...winning, revealed: false });
      } else {
        // pick any other cast
        const other = scratchCast[(winIdx + 1 + Math.floor(Math.random()*(scratchCast.length-1))) % scratchCast.length];
        cells.push({ ...other, revealed: false });
      }
    }
  } else {
    // all random (no 3-of-a-kind by design)
    for (let i = 0; i < 9; i++) {
      cells.push({ ...scratchCast[Math.floor(Math.random()*scratchCast.length)], revealed: false });
    }
  }

  // draw cells
  const cellSprites = [];
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i/3), col = i % 3;
    const cx = col * (cellSize + 8);
    const cy = row * (cellSize + 8);
    const cellContainer = new PIXI.Container();
    cellContainer.x = cx; cellContainer.y = cy;

    // gold foil cover (initially)
    const cover = new PIXI.Graphics();
    cover.beginFill(0xf2c76e).drawRoundedRect(0, 0, cellSize, cellSize, 8).endFill();
    // pattern
    cover.beginFill(0xffe9b8, 0.4).drawRoundedRect(4, 4, cellSize-8, cellSize-8, 6).endFill();
    cover.beginFill(0xd9a441, 0.6).drawCircle(cellSize/2, cellSize/2, cellSize/4).endFill();
    cover.beginFill(0xf2c76e).drawCircle(cellSize/2, cellSize/2, cellSize/4 - 4).endFill();
    cover.interactive = true;
    cover.buttonMode = true;
    cellContainer.addChild(cover);
    cellContainer.coverGfx = cover;

    gridContainer.addChild(cellContainer);
    cellSprites.push(cellContainer);

    // tap to reveal
    cover.on("pointertap", () => revealCell(i));
  }

  async function revealCell(idx) {
    const cell = cells[idx];
    if (cell.revealed) return;
    cell.revealed = true;
    sfx.reveal();
    const sp = cellSprites[idx];
    sp.coverGfx.visible = false;
    // load photo
    const url = castToPhotoURL(cell.cast);
    try {
      const tex = await PIXI.Assets.load(url);
      const photo = new PIXI.Sprite(tex);
      const scale = cellSize / Math.max(tex.width, tex.height);
      photo.scale.set(scale);
      photo.x = (cellSize - tex.width*scale)/2;
      photo.y = (cellSize - tex.height*scale)/2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(0, 0, cellSize, cellSize, 8).endFill();
      sp.addChild(mask);
      photo.mask = mask;
      sp.addChild(photo);
      // pop-in animation
      photo.scale.set(scale * 0.3);
      let el = 0;
      const fn = (dt) => {
        el += dt;
        const s = scale * (0.3 + 0.7 * Math.min(1, el/12));
        photo.scale.set(s);
        photo.x = (cellSize - tex.width*s)/2;
        photo.y = (cellSize - tex.height*s)/2;
        if (el >= 12) pixiApp.ticker.remove(fn);
      };
      pixiApp.ticker.add(fn);
    } catch(e) {}

    // check if all revealed
    if (cells.every(c => c.revealed)) {
      await new Promise(r => setTimeout(r, 500));
      checkWin();
    }
  }

  // result text
  const resultText = new PIXI.Text("", {
    fontFamily:"Outfit, sans-serif",fontSize:18,fontWeight:"900",fill:0xffe9b8,
    stroke:0x160b20,strokeThickness:3,align:"center"
  });
  resultText.anchor.set(0.5,0); resultText.x = W/2; resultText.y = gridY + gridSize + 16;
  c.addChild(resultText);

  function checkWin() {
    // count photos by cast key
    const counts = {};
    for (const cell of cells) {
      const key = cell.cast.key;
      counts[key] = (counts[key] || 0) + 1;
    }
    // find any with count >= 3
    let winner = null;
    for (const key of Object.keys(counts)) {
      if (counts[key] >= 3) {
        winner = cells.find(c => c.cast.key === key);
        break;
      }
    }
    if (winner) {
      const win = Math.floor(curBet * winner.prize);
      store.pay(win);
      store.record(game.id, curBet, win);
      sfx.big();
      resultText.text = `${winner.cast.name} x3 · ${winner.prize}x · +${win}`;
      host.onWin(winner.prize >= 25 ? "mega" : winner.prize >= 5 ? "big" : "win", win, {
        title: `${winner.prize}x · ${winner.cast.name}`,
        line: "Three of her. You won."
      });
    } else {
      store.record(game.id, curBet, 0);
      sfx.lose();
      resultText.text = "No match. Card lost.";
    }
    // offer new card
    setTimeout(() => {
      // reset by going back to lobby and re-entering (simple)
      host.app.backToLobby();
      host.app.openGame("scratch");
    }, 3500);
  }

  // bet row
  let curBet = 25;
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p,i) => p.on("pointertap", () => { curBet = [10,25,50,100,250][i]; }));

  // "REVEAL ALL" + bet button
  const revealAllBtn = makeButton((W-24)/2, 60, "REVEAL ALL", 0x9d4edd, 0xffffff);
  revealAllBtn.x = 8; revealAllBtn.y = H - 60;
  revealAllBtn.interactive = true; revealAllBtn.buttonMode = true;
  revealAllBtn.on("pointertap", async () => {
    sfx.click();
    for (let i = 0; i < 9; i++) {
      if (!cells[i].revealed) {
        revealCell(i);
        await new Promise(r => setTimeout(r, 80));
      }
    }
  });
  c.addChild(revealAllBtn);

  // bet deduct upfront
  if (!store.bet(curBet)) {
    host.toast(t("toast.betTooHigh"));
    host.app.backToLobby();
    return () => {};
  }

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

function makeButton(w,h,label,bg,fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0,0,w,h,12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label,{fontFamily:"Outfit",fontSize:14,fontWeight:"700",fill:fg});
  tx.anchor.set(0.5); tx.x=w/2; tx.y=h/2;
  c.addChild(tx);
  return c;
}
