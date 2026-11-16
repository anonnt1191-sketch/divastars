// screens/onboarding.js — 20-second intro: Vedhika's voice, photos of inner circle parading.
import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { DIVA_IDS, DIVAS, UI_BG } from "../data/divas.js";
import { friendPhoto } from "../core/photos.js";

export async function render(pixiApp, appRef) {
  const W = pixiApp.screen.width, H = pixiApp.screen.height;
  const c = new PIXI.Container();
  pixiApp.stage.addChild(c);

  // backdrop using one of the title backgrounds
  const bgUrl = UI_BG.title[Math.floor(Math.random() * UI_BG.title.length)];
  try {
    const tex = await PIXI.Assets.load(bgUrl);
    const bg = new PIXI.Sprite(tex);
    bg.width = W; bg.height = H;
    bg.alpha = 0.4;
    c.addChild(bg);
  } catch(e) {}

  // dark overlay
  const dark = new PIXI.Graphics();
  dark.beginFill(0x000000, 0.5).drawRect(0, 0, W, H).endFill();
  c.addChild(dark);

  // slideshow of inner-circle divas
  const photoContainer = new PIXI.Container();
  c.addChild(photoContainer);

  // vedhika's voice text — sequential
  const voiceText = new PIXI.Text("", {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: Math.min(28, W * 0.06),
    fontStyle: "italic",
    fontWeight: "400",
    fill: 0xf2c76e,
    align: "center",
    wordWrap: true,
    wordWrapWidth: W * 0.8
  });
  voiceText.anchor.set(0.5);
  voiceText.x = W / 2;
  voiceText.y = H * 0.75;
  c.addChild(voiceText);

  // sub text
  const sub = new PIXI.Text("— Vedhika Roy, Editor of the Den", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: Math.min(14, W * 0.034),
    fontWeight: "400",
    fill: 0xff2e88,
    align: "center"
  });
  sub.anchor.set(0.5);
  sub.x = W / 2;
  sub.y = H * 0.83;
  sub.alpha = 0;
  c.addChild(sub);

  // begin button
  const beginBtn = makeButton(W * 0.7, 56, t("onboarding.begin"), 0xf2c76e, 0x160b20);
  beginBtn.x = W / 2;
  beginBtn.y = H * 0.92;
  beginBtn.interactive = true;
  beginBtn.buttonMode = true;
  beginBtn.alpha = 0;
  beginBtn.on("pointertap", () => {
    sfx.click();
    store.setOnboardingSeen();
    appRef.go("lobby");
  });
  c.addChild(beginBtn);

  // intro sequence
  const script = [
    { text: t("onboarding.intro1"), photo: "vedhika" },
    { text: t("onboarding.intro2"), photo: "kallie" },
    { text: t("onboarding.intro3"), photo: "soumya" },
    { text: t("onboarding.intro4"), photo: "riddhima" }
  ];

  let i = 0;
  let el = 0;
  let curPhoto = null;

  const showSlide = async (n) => {
    if (curPhoto) { photoContainer.removeChildren(); curPhoto.destroy(); curPhoto = null; }
    const step = script[n];
    if (!step) return;
    const id = step.photo;
    const diva = DIVAS[id];
    // pick a photo of this diva
    const url = friendPhoto(id, Math.floor(Math.random() * 6));
    try {
      const tex = await PIXI.Assets.load(url);
      const sp = new PIXI.Sprite(tex);
      const maxW = W * 0.7, maxH = H * 0.5;
      const scale = Math.min(maxW / sp.texture.width, maxH / sp.texture.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5);
      sp.x = W / 2;
      sp.y = H * 0.35;
      sp.alpha = 0;
      photoContainer.addChild(sp);
      curPhoto = sp;
    } catch(e) {}

    // fade in voice text
    voiceText.text = step.text;
    voiceText.alpha = 0;
    if (n === script.length - 1) sub.alpha = 0;
  };

  const tickerFn = async (dt) => {
    el += dt * 16.67;
    if (el < 4000) {
      // slide 1
      if (i === 0) { i = 1; await showSlide(0); }
      voiceText.alpha = Math.min(1, el / 800);
      if (curPhoto) curPhoto.alpha = Math.min(1, el / 800);
    } else if (el < 7000) {
      if (i === 1) { i = 2; await showSlide(1); }
      voiceText.alpha = Math.min(1, (el - 4000) / 600);
      if (curPhoto) curPhoto.alpha = Math.min(1, (el - 4000) / 600);
    } else if (el < 10000) {
      if (i === 2) { i = 3; await showSlide(2); }
      voiceText.alpha = Math.min(1, (el - 7000) / 600);
      if (curPhoto) curPhoto.alpha = Math.min(1, (el - 7000) / 600);
    } else if (el < 13000) {
      if (i === 3) { i = 4; await showSlide(3); }
      voiceText.alpha = Math.min(1, (el - 10000) / 600);
      if (curPhoto) curPhoto.alpha = Math.min(1, (el - 10000) / 600);
    } else {
      // fade out slideshow, show begin button
      voiceText.alpha = Math.max(0, 1 - (el - 13000) / 600);
      if (curPhoto) curPhoto.alpha = Math.max(0, 1 - (el - 13000) / 600);
      sub.alpha = Math.min(1, (el - 13500) / 600);
      beginBtn.alpha = Math.min(1, (el - 14000) / 600);
      beginBtn.interactive = el > 14000;
      if (el > 16000) pixiApp.ticker.remove(tickerFn);
    }
  };
  pixiApp.ticker.add(tickerFn);

  // allow tap to skip
  const skipFn = () => {
    pixiApp.ticker.remove(tickerFn);
    store.setOnboardingSeen();
    appRef.go("lobby");
  };
  c.interactive = true;
  c.on("pointertap", skipFn);

  return {
    cleanup: () => {
      pixiApp.ticker.remove(tickerFn);
      c.off("pointertap", skipFn);
    }
  };
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(-w/2, -h/2, w, h, h/3).endFill();
  c.addChild(g);
  const tx = new PIXI.Text(label, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: Math.min(18, h * 0.4),
    fontWeight: "700",
    fill: fg,
    align: "center"
  });
  tx.anchor.set(0.5);
  c.addChild(tx);
  return c;
}
