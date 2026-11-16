// screens/guide.js — PHASE 6: Central Guide screen with rules for all 50 games.
// Accessible from lobby via the Guide button.
// Lists all games grouped by category. Tap any game → rules detail popup.
import { t } from "../core/i18n.js";
import { sfx } from "../core/sfx.js";
import { store } from "../core/store.js";
import { GAMES, GAME_CATEGORIES } from "../data/games-registry.js";
import { GAME_RULES } from "../data/game-rules.js";

export async function render(pixiApp, appRef) {
  const W = pixiApp.screen.width, H = pixiApp.screen.height;
  const c = new PIXI.Container();
  pixiApp.stage.addChild(c);

  // dark bg
  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  // header
  const headerY = 8;
  const back = makeButton(60, 40, "← Back", 0x333333, 0xffffff, 13);
  back.x = 8; back.y = headerY + 8;
  back.interactive = true; back.buttonMode = true;
  back.on("pointertap", () => { sfx.click(); appRef.go("lobby"); });
  c.addChild(back);

  const title = new PIXI.Text("The House Guide", {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: 22, fontStyle: "italic", fontWeight: "900", fill: 0xf2c76e
  });
  title.x = 76; title.y = headerY + 6;
  c.addChild(title);

  const sub = new PIXI.Text("Every game · every rule · no secrets", {
    fontFamily: "Outfit, sans-serif", fontSize: 12, fontStyle: "italic", fill: 0xff2e88
  });
  sub.x = 76; sub.y = headerY + 32;
  c.addChild(sub);

  // search/filter bar (simple — just category filter pills)
  const filterY = headerY + 56;
  const cats = ["all", ...Object.keys(GAME_CATEGORIES)];
  const filterContainer = new PIXI.Container();
  filterContainer.x = 8;
  filterContainer.y = filterY;
  c.addChild(filterContainer);

  let curFilter = "all";
  const filterPills = [];
  let fx = 0;
  cats.forEach(catId => {
    const label = catId === "all" ? "ALL" : GAME_CATEGORIES[catId].label;
    const isActive = catId === curFilter;
    const pill = makeFilterPill(label, isActive);
    pill.x = fx;
    pill.y = 0;
    pill.catId = catId;
    pill.interactive = true;
    pill.buttonMode = true;
    pill.on("pointertap", () => {
      sfx.click();
      curFilter = catId;
      filterPills.forEach(p => updateFilterPill(p, p.catId === curFilter));
      buildGameList();
    });
    filterPills.push(pill);
    filterContainer.addChild(pill);
    fx += pill.width + 6;
  });

  // scroll mask for filter row (in case it overflows)
  const filterMask = new PIXI.Graphics();
  filterMask.beginFill(0xffffff).drawRect(0, filterY, W, 36).endFill();
  c.addChild(filterMask);
  filterContainer.mask = filterMask;

  // content area (scrollable)
  const contentY = filterY + 44;
  const contentH = H - contentY - 8;
  const contentContainer = new PIXI.Container();
  contentContainer.y = contentY;
  c.addChild(contentContainer);

  const contentMask = new PIXI.Graphics();
  contentMask.beginFill(0xffffff).drawRect(0, contentY, W, contentH).endFill();
  c.addChild(contentMask);
  contentContainer.mask = contentMask;

  let scrollY = 0;
  let dragStart = null;
  let maxScroll = 0;

  contentContainer.interactive = true;
  contentContainer.on("pointerdown", (e) => {
    dragStart = { y: e.global.y, scroll: scrollY };
  });
  contentContainer.on("pointermove", (e) => {
    if (!dragStart) return;
    const dy = e.global.y - dragStart.y;
    scrollY = Math.max(-maxScroll, Math.min(0, dragStart.scroll + dy));
    contentContainer.y = contentY + scrollY;
  });
  const endDrag = () => { dragStart = null; };
  contentContainer.on("pointerup", endDrag);
  contentContainer.on("pointerupoutside", endDrag);

  function buildGameList() {
    contentContainer.removeChildren();
    scrollY = 0;
    contentContainer.y = contentY;

    // filter games
    const filtered = curFilter === "all" ? GAMES : GAMES.filter(g => g.cat === curFilter);

    // group by category for display
    const byCat = {};
    for (const g of filtered) {
      if (!byCat[g.cat]) byCat[g.cat] = [];
      byCat[g.cat].push(g);
    }

    const cardW = (W - 24) / 2;
    const cardH = 90;
    const gap = 6;
    let y = 0;

    for (const catId of Object.keys(byCat)) {
      const cat = GAME_CATEGORIES[catId];
      // category header
      const catHeader = new PIXI.Text(`${cat.icon}  ${cat.label.toUpperCase()}  (${byCat[catId].length})`, {
        fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "900", fill: 0x9d4edd
      });
      catHeader.x = 8; catHeader.y = y;
      contentContainer.addChild(catHeader);
      y += 20;

      // games in this category
      const games = byCat[catId];
      let row = 0, col = 0;
      for (const game of games) {
        const card = buildGameCard(game, cardW, cardH);
        card.x = 8 + col * (cardW + gap);
        card.y = y + row * (cardH + gap);
        card.interactive = true;
        card.buttonMode = true;
        card.on("pointertap", () => {
          sfx.click();
          showGameRules(game);
        });
        contentContainer.addChild(card);
        col++;
        if (col >= 2) { col = 0; row++; }
      }
      y += (Math.ceil(games.length / 2)) * (cardH + gap) + 8;
    }

    maxScroll = Math.max(0, y - contentH);
  }

  function buildGameCard(game, w, h) {
    const card = new PIXI.Container();
    const bgGfx = new PIXI.Graphics();
    bgGfx.lineStyle(1, 0xf2c76e, 0.3).beginFill(0x1c0e2a, 0.95).drawRoundedRect(0, 0, w, h, 10).endFill();
    if (game.isNew) {
      bgGfx.beginFill(0xff2e88, 0.9).drawRoundedRect(w - 32, 4, 28, 14, 4).endFill();
    }
    card.addChild(bgGfx);

    // name
    const name = new PIXI.Text(game.name, {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 14, fontStyle: "italic", fontWeight: "700", fill: 0xffe9b8,
      wordWrap: true, wordWrapWidth: w - 16
    });
    name.x = 8; name.y = 6;
    card.addChild(name);

    // blurb
    const blurb = new PIXI.Text(game.blurb, {
      fontFamily: "Outfit, sans-serif", fontSize: 11, fill: 0xb0b0b0,
      wordWrap: true, wordWrapWidth: w - 16
    });
    blurb.x = 8; blurb.y = 28;
    card.addChild(blurb);

    // "view rules" hint
    const hint = new PIXI.Text("▸ rules", {
      fontFamily: "Outfit, sans-serif", fontSize: 10, fontStyle: "italic", fill: 0xf2c76e
    });
    hint.x = 8; hint.y = h - 16;
    card.addChild(hint);

    if (game.isNew) {
      const newTx = new PIXI.Text("NEW", {
        fontFamily: "Outfit, sans-serif", fontSize: 9, fontWeight: "900", fill: 0xffffff
      });
      newTx.anchor.set(0.5); newTx.x = w - 18; newTx.y = 11;
      card.addChild(newTx);
    }

    return card;
  }

  function showGameRules(game) {
    const rules = GAME_RULES[game.id];
    if (!rules) {
      host.toast("No rules available for this game yet.");
      return;
    }
    // overlay
    const overlay = new PIXI.Container();
    overlay.x = 0; overlay.y = 0;
    c.addChild(overlay);

    // dark backdrop
    const dark = new PIXI.Graphics();
    dark.beginFill(0x000000, 0.85).drawRect(0, 0, W, H).endFill();
    dark.interactive = true;
    dark.on("pointertap", () => { sfx.click(); c.removeChild(overlay); overlay.destroy({ children: true }); });
    overlay.addChild(dark);

    // rules card
    const cardW = W - 32;
    const cardX = 16;
    const cardY = 40;
    const card = new PIXI.Graphics();
    card.lineStyle(2, 0xf2c76e, 0.6).beginFill(0x1c0e2a, 0.98).drawRoundedRect(cardX, cardY, cardW, H - 80, 14).endFill();
    overlay.addChild(card);

    // game name
    const nameTx = new PIXI.Text(game.name, {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 24, fontStyle: "italic", fontWeight: "900", fill: 0xf2c76e, align: "center"
    });
    nameTx.anchor.set(0.5, 0); nameTx.x = W/2; nameTx.y = cardY + 12;
    overlay.addChild(nameTx);

    // category
    const catTx = new PIXI.Text(rules.category, {
      fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "700", fill: 0xff2e88, align: "center"
    });
    catTx.anchor.set(0.5, 0); catTx.x = W/2; catTx.y = cardY + 42;
    overlay.addChild(catTx);

    // rules list
    let curY = cardY + 68;
    const rulesHeader = new PIXI.Text("HOW TO PLAY", {
      fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "900", fill: 0x9d4edd
    });
    rulesHeader.x = cardX + 12; rulesHeader.y = curY;
    overlay.addChild(rulesHeader);
    curY += 18;

    for (const rule of rules.rules) {
      const bullet = new PIXI.Text("•", {
        fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "900", fill: 0xf2c76e
      });
      bullet.x = cardX + 16; bullet.y = curY;
      overlay.addChild(bullet);
      const ruleTx = new PIXI.Text(rule, {
        fontFamily: "Outfit, sans-serif", fontSize: 12, fill: 0xffe9b8,
        wordWrap: true, wordWrapWidth: cardW - 40
      });
      ruleTx.x = cardX + 28; ruleTx.y = curY;
      overlay.addChild(ruleTx);
      curY += ruleTx.height + 4;
    }

    curY += 8;
    // payouts
    const payoutsHeader = new PIXI.Text("PAYOUTS", {
      fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "900", fill: 0x9d4edd
    });
    payoutsHeader.x = cardX + 12; payoutsHeader.y = curY;
    overlay.addChild(payoutsHeader);
    curY += 18;
    const payoutsTx = new PIXI.Text(rules.payouts, {
      fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "600", fill: 0x57d38f,
      wordWrap: true, wordWrapWidth: cardW - 24
    });
    payoutsTx.x = cardX + 12; payoutsTx.y = curY;
    overlay.addChild(payoutsTx);
    curY += payoutsTx.height + 12;

    // flavor
    const flavorHeader = new PIXI.Text("VEDHIKA'S NOTE", {
      fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "900", fill: 0x9d4edd
    });
    flavorHeader.x = cardX + 12; flavorHeader.y = curY;
    overlay.addChild(flavorHeader);
    curY += 18;
    const flavorTx = new PIXI.Text(`"${rules.flavor}"`, {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 13, fontStyle: "italic", fill: 0xff2e88,
      wordWrap: true, wordWrapWidth: cardW - 24
    });
    flavorTx.x = cardX + 12; flavorTx.y = curY;
    overlay.addChild(flavorTx);
    curY += flavorTx.height + 12;

    // close hint
    const closeTx = new PIXI.Text("▸ tap anywhere to close", {
      fontFamily: "Outfit, sans-serif", fontSize: 11, fontStyle: "italic", fill: 0xb0b0b0, align: "center"
    });
    closeTx.anchor.set(0.5, 0); closeTx.x = W/2; closeTx.y = H - 60;
    overlay.addChild(closeTx);
  }

  buildGameList();

  return { cleanup: () => {} };
}

function makeButton(w, h, label, bg, fg, fontSize = 14) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(0, 0, w, h, 8).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif",
    fontSize: fontSize, fontWeight: "700", fill: fg, align: "center"
  });
  tx.anchor.set(0.5); tx.x = w/2; tx.y = h/2;
  c.addChild(tx);
  return c;
}

function makeFilterPill(label, active) {
  const c = new PIXI.Container();
  const bg = new PIXI.Graphics();
  bg.beginFill(active ? 0xf2c76e : 0x1c0e2a).drawRoundedRect(0, 0, 80, 28, 14).endFill();
  if (!active) bg.lineStyle(1, 0xf2c76e, 0.3).drawRoundedRect(0, 0, 80, 28, 14).endFill();
  c.addChild(bg);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "700",
    fill: active ? 0x160b20 : 0xffe9b8, align: "center"
  });
  tx.anchor.set(0.5); tx.x = 40; tx.y = 14;
  c.addChild(tx);
  c.bgRef = bg;
  c.txRef = tx;
  return c;
}

function updateFilterPill(pill, active) {
  if (!pill || !pill.bgRef) return;
  pill.bgRef.clear();
  pill.bgRef.beginFill(active ? 0xf2c76e : 0x1c0e2a).drawRoundedRect(0, 0, 80, 28, 14).endFill();
  if (!active) pill.bgRef.lineStyle(1, 0xf2c76e, 0.3).drawRoundedRect(0, 0, 80, 28, 14).endFill();
  pill.txRef.style.fill = active ? 0x160b20 : 0xffe9b8;
}
