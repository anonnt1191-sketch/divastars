// screens/memoryBook.js — PHASE 5: Diva Bio Pages.
// 3 sections:
//   1. Inner Circle (17 divas) — full bio pages with photos, voice samples, stats, appears-in
//   2. Editor's Page (Vedhika) — most elaborate, hostess voice
//   3. World Cast (300 photos: 100 pack + 200 world-cast) — grouped grid gallery
import { t } from "../core/i18n.js";
import { sfx } from "../core/sfx.js";
import { store } from "../core/store.js";
import { DIVAS, DIVA_IDS } from "../data/divas.js";
import { DIVA_BIOS } from "../data/diva-bios.js";
import { PACK_NAMES, WORLD_CAST } from "../data/world-cast-names.js";
import { friendPhoto, packPhoto, worldPhoto, friendPhotoFull, packPhotoFull, worldPhotoFull } from "../core/photos.js";

const SECTIONS = [
  { id: "inner", label: "Inner Circle", count: 17 },
  { id: "editor", label: "Editor's Page", count: 1 },
  { id: "world", label: "World Cast", count: 300 }
];

export async function render(pixiApp, appRef) {
  const W = pixiApp.screen.width, H = pixiApp.screen.height;
  const c = new PIXI.Container();
  pixiApp.stage.addChild(c);

  // dark bg
  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  // header with section tabs
  const headerY = 8;
  const headerH = 56;

  // back button
  const back = makeButton(60, 40, "← Back", 0x333333, 0xffffff, 13);
  back.x = 8; back.y = headerY + 8;
  back.interactive = true; back.buttonMode = true;
  back.on("pointertap", () => { sfx.click(); appRef.go("lobby"); });
  c.addChild(back);

  // title
  const title = new PIXI.Text("Memory Book", {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: 22, fontStyle: "italic", fontWeight: "900", fill: 0xf2c76e
  });
  title.x = 76; title.y = headerY + 6;
  c.addChild(title);

  // section tabs
  const tabsY = headerY + 32;
  let tabX = 76;
  const tabs = [];
  SECTIONS.forEach((sec, i) => {
    const isActive = i === 0;
    const tab = makeTabButton(sec.label, tabX, tabsY, isActive);
    tab.secId = sec.id;
    tab.interactive = true;
    tab.buttonMode = true;
    tab.on("pointertap", () => {
      sfx.click();
      tabs.forEach(t => updateTabActive(t, t.secId === sec.id));
      renderSection(sec.id);
    });
    tabs.push(tab);
    c.addChild(tab);
    tabX += tab.width + 8;
  });

  // content area (scrollable)
  const contentY = headerY + headerH + 4;
  const contentH = H - contentY - 8;
  const contentContainer = new PIXI.Container();
  contentContainer.y = contentY;
  c.addChild(contentContainer);

  // mask for scroll
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

  function renderSection(secId) {
    contentContainer.removeChildren();
    scrollY = 0;
    contentContainer.y = contentY;
    if (secId === "inner") renderInnerCircle();
    else if (secId === "editor") renderEditorPage();
    else if (secId === "world") renderWorldCast();
  }

  // === SECTION 1: Inner Circle ===
  function renderInnerCircle() {
    // list of diva cards — tap to open bio detail
    const cardW = (W - 24) / 2;
    const cardH = 200;
    const gap = 8;
    let row = 0, col = 0;
    for (let i = 0; i < DIVA_IDS.length; i++) {
      const id = DIVA_IDS[i];
      const diva = DIVAS[id];
      const x = 8 + col * (cardW + gap);
      const y = row * (cardH + gap);
      const card = buildDivaCard(diva, cardW, cardH);
      card.x = x; card.y = y;
      card.interactive = true; card.buttonMode = true;
      card.on("pointertap", () => {
        sfx.click();
        showDivaBio(id);
      });
      contentContainer.addChild(card);
      col++;
      if (col >= 2) { col = 0; row++; }
    }
    maxScroll = Math.max(0, (row + 1) * (cardH + gap) - contentH);
  }

  function buildDivaCard(diva, w, h) {
    const card = new PIXI.Container();
    // bg
    const bgGfx = new PIXI.Graphics();
    bgGfx.lineStyle(2, diva.hue, 0.6).beginFill(0x1c0e2a, 0.95).drawRoundedRect(0, 0, w, h, 14).endFill();
    card.addChild(bgGfx);
    // photo (cover-fit to fill top portion)
    const photoH = h - 60;
    const url = friendPhoto(diva.id, 0);
    PIXI.Assets.load(url).then(tex => {
      if (!tex || card.destroyed) return;
      const sp = new PIXI.Sprite(tex);
      const scale = Math.max(w/tex.width, photoH/tex.height);
      sp.scale.set(scale);
      sp.x = (w - tex.width*scale)/2;
      sp.y = (photoH - tex.height*scale)/2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(0, 0, w, photoH, 14).endFill();
      card.addChild(mask);
      sp.mask = mask;
      card.addChild(sp);
      // dark gradient overlay at bottom for text legibility
      const grad = new PIXI.Graphics();
      for (let i = 0; i < 30; i++) {
        const a = i / 30 * 0.85;
        grad.beginFill(0x120818, a).drawRect(0, photoH - 30 + i, w, 1).endFill();
      }
      card.addChild(grad);
    }).catch(()=>{});
    // name
    const name = new PIXI.Text(diva.name, {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 18, fontStyle: "italic", fontWeight: "700", fill: 0xffe9b8
    });
    name.x = 10; name.y = photoH - 26;
    card.addChild(name);
    // title
    const titleTx = new PIXI.Text(`"${diva.title}"`, {
      fontFamily: "Outfit, sans-serif", fontSize: 12, fontStyle: "italic", fill: 0xff2e88
    });
    titleTx.x = 10; titleTx.y = photoH + 6;
    card.addChild(titleTx);
    // rule (truncated)
    const rule = new PIXI.Text(diva.rule, {
      fontFamily: "Outfit, sans-serif", fontSize: 11, fill: 0xb0b0b0,
      wordWrap: true, wordWrapWidth: w - 20
    });
    rule.x = 10; rule.y = photoH + 24;
    card.addChild(rule);
    // "view bio" hint
    const hint = new PIXI.Text("▸ tap to read bio", {
      fontFamily: "Outfit, sans-serif", fontSize: 10, fontStyle: "italic", fill: diva.hue
    });
    hint.x = 10; hint.y = h - 16;
    card.addChild(hint);
    return card;
  }

  // === DIVA BIO DETAIL PAGE ===
  function showDivaBio(id) {
    contentContainer.removeChildren();
    scrollY = 0;
    contentContainer.y = contentY;
    const diva = DIVAS[id];
    const bio = DIVA_BIOS[id];
    if (!diva || !bio) return;

    // back to list button
    const backBtn = makeButton(120, 36, "← Inner Circle", 0x333333, 0xffffff, 12);
    backBtn.x = 8; backBtn.y = 4;
    backBtn.interactive = true; backBtn.buttonMode = true;
    backBtn.on("pointertap", () => { sfx.click(); renderSection("inner"); });
    contentContainer.addChild(backBtn);

    // hero photo (large)
    const heroY = 48;
    const heroH = Math.min(contentH - 60, 280);
    const heroW = W - 16;
    const heroUrl = friendPhoto(id, 0);
    PIXI.Assets.load(heroUrl).then(tex => {
      if (!tex) return;
      // backdrop fill
      const backdrop = new PIXI.Sprite(tex);
      const bgScale = Math.max(heroW/tex.width, heroH/tex.height);
      backdrop.scale.set(bgScale);
      backdrop.x = 8 + (heroW - tex.width*bgScale)/2;
      backdrop.y = heroY + (heroH - tex.height*bgScale)/2;
      backdrop.alpha = 0.3;
      const bgMask = new PIXI.Graphics();
      bgMask.beginFill(0xffffff).drawRoundedRect(8, heroY, heroW, heroH, 14).endFill();
      contentContainer.addChild(bgMask);
      backdrop.mask = bgMask;
      contentContainer.addChild(backdrop);
      // foreground contain
      const sp = new PIXI.Sprite(tex);
      const scale = Math.min(heroW/tex.width, heroH/tex.height);
      sp.scale.set(scale);
      sp.x = 8 + (heroW - tex.width*scale)/2;
      sp.y = heroY + (heroH - tex.height*scale)/2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(8, heroY, heroW, heroH, 14).endFill();
      contentContainer.addChild(mask);
      sp.mask = mask;
      contentContainer.addChild(sp);
      // gold border
      const border = new PIXI.Graphics();
      border.lineStyle(3, diva.hue, 1).drawRoundedRect(8, heroY, heroW, heroH, 14).endFill();
      contentContainer.addChild(border);
    }).catch(()=>{});

    // name + title
    const nameTx = new PIXI.Text(diva.name, {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 28, fontStyle: "italic", fontWeight: "900", fill: diva.hue, align: "center"
    });
    nameTx.anchor.set(0.5, 0); nameTx.x = W/2; nameTx.y = heroY + heroH + 8;
    contentContainer.addChild(nameTx);

    const titleTx = new PIXI.Text(`"${diva.title}"`, {
      fontFamily: "Outfit, sans-serif", fontSize: 14, fontStyle: "italic", fill: 0xff2e88, align: "center"
    });
    titleTx.anchor.set(0.5, 0); titleTx.x = W/2; titleTx.y = heroY + heroH + 40;
    contentContainer.addChild(titleTx);

    // bio text
    let curY = heroY + heroH + 70;
    const bioParas = bio.bio.split("\n\n");
    for (const para of bioParas) {
      const bioTx = new PIXI.Text(para, {
        fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "400", fill: 0xffe9b8,
        align: "left", wordWrap: true, wordWrapWidth: W - 32, lineHeight: 18
      });
      bioTx.x = 16; bioTx.y = curY;
      contentContainer.addChild(bioTx);
      curY += bioTx.height + 12;
    }

    // divider
    const divider = new PIXI.Graphics();
    divider.beginFill(diva.hue, 0.4).drawRect(16, curY, W - 32, 1).endFill();
    contentContainer.addChild(divider);
    curY += 12;

    // voice samples header
    const voiceHeader = new PIXI.Text("VOICE SAMPLES", {
      fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "900", fill: 0x9d4edd
    });
    voiceHeader.x = 16; voiceHeader.y = curY;
    contentContainer.addChild(voiceHeader);
    curY += 20;

    // voice lines per mood
    if (diva.voice) {
      for (const mood of ["greet", "winSmall", "winBig", "lose", "idle"]) {
        const lines = diva.voice[mood];
        if (!lines || !lines.length) continue;
        const line = lines[0];
        const moodLabel = new PIXI.Text(`[${mood}]`, {
          fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "700", fill: 0xf2c76e
        });
        moodLabel.x = 16; moodLabel.y = curY;
        contentContainer.addChild(moodLabel);
        const lineTx = new PIXI.Text(`"${line}"`, {
          fontFamily: "Outfit, sans-serif", fontSize: 12, fontStyle: "italic", fill: 0xffe9b8,
          wordWrap: true, wordWrapWidth: W - 80
        });
        lineTx.x = 70; lineTx.y = curY - 1;
        contentContainer.addChild(lineTx);
        curY += lineTx.height + 6;
      }
    }

    curY += 8;
    const divider2 = new PIXI.Graphics();
    divider2.beginFill(diva.hue, 0.4).drawRect(16, curY, W - 32, 1).endFill();
    contentContainer.addChild(divider2);
    curY += 12;

    // stats header
    const statsHeader = new PIXI.Text("GAME STATS", {
      fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "900", fill: 0x9d4edd
    });
    statsHeader.x = 16; statsHeader.y = curY;
    contentContainer.addChild(statsHeader);
    curY += 20;

    // stats rows
    const stats = [
      ["Base Score", String(diva.base)],
      ["Shop Price", String(diva.price) + " chips"],
      ["Special", diva.special ? "YES (boss-tier)" : "no"],
      ["Hue Color", diva.hue],
      ["Accent Style", diva.accent || "—"]
    ];
    for (const [label, val] of stats) {
      const lTx = new PIXI.Text(label, {
        fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "600", fill: 0xb0b0b0
      });
      lTx.x = 16; lTx.y = curY;
      contentContainer.addChild(lTx);
      const vTx = new PIXI.Text(val, {
        fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "700", fill: 0xffe9b8
      });
      vTx.anchor.set(1, 0); vTx.x = W - 16; vTx.y = curY;
      contentContainer.addChild(vTx);
      curY += 18;
    }

    curY += 8;
    const divider3 = new PIXI.Graphics();
    divider3.beginFill(diva.hue, 0.4).drawRect(16, curY, W - 32, 1).endFill();
    contentContainer.addChild(divider3);
    curY += 12;

    // appears in header
    const appearsHeader = new PIXI.Text("APPEARS IN", {
      fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "900", fill: 0x9d4edd
    });
    appearsHeader.x = 16; appearsHeader.y = curY;
    contentContainer.addChild(appearsHeader);
    curY += 20;

    // appears in list
    const appearsTx = new PIXI.Text(bio.appearsIn.join(" · "), {
      fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "600", fill: 0xff2e88,
      wordWrap: true, wordWrapWidth: W - 32
    });
    appearsTx.x = 16; appearsTx.y = curY;
    contentContainer.addChild(appearsTx);
    curY += appearsTx.height + 12;

    // photo gallery header
    const galleryHeader = new PIXI.Text("PHOTO GALLERY", {
      fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "900", fill: 0x9d4edd
    });
    galleryHeader.x = 16; galleryHeader.y = curY;
    contentContainer.addChild(galleryHeader);
    curY += 20;

    // all 6 photos of this diva
    const photoCount = 6;
    const photoSize = (W - 32 - 12) / 3;  // 3 columns
    for (let i = 0; i < photoCount; i++) {
      const px = 16 + (i % 3) * (photoSize + 6);
      const py = curY + Math.floor(i / 3) * (photoSize + 6);
      const url = friendPhoto(id, i);
      const photoFrame = new PIXI.Graphics();
      photoFrame.lineStyle(2, diva.hue, 0.5).beginFill(0x1c0e2a).drawRoundedRect(px, py, photoSize, photoSize, 8).endFill();
      contentContainer.addChild(photoFrame);
      PIXI.Assets.load(url).then(tex => {
        if (!tex) return;
        const sp = new PIXI.Sprite(tex);
        const scale = Math.min(photoSize/tex.width, photoSize/tex.height);
        sp.scale.set(scale);
        sp.x = px + (photoSize - tex.width*scale)/2;
        sp.y = py + (photoSize - tex.height*scale)/2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(px, py, photoSize, photoSize, 8).endFill();
        contentContainer.addChild(mask);
        sp.mask = mask;
        contentContainer.addChild(sp);
      }).catch(()=>{});
    }
    curY += Math.ceil(photoCount / 3) * (photoSize + 6) + 20;

    maxScroll = Math.max(0, curY - contentH);
  }

  // === SECTION 2: Editor's Page (Vedhika special) ===
  function renderEditorPage() {
    const id = "vedhika";
    const diva = DIVAS[id];
    const bio = DIVA_BIOS[id];
    if (!diva || !bio) return;

    // back to list
    const backBtn = makeButton(120, 36, "← Inner Circle", 0x333333, 0xffffff, 12);
    backBtn.x = 8; backBtn.y = 4;
    backBtn.interactive = true; backBtn.buttonMode = true;
    backBtn.on("pointertap", () => { sfx.click(); renderSection("inner"); });
    contentContainer.addChild(backBtn);

    // editor banner
    const banner = new PIXI.Graphics();
    banner.lineStyle(3, 0xffd700, 1).beginFill(0x1c0e2a, 0.95).drawRoundedRect(8, 44, W - 16, 50, 12).endFill();
    contentContainer.addChild(banner);
    const bannerTx = new PIXI.Text("✦ EDITOR'S PAGE — Vedhika Roy ✦", {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 18, fontStyle: "italic", fontWeight: "900", fill: 0xffd700, align: "center"
    });
    bannerTx.anchor.set(0.5, 0.5); bannerTx.x = W/2; bannerTx.y = 69;
    contentContainer.addChild(bannerTx);

    // hero photo (larger than other divas)
    const heroY = 104;
    const heroH = 320;
    const heroW = W - 16;
    const heroUrl = friendPhoto(id, 0);
    PIXI.Assets.load(heroUrl).then(tex => {
      if (!tex) return;
      const backdrop = new PIXI.Sprite(tex);
      const bgScale = Math.max(heroW/tex.width, heroH/tex.height);
      backdrop.scale.set(bgScale);
      backdrop.x = 8 + (heroW - tex.width*bgScale)/2;
      backdrop.y = heroY + (heroH - tex.height*bgScale)/2;
      backdrop.alpha = 0.3;
      const bgMask = new PIXI.Graphics();
      bgMask.beginFill(0xffffff).drawRoundedRect(8, heroY, heroW, heroH, 14).endFill();
      contentContainer.addChild(bgMask);
      backdrop.mask = bgMask;
      contentContainer.addChild(backdrop);
      const sp = new PIXI.Sprite(tex);
      const scale = Math.min(heroW/tex.width, heroH/tex.height);
      sp.scale.set(scale);
      sp.x = 8 + (heroW - tex.width*scale)/2;
      sp.y = heroY + (heroH - tex.height*scale)/2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(8, heroY, heroW, heroH, 14).endFill();
      contentContainer.addChild(mask);
      sp.mask = mask;
      contentContainer.addChild(sp);
      // gold border (thicker for editor)
      const border = new PIXI.Graphics();
      border.lineStyle(5, 0xffd700, 1).drawRoundedRect(8, heroY, heroW, heroH, 14).endFill();
      contentContainer.addChild(border);
    }).catch(()=>{});

    // name + title
    const nameTx = new PIXI.Text("VEDHIKA ROY", {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 32, fontStyle: "italic", fontWeight: "900", fill: 0xffd700, align: "center"
    });
    nameTx.anchor.set(0.5, 0); nameTx.x = W/2; nameTx.y = heroY + heroH + 8;
    contentContainer.addChild(nameTx);

    const titleTx = new PIXI.Text("THE EDITOR · FINAL CUT AUTHORITY", {
      fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "700", fill: 0xff2e88, align: "center"
    });
    titleTx.anchor.set(0.5, 0); titleTx.x = W/2; titleTx.y = heroY + heroH + 44;
    contentContainer.addChild(titleTx);

    // bio paragraphs
    let curY = heroY + heroH + 70;
    const bioParas = bio.bio.split("\n\n");
    for (const para of bioParas) {
      const bioTx = new PIXI.Text(para, {
        fontFamily: "Playfair Display, Georgia, serif",
        fontSize: 15, fontStyle: "italic", fontWeight: "400", fill: 0xffe9b8,
        align: "left", wordWrap: true, wordWrapWidth: W - 32, lineHeight: 22
      });
      bioTx.x = 16; bioTx.y = curY;
      contentContainer.addChild(bioTx);
      curY += bioTx.height + 16;
    }

    // signature
    const sig = new PIXI.Text("— Vedhika Roy, Editor of the Den", {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 14, fontStyle: "italic", fill: 0xff2e88, align: "right"
    });
    sig.anchor.set(1, 0); sig.x = W - 16; sig.y = curY;
    contentContainer.addChild(sig);
    curY += sig.height + 20;

    // appears in
    const appearsHeader = new PIXI.Text("APPEARS IN", {
      fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "900", fill: 0x9d4edd
    });
    appearsHeader.x = 16; appearsHeader.y = curY;
    contentContainer.addChild(appearsHeader);
    curY += 20;
    const appearsTx = new PIXI.Text(bio.appearsIn.join(" · "), {
      fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "600", fill: 0xffd700,
      wordWrap: true, wordWrapWidth: W - 32
    });
    appearsTx.x = 16; appearsTx.y = curY;
    contentContainer.addChild(appearsTx);
    curY += appearsTx.height + 20;

    // photo gallery (all 6)
    const galleryHeader = new PIXI.Text("PHOTO GALLERY", {
      fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: "900", fill: 0x9d4edd
    });
    galleryHeader.x = 16; galleryHeader.y = curY;
    contentContainer.addChild(galleryHeader);
    curY += 20;
    const photoSize = (W - 32 - 12) / 3;
    for (let i = 0; i < 6; i++) {
      const px = 16 + (i % 3) * (photoSize + 6);
      const py = curY + Math.floor(i / 3) * (photoSize + 6);
      const url = friendPhoto(id, i);
      const frame = new PIXI.Graphics();
      frame.lineStyle(3, 0xffd700, 0.7).beginFill(0x1c0e2a).drawRoundedRect(px, py, photoSize, photoSize, 8).endFill();
      contentContainer.addChild(frame);
      PIXI.Assets.load(url).then(tex => {
        if (!tex) return;
        const sp = new PIXI.Sprite(tex);
        const scale = Math.min(photoSize/tex.width, photoSize/tex.height);
        sp.scale.set(scale);
        sp.x = px + (photoSize - tex.width*scale)/2;
        sp.y = py + (photoSize - tex.height*scale)/2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(px, py, photoSize, photoSize, 8).endFill();
        contentContainer.addChild(mask);
        sp.mask = mask;
        contentContainer.addChild(sp);
      }).catch(()=>{});
    }
    curY += 2 * (photoSize + 6) + 30;

    // closing note
    const closing = new PIXI.Text("The Den is yours. The chips are fake. The love is not.", {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 14, fontStyle: "italic", fill: 0xffd700, align: "center",
      wordWrap: true, wordWrapWidth: W - 32
    });
    closing.anchor.set(0.5, 0); closing.x = W/2; closing.y = curY;
    contentContainer.addChild(closing);
    curY += closing.height + 20;

    maxScroll = Math.max(0, curY - contentH);
  }

  // === SECTION 3: World Cast grouped gallery ===
  function renderWorldCast() {
    // filter tabs
    const filterPack = makeTabButton("Pack (100)", 8, 4, true);
    filterPack.interactive = true; filterPack.buttonMode = true;
    contentContainer.addChild(filterPack);
    const filterWorld = makeTabButton("World (200)", 8 + filterPack.width + 8, 4, false);
    filterWorld.interactive = true; filterWorld.buttonMode = true;
    contentContainer.addChild(filterWorld);

    let currentFilter = "pack";
    function showFilter(f) {
      currentFilter = f;
      updateTabActive(filterPack, f === "pack");
      updateTabActive(filterWorld, f === "world");
      // rebuild grid
      // remove all children except the filter tabs
      const toRemove = [];
      for (let i = 0; i < contentContainer.children.length; i++) {
        const ch = contentContainer.children[i];
        if (ch !== filterPack && ch !== filterWorld) toRemove.push(ch);
      }
      for (const ch of toRemove) contentContainer.removeChild(ch);
      buildGrid();
    }
    filterPack.on("pointertap", () => { sfx.click(); showFilter("pack"); });
    filterWorld.on("pointertap", () => { sfx.click(); showFilter("world"); });

    function buildGrid() {
      const items = currentFilter === "pack" ? PACK_NAMES : WORLD_CAST;
      const photoFn = currentFilter === "pack" ? packPhoto : worldPhoto;
      const photoFullFn = currentFilter === "pack" ? packPhotoFull : worldPhotoFull;
      const cols = 3;
      const cellSize = (W - 16 - 8) / cols;
      const gap = 4;
      const gridStartY = 44;
      let row = 0, col = 0;
      for (let i = 0; i < items.length; i++) {
        const cast = items[i];
        const x = 8 + col * (cellSize + gap);
        const y = gridStartY + row * (cellSize + gap);
        const cell = new PIXI.Container();
        cell.x = x; cell.y = y;
        const cellBg = new PIXI.Graphics();
        cellBg.beginFill(0x1c0e2a).drawRoundedRect(0, 0, cellSize, cellSize, 6).endFill();
        cell.addChild(cellBg);
        const url = photoFn(i + 1);
        PIXI.Assets.load(url).then(tex => {
          if (!tex || cell.destroyed) return;
          const sp = new PIXI.Sprite(tex);
          const scale = Math.min(cellSize/tex.width, cellSize/tex.height);
          sp.scale.set(scale);
          sp.x = (cellSize - tex.width*scale)/2;
          sp.y = (cellSize - tex.height*scale)/2;
          const mask = new PIXI.Graphics();
          mask.beginFill(0xffffff).drawRoundedRect(0, 0, cellSize, cellSize, 6).endFill();
          cell.addChild(mask);
          sp.mask = mask;
          cell.addChild(sp);
        }).catch(()=>{});
        // name overlay at bottom
        const nameBg = new PIXI.Graphics();
        nameBg.beginFill(0x000000, 0.7).drawRoundedRect(2, cellSize - 18, cellSize - 4, 16, 4).endFill();
        cell.addChild(nameBg);
        const nameTx = new PIXI.Text(cast.name || `Diva ${i+1}`, {
          fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: "600", fill: 0xffe9b8, align: "center"
        });
        nameTx.anchor.set(0.5, 0); nameTx.x = cellSize/2; nameTx.y = cellSize - 16;
        cell.addChild(nameTx);
        cell.interactive = true; cell.buttonMode = true;
        cell.cast = cast;
        cell.fullUrl = photoFullFn(i + 1);
        cell.on("pointertap", () => {
          sfx.click();
          showWorldDetail(cast, photoFullFn(i + 1));
        });
        contentContainer.addChild(cell);
        col++;
        if (col >= cols) { col = 0; row++; }
      }
      maxScroll = Math.max(0, gridStartY + (row + 1) * (cellSize + gap) - contentH);
    }
    buildGrid();
  }

  function showWorldDetail(cast, fullUrl) {
    contentContainer.removeChildren();
    scrollY = 0;
    contentContainer.y = contentY;
    // back
    const backBtn = makeButton(120, 36, "← World Cast", 0x333333, 0xffffff, 12);
    backBtn.x = 8; backBtn.y = 4;
    backBtn.interactive = true; backBtn.buttonMode = true;
    backBtn.on("pointertap", () => { sfx.click(); renderSection("world"); });
    contentContainer.addChild(backBtn);
    // photo (full-res)
    const photoY = 48;
    const photoH = Math.min(contentH - 120, 360);
    const photoW = W - 16;
    PIXI.Assets.load(fullUrl).then(tex => {
      if (!tex) return;
      const sp = new PIXI.Sprite(tex);
      const scale = Math.min(photoW/tex.width, photoH/tex.height);
      sp.scale.set(scale);
      sp.x = 8 + (photoW - tex.width*scale)/2;
      sp.y = photoY + (photoH - tex.height*scale)/2;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff).drawRoundedRect(8, photoY, photoW, photoH, 14).endFill();
      contentContainer.addChild(mask);
      sp.mask = mask;
      contentContainer.addChild(sp);
      const border = new PIXI.Graphics();
      border.lineStyle(3, 0xf2c76e, 1).drawRoundedRect(8, photoY, photoW, photoH, 14).endFill();
      contentContainer.addChild(border);
    }).catch(()=>{});
    // name + title
    const nameTx = new PIXI.Text(cast.name || "Diva", {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 26, fontStyle: "italic", fontWeight: "900", fill: 0xffe9b8, align: "center"
    });
    nameTx.anchor.set(0.5, 0); nameTx.x = W/2; nameTx.y = photoY + photoH + 8;
    contentContainer.addChild(nameTx);
    if (cast.title) {
      const titleTx = new PIXI.Text(`"${cast.title}"`, {
        fontFamily: "Outfit, sans-serif", fontSize: 13, fontStyle: "italic", fill: 0xff2e88, align: "center",
        wordWrap: true, wordWrapWidth: W - 32
      });
      titleTx.anchor.set(0.5, 0); titleTx.x = W/2; titleTx.y = photoY + photoH + 40;
      contentContainer.addChild(titleTx);
    }
    maxScroll = Math.max(0, photoY + photoH + 80 - contentH);
  }

  // initial render
  renderSection("inner");

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

function makeTabButton(label, x, y, active) {
  const c = new PIXI.Container();
  c.x = x; c.y = y;
  const bg = new PIXI.Graphics();
  bg.beginFill(active ? 0xf2c76e : 0x1c0e2a).drawRoundedRect(0, 0, 120, 32, 8).endFill();
  if (!active) bg.lineStyle(1, 0xf2c76e, 0.3).drawRoundedRect(0, 0, 120, 32, 8).endFill();
  c.addChild(bg);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: "700",
    fill: active ? 0x160b20 : 0xffe9b8, align: "center"
  });
  tx.anchor.set(0.5); tx.x = 60; tx.y = 16;
  c.addChild(tx);
  c.bgRef = bg;
  c.txRef = tx;
  return c;
}

function updateTabActive(tab, active) {
  if (!tab || !tab.bgRef) return;
  tab.bgRef.clear();
  tab.bgRef.beginFill(active ? 0xf2c76e : 0x1c0e2a).drawRoundedRect(0, 0, 120, 32, 8).endFill();
  if (!active) tab.bgRef.lineStyle(1, 0xf2c76e, 0.3).drawRoundedRect(0, 0, 120, 32, 8).endFill();
  tab.txRef.style.fill = active ? 0x160b20 : 0xffe9b8;
}
