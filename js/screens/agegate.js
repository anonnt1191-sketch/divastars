// screens/ageGate.js — 18+ entry. Required before any gameplay.
import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";

export function render(pixiApp, appRef) {
  const W = pixiApp.screen.width, H = pixiApp.screen.height;
  const c = new PIXI.Container();
  pixiApp.stage.addChild(c);

  // dark backdrop
  const bg = new PIXI.Graphics();
  bg.beginFill(0x120818).drawRect(0, 0, W, H).endFill();
  c.addChild(bg);

  // subtle gradient via overlay
  const grad = new PIXI.Graphics();
  for (let i = 0; i < H; i += 4) {
    const a = 0.05 + (i / H) * 0.15;
    grad.beginFill(0x9d4edd, a).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(grad);

  // logo
  const title = new PIXI.Text("DIVA'S DEN", {
    fontFamily: "Playfair Display, Georgia, serif",
    fontSize: Math.min(56, W * 0.1),
    fontStyle: "italic",
    fontWeight: "900",
    fill: 0xf2c76e,
    stroke: 0x160b20,
    strokeThickness: 4,
    align: "center"
  });
  title.anchor.set(0.5);
  title.x = W / 2;
  title.y = H * 0.3;
  c.addChild(title);

  const tagline = new PIXI.Text("High stakes. Higher heels.", {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: Math.min(18, W * 0.04),
    fontWeight: "400",
    fill: 0xff2e88,
    align: "center"
  });
  tagline.anchor.set(0.5);
  tagline.x = W / 2;
  tagline.y = H * 0.36;
  c.addChild(tagline);

  // question
  const q = new PIXI.Text(t("ageGate.title"), {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: Math.min(22, W * 0.05),
    fontWeight: "600",
    fill: 0xffffff,
    align: "center",
    wordWrap: true,
    wordWrapWidth: W * 0.8
  });
  q.anchor.set(0.5);
  q.x = W / 2;
  q.y = H * 0.5;
  c.addChild(q);

  const body = new PIXI.Text(t("ageGate.body"), {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: Math.min(13, W * 0.032),
    fontWeight: "400",
    fill: 0xb0b0b0,
    align: "center",
    wordWrap: true,
    wordWrapWidth: W * 0.78
  });
  body.anchor.set(0.5);
  body.x = W / 2;
  body.y = H * 0.6;
  c.addChild(body);

  // yes button
  const yesBtn = makeButton(W * 0.7, 56, t("ageGate.yes"), 0xf2c76e, 0x160b20);
  yesBtn.x = W / 2;
  yesBtn.y = H * 0.78;
  yesBtn.interactive = true;
  yesBtn.buttonMode = true;
  yesBtn.on("pointertap", () => {
    sfx.click();
    store.setAgeVerified();
    appRef.go(store.state.seenOnboarding ? "lobby" : "onboarding");
  });
  c.addChild(yesBtn);

  // no button
  const noBtn = makeButton(W * 0.7, 44, t("ageGate.no"), 0x333333, 0xffffff);
  noBtn.x = W / 2;
  noBtn.y = H * 0.88;
  noBtn.interactive = true;
  noBtn.buttonMode = true;
  noBtn.on("pointertap", () => {
    sfx.click();
    document.body.innerHTML = "<div style='color:#fff;font-family:sans-serif;text-align:center;padding:40vh 20px;background:#120818;height:100vh'>Sorry — you must be 18+ to enter the Den.</div>";
  });
  c.addChild(noBtn);
}

function makeButton(w, h, label, bg, fg) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(bg).drawRoundedRect(-w/2, -h/2, w, h, h/3).endFill();
  c.addChild(g);
  const t = new PIXI.Text(label, {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: Math.min(18, h * 0.4),
    fontWeight: "700",
    fill: fg,
    align: "center"
  });
  t.anchor.set(0.5);
  c.addChild(t);
  return c;
}
