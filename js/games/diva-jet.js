// games/diva-jet.js — REDESIGNED Phase 3: Diva Dare (truth-or-dare betting).
// 4 divas sit at a table. A dare card is revealed. Player bets on which diva will accept it.
// Each diva has stats (chaos, drama, flirt, loyalty). Highest stat matching the dare type wins.
// 5 dares per round. Payout = bet * odds if your diva accepts.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { CAST_LIST } from "../core/app.js";
import { castPick, castToPhotoURL } from "../core/photos.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";

const DARES = [
  { text: "Who calls their ex at 2am?", type: "drama" },
  { text: "Who would gatecrash a wedding?", type: "chaos" },
  { text: "Who would flirt their way out of a ticket?", type: "flirt" },
  { text: "Who ditches the group chat for a date?", type: "flirt" },
  { text: "Who would actually move to Bali?", type: "chaos" },
  { text: "Who cries at every proposal video?", type: "drama" },
  { text: "Who would start a fight at brunch?", type: "chaos" },
  { text: "Who ghostwrites their friends' dating profiles?", type: "loyalty" },
  { text: "Who would borrow your outfit and 'forget' to return it?", type: "chaos" },
  { text: "Who shows up 90 minutes late and doesn't apologize?", type: "drama" },
  { text: "Who has a shrine for their scooty?", type: "loyalty" },
  { text: "Who would let you cry on their shoulder then post about it?", type: "drama" },
  { text: "Who roasts everyone lovingly but also seriously?", type: "flirt" },
  { text: "Who gatekeeps the best cafe in town?", type: "loyalty" },
  { text: "Who would order one drink and stay until close?", type: "chaos" }
];

// pick 4 divas and assign stats
function buildTable() {
  const used = new Set();
  const divas = [];
  for (let i = 0; i < 4; i++) {
    const cast = castPick(CAST_LIST, used);
    used.add(cast.key);
    divas.push({
      cast,
      stats: {
        chaos: 20 + Math.floor(Math.random() * 80),
        drama: 20 + Math.floor(Math.random() * 80),
        flirt: 20 + Math.floor(Math.random() * 80),
        loyalty: 20 + Math.floor(Math.random() * 80)
      }
    });
  }
  return divas;
}

export async function mount(host) {
  const { pixiApp, stage, width: W, height: stageH, game } = host;
  const H = stageH;
  const c = new PIXI.Container();
  stage.addChild(c);

  // bg — warm pink/gold (party vibes)
  const bg = new PIXI.Graphics();
  bg.beginFill(0x1a0a14, 0.75).drawRect(0, 0, W, H).endFill();
  for (let i = 0; i < H; i += 4) {
    const t = i / H;
    const r = Math.round(0x1a + (0x3a - 0x1a) * t);
    const g = Math.round(0x0a + (0x14 - 0x0a) * t);
    const b = Math.round(0x14 + (0x28 - 0x14) * t);
    bg.beginFill((r<<16)|(g<<8)|b).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  const tagline = new PIXI.Text("Truth or dare. Bet on who accepts the dare.", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontStyle: "italic", fill: 0xff2e88, align: "center"
  });
  tagline.anchor.set(0.5, 0); tagline.x = W/2; tagline.y = 6;
  c.addChild(tagline);

  // 4 diva portraits across the top
  const divaW = (W - 32) / 4;
  const divaH = 130;
  const divaY = 40;
  const divaContainers = [];
  const table = buildTable();
  let pickedIdx = -1;
  let curBet = 25;
  let dareIdx = 0;
  let roundActive = false;
  let totalWon = 0;
  let totalWagered = 0;

  // calculate odds for each diva based on the current dare
  function getOdds(diva, dareType) {
    const stat = diva.stats[dareType] || 30;
    // higher stat = lower odds (favorite), lower stat = higher odds (longshot)
    // odds range 1.5x (favorite) to 8x (longshot)
    const odds = Math.max(1.5, Math.min(8, 200 / stat));
    return odds;
  }

  let currentDare = DARES[Math.floor(Math.random() * DARES.length)];

  // dare card display (center)
  const dareCardY = divaY + divaH + 12;
  const dareCardH = 70;
  const dareCard = new PIXI.Graphics();
  dareCard.lineStyle(2, 0xf2c76e, 0.6).beginFill(0x2a1a2a, 0.95).drawRoundedRect(16, dareCardY, W - 32, dareCardH, 12).endFill();
  c.addChild(dareCard);
  const dareLabel = new PIXI.Text("DARE CARD", {
    fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "700", fill: 0xff2e88
  });
  dareLabel.x = 24; dareLabel.y = dareCardY + 8;
  c.addChild(dareLabel);
  const dareText = new PIXI.Text("", {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: 16, fontStyle: "italic", fontWeight: "700", fill: 0xffe9b8, align: "center",
    wordWrap: true, wordWrapWidth: W - 60
  });
  dareText.anchor.set(0.5, 0); dareText.x = W/2; dareText.y = dareCardY + 24;
  c.addChild(dareText);

  function updateDareCard() {
    dareText.text = currentDare.text;
  }
  updateDareCard();

  // build diva portraits
  for (let i = 0; i < 4; i++) {
    const dc = new PIXI.Container();
    dc.x = 8 + i * (divaW + 4);
    dc.y = divaY;
    const dcbg = new PIXI.Graphics();
    dcbg.lineStyle(2, 0xf2c76e, pickedIdx === i ? 1 : 0.3).beginFill(0x2a1a2a).drawRoundedRect(0, 0, divaW, divaH, 12).endFill();
    dc.addChild(dcbg);
    // photo (contain-fit with backdrop)
    const photoH = divaH - 36;
    const url = castToPhotoURL(table[i].cast);
    PIXI.Assets.load(url).then(tex => {
      if (!tex || dc.destroyed) return;
      const backdrop = new PIXI.Sprite(tex);
      const bgScale = Math.max(divaW/tex.width, photoH/tex.height);
      backdrop.scale.set(bgScale);
      backdrop.x = (divaW - tex.width*bgScale)/2;
      backdrop.y = (photoH - tex.height*bgScale)/2;
      backdrop.alpha = 0.3;
      const bgMask = new PIXI.Graphics();
      bgMask.beginFill(0xffffff).drawRoundedRect(0, 0, divaW, photoH, 12).endFill();
      dc.addChild(bgMask);
      backdrop.mask = bgMask;
      dc.addChild(backdrop);
      const sp = new PIXI.Sprite(tex);
      const scale = Math.min(divaW/tex.width, photoH/tex.height);
      sp.scale.set(scale);
      sp.x = (divaW - tex.width*scale)/2;
      sp.y = (photoH - tex.height*scale)/2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(0, 0, divaW, photoH, 12).endFill();
      dc.addChild(mask);
      sp.mask = mask;
      dc.addChild(sp);
    }).catch(()=>{});
    // name
    const nameTx = new PIXI.Text(table[i].cast.name, {
      fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "700", fill: 0xffe9b8, align: "center",
      wordWrap: true, wordWrapWidth: divaW - 4
    });
    nameTx.anchor.set(0.5, 0); nameTx.x = divaW/2; nameTx.y = photoH + 4;
    dc.addChild(nameTx);
    // odds badge
    const odds = getOdds(table[i], currentDare.type);
    const oddsBadge = new PIXI.Graphics();
    oddsBadge.beginFill(0xff2e88).drawRoundedRect(2, 2, 38, 16, 4).endFill();
    dc.addChild(oddsBadge);
    const oddsTx = new PIXI.Text(odds.toFixed(1) + "x", {
      fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "900", fill: 0xffffff
    });
    oddsTx.x = 6; oddsTx.y = 4;
    dc.addChild(oddsTx);
    dc.oddsTx = oddsTx;
    dc.oddsBadge = oddsBadge;
    dc.idx = i;
    dc.interactive = true;
    dc.buttonMode = true;
    dc.on("pointertap", () => pickDiva(i));
    c.addChild(dc);
    divaContainers.push(dc);
  }

  function refreshOdds() {
    for (let i = 0; i < 4; i++) {
      const odds = getOdds(table[i], currentDare.type);
      divaContainers[i].oddsTx.text = odds.toFixed(1) + "x";
    }
  }

  function pickDiva(idx) {
    if (roundActive) return;
    sfx.click();
    pickedIdx = idx;
    // update borders
    for (let i = 0; i < 4; i++) {
      const dc = divaContainers[i];
      dc.children[0].clear();
      dc.children[0].lineStyle(2, 0xf2c76e, i === pickedIdx ? 1 : 0.3).beginFill(0x2a1a2a).drawRoundedRect(0, 0, divaW, divaH, 12).endFill();
    }
  }

  // result text
  const resultText = new PIXI.Text("", {
    fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: "900", fill: 0xffe9b8,
    stroke: 0x160b20, strokeThickness: 3, align: "center",
    wordWrap: true, wordWrapWidth: W - 16
  });
  resultText.anchor.set(0.5, 0); resultText.x = W/2; resultText.y = dareCardY + dareCardH + 12;
  c.addChild(resultText);

  // dare counter + total winnings
  const counterText = new PIXI.Text("Dare 1/5 · Won: 0", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "700", fill: 0xffe9b8
  });
  counterText.x = 12; counterText.y = dareCardY + dareCardH + 40;
  c.addChild(counterText);

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => { curBet = [10, 25, 50, 100, 250][i]; }));

  // resolve button
  const resolveBtn = makeButton(W - 16, 60, "RESOLVE DARE · " + curBet, 0xf2c76e, 0x160b20);
  resolveBtn.x = 8; resolveBtn.y = H - 60;
  resolveBtn.interactive = true; resolveBtn.buttonMode = true;
  c.addChild(resolveBtn);

  async function resolveDare() {
    if (roundActive) return;
    if (pickedIdx < 0) { host.toast("Pick a diva first."); return; }
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    roundActive = true;
    resolveBtn.interactive = false;
    totalWagered += curBet;
    sfx.whoosh();
    // determine winner — weighted by stats for the dare type
    const weights = table.map(d => d.stats[currentDare.type] || 30);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let winnerIdx = 0;
    for (let i = 0; i < 4; i++) {
      r -= weights[i];
      if (r <= 0) { winnerIdx = i; break; }
    }
    // highlight winner with gold ring
    const winnerRing = new PIXI.Graphics();
    winnerRing.lineStyle(4, 0xffd700, 1).drawRoundedRect(divaContainers[winnerIdx].x - 2, divaContainers[winnerIdx].y - 2, divaW + 4, divaH + 4, 14).endFill();
    c.addChild(winnerRing);
    sfx.reveal();
    await new Promise(r => setTimeout(r, 1500));

    if (pickedIdx === winnerIdx) {
      const odds = getOdds(table[pickedIdx], currentDare.type);
      const win = Math.floor(curBet * odds);
      store.pay(win);
      totalWon += win;
      sfx.win();
      resultText.text = `${table[winnerIdx].cast.name} accepted! +${win} (${odds}x)`;
      resultText.style.fill = 0x57d38f;
      host.onWin(odds >= 5 ? "big" : "win", win, {
        title: table[winnerIdx].cast.name + " accepted the dare",
        line: `${odds}x · +${win} chips`
      });
    } else {
      sfx.lose();
      resultText.text = `${table[winnerIdx].cast.name} accepted. You backed ${table[pickedIdx].cast.name}.`;
      resultText.style.fill = 0xff5d5d;
    }
    store.record(game.id, curBet, pickedIdx === winnerIdx ? Math.floor(curBet * getOdds(table[pickedIdx], currentDare.type)) : 0);
    c.removeChild(winnerRing);

    dareIdx++;
    counterText.text = `Dare ${dareIdx + 1}/5 · Won: ${totalWon}`;

    if (dareIdx >= 5) {
      // round end
      setTimeout(() => {
        host.onWin(totalWon > totalWagered * 2 ? "mega" : totalWon > totalWagered ? "big" : "win", totalWon, {
          title: `Round complete · +${totalWon} chips`,
          line: totalWon > totalWagered ? "Profit." : "Tough round."
        });
        // reset for next round
        dareIdx = 0;
        totalWon = 0;
        totalWagered = 0;
        pickedIdx = -1;
        currentDare = DARES[Math.floor(Math.random() * DARES.length)];
        updateDareCard();
        refreshOdds();
        counterText.text = "Dare 1/5 · Won: 0";
        resultText.text = "";
        // rebuild table (new divas)
        const newTable = buildTable();
        for (let i = 0; i < 4; i++) table[i] = newTable[i];
        // refresh portraits — simplest: reload game
        host.app.backToLobby();
        host.app.openGame("diva-jet");
      }, 2500);
    } else {
      // next dare
      setTimeout(() => {
        pickedIdx = -1;
        currentDare = DARES[Math.floor(Math.random() * DARES.length)];
        updateDareCard();
        refreshOdds();
        // reset borders
        for (let i = 0; i < 4; i++) {
          const dc = divaContainers[i];
          dc.children[0].clear();
          dc.children[0].lineStyle(2, 0xf2c76e, 0.3).beginFill(0x2a1a2a).drawRoundedRect(0, 0, divaW, divaH, 12).endFill();
        }
        resultText.text = "";
        roundActive = false;
        resolveBtn.interactive = true;
      }, 1800);
    }
  }
  resolveBtn.on("pointertap", resolveDare);

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 12).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {fontFamily:"Outfit",fontSize:16,fontWeight:"700",fill:fg});
  tx.anchor.set(0.5); tx.x = w/2; tx.y = h/2;
  c.addChild(tx);
  return c;
}
